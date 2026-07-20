import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { useState, useEffect, useCallback, useRef } from "react";
import { verifyToken, TOKEN_COOKIE } from "~/auth";

// ─── Actor images ──────────────────────────────────────────────────────────
import professionalMaleImg from "../assets/actors/professional-male.jpg";
import friendlyFemaleImg from "../assets/actors/friendly-female.jpg";
import seniorExpertImg from "../assets/actors/senior-expert.jpg";
import youngCreatorImg from "../assets/actors/young-creator.jpg";
import casualMaleImg from "../assets/actors/casual-male.jpg";
import warmFemaleImg from "../assets/actors/warm-female.jpg";
import goldenRetrieverImg from "../assets/actors/golden-retriever.jpg";
import tabbyCatImg from "../assets/actors/tabby-cat.jpg";
import borderCollieImg from "../assets/actors/border-collie.jpg";

// ─── Auth-protected loader ─────────────────────────────────────────────
const getCurrentUser = createServerFn({ method: "GET" }).handler(async () => {
  const { getCookie } = await import("@tanstack/react-start/server");
  const token = getCookie(TOKEN_COOKIE);
  if (!token) return null;
  const payload = verifyToken(token);
  if (!payload) return null;
  return { userId: payload.userId, email: payload.email, name: payload.name };
});

// ─── Script generation server fn ───────────────────────────────────────
const generateScript = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as { product: string; tone: string };
    return {
      product: d.product || "",
      tone: d.tone || "Professional",
    };
  })
  .handler(async ({ data }) => {
    // Verify auth
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized");
    }

    const { product, tone } = data;
    const scripts: Record<string, string> = {
      Professional: `[SCENE 1]
(Professional Male/Female stands in a modern office, confident posture)

"Welcome. In today's fast-paced world, you need solutions that work as hard as you do. That's exactly why we created ${product || "[Your Product]"}."

[SCENE 2]
(Close-up of the actor, warm but authoritative eye contact)

"We spent years perfecting every detail — so you don't have to. From seamless onboarding to enterprise-grade reliability, ${product || "[Your Product]"} delivers results you can measure."

[CALL TO ACTION]
(Actor walks toward camera, text overlay appears)

"Try ${product || "[Your Product]"} risk-free for 30 days. Visit our website or call today — your next level starts now."`,
      Friendly: `[SCENE 1]
(Friendly Female/Male smiles warmly in a bright living room)

"Hey there! 👋 I'm so excited to tell you about something that's honestly changed the game for me — ${product || "[Your Product]"}."

[SCENE 2]
(Actor sits casually on a couch, speaking conversationally)

"You know that feeling when you find something that just... works? That's ${product || "[Your Product]"}. No complicated setup, no stress — just the easiest experience you've ever had with a product like this."

[CALL TO ACTION]
(Actor waves at the camera cheerfully)

"So what are you waiting for? Give ${product || "[Your Product]"} a try today — I promise you won't regret it. Click the link below and let's get started together! 💫"`,
      Urgent: `[SCENE 1]
(Actor stands in a dark studio, dramatic lighting, intense expression)

"Time. It's the one thing you can't get back. Every day without ${product || "[Your Product]"} is a day you're leaving results on the table."

[SCENE 2]
(Fast cuts between the actor and quick shots of the product/service in action)

"This isn't just another tool — it's the competitive advantage your business has been missing. While your competitors are stuck in the past, you could be miles ahead."

[CALL TO ACTION]
(Actor steps closer, voice drops to a determined tone)

"The opportunity is now. Don't let it slip away. Get ${product || "[Your Product]"} today — before your competition does."`,
      Humorous: `[SCENE 1]
(Actor trips slightly entering the frame, catches themselves with a grin)

"Well... that's not exactly how I planned to start this. 😅 But hey, life's a little messy — luckily, ${product || "[Your Product]"} makes it way easier to handle."

[SCENE 2]
(Actor gestures at an absurdly overcomplicated whiteboard full of scribbles)

"See this? This is what solving your problem used to look like. Crazy, right? Now watch this..." (Actor dramatically erases the board to reveal a clean, simple message)

[CALL TO ACTION]
(Actor shrugs with a knowing smile)

"Moral of the story: don't make things harder than they need to be. Grab ${product || "[Your Product]"} and make your life 10x easier. You're welcome. 😉"`,
    };

    const result =
      scripts[tone] ||
      scripts["Professional"];

    return {
      script: result,
      note: "AI script generation will be connected in the next phase.",
    };
  });

