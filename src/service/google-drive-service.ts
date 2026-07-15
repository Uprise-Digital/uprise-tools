import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/db";
import { organizationOnboardingSettings } from "@/db/schema";

/**
 * Initializes a Google Drive API client using either Service Account or OAuth2 credentials.
 */
async function getDriveClient(organizationId?: string) {
  const saEmail = process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL;
  const saKey = process.env.GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY;

  if (saEmail && saKey) {
    const auth = new google.auth.JWT({
      email: saEmail,
      key: saKey.replace(/\\n/g, "\n"),
      scopes: ["https://www.googleapis.com/auth/drive"],
    });
    return google.drive({ version: "v3", auth });
  }

  const clientId = process.env.GOOGLE_CLIENT_ID;
  const clientSecret = process.env.GOOGLE_CLIENT_SECRET;

  let refreshToken =
    process.env.GOOGLE_DRIVE_REFRESH_TOKEN ||
    process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (organizationId) {
    const settings = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(organizationOnboardingSettings.organizationId, organizationId),
    });
    if (settings?.googleDriveRefreshToken) {
      try {
        const { decryptToken } = await import("@/lib/crypto");
        refreshToken = decryptToken(settings.googleDriveRefreshToken);
      } catch (err) {
        console.error("Failed to decrypt Google Drive token:", err);
      }
    }
  }

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  throw new Error(
    "Missing Google Drive API credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY or connect Google Ads/Drive in settings.",
  );
}

/**
 * Recursively copies a folder and its contents in Google Drive.
 */
async function copyFolderRecursive(
  drive: ReturnType<typeof google.drive>,
  sourceFolderId: string,
  targetParentFolderId: string | undefined,
  newFolderName: string,
): Promise<string> {
  // 1. Create target folder
  const metadata: any = {
    name: newFolderName,
    mimeType: "application/vnd.google-apps.folder",
  };
  if (targetParentFolderId) {
    metadata.parents = [targetParentFolderId];
  }

  const folderRes = await drive.files.create({
    requestBody: metadata,
    fields: "id",
  });
  const newFolderId = folderRes.data.id;
  if (!newFolderId) throw new Error("Failed to create new folder.");

  // 2. List files in source folder
  const listRes = await drive.files.list({
    q: `'${sourceFolderId}' in parents and trashed = false`,
    fields: "files(id, name, mimeType)",
  });

  const files = listRes.data.files || [];
  for (const file of files) {
    if (!file.id || !file.name) continue;

    if (file.mimeType === "application/vnd.google-apps.folder") {
      // Recursively copy subfolders
      await copyFolderRecursive(drive, file.id, newFolderId, file.name);
    } else {
      // Copy files
      await drive.files.copy({
        fileId: file.id,
        requestBody: {
          name: file.name,
          parents: [newFolderId],
        },
      });
    }
  }

  return newFolderId;
}

/**
 * Replaces variables inside double curly braces (e.g. {{client_name}}).
 */
function replaceVariables(
  pattern: string,
  variables: Record<string, string>,
): string {
  let result = pattern;
  for (const [key, val] of Object.entries(variables)) {
    const regex = new RegExp(`{{\\s*${key}\\s*}}`, "g");
    result = result.replace(regex, val);
  }
  return result;
}

/**
 * Programmatically creates nested subfolders under a root parent.
 */
async function createCustomStructure(
  drive: ReturnType<typeof google.drive>,
  rootFolderId: string,
  paths: string[],
) {
  const sorted = [...paths].sort(
    (a, b) => a.split("/").length - b.split("/").length,
  );
  const pathMap: Record<string, string> = { "": rootFolderId };

  for (const p of sorted) {
    const cleaned = p.replace(/^\/+|\/+$/g, "");
    if (!cleaned) continue;

    const parts = cleaned.split("/");
    let parentPath = "";
    let currentParentId = rootFolderId;

    for (const part of parts) {
      const currentPath = parentPath ? `${parentPath}/${part}` : part;

      if (pathMap[currentPath]) {
        currentParentId = pathMap[currentPath];
      } else {
        const metadata: any = {
          name: part,
          mimeType: "application/vnd.google-apps.folder",
          parents: [currentParentId],
        };
        const folderRes = await drive.files.create({
          requestBody: metadata,
          fields: "id",
        });
        const folderId = folderRes.data.id;
        if (!folderId) throw new Error(`Failed to create subfolder ${part}`);
        pathMap[currentPath] = folderId;
        currentParentId = folderId;
      }
      parentPath = currentPath;
    }
  }
}

/**
 * Automates permissions sharing with list of emails.
 */
