/**
 * Video Renderer Service — FFmpeg-based MP4 Rendering Pipeline
 *
 * Takes a render job config and produces a finished MP4 commercial with:
 * - Actor image composited over background
 * - Ken Burns effect (slow zoom/pan via zoompan filter)
 * - Subtitle text burned onto video (drawtext filter)
 * - ElevenLabs AI voiceover audio
 *
 * NOTE ABOUT LIP SYNC: This pipeline does NOT do lip sync. True talking-head
 * animation requires ML models like Wav2Lip or commercial APIs (D-ID, HeyGen).
 * The Ken Burns effect gives the actor some life-like movement, but the mouth
 * does not move in sync with the audio. This is a Phase 2+ enhancement.
 */

import { spawn } from "child_process";
import { mkdir, writeFile, unlink } from "fs/promises";
import { existsSync } from "fs";
import path from "path";
import { generateSpeech } from "./voice-service";
import type { RenderConfig } from "./render-queue";

// ─── Types ──────────────────────────────────────────────────────────────

export interface RenderInput {
  jobId: string;
  config: RenderConfig;
  /** Absolute path to the project root (for resolving asset paths) */
  projectRoot: string;
}

export interface RenderResult {
  outputPath: string;
  outputUrl: string;
}

// ─── Constants ──────────────────────────────────────────────────────────

const VIDEO_WIDTH = 1280;
const VIDEO_HEIGHT = 720;
const FPS = 24;
// For a 2-minute commercial (~120 seconds)
const DEFAULT_DURATION_SECONDS = 60; // Target: ~1 minute; adjust based on audio

const SUBTITLE_FONT = "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf";
const SUBTITLE_FONT_SIZE = 28;
const SUBTITLE_COLOR = "white";
const SUBTITLE_BORDER_COLOR = "black";

// Ken Burns zoom range (1.0 = no zoom, 1.05 = subtle 5% zoom in)
const KEN_BURNS_ZOOM_MIN = 1.0;
const KEN_BURNS_ZOOM_MAX = 1.06;

// ─── Helpers ────────────────────────────────────────────────────────────

/**
 * Escape text for use inside FFmpeg drawtext filter's `text='...'` parameter.
 *
 * FFmpeg filter_complex uses single quotes as string delimiters, `:` as
 * parameter separators, `\` as the escape character, and `%` for text
 * expansion (like `%{pts}`). To include literal versions of these characters,
 * we must escape them properly.
 *
 * The safest way to embed a literal single quote inside a single-quoted
 * FFmpeg string is the `'\''` pattern: terminate the quoted string, insert
 * an escaped literal quote, and restart the quoted string.
 *
 * Order matters: escape `\` first so we don't double-escape backslashes
 * introduced by later replacements.
 */
