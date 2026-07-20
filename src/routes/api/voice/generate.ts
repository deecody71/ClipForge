import { createFileRoute } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

/**
 * POST /api/voice/generate
 *
 * Auth-protected endpoint that generates speech audio from text
 * using the voice service abstraction layer (ElevenLabs by default).
 *
 * Body:  { text: string }
 * Returns: { audioUrl: string, duration: number }
 *
 * Rate limit: texts longer than 5000 characters are rejected.
 * Free tier: ~10,000 characters/month via ElevenLabs.
 */

const handleGenerateVoice = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { text?: string; voiceId?: string };
    return {
      text: d.text || "",
      voiceId: d.voiceId || undefined,
    };
  })
  .handler(async ({ data }) => {
    // Auth check
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized");
    }

    const { text, voiceId } = data;

    if (!text || !text.trim()) {
      throw new Error("Text is required");
    }

    if (text.length > 5000) {
      throw new Error(
        "Text exceeds the maximum length of 5000 characters. " +
        "The ElevenLabs free tier allows ~10,000 characters per month.",
      );
    }

    const { generateSpeech } = await import("~/services/voice-service");

    const result = await generateSpeech(text, voiceId);

    return {
      audioUrl: result.audioUrl,
      duration: result.duration,
    };
  });

export const Route = createFileRoute("/api/voice/generate")({
  component: VoiceGenerateRoute,
});

function VoiceGenerateRoute() {
  // This route is not intended to render a UI.
  // It exists solely to register /api/voice/generate as a valid route.
  // Client code should call handleGenerateVoice directly.
  return null;
}

// Re-export for programmatic use from the studio
export { handleGenerateVoice };
