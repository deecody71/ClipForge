import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback } from "react";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email, name: payload.name };
});

const getSubscription = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return null;
  const payload = verifyToken(token)!;

  const { getUserSubscription } = await import(
    "~/services/subscription-service"
  );
  const sub = await getUserSubscription(payload.userId);
  if (!sub) return null;
  return {
    id: sub.id,
    plan: sub.plan,
    status: sub.status,
    currentPeriodStart: sub.currentPeriodStart,
    currentPeriodEnd: sub.currentPeriodEnd,
    canceledAt: sub.canceledAt,
    createdAt: sub.createdAt,
  };
});

const cancelSub = createServerFn({ method: "POST" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) {
    throw new Error("Unauthorized");
  }
  const payload = verifyToken(token)!;

  const { cancelSubscription } = await import(
    "~/services/subscription-service"
  );
  const sub = await cancelSubscription(payload.userId);
  if (!sub) {
    throw new Error("No active subscription to cancel.");
  }
  return {
    success: true,
    status: sub.status,
    canceledAt: sub.canceledAt,
  };
});

export const Route = createFileRoute("/dashboard/billing")({
  loader: () => getCurrentUser(),
  component: BillingPage,
});

function BillingPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const [subscription, setSubscription] = useState<{
    id: string;
    plan: string;
    status: string;
    currentPeriodStart: string | null;
    currentPeriodEnd: string | null;
    canceledAt: string | null;
    createdAt: string;
  } | null>(null);
  const [loading, setLoading] = useState(true);
  const [canceling, setCanceling] = useState(false);
  const [message, setMessage] = useState("");
  const [messageType, setMessageType] = useState<"success" | "error">(
    "success",
  );

  // Redirect if not logged in
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  // Load subscription data
  useEffect(() => {
    if (!user) return;
    getSubscription()
      .then(setSubscription)
      .catch(() => setSubscription(null))
      .finally(() => setLoading(false));
  }, [user]);

  // Handle success redirect from checkout
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const success = params.get("success");
    const sessionId = params.get("session_id");
    const plan = params.get("plan");

    if (success === "true" && sessionId && plan && user) {
      // Clean URL
      const url = new URL(window.location.href);
      url.searchParams.delete("success");
      url.searchParams.delete("session_id");
      url.searchParams.delete("plan");
      window.history.replaceState({}, "", url.toString());

      // Process the checkout success via webhook
      import("~/routes/api/billing/webhook")
        .then(({ handleWebhook }) =>
          handleWebhook({ data: { sessionId, plan } }),
        )
        .then(() => {
          setMessage("Subscription activated! Welcome to ClipForge Pro.");
          setMessageType("success");
          // Reload subscription data
          return getSubscription();
        })
        .then((sub) => {
          if (sub) setSubscription(sub);
        })
        .catch((err: Error) => {
          setMessage(err.message || "Failed to activate subscription.");
          setMessageType("error");
        });
    }
  }, [user]);

  const handleCancel = useCallback(async () => {
    if (!confirm("Are you sure you want to cancel your subscription? You will still have access until the end of your billing period.")) {
      return;
    }
    setCanceling(true);
    setMessage("");
    try {
      const result = await cancelSub();
      if (result.success) {
        setSubscription((prev) =>
          prev
            ? {
                ...prev,
                status: "canceled",
                canceledAt: result.canceledAt,
              }
            : prev,
        );
        setMessage("Subscription canceled. You'll have access until the end of your billing period.");
        setMessageType("success");
      }
    } catch (err) {
      setMessage(
        err instanceof Error ? err.message : "Failed to cancel subscription.",
      );
      setMessageType("error");
    } finally {
      setCanceling(false);
    }
  }, []);

  if (!user) return null;

  const hasActiveSub =
    subscription &&
    (subscription.status === "active" || subscription.status === "trialing");
  const isCanceled = subscription?.status === "canceled";

  return (
    <div className="mx-auto max-w-3xl px-6 py-10">
      <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
        Billing & Subscription
      </h1>
      <p className="mt-2 text-gray-600 dark:text-gray-400">
        Manage your plan, billing details, and subscription status.
      </p>

      {message && (
        <div
          className={`mt-6 rounded-lg px-4 py-3 text-sm font-medium ${
            messageType === "success"
              ? "bg-green-50 text-green-700 dark:bg-green-900/20 dark:text-green-400"
              : "bg-red-50 text-red-700 dark:bg-red-900/20 dark:text-red-400"
          }`}
        >
          {message}
        </div>
      )}

      {loading && (
        <div className="mt-10 text-center text-gray-500">
          Loading subscription info...
        </div>
      )}

      {!loading && !subscription && (
        <NoSubscriptionSection />
      )}

      {!loading && hasActiveSub && (
        <ActiveSubscriptionSection
          plan={subscription!.plan}
          currentPeriodEnd={subscription!.currentPeriodEnd}
          canceling={canceling}
          onCancel={handleCancel}
        />
      )}

      {!loading && isCanceled && (
        <CanceledSubscriptionSection
          plan={subscription!.plan}
          canceledAt={subscription!.canceledAt}
          currentPeriodEnd={subscription!.currentPeriodEnd}
        />
      )}

      {!loading && subscription?.status === "past_due" && (
        <PastDueSection />
      )}
    </div>
  );
}

