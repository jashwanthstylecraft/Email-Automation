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
* **Database**: SQLite (Development) / PostgreSQL (Production), Prisma ORM
* **State Management**: Zustand
* **Charts**: Recharts
* **AI Engine**: Google Gemini API, OpenAI GPT, or self-contained **Mock Local AI Fallback** for offline testing.

---

## Local Quick Start

Follow these steps to run the complete stack locally with zero external service dependencies.

### 1. Prerequisite Installations
Ensure Node.js and Git are installed on your system.

### 2. Install Project Dependencies
Run the command below in the project directory to install dependencies (bypassing PowerShell execution policies if on Windows):
```powershell
Set-ExecutionPolicy -ExecutionPolicy Bypass -Scope Process
npm install
```

### 3. Initialize & Seed Database
Build the tables and seed rich mock customer tickets, templates, rules, and knowledge base sheets:
```powershell
npx prisma generate
npx prisma db push
npx tsx prisma/seed.ts
```

### 4. Run Development Server
```powershell
npm run dev
```
Open **[http://localhost:3000](http://localhost:3000)** in your browser.

* **Demo login credentials**: `jane@acme.com` / `password123` (or click "Sign In" to auto-login).

---

## API Configuration (Gemini / OpenAI)

To activate live LLM classifications and generation rather than the mock local engine, rename `.env.example` to `.env` and fill in your API credentials:

```ini
GEMINI_API_KEY="your-gemini-key"
OPENAI_API_KEY="your-openai-key"
```

---

## Switching to PostgreSQL in Production

Prisma 7 uses **mandatory Driver Adapters**. To switch to PostgreSQL:

1. Install the PG Driver Adapter:
   ```bash
   npm install @prisma/adapter-pg pg
   npm install -D @types/pg
   ```
2. Update `prisma/schema.prisma` datasource:
   ```prisma
   datasource db {
     provider = "postgresql"
   }
   ```
3. Update `src/lib/prisma.ts` to instantiate the PgAdapter:
   ```typescript
   import { PrismaClient } from '@/generated/prisma/client';
   import { PrismaPg } from '@prisma/adapter-pg';
   import pg from 'pg';

   const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL });
   const adapter = new PrismaPg(pool);
   export const prisma = new PrismaClient({ adapter });
   ```
4. Update `DATABASE_URL` in your `.env` to point to your PostgreSQL instance.
