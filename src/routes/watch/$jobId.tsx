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

const fetchJobInfo = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as { jobId: string };
    return { jobId: d.jobId || "" };
  })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized");
    }
    const payload = verifyToken(token)!;
    const { getJobStatus } = await import("~/services/render-queue");
    const job = await getJobStatus(data.jobId, payload.userId);
    if (!job) {
      return { found: false as const };
    }
    return {
      found: true as const,
      jobId: job.id,
      status: job.status,
      outputUrl: job.output_url,
      projectName: job.project_name,
      config: job.config,
      createdAt: job.created_at,
    };
  });

export const Route = createFileRoute("/watch/$jobId")({
  loader: () => getCurrentUser(),
  component: WatchPage,
});

interface JobInfo {
  found: boolean;
  jobId: string;
  status: string;
  outputUrl: string | null;
  projectName: string;
  config?: {
    actorName?: string;
    actorEmoji?: string;
    backgroundName?: string;
    tone?: string;
    script?: string;
  };
  createdAt: string;
}

function WatchPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const params = Route.useParams();
  const jobId = params.jobId as string;
  const [job, setJob] = useState<JobInfo | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;

    async function load() {
      try {
        const result = await fetchJobInfo({ data: { jobId } });
        if (cancelled) return;
        if (result.found) {
          setJob(result);
          setError(null);
          if (result.status !== "completed") {
            // If not completed, redirect to rendering status page
            navigate({ to: "/rendering/$jobId", params: { jobId } });
          }
        } else {
          setError("Commercial not found");
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load commercial");
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    load();
    return () => { cancelled = true; };
  }, [jobId, user, navigate]);

  if (loading) {
    return (
      <div className="flex min-h-[80dvh] items-center justify-center">
        <Spinner large />
      </div>
    );
  }

  if (error || !job) {
    return (
      <div className="flex min-h-[80dvh] items-center justify-center">
        <div className="text-center">
          <div className="text-5xl mb-4">😕</div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            {error || "Commercial not found"}
          </h1>
          <p className="mt-2 text-gray-500">
            The commercial you're looking for doesn't exist or you don't have access.
          </p>
          <Link
            to="/dashboard"
            className="mt-6 inline-flex items-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[80dvh] bg-gray-50 dark:bg-gray-950">
      <div className="mx-auto max-w-5xl px-6 py-8">
        {/* Header */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              to="/dashboard"
              className="mb-2 inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700 dark:text-gray-400 dark:hover:text-gray-200"
            >
              <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
              </svg>
              Back to Dashboard
            </Link>
            <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
              {job.projectName}
            </h1>
            <p className="mt-1 text-sm text-gray-500">
              Created {new Date(job.createdAt).toLocaleDateString()}
            </p>
          </div>
          <div className="flex items-center gap-3">
            <span className="inline-flex items-center gap-1.5 rounded-full bg-green-100 px-3 py-1 text-xs font-medium text-green-700 dark:bg-green-900/30 dark:text-green-400">
              <span className="h-1.5 w-1.5 rounded-full bg-green-500" />
              Complete
            </span>
          </div>
        </div>

        {/* Video Player */}
        <div className="overflow-hidden rounded-2xl border border-gray-200 bg-black shadow-lg dark:border-gray-800">
          <div className="relative aspect-video w-full">
            {/* Placeholder — real video rendering is not yet implemented */}
            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gradient-to-br from-gray-900 via-gray-800 to-gray-900">
              {/* Decorative film elements */}
              <div className="mb-6 text-6xl">
                {job.config?.actorEmoji || "🎬"}
              </div>
              <h2 className="text-xl font-bold text-white">{job.projectName}</h2>
              <p className="mt-1 text-sm text-gray-400">
                AI-Generated Commercial
              </p>
              <div className="mt-6 flex items-center gap-4 text-gray-500">
                {job.config?.actorName && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs">
                    <span>🎭</span> {job.config.actorName}
                  </span>
                )}
                {job.config?.backgroundName && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs">
                    <span>🖼️</span> {job.config.backgroundName}
                  </span>
                )}
                {job.config?.tone && (
                  <span className="inline-flex items-center gap-1.5 rounded-lg bg-gray-800 px-3 py-1.5 text-xs">
                    <span>🎵</span> {job.config.tone}
                  </span>
                )}
              </div>
              <div className="mt-8 rounded-xl border border-gray-700 bg-gray-800/50 px-6 py-4 text-center">
                <p className="text-sm font-medium text-indigo-300">
                  🚀 Full video rendering is coming soon
                </p>
                <p className="mt-1 text-xs text-gray-500">
                  The AI rendering pipeline is being connected. Your commercial will play here once rendering is live.
                </p>
              </div>
            </div>
          </div>

          {/* Player Controls (mock) */}
          <div className="flex items-center gap-4 border-t border-gray-800 bg-gray-900 px-6 py-4">
            <button
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              title="Play (coming soon)"
            >
              <svg className="h-5 w-5" fill="currentColor" viewBox="0 0 24 24">
                <path d="M8 5v14l11-7z" />
              </svg>
            </button>
            <div className="h-1 flex-1 rounded-full bg-gray-700">
              <div className="h-1 w-0 rounded-full bg-indigo-500" />
            </div>
            <span className="text-xs text-gray-500 tabular-nums">0:00 / 2:00</span>
            <button
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              title="Volume"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M19.114 5.636a9 9 0 0 1 0 12.728M16.463 8.288a5.25 5.25 0 0 1 0 7.424M6.75 8.25l4.72-4.72a.75.75 0 0 1 1.28.53v15.88a.75.75 0 0 1-1.28.53l-4.72-4.72H4.51c-.88 0-1.704-.507-1.938-1.354A9.009 9.009 0 0 1 2.25 12c0-.83.112-1.633.322-2.396C2.806 8.756 3.63 8.25 4.51 8.25H6.75Z" />
              </svg>
            </button>
            <button
              className="rounded-lg p-2 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
              title="Fullscreen"
            >
              <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 8.25M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15.75M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 8.25m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15.75" />
              </svg>
            </button>
          </div>
        </div>

        {/* Script Preview */}
        {job.config?.script && (
          <div className="mt-6 rounded-xl border border-gray-200 bg-white p-6 dark:border-gray-800 dark:bg-gray-900">
            <h3 className="text-sm font-semibold text-gray-900 dark:text-white">Script</h3>
            <p className="mt-2 whitespace-pre-wrap text-sm leading-relaxed text-gray-600 dark:text-gray-400">
              {job.config.script}
            </p>
          </div>
        )}

        {/* Actions */}
        <div className="mt-8 flex flex-col gap-3 sm:flex-row sm:justify-center">
          <Link
            to="/dashboard"
            className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-300 px-6 py-3 text-sm font-semibold text-gray-700 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800 transition-colors"
          >
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  );
}

function Spinner({ large }: { large?: boolean }) {
  const size = large ? "h-8 w-8" : "h-4 w-4";
  return (
    <svg className={`${size} animate-spin`} viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
    </svg>
  );
}