function NoSubscriptionSection() {
  return (
    <div className="mt-10">
      <div className="rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800/50">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
            <svg
              className="h-6 w-6 text-indigo-600 dark:text-indigo-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 6v12m-3-2.818.879.659c1.171.879 3.07.879 4.242 0 1.172-.879 1.172-2.303 0-3.182C13.536 12.219 12.768 12 12 12c-.725 0-1.45-.22-2.003-.659-1.106-.879-1.106-2.303 0-3.182s2.9-.879 4.006 0l.415.33M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              Choose your plan
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Select the plan that fits your business and start creating
              professional video commercials today.
            </p>
          </div>
        </div>

        <div className="mt-8 grid gap-6 sm:grid-cols-2">
          {/* Monthly card */}
          <div className="rounded-xl border border-gray-200 bg-gray-50 p-6 dark:border-gray-600 dark:bg-gray-900/30">
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Monthly
            </h3>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                $20
              </span>
              <span className="text-gray-500">/month</span>
            </div>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <CheckIcon /> Unlimited commercials
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> AI actors & scripts
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> SMS distribution
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Analytics dashboard
              </li>
            </ul>
            <SubscribeButton plan="monthly" label="Subscribe Monthly" />
          </div>

          {/* Annual card */}
          <div className="relative rounded-xl border-2 border-indigo-600 bg-gray-50 p-6 dark:border-indigo-400 dark:bg-gray-900/30">
            <span className="absolute -top-3 right-4 rounded-full bg-indigo-600 px-3 py-0.5 text-xs font-bold text-white">
              Best value
            </span>
            <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
              Annual
            </h3>
            <div className="mt-3">
              <span className="text-3xl font-extrabold text-gray-900 dark:text-white">
                $200
              </span>
              <span className="text-gray-500">/year</span>
            </div>
            <p className="mt-1 text-xs text-indigo-600 dark:text-indigo-400">
              $16.67/month — save ~17%
            </p>
            <ul className="mt-4 space-y-2 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <CheckIcon /> Everything in Monthly
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Priority render queue
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Early access to features
              </li>
            </ul>
            <SubscribeButton plan="annual" label="Subscribe Annual" />
          </div>
        </div>
      </div>
    </div>
  );
}

function SubscribeButton({
  plan,
  label,
}: {
  plan: "monthly" | "annual";
  label: string;
}) {
  const [checkingOut, setCheckingOut] = useState(false);
  const [error, setError] = useState("");

  const handleSubscribe = async () => {
    setCheckingOut(true);
    setError("");
    try {
      const { handleCheckout } = await import(
        "~/routes/api/billing/checkout"
      );
      const result = await handleCheckout({ data: { plan } });
      // Redirect to the mock checkout/success URL
      window.location.href = result.checkoutUrl;
    } catch (err) {
      setError(
        err instanceof Error ? err.message : "Something went wrong.",
      );
      setCheckingOut(false);
    }
  };

  return (
    <div>
      <button
        onClick={handleSubscribe}
        disabled={checkingOut}
        className={`mt-6 w-full rounded-xl px-5 py-3 text-sm font-semibold transition-all disabled:opacity-50 ${
          plan === "annual"
            ? "bg-indigo-600 text-white hover:bg-indigo-700 shadow-md"
            : "border border-indigo-600 bg-white text-indigo-600 hover:bg-indigo-50 dark:border-indigo-400 dark:bg-transparent dark:text-indigo-400 dark:hover:bg-indigo-950"
        }`}
      >
        {checkingOut ? "Redirecting..." : label}
      </button>
      {error && (
        <p className="mt-2 text-xs text-red-600 dark:text-red-400">{error}</p>
      )}
    </div>
  );
}

