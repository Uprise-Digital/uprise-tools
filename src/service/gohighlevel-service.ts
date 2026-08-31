export interface GhlContact {
  id: string;
  name: string;
  email: string;
  companyName?: string;
  phone?: string;
}

export interface GhlOpportunity {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  pipelineId: string;
  stageId: string;
  companyName?: string;
}

const GHL_API_BASE = "https://services.leadconnectorhq.com";

function getGhlHeaders(customApiKey?: string) {
  const apiKey = customApiKey;
  if (!apiKey) {
    throw new Error(
      "GoHighLevel API Key is not configured. Please configure GoHighLevel in Settings -> Onboarding.",
    );
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-04-15",
    "Content-Type": "application/json",
  };
}

/**
 * Resolves GoHighLevel credentials for a tenant organization or explicit parameter.
 */
export async function getGhlCredentials(
  organizationId?: string,
  customApiKey?: string,
  customLocationId?: string,
) {
  if (customApiKey) {
    return { apiKey: customApiKey, locationId: customLocationId };
  }

  if (organizationId) {
    const { db } = await import("@/db");
    const { eq } = await import("drizzle-orm");
    const { organizationOnboardingSettings } = await import("@/db/schema");
    const { decryptToken } = await import("@/lib/crypto");

    const settings = await db.query.organizationOnboardingSettings.findFirst({
      where: eq(organizationOnboardingSettings.organizationId, organizationId),
    });

    if (settings?.ghlApiKey) {
      try {
        const apiKey = decryptToken(settings.ghlApiKey);
        return {
          apiKey,
          locationId: settings.ghlLocationId || customLocationId || undefined,
          companyId: settings.ghlCompanyId || undefined,
        };
      } catch (err) {
        console.error("Failed to decrypt GHL API key:", err);
      }
    }
  }

  throw new Error(
    "GoHighLevel is not configured for this organization. Please add your GHL API key in Settings -> Onboarding.",
  );
}

/**
 * Verifies GoHighLevel API credentials against the LeadConnector API.
 */
export async function verifyGhlConnection(
  apiKey: string,
  locationId?: string,
  companyId?: string,
): Promise<boolean> {
  if (!apiKey) {
    throw new Error("API Key is required to verify GoHighLevel connection.");
  }
  const headers = getGhlHeaders(apiKey);
  const testUrl = locationId
    ? `${GHL_API_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=1`
    : `${GHL_API_BASE}/users/?limit=1`;
  const res = await fetch(testUrl, { headers });
  if (!res.ok) {
    const errText = await res.text().catch(() => "");
    throw new Error(
      `GoHighLevel verification failed (Status ${res.status}): ${res.statusText || errText}`,
    );
  }
  return true;
}

/**
 * Searches contacts in GoHighLevel by name, email, or company.
 */
