import { AlertOctagon, ArrowRight, ShieldX } from "lucide-react";
import Image from "next/image";
import { Button } from "@/components/ui/button";

interface ShareFallbackProps {
  reason?: "EXPIRED" | "REVOKED" | "NOT_FOUND" | "ACCOUNT_NOT_FOUND" | string;
}

export function ShareFallbackView({ reason }: ShareFallbackProps) {
  let title = "Dashboard Unavailable";
  let description =
    "This shared reporting link is either invalid or no longer active.";

  if (reason === "EXPIRED") {
    title = "Dashboard Link Expired";
    description =
      "This shared performance report has expired. Please reach out to your account manager at Uprise Digital for an updated link.";
  } else if (reason === "REVOKED") {
    title = "Link Access Revoked";
    description =
      "Access through this link has been temporarily disabled by the agency. Please contact your account manager for assistance.";
  }

  return (
    <div className="min-h-screen bg-slate-50 dark:bg-slate-950 flex flex-col items-center justify-between p-6">
      {/* Top agency branding */}
      <div className="w-full max-w-4xl flex items-center justify-between py-4 border-b border-slate-200 dark:border-slate-800">
        <div className="flex items-center gap-2.5">
          <div className="relative w-7 h-7 flex items-center justify-center shrink-0">
            <Image
              src="/up_logo_black.png"
              alt="Uprise Digital Logo"
              width={26}
              height={26}
              className="object-contain dark:hidden"
            />
            <Image
              src="/up_logo_white.png"
              alt="Uprise Digital Logo"
              width={26}
              height={26}
              className="object-contain hidden dark:block"
            />
          </div>
          <span className="font-semibold text-sm tracking-tight text-slate-900 dark:text-white">
            Uprise Digital
          </span>
        </div>
        <span className="text-xs text-slate-500 font-medium">
          Client Reporting
        </span>
      </div>

      {/* Main card */}
      <div className="max-w-md w-full bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-2xl p-8 shadow-sm text-center space-y-6 my-12">
        <div className="w-14 h-14 rounded-2xl bg-amber-50 dark:bg-amber-950/40 border border-amber-200/60 dark:border-amber-800/40 text-amber-600 flex items-center justify-center mx-auto">
          {reason === "EXPIRED" ? (
            <AlertOctagon className="w-7 h-7" />
          ) : (
            <ShieldX className="w-7 h-7" />
          )}
        </div>

        <div className="space-y-2">
          <h2 className="text-xl font-bold tracking-tight text-slate-900 dark:text-white">
            {title}
          </h2>
          <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
            {description}
          </p>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800/60">
          <Button
            asChild
            className="w-full bg-slate-900 hover:bg-black text-white"
          >
            <a
              href="https://uprise-digital.com"
              target="_blank"
              rel="noopener noreferrer"
            >
              Visit Uprise Digital
              <ArrowRight className="w-4 h-4 ml-1.5" />
            </a>
          </Button>
        </div>
      </div>

      {/* Footer */}
      <div className="text-center text-xs text-slate-400 dark:text-slate-600 pb-4">
        © {new Date().getFullYear()} Uprise Digital. Real-time Marketing
        Intelligence.
      </div>
    </div>
  );
}
