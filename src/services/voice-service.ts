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
  generateSpeech(text: string, voiceId?: string): Promise<SpeechResult>;
}

// ─── ElevenLabs implementation ─────────────────────────────────────────

const ELEVENLABS_DEFAULT_VOICE = "21m00Tcm4TlvDq8ikWAM"; // Rachel — natural American female

const ELEVENLABS_ENDPOINT = (voiceId: string) =>
  `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`;

async function elevenLabsGenerateSpeech(
  text: string,
  voiceId?: string,
): Promise<SpeechResult> {
  const apiKey = process.env.ELEVENLABS_API_KEY;
  if (!apiKey) {
    throw new Error("ELEVENLABS_API_KEY is not set");
  }

  const vid = voiceId || ELEVENLABS_DEFAULT_VOICE;

  const response = await fetch(ELEVENLABS_ENDPOINT(vid), {
    method: "POST",
    headers: {
      "xi-api-key": apiKey,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      text,
      model_id: "eleven_monolingual_v1",
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
 * @param voiceId Optional voice ID. Defaults to ElevenLabs "Rachel".
 * @returns       A Promise resolving to { audioUrl, duration }.
 *
 * NOTE: The free ElevenLabs tier allows ~10,000 characters per month.
 *       Characters beyond that will be rejected by their API.
 */
export async function generateSpeech(
  text: string,
  voiceId?: string,
): Promise<SpeechResult> {
  if (!text || !text.trim()) {
    throw new Error("Text is required for speech generation");
  }

  if (text.length > 5000) {
    throw new Error("Text exceeds the maximum length of 5000 characters");
  }

  return currentProvider.generateSpeech(text.trim(), voiceId);
}
