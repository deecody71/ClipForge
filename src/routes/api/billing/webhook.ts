import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

/**
 * POST /api/billing/webhook
 *
 * Simulates Stripe webhook events for the MVP.
 * Accepts a mock payload with session ID, plan, and user info.
 * Creates/updates the subscription record in the database.
 *
 * When real Stripe is connected, this will verify Stripe signatures
 * and handle real checkout.session.completed events.
 */
const handleWebhook = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as {
      sessionId?: string;
      plan?: string;
    };
    if (!d.sessionId) {
      throw new Error("Missing sessionId");
    }
    if (!d.plan || (d.plan !== "monthly" && d.plan !== "annual")) {
      throw new Error("Missing or invalid plan");
    }
    return {
      sessionId: d.sessionId,
      plan: d.plan as "monthly" | "annual",
    };
  })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized");
    }
    const payload = verifyToken(token)!;

    const {
      createOrUpdateSubscription,
    } = await import("~/services/subscription-service");

    const sub = await createOrUpdateSubscription(
      payload.userId,
      data.plan,
      "active",
      data.sessionId,
    );

    return {
      success: true,
      subscription: {
        id: sub.id,
        plan: sub.plan,
        status: sub.status,
        currentPeriodEnd: sub.currentPeriodEnd,
      },
    };
  });

export const Route = createFileRoute("/api/billing/webhook")({
  component: () => null,
});

export { handleWebhook };
