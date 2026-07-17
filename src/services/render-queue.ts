import { sql, ensureRenderJobsTable } from "~/db";

export interface RenderConfig {
  actorId: string;
  actorName: string;
  actorEmoji: string;
  actorColor: string;
  backgroundId: string;
  backgroundName: string;
  backgroundGradient: string;
  customBgPrompt?: string;
  script: string;
  tone: string;
  productDescription?: string;
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
  created_at: string;
  updated_at: string;
}

function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms));
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
 * Process a job asynchronously with simulated rendering progress.
 */
async function processJobAsync(jobId: string): Promise<void> {
  const db = sql();

  // Mark as processing
  await db`
    UPDATE render_jobs
    SET status = 'processing', progress = 0, updated_at = now()
    WHERE id = ${jobId}
  `;

  // Simulate rendering with progress updates
  const progressSteps = [25, 50, 75, 100];
  const totalDuration = 2500; // 2.5 seconds total simulation
  const stepDelay = totalDuration / progressSteps.length;

  for (const step of progressSteps) {
    await sleep(stepDelay);
    try {
      await db`
        UPDATE render_jobs
        SET progress = ${step}, updated_at = now()
        WHERE id = ${jobId} AND status = 'processing'
      `;
    } catch (err) {
      console.error(`[render-queue] Progress update failed for job ${jobId}:`, err);
    }
  }

  // Mark as completed with mock output URL
  const outputUrl = `/api/videos/${jobId}/output.mp4`;

  await db`
    UPDATE render_jobs
    SET status = 'completed', progress = 100, output_url = ${outputUrl}, updated_at = now()
    WHERE id = ${jobId}
  `;
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
           created_at, updated_at
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
    created_at: String(row.created_at),
    updated_at: String(row.updated_at),
  };
}