// ─── Render queue server fn ────────────────────────────────────────────
const queueRender = createServerFn({ method: "POST" })
  .validator((data: unknown) => {
    const d = data as {
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
    };
    return {
      actorId: d.actorId || "",
      actorName: d.actorName || "",
      actorEmoji: d.actorEmoji || "",
      actorColor: d.actorColor || "",
      backgroundId: d.backgroundId || "",
      backgroundName: d.backgroundName || "",
      backgroundGradient: d.backgroundGradient || "",
      customBgPrompt: d.customBgPrompt || "",
      script: d.script || "",
      tone: d.tone || "",
      productDescription: d.productDescription || "",
    };
  })
  .handler(async ({ data }) => {
    const { getCookie } = await import("@tanstack/react-start/server");
    const token = getCookie(TOKEN_COOKIE);
    if (!token || !verifyToken(token)) {
      throw new Error("Unauthorized");
    }

    const payload = verifyToken(token);
    if (!payload) {
      throw new Error("Unauthorized");
    }

    const { enqueueRender } = await import("~/services/render-queue");

    const config = {
      actorId: data.actorId,
      actorName: data.actorName,
      actorEmoji: data.actorEmoji,
      actorColor: data.actorColor,
      backgroundId: data.backgroundId,
      backgroundName: data.backgroundName,
      backgroundGradient: data.backgroundGradient,
      customBgPrompt: data.customBgPrompt || undefined,
      script: data.script,
      tone: data.tone,
      productDescription: data.productDescription || undefined,
    };

    const job = await enqueueRender(payload.userId, config);

    return {
      jobId: job.id,
      status: job.status,
      message: "Your commercial is rendering! You'll be redirected to track progress.",
    };
  });

// ─── Data: Actors ──────────────────────────────────────────────────────
interface Actor {
  id: string;
  name: string;
  category: "human" | "animal";
  emoji: string;
  color: string;
  imgSrc: string;
}

const humanActors: Actor[] = [
  { id: "human-1", name: "Professional Male", category: "human", emoji: "👨‍💼", color: "from-blue-600 to-blue-800", imgSrc: professionalMaleImg },
  { id: "human-2", name: "Friendly Female", category: "human", emoji: "👩‍🦰", color: "from-pink-500 to-rose-700", imgSrc: friendlyFemaleImg },
  { id: "human-3", name: "Senior Expert", category: "human", emoji: "👴", color: "from-gray-500 to-gray-700", imgSrc: seniorExpertImg },
  { id: "human-4", name: "Young Creator", category: "human", emoji: "🧑‍🎤", color: "from-purple-500 to-violet-700", imgSrc: youngCreatorImg },
  { id: "human-5", name: "Casual Male", category: "human", emoji: "👨", color: "from-emerald-500 to-teal-700", imgSrc: casualMaleImg },
  { id: "human-6", name: "Warm Female", category: "human", emoji: "👩‍🦱", color: "from-amber-500 to-orange-700", imgSrc: warmFemaleImg },
];

const animalActors: Actor[] = [
  { id: "animal-1", name: "Golden Retriever", category: "animal", emoji: "🐕", color: "from-yellow-500 to-yellow-700", imgSrc: goldenRetrieverImg },
  { id: "animal-2", name: "Tabby Cat", category: "animal", emoji: "🐈", color: "from-orange-400 to-orange-600", imgSrc: tabbyCatImg },
  { id: "animal-3", name: "Border Collie", category: "animal", emoji: "🐕‍🦺", color: "from-slate-600 to-slate-800", imgSrc: borderCollieImg },
];

const allActors = [...humanActors, ...animalActors];

// ─── Data: Backgrounds ─────────────────────────────────────────────────
interface Background {
  id: string;
  name: string;
  emoji: string;
  gradient: string;
}

