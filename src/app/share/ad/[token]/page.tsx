import type { Metadata } from "next";
import { getPublicShareDashboardDataAction } from "@/actions/share-dashboard.actions";
import { ShareFallbackView } from "@/components/share/share-fallback";
import { PublicClientDashboard } from "./shareClient";

interface PageProps {
  params: Promise<{ token: string }>;
  searchParams?: Promise<{ selected?: string; pin?: string }>;
}

export async function generateMetadata({
  params,
}: PageProps): Promise<Metadata> {
  const { token } = await params;
  return {
    title: `Client Performance Dashboard | Uprise Digital`,
    description:
      "Live real-time client performance report powered by Uprise Digital.",
  };
}

export default async function PublicAdAccountSharePage({
  params,
  searchParams,
}: PageProps) {
  const { token } = await params;
  const resolvedSearchParams = searchParams ? await searchParams : {};
  const selectedParam = resolvedSearchParams.selected?.toLowerCase();

  const result = await getPublicShareDashboardDataAction(token);

  if (!result.success) {
    if (result.requiresPin) {
      return (
        <PublicClientDashboard
          token={token}
          initialData={null}
          requiresPin={true}
          initialSelectedChannel={selectedParam}
        />
      );
    }
    return <ShareFallbackView reason={result.error} />;
  }

  return (
    <PublicClientDashboard
      token={token}
      initialData={result.data}
      requiresPin={false}
      initialSelectedChannel={selectedParam}
    />
  );
}
