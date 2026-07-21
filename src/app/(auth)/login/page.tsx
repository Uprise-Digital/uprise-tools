"use client";

import { ShieldCheck, Sparkles, Loader2 } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { authClient } from "@/lib/auth-client";

export default function LoginPage() {
  const [googleLoading, setGoogleLoading] = useState(false);

  const handleGoogleSignIn = async () => {
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: "/",
      });
    } catch (error) {
      console.error("Google sign in error:", error);
      setGoogleLoading(false);
    }
  };

  return (
    <Card className="w-full border-slate-800/80 bg-slate-900/90 text-slate-100 shadow-2xl backdrop-blur-xl rounded-2xl overflow-hidden p-0 sm:p-2 border">
      <CardContent className="p-8 sm:p-10 flex flex-col items-center text-center space-y-8">
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
              Agency Single Sign-On
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              Sign in with your authorized Google Workspace account to access
              agency tools and portfolio insights.
            </p>
          </div>
        </div>

        {/* Google OAuth Action Button */}
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
            No username or password required.
          </p>
        </div>

        {/* Footer Security Badge */}
        <div className="pt-4 border-t border-slate-800/80 w-full flex items-center justify-center gap-1.5 text-[11px] text-slate-400">
          <ShieldCheck className="w-4 h-4 text-emerald-400 shrink-0" />
          <span>Protected by Google Workspace OAuth 2.0</span>
        </div>
      </CardContent>
    </Card>
  );
}
