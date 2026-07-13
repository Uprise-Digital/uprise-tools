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
  if (!apiKey || apiKey === "mock") {
    // Return mock data for testing/fallback
    const mockContacts: GhlContact[] = [
      {
        id: "ct_kgn_homes_1",
        name: "Sultan",
        email: "sultan@kgnhomes.com.au",
        companyName: "KGN Homes",
        phone: "+61 426 759 756",
      },
      {
        id: "ct_acme_corp_2",
        name: "John Doe",
        email: "john@acme.com",
        companyName: "Acme Corp",
        phone: "+61 411 111 111",
      },
      {
        id: "ct_uprise_test_3",
        name: "Sarah Tester",
        email: "sarah@tester.com",
        companyName: "Tester & Co",
        phone: "+61 422 222 222",
      },
      {
        id: "ct_globex_4",
        name: "Hank Scorpio",
        email: "hank@globex.com",
        companyName: "Globex Industries",
        phone: "+61 433 333 333",
      },
    ];
    return mockContacts.filter(
      (c) =>
        c.name.toLowerCase().includes(query.toLowerCase()) ||
        c.companyName?.toLowerCase().includes(query.toLowerCase()) ||
        c.email.toLowerCase().includes(query.toLowerCase()),
    );
  }

  try {
    const res = await fetch(
      `${GHL_API_BASE}/contacts/?query=${encodeURIComponent(query)}`,
      {
        headers: getGhlHeaders(),
      },
    );
    if (!res.ok) {
      throw new Error(
        `GHL Contacts Search failed with status ${res.status}: ${res.statusText}`,
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
  if (!apiKey || apiKey === "mock") {
    console.log(
      `[MOCK GHL] Updated Opportunity ${opportunityId} to Stage ${stageId}`,
    );
    return true;
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
      throw new Error(
        `Failed to fetch GHL opportunity details: ${getRes.statusText}`,
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
      throw new Error(`GHL Opportunity update failed: ${res.statusText}`);
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
