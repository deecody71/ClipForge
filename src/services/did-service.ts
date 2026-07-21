/**
 * D-ID Service — AI Talking-Head Video Generation
 *
 * Wraps the D-ID API (https://api.d-id.com) for creating talking-head videos
 * from still images + TTS scripts. Uses Basic Auth.
 *
 * D-ID uses:
 *  - POST /talks           → create a talk (async, returns talk ID)
 *  - GET  /talks/{id}      → poll for status
 *  - Webhook callbacks     → optional async completion notification
 *
 * Priority: D-ID → HeyGen → FFmpeg (local fallback).
 */

import { mkdir } from "fs/promises";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateTalkParams {
  /** URL of the still image to animate as a talking head */
  imageUrl: string;
  /** The script text (D-ID handles TTS internally) */
  script: string;
  /** Microsoft voice ID (default: en-US-JennyNeural) */
  voiceId?: string;
  /** Background image URL for the video */
  backgroundUrl?: string;
  /** Webhook URL for D-ID completion callback */
  webhookUrl?: string;
}

export interface TalkStatus {
  talkId: string;
  status: "created" | "started" | "done" | "error";
  resultUrl?: string;
  errorMessage?: string;
  duration?: number;
}

// ─── Configuration ────────────────────────────────────────────────────────

const DID_BASE_URL = "https://api.d-id.com";

function getCredentials(): { username: string; password: string } {
  const username = process.env.DID_USERNAME;
  const password = process.env.DID_PASSWORD;

  if (!username || !password) {
    throw new Error("D-ID credentials not configured: DID_USERNAME and DID_PASSWORD must be set");
  }

  return { username, password };
}

function isDIDConfigured(): boolean {
  const username = process.env.DID_USERNAME;
  const password = process.env.DID_PASSWORD;
  return !!(username && password && username.length > 0 && password.length > 0);
}

// ─── API Helpers ──────────────────────────────────────────────────────────

async function didFetch(
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const { username, password } = getCredentials();

  // Encode credentials for Basic Auth
  const authHeader = `Basic ${Buffer.from(`${username}:${password}`).toString("base64")}`;

  const url = `${DID_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    Authorization: authHeader,
    "Content-Type": "application/json",
    Accept: "application/json",
  };

  const method = options.method || (options.body ? "POST" : "GET");

  const response = await fetch(url, {
    method,
    headers,
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  if (!response.ok) {
    const errorText = await response.text().catch(() => "Unknown error");
    throw new Error(
      `D-ID API error (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  return response;
}

// ─── Public API ───────────────────────────────────────────────────────────

export { isDIDConfigured };

/**
 * Create a talking-head video via D-ID's Talks API.
 *
 * POST /talks
 * Request body includes source_url (image), script with TTS provider config,
 * background, and optional webhook for async completion.
 */
export async function createTalk(
  params: CreateTalkParams,
): Promise<{ talkId: string }> {
  const body: Record<string, unknown> = {
    source_url: params.imageUrl,
    script: {
      type: "text",
      input: params.script,
      provider: {
        type: "microsoft",
        voice_id: params.voiceId || "en-US-JennyNeural",
      },
    },
    config: {
      fluent: true,
      pad_audio: 0.5,
    },
  };

  if (params.backgroundUrl) {
    // Put background inside config where D-ID expects it
    body.config = {
      ...(body.config as object),
      background: {
        type: "image",
        source_url: params.backgroundUrl,
      },
    };
  }

  if (params.webhookUrl) {
    body.webhook = params.webhookUrl;
  }

  console.log("[did] FULL body being sent:", JSON.stringify(body, null, 2));

  const response = await didFetch("/talks", { body });
  const result = (await response.json()) as {
    id?: string;
    status?: string;
    message?: string;
  };

  const talkId = result.id;
  if (!talkId) {
    throw new Error(`D-ID create talk returned no id: ${JSON.stringify(result)}`);
  }

  console.log(`[did] Talk created: ${talkId}`);
  return { talkId };
}

/**
 * Get the status of a D-ID talk.
 *
 * GET /talks/{id}
 */
export async function getTalkStatus(talkId: string): Promise<TalkStatus> {
  console.log(`[did] Checking status for talk: ${talkId}`);
  const response = await didFetch(`/talks/${encodeURIComponent(talkId)}`);

  const result = (await response.json()) as {
    id?: string;
    status?: string;
    result_url?: string;
    error?: { message?: string; description?: string };
    duration?: number;
  };

  // Normalize status
  let status: TalkStatus["status"] = "created";
  if (result.status === "created") status = "created";
  else if (result.status === "started") status = "started";
  else if (result.status === "done") status = "done";
  else if (result.status === "error" || result.status === "failed") status = "error";
  else status = result.status as TalkStatus["status"] || "created";

  return {
    talkId: result.id || talkId,
    status,
    resultUrl: result.result_url,
    errorMessage: result.error?.description || result.error?.message,
    duration: result.duration,
  };
}

/**
 * Download a completed video from D-ID's result URL to a local file.
 */
export async function downloadVideo(
  videoUrl: string,
  outputPath: string,
): Promise<string> {
  console.log(`[did] Downloading video from: ${videoUrl}`);

  // Ensure output directory exists
  await mkdir(path.dirname(outputPath), { recursive: true });

  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download D-ID video (${response.status}): ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await (await import("fs/promises")).writeFile(outputPath, buffer);

  console.log(
    `[did] Video downloaded: ${outputPath} (${buffer.length} bytes)`,
  );
  return outputPath;
}

/**
 * Poll D-ID until the talk is complete or fails, then download it.
 *
 * Polls every 3 seconds with a 15-minute timeout.
 */
export async function waitForCompletion(
  talkId: string,
  outputPath: string,
  maxWaitMs = 900_000, // 15 minutes
): Promise<{ outputPath: string; resultUrl: string }> {
  const pollInterval = 3_000; // 3 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const talkStatus = await getTalkStatus(talkId);

    if (talkStatus.status === "done" && talkStatus.resultUrl) {
      console.log(`[did] Talk ${talkId} completed, downloading...`);
      await downloadVideo(talkStatus.resultUrl, outputPath);
      return { outputPath, resultUrl: talkStatus.resultUrl };
    }

    if (talkStatus.status === "error") {
      throw new Error(
        `D-ID talk generation failed: ${talkStatus.errorMessage || "Unknown error"}`,
      );
    }

    console.log(
      `[did] Talk ${talkId} status: ${talkStatus.status} (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`,
    );
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `D-ID talk ${talkId} timed out after ${maxWaitMs / 1000}s`,
  );
}
