"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { generateReportAction } from "@/actions/pdf.actions";
import { FileDown, Loader2 } from "lucide-react";

export default function TestPdfPage() {
    const [loading, setLoading] = useState(false);

    const handleDownload = async () => {
        setLoading(true);
        const result = await generateReportAction();

        if (result.success && result.pdfBase64) {
            const linkSource = `data:application/pdf;base64,${result.pdfBase64}`;
            const downloadLink = document.createElement("a");
            downloadLink.href = linkSource;
            downloadLink.download = result.fileName || "report.pdf";
            downloadLink.click();
        } else {
            alert("Error generating PDF");
        }
        setLoading(false);
    };

    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">PDF Automation Test</h1>
                <p className="text-muted-foreground">Verify the Google Ads report generation flow.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Generate Sample Report</CardTitle>
                    <CardDescription>
                        This will trigger the server-side PDF engine and download a mockup of the Providence Auto report.
                    </CardDescription>
                </CardHeader>
                <CardContent className="flex flex-col items-center justify-center py-12 border-2 border-dashed rounded-lg">
                    <Button
                        size="lg"
                        onClick={handleDownload}
                        disabled={loading}
                        className="w-full max-w-xs"
                    >
                        {loading ? (
                            <>
                                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                                Generating PDF...
                            </>
                        ) : (
                            <>
                                <FileDown className="mr-2 h-4 w-4" />
                                Download Test PDF
                            </>
                        )}
                    </Button>
                </CardContent>
            </Card>
        </div>
    );
}