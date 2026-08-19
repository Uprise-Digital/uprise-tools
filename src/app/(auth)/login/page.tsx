"use client";

import { KeyRound, Loader2, Lock, Mail, ShieldCheck, Sparkles } from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const router = useRouter();
  const [googleLoading, setGoogleLoading] = useState(false);
  const [emailLoading, setEmailLoading] = useState(false);
  const [activeTab, setActiveTab] = useState<"google" | "email">("google");

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error: any) {
      console.error("Google sign in error:", error);
      toast.error(error.message || "Failed to sign in with Google.");
      setGoogleLoading(false);
    }
  };

  const handleEmailSignIn = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email || !password) {
      toast.error("Please enter both email and password.");
      return;
    }

    setEmailLoading(true);
    try {
      const { error } = await authClient.signIn.email({
        email: email.trim(),
        password,
        callbackURL: "/overview",
      });

      if (error) {
        toast.error(error.message || "Invalid credentials. Please check your email and password.");
      } else {
        toast.success("Signed in successfully!");
        router.push("/overview");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected authentication error occurred.");
    } finally {
      setEmailLoading(false);
    }
  };

  return (
    <Card className="w-full border-slate-800/80 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden p-0 sm:p-2 border">
      <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-6">
        {/* Logo & Agency Branding */}
        <div className="flex flex-col items-center space-y-3">
          <div className="relative flex items-center justify-center p-3.5 bg-gradient-to-b from-slate-800 to-slate-900 border border-slate-700/60 rounded-2xl shadow-xl group transition-transform hover:scale-105">
            <Image
              src="/logo_white.png"
              alt="Uprise Tools Logo"
              width={42}
              height={42}
              className="object-contain drop-shadow-md"
              priority
            />
          </div>

          <div className="flex items-center gap-1.5 px-3 py-1 bg-indigo-500/10 border border-indigo-500/20 rounded-full text-[10px] font-extrabold uppercase tracking-widest text-indigo-400 mt-1">
            <Sparkles className="w-3 h-3 text-indigo-400" />
            <span>Uprise Tools</span>
          </div>

          <div className="space-y-1.5 pt-1">
            <h1 className="text-2xl sm:text-3xl font-extrabold tracking-tight text-white">
              Agency Command Center
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              Sign in to access your Google Ads triage tools, CRO audits, and campaign analytics.
            </p>
          </div>
        </div>

        {/* Tab Switcher */}
        <div className="w-full grid grid-cols-2 p-1 bg-slate-950/60 border border-slate-800 rounded-xl">
          <button
            type="button"
            onClick={() => setActiveTab("google")}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "google"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <span>Google Single Sign-On</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("email")}
            className={`py-2 text-xs font-semibold rounded-lg transition-all flex items-center justify-center gap-2 cursor-pointer ${
              activeTab === "email"
                ? "bg-indigo-600 text-white shadow-md"
                : "text-slate-400 hover:text-slate-200"
            }`}
          >
            <KeyRound className="w-3.5 h-3.5" />
            <span>Email & Password</span>
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "google" ? (
          /* Google OAuth Action */
          <div className="w-full space-y-4 pt-2">
            <Button
              type="button"
              onClick={handleGoogleSignIn}
              disabled={googleLoading}
              className="w-full h-12 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer group hover:shadow-indigo-500/10 active:scale-[0.99]"
            >
              {googleLoading ? (
                <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
              ) : (
                <svg
                  className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                  aria-hidden="true"
                >
                  <path
                    fill="#4285F4"
                    d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
                  />
                </svg>
              )}
              <span>
                {googleLoading
                  ? "Connecting to Google..."
                  : "Continue with Google"}
              </span>
            </Button>

            <p className="text-[11px] text-slate-500 font-medium">
              Seamless access for Google Workspace accounts.
            </p>
          </div>
        ) : (
          /* Email & Password Form */
          <form onSubmit={handleEmailSignIn} className="w-full text-left space-y-4 pt-1">
            <div className="space-y-1.5">
              <Label htmlFor="email" className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                <Mail className="w-3.5 h-3.5 text-slate-400" />
                Work Email Address
              </Label>
              <Input
                id="email"
                type="email"
                placeholder="you@agency.com"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="bg-slate-950/80 border-slate-800 text-white text-sm h-11 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center justify-between">
                <Label htmlFor="password" className="text-xs text-slate-300 font-semibold flex items-center gap-1.5">
                  <Lock className="w-3.5 h-3.5 text-slate-400" />
                  Password
                </Label>
                <Link
                  href="/forget-password"
                  className="text-xs text-indigo-400 hover:text-indigo-300 transition-colors font-medium"
                >
                  Forgot Password?
                </Link>
              </div>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="bg-slate-950/80 border-slate-800 text-white text-sm h-11 focus:border-indigo-500 focus:ring-indigo-500 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={emailLoading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {emailLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Signing In...</span>
                </>
              ) : (
                <span>Sign In to Dashboard</span>
              )}
            </Button>
          </form>
        )}

        {/* Footer Navigation & Security */}
        <div className="pt-4 border-t border-slate-800/80 w-full space-y-3">
          <p className="text-xs text-slate-400">
            Have an invitation or starting a new workspace?{" "}
            <Link href="/signup" className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4">
              Register / Accept Invite
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>256-bit TLS Encrypted Auth Session</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
