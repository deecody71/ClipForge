import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { sql } from "~/db";
import { downloadVideo } from "~/services/did-service";
import { mkdir } from "fs/promises";
import path from "path";

/**
 * POST /api/did/webhook
 *
 * Webhook endpoint called by D-ID when talk generation completes.
 * Updates the render_jobs table with the completed video status and
 * downloads the video to the local renders directory.
 *
 * D-ID webhooks send JSON with:
 * {
 *   id: string,           // talk ID
 *   status: "done" | "error",
 *   result_url?: string,  // URL to download the completed MP4
 *   error?: { description: string }
 * }
 *
 * Auth: no shared secret by default. D-ID sends webhooks to configured URLs
 * without additional auth headers. For production, verify D-ID's IP range
 * or add a shared secret as a query parameter in the webhook URL.
 */

const handleWebhook = createServerFn({ method: "POST" })
  .handler(async ({ data: rawData }) => {
    const body = rawData as {
      id?: string;
      status?: string;
      result_url?: string;
      error?: { description?: string; message?: string };
    };

    console.log("[did-webhook] Received webhook:", JSON.stringify(body).slice(0, 500));

    const talkId = body.id;
    const status = body.status;

    if (!talkId) {
      console.warn("[did-webhook] Missing talk id in webhook payload");
      return { error: "Missing talk id" };
    }

    console.log(`[did-webhook] Talk ${talkId} status: ${status}`);

    // Find the render job by did_talk_id
    const db = sql();
    const rows = await db`
      SELECT id, user_id, project_name, status, config, output_url, progress, error_message,
             heygen_video_id, did_talk_id, created_at, updated_at
      FROM render_jobs
      WHERE did_talk_id = ${talkId}
      ORDER BY created_at DESC
      LIMIT 1
    `;

    if (rows.length === 0) {
      console.warn(`[did-webhook] No render_job found for D-ID talk ${talkId}`);
      return { warning: "No matching render job found", talkId };
    }

    const jobId = rows[0].id;
    console.log(`[did-webhook] Matched render job ${jobId} for D-ID talk ${talkId}`);

    if (status === "done") {
      const resultUrl = body.result_url;

      if (resultUrl) {
        // Download the video to our local storage
        try {
          const projectRoot = "/home/team/shared/site";
          const rendersDir = path.join(projectRoot, "public", "renders");
          await mkdir(rendersDir, { recursive: true });

          const outputPath = path.join(rendersDir, `${jobId}.mp4`);
          await downloadVideo(resultUrl, outputPath);

          const outputUrl = `/renders/${jobId}.mp4`;

          await db`
            UPDATE render_jobs
            SET status = 'completed',
                progress = 100,
                output_url = ${outputUrl},
                updated_at = now()
            WHERE id = ${jobId} AND status = 'processing'
          `;

          console.log(`[did-webhook] Job ${jobId} completed via D-ID: ${outputUrl}`);
        } catch (err) {
          console.error(`[did-webhook] Failed to download video for job ${jobId}:`, err);
          await db`
            UPDATE render_jobs
            SET status = 'failed',
                error_message = ${`Video download failed: ${err instanceof Error ? err.message : String(err)}`},
                updated_at = now()
            WHERE id = ${jobId}
          `;
        }
      } else {
        console.error(`[did-webhook] Talk ${talkId} status=done but no result_url`);
        await db`
          UPDATE render_jobs
          SET status = 'failed',
              error_message = 'D-ID completed but provided no result_url',
              updated_at = now()
          WHERE id = ${jobId}
        `;
      }
    } else if (status === "error" || status === "failed") {
      const errorMessage = body.error?.description || body.error?.message || "D-ID talk generation failed";

      await db`
        UPDATE render_jobs
        SET status = 'failed',
            error_message = ${errorMessage},
            updated_at = now()
        WHERE id = ${jobId}
      `;

      console.log(`[did-webhook] Job ${jobId} failed via D-ID: ${errorMessage}`);
    } else if (status === "started" || status === "created") {
      // D-ID sends intermediate status updates — update progress
      const progressMap: Record<string, number> = {
        created: 30,
        started: 50,
      };
      const progress = progressMap[status] || 40;

      await db`
        UPDATE render_jobs
        SET progress = ${progress}, updated_at = now()
        WHERE id = ${jobId} AND status = 'processing'
      `;

      console.log(`[did-webhook] Job ${jobId} progress updated to ${progress}% (D-ID status: ${status})`);
    } else {
      console.log(`[did-webhook] Unhandled status: ${status}, ignoring`);
    }

    return { success: true, talkId, jobId, status };
  });

export const Route = createFileRoute("/api/did/webhook")({
  component: DIDWebhookRoute,
});

function DIDWebhookRoute() {
  // This route is not intended to render a UI.
  // It exists solely to register /api/did/webhook as a valid route.
  // The webhook is called by D-ID's servers.
  return null;
}

// Re-export for potential programmatic use
export { handleWebhook };
