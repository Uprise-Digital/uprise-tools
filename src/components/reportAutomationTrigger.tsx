"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { generateClientReportAction } from "@/actions/pdf.actions";
import { AutomationSidebar } from "@/components/automation-sidebar";

interface AdAccount {
  id: number;
  googleAccountId: string;
  name: string;
}

export function ReportAutomationTrigger({
  adAccount,
  initialRules = [], // Pass these from the server component (AdAccountsPage)
}: {
  adAccount: AdAccount;
  initialRules?: any[];
}) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [rules, setRules] = useState<any[]>(initialRules);

  /**
   * Handled here so the logic is shared between the "Quick Export"
   * in the sidebar and any other future entry points.
   */
  const handleQuickDownload = async (startDate?: string, endDate?: string) => {
    setIsDownloading(true);

    const toastMessage =
      startDate && endDate
        ? `Generating AI insights from ${startDate} to ${endDate}...`
        : `Generating AI insights for ${adAccount.name}...`;

    const toastId = toast.loading(toastMessage);

    try {
      const result = await generateClientReportAction(
        adAccount.googleAccountId,
        adAccount.name,
        startDate, // Pass to server action
        endDate, // Pass to server action
      );

      if (result.success && result.pdfBase64) {
        const linkSource = `data:application/pdf;base64,${result.pdfBase64}`;
        const downloadLink = document.createElement("a");
        downloadLink.href = linkSource;
        downloadLink.download = result.fileName || "report.pdf";
        downloadLink.click();

        toast.success("Report downloaded successfully", { id: toastId });
      } else {
        throw new Error(result.error);
      }
    } catch (error: any) {
      toast.error(error.message || "Failed to generate report", {
        id: toastId,
      });
    } finally {
      setIsDownloading(false);
    }
  };

  return (
    <AutomationSidebar
      adAccount={adAccount}
      rules={rules} // Passing the real (or initial) rules array
      onQuickDownload={handleQuickDownload}
      isDownloading={isDownloading}
    />
  );
}
