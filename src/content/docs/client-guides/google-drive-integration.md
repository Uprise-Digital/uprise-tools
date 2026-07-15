---
title: "How to Add Google Drive Integration to Onboarding"
description: "Enable automatic client folder generation and template directory duplication in Google Drive."
audience: "public"
category: "client-guides"
author: "Abdullah (Uprise Team)"
date: "2026-07-15"
---

# How to Add Google Drive Integration to Onboarding

The Google Drive Integration automates the provisioning of client assets during onboarding. It connects with your agency's Google Workspace to automatically set up folder structures, eliminating manual folder creation.

---

## Why Google Drive Integration is Useful

*   **Automation:** Instantly creates a root folder for every new client onboarded.
*   **Template Duplication:** Recursively copies a master template folder structure (e.g., Graphics, Ad Copy, Reports) for every new account.
*   **Decoupled Scopes:** Fully independent connection separate from Google Ads, allowing you to use different Google accounts for ads and files.

---

## Step-by-Step Configuration Guide

### Step 1: Connect Your Google Drive Account

1. Sign in to your **Uprise Onboarding Portal**.
2. Navigate to **Settings** from the main sidebar.
3. Click on the **Onboarding Configurator** tab.
4. Under the **Google Drive Folder Automation** card, look for the **Google Drive Account Link Required** panel.
5. Click **Connect Google Drive**.

![Click Connect Google Drive](/images/docs/onboarding/settings-onboarding-tab.png)

6. Select the Google account you wish to authorize.
7. Accept the required permissions screen. (Once connected, you will see a badge showing **Connected to Google Drive: user@yourdomain.com**).

---

### Step 2: Configure Folder IDs

After linking your account, configure the directory structures:

1. **Parent Directory Folder ID (Optional):**
   * Go to your Google Drive and open the folder where you want all client onboarding folders created.
   * Copy the alphanumeric ID from the browser URL (e.g., `https://drive.google.com/drive/folders/1a2b3c...` → ID is `1a2b3c...`).
   * Paste it into the **Parent Directory Folder ID** field.

2. **Template Folder ID (Optional):**
   * If you have a master folder layout you want to duplicate, open that folder in Google Drive.
   * Copy its ID from the browser URL.
   * Paste it into the **Template Folder ID** field.

![Enter Folder IDs](/images/docs/onboarding/google-drive-connection.png)

---

### Step 3: Verify and Save

1. Ensure the **Google Drive Folder Automation** toggle switch is turned **ON** in the card header.
2. Click **Save Configuration** at the bottom of the page.
3. The portal will perform a live access test. Once verified, a green badge showing **Connection Valid** will appear.

---

## Troubleshooting

*   **Insufficient Scopes Error:** If you get a scopes error, click **Disconnect** on the Google Drive card and reconnect to ensure all Google Drive folder permissions are granted.
*   **Access Denied / Not Found:** Make sure that the connected Google account has **Editor** permissions to the folder IDs you pasted in.
