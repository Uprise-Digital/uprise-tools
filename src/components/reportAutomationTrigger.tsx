"use client";

import { useState, useEffect } from "react";
import { generateClientReportAction } from "@/actions/pdf.actions";
import { AutomationSidebar } from "@/components/automation-sidebar";
import { toast } from "sonner";

interface AdAccount {
    id: number;
    googleAccountId: string;
    name: string;
}

export function ReportAutomationTrigger({
                                            adAccount,
                                            initialRules = [] // Pass these from the server component (AdAccountsPage)
                                        }: {
    adAccount: AdAccount,
    initialRules?: any[]
}) {
    const [isDownloading, setIsDownloading] = useState(false);
    const [rules, setRules] = useState<any[]>(initialRules);

    /**
     * Handled here so the logic is shared between the "Quick Export"
     * in the sidebar and any other future entry points.
     */
    const handleQuickDownload = async () => {
        setIsDownloading(true);

        // Let the user know Gemini is working
        const toastId = toast.loading(`Generating AI insights for ${adAccount.name}...`);

        try {
            const result = await generateClientReportAction(
                adAccount.googleAccountId,
                adAccount.name
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
            toast.error(error.message || "Failed to generate report", { id: toastId });
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