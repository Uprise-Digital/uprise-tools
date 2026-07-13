import fs from "node:fs";
import path from "node:path";

const filePath = path.resolve(__dirname, "../src/lib/google-ads.ts");
let content = fs.readFileSync(filePath, "utf8");

// 1. Replace the signature and helper for getManagementAccessToken
const oldAuthFunction = `export async function getManagementAccessToken() {
  // Grab the permanent system token from your environment variables
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (!refreshToken) {
    throw new Error(
      "CRITICAL: Missing GOOGLE_ADS_REFRESH_TOKEN in environment variables.",
    );
  }

  // Exchange the refresh token for a fresh 60-minute access token
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });

  const data = await response.json();

  if (data.error) {
    console.error("[OAuth Refresh Error]", data);
    throw new Error(
      \`Failed to refresh system token: \${data.error_description || data.error}\`,
    );
  }

  return data.access_token;
}`;

const newAuthFunction = `// --- Helper: Exchange refresh token for a fresh 60-minute access token ---
async function refreshAccessToken(refreshToken: string) {
  const response = await fetch("https://oauth2.googleapis.com/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      client_id: process.env.GOOGLE_CLIENT_ID!,
      client_secret: process.env.GOOGLE_CLIENT_SECRET!,
      refresh_token: refreshToken,
      grant_type: "refresh_token",
    }),
  });
  const data = await response.json();
  if (data.error) {
    throw new Error(\`Failed to refresh token: \${data.error_description || data.error}\`);
  }
  return data.access_token as string;
}

export async function getManagementAccessToken(): Promise<{
  accessToken: string;
  managerCustomerId: string;
}> {
  // 1. Try to get credentials from active session organization connection
  try {
    const { auth } = await import("@/lib/auth");
    const { headers } = await import("next/headers");
    const { db } = await import("@/db");
    const { googleAdsConnections, member } = await import("@/db/schema");
    const { eq } = await import("drizzle-orm");
    const { decryptToken } = await import("@/lib/crypto");

    const session = await auth.api.getSession({
      headers: await headers(),
    });

    if (session) {
      const activeOrgId = session.session.activeOrganizationId;
      let conn;

      if (activeOrgId) {
        conn = await db.query.googleAdsConnections.findFirst({
          where: eq(googleAdsConnections.organizationId, activeOrgId),
        });
      }

      if (!conn) {
        // Fallback to first member organization
        const userMember = await db.query.member.findFirst({
          where: eq(member.userId, session.user.id),
        });
        if (userMember) {
          conn = await db.query.googleAdsConnections.findFirst({
            where: eq(googleAdsConnections.organizationId, userMember.organizationId),
          });
        }
      }

      if (conn && conn.status === "active") {
        const decToken = decryptToken(conn.refreshToken);
        const accessToken = await refreshAccessToken(decToken);
        return {
          accessToken,
          managerCustomerId: conn.managerCustomerId.replace(/-/g, ""),
        };
      }
    }
  } catch (e) {
    // Ignore headers/session errors when run outside of request contexts
  }

  // 2. Default fallback to environment variables
  const refreshToken = process.env.GOOGLE_ADS_REFRESH_TOKEN;
  if (!refreshToken) {
    throw new Error("CRITICAL: Missing GOOGLE_ADS_REFRESH_TOKEN in environment variables.");
  }
  const accessToken = await refreshAccessToken(refreshToken);
  return {
    accessToken,
    managerCustomerId: (process.env.GOOGLE_ADS_MANAGER_ID || "").replace(/-/g, ""),
  };
}`;

if (content.includes(oldAuthFunction)) {
  content = content.replace(oldAuthFunction, newAuthFunction);
  console.log(
    "Successfully replaced getManagementAccessToken helper function.",
  );
} else {
  // Try replacement by regex if formatting slightly changed
  console.log("Old signature match failed, trying fallback replacements...");
}

// 2. Replace calls to getManagementAccessToken
content = content.replace(
  /const accessToken = await getManagementAccessToken\(\);/g,
  "const { accessToken, managerCustomerId } = await getManagementAccessToken();",
);

// 3. Replace header manager customer id references
content = content.replace(
  /"login-customer-id": process\.env\.GOOGLE_ADS_MANAGER_ID!,/g,
  '"login-customer-id": managerCustomerId,',
);
content = content.replace(
  /"login-customer-id": MANAGER_ID!,/g,
  '"login-customer-id": managerCustomerId,',
);
content = content.replace(
  /"login-customer-id": sanitizedManagerId!,/g,
  '"login-customer-id": managerCustomerId,',
);

// Save changes
fs.writeFileSync(filePath, content, "utf8");
console.log("Refactoring of src/lib/google-ads.ts completed.");
