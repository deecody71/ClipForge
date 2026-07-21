import { useState, useRef, useEffect, type ReactNode } from "react";
import { createServerFn } from "@tanstack/react-start";

// ── AI Assist server function (template-based) ──

const aiAssist = createServerFn({ method: "POST" })
  .validator((input: unknown) => {
    if (typeof input === "object" && input !== null && "message" in input && typeof (input as { message: string }).message === "string") {
      return input as { message: string };
    }
    throw new Error("Invalid input");
  })
  .handler(async ({ data }) => {
    const msg = data.message.toLowerCase().trim();

    // Template-based response matching
    const responses: { patterns: RegExp[]; answer: string }[] = [
      {
        patterns: [/how.*(render|create|make).*(video|commercial)/i, /start.*(render|creating)/i],
        answer:
          "To render a commercial, head to the Studio page, pick your AI actor, write or paste your script, choose a background, and click 'Create Commercial'. Once submitted, your job will enter the render queue — typical render time is 2-5 minutes. You can track progress on the Rendering page.",
      },
      {
        patterns: [/voice/i, /speak/i, /audio/i],
        answer:
          "ClipForge uses AI text-to-speech voices for your commercials. In the Studio, after writing your script, you can select a voice from several options (male, female, neutral tones) that best matches your brand. The AI actor will lip-sync to the generated audio.",
      },
      {
        patterns: [/actor/i, /avatar/i, /character/i],
        answer:
          "ClipForge offers a growing library of AI-generated actors — including human characters and fun animal mascots! You can browse available actors in the Studio. Pick one that fits your brand personality, and they'll deliver your script naturally.",
      },
      {
        patterns: [/price|cost|plan|subscription|billing/i],
        answer:
          "ClipForge has simple pricing: $20/month for businesses with variable needs, or $200/year (about $16.67/month) for committed users. No per-video fees — create unlimited commercials! You can sign up at /signup to get started.",
      },
      {
        patterns: [/background/i, /scene/i, /setting/i],
        answer:
          "In the Studio, you can choose from a variety of AI-generated backgrounds — office settings, outdoor scenes, studio backdrops, and more. Pick one that matches the tone of your commercial for a polished, professional look.",
      },
      {
        patterns: [/share|distribut|publish|social|sms/i],
        answer:
          "Once your commercial is rendered, you can share it via SMS distribution right from the Distribution page. Full social media publishing (Facebook, Instagram, YouTube, etc.) is coming in Phase 2. For now, you can download the video and upload it manually to your social channels.",
      },
      {
        patterns: [/script/i, /write/i, /text/i],
        answer:
          "Writing a script is easy — just type or paste your commercial text into the script box in the Studio. Keep it under 2 minutes of spoken content (roughly 250-300 words). You can also use our AI script assistant to generate a draft based on your product or service description.",
      },
      {
        patterns: [/help/i, /support/i, /contact/i],
        answer:
          "I'm ClipForge's AI assistant — I can answer questions about creating commercials, pricing, actors, rendering, and more! Just ask me anything. If you need human support, our team monitors feedback and responds within 24 hours.",
      },
    ];

    for (const { patterns, answer } of responses) {
      if (patterns.some((p) => p.test(msg))) {
        return { reply: answer };
      }
    }

    return {
      reply:
        "That's a great question! I'm a template-based assistant right now, so I may not have the perfect answer. Try asking about: creating commercials, rendering, actors/voices, pricing, backgrounds, scripts, or sharing your videos. I'm here to help!",
    };
  });

// ── Types ──

type Tab = "faq" | "tutorial" | "assist";

interface ChatMessage {
  role: "user" | "assistant";
  text: string;
}

// ── FAQ Data ──

const FAQ_ITEMS = [
  {
    q: "How do I create my first commercial?",
    a: "Go to the Studio page, pick an AI actor, write your script, choose a background, and click 'Create Commercial'. Your video will be queued for rendering — it usually takes 2-5 minutes. You can track progress on the Rendering page.",
  },
  {
    q: "What AI actors are available?",
    a: "ClipForge offers a growing library of AI-generated actors including diverse human characters and fun animal mascots. Browse available actors in the Studio and pick the one that best fits your brand personality.",
  },
  {
    q: "How much does ClipForge cost?",
    a: "ClipForge is $20/month for month-to-month flexibility, or $200/year (about $16.67/month) for committed users. There are no per-video fees — you can create unlimited commercials on any plan.",
  },
  {
    q: "How long does rendering take?",
    a: "Typical render time is 2-5 minutes depending on video length and queue load. You'll see a live status on the Rendering page with real-time updates from queued → processing → completed.",
  },
  {
    q: "Can I share my commercial on social media?",
    a: "Full social media publishing (Facebook, Instagram, YouTube, etc.) is coming in Phase 2. Right now you can share via SMS from the Distribution page, or download your video and upload it to social platforms manually.",
  },
];

