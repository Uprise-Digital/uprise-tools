import { google } from "googleapis";

/**
 * Initializes a Google Drive API client using either Service Account or OAuth2 credentials.
 */
function getDriveClient() {
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
  // Fall back to GOOGLE_ADS_REFRESH_TOKEN if GOOGLE_DRIVE_REFRESH_TOKEN is not defined
  const refreshToken = process.env.GOOGLE_DRIVE_REFRESH_TOKEN || process.env.GOOGLE_ADS_REFRESH_TOKEN;

  if (clientId && clientSecret && refreshToken) {
    const oauth2Client = new google.auth.OAuth2(clientId, clientSecret);
    oauth2Client.setCredentials({ refresh_token: refreshToken });
    return google.drive({ version: "v3", auth: oauth2Client });
  }

  throw new Error("Missing Google Drive API credentials. Set GOOGLE_SERVICE_ACCOUNT_EMAIL/KEY or GOOGLE_CLIENT_ID/SECRET/REFRESH_TOKEN in env.");
}

/**
 * Recursively copies a folder and its contents in Google Drive.
 */
async function copyFolderRecursive(
  drive: ReturnType<typeof google.drive>,
  sourceFolderId: string,
  targetParentFolderId: string | undefined,
  newFolderName: string
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
 * Creates a client folder. If a template ID is configured, it duplicates the template.
 * Otherwise, it creates a fresh empty client folder.
 */
export async function createClientDriveFolder(clientName: string): Promise<string> {
  const drive = getDriveClient();
  const templateFolderId = process.env.GOOGLE_DRIVE_TEMPLATE_FOLDER_ID;
  const parentFolderId = process.env.GOOGLE_DRIVE_PARENT_FOLDER_ID; // Optional root client folder

  console.log(`Google Drive Service: Creating folder for client '${clientName}'...`);

  if (templateFolderId) {
    console.log(`Google Drive Service: Duplicating template folder: ${templateFolderId}`);
    const folderId = await copyFolderRecursive(drive, templateFolderId, parentFolderId, clientName);
    return `https://drive.google.com/drive/folders/${folderId}`;
  } else {
    console.log("Google Drive Service: No template ID configured. Creating empty folder...");
    const metadata: any = {
      name: clientName,
      mimeType: "application/vnd.google-apps.folder",
    };
    if (parentFolderId) {
      metadata.parents = [parentFolderId];
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
