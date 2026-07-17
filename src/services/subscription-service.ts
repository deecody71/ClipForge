import { sql, ensureSubscriptionsTable } from "~/db";

/**
 * Subscription types that match the database schema.
 */
export type Plan = "monthly" | "annual";
export type SubscriptionStatus = "active" | "canceled" | "past_due" | "trialing";

export interface Subscription {
  id: string;
  userId: string;
  plan: Plan;
  status: SubscriptionStatus;
  stripeCheckoutSessionId: string | null;
  currentPeriodStart: string | null;
  currentPeriodEnd: string | null;
  canceledAt: string | null;
  createdAt: string;
  updatedAt: string;
}

function rowToSubscription(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: any,
): Subscription {
  return {
    id: row.id,
    userId: row.user_id,
    plan: row.plan,
    status: row.status,
    stripeCheckoutSessionId: row.stripe_checkout_session_id,
    currentPeriodStart: row.current_period_start
      ? String(row.current_period_start)
      : null,
    currentPeriodEnd: row.current_period_end
      ? String(row.current_period_end)
      : null,
    canceledAt: row.canceled_at ? String(row.canceled_at) : null,
    createdAt: String(row.created_at),
    updatedAt: String(row.updated_at),
  };
}

/**
 * Get the current subscription for a user, or null if none exists.
 */
export async function getUserSubscription(
  userId: string,
): Promise<Subscription | null> {
  await ensureSubscriptionsTable();
  const db = sql();
  const rows = await db`
    SELECT *
    FROM subscriptions
    WHERE user_id = ${userId}
    LIMIT 1
  `;
  if (rows.length === 0) return null;
  return rowToSubscription(rows[0]);
}

/**
 * Create or update a subscription for a user (upsert on user_id).
 */
export async function createOrUpdateSubscription(
  userId: string,
  plan: Plan,
  status: SubscriptionStatus,
  stripeCheckoutSessionId?: string,
): Promise<Subscription> {
  await ensureSubscriptionsTable();
  const db = sql();

  const now = new Date();
  const periodStart = now;
  const periodEnd = new Date(now);
  periodEnd.setMonth(periodEnd.getMonth() + (plan === "annual" ? 12 : 1));

  const rows = await db`
    INSERT INTO subscriptions (
      user_id, plan, status, stripe_checkout_session_id,
      current_period_start, current_period_end
    ) VALUES (
      ${userId}, ${plan}, ${status},
      ${stripeCheckoutSessionId ?? null},
      ${periodStart.toISOString()},
      ${periodEnd.toISOString()}
    )
    ON CONFLICT (user_id) DO UPDATE SET
      plan = EXCLUDED.plan,
      status = EXCLUDED.status,
      stripe_checkout_session_id = EXCLUDED.stripe_checkout_session_id,
      current_period_start = EXCLUDED.current_period_start,
      current_period_end = EXCLUDED.current_period_end,
      updated_at = now(),
      canceled_at = NULL
    RETURNING *
  `;

  return rowToSubscription(rows[0]);
}

/**
 * Cancel an active subscription.
 */
export async function cancelSubscription(
  userId: string,
): Promise<Subscription | null> {
  await ensureSubscriptionsTable();
  const db = sql();

  const rows = await db`
    UPDATE subscriptions
    SET status = 'canceled',
        canceled_at = now(),
        updated_at = now()
    WHERE user_id = ${userId}
      AND status IN ('active', 'trialing', 'past_due')
    RETURNING *
  `;

  if (rows.length === 0) return null;
  return rowToSubscription(rows[0]);
}

/**
 * Check if a user has an active subscription.
 */
export async function isSubscriptionActive(
  userId: string,
): Promise<boolean> {
  const sub = await getUserSubscription(userId);
  return sub !== null && (sub.status === "active" || sub.status === "trialing");
}

/**
 * Get a human-readable plan display name.
 */
export function getPlanDisplayName(plan: Plan | null): string {
  if (!plan) return "Free Trial";
  return plan === "monthly" ? "Pro Monthly" : "Pro Annual";
}
