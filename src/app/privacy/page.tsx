import { headers } from "next/headers";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Privacy Policy | Uprise Tools",
  description:
    "Privacy Policy and Google Ads MCC Data Handling disclosures for Uprise Tools PPC Command OS.",
};

export default async function PrivacyPage() {
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
              Legal Compliance & Data Safety
            </span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Privacy Policy
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Last Updated: August 7, 2026 • Effective Immediately for All
              Registered Agencies & Accounts
            </p>
          </div>

          {/* Privacy Content Sections */}
          <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700 font-normal">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                1. Introduction & Overview
              </h2>
              <p>
                Uprise Tools (&quot;we&quot;, &quot;us&quot;, or
                &quot;our&quot;), operated by Uprise Digital, provides a
                multi-tenant PPC management and performance automation platform
                for digital marketing agencies. This Privacy Policy details how
                we collect, use, store, encrypt, and disclose personal and
                agency ad performance data when you access or use our web
                application located at{" "}
                <span className="font-semibold text-slate-900">
                  uprise-tools.app
                </span>
                .
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                2. Information We Collect
              </h2>
              <p>
                To deliver our automated Google Ads MCC anomaly scanning, turbo
                negative keyword mutations, and executive AI morning briefings,
                we collect the following categories of data:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong className="text-slate-900">
                    Agency Account Information:
                  </strong>{" "}
                  Name, professional email address, organization name, timezone,
                  default currency, and encrypted passwords.
                </li>
                <li>
                  <strong className="text-slate-900">
                    Google Ads API OAuth Tokens:
                  </strong>{" "}
                  Refresh tokens, access tokens, customer client IDs, campaign
                  structures, search terms reports, and performance metrics
                  (spend, conversions, CPA, impression share).
                </li>
                <li>
                  <strong className="text-slate-900">
                    Client Onboarding Contacts:
                  </strong>{" "}
                  Primary client contact names, business emails, and linked
                  integration credentials (e.g., GoHighLevel location IDs,
                  Notion URLs, Google Drive folder links).
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                3. How We Use Your Data
              </h2>
              <p>
                We use collected information solely for operational performance
                analysis and automated agency workflow execution:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  To sync Google Ads MCC sub-accounts in real time and detect
                  cost-per-click (CPC) anomalies or broken landing pages.
                </li>
                <li>
                  To generate and dispatch AI Executive Morning Briefings via
                  email to designated agency and client recipients.
                </li>
                <li>
                  To execute user-approved negative keyword mutations directly
                  via the Google Ads API.
                </li>
                <li>
                  To automate client onboarding pipelines in GoHighLevel and
                  generate workspace documentation.
                </li>
              </ul>
            </section>

            <section className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                4. Google API Services User Data Policy Compliance
              </h2>
              <p className="text-xs leading-relaxed text-slate-600">
                Uprise Tools&apos; use and transfer to any other app of
                information received from Google APIs will adhere to the{" "}
                <a
                  href="https://developers.google.com/terms/api-services-user-data-policy"
                  target="_blank"
                  rel="noreferrer"
                  className="underline font-semibold text-slate-900"
                >
                  Google API Services User Data Policy
                </a>
                , including the Limited Use requirements. Google Ads OAuth
                refresh tokens are encrypted at rest using industry-standard
                AES-256 encryption and are strictly restricted to performance
                retrieval and authorized account mutations.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                5. Data Protection, Security & Tenant Isolation
              </h2>
              <p>
                We implement robust technical measures to protect your
                organization&apos;s data against unauthorized access, loss, or
                alteration:
              </p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  <strong className="text-slate-900">
                    PostgreSQL Row-Level Security (RLS):
                  </strong>{" "}
                  Every database query enforces strict database tenant
                  isolation, ensuring Agency A cannot view or access Agency
                  B&apos;s data.
                </li>
                <li>
                  <strong className="text-slate-900">Encryption:</strong> Data
                  in transit is encrypted using TLS 1.3, and secret tokens are
                  encrypted at rest using AES-256-GCM.
                </li>
                <li>
                  <strong className="text-slate-900">
                    No Third-Party Sale:
                  </strong>{" "}
                  We never sell, rent, or trade your agency data or client
                  performance metrics to data brokers or third parties.
                </li>
              </ul>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                6. Data Retention & Account Deletion Rights
              </h2>
              <p>
                We retain client metrics and audit records for as long as your
                organization maintains an active subscription. You may request
                full account data erasure at any time by navigating to your
                Settings menu or emailing{" "}
                <a
                  href="mailto:alerts@uprisedigital.com.au"
                  className="underline font-semibold text-slate-900"
                >
                  alerts@uprisedigital.com.au
                </a>
                . Upon cancellation, all OAuth refresh tokens are immediately
                revoked and purged.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                7. Contact Us
              </h2>
              <p>
                If you have questions, concerns, or requests regarding this
                Privacy Policy or our data practices, please contact our Privacy
                Compliance Officer at:
              </p>
              <div className="mt-3 bg-slate-100 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-800">
                Uprise Digital Privacy Team
                <br />
                Email: alerts@uprisedigital.com.au
                <br />
                Location: Melbourne, VIC, Australia
              </div>
            </section>
          </div>
        </main>
      </div>

      <LandingFooter />
    </div>
  );
}
