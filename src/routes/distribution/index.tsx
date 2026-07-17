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
  return { userId: payload.userId, email: payload.email, name: payload.name };
});

const getStats = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return { totalLists: 0, totalContacts: 0, totalCampaigns: 0, activeCampaigns: 0, messagesThisMonth: 0 };
  const payload = verifyToken(token)!;
  const { getDistributionStats } = await import("~/services/sms-service");
  return getDistributionStats(payload.userId);
});

const getRecentCampaigns = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token || !verifyToken(token)) return [];
  const payload = verifyToken(token)!;
  const { getUserCampaigns } = await import("~/services/sms-service");
  const campaigns = await getUserCampaigns(payload.userId);
  return campaigns.slice(0, 5);
});

export const Route = createFileRoute("/distribution/")({
  loader: () => getCurrentUser(),
  component: DistributionIndexPage,
});

function DistributionIndexPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const [stats, setStats] = useState({ totalLists: 0, totalContacts: 0, totalCampaigns: 0, activeCampaigns: 0, messagesThisMonth: 0 });
  const [recentCampaigns, setRecentCampaigns] = useState<Array<{ id: string; name: string; status: string; sent_count: number; delivered_count: number; created_at: string }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) { navigate({ to: "/login" }); return; }
    Promise.all([getStats(), getRecentCampaigns()]).then(([s, c]) => {
      setStats(s);
      setRecentCampaigns(c);
    }).finally(() => setLoading(false));
  }, [user, navigate]);

  if (!user) return null;

  return (
    <div className="min-h-[calc(100dvh-65px)] bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-6 py-10">
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900 dark:text-white">Distribution</h1>
            <p className="mt-1 text-gray-600 dark:text-gray-400">Manage your contacts and SMS campaigns</p>
          </div>
        </div>

        {/* Quick action cards */}
        <div className="grid gap-4 sm:grid-cols-2 mb-8">
          <Link
            to="/distribution/contacts"
            className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-green-100 dark:bg-green-900/30">
                <UsersIcon className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Contacts</p>
                <p className="text-sm text-gray-500">{stats.totalLists} lists · {stats.totalContacts} contacts</p>
              </div>
            </div>
          </Link>
          <Link
            to="/distribution/campaigns"
            className="rounded-xl border border-gray-200 bg-white p-6 transition-all hover:border-indigo-300 hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-indigo-100 dark:bg-indigo-900/30">
                <SendIcon className="h-5 w-5 text-indigo-600 dark:text-indigo-400" />
              </div>
              <div>
                <p className="font-semibold text-gray-900 dark:text-white">Campaigns</p>
                <p className="text-sm text-gray-500">{stats.totalCampaigns} total · {stats.activeCampaigns} active</p>
              </div>
            </div>
          </Link>
        </div>

        {/* Stats grid */}
        <div className="grid gap-4 sm:grid-cols-4 mb-8">
          <StatCard label="Contact Lists" value={String(stats.totalLists)} />
          <StatCard label="Total Contacts" value={String(stats.totalContacts)} />
          <StatCard label="Campaigns" value={String(stats.totalCampaigns)} />
          <StatCard label="Messages (MTD)" value={String(stats.messagesThisMonth)} />
        </div>

        {/* Recent campaigns */}
        <div className="rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-700 dark:bg-gray-800/50">
          <h2 className="text-lg font-bold text-gray-900 dark:text-white mb-4">Recent Campaigns</h2>
          {loading ? (
            <p className="text-sm text-gray-500">Loading...</p>
          ) : recentCampaigns.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-sm text-gray-500">No campaigns yet.</p>
              <Link to="/distribution/campaigns" className="mt-2 inline-block text-sm font-medium text-indigo-600 hover:underline">Create your first campaign</Link>
            </div>
          ) : (
            <div className="space-y-3">
              {recentCampaigns.map((c) => (
                <Link
                  key={c.id}
                  to="/distribution/campaigns"
                  className="flex items-center justify-between rounded-lg border border-gray-100 p-3 hover:border-indigo-200 dark:border-gray-700 dark:hover:border-indigo-700"
                >
                  <div>
                    <p className="text-sm font-medium text-gray-900 dark:text-white">{c.name}</p>
                    <p className="text-xs text-gray-500">{new Date(c.created_at).toLocaleDateString()}</p>
                  </div>
                  <div className="flex items-center gap-3">
                    <span className="text-xs text-gray-500">{c.delivered_count}/{c.sent_count} delivered</span>
                    <StatusBadge status={c.status} />
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-gray-200 bg-white p-5 dark:border-gray-700 dark:bg-gray-800/50">
      <p className="text-xs text-gray-500 dark:text-gray-400">{label}</p>
      <p className="mt-1 text-2xl font-bold text-gray-900 dark:text-white">{value}</p>
    </div>
  );
}

function StatusBadge({ status }: { status: string }) {
  const colors: Record<string, string> = {
    draft: "bg-gray-100 text-gray-700 dark:bg-gray-800 dark:text-gray-400",
    sending: "bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-400",
    completed: "bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-400",
    failed: "bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-400",
  };
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-xs font-semibold ${colors[status] || colors.draft}`}>
      {status}
    </span>
  );
}

function UsersIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 19.128a9.38 9.38 0 0 0 2.625.372 9.337 9.337 0 0 0 4.121-.952 4.125 4.125 0 0 0-7.533-2.493M15 19.128v-.003c0-1.113-.285-2.16-.786-3.07M15 19.128v.106A12.318 12.318 0 0 1 8.624 21c-2.331 0-4.512-.645-6.374-1.766l-.001-.109a6.375 6.375 0 0 1 11.964-3.07M12 6.375a3.375 3.375 0 1 1-6.75 0 3.375 3.375 0 0 1 6.75 0Zm8.25 2.25a2.625 2.625 0 1 1-5.25 0 2.625 2.625 0 0 1 5.25 0Z" />
    </svg>
  );
}

function SendIcon({ className }: { className?: string }) {
  return (
    <svg className={className} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
    </svg>
  );
}
