import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useRef } from "react";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email, name: payload.name };
});

const fetchJobStatus = createServerFn({ method: "GET" })
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
      progress: job.progress,
      outputUrl: job.output_url,
      errorMessage: job.error_message,
      projectName: job.project_name,
      createdAt: job.created_at,
    };
  });

export const Route = createFileRoute("/rendering/$jobId")({
  loader: () => getCurrentUser(),
  component: RenderStatusPage,
});

interface JobStatusData {
  found: boolean;
  jobId: string;
  status: string;
  progress: number;
  outputUrl: string | null;
  errorMessage: string | null;
  projectName: string;
  createdAt: string;
}

function RenderStatusPage() {
  const user = Route.useLoaderData();
  const navigate = useNavigate();
  const params = Route.useParams();
  const jobId = params.jobId as string;

  const [jobStatus, setJobStatus] = useState<JobStatusData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setInterval> | null>(null);

  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  useEffect(() => {
    let cancelled = false;
    let complete = false;
    if (!user) return;

    const poll = async () => {
      if (cancelled || complete) return;
      try {
        const result = await fetchJobStatus({ data: { jobId } });
        if (cancelled) return;
        if (result.found) {
          setJobStatus(result);
          setError(null);
          if (result.status === "completed" || result.status === "failed") {
            complete = true;
          }
        } else {
          setError("Job not found");
        }
      } catch (err) {
        if (!cancelled) {
          setError("Failed to load job status");
          console.error(err);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    poll();

    pollRef.current = setInterval(() => {
      poll();
    }, 2000);

    return () => {
      cancelled = true;
      if (pollRef.current) {
        clearInterval(pollRef.current);
        pollRef.current = null;
      }
    };
  }, [jobId, user]);

  if (!user) return null;

  return (
    <div className="flex min-h-[calc(100dvh-65px)] items-center justify-center bg-gray-950 px-4">
      <div className="w-full max-w-lg">
        <Link
          to="/dashboard"
          className="mb-6 inline-flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-300 transition-colors"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5 8.25 12l7.5-7.5" />
          </svg>
          Back to Dashboard
        </Link>

        {loading && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8 text-center">
            <Spinner large />
            <p className="mt-4 text-gray-400">Loading job status...</p>
          </div>
        )}

        {error && !loading && (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-8 text-center">
            <div className="text-4xl mb-3">⚠️</div>
            <h2 className="text-xl font-bold text-red-300">Error</h2>
            <p className="mt-2 text-red-400">{error}</p>
            <Link
              to="/dashboard"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-gray-700 px-5 py-2.5 text-sm font-semibold text-white hover:bg-gray-600 transition-colors"
            >
              Return to Dashboard
            </Link>
          </div>
        )}

        {jobStatus && !loading && !error && (
          <div className="rounded-2xl border border-gray-800 bg-gray-900 p-8">
            <div className="flex items-center gap-4 mb-6">
              <div className="flex h-14 w-14 items-center justify-center rounded-xl bg-indigo-500/10">
                <FilmIcon />
              </div>
              <div>
                <h1 className="text-xl font-bold text-white">{jobStatus.projectName}</h1>
                <p className="text-sm text-gray-500">Job ID: {jobStatus.jobId.slice(0, 8)}...</p>
              </div>
            </div>

            <div className="mb-6">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-medium text-gray-400">
                  {statusLabel(jobStatus.status)}
                </span>
                <span className="text-sm font-bold text-indigo-400">{jobStatus.progress}%</span>
              </div>
              <div className="h-3 w-full overflow-hidden rounded-full bg-gray-800">
                <div
                  className={`h-full rounded-full transition-all duration-700 ease-out ${
                    jobStatus.status === "failed"
                      ? "bg-red-500"
                      : jobStatus.status === "completed"
                        ? "bg-green-500"
                        : "bg-gradient-to-r from-indigo-500 to-purple-500"
                  }`}
                  style={{ width: `${jobStatus.progress}%` }}
                />
              </div>
            </div>

            {jobStatus.status === "queued" && (
              <div className="rounded-xl border border-gray-700 bg-gray-800/50 p-4 text-center">
                <div className="text-3xl mb-2">⏳</div>
                <p className="text-sm text-gray-400">Your commercial is in the queue. Rendering will start shortly.</p>
              </div>
            )}

            {jobStatus.status === "processing" && (
              <div className="rounded-xl border border-indigo-500/20 bg-indigo-500/5 p-4 text-center">
                <div className="mb-3 flex justify-center">
                  <Spinner large />
                </div>
                <p className="text-sm text-indigo-300">Rendering your commercial...</p>
                <p className="mt-1 text-xs text-gray-500">This usually takes 2-5 minutes</p>
              </div>
            )}

            {jobStatus.status === "completed" && (
              <div className="rounded-xl border border-green-500/20 bg-green-500/5 p-6 text-center">
                <div className="text-5xl mb-3">🎉</div>
                <h2 className="text-lg font-bold text-green-300">Render Complete!</h2>
                <p className="mt-1 text-sm text-gray-400">Your commercial is ready to watch and share.</p>
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <a
                    href={jobStatus.outputUrl || "#"}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                  >
                    <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.91 11.672a.375.375 0 0 1 0 .656l-5.603 3.113a.375.375 0 0 1-.557-.328V8.887c0-.286.307-.466.557-.327l5.603 3.112Z" />
                    </svg>
                    Watch Your Commercial
                  </a>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Back to Dashboard
                  </Link>
                </div>
                <p className="mt-4 text-xs text-gray-600">
                  Note: Video delivery will be connected in the next phase. The output URL pattern is ready.
                </p>
              </div>
            )}

            {jobStatus.status === "failed" && (
              <div className="rounded-xl border border-red-500/20 bg-red-500/5 p-6 text-center">
                <div className="text-5xl mb-3">😞</div>
                <h2 className="text-lg font-bold text-red-300">Render Failed</h2>
                {jobStatus.errorMessage && (
                  <p className="mt-2 text-sm text-red-400">{jobStatus.errorMessage}</p>
                )}
                <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:justify-center">
                  <Link
                    to="/studio"
                    className="inline-flex items-center justify-center gap-2 rounded-xl bg-indigo-600 px-6 py-3 text-sm font-semibold text-white hover:bg-indigo-700 transition-colors"
                  >
                    Try Again
                  </Link>
                  <Link
                    to="/dashboard"
                    className="inline-flex items-center justify-center gap-2 rounded-xl border border-gray-600 px-6 py-3 text-sm font-semibold text-gray-300 hover:bg-gray-800 transition-colors"
                  >
                    Back to Dashboard
                  </Link>
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

function statusLabel(status: string): string {
  switch (status) {
    case "queued": return "Queued";
    case "processing": return "Rendering...";
    case "completed": return "Complete";
    case "failed": return "Failed";
    default: return status;
  }
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

function FilmIcon() {
  return (
    <svg className="h-7 w-7 text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m3.375 19.5 7.314-18m3.936 18 7.313-18M3.375 5.25c-.621 0-1.125.504-1.125 1.125v2.25c0 .621.504 1.125 1.125 1.125h17.25c.621 0 1.125-.504 1.125-1.125v-2.25c0-.621-.504-1.125-1.125-1.125H3.375Z" />
    </svg>
  );
}
