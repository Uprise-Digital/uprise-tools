"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { RefreshCcw } from "lucide-react";
import { toast } from "sonner"; // Or your preferred toast lib

export function SyncButton({ action }: { action: () => Promise<any> }) {
    const [isLoading, setIsLoading] = useState(false);

    const handleSync = async () => {
        setIsLoading(true);
        const result = await action();
        if (result.success) {
            toast.success(`Successfully synced ${result.count} accounts`);
        } else {
            toast.error("Sync failed");
        }
        setIsLoading(false);
    };

    return (
        <Button onClick={handleSync} disabled={isLoading}>
            <RefreshCcw className={`mr-2 h-4 w-4 ${isLoading ? "animate-spin" : ""}`} />
            Sync MCC Accounts
        </Button>
    );
}