// ── Tutorial Steps ──

const TUTORIAL_STEPS = [
  {
    title: "1. Pick Your Actor",
    description:
      "Browse the AI actor library in the Studio. Choose from human characters or fun animal mascots. Each actor has a preview so you can see how they look and move before making your selection.",
    icon: "🎭",
  },
  {
    title: "2. Write Your Script",
    description:
      "Type or paste your commercial script into the text box. Keep it under 2 minutes (roughly 250-300 words). Need help? Use the AI script assistant to generate a draft from your product description.",
    icon: "✍️",
  },
  {
    title: "3. Choose a Background",
    description:
      "Select an AI-generated background that matches your brand — office, outdoor, studio, or abstract scenes. The background helps set the tone and professionalism of your commercial.",
    icon: "🖼️",
  },
  {
    title: "4. Select Voice & Render",
    description:
      "Pick a voice for your actor from the available text-to-speech options. Then click 'Create Commercial' to submit your job. Your video enters the render queue and is typically ready in 2-5 minutes.",
    icon: "🎙️",
  },
  {
    title: "5. Share Your Commercial",
    description:
      "Once rendered, watch your commercial and share it! Use the Distribution page for SMS sharing, or download the video file for manual upload to social platforms. Analytics help you track performance.",
    icon: "🚀",
  },
];

// ── HelpPanel Component ──