const backgrounds: Background[] = [
  { id: "bg-1", name: "Modern Office", emoji: "🏢", gradient: "from-slate-600 to-slate-800" },
  { id: "bg-2", name: "City Street", emoji: "🏙️", gradient: "from-blue-700 to-indigo-900" },
  { id: "bg-3", name: "Nature Park", emoji: "🌳", gradient: "from-green-500 to-emerald-700" },
  { id: "bg-4", name: "Product Studio", emoji: "📸", gradient: "from-neutral-600 to-neutral-800" },
  { id: "bg-5", name: "Living Room", emoji: "🛋️", gradient: "from-amber-600 to-orange-800" },
  { id: "bg-6", name: "Beach Sunset", emoji: "🏖️", gradient: "from-orange-400 via-pink-500 to-purple-600" },
  { id: "bg-7", name: "Abstract Gradient", emoji: "🎨", gradient: "from-violet-500 via-fuchsia-500 to-cyan-500" },
  { id: "bg-8", name: "Kitchen", emoji: "🍳", gradient: "from-yellow-600 to-red-600" },
];

// ─── Tone options ──────────────────────────────────────────────────────
const toneOptions = ["Professional", "Friendly", "Urgent", "Humorous"];

// ─── Scene extraction helper ───────────────────────────────────────────
function extractScenes(script: string): { label: string; text: string }[] {
  const scenes: { label: string; text: string }[] = [];
  const regex = /\[(SCENE \d+|CALL TO ACTION)]\s*([\s\S]*?)(?=\[(?:SCENE \d+|CALL TO ACTION)]|$)/g;
  let match;
  while ((match = regex.exec(script)) !== null) {
    scenes.push({ label: match[1], text: match[2].trim() });
  }
  return scenes;
}

// ─── Page component ────────────────────────────────────────────────────
export const Route = createFileRoute("/studio")({
  loader: () => getCurrentUser(),
  component: StudioPage,
});

