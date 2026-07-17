import { createFileRoute, Link } from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import { readFile } from "node:fs/promises";

const getBusinessName = createServerFn({ method: "GET" }).handler(async () => {
  try {
    const cfg = JSON.parse(await readFile("site.json", "utf8")) as {
      businessName?: string;
    };
    return cfg.businessName?.trim() ?? "ClipForge";
  } catch {
    return "ClipForge";
  }
});

export const Route = createFileRoute("/")({
  loader: () => getBusinessName(),
  component: Home,
});

function Home() {
  const businessName = Route.useLoaderData();

  return (
    <div>
      {/* Hero */}
      <HeroSection businessName={businessName} />

      {/* How it Works */}
      <HowItWorksSection />

      {/* Features */}
      <FeaturesSection />

      {/* Pricing */}
      <PricingSection />

      {/* Social Proof Placeholder */}
      <TestimonialsSection />

      {/* Footer */}
      <Footer businessName={businessName} />
    </div>
  );
}

function HeroSection({ businessName }: { businessName: string }) {
  return (
    <section className="relative overflow-hidden px-6 pb-24 pt-16 sm:pb-32 sm:pt-24">
      {/* Background gradient */}
      <div className="absolute inset-0 -z-10 bg-gradient-to-b from-indigo-50 via-white to-white dark:from-indigo-950/30 dark:via-gray-950 dark:to-gray-950" />
      <div className="mx-auto max-w-4xl text-center">
        <span className="inline-block rounded-full bg-indigo-100 px-4 py-1.5 text-sm font-semibold text-indigo-700 dark:bg-indigo-900/50 dark:text-indigo-300">
          AI-powered video creation
        </span>
        <h1 className="mt-6 text-4xl font-extrabold tracking-tight text-gray-900 sm:text-5xl lg:text-6xl dark:text-white">
          Create stunning video commercials{" "}
          <span className="text-indigo-600 dark:text-indigo-400">in minutes</span>
        </h1>
        <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-gray-600 dark:text-gray-400">
          {businessName} lets you produce polished, 2-minute video ads with AI-generated actors,
          scripts, and backgrounds. No camera, no studio, no agency — just results.
        </p>
        <div className="mt-10 flex flex-col items-center gap-4 sm:flex-row sm:justify-center">
          <Link
            to="/signup"
            className="rounded-xl bg-indigo-600 px-8 py-4 text-lg font-semibold text-white shadow-lg shadow-indigo-200 transition-all hover:bg-indigo-700 hover:shadow-indigo-300 dark:shadow-indigo-900/50"
          >
            Create your first commercial
          </Link>
          <a
            href="#how-it-works"
            className="rounded-xl border border-gray-300 px-8 py-4 text-lg font-medium text-gray-700 transition-all hover:border-gray-400 hover:bg-gray-50 dark:border-gray-700 dark:text-gray-300 dark:hover:bg-gray-800"
          >
            See how it works
          </a>
        </div>
        <p className="mt-4 text-sm text-gray-500 dark:text-gray-500">
          No credit card required · Free trial
        </p>
      </div>
    </section>
  );
}