function escapeFfmpegDrawtext(text: string): string {
  return text
    .replace(/\\/g, "\\\\")   // backslash → doubled (must be first)
    .replace(/:/g, "\\:")      // colon → escaped
    .replace(/'/g, "'\\''")    // single quote → '\'' (end quote, escaped literal, restart)
    .replace(/%/g, "\\%");     // percent → escaped (drawtext printf expansion)
}

/** Resolve an asset image path from actorId or backgroundId */
function resolveAssetPath(projectRoot: string, type: "actors" | "backgrounds", id: string): string {
  const assetPath = path.join(projectRoot, "src", "assets", type, `${id}.jpg`);
  if (existsSync(assetPath)) {
    return assetPath;
  }
  // Fallback: try to find any image in the directory
  const dir = path.join(projectRoot, "src", "assets", type);
  if (existsSync(dir)) {
    const fs = require("fs");
    const files = fs.readdirSync(dir).filter((f: string) => f.endsWith(".jpg") || f.endsWith(".png"));
    if (files.length > 0) {
      console.warn(`[video-renderer] Asset "${id}" not found, falling back to ${files[0]}`);
      return path.join(dir, files[0]);
    }
  }
  throw new Error(`Actor image not found for id: ${id}`);
}

/**
 * Build and execute an FFmpeg command.
 * Returns a promise that resolves when FFmpeg exits successfully.
 */
function runFfmpeg(args: string[], logPrefix: string): Promise<void> {
  return new Promise((resolve, reject) => {
    console.log(`[video-renderer] ${logPrefix}: ffmpeg ${args.join(" ")}`);

    const proc = spawn("ffmpeg", args, {
      stdio: ["ignore", "pipe", "pipe"],
    });

    let stderr = "";

    proc.stderr.on("data", (chunk: Buffer) => {
      stderr += chunk.toString();
      // Log progress lines from FFmpeg (they go to stderr)
      const text = chunk.toString();
      if (text.includes("time=")) {
        // Extract and log just the time= line for progress tracking
        const match = text.match(/time=(\S+)/);
        if (match) {
          console.log(`[video-renderer] ${logPrefix} progress: time=${match[1]}`);
        }
      }
    });

    proc.on("close", (code) => {
      if (code === 0) {
        console.log(`[video-renderer] ${logPrefix}: completed successfully`);
        resolve();
      } else {
        const errMsg = stderr.slice(-500) || `exit code ${code}`;
        console.error(`[video-renderer] ${logPrefix}: FAILED — ${errMsg}`);
        reject(new Error(`FFmpeg ${logPrefix} failed: ${errMsg}`));
      }
    });

    proc.on("error", (err) => {
      reject(new Error(`Failed to spawn FFmpeg: ${err.message}`));
    });
  });
}

/**
 * Split text into subtitle lines that fit on screen.
 * Returns arrays of { text, startTime, endTime } for drawtext filter.
 */
function splitSubtitles(
  text: string,
  totalDuration: number,
): Array<{ text: string; startTime: number; endTime: number }> {
  // Split into sentences or chunks of ~60 chars
  const sentences = text
    .replace(/([.!?])\s+/g, "$1\n")
    .split("\n")
    .map((s) => s.trim())
    .filter((s) => s.length > 0);

  if (sentences.length === 0) {
    return [{ text: text.slice(0, 80), startTime: 0, endTime: totalDuration }];
  }

  const timePerSentence = totalDuration / sentences.length;

  return sentences.map((sentence, i) => {
    // Truncate very long sentences
    const display = sentence.length > 100 ? sentence.slice(0, 97) + "..." : sentence;
    return {
      text: display,
      startTime: i * timePerSentence,
      endTime: (i + 1) * timePerSentence,
    };
  });
}

// ─── Main render function ───────────────────────────────────────────────

/**
 * Render a commercial video from a render job config.
 *
 * Pipeline:
 * 1. Load actor + background images
 * 2. Generate TTS audio from script via ElevenLabs
 * 3. Create composite video with Ken Burns + subtitles (silent)
 * 4. Mux video + audio into final MP4
 */
export async function renderVideo(input: RenderInput): Promise<RenderResult> {
  const { jobId, config, projectRoot } = input;

  const rendersDir = path.join(projectRoot, "dist", "client", "renders");
  await mkdir(rendersDir, { recursive: true });

  const outputPath = path.join(rendersDir, `${jobId}.mp4`);
  const outputUrl = `/renders/${jobId}.mp4`;

  // Temp directory for intermediate files
  const tmpDir = path.join(rendersDir, `.tmp-${jobId}`);
  await mkdir(tmpDir, { recursive: true });

  const actorPath = resolveAssetPath(projectRoot, "actors", config.actorId);
  const bgPath = resolveAssetPath(projectRoot, "backgrounds", config.backgroundId);

  try {
    // ── Step 1: Generate audio from script ──────────────────────────────
    console.log(`[video-renderer] Job ${jobId}: Generating TTS audio...`);
    let audioPath: string;
    let audioDuration: number;

    try {
      const speechResult = await generateSpeech(config.script, undefined, "eleven_turbo_v2_5");
      // speechResult.audioUrl is a data:audio/mpeg;base64,... string
      const base64Data = speechResult.audioUrl.replace(/^data:audio\/mpeg;base64,/, "");
      const audioBuffer = Buffer.from(base64Data, "base64");
      audioPath = path.join(tmpDir, "audio.mp3");
      await writeFile(audioPath, audioBuffer);
      audioDuration = speechResult.duration;
      console.log(
        `[video-renderer] Job ${jobId}: Audio generated, ~${audioDuration}s, ${audioBuffer.length} bytes`,
      );
    } catch (err) {
      console.warn(
        `[video-renderer] Job ${jobId}: TTS failed (${err instanceof Error ? err.message : err}), using silent audio`,
      );
      // Generate silent audio as fallback
      audioDuration = DEFAULT_DURATION_SECONDS;
      audioPath = path.join(tmpDir, "audio.mp3");
      await runFfmpeg(
        [
          "-f", "lavfi",
          "-i", `anullsrc=r=44100:cl=stereo`,
          "-t", String(audioDuration),
          "-q:a", "2",
          audioPath,
        ],
        `silent-audio-${jobId}`,
      );
    }

    const videoDuration = Math.max(audioDuration, 5); // minimum 5 seconds

    // ── Step 2: Build subtitle drawtext filters ─────────────────────────
    const subtitles = splitSubtitles(config.script, videoDuration);
    console.log(
      `[video-renderer] Job ${jobId}: Created ${subtitles.length} subtitle segments for ${videoDuration}s`,
    );

    // Build drawtext enable expressions for each subtitle
    const drawtextFilters = subtitles
      .map((sub, i) => {
        // Escape special characters for FFmpeg drawtext
        const escaped = escapeFfmpegDrawtext(sub.text);
        return (
          `drawtext=fontfile='${SUBTITLE_FONT}':` +
          `text='${escaped}':` +
          `fontsize=${SUBTITLE_FONT_SIZE}:` +
          `fontcolor=${SUBTITLE_COLOR}:` +
          `bordercolor=${SUBTITLE_BORDER_COLOR}:` +
          `borderw=2:` +
          `x=(w-text_w)/2:` +
          `y=h-text_h-60:` +
          `enable='between(t,${sub.startTime.toFixed(2)},${sub.endTime.toFixed(2)})'`
        );
      })
      .join(",");

    // ── Step 3: Create composite video with Ken Burns + subtitles ───────
    //
    // Filter chain:
    // 1. Scale background to target size
    // 2. Apply zoompan to actor for Ken Burns effect
    // 3. Overlay actor onto background
    // 4. Apply subtitle drawtext filters
    // 5. Format for H.264 output

    const silentVideoPath = path.join(tmpDir, "silent.mp4");

    // Build the filter_complex
    // Input 0: background, Input 1: actor
    const filterComplex = [
      // Scale background to exact dimensions
      `[0:v]scale=${VIDEO_WIDTH}:${VIDEO_HEIGHT}:force_original_aspect_ratio=increase,crop=${VIDEO_WIDTH}:${VIDEO_HEIGHT}[bg]`,
      // Scale actor down (to ~30% of width, positioned bottom-right area)
      // and apply zoompan for Ken Burns effect (subtle zoom in)
      `[1:v]scale=iw*0.8:ih*0.8[actor_scaled]`,
      `[actor_scaled]zoompan=z='min(zoom+0.0004,${KEN_BURNS_ZOOM_MAX})':d=1:x='iw/2-(iw/zoom/2)':y='ih/2-(ih/zoom/2)':s=${Math.floor(VIDEO_WIDTH * 0.45)}x${Math.floor(VIDEO_HEIGHT * 0.7)}[actor_zoom]`,
      // Overlay actor onto background (position: right side, vertically centered)
      `[bg][actor_zoom]overlay=x=main_w-overlay_w-60:y=(main_h-overlay_h)/2[composite]`,
      // Add subtitles
      `[composite]${drawtextFilters}[out]`,
    ].join(";");

    console.log(`[video-renderer] Job ${jobId}: Rendering composite video...`);

    await runFfmpeg(
      [
        "-loop", "1", "-i", bgPath,
        "-loop", "1", "-i", actorPath,
        "-filter_complex", filterComplex,
        "-map", "[out]",
        "-c:v", "libx264",
        "-preset", "ultrafast",
        "-crf", "23",
        "-pix_fmt", "yuv420p",
        "-t", String(videoDuration),
        "-r", String(FPS),
        "-y",
        silentVideoPath,
      ],
      `composite-${jobId}`,
    );

    // ── Step 4: Mux video + audio into final MP4 ────────────────────────
    console.log(`[video-renderer] Job ${jobId}: Muxing audio + video...`);

    await runFfmpeg(
      [
        "-i", silentVideoPath,
        "-i", audioPath,
        "-c:v", "copy",
        "-c:a", "aac",
        "-b:a", "128k",
        "-shortest",
        "-map", "0:v:0",
        "-map", "1:a:0",
        "-y",
        outputPath,
      ],
      `mux-${jobId}`,
    );

    console.log(`[video-renderer] Job ${jobId}: Render complete → ${outputPath}`);

    return { outputPath, outputUrl };
  } finally {
    // Clean up temp files (best-effort, don't throw)
    try {
      const fs = require("fs");
      fs.rmSync(tmpDir, { recursive: true, force: true });
    } catch {
      // ignore cleanup errors
    }
  }
}
