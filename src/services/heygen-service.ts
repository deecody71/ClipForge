/**
 * HeyGen Service — AI Avatar Video Generation
 *
 * Wraps the HeyGen API for creating talking-head avatar videos.
 * Supports two approaches:
 *  - v1/video.generate:  HeyGen handles TTS internally (simpler, uses HeyGen avatars)
 *  - v2/video/generate:  Talking photo with custom image + audio (for ClipForge avatar images)
 *
 * When HEYGEN_API_KEY is set, render jobs use this service instead of FFmpeg.
 */

import { writeFile, mkdir } from "fs/promises";
import path from "path";

// ─── Types ────────────────────────────────────────────────────────────────

export interface CreateVideoParams {
  /** Display name for the video in HeyGen dashboard */
  videoName: string;
  /** The script text (HeyGen handles TTS internally for v1) */
  script: string;
  /** HeyGen voice_id or voice settings object */
  voice?: { voice_id: string; rate?: number };
  /** Background: color string, or { type: "image", url: string } */
  background?: string | { type: "color" | "image"; value?: string; url?: string };
  /** Video dimensions */
  dimension?: { width: number; height: number };
  /** Whether to show captions/subtitles */
  caption?: boolean;
  /** Webhook URL for completion callback */
  callbackUrl?: string;
  /** Unique ID to correlate webhook to our job */
  callbackId?: string;
}

export interface CreateTalkingPhotoParams {
  /** Image URL or base64 data URI of the avatar/photo */
  avatarImage: string;
  /** Audio URL or base64 data URI, OR text for TTS */
  audio?: string | { type: "text" | "audio"; text?: string; audio_url?: string };
  /** Background: color string, image URL, or { type: "color"|"image", value?: string, url?: string } */
  background?: string | { type: "color" | "image"; value?: string; url?: string };
  /** Voice ID for TTS (when audio type is "text") */
  voiceId?: string;
  /** Input text for TTS */
  inputText?: string;
  /** Video dimensions */
  dimension?: { width: number; height: number };
  /** Webhook URL */
  callbackUrl?: string;
  /** Callback correlation ID */
  callbackId?: string;
}

export interface HeyGenVideoStatus {
  videoId: string;
  status: "processing" | "completed" | "failed";
  videoUrl?: string;
  errorMessage?: string;
  duration?: number;
}

// ─── Configuration ────────────────────────────────────────────────────────

const HEYGEN_BASE_URL = "https://api.heygen.com";

function getApiKey(): string {
  const key = process.env.HEYGEN_API_KEY;
  if (!key || key === "your_heygen_api_key_here") {
    throw new Error("HEYGEN_API_KEY is not configured");
  }
  return key;
}

function isHeyGenConfigured(): boolean {
  const key = process.env.HEYGEN_API_KEY;
  return !!key && key !== "your_heygen_api_key_here" && key.length > 0;
}

// ─── API Helpers ──────────────────────────────────────────────────────────

async function heygenFetch(
  endpoint: string,
  options: { method?: string; body?: unknown } = {},
): Promise<Response> {
  const apiKey = getApiKey();
  const url = `${HEYGEN_BASE_URL}${endpoint}`;

  const headers: Record<string, string> = {
    "X-Api-Key": apiKey,
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
      `HeyGen API error (${response.status}): ${errorText.slice(0, 500)}`,
    );
  }

  return response;
}

// ─── Public API ───────────────────────────────────────────────────────────

/**
 * Check whether HeyGen is configured (API key is set and valid-looking).
 * Used by the render queue to decide HeyGen vs FFmpeg fallback.
 */
export { isHeyGenConfigured };

/**
 * Create a video using HeyGen's v1 API (video.generate).
 *
 * This is the simpler approach: HeyGen handles TTS internally and uses
 * its own avatar library. Good for quick videos without custom images.
 *
 * POST /v1/video.generate
 */
export async function createVideoFromScript(
  params: CreateVideoParams,
): Promise<{ videoId: string }> {
  const body: Record<string, unknown> = {
    video_name: params.videoName,
    input_text: params.script,
    dimension: params.dimension || { width: 1280, height: 720 },
    caption: params.caption !== undefined ? params.caption : true,
  };

  if (params.voice) {
    body.voice = params.voice;
  }

  if (params.background) {
    if (typeof params.background === "string") {
      body.background = { type: "color", value: params.background };
    } else {
      body.background = params.background;
    }
  }

  if (params.callbackUrl) {
    body.callback_url = params.callbackUrl;
  }

  if (params.callbackId) {
    body.callback_id = params.callbackId;
  }

  console.log("[heygen] Creating video via v1/video.generate:", params.videoName);
  const response = await heygenFetch("/v1/video.generate", { body });

  const result = (await response.json()) as {
    code?: number;
    data?: { video_id?: string };
    message?: string;
  };

  if (result.code !== 100 && result.code !== 0 && result.code !== undefined) {
    throw new Error(`HeyGen v1 API error: ${result.message || "Unknown error"}`);
  }

  const videoId = result.data?.video_id;
  if (!videoId) {
    throw new Error(`HeyGen v1 API returned no video_id: ${JSON.stringify(result)}`);
  }

  console.log(`[heygen] Video created: ${videoId}`);
  return { videoId };
}

/**
 * Create a talking photo video using HeyGen's v2 API (video/generate).
 *
 * This approach accepts a custom avatar image (URL or base64) and audio
 * (URL or base64), plus background configuration. Best for ClipForge's
 * custom actor images with external TTS audio.
 *
 * POST /v2/video/generate
 */
