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
