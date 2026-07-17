import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;

  // Load subscription plan badge
  let planBadge = "Free Trial";
  try {
    const { getUserSubscription, getPlanDisplayName: planName } = await import(
      "~/services/subscription-service"
    );
    const sub = await getUserSubscription(payload.userId);
    if (sub && (sub.status === "active" || sub.status === "trialing")) {
      planBadge = planName(sub.plan);
    }
  } catch {
    // Ignore — defaults to Free Trial
  }

  return {
    userId: payload.userId,
    email: payload.email,
    name: payload.name,
    planBadge,
  };
});

const getRecentRenders = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return [];
  const payload = verifyToken(token)!;

  const { getUserJobs } = await import("~/services/render-queue");
  const jobs = await getUserJobs(payload.userId, 5);

  return jobs.map((j) => ({
    id: j.id,
    projectName: j.project_name,
    status: j.status,
    progress: j.progress,
    outputUrl: j.output_url,
    createdAt: j.created_at,
  }));
});

const getDashboardStats = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return { totalViews: 0, completionRate: 0, totalClicks: 0, videosPublished: 0 };
  const payload = verifyToken(token)!;

  try {
    const { getDashboardAnalytics } =
      await import("~/services/analytics-service");
    const { seedAnalyticsData } = await import("~/services/analytics-seed");

    // Auto-seed if needed
    const { seeded } = await seedAnalyticsData(payload.userId);
    if (seeded > 0) {
      console.log(`[dashboard] Seeded ${seeded} mock analytics events`);
    }

    const dash = await getDashboardAnalytics(payload.userId);
    return {
      totalViews: dash.totalViews,
      completionRate: dash.completionRate,
      totalClicks: dash.totalClicks,
      videosPublished: dash.videosPublished,
    };
  } catch {
    return { totalViews: 0, completionRate: 0, totalClicks: 0, videosPublished: 0 };
  }
});

const logoutUser = createServerFn({ method: "POST" }).handler(async () => {
  const { deleteCookie } = await import("@tanstack/react-start/server");
  try {
    deleteCookie(TOKEN_COOKIE, {
      path: "/",
      httpOnly: true,
      secure: true,
      sameSite: "lax",
    });
  } catch {
    // Ignore errors if not in request context
  }
  return { success: true };
});

export const Route = createFileRoute("/dashboard")({
  loader: () => getCurrentUser(),
  component: DashboardPage,
});

function DashboardPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const [loggingOut, setLoggingOut] = useState(false);
  const [recentRenders, setRecentRenders] = useState<
    { id: string; projectName: string; status: string; progress: number; outputUrl: string | null; createdAt: string }[]
  >([]);
  const [rendersLoading, setRendersLoading] = useState(true);
  const [dashStats, setDashStats] = useState<{
      totalViews: number;
      completionRate: number;
      totalClicks: number;
      videosPublished: number;
    }>({ totalViews: 0, completionRate: 0, totalClicks: 0, videosPublished: 0 });
    const planBadge = user?.planBadge ?? "Free Trial";

    useEffect(() => {
      if (!user) {
        navigate({ to: "/login" });
      }
    }, [user, navigate]);

    // Load recent renders and dashboard stats
    useEffect(() => {
      if (!user) return;
      Promise.all([
        getRecentRenders(),
        getDashboardStats(),
      ])
        .then(([renders, stats]) => {
          setRecentRenders(renders);
          setDashStats(stats);
        })
        .catch(() => {
          setRecentRenders([]);
        })
        .finally(() => setRendersLoading(false));
    }, [user]);

  const handleLogout = async () => {
    setLoggingOut(true);
    try {
      await logoutUser();
      navigate({ to: "/" });
    } catch {
      setLoggingOut(false);
    }
  };

  if (!user) {
    return null;
  }

  return (
    <div className="flex min-h-[calc(100dvh-65px)]">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50 lg:flex lg:flex-col">
        <nav className="space-y-1">
          <SidebarItem href="/dashboard" label="Dashboard" icon={HomeIcon} active />
          <SidebarItem href="/studio" label="Studio" icon={VideoIcon} />
          <SidebarItem href="/dashboard" label="My Videos" icon={FilmIcon} />
          <SidebarItem href="/dashboard/analytics" label="Analytics" icon={ChartIcon} />
          <SidebarItem href="/distribution" label="Distribution" icon={ShareIcon} />
          <SidebarItem href="/dashboard/billing" label="Billing" icon={CreditCardIcon} />
          <SidebarItem href="/dashboard" label="Settings" icon={GearIcon} />
        </nav>

        <div className="mt-auto space-y-4 pt-8">
          <div className="rounded-lg bg-indigo-50 p-4 dark:bg-indigo-950/30">
            <p className="text-xs font-semibold text-indigo-700 dark:text-indigo-300">Your Plan</p>
            <p className="mt-1 text-2xl font-bold text-indigo-600 dark:text-indigo-400">{planBadge}</p>
            <p className="mt-1 text-xs text-gray-600 dark:text-gray-400">
              {planBadge === "Free Trial"
                ? "Upgrade to unlock unlimited videos"
                : "Manage your subscription"}
            </p>
            <Link
              to={planBadge === "Free Trial" ? "/dashboard/billing" : "/dashboard/billing"}
              className="mt-3 block rounded-lg bg-indigo-600 px-3 py-2 text-center text-xs font-semibold text-white hover:bg-indigo-700"
            >
              {planBadge === "Free Trial" ? "View plans" : "Manage billing"}
            </Link>
          </div>

          <button
            onClick={handleLogout}
            disabled={loggingOut}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 transition-colors hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800 disabled:opacity-50"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
            </svg>
            {loggingOut ? "Logging out..." : "Log out"}
          </button>
        </div>
      </aside>

      {/* Mobile bottom nav */}
      <nav className="fixed bottom-0 left-0 right-0 z-50 flex items-center justify-around border-t border-gray-200 bg-white px-2 py-3 dark:border-gray-800 dark:bg-gray-950 lg:hidden">
        <MobileNavItem label="Home" icon={HomeIcon} active />
        <MobileNavItem label="Studio" icon={VideoIcon} href="/studio" />
        <MobileNavItem label="Videos" icon={FilmIcon} />
        <MobileNavItem label="More" icon={DotsIcon} />
      </nav>

      {/* Main content */}
      <main className="flex-1 px-6 py-10 pb-24 lg:pb-10">
        <div className="mx-auto max-w-4xl">
          <h1 className="text-3xl font-bold text-gray-900 dark:text-white">
            Welcome back, {user.name}
          </h1>
          <p className="mt-2 text-lg text-gray-600 dark:text-gray-400">
            Your AI-powered video creation studio is ready. Start by creating your first commercial.
          </p>

          <div className="mt-10 rounded-2xl border border-gray-200 bg-white p-8 dark:border-gray-700 dark:bg-gray-800/50">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-100 dark:bg-indigo-900/30">
                <VideoIcon className="h-7 w-7 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
                  Create your first commercial
                </h2>
                <p className="mt-1 text-sm text-gray-600 dark:text-gray-400">
                  Pick an AI actor, get a script, choose a background, and publish — all in under 5 minutes.
                </p>
              </div>
            </div>
            <Link
              to="/studio"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white transition-all hover:bg-indigo-700"
            >
              Launch Studio
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="m13.5 4.5 6 6m0 0-6 6m6-6H4.5" />
              </svg>
            </Link>
          </div>

          <div className="mt-8 grid gap-6 sm:grid-cols-3">
            <StatCard label="Videos Created" value={String(dashStats.videosPublished)} />
            <StatCard label="Total Views" value={formatNumber(dashStats.totalViews)} />
            <StatCard label="Avg. Completion" value={`${dashStats.completionRate}%`} />
          </div>

          {/* Recent Renders */}
          <div className="mt-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900 dark:text-white">Recent Renders</h2>
              <Link
                to="/studio"
                className="text-sm font-medium text-indigo-600 hover:text-indigo-500 dark:text-indigo-400"
              >
                + New Commercial
              </Link>
            </div>

            {rendersLoading && (
              <div className="rounded-xl border border-gray-200 bg-white p-8 text-center dark:border-gray-700 dark:bg-gray-800/50">
                <p className="text-sm text-gray-500">Loading recent renders...</p>
              </div>
            )}

            {!rendersLoading && recentRenders.length === 0 && (
              <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center dark:border-gray-600 dark:bg-gray-800/50">
                <div className="text-4xl mb-3">🎬</div>
                <p className="text-sm font-medium text-gray-600 dark:text-gray-400">
                  No renders yet
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  Create your first commercial in the Studio to see it here.
                </p>
                <Link
                  to="/studio"
                  className="mt-4 inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  Go to Studio
                </Link>
              </div>
            )}

            {!rendersLoading && recentRenders.length > 0 && (
              <div className="space-y-3">
                {recentRenders.map((job) => (
                  <Link
                    key={job.id}
                    to="/rendering/$jobId"
                    params={{ jobId: job.id }}
                    className="flex items-center gap-4 rounded-xl border border-gray-200 bg-white p-4 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50 dark:hover:border-indigo-700"
                  >
                    <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                      <FilmIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900 truncate dark:text-white">
                        {job.projectName}
                      </p>
                      <p className="text-xs text-gray-500">
                        {new Date(job.createdAt).toLocaleDateString()}
                      </p>
                    </div>
                    <StatusBadge status={job.status} progress={job.progress} />
                    <svg
                      className="h-4 w-4 flex-shrink-0 text-gray-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                      strokeWidth={2}
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" d="m8.25 4.5 7.5 7.5-7.5 7.5" />
                    </svg>
                  </Link>
                ))}
              </div>
            )}
          </div>

          <div className="mt-8 lg:hidden">
            <button
              onClick={handleLogout}
              disabled={loggingOut}
              className="flex w-full items-center justify-center gap-2 rounded-lg border border-gray-300 px-4 py-3 text-sm font-medium text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 disabled:opacity-50"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0 0 13.5 3h-6a2.25 2.25 0 0 0-2.25 2.25v13.5A2.25 2.25 0 0 0 7.5 21h6a2.25 2.25 0 0 0 2.25-2.25V15m3 0 3-3m0 0-3-3m3 3H9" />
              </svg>
              {loggingOut ? "Logging out..." : "Log out"}
            </button>
          </div>
        </div>
      </main>
    </div>
  );
}

