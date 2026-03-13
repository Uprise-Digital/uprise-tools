"use client";

import { useState } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ForgotPasswordPage() {
    const [email, setEmail] = useState("");
    const [loading, setLoading] = useState(false);
    const [submitted, setSubmitted] = useState(false);

    const handleResetRequest = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        // This triggers the sendResetPassword callback in your auth.ts file
        const { error } = await authClient.requestPasswordReset({
            email,
            redirectTo: "/reset-password",
        });

        setLoading(false);

        if (error) {
            alert(error.message);
        } else {
            setSubmitted(true);
        }
    };

    // Show a success state so the user knows to check their inbox
    if (submitted) {
        return (
            <Card>
                <CardHeader className="space-y-1">
                    <CardTitle className="text-2xl font-bold">Check your email</CardTitle>
                    <CardDescription>If an account exists for that email, we've sent a password reset link.</CardDescription>
                </CardHeader>
            </Card>
        );
    }

    return (
        <Card>
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">Forgot Password</CardTitle>
                <CardDescription>Enter your email to receive a password reset link.</CardDescription>
            </CardHeader>
            <CardContent>
                <form onSubmit={handleResetRequest} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" required onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading}>
                        {loading ? "Sending..." : "Send Reset Link"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}