async function shareFolder(
  drive: ReturnType<typeof google.drive>,
  folderId: string,
  emails: string[],
  role: "reader" | "writer",
) {
  for (const email of emails) {
    const trimmed = email.trim();
    if (!trimmed) continue;
    try {
      console.log(
        `Google Drive Service: Sharing folder ${folderId} with ${trimmed} as ${role}...`,
      );
      await drive.permissions.create({
        fileId: folderId,
        requestBody: {
          type: "user",
          role: role === "writer" ? "writer" : "reader",
          emailAddress: trimmed,
        },
        sendNotificationEmail: false,
      });
    } catch (err: any) {
      console.warn(`Failed to share folder with ${trimmed}:`, err.message);
    }
  }
}

/**
 * Duplicates template files (Google Docs/Sheets/Slides) inside target folder.
 */
async function copyTemplateFile(
  drive: ReturnType<typeof google.drive>,
  fileId: string,
  parentFolderId: string,
  newFileName: string,
): Promise<string> {
  const res = await drive.files.copy({
    fileId: fileId,
    requestBody: {
      name: newFileName,
      parents: [parentFolderId],
    },
    fields: "id",
  });
  return res.data.id || "";
}

export async function createClientDriveFolder(
  clientName: string,
  parentFolderId?: string,
  templateFolderId?: string,
  organizationId?: string,
  options?: {
    mode?: "copy-template" | "create-structure" | "empty-folder";
    folderNamePattern?: string;
    subfolders?: string[];
    shareEmails?: string;
    shareRole?: "reader" | "writer";
    docRules?: { templateFileId: string; namePattern: string }[];
    clientEmail?: string;
  },
): Promise<string> {
  const drive = await getDriveClient(organizationId);

  // 1. Resolve naming pattern
  const pattern = options?.folderNamePattern || "{{client_name}} Onboarding";
  const variables = {
    client_name: clientName,
    contact_email: options?.clientEmail || "",
  };
  const resolvedFolderName = replaceVariables(pattern, variables);

  const actualParentFolderId =
    parentFolderId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID;

  let rootFolderId = "";
  const mode =
    options?.mode || (templateFolderId ? "copy-template" : "empty-folder");

  if (mode === "copy-template") {
    const actualTemplateFolderId =
      templateFolderId || process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
    if (!actualTemplateFolderId) {
      throw new Error(
        "No template folder ID configured for copy-template mode.",
      );
    }
    console.log(
      `Google Drive Service: Copying template folder ${actualTemplateFolderId} as ${resolvedFolderName}...`,
    );
    rootFolderId = await copyFolderRecursive(
      drive,
      actualTemplateFolderId,
      actualParentFolderId || undefined,
      resolvedFolderName,
    );
  } else {
    // create-structure or empty-folder
    console.log(
      `Google Drive Service: Creating folder ${resolvedFolderName}...`,
    );
    const metadata: any = {
      name: resolvedFolderName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (actualParentFolderId) {
      metadata.parents = [actualParentFolderId];
    }
    const res = await drive.files.create({
      requestBody: metadata,
      fields: "id",
    });
    rootFolderId = res.data.id || "";
    if (!rootFolderId) throw new Error("Failed to create Google Drive folder.");

    if (
      mode === "create-structure" &&
      options?.subfolders &&
      options.subfolders.length > 0
    ) {
      console.log(
        `Google Drive Service: Creating folder structure with ${options.subfolders.length} items...`,
      );
      await createCustomStructure(drive, rootFolderId, options.subfolders);
    }
  }

  // 2. Share permissions
  if (options?.shareEmails) {
    const resolvedEmails = replaceVariables(options.shareEmails, variables);
    const emailsList = resolvedEmails
      .split(",")
      .map((e) => e.trim())
      .filter(Boolean);
    if (emailsList.length > 0) {
      const role = options.shareRole || "writer";
      await shareFolder(drive, rootFolderId, emailsList, role);
    }
  }

  // 3. Process google docs rules
  if (options?.docRules && options.docRules.length > 0) {
    console.log(
      `Google Drive Service: Processing ${options.docRules.length} Google Docs rules...`,
    );
    for (const rule of options.docRules) {
      if (!rule.templateFileId) continue;
      const resolvedDocName = replaceVariables(rule.namePattern, variables);
      try {
        await copyTemplateFile(
          drive,
          rule.templateFileId,
          rootFolderId,
          resolvedDocName,
        );
      } catch (err: any) {
        console.warn(
          `Failed to copy template file ${rule.templateFileId}:`,
          err.message,
        );
      }
    }
  }

  return `https://drive.google.com/drive/folders/${rootFolderId}`;
}

/**
 * Verifies if a folder ID is accessible in Google Drive.
 */
export async function verifyDriveFolderAccess(
  folderId: string,
  organizationId?: string,
): Promise<boolean> {
  const drive = await getDriveClient(organizationId);
  try {
    const res = await drive.files.get({
      fileId: folderId,
      fields: "id, name, mimeType",
    });
    if (res.data.mimeType !== "application/vnd.google-apps.folder") {
      throw new Error("Specified Google Drive ID is not a folder.");
    }
    return true;
  } catch (err: any) {
    throw new Error(err.message || "Failed to access Google Drive folder.");
  }
}
