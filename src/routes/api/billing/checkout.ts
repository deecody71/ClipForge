import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

/**
 * POST /api/billing/checkout?plan=monthly|annual
 *
 * Creates a checkout session. Currently returns a mock checkout URL
 * pointing to the billing success page. When Stripe is connected,
 * this will create a real Stripe Checkout Session and redirect.
 */
const handleCheckout = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { plan?: string };
    const plan = d.plan;
    if (!plan || (plan !== "monthly" && plan !== "annual")) {
      throw new Error("Plan must be 'monthly' or 'annual'");
    }
    return { plan: plan as "monthly" | "annual" };
  })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized — please log in first.");
    }
    const payload = verifyToken(token)!;

    // Generate a mock checkout session ID
    const mockSessionId = `cs_mock_${Date.now()}_${Math.random().toString(36).slice(2, 10)}`;

    // Build a mock checkout URL that simulates a successful Stripe checkout
    const baseUrl =
      process.env.SITE_URL ||
      process.env.VERCEL_URL ||
      "http://localhost:3000";

    const successUrl = new URL("/dashboard/billing", baseUrl);
    successUrl.searchParams.set("success", "true");
    successUrl.searchParams.set("session_id", mockSessionId);
    successUrl.searchParams.set("plan", data.plan);

    return {
      checkoutUrl: successUrl.toString(),
      sessionId: mockSessionId,
      plan: data.plan,
      // In production with Stripe, this would be a Stripe Checkout URL
      mock: true,
    };
  });

export const Route = createFileRoute("/api/billing/checkout")({
  component: () => null,
});

export { handleCheckout };
