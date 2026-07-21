import { neon } from "@neondatabase/serverless";

/**
 * Server-only handle to the team's database (Neon serverless Postgres over HTTP).
 * The connection string comes from `DATABASE_URL`, which the owner connects via
 * the database card and which is injected into the sandbox and passed to the live
 * host on publish. Resolved lazily (per call, not at module load) so the site
 * still builds and serves before a database is connected — the error only
 * surfaces if a query actually runs without `DATABASE_URL`.
 *
 * Use it only inside a `createServerFn()` handler or an `src/routes/api/*` route
 * (never client code):
 *
 *   const getPosts = createServerFn().handler(async () => {
 *     const rows = await sql()`select id, title, created_at from posts`;
 *     // Coerce non-primitive columns (timestamps are JS Dates) to strings before
 *     // returning to the client, or React will refuse to render them:
 *     return rows.map((r) => ({ ...r, created_at: String(r.created_at) }));
 *   });
 */
export const sql = () => {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error(
      "DATABASE_URL is not set — connect a database (via the database card) before running queries.",
    );
  }
  return neon(url);
};

/**
 * One-time init: creates the users table if it doesn't exist.
 * Idempotent — safe to call on every cold start.
 */
export async function ensureUsersTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping users table init. Database features will be unavailable.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password_hash TEXT NOT NULL,
      name TEXT NOT NULL,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("[db] users table initialized");
}

/**
 * One-time init: creates the render_jobs table if it doesn't exist.
 * Idempotent — safe to call on every cold start.
 */
export async function ensureRenderJobsTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping render_jobs table init. Database features will be unavailable.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS render_jobs (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      project_name TEXT NOT NULL DEFAULT 'Untitled Commercial',
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'processing', 'completed', 'failed')),
      config JSONB NOT NULL DEFAULT '{}'::jsonb,
      output_url TEXT,
      progress INTEGER NOT NULL DEFAULT 0
        CHECK (progress >= 0 AND progress <= 100),
      error_message TEXT,
      heygen_video_id TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;

  // Add heygen_video_id column if it doesn't exist (migration for existing tables)
  try {
    await db`
      ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS heygen_video_id TEXT
    `;
  } catch {
    // Older Postgres versions may not support IF NOT EXISTS — safe to ignore
  }

  // Add did_talk_id column if it doesn't exist (for D-ID integration)
  try {
    await db`
      ALTER TABLE render_jobs ADD COLUMN IF NOT EXISTS did_talk_id TEXT
    `;
  } catch {
    // Older Postgres versions may not support IF NOT EXISTS — safe to ignore
  }

  console.log("[db] render_jobs table initialized");
}

/**
 * One-time init: creates the contact_lists table if it doesn't exist.
 */
export async function ensureContactListsTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping contact_lists table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS contact_lists (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      name TEXT NOT NULL,
      description TEXT,
      contact_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("[db] contact_lists table initialized");
}

/**
 * One-time init: creates the contacts table if it doesn't exist.
 */
