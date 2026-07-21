import { createFileRoute, Link } from "@tanstack/react-router";
import { useState } from "react";

export const Route = createFileRoute("/help")({
  component: HelpPage,
});

// ── FAQ Data ──

const FAQ_ITEMS = [
  {
    q: "How do I create my first commercial?",
    a: "Go to the Studio page, pick an AI actor, write your script, choose a background, and click 'Create Commercial'. Your video will be queued for rendering — it usually takes 2–5 minutes. You can track progress on the Rendering page in real time, from queued → processing → completed.",
  },
  {
    q: "What AI actors are available?",
    a: "ClipForge offers a growing library of AI-generated actors including diverse human characters and fun animal mascots. Browse available actors in the Studio and pick the one that best fits your brand personality. Each actor comes with natural voice synthesis for lifelike delivery.",
  },
  {
    q: "How much does ClipForge cost?",
    a: "ClipForge has simple, transparent pricing: $20/month for businesses testing the waters or with variable needs, or $200/year (about $16.67/month) for committed users. There are no per-video fees — you can create unlimited commercials on any plan. No credit card is required to start a free trial.",
  },
  {
    q: "How long does rendering take?",
    a: "Typical render time is 2–5 minutes depending on video length and render queue load. You'll see a live status on the Rendering page with real-time updates. Annual subscribers get priority render queue access for faster turnaround.",
  },
  {
    q: "Can I share my commercial on social media?",
    a: "Full social media publishing (Facebook, Instagram, YouTube, TikTok, etc.) is coming in Phase 2. Right now you can share via SMS distribution from the Distribution page, or download your rendered video and upload it to any social platform manually.",
  },
  {
    q: "What video formats are supported?",
    a: "ClipForge exports commercials in MP4 format with H.264 encoding, optimized for web and mobile playback. Videos render at 1080p resolution by default. Future updates will include additional formats and 4K support.",
  },
  {
    q: "Do I need any video production experience?",
    a: "Not at all! ClipForge is built specifically for SMBs with no video production budget or expertise. The entire process — picking an actor, writing a script, choosing a background, and publishing — is designed to be done in minutes by anyone.",
  },
  {
    q: "What happens to my data and videos?",
    a: "All data is encrypted at rest and in transit. Your commercials are stored securely and remain accessible from your Dashboard as long as your subscription is active. You can download and delete your videos at any time.",
  },
  {
    q: "How do I cancel my subscription?",
    a: "You can cancel anytime from your Dashboard billing page. Your access continues until the end of your current billing period. There are no cancellation fees or long-term commitments — we want you to stay because ClipForge works for you, not because of a contract.",
  },
  {
    q: "Is there a limit on how many commercials I can create?",
    a: "No limits! Every ClipForge plan includes unlimited video commercial creation. Whether you're on the monthly or annual plan, you can produce as many 2-minute commercials as your business needs. No per-video fees, ever.",
  },
];

// ── Tutorial Steps ──

const TUTORIAL_STEPS = [
  {
    step: "1",
    title: "Sign Up for Free",
    description:
      "Create your ClipForge account in under a minute — no credit card required. Your free trial gives you full access to the Studio so you can explore all the features before committing.",
    icon: "🚀",
  },
  {
    step: "2",
    title: "Open the Studio",
    description:
      "Navigate to the Studio page from your Dashboard. This is your creative workspace where you'll build commercials from scratch. Everything you need — actors, scripts, backgrounds, and voices — is right here.",
    icon: "🎬",
  },
  {
    step: "3",
    title: "Pick Your AI Actor",
    description:
      "Browse the AI actor library and choose a spokesperson for your brand. Options include diverse human characters and fun animal mascots. Preview how each actor looks before making your selection.",
    icon: "🎭",
  },
  {
    step: "4",
    title: "Write Your Script",
    description:
      "Type or paste your commercial script into the text box. Keep it under 2 minutes of spoken content — roughly 250–300 words. Use the AI script assistant to generate a draft from your product or service description if you need inspiration.",
    icon: "✍️",
  },
  {
    step: "5",
    title: "Choose a Background",
    description:
      "Select an AI-generated virtual set that matches your brand tone. Choose from professional offices, outdoor scenes, studio backdrops, and abstract environments. The right background makes your commercial look polished and credible.",
    icon: "🖼️",
  },
  {
    step: "6",
    title: "Select Voice & Render",
    description:
      "Pick a voice from the available text-to-speech options to match your actor and brand personality. Click 'Create Commercial' to submit your job to the render queue. Your video is typically ready in 2–5 minutes.",
    icon: "🎙️",
  },
  {
    step: "7",
    title: "Review & Share",
    description:
      "Watch your completed commercial on the Rendering page. Once you're happy, share it via SMS from the Distribution page, or download the MP4 file to upload anywhere — social media, your website, email campaigns, and more.",
    icon: "📡",
  },
  {
    step: "8",
    title: "Track Performance",
    description:
      "Use the Analytics Dashboard to monitor views, completion rates, and engagement. ClipForge's AI optimization engine continuously analyzes live performance data and suggests improvements for your next commercial.",
    icon: "📊",
  },
];

