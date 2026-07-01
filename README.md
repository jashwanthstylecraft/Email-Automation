# StyleCraft - AI Email Automation & Auto-Reply Web Application

Intelligent SaaS platform that monitors an organization's support mailbox, runs incoming messages through a local RAG knowledge pipeline and LLM processing engine, and automatically drafts or sends context-aware replies based on visual automation rules.

---

## Key Features

1. **AI Processing Pipeline**: Integrates language detection, category tagging (Billing, Tech support, HR, Sales, etc.), sentiment categorization (Neutral, Positive, Angry), urgency detection, spam classification, and duplicate checks.
2. **Local RAG Service**: Fully typed, zero-dependency token-overlap and TF-IDF cosine-similarity engine that matches user inquiries against uploaded business documentation and injects the context directly into the AI prompt.
3. **Visual Rule Builder**: Conditional rules matching triggers (`IF category == Billing AND subject contains refund THEN draft reply using Billing Template & escalate to Admin`).
4. **Human Approval Flow**: Supports multiple auto-reply dispatching modes: Fully Automatic, Draft for Approval, or Manual composing.
5. **Command Menu (Ctrl+K)**: Instant keyboard-driven command palette for route jumping and email search.
6. **Modern UI/UX**: Stripe/Linear inspired dark-theme interface with dynamic SVG charts, glassmorphism panels, and clean CSS styling.

---

## Technology Stack

* **Core**: Next.js 15 (App Router), React 19, TypeScript
* **Styling**: Tailwind CSS
* **Database**: PostgreSQL, Prisma ORM (Driver Adapters)
* **State Management**: Zustand
* **Charts**: Recharts
* **AI Engine**: Google Gemini API, OpenAI GPT, or self-contained **Mock Local AI Fallback** for offline testing.

---

## Local Quick Start

### 1. Prerequisite Installations
Ensure Node.js, Git, and a Postgres database are available. The easiest options:
- `docker compose up postgres` (uses the `postgres` service already defined in `docker-compose.yml`), or
- a free hosted database from [Neon](https://neon.tech) or [Supabase](https://supabase.com) — works for local dev too.

### 2. Install Project Dependencies
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
npm install
```

### 3. Configure Environment
Copy `.env.example` to `.env` and set `DATABASE_URL` to your Postgres connection string.

### 4. Initialize & Seed Database
Build the tables and seed rich mock customer tickets, templates, rules, and knowledge base sheets:
```powershell
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 5. Run Development Server
```powershell
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

* **Demo login credentials**: `jane@stylecraftus.com` / `password123` (or click "Sign In" to auto-login).

---

## API Configuration (Gemini / OpenAI)

To activate live LLM classifications and generation rather than the mock local engine, fill in your API credentials in `.env`:

```ini
GEMINI_API_KEY="your-gemini-key"
OPENAI_API_KEY="your-openai-key"
```

---

## Deploying for Free (Vercel + Neon)

Vercel's serverless runtime has an ephemeral filesystem and no always-on process, so this app runs a scheduled sync (`GET /api/cron/sync`) instead of a continuously-listening IMAP connection. See `vercel.json` for the cron schedule.

1. **Create a free Postgres database** at [neon.tech](https://neon.tech) (or Supabase) and copy its connection string.
2. **Push the schema**: locally, set `DATABASE_URL` to that connection string in `.env`, then run `npx prisma db push` and `npx tsx prisma/seed.ts` once to create tables and seed demo data.
3. **Import this repo into Vercel** (vercel.com → Add New → Project → import from GitHub).
4. **Set environment variables** in the Vercel project settings: `DATABASE_URL`, `GEMINI_API_KEY`/`OPENAI_API_KEY` (optional), `IMAP_*`/`SMTP_*` (optional, for live email), and `CRON_SECRET` (any random string — protects the cron endpoint).
5. **Deploy.** Vercel will run `npm run build`, which generates the Prisma client automatically.
6. The built-in `vercel.json` cron runs once a day on the free Hobby plan. For more frequent syncing on the free tier, point an external scheduler (e.g. [cron-job.org](https://cron-job.org), free) at `https://<your-app>.vercel.app/api/cron/sync` with header `Authorization: Bearer <CRON_SECRET>` every few minutes — or just use the "Sync Inbox" button in the UI.
