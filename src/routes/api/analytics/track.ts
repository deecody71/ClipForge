import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";

// 1x1 transparent GIF (minimal)
const PIXEL_BASE64 = "R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
const PIXEL_BUF = Buffer.from(PIXEL_BASE64, "base64");

const handleTrack = createServerFn({ method: "GET" })
  .validator((data: unknown) => {
    const d = data as {
      jobId?: string;
      channel?: string;
      event?: string;
      viewerId?: string;
      duration?: string;
    };
    return {
      jobId: d.jobId || "",
      channel: d.channel || "direct",
      event: d.event || "view",
      viewerId: d.viewerId || "",
      duration: d.duration || "0",
    };
  })
  .handler(async ({ data }) => {
    const { trackEvent } = await import("~/services/analytics-service");

    const validEvents = ["view", "completion", "click", "share"] as const;
    const validChannels = ["instagram", "tiktok", "youtube", "facebook", "linkedin", "x", "sms", "direct"] as const;

    const eventType = validEvents.includes(data.event as any) ? data.event : "view";
    const channel = validChannels.includes(data.channel as any) ? data.channel : "direct";
    const watchDuration = parseInt(data.duration, 10) || undefined;

    // For tracking pixel, we don't have authenticated user context.
    // We'll try to get the user from the job's owner.
    if (data.jobId) {
      try {
        const { sql } = await import("~/db");
        const db = sql();
        const jobRows = await db`
          SELECT user_id FROM render_jobs WHERE id = ${data.jobId} LIMIT 1
        `;
        if (jobRows.length > 0) {
          await trackEvent({
            renderJobId: data.jobId,
            userId: jobRows[0].user_id,
            eventType: eventType as any,
            channel: channel as any,
            viewerId: data.viewerId || undefined,
            watchDurationSeconds: watchDuration,
          });
        }
      } catch (err) {
        console.error("[track] Error tracking event:", err);
        // Silently fail — tracking pixel must always return 200
      }
    }

    // Return the 1x1 GIF
    return new Response(PIXEL_BUF, {
      status: 200,
      headers: {
        "Content-Type": "image/gif",
        "Cache-Control": "no-cache, no-store, must-revalidate",
        "Access-Control-Allow-Origin": "*",
      },
    });
  });

export const Route = createFileRoute("/api/analytics/track")({
  component: TrackRoute,
});

function TrackRoute() {
  // This route exists to register /api/analytics/track.
  // The actual pixel is served by handleTrack.
  return null;
}

export { handleTrack };
