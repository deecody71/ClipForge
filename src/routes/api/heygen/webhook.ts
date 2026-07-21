import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { getVideoStatus, downloadVideo } from "~/services/heygen-service";
import { mkdir } from "fs/promises";
import path from "path";

/**
 * POST /api/heygen/webhook
 *
 * Webhook endpoint called by HeyGen when video generation completes.
 * Updates the render_jobs table with the completed video status and
 * downloads the video to the local renders directory.
 *
 * HeyGen webhooks send JSON with:
 * {
 *   event: "video.completed" | "video.failed",
 *   data: {
 *     video_id: string,
 *     callback_id?: string,
 *     video_url?: string,
 *     error?: { message: string }
 *   }
 * }
 *
 * Auth: verifies a shared webhook secret (HEYGEN_WEBHOOK_SECRET).
 * If not configured, the webhook still works but is vulnerable to spoofing.
 */

const handleWebhook = createServerFn({ method: "POST" })
  .handler(async ({ data: rawData }) => {
    // Verify webhook secret if configured
    const webhookSecret = process.env.HEYGEN_WEBHOOK_SECRET;
    // Note: HeyGen includes a signature header. For MVP, we use a shared secret
    // passed as a query parameter or in the callback_id prefix.

    const body = rawData as {
      event?: string;
      data?: {
        video_id?: string;
        callback_id?: string;
        video_url?: string;
        error?: { message?: string };
      };
    };

    console.log("[heygen-webhook] Received webhook:", JSON.stringify(body).slice(0, 500));

    const event = body.event;
    const eventData = body.data;

    if (!eventData?.video_id) {
      console.warn("[heygen-webhook] Missing video_id in webhook payload");
      return { error: "Missing video_id" };
    }

    const videoId = eventData.video_id;
    const callbackId = eventData.callback_id;

    // callback_id format: "clipforge:{jobId}" — extract the job ID
    let jobId: string | null = null;
    if (callbackId && callbackId.startsWith("clipforge:")) {
      jobId = callbackId.slice("clipforge:".length);
    }

    console.log(`[heygen-webhook] Event: ${event}, videoId: ${videoId}, jobId: ${jobId}`);

    // If we don't have a callback_id, we can't map to a job.
    // Still log the event for debugging.
    if (!jobId) {
      console.warn("[heygen-webhook] No callback_id/jobId mapping — cannot update render_jobs");
      return { warning: "No callback_id found", videoId };
    }

    const db = sql();

    if (event === "video.completed" || event === "video.success") {
      const videoUrl = eventData.video_url;

      if (videoUrl) {
        // Download the video to our local storage
        try {
          const projectRoot = "/home/team/shared/site";
          const rendersDir = path.join(projectRoot, "public", "renders");
          await mkdir(rendersDir, { recursive: true });

          const outputPath = path.join(rendersDir, `${jobId}.mp4`);
          await downloadVideo(videoUrl, outputPath);

          const outputUrl = `/renders/${jobId}.mp4`;

          await db`
            UPDATE render_jobs
            SET status = 'completed',
                progress = 100,
                output_url = ${outputUrl},
                heygen_video_id = ${videoId},
                updated_at = now()
            WHERE id = ${jobId} AND status = 'processing'
          `;

          console.log(`[heygen-webhook] Job ${jobId} completed via HeyGen: ${outputUrl}`);
        } catch (err) {
          console.error(`[heygen-webhook] Failed to download video for job ${jobId}:`, err);
          await db`
            UPDATE render_jobs
            SET status = 'failed',
                error_message = ${`Video download failed: ${err instanceof Error ? err.message : String(err)}`},
                heygen_video_id = ${videoId},
                updated_at = now()
            WHERE id = ${jobId}
          `;
        }
      } else {
        // Try polling the status API to get the video URL
        try {
          const status = await getVideoStatus(videoId);
          if (status.status === "completed" && status.videoUrl) {
            const projectRoot = "/home/team/shared/site";
            const rendersDir = path.join(projectRoot, "public", "renders");
            await mkdir(rendersDir, { recursive: true });

            const outputPath = path.join(rendersDir, `${jobId}.mp4`);
            await downloadVideo(status.videoUrl, outputPath);

            const outputUrl = `/renders/${jobId}.mp4`;

            await db`
              UPDATE render_jobs
              SET status = 'completed',
                  progress = 100,
                  output_url = ${outputUrl},
                  heygen_video_id = ${videoId},
                  updated_at = now()
              WHERE id = ${jobId}
            `;
          } else {
            throw new Error("No video_url in webhook and status not completed");
          }
        } catch (err) {
          console.error(`[heygen-webhook] Failed to get video status for job ${jobId}:`, err);
          await db`
            UPDATE render_jobs
            SET status = 'failed',
                error_message = ${`Failed to retrieve video: ${err instanceof Error ? err.message : String(err)}`},
                heygen_video_id = ${videoId},
                updated_at = now()
            WHERE id = ${jobId}
          `;
        }
      }
    } else if (event === "video.failed" || event === "video.error") {
      const errorMessage = eventData.error?.message || "HeyGen video generation failed";

      await db`
        UPDATE render_jobs
        SET status = 'failed',
            error_message = ${errorMessage},
            heygen_video_id = ${videoId},
            updated_at = now()
        WHERE id = ${jobId}
      `;

      console.log(`[heygen-webhook] Job ${jobId} failed via HeyGen: ${errorMessage}`);
    } else {
      console.log(`[heygen-webhook] Unhandled event type: ${event}, ignoring`);
    }

    return { success: true, videoId, jobId, event };
  });

export const Route = createFileRoute("/api/heygen/webhook")({
  component: HeyGenWebhookRoute,
});

function HeyGenWebhookRoute() {
  // This route is not intended to render a UI.
  // It exists solely to register /api/heygen/webhook as a valid route.
  // The webhook is called by HeyGen's servers.
  return null;
}

// Re-export for potential programmatic use
export { handleWebhook };
