"use client";

import {
  CheckCircle2,
  KeyRound,
  Loader2,
  Lock,
  Mail,
  ShieldCheck,
  Sparkles,
  User,
} from "lucide-react";
import Image from "next/image";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { useEffect, useState, Suspense } from "react";
import { toast } from "sonner";
import {
  acceptInvitationAction,
  getInvitationDetailsAction,
} from "@/actions/team.actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { authClient } from "@/lib/auth-client";

function SignupFormContent() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const inviteId = searchParams.get("invite");

  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [invitationLoading, setInvitationLoading] = useState(!!inviteId);
  const [invitationDetails, setInvitationDetails] = useState<{
    id: string;
    email: string;
    role: string;
    organizationName: string;
    inviterName: string;
  } | null>(null);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  // Load invitation details if invite token present
  useEffect(() => {
    if (!inviteId) return;

    async function loadInvite() {
      setInvitationLoading(true);
      try {
        const res = await getInvitationDetailsAction(inviteId as string);
        if (res.success && res.invitation) {
          setInvitationDetails(res.invitation);
          setEmail(res.invitation.email);
        } else {
          toast.error(res.error || "Invalid or expired invitation.");
        }
      } catch (err: any) {
        toast.error("Failed to load invitation details.");
      } finally {
        setInvitationLoading(false);
      }
    }

    loadInvite();
  }, [inviteId]);

  const handleGoogleSignUp = async () => {
    setGoogleLoading(true);
    try {
      await authClient.signIn.social({
        provider: "google",
        callbackURL: inviteId ? `/overview` : "/onboarding",
      });
    } catch (error: any) {
      console.error("Google sign up error:", error);
      toast.error(error.message || "Google registration failed.");
      setGoogleLoading(false);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!name || (!inviteId && !email) || !password) {
      toast.error("Please fill in all required fields.");
      return;
    }

    if (password.length < 8) {
      toast.error("Password must be at least 8 characters long.");
      return;
    }

    setLoading(true);

    try {
      if (inviteId && invitationDetails) {
        // Accept invitation flow
        const res = await acceptInvitationAction({
          invitationId: inviteId,
          name,
          password,
        });

        if (res.success) {
          toast.success(
            `Successfully joined ${invitationDetails.organizationName}!`,
          );
          // Sign user in with the created credentials
          await authClient.signIn.email({
            email: invitationDetails.email,
            password,
            callbackURL: "/overview",
          });
          router.push("/overview");
        }
      } else {
        // Self-serve signup flow
        const { error } = await authClient.signUp.email({
          name,
          email: email.trim(),
          password,
          callbackURL: "/onboarding",
        });

        if (error) {
          toast.error(error.message || "Failed to create account.");
        } else {
          toast.success(
            "Account created successfully! Let's set up your agency.",
          );
          router.push("/onboarding");
        }
      }
    } catch (err: any) {
      toast.error(err.message || "An unexpected registration error occurred.");
    } finally {
      setLoading(false);
    }
  };

  if (invitationLoading) {
    return (
      <div className="py-12 flex flex-col items-center justify-center space-y-3">
        <Loader2 className="w-8 h-8 animate-spin text-indigo-500" />
        <p className="text-sm text-slate-400">Verifying invitation token...</p>
      </div>
    );
  }

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
              {invitationDetails
                ? "Accept Team Invitation"
                : "Create Agency Workspace"}
            </h1>
            <p className="text-xs sm:text-sm text-slate-400 max-w-xs mx-auto leading-relaxed">
              {invitationDetails
                ? `You've been invited by ${invitationDetails.inviterName} to join ${invitationDetails.organizationName}.`
                : "Register your agency to start automating Google Ads search-term triage & CRO audits."}
            </p>
          </div>
        </div>

        {/* Invitation Banner if present */}
        {invitationDetails && (
          <div className="w-full p-4 bg-indigo-950/60 border border-indigo-500/30 rounded-xl text-left flex items-start gap-3">
            <CheckCircle2 className="w-5 h-5 text-indigo-400 shrink-0 mt-0.5" />
            <div className="space-y-1 text-xs">
              <p className="font-bold text-indigo-200">
                Organization: {invitationDetails.organizationName}
              </p>
              <p className="text-indigo-300/80">
                Assigned Role:{" "}
                <span className="uppercase font-extrabold tracking-wide text-indigo-300">
                  {invitationDetails.role}
                </span>
              </p>
              <p className="text-slate-400">
                Target Email: {invitationDetails.email}
              </p>
            </div>
          </div>
        )}

        {/* Google OAuth Quick Option */}
        <div className="w-full space-y-3">
          <Button
            type="button"
            onClick={handleGoogleSignUp}
            disabled={googleLoading}
            className="w-full h-11 bg-white hover:bg-slate-100 text-slate-900 font-bold text-sm rounded-xl shadow-lg transition-all flex items-center justify-center gap-3 cursor-pointer group hover:shadow-indigo-500/10 active:scale-[0.99]"
          >
            {googleLoading ? (
              <Loader2 className="w-5 h-5 animate-spin text-indigo-600" />
            ) : (
              <svg
                className="w-5 h-5 shrink-0 transition-transform group-hover:scale-110"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
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
            <span>Register with Google Workspace</span>
          </Button>

          <div className="relative my-4 flex items-center justify-center">
            <div className="absolute inset-0 flex items-center">
              <div className="w-full border-t border-slate-800" />
            </div>
            <span className="relative bg-slate-900 px-3 text-[11px] font-semibold text-slate-500 uppercase tracking-wider">
              Or Register With Email
            </span>
          </div>
        </div>

        {/* Email & Password Registration Form */}
        <form onSubmit={handleSubmit} className="w-full text-left space-y-4">
          <div className="space-y-1.5">
            <Label
              htmlFor="name"
              className="text-xs text-slate-300 font-semibold flex items-center gap-1.5"
            >
              <User className="w-3.5 h-3.5 text-slate-400" />
              Full Name
            </Label>
            <Input
              id="name"
              type="text"
              placeholder="Sarah Connor"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              className="bg-slate-950/80 border-slate-800 text-white text-sm h-11 focus:border-indigo-500 rounded-xl"
            />
          </div>

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
              placeholder="sarah@agency.com"
              required
              disabled={!!invitationDetails}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="bg-slate-950/80 border-slate-800 text-white text-sm h-11 focus:border-indigo-500 rounded-xl disabled:opacity-75"
            />
          </div>

          <div className="space-y-1.5">
            <Label
              htmlFor="password"
              className="text-xs text-slate-300 font-semibold flex items-center gap-1.5"
            >
              <Lock className="w-3.5 h-3.5 text-slate-400" />
              Set Account Password
            </Label>
            <Input
              id="password"
              type="password"
              placeholder="At least 8 characters"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
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
                <span>Creating Account...</span>
              </>
            ) : (
              <span>
                {invitationDetails
                  ? "Accept Invite & Join Workspace"
                  : "Complete Registration"}
              </span>
            )}
          </Button>
        </form>

        {/* Footer Navigation */}
        <div className="pt-4 border-t border-slate-800/80 w-full space-y-3">
          <p className="text-xs text-slate-400">
            Already have an account?{" "}
            <Link
              href="/login"
              className="text-indigo-400 hover:text-indigo-300 font-semibold underline underline-offset-4"
            >
              Sign In Here
            </Link>
          </p>

          <div className="flex items-center justify-center gap-1.5 text-[11px] text-slate-500 pt-1">
            <ShieldCheck className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
            <span>256-bit TLS Encrypted Account Setup</span>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}

export default function SignUpPage() {
  return (
    <Suspense
      fallback={
        <div className="text-slate-400 text-center py-12">
          Loading registration...
        </div>
      }
    >
      <SignupFormContent />
    </Suspense>
  );
}
