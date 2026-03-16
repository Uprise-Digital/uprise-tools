"use client";

import { useState } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateClientReportAction } from "@/actions/pdf.actions";
import { AutomationSidebar } from "@/components/automation-sidebar";
import { FileDown, Loader2, Settings2 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function TestPdfPage() {
    const [downloading, setDownloading] = useState(false);

    // Mocking an ad account for the UI test
    // In production, you'd fetch this from your DB or pass it via props
    const mockAccount = {
        id: 1,
        googleAccountId: "123-456-7890",
        name: "Providence Auto Group",
    };

    const handleQuickDownload = async () => {
        setDownloading(true);
        try {
            const result = await generateClientReportAction(
                mockAccount.googleAccountId,
                mockAccount.name
            );

            if (result.success && result.pdfBase64) {
                const linkSource = `data:application/pdf;base64,${result.pdfBase64}`;
                const downloadLink = document.createElement("a");
                downloadLink.href = linkSource;
                downloadLink.download = result.fileName || "report.pdf";
                downloadLink.click();
            }
        } catch (error) {
            console.error("Download failed", error);
        } finally {
            setDownloading(false);
        }
    };

    return (
        <div className="container max-w-4xl py-10 space-y-8">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight">Account Settings</h1>
                    <p className="text-muted-foreground">Manage reporting and automation for {mockAccount.name}.</p>
                </div>


            </div>

            <div className="grid gap-6 md:grid-cols-2">
                <Card>
                    <CardHeader>
                        <CardTitle>Report Preview</CardTitle>
                        <CardDescription>
                            Generate a one-off report to verify current data and AI insights.
                        </CardDescription>
                    </CardHeader>
                    <CardContent>
                        <Button
                            variant="secondary"
                            className="w-full"
                            onClick={handleQuickDownload}
                            disabled={downloading}
                        >
                            {downloading ? (
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                            ) : (
                                <FileDown className="mr-2 h-4 w-4" />
                            )}
                            Download Latest Report
                        </Button>
                    </CardContent>
                </Card>

                <Card>
                    <CardHeader>
                        <CardTitle>Automation Status</CardTitle>
                        <CardDescription>
                            Configure the schedule for automated email delivery.
                        </CardDescription>
                    </CardHeader>
                    <CardContent className="flex items-center justify-between py-4">
                        <div className="space-y-1">
                            <p className="text-sm font-medium">Monthly Reports</p>
                            <p className="text-xs text-muted-foreground">Next run: April 1st, 2026</p>
                        </div>
                        <Settings2 className="h-5 w-5 text-muted-foreground" />
                    </CardContent>
                </Card>
            </div>
        </div>
    );
}