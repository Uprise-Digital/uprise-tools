"use client";

import {
  ArrowLeft,
  CheckCircle2,
  Loader2,
  Mail,
  ShieldCheck,
  Sparkles,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

export default function ForgetPasswordPage() {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!email) {
      toast.error("Please enter your email address.");
      return;
    }

    setLoading(true);

    try {
      const { error } = await authClient.requestPasswordReset({
        email: email.trim(),
        redirectTo: "/reset-password",
      });

      if (error) {
        toast.error(
          error.message || "Failed to process password reset request.",
        );
      } else {
        setSubmitted(true);
        toast.success("Password reset instructions sent!");
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected error occurred.");
    } finally {
      setLoading(false);
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
              Reset Password
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              Enter your registered work email address to receive password
              recovery instructions.
            </p>
          </div>
        </div>

        {submitted ? (
          <div className="w-full p-6 bg-slate-950/60 border border-emerald-500/30 rounded-2xl text-center space-y-4">
            <div className="flex items-center justify-center w-12 h-12 rounded-full bg-emerald-500/10 border border-emerald-500/20 mx-auto text-emerald-400">
              <CheckCircle2 className="w-6 h-6" />
            </div>
            <div className="space-y-1">
              <h3 className="text-base font-bold text-white">
                Check Your Inbox
              </h3>
              <p className="text-xs text-slate-400 max-w-xs mx-auto">
                If an account exists for{" "}
                <span className="font-semibold text-slate-200">{email}</span>, a
                secure password reset link has been dispatched.
              </p>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={() => setSubmitted(false)}
              className="mt-2 text-xs border-slate-700 text-slate-300 hover:bg-slate-800"
            >
              Resend to another email
            </Button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="w-full text-left space-y-4">
            <div className="space-y-1.5">
              <Label
                htmlFor="email"
                className="text-xs text-slate-300 font-semibold flex items-center gap-1.5"
              >
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
                className="bg-slate-950/80 border-slate-800 text-white text-sm h-11 focus:border-indigo-500 rounded-xl"
              />
            </div>

            <Button
              type="submit"
              disabled={loading}
              className="w-full h-11 bg-indigo-600 hover:bg-indigo-500 text-white font-bold text-sm rounded-xl shadow-lg transition-all cursor-pointer flex items-center justify-center gap-2 mt-2"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin text-white" />
                  <span>Sending Instructions...</span>
                </>
              ) : (
                <span>Send Password Reset Link</span>
              )}
            </Button>
          </form>
        )}

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-slate-800/80 w-full space-y-3">
          <Link
            href="/login"
            className="inline-flex items-center gap-1.5 text-xs text-indigo-400 hover:text-indigo-300 font-semibold"
          >
            <ArrowLeft className="w-3.5 h-3.5" />
            <span>Return to Sign In</span>
          </Link>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>Secure Password Recovery Protocol</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
