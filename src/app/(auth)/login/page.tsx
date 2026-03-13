"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator"; // Assuming you have shadcn separator
import { Loader2 } from "lucide-react"; // For better loading states

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [googleLoading, setGoogleLoading] = useState(false);

    const handleSignIn = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        const { data, error } = await authClient.signIn.email({
            email,
            password,
        });

        setLoading(false);

        if (error) {
            alert(error.message);
        } else {
            router.push("/");
        }
    };

    const handleGoogleSignIn = async () => {
        setGoogleLoading(true);
        await authClient.signIn.social({
            provider: "google",
            callbackURL: "/", // Redirect here after successful login
        });
        // Note: Better Auth handles the redirect, so we don't strictly need to setGoogleLoading(false) here
    };

    return (
        <Card className="w-full max-w-md mx-auto">
            <CardHeader className="space-y-1">
                <CardTitle className="text-2xl font-bold">Login</CardTitle>
                <CardDescription>Enter your email and password to access the agency tools.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                {/* GOOGLE SIGN IN BUTTON */}
                <Button
                    variant="outline"
                    className="w-full"
                    onClick={handleGoogleSignIn}
                    disabled={googleLoading || loading}
                >
                    {googleLoading ? (
                        <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    ) : (
                        <svg className="mr-2 h-4 w-4" aria-hidden="true" focusable="false" data-prefix="fab" data-icon="google" role="img" xmlns="http://www.w3.org/2000/svg" viewBox="0 0 488 512"><path fill="currentColor" d="M488 261.8C488 403.3 391.1 504 248 504 110.8 504 0 393.2 0 256S110.8 8 248 8c66.8 0 123 24.5 166.3 64.9l-67.5 64.9C258.5 52.6 94.3 116.6 94.3 256c0 86.5 69.1 156.6 153.7 156.6 98.2 0 135-70.4 140.8-106.9H248v-85.3h236.1c2.3 12.7 3.9 24.9 3.9 41.4z"></path></svg>
                    )}
                    Continue with Google
                </Button>

                <div className="relative">
                    <div className="absolute inset-0 flex items-center">
                        <Separator />
                    </div>
                    <div className="relative flex justify-center text-xs uppercase">
                        <span className="bg-background px-2 text-muted-foreground">Or continue with email</span>
                    </div>
                </div>

                <form onSubmit={handleSignIn} className="space-y-4">
                    <div className="space-y-2">
                        <Label htmlFor="email">Email</Label>
                        <Input id="email" type="email" placeholder="m@example.com" required onChange={(e) => setEmail(e.target.value)} />
                    </div>
                    <div className="space-y-2">
                        <div className="flex items-center justify-between">
                            <Label htmlFor="password">Password</Label>
                            <Link href="/forgot-password" className="text-sm font-medium text-muted-foreground hover:text-primary">
                                Forgot password?
                            </Link>
                        </div>
                        <Input id="password" type="password" required onChange={(e) => setPassword(e.target.value)} />
                    </div>
                    <Button type="submit" className="w-full" disabled={loading || googleLoading}>
                        {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                        {loading ? "Signing in..." : "Sign In"}
                    </Button>
                </form>
            </CardContent>
        </Card>
    );
}