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

function getGhlHeaders() {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("GoHighLevel API Key (GHL_API_KEY) is not configured.");
  }
  return {
    Authorization: `Bearer ${apiKey}`,
    Version: "2021-04-15",
    "Content-Type": "application/json",
  };
}

/**
 * Searches contacts in GoHighLevel by name, email, or company.
 */
export async function searchGhlContacts(query: string): Promise<GhlContact[]> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("GoHighLevel API Key (GHL_API_KEY) is not configured.");
  }

  try {
    const locationId = process.env.GHL_LOCATION_ID;
    const url = locationId
      ? `${GHL_API_BASE}/contacts/?locationId=${encodeURIComponent(locationId)}&query=${encodeURIComponent(query)}`
      : `${GHL_API_BASE}/contacts/?query=${encodeURIComponent(query)}`;
    const res = await fetch(url, {
      headers: getGhlHeaders(),
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
): Promise<boolean> {
  const apiKey = process.env.GHL_API_KEY;
  if (!apiKey) {
    throw new Error("GoHighLevel API Key (GHL_API_KEY) is not configured.");
  }

  try {
    // In GHL v2 we first need to fetch the opportunity to obtain its pipelineId
    const getRes = await fetch(
      `${GHL_API_BASE}/opportunities/${opportunityId}`,
      {
        headers: getGhlHeaders(),
      },
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
      headers: getGhlHeaders(),
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
): Promise<GhlPipeline[]> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/opportunities/pipelines?locationId=${encodeURIComponent(locationId)}`,
      { headers: getGhlHeaders() },
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
    const res = await fetch(
      `${GHL_API_BASE}/opportunities/search?locationId=${encodeURIComponent(locationId)}&pipelineId=${encodeURIComponent(pipelineId)}&limit=100`,
      { headers: getGhlHeaders() },
    );
    if (!res.ok) {
      throw new Error(`Failed to fetch GHL opportunities: ${res.statusText}`);
    }
    const data = await res.json();
    return (data.opportunities || []).map((o: any) => ({
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
      throw new Error(`Failed to fetch GHL users: ${res.statusText}`);
    }
    const data = await res.json();
    return (data.users || []).map((u: any) => ({
      id: u.id,
      name: `${u.firstName || ""} ${u.lastName || ""}`.trim(),
      email: u.email,
    }));
  } catch (error) {
    console.error("Error fetching GHL users:", error);
    throw error;
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
): Promise<boolean> {
  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/${encodeURIComponent(contactId)}/notes`,
      {
        method: "POST",
        headers: getGhlHeaders(),
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
