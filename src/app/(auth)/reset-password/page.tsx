"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ResetPasswordPage() {
    const router = useRouter();
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);

    const handleReset = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // Submits the new password. The token is grabbed from the URL automatically.
        const { error } = await authClient.resetPassword({
            newPassword: password,
        });

        setLoading(false);

        if (error) {
            alert(error.message);
        } else {
            router.push("/login"); // Send them back to login once successful
        }
    };

    return (
        <Card>
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">Reset Password</CardTitle>
                <CardDescription>Enter your new password below.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleReset} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="password">New Password</Label>
                        <Input id="password" type="password" required onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Resetting..." : "Reset Password"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}