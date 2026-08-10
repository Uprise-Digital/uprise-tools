# 🚀 Uprise Tools — Agency Operations & Campaign Intelligence Engine

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?style=flat-square&logo=next.js)](https://nextjs.org/)
[![PostgreSQL](https://img.shields.io/badge/PostgreSQL-Neon_Drizzle-blue?style=flat-square&logo=postgresql)](https://orm.drizzle.team/)
[![Tailwind CSS v4](https://img.shields.io/badge/Tailwind_CSS-v4-38bdf8?style=flat-square&logo=tailwindcss)](https://tailwindcss.com/)
[![Better Auth](https://img.shields.io/badge/Auth-Better_Auth-orange?style=flat-square)](https://better-auth.com/)
[![Google Ads API](https://img.shields.io/badge/API-Google_Ads_v23-green?style=flat-square&logo=googleads)](https://developers.google.com/google-ads/api/docs/first-call/overview)
[![Gemini AI](https://img.shields.io/badge/AI-Google_Gemini-purple?style=flat-square&logo=googlegemini)](https://ai.google.dev/)

An internal, mission-critical digital agency growth OS and automated campaign intelligence platform engineered for **Uprise Digital**. Powers automated Google Ads search-term triage, AI-driven negative keyword discovery, GoHighLevel (GHL) client onboarding, automated morning briefing digests, landing page CRO audits, and enterprise multi-tenant Row-Level Security (RLS).

---

## 🌟 Key Features

### 🎯 AI Campaign Intelligence & Negative Keyword Engine
- **Automated Rolling Search-Term Triage (`/accounts/[id]/negatives`)**: Evaluates Google Ads search term reports across 14-day rolling windows, automatically isolating wasted zero-conversion spend against customized critical spend thresholds.
- **Real-Time Serper Web Research**: Queries real-time search engine data to discover competitor brand names, out-of-scope intent, and local geographic exclusions before spend occurs.
- **Match-Type Strategy Controls**: Supports granular Broad, Phrase, and Exact match suggestions with negative keyword broad/phrase/exact toggles and automatic root-word isolation for competitor brand names.
- **Automated Daily Automation Cron (`/api/cron/negative-keywords`)**: Nightly GitHub Action cron executing multi-account AI search audits with single-click sync back to the Google Ads API.
- **Historical Decision Feedback Loop**: Tracks historical `approved` and `denied` negative keyword decisions in PostgreSQL to continually fine-tune Gemini recommendations over time.

### 📧 Executive Briefings & AI Auditing
- **Automated Morning Briefing (`/api/cron/morning-briefing`)**: Daily email digest engine built with `@react-email` and Resend, delivering campaign anomaly alerts, spend metrics, and triage recommendations to stakeholders.
- **AI Landing Page & CRO Analyzer (`/lp-analysis`)**: Scrapes target landing pages using Cheerio & Turndown, cross-referencing landing page content against Google Ads copy to identify quality score bottlenecks and conversion friction.
- **PPC Ad & Campaign Audit Engine (`/ad-audit`)**: Evaluates campaign structure, ad copy relevance, and extension coverage, generating agency-grade PDF reports powered by Satori and `@react-pdf/renderer`.

### 🏢 Agency Command Center & Client Pipeline
- **GoHighLevel (GHL) Onboarding Engine (`/pipeline`, `/onboard`)**: Fully automated multi-stage onboarding workflow linking GHL snapshots, location management, custom field creation, and folder permission defaults.
- **Account Triage & Rule Customization (`/settings`, `/accounts/[id]`)**: Organization-level defaults and per-account buyer persona notes (`targetBuyer`, `serviceScope`, `outOfScope`, `convertingIntentSignals`) for hyper-targeted AI output.
- **Client & Ad Account Hub (`/accounts`, `/clients`)**: Centralized command center managing Google Ads connections, status toggles, account health scores, and active campaign tracking.

### 🔐 Multi-Tenant Security & Model Context Protocol
- **PostgreSQL Row-Level Security (RLS)**: Strict database-enforced multi-tenant isolation policy on `ad_accounts` and agency data using Drizzle ORM and Neon Serverless.
- **Model Context Protocol (MCP) Endpoint (`/api/mcp`)**: Built-in MCP server implementation allowing autonomous AI agents (Claude, Gemini, Antigravity) to query ad performance and trigger negative keyword routines securely over SSE/HTTP transports.

---

## 🛠️ Technology Stack

- **Framework**: Next.js 16 (App Router + Turbopack + React 19 + Server Actions)
- **Database & ORM**: PostgreSQL (Neon Serverless) + Drizzle ORM + Drizzle Kit (with RLS policies)
- **Styling & UI**: Tailwind CSS v4 + Radix UI + Lucide Icons + Recharts + Sonner + `tw-animate-css`
- **Authentication**: Better Auth (`better-auth`)
- **AI & Research**: Google GenAI SDK (`@google/genai`), OpenAI SDK, Serper.dev API
- **External API Integrations**: Google Ads API (`google-ads-api` v23), GoHighLevel API, Notion API (`@notionhq/client`), Resend Email Engine (`resend` + `@react-email`), AWS S3 (`@aws-sdk/client-s3`)
- **Queueing & Scheduling**: Inngest, Vercel Queue (`@vercel/queue`), Vercel KV, GitHub Actions Workflow Schedules
- **Tooling & Code Quality**: Vitest, Biome (`@biomejs/biome`), TypeScript 5.9

---

## 🚀 Getting Started

### Prerequisites
- Node.js 20+
- PostgreSQL Database Instance (Neon Serverless or Local Postgres)
- Google Ads API Developer Token & OAuth Credentials
- Google Gemini API Key (`GEMINI_API_KEY`)
- Serper.dev API Key (`SERPER_KEY`)

### Installation & Setup

1. **Clone the repository:**
   ```bash
   git clone https://github.com/Uprise-Digital/uprise-tools.git
   cd uprise-tools
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Environment Configuration:**
   Create a `.env.local` file in the project root with the required environment variables:
   ```env
   # Database & RLS
   DATABASE_URL="postgresql://user:password@ep-cool-db.neon.tech/neondb?sslmode=require"

   # Authentication
   BETTER_AUTH_SECRET="your-better-auth-secret"
   BETTER_AUTH_URL="http://localhost:3000"

   # AI & Search Services
   GEMINI_API_KEY="your-gemini-api-key"
   SERPER_KEY="your-serper-api-key"

   # Google Ads Integration
   GOOGLE_ADS_CLIENT_ID="your-client-id"
   GOOGLE_ADS_CLIENT_SECRET="your-client-secret"
   GOOGLE_ADS_DEVELOPER_TOKEN="your-developer-token"

   # Automation & Cron Secrets
   CRON_SECRET="your-cron-bearer-token"
   ```

4. **Run Database Migrations:**
   ```bash
   npx drizzle-kit push
   ```

5. **Start Development Server:**
   ```bash
   npm run dev
   ```
   Open [http://localhost:3000](http://localhost:3000) to view the Command Center.

6. **Build Production Bundle:**
   ```bash
   npm run build
   ```

---

## 🧪 Testing & Code Quality

- **Run Unit & Integration Tests:**
  ```bash
  npm run test:run
  ```
- **Lint & Format Codebase:**
  ```bash
  npm run lint
  npm run format
  ```

---

## 🔒 Security & Confidentiality

This repository contains **proprietary internal software** developed for **Uprise Digital**. Access to source code, database credentials, and production secrets is restricted to authorized team members.

---

## 📜 License
Internal Proprietary Software — Uprise Digital. All Rights Reserved.