// ── Contact Topics ──

const CONTACT_OPTIONS = [
  {
    title: "Technical Support",
    description: "Having trouble with rendering, Studio issues, or account access? Our support team is here to help.",
    icon: "🔧",
  },
  {
    title: "Billing Questions",
    description: "Questions about your subscription, payment methods, or plan upgrades? We'll get you sorted quickly.",
    icon: "💳",
  },
  {
    title: "Feature Requests",
    description: "Have an idea that would make ClipForge even better? We love hearing from our users and prioritize the most-requested features.",
    icon: "💡",
  },
  {
    title: "Partnerships",
    description: "Interested in integrating ClipForge into your platform or partnering with us? Let's explore how we can work together.",
    icon: "🤝",
  },
];

// ── Page ──

function HelpPage() {
  return (
    <div>
      {/* Hero */}
      <HelpHero />

      {/* FAQ */}
      <FaqSection />

      {/* Tutorial */}
      <TutorialSection />

      {/* Contact Support */}
      <ContactSection />

      {/* Footer */}
      <HelpFooter />
    </div>
  );
}

// ── Hero ──

function HelpHero() {
  return (
    <section className="relative overflow-hidden px-6 pb-20 pt-16 sm:pb-28 sm:pt-24">
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-gray-950 dark:to-gray-950" />
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          Help Center
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
          How can we{" "}
          <span className="text-indigo-600 dark:text-indigo-400">help</span>?
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          Everything you need to know about creating stunning AI-powered video commercials with ClipForge.
          Browse the FAQ, follow the step-by-step tutorial, or reach out to our support team.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <a
            href="#faq"
            className="rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 dark:shadow-indigo-900/50"
          >
            Browse FAQ
          </a>
          <a
            href="#contact"
            className="rounded-xl border border-gray-300 px-8 py-4 text-lg font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            Contact support
          </a>
        </div>
      </div>
    </section>
  );
}

// ── FAQ Section ──