function StudioPage() {
  const user = Route.useLoaderData();
  const navigate = Route.useNavigate();

  // Auth guard
  useEffect(() => {
    if (!user) {
      navigate({ to: "/login" });
    }
  }, [user, navigate]);

  // ── State ──────────────────────────────────────────────────────────
  const [activeTab, setActiveTab] = useState<"actors" | "preview" | "script">("actors");
  const [actorCategory, setActorCategory] = useState<"human" | "animal">("human");
  const [selectedActor, setSelectedActor] = useState<Actor | null>(humanActors[0]);
  const [selectedBg, setSelectedBg] = useState<Background | null>(backgrounds[0]);
  const [customBgPrompt, setCustomBgPrompt] = useState("");
  const [customBgActive, setCustomBgActive] = useState(false);

  // Script state
  const [productDescription, setProductDescription] = useState("");
  const [scriptTone, setScriptTone] = useState("Professional");
  const [script, setScript] = useState("");
  const [scriptNote, setScriptNote] = useState("");
  const [generating, setGenerating] = useState(false);

  // Preview state
  const [activeScene, setActiveScene] = useState(0);
  const [previewPlaying, setPreviewPlaying] = useState(false);
  const [fadeTransition, setFadeTransition] = useState(false);
  const previewTimer = useRef<ReturnType<typeof setInterval> | null>(null);

  // Render state
  const [rendering, setRendering] = useState(false);
  const [renderToast, setRenderToast] = useState<string | null>(null);

  // Toast auto-dismiss
  useEffect(() => {
    if (renderToast) {
      const t = setTimeout(() => setRenderToast(null), 6000);
      return () => clearTimeout(t);
    }
  }, [renderToast]);

  // ── Derived ────────────────────────────────────────────────────────
  const scenes = extractScenes(script);

  // ── Handlers ────────────────────────────────────────────────────────
  const handleGenerateScript = async () => {
    if (!productDescription.trim()) return;
    setGenerating(true);
    try {
      const result = await generateScript({
        product: productDescription,
        tone: scriptTone,
      });
      setScript(result.script);
      setScriptNote(result.note);
      setActiveScene(0);
    } catch (err) {
      console.error("Script generation failed:", err);
    } finally {
      setGenerating(false);
    }
  };

  const handleRender = async () => {
    if (!selectedActor || !script.trim()) return;
    setRendering(true);
    try {
      const effectiveBg = customBgActive
        ? { id: "custom", name: customBgPrompt || "Custom", gradient: "from-purple-600 via-fuchsia-500 to-indigo-600" }
        : selectedBg || backgrounds[0];

      const result = await queueRender({
        actorId: selectedActor.id,
        actorName: selectedActor.name,
        actorEmoji: selectedActor.emoji,
        actorColor: selectedActor.color,
        backgroundId: effectiveBg.id,
        backgroundName: effectiveBg.name,
        backgroundGradient: effectiveBg.gradient,
        customBgPrompt: customBgActive ? customBgPrompt : undefined,
        script,
        tone: scriptTone,
        productDescription,
      });
      // Navigate to rendering status page
      navigate({ to: "/rendering/$jobId", params: { jobId: result.jobId } });
    } catch (err) {
      console.error("Render queue failed:", err);
      setRenderToast("Failed to start render. Please try again.");
      setRendering(false);
    }
  };

  const startPreview = useCallback(() => {
    if (scenes.length === 0) return;
    setPreviewPlaying(true);
    setActiveScene(0);
    let idx = 0;
    previewTimer.current = setInterval(() => {
      idx = (idx + 1) % scenes.length;
      setFadeTransition(true);
      setTimeout(() => {
        setActiveScene(idx);
        setFadeTransition(false);
      }, 300);
    }, 2500);
  }, [scenes]);

  const stopPreview = useCallback(() => {
    setPreviewPlaying(false);
    if (previewTimer.current) {
      clearInterval(previewTimer.current);
      previewTimer.current = null;
    }
  }, []);

  useEffect(() => {
    return () => {
      if (previewTimer.current) clearInterval(previewTimer.current);
    };
  }, []);

  // ── Auth guard render ──────────────────────────────────────────────
  if (!user) return null;

  const filteredActors = actorCategory === "human" ? humanActors : animalActors;

  // ── Render ──────────────────────────────────────────────────────────
  return (
    <div className="flex min-h-[calc(100dvh-65px)] bg-gray-950">
      {/* Toast */}
      {renderToast && (
        <div className="fixed top-20 right-6 z-[100] animate-slide-in rounded-xl border border-green-500/30 bg-green-500/10 px-5 py-3 shadow-2xl backdrop-blur-md">
          <div className="flex items-center gap-2">
            <span className="text-lg">🎉</span>
            <div>
              <p className="text-sm font-semibold text-green-300">Render Queued</p>
              <p className="text-xs text-green-400/80">{renderToast}</p>
            </div>
            <button onClick={() => setRenderToast(null)} className="ml-2 text-gray-400 hover:text-white">
              ✕
            </button>
          </div>
        </div>
      )}

      {/* ── Desktop layout: 3 columns ── */}
      <div className="hidden w-full lg:flex">
        {/* Left: Actor & Background */}
        <div className="w-80 flex-shrink-0 border-r border-gray-800 bg-gray-950 p-5 overflow-y-auto">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Actor & Background</h2>
            <Link
              to="/dashboard"
              className="text-xs text-gray-500 hover:text-gray-300 transition-colors"
            >
              ← Dashboard
            </Link>
          </div>
          <ActorPanel
            actorCategory={actorCategory}
            setActorCategory={setActorCategory}
            filteredActors={filteredActors}
            selectedActor={selectedActor}
            setSelectedActor={setSelectedActor}
            backgrounds={backgrounds}
            selectedBg={selectedBg}
            setSelectedBg={setSelectedBg}
            customBgPrompt={customBgPrompt}
            setCustomBgPrompt={setCustomBgPrompt}
            customBgActive={customBgActive}
            setCustomBgActive={setCustomBgActive}
          />
        </div>

        {/* Center: Preview */}
        <div className="flex-1 flex flex-col p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-lg font-bold text-white">Preview</h2>
            <button
              onClick={handleRender}
              disabled={rendering || !script.trim() || !selectedActor}
              className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-6 py-3 text-sm font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
            >
              {rendering ? (
                <>
                  <Spinner /> Rendering...
                </>
              ) : (
                <>
                  🎬 Render Commercial
                </>
              )}
            </button>
          </div>
          <PreviewPanel
            customBgActive={customBgActive}
            customBgPrompt={customBgPrompt}
            selectedBg={selectedBg}
            selectedActor={selectedActor}
            fadeTransition={fadeTransition}
            scenes={scenes}
            activeScene={activeScene}
            setActiveScene={setActiveScene}
            script={script}
            previewPlaying={previewPlaying}
            startPreview={startPreview}
            stopPreview={stopPreview}
          />
        </div>

        {/* Right: Script */}
        <div className="w-80 flex-shrink-0 border-l border-gray-800 bg-gray-950 p-5 overflow-y-auto">
          <h2 className="mb-4 text-lg font-bold text-white">Script Assistant</h2>
          <ScriptPanel
            productDescription={productDescription}
            setProductDescription={setProductDescription}
            scriptTone={scriptTone}
            setScriptTone={setScriptTone}
            toneOptions={toneOptions}
            generating={generating}
            onGenerateScript={handleGenerateScript}
            script={script}
            setScript={setScript}
            scriptNote={scriptNote}
          />
        </div>
      </div>

      {/* ── Mobile layout: tabs ── */}
      <div className="flex w-full flex-col lg:hidden">
        {/* Tab bar */}
        <div className="flex border-b border-gray-800 bg-gray-950">
          {(["actors", "preview", "script"] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? "border-b-2 border-indigo-500 text-white"
                  : "text-gray-500"
              }`}
            >
              {tab === "actors" && "🎭 Actor/BG"}
              {tab === "preview" && "🎬 Preview"}
              {tab === "script" && "📝 Script"}
            </button>
          ))}
        </div>

        {/* Tab content */}
        <div className="flex-1 overflow-y-auto p-4">
          {activeTab === "actors" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Actor & Background</h2>
                <Link
                  to="/dashboard"
                  className="text-xs text-gray-500 hover:text-gray-300"
                >
                  ← Dashboard
                </Link>
              </div>
              <ActorPanel
                actorCategory={actorCategory}
                setActorCategory={setActorCategory}
                filteredActors={filteredActors}
                selectedActor={selectedActor}
                setSelectedActor={setSelectedActor}
                backgrounds={backgrounds}
                selectedBg={selectedBg}
                setSelectedBg={setSelectedBg}
                customBgPrompt={customBgPrompt}
                setCustomBgPrompt={setCustomBgPrompt}
                customBgActive={customBgActive}
                setCustomBgActive={setCustomBgActive}
              />
            </div>
          )}

          {activeTab === "preview" && (
            <div>
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-lg font-bold text-white">Preview</h2>
                <button
                  onClick={handleRender}
                  disabled={rendering || !script.trim() || !selectedActor}
                  className="flex items-center gap-2 rounded-xl bg-gradient-to-r from-indigo-600 to-purple-600 px-4 py-2 text-xs font-bold text-white shadow-lg shadow-indigo-600/30 transition-all hover:from-indigo-500 hover:to-purple-500 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none"
                >
                  {rendering ? (
                    <>
                      <Spinner /> ...
                    </>
                  ) : (
                    <>
                      🎬 Render
                    </>
                  )}
                </button>
              </div>
              <div className="h-[60vh]">
                <PreviewPanel
                  customBgActive={customBgActive}
                  customBgPrompt={customBgPrompt}
                  selectedBg={selectedBg}
                  selectedActor={selectedActor}
                  fadeTransition={fadeTransition}
                  scenes={scenes}
                  activeScene={activeScene}
                  setActiveScene={setActiveScene}
                  script={script}
                  previewPlaying={previewPlaying}
                  startPreview={startPreview}
                  stopPreview={stopPreview}
                />
              </div>
            </div>
          )}

          {activeTab === "script" && (
            <div>
              <h2 className="mb-4 text-lg font-bold text-white">Script Assistant</h2>
              <ScriptPanel
                productDescription={productDescription}
                setProductDescription={setProductDescription}
                scriptTone={scriptTone}
                setScriptTone={setScriptTone}
                toneOptions={toneOptions}
                generating={generating}
                onGenerateScript={handleGenerateScript}
                script={script}
                setScript={setScript}
                scriptNote={scriptNote}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

// ═══════════════════════════════════════════════════════════════════════════
// Standalone sub-components (extracted to avoid remount-on-render bug)
// ═══════════════════════════════════════════════════════════════════════════

interface ActorPanelProps {
  actorCategory: "human" | "animal";
  setActorCategory: (cat: "human" | "animal") => void;
  filteredActors: Actor[];
  selectedActor: Actor | null;
  setSelectedActor: (actor: Actor) => void;
  backgrounds: Background[];
  selectedBg: Background | null;
  setSelectedBg: (bg: Background) => void;
  customBgPrompt: string;
  setCustomBgPrompt: (val: string) => void;
  customBgActive: boolean;
  setCustomBgActive: (val: boolean) => void;
}

function ActorPanel({
  actorCategory,
  setActorCategory,
  filteredActors,
  selectedActor,
  setSelectedActor,
  backgrounds,
  selectedBg,
  setSelectedBg,
  customBgPrompt,
  setCustomBgPrompt,
  customBgActive,
  setCustomBgActive,
}: ActorPanelProps) {
  return (
    <div className="space-y-4">
      <div className="flex gap-2 rounded-lg bg-gray-800 p-1">
        <button
          onClick={() => { setActorCategory("human"); setCustomBgActive(false); }}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            actorCategory === "human"
              ? "bg-gray-700 text-white shadow-sm"
              : "text-gray-400 hover:text-white"
          }`}
        >
          👤 Humans
        </button>
        <button
          onClick={() => { setActorCategory("animal"); setCustomBgActive(false); }}
          className={`flex-1 rounded-md px-3 py-2 text-sm font-medium transition-colors ${
            actorCategory === "animal"
              ? "bg-gray-700 text-white shadow-sm"
              : "text-gray-400 hover:text-white"
          }`}
        >
          🐾 Animals
        </button>
      </div>

      <div className="grid grid-cols-2 gap-3">
        {filteredActors.map((actor) => (
          <button
            key={actor.id}
            onClick={() => setSelectedActor(actor)}
            className={`group flex flex-col items-center gap-2 rounded-xl border-2 p-3 transition-all duration-200 ${
              selectedActor?.id === actor.id
                ? "border-indigo-500 bg-indigo-500/10 shadow-lg shadow-indigo-500/20"
                : "border-gray-700/50 bg-gray-800/50 hover:border-gray-600 hover:bg-gray-800"
            }`}
          >
            <div
              className="h-16 w-16 overflow-hidden rounded-xl shadow-md transition-transform group-hover:scale-105"
            >
              <img
                src={actor.imgSrc}
                alt={actor.name}
                className="h-full w-full object-cover"
              />
            </div>
            <span className="text-xs font-medium text-gray-300 text-center leading-tight">
              {actor.name}
            </span>
            <span
              className={`text-[10px] font-semibold uppercase tracking-wide ${
                selectedActor?.id === actor.id ? "text-indigo-400" : "text-gray-500"
              }`}
            >
              {selectedActor?.id === actor.id ? "✓ Selected" : "Select"}
            </span>
          </button>
        ))}
      </div>

      {/* Backgrounds */}
      <div className="pt-2">
        <h3 className="mb-3 text-sm font-semibold text-gray-300">Background</h3>
        <div className="grid grid-cols-2 gap-2">
          {backgrounds.map((bg) => (
            <button
              key={bg.id}
              onClick={() => { setSelectedBg(bg); setCustomBgActive(false); }}
              className={`flex items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-all duration-200 ${
                selectedBg?.id === bg.id && !customBgActive
                  ? "border-indigo-500 bg-indigo-500/10"
                  : "border-gray-700/50 bg-gray-800/50 hover:border-gray-600"
              }`}
            >
              <div
                className={`h-8 w-8 flex-shrink-0 rounded-md bg-gradient-to-br ${bg.gradient} flex items-center justify-center text-sm`}
              >
                {bg.emoji}
              </div>
              <span className="text-xs text-gray-300 truncate">{bg.name}</span>
            </button>
          ))}
          <button
            onClick={() => { setCustomBgActive(true); }}
            className={`col-span-2 flex items-center gap-2 rounded-lg border-2 p-2.5 text-left transition-all duration-200 ${
              customBgActive
                ? "border-indigo-500 bg-indigo-500/10"
                : "border-dashed border-gray-600 bg-gray-800/30 hover:border-gray-500"
            }`}
          >
            <span className="text-lg">✨</span>
            <span className="text-xs text-gray-300">Custom background...</span>
          </button>
        </div>
        {customBgActive && (
          <div className="mt-3">
            <input
              type="text"
              value={customBgPrompt}
              onChange={(e) => setCustomBgPrompt(e.target.value)}
              placeholder="Describe your ideal background..."
              className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
            />
          </div>
        )}
      </div>
    </div>
  );
}

