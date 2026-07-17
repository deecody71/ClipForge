import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect } from "react";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

// ── Server Functions ──

const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email, name: payload.name };
});

const loadVideoAnalytics = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { jobId: string };
    return { jobId: d.jobId || "" };
  })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) return null;
    const payload = verifyToken(token)!;

    if (!data.jobId) return null;

    const { getVideoAnalytics, getVideoTrendData } =
      await import("~/services/analytics-service");

    const [vid, trend] = await Promise.all([
      getVideoAnalytics(data.jobId, payload.userId),
      getVideoTrendData(data.jobId, payload.userId, 30),
    ]);

    return { vid, trend };
  });

// ── Route ──

export const Route = createFileRoute("/dashboard/analytics/$jobId")({
  loader: () => getCurrentUser(),
  component: VideoDetailPage,
});

// ── Page ──

function VideoDetailPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const { jobId } = Route.useParams();
  const [data, setData] = useState<{
    vid: {
      jobId: string;
      projectName: string;
      totalViews: number;
      uniqueViewers: number;
      completionRate: number;
      avgWatchTime: number;
      clicks: number;
      shares: number;
      channelBreakdown: { channel: string; views: number; percentage: number }[];
    } | null;
    trend: { date: string; views: number; completions: number }[];
  } | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
      return;
    }
    loadVideoAnalytics({ data: { jobId } })
      .then((d) => setData(d as any))
      .catch(() => setData(null))
      .finally(() => setLoading(false));
  }, [user, navigate, jobId]);

  if (!user) return null;

  const vid = data?.vid;
  const trend = data?.trend ?? [];

  return (
    <div className="flex min-h-[calc(100dvh-65px)]">
      {/* Sidebar */}
      <aside className="hidden w-64 flex-shrink-0 border-r border-gray-200 bg-gray-50 p-6 dark:border-gray-800 dark:bg-gray-900/50 lg:flex lg:flex-col">
        <nav className="space-y-1">
          <SidebarItem href="/dashboard" label="Dashboard" icon={HomeIcon} />
          <SidebarItem href="/studio" label="Studio" icon={VideoIcon} />
          <SidebarItem href="/dashboard" label="My Videos" icon={FilmIcon} />
          <SidebarItem href="/dashboard/analytics" label="Analytics" icon={ChartIcon} active />
          <SidebarItem href="/distribution" label="Distribution" icon={ShareIcon} />
          <SidebarItem href="/dashboard" label="Settings" icon={GearIcon} />
        </nav>
        <div className="mt-auto">
          <Link
            to="/dashboard/analytics"
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-gray-600 hover:bg-gray-100 dark:text-gray-400 dark:hover:bg-gray-800"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5 3 12m0 0 7.5-7.5M3 12h18" />
            </svg>
            Back to Analytics
          </Link>
        </div>
      </aside>

      {/* Main */}
      <main className="flex-1 px-6 py-10 pb-24 lg:pb-10 overflow-x-auto">
        <div className="mx-auto max-w-5xl">
          {loading && (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
              <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-gray-300 border-t-indigo-600" />
              <p className="mt-4 text-sm text-gray-500">Loading analytics...</p>
            </div>
          )}

          {!loading && !vid && (
            <div className="rounded-xl border border-gray-200 bg-white p-12 text-center dark:border-gray-700 dark:bg-gray-800/50">
              <div className="text-4xl mb-3">🎬</div>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white">Video Not Found</h2>
              <p className="mt-1 text-sm text-gray-500">This video may not exist or you don't have access to it.</p>
              <Link
                to="/dashboard/analytics"
                className="mt-4 inline-flex items-center gap-2 text-sm font-medium text-indigo-600 hover:text-indigo-500"
              >
                ← Back to Analytics
              </Link>
            </div>
          )}

          {!loading && vid && (
            <>
              {/* Header */}
              <div className="flex items-center justify-between mb-8 flex-wrap gap-4">
                <div>
                  <Link
                    to="/dashboard/analytics"
                    className="text-sm text-indigo-600 hover:text-indigo-500 dark:text-indigo-400 mb-2 inline-block"
                  >
                    ← Back to Analytics
                  </Link>
                  <h1 className="text-3xl font-bold text-gray-900 dark:text-white">{vid.projectName}</h1>
                </div>
                <a
                  href={`/api/videos/${jobId}/output.mp4`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                >
                  <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M5.25 5.653c0-.856.917-1.398 1.667-.986l11.54 6.347a1.125 1.125 0 0 1 0 1.972l-11.54 6.347a1.125 1.125 0 0 1-1.667-.986V5.653Z" />
                  </svg>
                  Watch Video
                </a>
              </div>

              {/* Stats Cards */}
              <div className="grid gap-4 sm:grid-cols-3 lg:grid-cols-6 mb-8">
                <MiniStat label="Total Views" value={formatNumber(vid.totalViews)} />
                <MiniStat label="Unique Viewers" value={formatNumber(vid.uniqueViewers)} />
                <MiniStat label="Completion Rate" value={`${vid.completionRate}%`} />
                <MiniStat label="Avg Watch Time" value={`${vid.avgWatchTime}s`} />
                <MiniStat label="Clicks" value={formatNumber(vid.clicks)} />
                <MiniStat label="Shares" value={formatNumber(vid.shares)} />
              </div>

              {/* Trend Chart */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50 mb-8">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Daily Views (30 Days)</h2>
                {trend.length > 0 ? (
                  <TrendChart data={trend} />
                ) : (
                  <p className="py-12 text-center text-sm text-gray-500">No daily view data yet.</p>
                )}
              </div>

              {/* Channel Breakdown */}
              <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
                <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">Views by Channel</h2>
                {vid.channelBreakdown.length > 0 ? (
                  <ChannelBars channels={vid.channelBreakdown} />
                ) : (
                  <p className="py-12 text-center text-sm text-gray-500">No channel data yet.</p>
                )}
              </div>
            </>
          )}
        </div>
      </main>
    </div>
  );
}

// ── Helpers ──

function formatNumber(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + "M";
  if (n >= 1_000) return (n / 1_000).toFixed(1) + "K";
  return String(n);
}

function MiniStat({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-4 dark:border-gray-700 dark:bg-gray-800/50 text-center">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

// ── SVG Trend Chart ──

function TrendChart({ data }: { data: { date: string; views: number; completions: number }[] }) {
  const w = 600;
  const h = 220;
  const pad = { top: 20, right: 10, bottom: 30, left: 50 };
  const chartW = w - pad.left - pad.right;
  const chartH = h - pad.top - pad.bottom;

  const maxViews = Math.max(...data.map((d) => d.views), 1);
  const yMax = Math.ceil(maxViews * 1.1);

  const points = data.map((d, i) => {
    const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
    const y = pad.top + chartH - (d.views / yMax) * chartH;
    return `${x},${y}`;
  });

  const areaPath = points.length > 0
    ? `M${points[0]} ${points.map((p, i) => (i === 0 ? "" : `L${p}`)).join(" ")} L${pad.left + chartW},${pad.top + chartH} L${pad.left},${pad.top + chartH} Z`
    : "";

  const linePath = points.join(" ");
  const yTicks = 4;
  const xLabelInterval = Math.max(1, Math.floor(data.length / 7));

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="w-full h-auto" role="img" aria-label="Daily views trend">
      {Array.from({ length: yTicks + 1 }, (_, i) => {
        const y = pad.top + (chartH / yTicks) * i;
        const val = Math.round(yMax - (yMax / yTicks) * i);
        return (
          <g key={`grid-${i}`}>
            <line x1={pad.left} y1={y} x2={pad.left + chartW} y2={y} stroke="#e5e7eb" strokeWidth="0.5" />
            <text x={pad.left - 8} y={y + 4} textAnchor="end" className="text-[10px] fill-gray-400" fontFamily="system-ui">
              {val}
            </text>
          </g>
        );
      })}
      <path d={areaPath} fill="url(#viewGrad)" opacity="0.3" />
      <polyline points={linePath} fill="none" stroke="#6366f1" strokeWidth="2" strokeLinejoin="round" />
      {data.map((d, i) => {
        const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
        const y = pad.top + chartH - (d.views / yMax) * chartH;
        return <circle key={`dot-${i}`} cx={x} cy={y} r="3" fill="#6366f1" />;
      })}
      {data.map((d, i) => {
        if (i % xLabelInterval !== 0 && i !== data.length - 1) return null;
        const x = pad.left + (i / Math.max(data.length - 1, 1)) * chartW;
        return (
          <text key={`x-${i}`} x={x} y={pad.top + chartH + 18} textAnchor="middle" className="text-[9px] fill-gray-400" fontFamily="system-ui">
            {d.date.slice(5)}
          </text>
        );
      })}
      <defs>
        <linearGradient id="viewGrad" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#6366f1" />
          <stop offset="100%" stopColor="#6366f1" stopOpacity="0" />
        </linearGradient>
      </defs>
    </svg>
  );
}

// ── Channel Bars ──

function ChannelBars({ channels }: { channels: { channel: string; views: number; percentage: number }[] }) {
  const maxViews = Math.max(...channels.map((c) => c.views), 1);
  const colors: Record<string, string> = {
    instagram: "#E4405F",
    tiktok: "#000000",
    youtube: "#FF0000",
    facebook: "#1877F2",
    linkedin: "#0A66C2",
    x: "#1DA1F2",
    sms: "#22C55E",
    direct: "#6366F1",
  };

  return (
    <div className="space-y-3">
      {channels.map((ch) => (
        <div key={ch.channel} className="flex items-center gap-3">
          <span className="w-16 text-xs font-medium text-gray-600 dark:text-gray-400 capitalize">{ch.channel}</span>
          <div className="flex-1 h-6 bg-gray-100 dark:bg-gray-700 rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all duration-500"
              style={{
                width: `${Math.max((ch.views / maxViews) * 100, 2)}%`,
                backgroundColor: colors[ch.channel] ?? "#6366F1",
              }}
            />
          </div>
          <span className="w-14 text-right text-xs font-semibold text-gray-700 dark:text-gray-300">{formatNumber(ch.views)}</span>
          <span className="w-10 text-right text-xs text-gray-400">{ch.percentage}%</span>
        </div>
      ))}
    </div>
  );
}

// ── Sidebar ──

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

// ── Icons ──

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
