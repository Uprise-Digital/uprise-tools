"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";
import { User as UserIcon, KeyRound, Loader2 } from "lucide-react";

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
    const toastId = toast.loading("Updating profile information...");
    const { error } = await authClient.updateUser({ name });
    if (error) {
      toast.error(error.message || "Failed to update profile", { id: toastId });
    } else {
      toast.success("Profile display name updated successfully!", {
        id: toastId,
      });
    }
  };

  const handleChangePassword = async (e: React.FormEvent) => {
    e.preventDefault();
    const toastId = toast.loading("Updating account password...");
    const { error } = await authClient.changePassword({
      newPassword,
      currentPassword,
      revokeOtherSessions: true,
    });
    if (error) {
      toast.error(error.message || "Failed to update password", {
        id: toastId,
      });
    } else {
      toast.success(
        "Password changed successfully! Revoked other active sessions.",
        { id: toastId },
      );
      setCurrentPassword("");
      setNewPassword("");
    }
  };

  // Show a quick loading state so the form doesn't flicker empty
  if (isPending) {
    return (
      <div className="max-w-xl mx-auto py-8 flex flex-col items-center justify-center min-h-[300px] text-slate-400">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500 mb-2" />
        <span className="text-xs font-bold tracking-wide">Loading profile...</span>
      </div>
    );
  }

  return (
    <div className="max-w-xl mx-auto py-6 space-y-6 animate-in fade-in duration-200">
      <div>
        <h1 className="text-2xl font-extrabold text-slate-900 tracking-tight flex items-center gap-3">
          <UserIcon className="w-7 h-7 text-indigo-600" />
          Profile Settings
        </h1>
        <p className="text-sm text-slate-500 mt-1">
          Manage your account details and password.
        </p>
      </div>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
            <UserIcon className="w-4 h-4 text-indigo-500" />
            Personal Information
          </CardTitle>
          <CardDescription className="text-xs">
            Update your display name.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleUpdateProfile} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs font-bold text-slate-700">
                Email Address
              </Label>
              <Input
                id="email"
                value={email}
                disabled
                className="bg-slate-50 text-slate-500 text-xs h-9 cursor-not-allowed select-none border-slate-100"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="name" className="text-xs font-bold text-slate-700">
                Full Name
              </Label>
              <Input
                id="name"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
                className="text-xs text-slate-800 h-9"
              />
            </div>
            <Button
              type="submit"
              className="bg-indigo-600 hover:bg-indigo-500 font-bold text-xs h-9 px-4 shrink-0 mt-2"
            >
              Save Changes
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card className="border-slate-200 shadow-sm overflow-hidden">
        <CardHeader className="bg-slate-50/50 border-b border-slate-100 p-6">
          <CardTitle className="text-sm font-bold flex items-center gap-2 text-slate-800">
            <KeyRound className="w-4 h-4 text-indigo-500" />
            Change Password
          </CardTitle>
          <CardDescription className="text-xs">
            Ensure your account is using a long, random password to stay secure.
          </CardDescription>
        </CardHeader>
        <CardContent className="p-6">
          <form onSubmit={handleChangePassword} className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="current" className="text-xs font-bold text-slate-700">
                Current Password
              </Label>
              <Input
                id="current"
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                required
                className="text-xs text-slate-800 h-9"
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="new" className="text-xs font-bold text-slate-700">
                New Password
              </Label>
              <Input
                id="new"
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                required
                className="text-xs text-slate-800 h-9"
              />
            </div>
            <Button
              type="submit"
              className="bg-slate-900 hover:bg-slate-800 text-white font-bold text-xs h-9 px-4 shrink-0 mt-2"
            >
              Update Password
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
