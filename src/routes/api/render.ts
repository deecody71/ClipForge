import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

const handleEnqueue = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { config?: unknown; projectName?: string };
    return {
      config: d.config,
      projectName: d.projectName,
    };
  })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized");
    }
    const payload = verifyToken(token)!;

    const { enqueueRender } = await import("~/services/render-queue");

    if (!data.config || typeof data.config !== "object") {
      throw new Error("Missing render config");
    }

    const job = await enqueueRender(
      payload.userId,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      data.config as any,
      data.projectName,
    );

    return {
      jobId: job.id,
      status: job.status,
      message: "Your commercial has been queued for rendering!",
    };
  });

const handleGetStatus = createServerFn({ method: "GET" })
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

    if (!data.jobId) {
      throw new Error("Missing jobId");
    }

    const { getJobStatus } = await import("~/services/render-queue");
    const job = await getJobStatus(data.jobId, payload.userId);

    if (!job) {
      return { error: "Job not found" };
    }

    return {
      jobId: job.id,
      status: job.status,
      progress: job.progress,
      outputUrl: job.output_url,
      errorMessage: job.error_message,
      projectName: job.project_name,
      createdAt: job.created_at,
    };
  });

export const Route = createFileRoute("/api/render")({
  component: ApiRenderRoute,
});

function ApiRenderRoute() {
  // This route is not intended to render a UI.
  // It exists solely to register /api/render as a valid route.
  // Client code should call handleEnqueue/handleGetStatus directly.
  return null;
}

// Re-export for programmatic use
export { handleEnqueue, handleGetStatus };
