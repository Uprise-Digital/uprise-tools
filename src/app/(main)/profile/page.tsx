"use client";

import { useState, useEffect } from "react";
import { authClient } from "@/lib/auth-client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export default function ProfilePage() {
    const { data: session, isPending } = authClient.useSession();

    // Start with empty strings, we will fill them in the useEffect
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [currentPassword, setCurrentPassword] = useState("");
    const [newPassword, setNewPassword] = useState("");

    // This syncs the session data into our form inputs the moment it loads
    useEffect(() => {
        if (session?.user) {
            setName(session.user.name);
            setEmail(session.user.email);
        }
    }, [session]);

    const handleUpdateProfile = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await authClient.updateUser({ name });
        if (error) alert(error.message);
        else alert("Profile updated!"); // Swap with shadcn toast later
    };

    const handleChangePassword = async (e: React.FormEvent) => {
        e.preventDefault();
        const { error } = await authClient.changePassword({
            newPassword,
            currentPassword,
            revokeOtherSessions: true,
        });
        if (error) alert(error.message);
        else {
            alert("Password changed!");
            setCurrentPassword("");
            setNewPassword("");
        }
    };

    // Show a quick loading state so the form doesn't flicker empty
    if (isPending) {
        return <div className="text-muted-foreground animate-pulse">Loading profile data...</div>;
    }

    return (
        <div className="space-y-6 max-w-2xl">
            <div>
                <h1 className="text-3xl font-bold tracking-tight">Profile Settings</h1>
                <p className="text-muted-foreground">Manage your account details and password.</p>
            </div>

            <Card>
                <CardHeader>
                    <CardTitle>Personal Information</CardTitle>
                    <CardDescription>Update your display name.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleUpdateProfile} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="email">Email Address</Label>
                            {/* Disabled because changing emails securely requires a verification flow */}
                            <Input id="email" value={email} disabled className="bg-slate-50 text-slate-500" />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="name">Full Name</Label>
                            <Input id="name" value={name} onChange={(e) => setName(e.target.value)} required />
                        </div>
                        <Button type="submit">Save Changes</Button>
                    </form>
                </CardContent>
            </Card>

            <Card>
                <CardHeader>
                    <CardTitle>Change Password</CardTitle>
                    <CardDescription>Ensure your account is using a long, random password to stay secure.</CardDescription>
                </CardHeader>
                <CardContent>
                    <form onSubmit={handleChangePassword} className="space-y-4">
                        <div className="space-y-2">
                            <Label htmlFor="current">Current Password</Label>
                            <Input id="current" type="password" value={currentPassword} onChange={(e) => setCurrentPassword(e.target.value)} required />
                        </div>
                        <div className="space-y-2">
                            <Label htmlFor="new">New Password</Label>
                            <Input id="new" type="password" value={newPassword} onChange={(e) => setNewPassword(e.target.value)} required />
                        </div>
                        <Button type="submit" variant="secondary">Update Password</Button>
                    </form>
                </CardContent>
            </Card>
        </div>
    );
}