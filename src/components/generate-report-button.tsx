"use client";

import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { generateClientReportAction } from "@/actions/pdf.actions";
import { Button } from "@/components/ui/button";

export function GenerateReportButton({
  googleAccountId,
  clientName,
}: {
  googleAccountId: string;
  clientName: string;
}) {
  const [loading, setLoading] = useState(false);

  const handleGenerate = async () => {
    setLoading(true);
    const result = await generateClientReportAction(
      googleAccountId,
      clientName,
    );

    if (result.success && result.pdfBase64) {
      const linkSource = `data:application/pdf;base64,${result.pdfBase64}`;
      const downloadLink = document.createElement("a");
      downloadLink.href = linkSource;
      downloadLink.download = result.fileName;
      downloadLink.click();
      toast.success("Report generated!");
    } else {
      toast.error("Failed to generate report");
    }
    setLoading(false);
  };

  return (
    <Button
      variant="outline"
      size="sm"
      onClick={handleGenerate}
      disabled={loading}
    >
      {loading ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : (
        <FileText className="h-4 w-4" />
      )}
    </Button>
  );
}