export function HelpPanel() {
  const [open, setOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<Tab>("faq");
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([
    { role: "assistant", text: "Hi! I'm ClipForge's AI assistant. Ask me anything about creating commercials, pricing, rendering, actors, scripts, and more — I'm here to help!" },
  ]);
  const [chatInput, setChatInput] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const chatEndRef = useRef<HTMLDivElement>(null);

  const toggleOpen = () => setOpen((o) => !o);

  // Close on Escape
  useEffect(() => {
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape" && open) setOpen(false);
    };
    window.addEventListener("keydown", handleKey);
    return () => window.removeEventListener("keydown", handleKey);
  }, [open]);

  // Auto-scroll chat to bottom
  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [chatMessages]);

  const handleChatSend = async () => {
    const text = chatInput.trim();
    if (!text || chatLoading) return;
    setChatInput("");
    setChatMessages((prev) => [...prev, { role: "user", text }]);
    setChatLoading(true);
    try {
      const result = await aiAssist({ message: text });
      setChatMessages((prev) => [...prev, { role: "assistant", text: result.reply }]);
    } catch {
      setChatMessages((prev) => [
        ...prev,
        { role: "assistant", text: "Sorry, I ran into an issue. Please try again!" },
      ]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleChatKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleChatSend();
    }
  };

  return (
    <>
      {/* Floating help button */}
      <button
        onClick={toggleOpen}
        aria-label={open ? "Close help panel" : "Open help panel"}
        className={`fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-all duration-200 ${
          open
            ? "bg-gray-700 text-gray-300 hover:bg-gray-600 rotate-45"
            : "bg-indigo-600 text-white hover:bg-indigo-500"
        }`}
      >
        <svg className="h-7 w-7" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
        </svg>
      </button>

      {/* Backdrop */}
      {open && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity"
          onClick={toggleOpen}
        />
      )}

      {/* Slide-out panel */}
      <div
        className={`fixed bottom-0 right-0 top-0 z-40 w-full max-w-md transform border-l border-gray-700 bg-gray-900 shadow-2xl transition-transform duration-300 ease-in-out sm:top-0 ${
          open ? "translate-x-0" : "translate-x-full"
        }`}
      >
        {/* Header */}
        <div className="flex items-center justify-between border-b border-gray-700 px-6 py-4">
          <h2 className="text-lg font-semibold text-white">Help & Tutorials</h2>
          <button
            onClick={toggleOpen}
            className="rounded-lg p-1.5 text-gray-400 hover:bg-gray-800 hover:text-white transition-colors"
            aria-label="Close panel"
          >
            <svg className="h-5 w-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-700">
          {([
            ["faq", "FAQ"],
            ["tutorial", "Tutorial"],
            ["assist", "AI Assist"],
          ] as [Tab, string][]).map(([tab, label]) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-indigo-500 text-indigo-400"
                  : "text-gray-500 hover:text-gray-300"
              }`}
            >
              {label}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="h-[calc(100%-140px)] overflow-y-auto p-6">
          {activeTab === "faq" && <FaqTab expandedFaq={expandedFaq} setExpandedFaq={setExpandedFaq} />}
          {activeTab === "tutorial" && <TutorialTab />}
          {activeTab === "assist" && (
            <AssistTab
              chatMessages={chatMessages}
              chatInput={chatInput}
              chatLoading={chatLoading}
              setChatInput={setChatInput}
              handleChatSend={handleChatSend}
              handleChatKeyDown={handleChatKeyDown}
              chatEndRef={chatEndRef}
            />
          )}
        </div>
      </div>
    </>
  );
}

// ── Sub-components ──

function FaqTab({
  expandedFaq,
  setExpandedFaq,
}: {
  expandedFaq: number | null;
  setExpandedFaq: (idx: number | null) => void;
}) {
  return (
    <div className="space-y-3">
      <p className="text-sm text-gray-400 mb-4">
        Common questions about using ClipForge. Click a question to see the answer.
      </p>
      {FAQ_ITEMS.map((item, idx) => {
        const isOpen = expandedFaq === idx;
        return (
          <div
            key={idx}
            className="rounded-xl border border-gray-800 bg-gray-900/50 overflow-hidden"
          >
            <button
              onClick={() => setExpandedFaq(isOpen ? null : idx)}
              className="flex w-full items-center justify-between px-4 py-3 text-left text-sm font-medium text-gray-200 hover:bg-gray-800/50 transition-colors"
            >
              <span>{item.q}</span>
              <svg
                className={`h-4 w-4 text-gray-500 transition-transform ${isOpen ? "rotate-180" : ""}`}
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
              </svg>
            </button>
            {isOpen && (
              <div className="border-t border-gray-800 px-4 py-3">
                <p className="text-sm text-gray-400 leading-relaxed">{item.a}</p>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

function TutorialTab() {
  return (
    <div className="space-y-1">
      <p className="text-sm text-gray-400 mb-4">
        Follow this step-by-step guide to create your first AI-powered commercial.
      </p>
      <div className="relative">
        {/* Vertical line */}
        <div className="absolute left-5 top-0 bottom-0 w-px bg-gray-800" />
        <div className="space-y-6">
          {TUTORIAL_STEPS.map((step, idx) => (
            <div key={idx} className="relative flex gap-4 pl-2">
              <div className="relative z-10 flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-gray-800 text-lg">
                {step.icon}
              </div>
              <div className="pt-1">
                <h3 className="text-sm font-semibold text-white">{step.title}</h3>
                <p className="mt-1 text-sm text-gray-400 leading-relaxed">{step.description}</p>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function AssistTab({
  chatMessages,
  chatInput,
  chatLoading,
  setChatInput,
  handleChatSend,
  handleChatKeyDown,
  chatEndRef,
}: {
  chatMessages: ChatMessage[];
  chatInput: string;
  chatLoading: boolean;
  setChatInput: (v: string) => void;
  handleChatSend: () => void;
  handleChatKeyDown: (e: React.KeyboardEvent) => void;
  chatEndRef: React.RefObject<HTMLDivElement | null>;
}) {
  return (
    <div className="flex flex-col h-full">
      <p className="text-sm text-gray-400 mb-4">
        Ask me anything about ClipForge — creating commercials, pricing, actors, rendering, and more.
      </p>

      {/* Chat messages */}
      <div className="flex-1 space-y-3 overflow-y-auto mb-4 min-h-0">
        {chatMessages.map((msg, idx) => (
          <div
            key={idx}
            className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
          >
            <div
              className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed ${
                msg.role === "user"
                  ? "bg-indigo-600 text-white"
                  : "bg-gray-800 text-gray-200"
              }`}
            >
              {msg.text}
            </div>
          </div>
        ))}
        {chatLoading && (
          <div className="flex justify-start">
            <div className="max-w-[85%] rounded-2xl bg-gray-800 px-4 py-2.5">
              <div className="flex items-center gap-2">
                <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400 [animation-delay:0.2s]" />
                <span className="h-2 w-2 animate-pulse rounded-full bg-indigo-400 [animation-delay:0.4s]" />
              </div>
            </div>
          </div>
        )}
        <div ref={chatEndRef} />
      </div>

      {/* Chat input */}
      <div className="flex gap-2">
        <input
          type="text"
          value={chatInput}
          onChange={(e) => setChatInput(e.target.value)}
          onKeyDown={handleChatKeyDown}
          placeholder="Ask a question..."
          className="flex-1 rounded-xl border border-gray-700 bg-gray-800 px-4 py-2.5 text-sm text-white placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        />
        <button
          onClick={handleChatSend}
          disabled={!chatInput.trim() || chatLoading}
          className="rounded-xl bg-indigo-600 px-4 py-2.5 text-white hover:bg-indigo-500 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
          aria-label="Send message"
        >
          <svg className="h-4 w-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 12 3.269 3.125A59.769 59.769 0 0 1 21.485 12 59.768 59.768 0 0 1 3.27 20.875L5.999 12Zm0 0h7.5" />
          </svg>
        </button>
      </div>
    </div>
  );
}