function FaqSection() {
  const [expandedFaq, setExpandedFaq] = useState<number | null>(null);

  return (
    <section id="faq" className="bg-gray-50 px-6 py-24 dark:bg-gray-900/50">
      <div className="mx-auto max-w-3xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Frequently Asked Questions
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Quick answers to common questions about ClipForge.
          </p>
        </div>
        <div className="mt-12 space-y-3">
          {FAQ_ITEMS.map((item, idx) => {
            const isOpen = expandedFaq === idx;
            return (
              <div
                key={idx}
                className="rounded-xl border border-gray-200 bg-white overflow-hidden transition-shadow hover:shadow-sm dark:border-gray-700 dark:bg-gray-800/50"
              >
                <button
                  onClick={() => setExpandedFaq(isOpen ? null : idx)}
                  className="flex w-full items-center justify-between px-6 py-4 text-left text-base font-medium text-gray-900 hover:bg-gray-50 transition-colors dark:text-white dark:hover:bg-gray-800/50"
                >
                  <span className="pr-4">{item.q}</span>
                  <svg
                    className={`h-5 w-5 shrink-0 text-gray-400 transition-transform duration-200 ${
                      isOpen ? "rotate-180" : ""
                    }`}
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="m19.5 8.25-7.5 7.5-7.5-7.5" />
                  </svg>
                </button>
                {isOpen && (
                  <div className="border-t border-gray-200 px-6 py-4 dark:border-gray-700">
                    <p className="text-base text-gray-600 leading-relaxed dark:text-gray-400">
                      {item.a}
                    </p>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>
    </section>
  );
}

// ── Tutorial Section ──

function TutorialSection() {
  return (
    <section id="tutorial" className="px-6 py-24">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Step-by-Step Tutorial
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Follow this guide to create your first AI-powered commercial — from sign-up to sharing.
          </p>
        </div>
        <div className="mt-16">
          <div className="relative">
            {/* Timeline line */}
            <div className="absolute left-8 top-0 bottom-0 w-px bg-gray-200 dark:bg-gray-700 hidden sm:block" />
            <div className="space-y-10">
              {TUTORIAL_STEPS.map((item) => (
                <div key={item.step} className="relative flex gap-6 sm:gap-8">
                  {/* Step circle */}
                  <div className="relative z-10 flex h-16 w-16 shrink-0 items-center justify-center rounded-full bg-indigo-600 text-xl font-bold text-white shadow-lg shadow-indigo-200 dark:shadow-indigo-900/50">
                    <span>{item.step}</span>
                  </div>
                  {/* Content card */}
                  <div className="flex-1 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/50">
                    <div className="flex items-center gap-3 mb-3">
                      <span className="text-2xl">{item.icon}</span>
                      <h3 className="text-lg font-semibold text-gray-900 dark:text-white">
                        {item.title}
                      </h3>
                    </div>
                    <p className="text-base text-gray-600 leading-relaxed dark:text-gray-400">
                      {item.description}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="mt-12 text-center">
            <Link
              to="/signup"
              className="inline-block rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 dark:shadow-indigo-900/50"
            >
              Start your first commercial
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Contact Section ──

function ContactSection() {
  const [formState, setFormState] = useState<"idle" | "submitting" | "submitted">("idle");
  const [formData, setFormData] = useState({ name: "", email: "", topic: "", message: "" });

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setFormState("submitting");
    // Simulate submission — in production this would call a server function
    setTimeout(() => {
      setFormState("submitted");
    }, 1500);
  };

  return (
    <section id="contact" className="bg-gray-50 px-6 py-24 dark:bg-gray-900/50">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Contact Support
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            Need more help? Choose a topic below or send us a message directly.
          </p>
        </div>

        {/* Topic cards */}
        <div className="mt-12 grid gap-6 sm:grid-cols-2 lg:grid-cols-4">
          {CONTACT_OPTIONS.map((opt) => (
            <div
              key={opt.title}
              className="rounded-2xl border border-gray-200 bg-white p-6 transition-shadow hover:shadow-md dark:border-gray-700 dark:bg-gray-800/50"
            >
              <div className="text-3xl mb-3">{opt.icon}</div>
              <h3 className="text-base font-semibold text-gray-900 dark:text-white">{opt.title}</h3>
              <p className="mt-2 text-sm text-gray-600 leading-relaxed dark:text-gray-400">
                {opt.description}
              </p>
            </div>
          ))}
        </div>

        {/* Contact form */}
        <div className="mt-16 mx-auto max-w-2xl">
          <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm dark:border-gray-700 dark:bg-gray-800/50">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">
              Send us a message
            </h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              We typically respond within 24 hours on business days.
            </p>

            {formState === "submitted" ? (
              <div className="mt-8 rounded-xl bg-green-50 border border-green-200 p-6 text-center dark:bg-green-900/20 dark:border-green-800">
                <svg
                  className="mx-auto h-12 w-12 text-green-500"
                  fill="none"
                  viewBox="0 0 24 24"
                  stroke="currentColor"
                  strokeWidth={1.5}
                >
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75 11.25 15 15 9.75M21 12a9 9 0 1 1-18 0 9 9 0 0 1 18 0Z" />
                </svg>
                <h4 className="mt-4 text-lg font-semibold text-green-800 dark:text-green-300">
                  Message sent!
                </h4>
                <p className="mt-2 text-sm text-green-700 dark:text-green-400">
                  Thanks for reaching out. Our support team will get back to you within 24 hours.
                </p>
                <button
                  onClick={() => {
                    setFormState("idle");
                    setFormData({ name: "", email: "", topic: "", message: "" });
                  }}
                  className="mt-4 text-sm font-medium text-green-700 hover:text-green-800 underline dark:text-green-400 dark:hover:text-green-300"
                >
                  Send another message
                </button>
              </div>
            ) : (
              <form onSubmit={handleSubmit} className="mt-6 space-y-5">
                <div className="grid gap-5 sm:grid-cols-2">
                  <div>
                    <label
                      htmlFor="contact-name"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Name
                    </label>
                    <input
                      id="contact-name"
                      type="text"
                      required
                      value={formData.name}
                      onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                      className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                      placeholder="Your name"
                    />
                  </div>
                  <div>
                    <label
                      htmlFor="contact-email"
                      className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                    >
                      Email
                    </label>
                    <input
                      id="contact-email"
                      type="email"
                      required
                      value={formData.email}
                      onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                      className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                      placeholder="you@example.com"
                    />
                  </div>
                </div>
                <div>
                  <label
                    htmlFor="contact-topic"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Topic
                  </label>
                  <select
                    id="contact-topic"
                    required
                    value={formData.topic}
                    onChange={(e) => setFormData({ ...formData, topic: e.target.value })}
                    className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white"
                  >
                    <option value="" disabled>
                      Select a topic
                    </option>
                    <option value="technical">Technical Support</option>
                    <option value="billing">Billing Question</option>
                    <option value="feature">Feature Request</option>
                    <option value="partnership">Partnership</option>
                    <option value="other">Other</option>
                  </select>
                </div>
                <div>
                  <label
                    htmlFor="contact-message"
                    className="block text-sm font-medium text-gray-700 dark:text-gray-300"
                  >
                    Message
                  </label>
                  <textarea
                    id="contact-message"
                    required
                    rows={5}
                    value={formData.message}
                    onChange={(e) => setFormData({ ...formData, message: e.target.value })}
                    className="mt-1.5 block w-full rounded-xl border border-gray-300 bg-white px-4 py-2.5 text-sm text-gray-900 placeholder-gray-400 focus:border-indigo-500 focus:outline-none focus:ring-2 focus:ring-indigo-500/20 dark:border-gray-600 dark:bg-gray-800 dark:text-white dark:placeholder-gray-500"
                    placeholder="Describe your issue or question in detail..."
                  />
                </div>
                <button
                  type="submit"
                  disabled={formState === "submitting"}
                  className="w-full rounded-xl bg-indigo-600 px-6 py-3 text-base font-semibold text-white shadow-md transition-all hover:bg-indigo-700 disabled:opacity-60 disabled:cursor-not-allowed"
                >
                  {formState === "submitting" ? (
                    <span className="flex items-center justify-center gap-2">
                      <svg className="h-5 w-5 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      Sending...
                    </span>
                  ) : (
                    "Send message"
                  )}
                </button>
              </form>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}

// ── Footer ──

function HelpFooter() {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 px-6 py-12 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-sm text-gray-500 dark:text-gray-500">
          &copy; {new Date().getFullYear()} ClipForge. All rights reserved.
        </div>
        <nav className="flex gap-6 text-sm text-gray-500 dark:text-gray-500">
          <Link to="/" className="hover:text-gray-900 dark:hover:text-white">
            Home
          </Link>
          <Link to="/help" className="text-indigo-600 hover:text-indigo-700 dark:text-indigo-400 dark:hover:text-indigo-300">
            Help
          </Link>
          <a href="#" className="hover:text-gray-900 dark:hover:text-white">
            Privacy
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-white">
            Terms
          </a>
        </nav>
      </div>
    </footer>
  );
}
