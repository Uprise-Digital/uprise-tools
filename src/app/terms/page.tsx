import { headers } from "next/headers";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { auth } from "@/lib/auth";

export const metadata = {
  title: "Terms of Service | Uprise Tools",
  description:
    "Terms of Service and Master Subscription Agreement for Uprise Tools PPC Command OS.",
};

export default async function TermsPage() {
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
              Master Subscription Agreement
            </span>
            <h1 className="text-4xl font-extrabold text-slate-900 tracking-tight mb-3">
              Terms of Service
            </h1>
            <p className="text-sm text-slate-500 font-medium">
              Last Updated: August 7, 2026 • Effective Immediately for All
              Organizations & Users
            </p>
          </div>

          {/* Terms Content Sections */}
          <div className="prose prose-slate max-w-none space-y-8 text-sm leading-relaxed text-slate-700 font-normal">
            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                1. Acceptance of Terms
              </h2>
              <p>
                By creating an account, connecting a Google Ads MCC portfolio,
                or utilizing Uprise Tools (&quot;Service&quot;), operated by
                Uprise Digital (&quot;Company&quot;, &quot;we&quot;,
                &quot;us&quot;), you (&quot;Subscriber&quot; or
                &quot;Agency&quot;) agree to be bound by these Terms of Service.
                If you are accepting on behalf of an agency or entity, you
                represent that you have full legal authority to bind that entity
                to these terms.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                2. Service Scope & Google Ads MCC Access
              </h2>
              <p>
                Uprise Tools provides automated PPC threat scanning, landing
                page DOM audits, automated AI morning briefing emails, and
                negative keyword mutation utilities. To enable these features,
                you grant Uprise Tools permission to access your Google Ads
                Manager Account (MCC) via official OAuth 2.0. You remain solely
                responsible for maintaining appropriate customer client
                authorizations and OAuth permissions.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                3. Agency Responsibilities & Client Consents
              </h2>
              <p>Agencies using Uprise Tools are responsible for:</p>
              <ul className="list-disc pl-5 space-y-2 mt-2">
                <li>
                  Ensuring all agency team members maintain secure login
                  credentials and two-factor authentication.
                </li>
                <li>
                  Obtaining explicit client authorization before configuring
                  automated executive AI morning briefing email recipients.
                </li>
                <li>
                  Reviewing recommended negative keyword exclusions prior to
                  triggering batch Google Ads API mutations.
                </li>
              </ul>
            </section>

            <section className="bg-slate-50 border border-slate-200 rounded-xl p-6">
              <h2 className="text-lg font-bold text-slate-900 mb-2">
                4. Automated AI Briefings & Mutation Disclaimer
              </h2>
              <p className="text-xs leading-relaxed text-slate-600">
                Uprise Tools utilizes generative AI models (including Google
                Gemini) to synthesize ad account performance metrics. While our
                threat algorithms achieve high empirical accuracy, performance
                recommendations and briefing summaries are provided on an
                &quot;as-is&quot; analytical basis. The Subscriber retains final
                operational responsibility for ad account performance, campaign
                budget limits, and bidding strategies.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                5. Subscription Tiers, Billing & Cancellation
              </h2>
              <p>
                Uprise Tools is billed on a recurring monthly or annual
                subscription basis according to your selected agency tier
                (Starter, Pro, Scale). Subscriptions auto-renew unless cancelled
                at least 24 hours prior to the next billing cycle. All fees are
                exclusive of applicable taxes unless stated otherwise. You may
                cancel your subscription at any time via your Settings portal.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                6. Intellectual Property & Multi-Tenant White-Labeling
              </h2>
              <p>
                All software, platform code, algorithms, visual design, and
                trademarks remain the exclusive property of Uprise Digital.
                Agencies subscribed to eligible White-Label plans are granted a
                limited, non-exclusive, non-transferable license to brand
                generated PDF executive reports and email templates with their
                agency logo and custom domain.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                7. Limitation of Liability
              </h2>
              <p>
                To the maximum extent permitted by applicable law, Uprise
                Digital shall not be liable for any indirect, incidental,
                special, consequential, or punitive damages, or any loss of
                profits, revenue, or ad campaign conversions arising out of or
                related to your use of the Service.
              </p>
            </section>

            <section>
              <h2 className="text-xl font-bold text-slate-900 mb-3">
                8. Governing Law & Contact Information
              </h2>
              <p>
                These Terms shall be governed by and construed in accordance
                with the laws of Victoria, Australia. Any legal suit, action, or
                proceeding arising out of these Terms shall be instituted
                exclusively in the courts of Victoria, Australia.
              </p>
              <div className="mt-3 bg-slate-100 border border-slate-200 rounded-lg p-4 font-mono text-xs text-slate-800">
                Uprise Digital Legal Team
                <br />
                Email: alerts@uprisedigital.com.au
                <br />
                Website: https://uprise-tools.app
              </div>
            </section>
          </div>
        </main>
      </div>

      <LandingFooter />
    </div>
  );
}