function ActiveSubscriptionSection({
  plan,
  currentPeriodEnd,
  canceling,
  onCancel,
}: {
  plan: string;
  currentPeriodEnd: string | null;
  canceling: boolean;
  onCancel: () => void;
}) {
  const planLabel = plan === "annual" ? "Pro Annual" : "Pro Monthly";
  const nextBilling = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  return (
    <div className="mt-10 space-y-6">
      <div className="rounded-2xl border border-green-200 bg-green-50 p-8 dark:border-green-800 dark:bg-green-950/20">
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-full bg-green-100 dark:bg-green-900/30">
            <svg
              className="h-6 w-6 text-green-600 dark:text-green-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="m4.5 12.75 6 6 9-13.5"
              />
            </svg>
          </div>
          <div>
            <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
              {planLabel} — Active
            </h2>
            <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
              Your subscription is active. Enjoy unlimited commercials and all
              pro features.
            </p>
          </div>
        </div>

        <dl className="mt-6 grid gap-4 sm:grid-cols-2">
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Plan
            </dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {planLabel}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Next billing date
            </dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {nextBilling}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Price
            </dt>
            <dd className="mt-1 text-lg font-semibold text-gray-900 dark:text-white">
              {plan === "annual" ? "$200/year" : "$20/month"}
            </dd>
          </div>
          <div>
            <dt className="text-xs font-medium uppercase tracking-wide text-gray-500">
              Status
            </dt>
            <dd className="mt-1">
              <span className="inline-flex items-center rounded-full bg-green-100 px-2.5 py-0.5 text-sm font-semibold text-green-700 dark:bg-green-900/30 dark:text-green-400">
                Active
              </span>
            </dd>
          </div>
        </dl>
      </div>

      <div className="rounded-2xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
        <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
          Cancel subscription
        </h3>
        <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
          You'll still have access to all features until the end of your current
          billing period.
        </p>
        <button
          onClick={onCancel}
          disabled={canceling}
          className="mt-4 rounded-lg border border-red-300 px-4 py-2 text-sm font-semibold text-red-600 transition-colors hover:bg-red-50 disabled:opacity-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950/20"
        >
          {canceling ? "Canceling..." : "Cancel subscription"}
        </button>
      </div>
    </div>
  );
}

function CanceledSubscriptionSection({
  plan,
  canceledAt,
  currentPeriodEnd,
}: {
  plan: string;
  canceledAt: string | null;
  currentPeriodEnd: string | null;
}) {
  const planLabel = plan === "annual" ? "Pro Annual" : "Pro Monthly";
  const canceledDate = canceledAt
    ? new Date(canceledAt).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";
  const accessUntil = currentPeriodEnd
    ? new Date(currentPeriodEnd).toLocaleDateString("en-US", {
        year: "numeric",
        month: "long",
        day: "numeric",
      })
    : "N/A";

  return (
    <div className="mt-10 rounded-2xl border border-yellow-200 bg-yellow-50 p-8 dark:border-yellow-800 dark:bg-yellow-950/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-yellow-100 dark:bg-yellow-900/30">
          <svg
            className="h-6 w-6 text-yellow-600 dark:text-yellow-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1.5}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m-9.303 3.376c-.866 1.5.217 3.374 1.948 3.374h14.71c1.73 0 2.813-1.874 1.948-3.374L13.949 3.378c-.866-1.5-3.032-1.5-3.898 0L2.697 16.126ZM12 15.75h.007v.008H12v-.008Z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {planLabel} — Canceled
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Your subscription was canceled on {canceledDate}. You have access
            until {accessUntil}.
          </p>
        </div>
      </div>

      <div className="mt-6">
        <p className="text-sm text-gray-600 dark:text-gray-400">
          Want to come back?{" "}
          <a
            href="/dashboard/billing"
            className="font-medium text-indigo-600 hover:underline dark:text-indigo-400"
            onClick={(e) => {
              e.preventDefault();
              window.location.reload();
            }}
          >
            Refresh this page
          </a>{" "}
          to see available plans.
        </p>
      </div>
    </div>
  );
}

function PastDueSection() {
  return (
    <div className="mt-10 rounded-2xl border border-red-200 bg-red-50 p-8 dark:border-red-800 dark:bg-red-950/20">
      <div className="flex items-center gap-4">
        <div className="flex h-12 w-12 items-center justify-center rounded-full bg-red-100 dark:bg-red-900/30">
          <svg
            className="h-6 w-6 text-red-600 dark:text-red-400"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={2}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M12 9v3.75m9-.75a9 9 0 1 1-18 0 9 9 0 0 1 18 0Zm-9 3.75h.008v.008H12v-.008Z"
            />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            Payment past due
          </h2>
          <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
            Your payment is past due. Please update your billing information to
            restore access. (Stripe integration coming soon.)
          </p>
        </div>
      </div>
    </div>
  );
}

function CheckIcon() {
  return (
    <svg
      className="h-4 w-4 flex-shrink-0 text-indigo-600 dark:text-indigo-400"
      fill="none"
      viewBox="0 0 24 24"
      stroke="currentColor"
      strokeWidth={2}
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="m4.5 12.75 6 6 9-13.5"
      />
    </svg>
  );
}
