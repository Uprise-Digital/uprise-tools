import { headers } from "next/headers";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Security & RLS | Uprise Tools",
  description:
    "Security architecture, PostgreSQL Row-Level Security (RLS), and OAuth encryption disclosures for Uprise Tools.",
};

export default async function SecurityPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-white text-slate-900 font-sans antialiased selection:bg-black selection:text-white flex flex-col justify-between">
      <div>
        <LandingNav isLoggedIn={isLoggedIn} />

        <main className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16 text-left">
          {/* Header */}
          <div className="border-b border-slate-200 pb-8 mb-10">
            <span className="text-xs font-bold uppercase tracking-wider text-slate-500 bg-slate-100 border border-slate-200 px-3 py-1 rounded-md mb-4 inline-block">
              Multi-Tenant Enterprise Security
            </span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Security & Row-Level Security (RLS) Architecture
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Enterprise-grade encryption, tenant isolation, and Google OAuth
              2.0 API protection.
            </p>
          </div>

          {/* Security Content Sections */}
          <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700 font-normal">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                1. PostgreSQL Row-Level Security (RLS)
              </h2>
              <p>
                Uprise Tools utilizes native PostgreSQL Row-Level Security
                policies at the database engine layer. Every ad account,
                briefing setting, client onboarding record, and negative keyword
                mutation is scoped directly to your agency organization ID using
                strict session variables. Non-authorized database roles are
                physically prevented from reading or writing data across tenant
                boundaries.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                2. Encryption Standard (AES-256-GCM & TLS 1.3)
              </h2>
              <p>
                All data transmitted between your browser, our Next.js edge
                servers, and the Google Ads API is protected using TLS 1.3
                encryption. OAuth refresh tokens, integration secret keys, and
                client communication tokens are encrypted at rest using
                AES-256-GCM.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                3. Google Ads API OAuth 2.0 Verification
              </h2>
              <p>
                Our integration operates via official Google Ads API OAuth 2.0
                protocols. Your agency administrative credentials are never
                exposed or stored in plain text. You can inspect or revoke
                Uprise Tools&apos; access at any time directly through your
                Google Account Security Dashboard.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                4. Vulnerability Disclosure & Support
              </h2>
              <p>
                If you believe you have discovered a potential security
                vulnerability or have questions about our data safety
                infrastructure, please report it to our engineering team at{" "}
                <a
                  href="mailto:alerts@uprisedigital.com.au"
                  className="underline font-semibold text-slate-900"
                >
                  alerts@uprisedigital.com.au
                </a>
                .
              </p>
            </section>
          </div>
        </main>
      </div>

      <LandingFooter />
    </div>
  );
}