export async function searchGhlContacts(
  query: string,
  organizationIdOrApiKey?: string,
  locationIdOverride?: string,
): Promise<GhlContact[]> {
  const { apiKey, locationId } = await getGhlCredentials(
    organizationIdOrApiKey,
    organizationIdOrApiKey?.includes("-") ||
      organizationIdOrApiKey?.length === 36
      ? undefined
      : organizationIdOrApiKey,
    locationIdOverride,
  );

  try {
    const url = locationId
      ? `${GHL_API_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(query)}`
      : `${GHL_API_BASE}/contacts/?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: getGhlHeaders(apiKey),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `GHL Contacts Search failed with status ${res.status}: ${res.statusText || errorText}`,
      );
    }
    const data = await res.json();
    return (data.contacts || []).map((c: any) => ({
      id: c.id,
      name: `${c.firstName || ""} ${c.lastName || ""}`.trim(),
      email: c.email,
      companyName: c.companyName,
      phone: c.phone,
    }));
  } catch (error) {
    console.error("Error searching GHL contacts:", error);
    throw error;
  }
}

/**
 * Updates the stage of an opportunity in GoHighLevel (e.g. moves it to "Active Client").
 */
export async function updateGhlOpportunityStage(
  opportunityId: string,
  stageId: string,
  customApiKey?: string,
): Promise<boolean> {
  try {
    const headers = getGhlHeaders(customApiKey);
    // In GHL v2 we first need to fetch the opportunity to obtain its pipelineId
    const getRes = await fetch(
      `${GHL_API_BASE}/opportunities/${opportunityId}`,
      { headers },
    );
    if (!getRes.ok) {
      const errorText = await getRes.text().catch(() => "");
      throw new Error(
        `Failed to fetch GHL opportunity details: ${getRes.statusText || errorText}`,
      );
    }
    const data = await getRes.json();
    const opportunity = data.opportunity;
    if (!opportunity)
      throw new Error("No opportunity record returned from GHL.");

    const res = await fetch(`${GHL_API_BASE}/opportunities/${opportunityId}`, {
      method: "PUT",
      headers,
      body: JSON.stringify({
        pipelineId: opportunity.pipelineId,
        stageId: stageId,
        status: "open",
      }),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `GHL Opportunity update failed: ${res.statusText || errorText}`,
      );
    }
    return true;
  } catch (error) {
    console.error(
      `Error updating GHL opportunity ${opportunityId} to stage ${stageId}:`,
      error,
    );
    return false;
  }
}

export interface GhlPipeline {
  id: string;
  name: string;
  stages: {
    id: string;
    name: string;
  }[];
}

export interface GhlOpportunityDetails {
  id: string;
  name: string;
  contactId: string;
  contactName: string;
  contactEmail: string;
  contactPhone?: string;
  pipelineId: string;
  stageId: string;
  status: string;
  monetaryValue?: number;
  assignedTo?: string;
  createdAt: string;
  updatedAt: string;
}

export interface GhlUser {
  id: string;
  name: string;
  email: string;
}

export interface GhlNote {
  id: string;
  body: string;
  createdAt: string;
  userId?: string;
}

/**
 * Fetches all pipelines for a location in GoHighLevel.
 */
export async function getGhlPipelines(
  locationId: string,
  apiKey?: string,
): Promise<GhlPipeline[]> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
      { headers: getGhlHeaders(apiKey) },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch pipelines: ${res.statusText}`);
    }
    const data = await res.json();
    return (data.pipelines || []).map((p: any) => ({
      id: p.id,
      name: p.name,
      stages: (p.stages || []).map((s: any) => ({
        id: s.id,
        name: s.name,
      })),
    }));
  } catch (error) {
    console.error("Error fetching GHL pipelines:", error);
    throw error;
  }
}

/**
 * Fetches/searches opportunities in a pipeline for a location.
 */
export async function getGhlOpportunities(
  locationId: string,
  pipelineId: string,
): Promise<GhlOpportunityDetails[]> {
  try {
    const res = await fetch(`${GHL_API_BASE}/opportunities/search`, {
      method: "POST",
      headers: getGhlHeaders(),
      body: JSON.stringify({
        locationId,
        limit: 100,
      }),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Failed to fetch GHL opportunities (status ${res.status}): ${res.statusText || errText}`,
      );
    }
    const data = await res.json();
    const opportunities = data.opportunities || [];
    return opportunities
      .filter((o: any) => o.pipelineId === pipelineId)
      .map((o: any) => ({
        id: o.id,
        name: o.name,
        contactId: o.contactId,
        contactName: o.contact?.name || o.contactName || "Unknown",
        contactEmail: o.contact?.email || o.contactEmail || "",
        contactPhone: o.contact?.phone || o.contactPhone,
        pipelineId: o.pipelineId,
        stageId: o.pipelineStageId || o.stageId,
        status: o.status,
        monetaryValue: o.monetaryValue,
        assignedTo: o.assignedTo,
        createdAt: o.createdAt,
        updatedAt:
          o.updatedAt ||
          o.lastStatusChangeAt ||
          o.lastStageChangeAt ||
          o.createdAt,
      }));
  } catch (error) {
    console.error("Error fetching GHL opportunities:", error);
    throw error;
  }
}

/**
 * Fetches users (team members) for a location in GoHighLevel.
 */
export async function getGhlUsers(locationId: string): Promise<GhlUser[]> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/users/?locationId=${encodeURIComponent(locationId)}`,
      { headers: getGhlHeaders() },
    );
    if (!res.ok) {
      console.warn(
        `Failed to fetch GHL users (status ${res.status}), using empty list fallback.`,
      );
      return [];
    }
    const data = await res.json();
    return (data.users || []).map((u: any) => ({
      id: u.id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      email: u.email,
    }));
  } catch (error) {
    console.warn("Error fetching GHL users, using empty list fallback:", error);
    return [];
  }
}

/**
 * Fetches notes for a specific contact in GoHighLevel.
 */
export async function getContactNotes(contactId: string): Promise<GhlNote[]> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}/notes`,
      { headers: getGhlHeaders() },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch contact notes: ${res.statusText}`);
    }
    const data = await res.json();
    return (data.notes || []).map((n: any) => ({
      id: n.id,
      body: n.body,
      createdAt: n.dateAdded || n.createdAt,
      userId: n.userId,
    }));
  } catch (error) {
    console.error(`Error fetching GHL notes for contact ${contactId}:`, error);
    throw error;
  }
}

