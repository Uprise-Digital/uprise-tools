import { headers } from "next/headers";
import { FAQSection } from "@/components/landing/faq-section";
import { FeaturesGrid } from "@/components/landing/features-grid";
import { HeroSection } from "@/components/landing/hero-section";
import { LandingFooter } from "@/components/landing/landing-footer";
import { LandingNav } from "@/components/landing/landing-nav";
import { MetricsSection } from "@/components/landing/metrics-section";
import { PricingSection } from "@/components/landing/pricing-section";
import { auth } from "@/lib/auth";

export default async function SaaSPage() {
  const session = await auth.api.getSession({
    headers: await headers(),
  });

  const isLoggedIn = !!session;

  return (
    <div className="min-h-screen bg-white text-slate-900 selection:bg-black selection:text-white font-sans antialiased overflow-x-hidden">
      {/* Sticky Header Nav */}
      <LandingNav isLoggedIn={isLoggedIn} />

      {/* Main SaaS Content Sections */}
      <main>
        <HeroSection />
        <MetricsSection />
        <FeaturesGrid />
        <PricingSection />
        <FAQSection />
      </main>

      {/* Footer */}
      <LandingFooter />
    </div>
  );
}
