/**
 * Voice Service — Abstraction Layer for Text-to-Speech
 *
 * Provides a unified interface for generating speech from text.
 * Currently backed by ElevenLabs, but the abstraction makes it
 * easy to swap in a different provider later without touching
 * API routes or UI code.
 */

// ─── Public types ──────────────────────────────────────────────────────

export interface SpeechResult {
  /** Base64-encoded data URL of the generated audio (data:audio/mpeg;base64,...) */
  audioUrl: string;
  /** Duration of the generated audio in seconds (estimated) */
  duration: number;
}

export interface VoiceProvider {
  generateSpeech(text: string, voiceId?: string, modelId?: string): Promise<SpeechResult>;
}

// ─── ElevenLabs implementation ─────────────────────────────────────────

const ELEVENLABS_DEFAULT_MODEL = "eleven_turbo_v2_5"; // Fast, cost-effective model

/**
 * Free-tier fallback voice ID (Sarah — a standard premade ElevenLabs voice).
 * Used when the voices API is unreachable or returns no premade voices.
 */
const FREE_TIER_FALLBACK_VOICE = "EXAVITQu4vr4xnSDxMaL";

/** Cached default voice ID — set once on first call to avoid repeated API hits. */
let cachedDefaultVoiceId: string | null = null;
let voiceFetchPromise: Promise<string> | null = null;

/**
 * Fetch the best available voice from ElevenLabs' voices API.
 * Filters for "premade" category voices (available on free tier).
 * Results are cached in-memory for the lifetime of the server process.
 *
 * Falls back to `FREE_TIER_FALLBACK_VOICE` if the API call fails.
 */
async function getDefaultVoiceId(): Promise<string> {
  if (cachedDefaultVoiceId) return cachedDefaultVoiceId;

  // Avoid concurrent fetches — reuse the in-flight promise
  if (voiceFetchPromise) return voiceFetchPromise;

  voiceFetchPromise = (async (): Promise<string> => {
    const apiKey = process.env.ELEVENLABS_API_KEY;
    if (!apiKey) {
      console.warn("[voice-service] No ELEVENLABS_API_KEY set — using fallback voice");
      cachedDefaultVoiceId = FREE_TIER_FALLBACK_VOICE;
      return cachedDefaultVoiceId;
    }

    try {
      const res = await fetch("https://api.elevenlabs.io/v1/voices", {
        headers: { "xi-api-key": apiKey },
      });

      if (!res.ok) {
        console.warn(
          `[voice-service] Voices API returned ${res.status} — using fallback voice`,
        );
        cachedDefaultVoiceId = FREE_TIER_FALLBACK_VOICE;
        return cachedDefaultVoiceId;
      }

      const data = (await res.json()) as {
        voices?: Array<{ voice_id: string; name: string; category: string }>;
      };
      const voices = data.voices || [];

      // Filter for premade voices (available on free tier)
      const premade = voices.filter((v) => v.category === "premade");

      if (premade.length > 0) {
        const chosen = premade[0];
        console.log(
          `[voice-service] Using voice "${chosen.name}" (${chosen.voice_id}) — premade, free-tier compatible`,
        );
        cachedDefaultVoiceId = chosen.voice_id;
      } else {
        console.warn(
          "[voice-service] No premade voices found — using fallback voice",
        );
        cachedDefaultVoiceId = FREE_TIER_FALLBACK_VOICE;
      }
    } catch (err) {
      console.warn(
        `[voice-service] Voices API fetch failed: ${err instanceof Error ? err.message : err} — using fallback voice`,
      );
      cachedDefaultVoiceId = FREE_TIER_FALLBACK_VOICE;
    }

    return cachedDefaultVoiceId;
  })();

  return voiceFetchPromise;
}

const ELEVENLABS_ENDPOINT = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

async function elevenLabsGenerateSpeech(
  text: string,
  voiceId?: string,
  modelId?: string,
): Promise<SpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const vid = voiceId || (await getDefaultVoiceId());
  const mid = modelId || ELEVENLABS_DEFAULT_MODEL;

  const response = await fetch(ELEVENLABS_ENDPOINT(vid), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: mid,
      voice_settings: {
        stability: 0.5,
        similarity_boost: 0.75,
      },
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text().catch(() => "Unknown error");
    throw new Error(
      `ElevenLabs API error (${response.status}): ${errorBody.slice(0, 200)}`,
    );
  }

  const arrayBuffer = await response.arrayBuffer();
  const buffer = Buffer.from(arrayBuffer);
  const base64 = buffer.toString("base64");
  const audioUrl = `data:audio/mpeg;base64,${base64}`;

  // Estimate duration: MP3 ~16 KB/s at standard bitrate (128 kbps)
  // This is a rough estimate; for more accuracy we'd need to parse MP3 headers
  const estimatedDurationSeconds = Math.max(
    1,
    Math.round((buffer.length / (128 * 1024 / 8)) * 10) / 10,
  );

  return {
    audioUrl,
    duration: estimatedDurationSeconds,
  };
}

// ─── Provider registry / swappable backend ─────────────────────────────

let currentProvider: VoiceProvider = {
  generateSpeech: elevenLabsGenerateSpeech,
};

/**
 * Swap out the TTS provider at runtime (e.g., for testing or migrating).
 */
export function setVoiceProvider(provider: VoiceProvider): void {
  currentProvider = provider;
}

/**
 * Get the currently active voice provider (for introspection/testing).
 */
export function getVoiceProvider(): VoiceProvider {
  return currentProvider;
}

// ─── Public API (what the rest of the app uses) ────────────────────────

/**
 * Generate speech audio from text.
 *
 * @param text    The text to convert to speech (max ~5000 characters for free tier).
 * @param voiceId Optional voice ID. Defaults to a free-tier ElevenLabs premade voice.
 * @returns       A Promise resolving to { audioUrl, duration }.
 *
 * NOTE: The free ElevenLabs tier allows ~10,000 characters per month.
 *       Characters beyond that will be rejected by their API.
 */
export async function generateSpeech(
  text: string,
  voiceId?: string,
  modelId?: string,
): Promise<SpeechResult> {
  if (!text || !text.trim()) {
    throw new Error("Text is required for speech generation");
  }

  if (text.length > 5000) {
    throw new Error("Text exceeds the maximum length of 5000 characters");
  }

  return currentProvider.generateSpeech(text.trim(), voiceId, modelId);
}