/**
 * Creates a new note for a specific contact in GoHighLevel.
 */
export async function createContactNote(
  contactId: string,
  body: string,
  apiKey?: string,
): Promise<boolean> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}/notes`,
      {
        method: "POST",
        headers: getGhlHeaders(apiKey),
        body: JSON.stringify({ body }),
      },
    );
    if (!res.ok) {
      throw new Error(`Failed to create contact note: ${res.statusText}`);
    }
    return true;
  } catch (error) {
    console.error(`Error creating GHL note for contact ${contactId}:`, error);
    throw error;
  }
}

export interface GhlContactFullDetails {
  id: string;
  name: string;
  email: string;
  phone?: string;
  tags: string[];
  source?: string;
  campaign?: string;
  formName?: string;
  customFields?: { id: string; value: any }[];
}

/**
 * Fetches full details for a specific contact in GoHighLevel including tags, source, and attribution.
 */
export async function getGhlContactDetails(
  contactId: string,
): Promise<GhlContactFullDetails | null> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}`,
      { headers: getGhlHeaders() },
    );
    if (!res.ok) {
      return null;
    }
    const data = await res.json();
    const c = data.contact;
    if (!c) return null;

    const campaign =
      c.attributionSource?.campaign ||
      c.attributionSource?.utmCampaign ||
      c.lastAttributionSource?.campaign ||
      undefined;

    const formName =
      c.attributionSource?.formName ||
      c.lastAttributionSource?.formName ||
      undefined;

    return {
      id: c.id,
      name:
        `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
        c.name ||
        "Unknown",
      email: c.email || "",
      phone: c.phone,
      tags: Array.isArray(c.tags) ? c.tags : [],
      source:
        c.source || c.attributionSource?.source || c.attributionSource?.medium,
      campaign,
      formName,
      customFields: Array.isArray(c.customFields) ? c.customFields : [],
    };
  } catch (error) {
    console.error(
      `Error fetching GHL contact details for ${contactId}:`,
      error,
    );
    return null;
  }
}

export interface GhlSnapshot {
  id: string;
  name: string;
  type?: string;
}

export async function getGhlSnapshots(
  customApiKey?: string,
  customLocationId?: string,
  customCompanyId?: string,
): Promise<GhlSnapshot[]> {
  const apiKey = customApiKey || process.env.GHL_API_KEY;
  const locationId = customLocationId || process.env.GHL_LOCATION_ID;
  if (!apiKey) {
    return [];
  }

  const results: GhlSnapshot[] = [];
  const headers = {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-04-15",
    "Content-Type": "application/json",
  };

  // Helper to append snapshots safely without duplicates
  const addSnapshots = (items: any[], defaultType: string) => {
    for (const s of items) {
      const id = s.id || s.snapshotId || s.templateId;
      if (id && !results.some((r) => r.id === id)) {
        results.push({
          id,
          name: s.name || s.title || "GHL Snapshot Template",
          type: s.type || defaultType,
        });
      }
    }
  };

  // 1. Try company snapshots with companyId (Works with Agency API Keys)
  let companyId = customCompanyId || process.env.GHL_COMPANY_ID || "";
  if (locationId) {
    try {
      const locRes = await fetch(
        `${GHL_API_BASE}/locations/${encodeURIComponent(locationId)}`,
        { headers },
      );
      if (locRes.ok) {
        const locData = await locRes.json();
        const foundCompId = locData.location?.companyId || locData.companyId;
        if (foundCompId) companyId = foundCompId;
      }
    } catch (e) {
      console.warn("Error fetching location companyId:", e);
    }
  }

  if (companyId) {
    try {
      const res = await fetch(
        `${GHL_API_BASE}/snapshots/?companyId=${encodeURIComponent(companyId)}`,
        { headers },
      );
      if (res.ok) {
        const data = await res.json();
        addSnapshots(data.snapshots || data.templates || [], "agency");
      }
    } catch (err) {
      console.warn("Company snapshots fetch error:", err);
    }
  }

  // 2. Try location templates endpoint (Works with Location API Keys)
  if (locationId) {
    try {
      const res = await fetch(
        `${GHL_API_BASE}/locations/${encodeURIComponent(locationId)}/templates`,
        { headers: getGhlHeaders() },
      );
      if (res.ok) {
        const data = await res.json();
        addSnapshots(data.templates || [], "location");
      }
    } catch (err) {
      console.warn("Location templates fetch error:", err);
    }
  }

  // 3. Fallback: Try raw agency snapshots endpoint
  try {
    const res = await fetch(`${GHL_API_BASE}/snapshots/`, {
      headers: getGhlHeaders(),
    });
    if (res.ok) {
      const data = await res.json();
      addSnapshots(data.snapshots || data.templates || [], "agency");
    }
  } catch (err) {
    console.warn("Agency snapshots fetch error:", err);
  }

  return results;
}

/**
 * Creates a new Sub-Account (Location) in GoHighLevel using Agency API key/token.
 */
export async function createGhlSubAccount(data: {
  name: string;
  phone?: string;
  address?: string;
  city?: string;
  state?: string;
  country?: string;
  postalCode?: string;
  website?: string;
  timezone?: string;
  snapshotId?: string;
  apiKey?: string;
  companyId?: string;
}): Promise<{ id: string; name: string }> {
  try {
    const companyId = data.companyId || process.env.GHL_COMPANY_ID || "";
    const bodyPayload: any = {
      companyId,
      name: data.name,
      phone: data.phone || "",
      address: data.address || "",
      city: data.city || "",
      state: data.state || "",
      country: data.country || "AU",
      postalCode: data.postalCode || "",
      website: data.website || "",
      timezone: data.timezone || "Australia/Sydney",
    };
    if (data.snapshotId) {
      bodyPayload.snapshotId = data.snapshotId;
    }
    const res = await fetch(`${GHL_API_BASE}/locations/`, {
      method: "POST",
      headers: getGhlHeaders(data.apiKey),
      body: JSON.stringify(bodyPayload),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `GHL Sub-Account creation failed (${res.status}): ${res.statusText || errorText}`,
      );
    }
    const resData = await res.json();
    const loc = resData.location || resData;
    return {
      id: loc.id || loc.locationId,
      name: loc.name || data.name,
    };
  } catch (error) {
    console.error("Error creating GHL sub-account:", error);
    throw error;
  }
}

/**
 * Creates a new contact in GoHighLevel CRM.
 */
export async function createGhlContact(data: {
  locationId?: string;
  name: string;
  email: string;
  phone?: string;
  tags?: string[];
  apiKey?: string;
}): Promise<GhlContact> {
  try {
    const locationId = data.locationId || process.env.GHL_LOCATION_ID;
    const bodyPayload: any = {
      name: data.name,
      email: data.email,
      phone: data.phone,
      tags: data.tags || [],
    };
    if (locationId) {
      bodyPayload.locationId = locationId;
    }
    const res = await fetch(`${GHL_API_BASE}/contacts/`, {
      method: "POST",
      headers: getGhlHeaders(data.apiKey),
      body: JSON.stringify(bodyPayload),
    });
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `GHL Contact creation failed (${res.status}): ${res.statusText || errorText}`,
      );
    }
    const resData = await res.json();
    const c = resData.contact || resData;
    return {
      id: c.id,
      name:
        `${c.firstName || ""} ${c.lastName || ""}`.trim() ||
        c.name ||
        data.name,
      email: c.email || data.email,
      phone: c.phone || data.phone,
    };
  } catch (error) {
    console.error("Error creating GHL contact:", error);
    throw error;
  }
}

/**
 * Adds tag(s) to an existing contact in GoHighLevel.
 */
export async function addGhlContactTag(
  contactId: string,
  tags: string | string[],
  apiKey?: string,
): Promise<boolean> {
  try {
    const tagArray = Array.isArray(tags) ? tags : [tags];
    const res = await fetch(
      `${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}/tags`,
      {
        method: "POST",
        headers: getGhlHeaders(apiKey),
        body: JSON.stringify({ tags: tagArray }),
      },
    );
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Failed to add tag to GHL contact (${res.status}): ${res.statusText || errorText}`,
      );
    }
    return true;
  } catch (error) {
    console.error(`Error adding tag to GHL contact ${contactId}:`, error);
    throw error;
  }
}