function StatusBadge({ status, progress }: { status: string; progress: number }) {
  const colors: Record<string, string> = {
    queued: "bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-400",
    processing: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  const labels: Record<string, string> = {
    queued: "Queued",
    processing: `Rendering ${progress}%`,
    completed: "Complete",
    failed: "Failed",
  };

  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${
        colors[status] || "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400"
      }`}
    >
      {labels[status] || status}
    </span>
  );
}

function SidebarItem({
  href,
  label,
  icon: Icon,
  active,
}: {
  href: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
}) {
  return (
    <a
      href={href}
      className={`flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
        active
          ? "bg-indigo-50 text-indigo-700 dark:bg-indigo-950/50 dark:text-indigo-300"
          : "text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
      }`}
    >
      <Icon className="h-5 w-5" />
      {label}
    </a>
  );
}

function MobileNavItem({
  label,
  icon: Icon,
  active,
  href,
}: {
  label: string;
  icon: React.ComponentType<{ className?: string }>;
  active?: boolean;
  href?: string;
}) {
  const cls = `flex flex-col items-center gap-1 text-xs font-medium ${
    active ? "text-indigo-600 dark:text-indigo-400" : "text-gray-500 dark:text-gray-500"
  }`;
  if (href) {
    return (
      <Link to={href} className={cls}>
        <Icon className="h-5 w-5" />
        {label}
      </Link>
    );
  }
  return (
    <button className={cls}>
      <Icon className="h-5 w-5" />
      {label}
    </button>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
      <p className="text-sm text-gray-600 dark:text-gray-400">{label}</p>
      <p className="mt-2 text-3xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function HomeIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 12 8.954-8.955a1.126 1.126 0 0 1 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  );
}

function VideoIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m15.75 10.5 4.72-4.72a.75.75 0 0 1 1.28.53v11.38a.75.75 0 0 1-1.28.53l-4.72-4.72M4.5 18.75h9.75a2.25 2.25 0 0 0 2.25-2.25V7.5a2.25 2.25 0 0 0-2.25-2.25H4.5A2.25 2.25 0 0 0 2.25 7.5v9a2.25 2.25 0 0 0 2.25 2.25Z" />
    </svg>
  );
}

function FilmIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.375 19.5 7.314-18m3.936 18 7.313-18M3.375 5.25c-.621 0-1.125.504-1.125 1.125v2.25c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-2.25c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  );
}

function ChartIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 0 1 3 19.875v-6.75ZM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V8.625ZM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 0 1-1.125-1.125V4.125Z" />
    </svg>
  );
}

function ShareIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 1 0 0 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186 9.566-5.314m-9.566 7.5 9.566 5.314m0 0a2.25 2.25 0 1 0 3.935 2.186 2.25 2.25 0 0 0-3.935-2.186Zm0-12.814a2.25 2.25 0 1 0 3.933-2.185 2.25 2.25 0 0 0-3.933 2.185Z" />
    </svg>
  );
}

function GearIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.325.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 0 1 1.37.49l1.296 2.247a1.125 1.125 0 0 1-.26 1.431l-1.003.827c-.293.241-.438.613-.43.992a7.723 7.723 0 0 1 0 .255c-.008.378.137.75.43.991l1.004.827c.424.35.534.955.26 1.43l-1.298 2.247a1.125 1.125 0 0 1-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.47 6.47 0 0 1-.22.128c-.331.183-.581.495-.644.869l-.213 1.281c-.09.543-.56.94-1.11.94h-2.594c-.55 0-1.019-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 0 1-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 0 1-1.369-.49l-1.297-2.247a1.125 1.125 0 0 1 .26-1.431l1.004-.827c.292-.24.437-.613.43-.991a6.932 6.932 0 0 1 0-.255c.007-.38-.138-.751-.43-.992l-1.004-.827a1.125 1.125 0 0 1-.26-1.43l1.297-2.247a1.125 1.125 0 0 1 1.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.086.22-.128.332-.183.582-.495.644-.869l.214-1.28Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 1 1-6 0 3 3 0 0 1 6 0Z" />
    </svg>
  );
}

function DotsIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM12.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0ZM18.75 12a.75.75 0 1 1-1.5 0 .75.75 0 0 1 1.5 0Z" />
    </svg>
  );
}

function CreditCardIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 0 0 2.25-2.25V6.75A2.25 2.25 0 0 0 19.5 4.5h-15a2.25 2.25 0 0 0-2.25 2.25v10.5A2.25 2.25 0 0 0 4.5 19.5Z" />
    </svg>
  );
}
