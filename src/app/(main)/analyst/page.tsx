import type { Metadata } from "next";
import { listAccountsAction } from "@/actions/agency.actions";
import { listAnalystConversationsAction } from "@/actions/analyst.actions";
import AnalystClient from "./pageClient";

export const metadata: Metadata = {
  title: "AI PPC Analyst | Uprise Tools",
  description:
    "Conversational AI media strategist analyzing portfolio performance, ad accounts, anomalies, and auction health.",
};

export default async function AnalystPage() {
  const [conversationsRes, accountsRes] = await Promise.all([
    listAnalystConversationsAction(),
    listAccountsAction(),
  ]);

  const initialConversations =
    conversationsRes.success && conversationsRes.data
      ? conversationsRes.data
      : [];

  const accounts =
    accountsRes.success && accountsRes.data ? accountsRes.data : [];

  return (
    <AnalystClient
      initialConversations={initialConversations}
      accounts={accounts}
    />
  );
}