/**
 * Creates a task for a contact in GoHighLevel CRM.
 */
export async function createGhlTask(
  contactId: string,
  task: {
    title: string;
    body?: string;
    dueDate?: string;
    assignedTo?: string;
  },
  apiKey?: string,
): Promise<boolean> {
  try {
    const defaultDueDate = new Date(
      Date.now() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    const res = await fetch(
      `${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}/tasks`,
      {
        method: "POST",
        headers: getGhlHeaders(apiKey),
        body: JSON.stringify({
          title: task.title,
          body: task.body || "",
          dueDate: task.dueDate || defaultDueDate,
          completed: false,
          assignedTo: task.assignedTo || undefined,
        }),
      },
    );
    if (!res.ok) {
      const errorText = await res.text().catch(() => "");
      throw new Error(
        `Failed to create GHL task (${res.status}): ${res.statusText || errorText}`,
      );
    }
    return true;
  } catch (error) {
    console.error(`Error creating GHL task for contact ${contactId}:`, error);
    throw error;
  }
}

/**
 * Fetches all contacts from GoHighLevel location.
 */
export async function fetchAllGhlContacts(
  locationId: string,
  apiKey: string,
  limit = 100,
): Promise<any[]> {
  try {
    const url = `${GHL_API_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: getGhlHeaders(apiKey),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Failed to fetch GHL contacts (${res.status}): ${res.statusText || errText}`,
      );
    }
    const data = await res.json();
    return data.contacts || [];
  } catch (error) {
    console.error("Error fetching all GHL contacts:", error);
    throw error;
  }
}