interface PreviewPanelProps {
  customBgActive: boolean;
  customBgPrompt: string;
  selectedBg: Background | null;
  selectedActor: Actor | null;
  fadeTransition: boolean;
  scenes: { label: string; text: string }[];
  activeScene: number;
  setActiveScene: (i: number) => void;
  script: string;
  previewPlaying: boolean;
  startPreview: () => void;
  stopPreview: () => void;
}

function PreviewPanel({
  customBgActive,
  customBgPrompt,
  selectedBg,
  selectedActor,
  fadeTransition,
  scenes,
  activeScene,
  setActiveScene,
  script,
  previewPlaying,
  startPreview,
  stopPreview,
}: PreviewPanelProps) {
  return (
    <div className="flex h-full flex-col">
      {/* Storyboard area */}
      <div className="relative flex-1 overflow-hidden rounded-xl border border-gray-700 bg-gray-900">
        {/* Background layer */}
        <div
          className={`absolute inset-0 bg-gradient-to-br ${customBgActive ? "from-purple-600 via-fuchsia-500 to-indigo-600" : (selectedBg?.gradient || "from-gray-700 to-gray-900")} transition-all duration-700`}
        >
          {customBgActive && (
            <div className="flex h-full items-center justify-center text-gray-300/60 text-sm italic">
              {customBgPrompt || "Custom background — describe it above ✨"}
            </div>
          )}
        </div>

        {/* Actor layer */}
        {selectedActor && (
          <div
            className={`absolute inset-0 flex flex-col items-center justify-center transition-opacity duration-300 ${
              fadeTransition ? "opacity-0" : "opacity-100"
            }`}
          >
            <div
              className="h-24 w-24 overflow-hidden rounded-2xl shadow-2xl shadow-black/50"
            >
              <img
                src={selectedActor.imgSrc}
                alt={selectedActor.name}
                className="h-full w-full object-cover"
              />
            </div>
            <p className="mt-3 rounded-full bg-black/40 px-4 py-1.5 text-sm font-medium text-white backdrop-blur-sm">
              {selectedActor.name}
            </p>
          </div>
        )}

        {/* Scene label overlay */}
        {scenes.length > 0 && scenes[activeScene] && (
          <div className="absolute top-3 left-3 rounded-full bg-indigo-600/80 px-3 py-1 text-xs font-semibold text-white backdrop-blur-sm">
            {scenes[activeScene].label}
          </div>
        )}

        {/* Empty state */}
        {!script && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="text-center">
              <div className="text-4xl mb-3">🎬</div>
              <p className="text-sm text-gray-500">Generate a script to see your storyboard</p>
            </div>
          </div>
        )}
      </div>

      {/* Scene timeline */}
      {scenes.length > 0 && (
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-gray-500">Scene Timeline</span>
            <button
              onClick={previewPlaying ? stopPreview : startPreview}
              className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
                previewPlaying
                  ? "bg-red-600/20 text-red-400 hover:bg-red-600/30"
                  : "bg-indigo-600/20 text-indigo-400 hover:bg-indigo-600/30"
              }`}
            >
              {previewPlaying ? (
                <>
                  <span>⏹</span> Stop
                </>
              ) : (
                <>
                  <span>▶</span> Preview All
                </>
              )}
            </button>
          </div>
          <div className="flex gap-2">
            {scenes.map((scene, i) => (
              <button
                key={i}
                onClick={() => { setActiveScene(i); }}
                className={`flex-1 rounded-lg border-2 p-3 text-center transition-all duration-200 ${
                  activeScene === i
                    ? "border-indigo-500 bg-indigo-500/10 shadow-md shadow-indigo-500/10"
                    : "border-gray-700 bg-gray-800/50 hover:border-gray-600"
                }`}
              >
                <div className="text-xs font-semibold text-gray-300">{scene.label}</div>
                <div className="mt-1 text-[10px] text-gray-500 line-clamp-2">
                  {scene.text.slice(0, 60)}...
                </div>
              </button>
            ))}
          </div>
          {/* Active scene text */}
          {scenes[activeScene] && (
            <div className="rounded-lg border border-gray-700/50 bg-gray-800/50 p-3">
              <p className="text-xs font-semibold text-indigo-400 mb-1">{scenes[activeScene].label}</p>
              <p className="text-sm text-gray-300 leading-relaxed">{scenes[activeScene].text}</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

interface ScriptPanelProps {
  productDescription: string;
  setProductDescription: (val: string) => void;
  scriptTone: string;
  setScriptTone: (val: string) => void;
  toneOptions: string[];
  generating: boolean;
  onGenerateScript: () => void;
  script: string;
  setScript: (val: string) => void;
  scriptNote: string;
}

function ScriptPanel({
  productDescription,
  setProductDescription,
  scriptTone,
  setScriptTone,
  toneOptions,
  generating,
  onGenerateScript,
  script,
  setScript,
  scriptNote,
}: ScriptPanelProps) {
  return (
    <div className="flex h-full flex-col space-y-4">
      {/* Product description */}
      <div>
        <label className="mb-1.5 block text-sm font-medium text-gray-300">
          What are you advertising?
        </label>
        <textarea
          value={productDescription}
          onChange={(e) => setProductDescription(e.target.value)}
          placeholder="e.g., A local bakery specializing in artisan sourdough bread with free Saturday delivery..."
          rows={3}
          className="w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none"
        />
      </div>

      {/* Tone selector + Generate button */}
      <div className="flex gap-3">
        <select
          value={scriptTone}
          onChange={(e) => setScriptTone(e.target.value)}
          className="flex-1 rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-gray-200 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500"
        >
          {toneOptions.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <button
          onClick={onGenerateScript}
          disabled={generating || !productDescription.trim()}
          className="flex items-center gap-2 rounded-lg bg-indigo-600 px-4 py-2.5 text-sm font-semibold text-white transition-all hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed"
        >
          {generating ? (
            <>
              <Spinner /> Generating...
            </>
          ) : (
            <>✨ Generate Script</>
          )}
        </button>
      </div>

      {/* Script note */}
      {scriptNote && (
        <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-300">
          ℹ️ {scriptNote}
        </div>
      )}

      {/* Editable script */}
      <div className="flex-1">
        <label className="mb-1.5 block text-sm font-medium text-gray-300">
          Script
        </label>
        <textarea
          value={script}
          onChange={(e) => setScript(e.target.value)}
          placeholder="Your generated script will appear here..."
          rows={12}
          className="h-full min-h-[200px] w-full rounded-lg border border-gray-600 bg-gray-800 px-3 py-2.5 text-sm text-gray-200 placeholder-gray-500 focus:border-indigo-500 focus:outline-none focus:ring-1 focus:ring-indigo-500 resize-none font-mono leading-relaxed"
        />
      </div>
    </div>
  );
}

// ─── Spinner helper ──────────────────────────────────────────────────
function Spinner() {
  return (
    <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
      <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
      <path
        className="opacity-75"
        fill="currentColor"
        d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z"
      />
    </svg>
  );
}
