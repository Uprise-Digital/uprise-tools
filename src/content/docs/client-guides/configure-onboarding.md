---
title: "How to Configure Onboarding Automation"
description: "Master configuration of client emails, automation triggers, and integration verification flags."
audience: "public"
category: "client-guides"
author: "Abdullah (Uprise Team)"
date: "2026-07-15"
---

# How to Configure Onboarding Automation

The Onboarding Configurator gives you complete control over what happens when new clients are added to your agency portal. You can toggle active workspaces, write custom emails, and customize onboarding automation.

---

## Why Onboarding Automation is Useful

*   **Standardized Workflows:** Onboard clients with a single form submission.
*   **Custom Brand Emails:** Write personalized subject lines and templates containing onboarding links that adapt to each client automatically.
*   **Security Warnings:** Visual warning banners instantly warn you if an API key expires or a folder connection breaks.

---

## Step-by-Step Configuration Guide

### Step 1: Manage Integrations

1. Navigate to **Settings > Onboarding Configurator**.
2. Review the active integrations (Google Drive and Notion).
3. Toggle them ON or OFF depending on your preferences. If disabled, the portal will skip generating folders/dashboards for new clients.

![Onboarding Configurator Settings tab](/images/docs/onboarding/onboarding-automation-setup.png)

---

### Step 2: Customize the Welcome Email Template

Scroll down to the **Custom Welcome Email Template** card:

1. **Email Subject:** Type a subject line.
2. **Email Body Template:** Write your message body. You can use standard Markdown or Plain Text.
3. **Template Variables:** To personalize the email dynamically, insert the following placeholder variables:
   * `{{primary_contact_name}}` - The client contact person's name.
   * `{{client_name}}` - The client company name.
   * `{{drive_link}}` - The generated Google Drive folder link.
   * `{{notion_link}}` - The generated Notion dashboard link.
   * `{{signal_link}}` - The Signal group invite link.

For example:
```markdown
Hello {{primary_contact_name}},

Welcome to Uprise! We've set up your workspaces:
* Drive Folder: {{drive_link}}
* Notion Workspace: {{notion_link}}

Let's do great things together!
```

---

### Step 3: Save and Verify

1. Click **Save Configuration** at the bottom.
2. If credentials are correct, the connection status badges will show **Connection Valid**.
3. **Connection Warnings:** If there is a connection problem, the configurator tab displays a **red warning triangle** (`Connection Failed`) along with the exact API error details so you can fix it before onboarding any clients.

---

## Next Steps

Once the settings are configured and verified, you can go to the **Clients** dashboard, click **Add Client**, and watch the Google Drive, Notion, and email dispatch pipelines execute automatically!