/**
 * Fetches all pipeline opportunities from GoHighLevel location.
 */
export async function fetchAllGhlOpportunities(
  locationId: string,
  apiKey: string,
  limit = 100,
): Promise<any[]> {
  try {
    const url = `${GHL_API_BASE}/opportunities/search?location_id=${encodeURIComponent(locationId)}&limit=${limit}`;
    const res = await fetch(url, {
      headers: getGhlHeaders(apiKey),
    });
    if (!res.ok) {
      const errText = await res.text().catch(() => "");
      throw new Error(
        `Failed to fetch GHL opportunities (${res.status}): ${res.statusText || errText}`,
      );
    }
    const data = await res.json();
    return data.opportunities || [];
  } catch (error) {
    console.error("Error fetching all GHL opportunities:", error);
    return [];
  }
}

/**
 * Syncs all GoHighLevel contacts and opportunities into the clientOnboardings table.
 */
export async function syncAllGhlClients(organizationId: string): Promise<{
  totalFound: number;
  totalImported: number;
  totalUpdated: number;
}> {
  const { apiKey, locationId } = await getGhlCredentials(organizationId);
  if (!locationId) throw new Error("GoHighLevel Location ID is required.");

  const { db } = await import("@/db");
  const { clientOnboardings } = await import("@/db/schema");
  const { eq } = await import("drizzle-orm");

  console.log(`[GHL Sync] Fetching data for location: ${locationId}...`);
  // 1. Fetch contacts & opportunities from GHL
  const [contacts, opportunities, pipelines] = await Promise.all([
    fetchAllGhlContacts(locationId, apiKey, 100).catch((err) => {
      console.error("[GHL Sync] Contacts fetch error:", err);
      return [];
    }),
    fetchAllGhlOpportunities(locationId, apiKey, 100).catch((err) => {
      console.error("[GHL Sync] Opportunities fetch error:", err);
      return [];
    }),
    getGhlPipelines(locationId, apiKey).catch((err) => {
      console.error("[GHL Sync] Pipelines fetch error:", err);
      return [];
    }),
  ]);

  console.log(
    `[GHL Sync] Fetched ${contacts.length} contacts, ${opportunities.length} opportunities, ${pipelines.length} pipelines.`,
  );

  // Build a stage ID to name map
  const stageMap = new Map<string, string>();
  for (const p of pipelines) {
    for (const s of p.stages || []) {
      stageMap.set(s.id, s.name);
    }
  }

  // Build an opportunity map by contactId
  const oppMap = new Map<string, any>();
  for (const opp of opportunities) {
    if (opp.contactId) {
      const stageName =
        stageMap.get(opp.pipelineStageId) ||
        stageMap.get(opp.pipelineStageUId) ||
        opp.pipelineStageId ||
        "Active Opportunity";
      oppMap.set(opp.contactId, { ...opp, stageName });
    }
  }

  // 2. Fetch existing client onboarding records from DB
  const existingClients = await db
    .select()
    .from(clientOnboardings)
    .where(eq(clientOnboardings.organizationId, organizationId));

  const clientByGhlId = new Map<string, (typeof existingClients)[0]>();
  const clientByEmail = new Map<string, (typeof existingClients)[0]>();

  for (const c of existingClients) {
    if (c.ghlContactId) clientByGhlId.set(c.ghlContactId, c);
    if (c.contactEmail) clientByEmail.set(c.contactEmail.toLowerCase(), c);
  }

  let totalImported = 0;
  let totalUpdated = 0;

  console.log(
    `[GHL Sync] Processing ${contacts.length} contacts against ${existingClients.length} existing records in DB...`,
  );

  // 3. Ingest / Upsert contacts from GHL in parallel chunks
  const chunkSize = 15;
  for (let i = 0; i < contacts.length; i += chunkSize) {
    const chunk = contacts.slice(i, i + chunkSize);
    await Promise.all(
      chunk.map(async (contact) => {
        const ghlId = contact.id;
        const email = (contact.email || `${ghlId}@ghl.local`).toLowerCase();
        const phone = contact.phone || null;
        const rawName =
          `${contact.firstName || ""} ${contact.lastName || ""}`.trim() ||
          contact.contactName ||
          contact.name ||
          "Valued Client";
        const company = contact.companyName || rawName;
        const opp = oppMap.get(ghlId);
        const stage =
          opp?.stageName ||
          (contact.type === "customer" ? "Active Client" : "GHL Contact");

        const existing = clientByGhlId.get(ghlId) || clientByEmail.get(email);

        let lifecycleStatus = "lead";
        const lowerStage = (stage || "").toLowerCase();
        if (
          contact.type === "customer" ||
          lowerStage.includes("won") ||
          lowerStage.includes("active client")
        ) {
          lifecycleStatus = "completed";
        } else if (
          lowerStage.includes("spam") ||
          lowerStage.includes("not a fit") ||
          lowerStage.includes("disqualified") ||
          lowerStage.includes("lost")
        ) {
          lifecycleStatus = "disqualified";
        } else if (
          lowerStage.includes("meeting") ||
          lowerStage.includes("follow up") ||
          lowerStage.includes("awaiting")
        ) {
          lifecycleStatus = "opportunity";
        }

        if (existing) {
          await db
            .update(clientOnboardings)
            .set({
              ghlContactId: ghlId,
              contactPhone: existing.contactPhone || phone,
              ghlPipelineStage: stage,
              ghlOpportunityId: existing.ghlOpportunityId || opp?.id || null,
              ghlStatus: "synced",
              status:
                existing.status === "draft" ||
                existing.status === "in_progress" ||
                existing.status === "email_sent"
                  ? existing.status
                  : lifecycleStatus,
              updatedAt: new Date(),
            })
            .where(eq(clientOnboardings.id, existing.id));
          totalUpdated++;
        } else {
          await db.insert(clientOnboardings).values({
            organizationId,
            clientName: company,
            primaryContactName: rawName,
            contactEmail: email,
            contactPhone: phone,
            ghlContactId: ghlId,
            ghlOpportunityId: opp?.id || null,
            ghlPipelineStage: stage,
            status: lifecycleStatus,
            ghlStatus: "synced",
            googleAdsAccess: true,
            metaAdsAccess: true,
          });
          totalImported++;
        }
      }),
    );
  }

  return {
    totalFound: contacts.length,
    totalImported,
    totalUpdated,
  };
}
