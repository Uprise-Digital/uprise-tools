import { eq } from "drizzle-orm";
import { google } from "googleapis";
import { db } from "@/db";
import { googleAdsConnections } from "@/db/schema";

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
    const connection = await db.query.googleAdsConnections.findFirst({
      where: eq(googleAdsConnections.organizationId, organizationId),
    });
    if (connection?.refreshToken) {
      refreshToken = connection.refreshToken;
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

export async function createClientDriveFolder(
  clientName: string,
  parentFolderId?: string,
  templateFolderId?: string,
  organizationId?: string,
): Promise<string> {
  const drive = await getDriveClient(organizationId);
  const actualTemplateFolderId =
    templateFolderId || process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
  const actualParentFolderId =
    parentFolderId || process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID; // Optional root client folder

  console.log(
    `Google Drive Service: Creating folder for client '${clientName}'...`,
  );

  if (actualTemplateFolderId) {
    console.log(
      `Google Drive Service: Duplicating template folder: ${actualTemplateFolderId}`,
    );
    const folderId = await copyFolderRecursive(
      drive,
      actualTemplateFolderId,
      actualParentFolderId,
      clientName,
    );
    return `https://drive.google.com/drive/folders/${folderId}`;
  } else {
    console.log(
      "Google Drive Service: No template ID configured. Creating empty folder...",
    );
    const metadata: any = {
      name: clientName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (actualParentFolderId) {
      metadata.parents = [actualParentFolderId];
    }

    const res = await drive.files.create({
      requestBody: metadata,
      fields: "id",
    });
    const folderId = res.data.id;
    if (!folderId) throw new Error("Failed to create Google Drive folder.");
    return `https://drive.google.com/drive/folders/${folderId}`;
  }
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