export async function createTalkingPhoto(
  params: CreateTalkingPhotoParams,
): Promise<{ videoId: string }> {
  const body: Record<string, unknown> = {
    avatar_image: params.avatarImage,
    dimension: params.dimension || { width: 1280, height: 720 },
  };

  if (params.audio) {
    if (typeof params.audio === "string") {
      body.audio = { type: "audio", audio_url: params.audio };
    } else {
      body.audio = params.audio;
    }
  }

  if (params.background) {
    if (typeof params.background === "string") {
      // Try to determine if it's a URL or color
      if (params.background.startsWith("http") || params.background.startsWith("/")) {
        body.background = { type: "image", url: params.background };
      } else {
        body.background = { type: "color", value: params.background };
      }
    } else {
      body.background = params.background;
    }
  }

  if (params.voiceId) {
    body.voice_id = params.voiceId;
  }

  if (params.inputText) {
    body.input_text = params.inputText;
  }

  if (params.callbackUrl) {
    body.callback_url = params.callbackUrl;
  }

  if (params.callbackId) {
    body.callback_id = params.callbackId;
  }

  console.log("[heygen] Creating talking photo via v2/video/generate");
  const response = await heygenFetch("/v2/video/generate", { body });

  const result = (await response.json()) as {
    code?: number;
    data?: { video_id?: string; video_key?: string };
    message?: string;
  };

  if (result.code !== 100 && result.code !== 0 && result.code !== undefined) {
    throw new Error(`HeyGen v2 API error: ${result.message || "Unknown error"}`);
  }

  const videoId = result.data?.video_id || result.data?.video_key;
  if (!videoId) {
    throw new Error(`HeyGen v2 API returned no video_id: ${JSON.stringify(result)}`);
  }

  console.log(`[heygen] Talking photo created: ${videoId}`);
  return { videoId };
}

/**
 * Poll HeyGen for video generation status.
 *
 * GET /v1/video_status.get?video_id={id}
 */
export async function getVideoStatus(
  videoId: string,
): Promise<HeyGenVideoStatus> {
  console.log(`[heygen] Checking status for video: ${videoId}`);
  const response = await heygenFetch(
    `/v1/video_status.get?video_id=${encodeURIComponent(videoId)}`,
  );

  const result = (await response.json()) as {
    code?: number;
    data?: {
      video_id?: string;
      status?: string;
      video_url?: string;
      video_url_caption?: string;
      error_message?: string;
      duration?: number;
    };
    message?: string;
  };

  if (result.code !== 100 && result.code !== 0 && result.code !== undefined) {
    throw new Error(
      `HeyGen status API error: ${result.message || "Unknown error"}`,
    );
  }

  const data = result.data;
  if (!data) {
    throw new Error("HeyGen status API returned no data");
  }

  // Normalize status
  let status: "processing" | "completed" | "failed" = "processing";
  if (data.status === "completed" || data.status === "success") {
    status = "completed";
  } else if (data.status === "failed" || data.status === "error") {
    status = "failed";
  }

  return {
    videoId: data.video_id || videoId,
    status,
    videoUrl: data.video_url || data.video_url_caption,
    errorMessage: data.error_message,
    duration: data.duration,
  };
}

/**
 * Download a completed video from HeyGen's CDN to a local file.
 *
 * Returns the local output path.
 */
export async function downloadVideo(
  videoUrl: string,
  outputPath: string,
): Promise<string> {
  console.log(`[heygen] Downloading video from: ${videoUrl}`);

  // Ensure output directory exists
  await mkdir(path.dirname(outputPath), { recursive: true });

  const response = await fetch(videoUrl);
  if (!response.ok) {
    throw new Error(
      `Failed to download video (${response.status}): ${response.statusText}`,
    );
  }

  const buffer = Buffer.from(await response.arrayBuffer());
  await writeFile(outputPath, buffer);

  console.log(
    `[heygen] Video downloaded: ${outputPath} (${buffer.length} bytes)`,
  );
  return outputPath;
}

/**
 * Poll HeyGen until the video is complete or fails, then download it.
 *
 * Used for async render jobs that don't want to rely solely on webhooks.
 * Polls every 5 seconds with a 10-minute timeout (HeyGen videos typically
 * take 1-3 minutes to render).
 */
export async function waitForCompletion(
  videoId: string,
  outputPath: string,
  maxWaitMs = 600_000, // 10 minutes
): Promise<{ outputPath: string; videoUrl: string }> {
  const pollInterval = 5_000; // 5 seconds
  const startTime = Date.now();

  while (Date.now() - startTime < maxWaitMs) {
    const status = await getVideoStatus(videoId);

    if (status.status === "completed" && status.videoUrl) {
      console.log(`[heygen] Video ${videoId} completed, downloading...`);
      await downloadVideo(status.videoUrl, outputPath);
      return { outputPath, videoUrl: status.videoUrl };
    }

    if (status.status === "failed") {
      throw new Error(
        `HeyGen video generation failed: ${status.errorMessage || "Unknown error"}`,
      );
    }

    console.log(
      `[heygen] Video ${videoId} still processing... (${Math.round((Date.now() - startTime) / 1000)}s elapsed)`,
    );
    await new Promise((resolve) => setTimeout(resolve, pollInterval));
  }

  throw new Error(
    `HeyGen video ${videoId} timed out after ${maxWaitMs / 1000}s`,
  );
}