export async function ensureContactsTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping contacts table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS contacts (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
      phone_number TEXT NOT NULL,
      name TEXT,
      consent BOOLEAN NOT NULL DEFAULT false,
      consent_date TIMESTAMPTZ,
      opted_out BOOLEAN NOT NULL DEFAULT false,
      opted_out_date TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (list_id, phone_number)
    );
  `;
  console.log("[db] contacts table initialized");
}

/**
 * One-time init: creates the sms_campaigns table if it doesn't exist.
 */
export async function ensureSmsCampaignsTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping sms_campaigns table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS sms_campaigns (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      list_id UUID NOT NULL REFERENCES contact_lists(id) ON DELETE CASCADE,
      render_job_id UUID REFERENCES render_jobs(id) ON DELETE SET NULL,
      name TEXT NOT NULL,
      message_template TEXT,
      status TEXT NOT NULL DEFAULT 'draft'
        CHECK (status IN ('draft', 'sending', 'completed', 'failed')),
      sent_count INTEGER NOT NULL DEFAULT 0,
      delivered_count INTEGER NOT NULL DEFAULT 0,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("[db] sms_campaigns table initialized");
}

/**
 * One-time init: creates the sms_messages table if it doesn't exist.
 */
export async function ensureSmsMessagesTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping sms_messages table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS sms_messages (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      campaign_id UUID NOT NULL REFERENCES sms_campaigns(id) ON DELETE CASCADE,
      contact_id UUID NOT NULL REFERENCES contacts(id) ON DELETE CASCADE,
      status TEXT NOT NULL DEFAULT 'queued'
        CHECK (status IN ('queued', 'sent', 'delivered', 'failed', 'opted_out')),
      sent_at TIMESTAMPTZ,
      delivered_at TIMESTAMPTZ,
      error_message TEXT,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("[db] sms_messages table initialized");
}

/**
 * One-time init: creates the analytics_events table if it doesn't exist.
 */
export async function ensureAnalyticsEventsTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping analytics_events table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS analytics_events (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      render_job_id UUID REFERENCES render_jobs(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      event_type TEXT NOT NULL CHECK (event_type IN ('view', 'completion', 'click', 'share', 'sms_delivered', 'sms_link_click')),
      channel TEXT NOT NULL CHECK (channel IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'sms', 'direct')),
      viewer_id TEXT,
      watch_duration_seconds INTEGER,
      metadata JSONB DEFAULT '{}'::jsonb,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now()
    );
  `;
  console.log("[db] analytics_events table initialized");
}

/**
 * One-time init: creates the analytics_daily_summary table if it doesn't exist.
 */
export async function ensureAnalyticsDailySummaryTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping analytics_daily_summary table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS analytics_daily_summary (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      render_job_id UUID NOT NULL REFERENCES render_jobs(id) ON DELETE CASCADE,
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      date DATE NOT NULL,
      channel TEXT NOT NULL CHECK (channel IN ('instagram', 'tiktok', 'youtube', 'facebook', 'linkedin', 'x', 'sms', 'direct')),
      views INTEGER NOT NULL DEFAULT 0,
      unique_viewers INTEGER NOT NULL DEFAULT 0,
      completions INTEGER NOT NULL DEFAULT 0,
      clicks INTEGER NOT NULL DEFAULT 0,
      shares INTEGER NOT NULL DEFAULT 0,
      total_watch_seconds INTEGER NOT NULL DEFAULT 0,
      UNIQUE (render_job_id, date, channel)
    );
  `;
  console.log("[db] analytics_daily_summary table initialized");
}

/**
 * One-time init: creates the subscriptions table if it doesn't exist.
 * Idempotent — safe to call on every cold start.
 */
export async function ensureSubscriptionsTable(): Promise<void> {
  const url = process.env.DATABASE_URL;
  if (!url) {
    console.warn("[db] DATABASE_URL not set — skipping subscriptions table init.");
    return;
  }
  const db = neon(url);
  await db`
    CREATE TABLE IF NOT EXISTS subscriptions (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
      plan TEXT NOT NULL CHECK (plan IN ('monthly', 'annual')),
      status TEXT NOT NULL DEFAULT 'trialing'
        CHECK (status IN ('active', 'canceled', 'past_due', 'trialing')),
      stripe_checkout_session_id TEXT,
      current_period_start TIMESTAMPTZ,
      current_period_end TIMESTAMPTZ,
      canceled_at TIMESTAMPTZ,
      created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
      UNIQUE (user_id)
    );
  `;
  console.log("[db] subscriptions table initialized");
}

/**
 * Ensure all tables exist (call on startup).
 */
export async function ensureAllTables(): Promise<void> {
  await ensureUsersTable();
  await ensureRenderJobsTable();
  await ensureContactListsTable();
  await ensureContactsTable();
  await ensureSmsCampaignsTable();
  await ensureSmsMessagesTable();
  await ensureAnalyticsEventsTable();
  await ensureAnalyticsDailySummaryTable();
  await ensureSubscriptionsTable();
}