function HowItWorksSection() {
  const steps = [
    {
      step: "1",
      title: "Pick your actor",
      description:
        "Choose from dozens of AI-generated actors — or use an animal mascot. Each comes with natural voice synthesis.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 1 1-7.5 0 3.75 3.75 0 0 1 7.5 0ZM4.501 20.118a7.5 7.5 0 0 1 14.998 0A17.933 17.933 0 0 1 12 21.75c-2.676 0-5.216-.584-7.499-1.632Z" />
        </svg>
      ),
    },
    {
      step: "2",
      title: "Get an AI-written script",
      description:
        "Describe your product or service and our AI crafts a compelling 2-minute script tailored to your brand voice.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m16.862 4.487 1.687-1.688a1.875 1.875 0 1 1 2.652 2.652L10.582 16.07a4.5 4.5 0 0 1-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 0 1 1.13-1.897l8.932-8.931Zm0 0L19.5 7.125M18 14v4.75A2.25 2.25 0 0 1 15.75 21H5.25A2.25 2.25 0 0 1 3 18.75V8.25A2.25 2.25 0 0 1 5.25 6H10" />
        </svg>
      ),
    },
    {
      step: "3",
      title: "Choose your background",
      description:
        "Browse AI-generated virtual sets — from sleek offices to outdoor scenes — and find the perfect backdrop in seconds.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="m2.25 15.75 5.159-5.159a2.25 2.25 0 0 1 3.182 0l5.159 5.159m-1.5-1.5 1.409-1.409a2.25 2.25 0 0 1 3.182 0l2.909 2.909M3.75 21h16.5A2.25 2.25 0 0 0 22.5 18.75V5.25A2.25 2.25 0 0 0 20.25 3H3.75A2.25 2.25 0 0 0 1.5 5.25v13.5A2.25 2.25 0 0 0 3.75 21Z" />
        </svg>
      ),
    },
    {
      step: "4",
      title: "Publish everywhere",
      description:
        "One click sends your commercial to social media channels and SMS — with built-in analytics to track performance.",
      icon: (
        <svg className="h-8 w-8" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
        </svg>
      ),
    },
  ];

  return (
    <section id="how-it-works" className="bg-gray-50 px-6 py-24 dark:bg-gray-900/50">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            How it works
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            From idea to published commercial in four simple steps.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {steps.map((s) => (
            <div
              key={s.step}
              className="group relative rounded-2xl bg-white p-8 shadow-sm ring-1 ring-gray-200 transition-shadow hover:shadow-md dark:bg-gray-800/50 dark:ring-gray-700"
            >
              <span className="absolute -top-3 -left-3 flex h-8 w-8 items-center justify-center rounded-full bg-indigo-600 text-sm font-bold text-white">
                {s.step}
              </span>
              <div className="mb-4 text-indigo-600 dark:text-indigo-400">{s.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{s.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {s.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function FeaturesSection() {
  const features = [
    {
      title: "AI Actors & Voices",
      description:
        "Diverse cast of photorealistic AI actors with natural voice synthesis. Choose the perfect spokesperson for your brand.",
      icon: "🎭",
    },
    {
      title: "AI Script Writing",
      description:
        "Describe your business and get a compelling 2-minute script. Optimized for conversions with proven copywriting frameworks.",
      icon: "✍️",
    },
    {
      title: "AI Backgrounds",
      description:
        "Hundreds of AI-generated virtual sets. From professional studios to outdoor scenes — find your perfect backdrop instantly.",
      icon: "🎬",
    },
    {
      title: "Multi-Channel Distribution",
      description:
        "Publish to social media and SMS in one click. Phase 1 includes SMS + one social export; full social publishing in Phase 2.",
      icon: "📡",
    },
    {
      title: "Analytics Dashboard",
      description:
        "Track views, completion rates, and engagement. Our AI optimization engine improves campaigns based on live performance data.",
      icon: "📊",
    },
    {
      title: "Agency Quality, 1% Cost",
      description:
        "Professional video ads that rival agency production — at roughly 1% of the traditional $2,000+ per-ad cost.",
      icon: "💎",
    },
  ];

  return (
    <section id="features" className="px-6 py-24">
      <div className="mx-auto max-w-6xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Everything you need to create pro ads
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            No expensive equipment. No creative agency. Just powerful AI tools at your fingertips.
          </p>
        </div>
        <div className="mt-16 grid gap-8 sm:grid-cols-2 lg:grid-cols-3">
          {features.map((f) => (
            <div
              key={f.title}
              className="rounded-2xl border border-gray-200 p-8 transition-shadow hover:shadow-lg dark:border-gray-800 dark:hover:shadow-gray-900/30"
            >
              <div className="mb-4 text-3xl">{f.icon}</div>
              <h3 className="text-lg font-semibold text-gray-900 dark:text-white">{f.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-gray-600 dark:text-gray-400">
                {f.description}
              </p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

function PricingSection() {
  return (
    <section id="pricing" className="bg-gray-50 px-6 py-24 dark:bg-gray-900/50">
      <div className="mx-auto max-w-4xl">
        <div className="text-center">
          <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
            Simple, transparent pricing
          </h2>
          <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
            No per-video fees. Unlimited commercials. Cancel anytime.
          </p>
        </div>
        <div className="mt-16 grid gap-8 lg:grid-cols-2">
          {/* Monthly */}
          <div className="rounded-2xl border border-gray-200 bg-white p-8 ring-1 ring-gray-200 dark:border-gray-700 dark:bg-gray-800/50 dark:ring-gray-700">
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Monthly</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              For businesses testing the waters or with variable needs.
            </p>
            <div className="mt-6">
              <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$20</span>
              <span className="ml-1 text-lg text-gray-500">/month</span>
            </div>
            <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <CheckIcon /> Unlimited video commercials
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> AI actors, scripts &amp; backgrounds
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> SMS distribution
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Analytics dashboard
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Cancel anytime
              </li>
            </ul>
            <Link
              to="/dashboard/billing"
              className="mt-8 block rounded-xl border border-indigo-600 bg-white px-6 py-3 text-center text-sm font-semibold text-indigo-600 transition-all hover:bg-indigo-50 dark:border-indigo-400 dark:bg-transparent dark:text-indigo-400 dark:hover:bg-indigo-950"
            >
              Start monthly
            </Link>
          </div>

          {/* Annual */}
          <div className="relative rounded-2xl border-2 border-indigo-600 bg-white p-8 dark:border-indigo-400 dark:bg-gray-800/50">
            <span className="absolute -top-3 right-6 rounded-full bg-indigo-600 px-4 py-1 text-xs font-bold text-white">
              Save ~17%
            </span>
            <h3 className="text-xl font-semibold text-gray-900 dark:text-white">Annual</h3>
            <p className="mt-2 text-sm text-gray-600 dark:text-gray-400">
              For committed teams ready to scale their video marketing.
            </p>
            <div className="mt-6">
              <span className="text-5xl font-extrabold text-gray-900 dark:text-white">$200</span>
              <span className="ml-1 text-lg text-gray-500">/year</span>
            </div>
            <p className="mt-1 text-sm text-indigo-600 dark:text-indigo-400">
              Just $16.67/month — two months free vs. monthly
            </p>
            <ul className="mt-8 space-y-3 text-sm text-gray-600 dark:text-gray-400">
              <li className="flex items-center gap-2">
                <CheckIcon /> Everything in Monthly
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Priority render queue
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Early access to new features
              </li>
              <li className="flex items-center gap-2">
                <CheckIcon /> Best value
              </li>
            </ul>
            <Link
              to="/dashboard/billing"
              className="mt-8 block rounded-xl bg-indigo-600 px-6 py-3 text-center text-sm font-semibold text-white shadow-md transition-all hover:bg-indigo-700"
            >
              Start annual
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}

function TestimonialsSection() {
  return (
    <section className="px-6 py-24">
      <div className="mx-auto max-w-4xl text-center">
        <h2 className="text-3xl font-bold tracking-tight text-gray-900 sm:text-4xl dark:text-white">
          Loved by businesses
        </h2>
        <p className="mt-4 text-lg text-gray-600 dark:text-gray-400">
          Hear what our early customers have to say.
        </p>
        <div className="mt-12 rounded-2xl border-2 border-dashed border-gray-300 bg-gray-50 px-8 py-16 dark:border-gray-700 dark:bg-gray-800/30">
          <svg
            className="mx-auto h-12 w-12 text-gray-400 dark:text-gray-600"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
            strokeWidth={1}
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              d="M7.5 8.25h9m-9 3H12m-9.75 1.51c0 1.6 1.123 2.994 2.707 3.227 1.129.166 2.27.293 3.423.379.35.026.67.21.865.501L12 21l2.755-4.133a1.14 1.14 0 0 1 .865-.501 48.172 48.172 0 0 0 3.423-.379c1.584-.233 2.707-1.626 2.707-3.228V6.741c0-1.602-1.123-2.995-2.707-3.228A48.394 48.394 0 0 0 12 3c-2.392 0-4.744.175-7.043.513C3.373 3.746 2.25 5.14 2.25 6.741v6.018Z"
            />
          </svg>
          <p className="mt-6 text-lg font-medium text-gray-500 dark:text-gray-500">
            Customer testimonials coming soon
          </p>
          <p className="mt-2 text-sm text-gray-400 dark:text-gray-600">
            Our beta users are creating amazing commercials. We'll share their stories here shortly.
          </p>
        </div>
      </div>
    </section>
  );
}

function Footer({ businessName }: { businessName: string }) {
  return (
    <footer className="border-t border-gray-200 bg-gray-50 px-6 py-12 dark:border-gray-800 dark:bg-gray-900/50">
      <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-6 sm:flex-row">
        <div className="text-sm text-gray-500 dark:text-gray-500">
          &copy; {new Date().getFullYear()} {businessName}. All rights reserved.
        </div>
        <nav className="flex gap-6 text-sm text-gray-500 dark:text-gray-500">
          <a href="#" className="hover:text-gray-900 dark:hover:text-white">
            Privacy
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-white">
            Terms
          </a>
          <a href="#" className="hover:text-gray-900 dark:hover:text-white">
            Contact
          </a>
        </nav>
      </div>
    </footer>
  );
}

function CheckIcon() {
  return (
    <svg className="h-5 w-5 flex-shrink-0 text-indigo-600 dark:text-indigo-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="m4.5 12.75 6 6 9-13.5" />
    </svg>
  );
}
