import { sql, ensureRenderJobsTable } from "~/db";
import { renderVideo } from "./video-renderer";
import { isHeyGenConfigured, createVideoFromScript, waitForCompletion } from "./heygen-service";
import { isDIDConfigured, createTalk, waitForCompletion as waitForDIDCompletion } from "./did-service";

export interface RenderConfig {
  actorId: string;
  actorName: string;
  actorEmoji: string;
  actorColor: string;
  /** Vite-hashed image URL for the actor (e.g., /assets/professional-male-XXXX.jpg) */
  imgSrc?: string;
  backgroundId: string;
  backgroundName: string;
  backgroundGradient: string;
  /** Vite-hashed image URL for the background */
  bgImgSrc?: string;
  customBgPrompt?: string;
  script: string;
  tone: string;
  productDescription?: string;
  /** Microsoft voice ID for D-ID TTS (e.g., en-US-GuyNeural, en-US-JennyNeural) */
  voiceId?: string;
}

export interface RenderJob {
  id: string;
  user_id: string;
  project_name: string;
  status: "queued" | "processing" | "completed" | "failed";
  config: RenderConfig;
  output_url: string | null;
  progress: number;
  error_message: string | null;
  heygen_video_id: string | null;
  did_talk_id: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Enqueue a new render job. Inserts the job row and kicks off async processing.
 */
export async function enqueueRender(
  userId: string,
  config: RenderConfig,
  projectName?: string,
): Promise<RenderJob> {
  await ensureRenderJobsTable();
  const name = projectName || "Untitled Commercial";
  const db = sql();

  const rows = await db`
    INSERT INTO render_jobs (user_id, project_name, status, config, progress)
    VALUES (${userId}, ${name}, 'queued', ${JSON.stringify(config)}::jsonb, 0)
    RETURNING id, user_id, project_name, status, config, output_url, progress, error_message,
              created_at, updated_at
  `;

  const job = rowToJob(rows[0]);

  // Fire-and-forget processing
  processJobAsync(job.id).catch((err) => {
    console.error(`[render-queue] Background processing failed for job ${job.id}:`, err);
  });

  return job;
}

/**
 * Process a job asynchronously.
 *
 * If HEYGEN_API_KEY is set, uses HeyGen's AI avatar video generation.
 * Otherwise falls back to the local FFmpeg render pipeline.
 */
async function processJobAsync(jobId: string): Promise<void> {
  const db = sql();

  // Mark as processing
  await db`
    UPDATE render_jobs
    SET status = 'processing', progress = 0, updated_at = now()
    WHERE id = ${jobId}
  `;

  // Fetch the job config from the database
  const rows = await db`
    SELECT id, user_id, project_name, status, config, output_url, progress, error_message,
           heygen_video_id, did_talk_id, created_at, updated_at
    FROM render_jobs
    WHERE id = ${jobId}
    LIMIT 1
  `;

  if (rows.length === 0) {
    console.error(`[render-queue] Job ${jobId} not found for processing`);
    return;
  }

  const job = rowToJob(rows[0]);

  // Update progress to 25% before starting the render
  try {
    await db`
      UPDATE render_jobs
      SET progress = 25, updated_at = now()
      WHERE id = ${jobId} AND status = 'processing'
    `;
  } catch (err) {
    console.error(`[render-queue] Progress update failed for job ${jobId}:`, err);
  }

  // ── Priority: D-ID → HeyGen → FFmpeg fallback ────────────────────
  if (isDIDConfigured()) {
    await processJobViaDID(db, jobId, job);
  } else if (isHeyGenConfigured()) {
    await processJobViaHeyGen(db, jobId, job);
  } else {
    await processJobViaFfmpeg(db, jobId, job);
  }
}

/**
 * Pick the oldest 'queued' job and process it.
 * For the MVP, processing is started automatically by enqueueRender.
 * This function exists for future manual queue processing.
 */
export async function processNextJob(): Promise<RenderJob | null> {
  const db = sql();

  const rows = await db`
    SELECT id, user_id, project_name, status, config, output_url, progress, error_message,
           created_at, updated_at
    FROM render_jobs
    WHERE status = 'queued'
    ORDER BY created_at ASC
    LIMIT 1
  `;

  if (rows.length === 0) return null;

  const job = rowToJob(rows[0]);

  // Process it
  await processJobAsync(job.id);

  return job;
}

/**
 * Get job status and progress for a specific job owned by the user.
 */
export async function getJobStatus(
  jobId: string,
  userId: string,
): Promise<RenderJob | null> {
  const db = sql();
  const rows = await db`
    SELECT id, user_id, project_name, status, config, output_url, progress, error_message,
           created_at, updated_at
    FROM render_jobs
    WHERE id = ${jobId} AND user_id = ${userId}
    LIMIT 1
  `;

  if (rows.length === 0) return null;
  return rowToJob(rows[0]);
}

/**
 * Get all render jobs for a user, newest first.
 */
export async function getUserJobs(
  userId: string,
  limit = 10,
): Promise<RenderJob[]> {
  const db = sql();
  const rows = await db`
    SELECT id, user_id, project_name, status, config, output_url, progress, error_message,
           heygen_video_id, did_talk_id, created_at, updated_at
    FROM render_jobs
    WHERE user_id = ${userId}
    ORDER BY created_at DESC
    LIMIT ${limit}
  `;

  return rows.map(rowToJob);
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
function rowToJob(row: any): RenderJob {
  return {
    id: row.id,
    user_id: row.user_id,
    project_name: row.project_name,
    status: row.status,
    config: typeof row.config === "string" ? JSON.parse(row.config) : row.config,
    output_url: row.output_url,
    progress: row.progress,
    error_message: row.error_message,
    heygen_video_id: row.heygen_video_id || null,
    did_talk_id: row.did_talk_id || null,
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}

// ─── Processing pipelines ──────────────────────────────────────────────

/**
 * Clean a script for D-ID TTS by stripping stage directions,
 * scene markers, and markup that the AI voice would read aloud.
 */
function cleanScriptForDID(script: string): string {
  if (!script) return "";
  return script
    .split("\n")
    .map((line) => {
      let cleaned = line.replace(/\([^)]*\)/g, "");
      cleaned = cleaned.replace(/\[[^\]]*\]/g, "");
      cleaned = cleaned.replace(/\*{1,3}/g, "");
      cleaned = cleaned.trim();
      return cleaned;
    })
    .filter((line) => {
      if (!line) return false;
      if (/^(SCENE|Scene|ACT|Act)\s*\d*[:.]/i.test(line)) return false;
      if (line.length < 3 && /^[.,;:!?\-–—]+$/.test(line)) return false;
      return true;
    })
    .join("\n");
}

/**
 * Process a job via D-ID's talking-head API.
 *
 * Maps ClipForge's render config (actor image, script, background) to D-ID's
 * talk API, then polls for completion and downloads the result.
 */
async function processJobViaDID(
  db: ReturnType<typeof sql>,
  jobId: string,
  job: RenderJob,
): Promise<void> {
  try {
    console.log(`[render-queue] Starting D-ID render for job ${jobId}...`);

    // Construct the webhook callback URL
    const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
    const webhookUrl = `${publicUrl}/api/did/webhook`;

    // Map render config to D-ID params
    // Use the actor's imgSrc as the source image for the talking head
    const imageUrl = job.config.imgSrc
      ? (job.config.imgSrc.startsWith("http")
        ? job.config.imgSrc
        : `${publicUrl}${job.config.imgSrc}`)
      : undefined;

    if (!imageUrl) {
      throw new Error("No actor image URL available for D-ID talk");
    }

    // Background image URL (optional)
    const backgroundUrl = job.config.bgImgSrc
      ? (job.config.bgImgSrc.startsWith("http")
        ? job.config.bgImgSrc
        : `${publicUrl}${job.config.bgImgSrc}`)
      : undefined;

    // Voice ID for D-ID TTS (determined by actor)
    const voiceId = job.config.voiceId || "en-US-JennyNeural";

    // Clean the script to remove stage directions and formatting
    const cleanedScript = cleanScriptForDID(job.config.script);
    console.log(`[render-queue] D-ID image URL: ${imageUrl.slice(0, 100)}`);
    console.log(`[render-queue] D-ID script: ${cleanedScript.length} chars (from ${job.config.script?.length || 0})`);
    console.log(`[render-queue] D-ID voiceId: ${voiceId} (from config: ${job.config.voiceId || "not set, using default"})`);
    console.log(`[render-queue] D-ID background debug: bgImgSrc="${job.config.bgImgSrc || "(empty)"}" | backgroundUrl="${backgroundUrl || "(empty)"}" | isTruthy=${!!backgroundUrl} | backgroundName="${job.config.backgroundName || "(empty)"}"`);

    // Create the talk via D-ID
    const { talkId } = await createTalk({
      imageUrl,
      script: cleanedScript,
      voiceId,
      backgroundUrl,
      webhookUrl,
    });

    // Store the D-ID talk ID
    await db`
      UPDATE render_jobs
      SET did_talk_id = ${talkId}, progress = 30, updated_at = now()
      WHERE id = ${jobId} AND status = 'processing'
    `;

    console.log(`[render-queue] D-ID talk ${talkId} created for job ${jobId}, waiting for completion...`);

    // Wait for D-ID to complete the video (polling with webhook fallback)
    const projectRoot = "/home/team/shared/site";
    const outputPath = `${projectRoot}/public/renders/${jobId}.mp4`;
    const outputUrl = `/renders/${jobId}.mp4`;

    const result = await waitForDIDCompletion(talkId, outputPath);

    // Mark as completed
    await db`
      UPDATE render_jobs
      SET status = 'completed',
          progress = 100,
          output_url = ${outputUrl},
          updated_at = now()
      WHERE id = ${jobId}
    `;

    console.log(`[render-queue] Job ${jobId} completed via D-ID: ${result.resultUrl}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[render-queue] D-ID job ${jobId} failed:`, errorMessage);

    await db`
      UPDATE render_jobs
      SET status = 'failed',
          progress = 0,
          error_message = ${errorMessage},
          updated_at = now()
      WHERE id = ${jobId}
    `;
  }
}

/**
 * Process a job via HeyGen's AI avatar video generation API.
 */
async function processJobViaHeyGen(
  db: ReturnType<typeof sql>,
  jobId: string,
  job: RenderJob,
): Promise<void> {
  try {
    console.log(`[render-queue] Starting HeyGen render for job ${jobId}...`);

    // Construct the callback URL for the webhook
    const publicUrl = process.env.PUBLIC_URL || "http://localhost:3000";
    const callbackUrl = `${publicUrl}/api/heygen/webhook`;

    // Create the video via HeyGen v1 API (handles TTS internally)
    const { videoId } = await createVideoFromScript({
      videoName: job.project_name,
      script: job.config.script,
      dimension: { width: 1280, height: 720 },
      caption: true,
      callbackUrl,
      callbackId: `clipforge:${jobId}`,
      background: job.config.backgroundGradient
        ? {
            type: "color",
            value: gradientToColor(job.config.backgroundGradient),
          }
        : undefined,
    });

    // Store the HeyGen video ID
    await db`
      UPDATE render_jobs
      SET heygen_video_id = ${videoId}, progress = 30, updated_at = now()
      WHERE id = ${jobId} AND status = 'processing'
    `;

    console.log(`[render-queue] HeyGen video ${videoId} created for job ${jobId}, waiting for completion...`);

    // Wait for HeyGen to complete the video (polling with webhook fallback)
    const projectRoot = "/home/team/shared/site";
    const outputPath = `${projectRoot}/public/renders/${jobId}.mp4`;
    const outputUrl = `/renders/${jobId}.mp4`;

    const result = await waitForCompletion(videoId, outputPath);

    // Mark as completed
    await db`
      UPDATE render_jobs
      SET status = 'completed',
          progress = 100,
          output_url = ${outputUrl},
          heygen_video_id = ${videoId},
          updated_at = now()
      WHERE id = ${jobId}
    `;

    console.log(`[render-queue] Job ${jobId} completed via HeyGen: ${result.videoUrl}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[render-queue] HeyGen job ${jobId} failed:`, errorMessage);

    await db`
      UPDATE render_jobs
      SET status = 'failed',
          progress = 0,
          error_message = ${errorMessage},
          updated_at = now()
      WHERE id = ${jobId}
    `;
  }
}

/**
 * Process a job via the local FFmpeg render pipeline (fallback).
 */
async function processJobViaFfmpeg(
  db: ReturnType<typeof sql>,
  jobId: string,
  job: RenderJob,
): Promise<void> {
  try {
    console.log(`[render-queue] Starting FFmpeg render for job ${jobId}...`);
    const result = await renderVideo({
      jobId,
      config: job.config,
      projectRoot: "/home/team/shared/site",
    });

    // Update progress to 90% after render completes
    await db`
      UPDATE render_jobs
      SET progress = 90, updated_at = now()
      WHERE id = ${jobId} AND status = 'processing'
    `;

    // Mark as completed with the real output URL
    await db`
      UPDATE render_jobs
      SET status = 'completed', progress = 100, output_url = ${result.outputUrl}, updated_at = now()
      WHERE id = ${jobId}
    `;

    console.log(`[render-queue] Job ${jobId} completed: ${result.outputUrl}`);
  } catch (err) {
    const errorMessage = err instanceof Error ? err.message : String(err);
    console.error(`[render-queue] Job ${jobId} failed:`, errorMessage);

    await db`
      UPDATE render_jobs
      SET status = 'failed', progress = 0, error_message = ${errorMessage}, updated_at = now()
      WHERE id = ${jobId}
    `;
  }
}

/**
 * Extract an approximate color from a Tailwind gradient class string.
 * Maps common gradient presets to hex colors for HeyGen backgrounds.
 */
function gradientToColor(gradient: string): string {
  const colorMap: Record<string, string> = {
    "from-blue-600": "#2563eb",
    "from-pink-500": "#ec4899",
    "from-gray-500": "#6b7280",
    "from-purple-500": "#a855f7",
    "from-emerald-500": "#10b981",
    "from-amber-500": "#f59e0b",
    "from-yellow-500": "#eab308",
    "from-orange-400": "#fb923c",
    "from-slate-600": "#475569",
    "from-green-500": "#22c55e",
    "from-neutral-600": "#525252",
    "from-violet-500": "#8b5cf6",
  };

  for (const [key, color] of Object.entries(colorMap)) {
    if (gradient.includes(key)) return color;
  }

  return "#2563eb"; // default blue
}
