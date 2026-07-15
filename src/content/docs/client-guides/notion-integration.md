---
title: "How to Add Notion Integration to Onboarding"
description: "Enable automatic client dashboard generation and template page duplication in Notion."
audience: "public"
category: "client-guides"
author: "Abdullah (Uprise Team)"
date: "2026-07-15"
---

# How to Add Notion Integration to Onboarding

The Notion Integration automates the provisioning of a private, dedicated client dashboard in Notion during onboarding. It duplicates your master agency dashboard template to give new clients instant access to resources, files, and onboarding portals.

---

## Why Notion Integration is Useful

*   **Custom Client Portals:** Automatically creates a unique workspace page for every client.
*   **Template Cloning:** Clones a structured master client template, keeping your onboarding workspaces standardized.
*   **Real-time Collaboration:** Instantly creates a live dashboard link ready to be sent to clients via email.

---

## Step-by-Step Configuration Guide

### Step 1: Create an Internal Integration in Notion

To connect Uprise to Notion, you need an API Access Token:

1. Visit [notion.so/my-integrations](https://www.notion.so/my-integrations) and sign in.
2. Click **+ New integration**.
3. Set the name to **Uprise Onboarding Portal**, select the correct workspace, and click **Submit**.
4. Copy the **Internal Integration Token** (starts with `secret_` or `ntn_`). Keep this token private!

![Create Notion Connection](/images/docs/onboarding/notion-connection.png)

---

### Step 2: Share Pages in Notion

Notion requires you to explicitly share the parent and template pages with the integration connection:

1. Open the page in Notion that you want to use as your **Parent Page** (where new client dashboards will be created).
2. Click the three dots `...` (top right) or the **Share** button.
3. Click **Add Connections** (or search under Connections).
4. Search for **Uprise Onboarding Portal** and select it to grant access.
5. Copy the 32-character ID of this page from the URL. (e.g. `https://notion.so/Parent-Page-2690d9465bcd80b099ecfcb1dad11be2` → ID is `2690d9465bcd80b099ecfcb1dad11be2`).
6. **Repeat this step** to share your **Template Page** with the integration.

---

### Step 3: Configure Portal Settings

1. In the **Uprise Onboarding Portal**, navigate to **Settings > Onboarding Configurator**.
2. Under **Notion Client Dashboard Automation**, toggle the switch to **ON**.
3. Paste the **Notion API Access Token** into the input field.
4. Paste the **Parent Page ID** and the **Template Page ID** into their respective fields.

![Enter Notion Settings](/images/docs/onboarding/notion-dashboard-integration.png)

5. Click **Save Configuration** at the bottom.
6. The portal will verify connection permissions. Once valid, you will see a green **Connection Valid** badge.

---

## Troubleshooting

*   **Could Not Find Page with ID (Object Not Found):** Double check that you shared both the Parent Page and the Template Page with the **Uprise Onboarding Portal** connection in Notion.
*   **401 Unauthorized:** Ensure your API Access Token was pasted correctly and starts with `secret_` or `ntn_`.
