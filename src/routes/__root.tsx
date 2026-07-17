import {
  HeadContent,
  Link,
  Outlet,
  Scripts,
  createRootRoute,
} from "@tanstack/react-router";
import { createServerFn } from "@tanstack/react-start";
import type { ReactNode } from "react";
import { readFile } from "node:fs/promises";

import appCss from "~/styles/app.css?url";

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

export const Route = createRootRoute({
  loader: () => getBusinessName(),
  head: ({ loaderData }) => ({
    meta: [
      { charSet: "utf-8" },
      { name: "viewport", content: "width=device-width, initial-scale=1" },
      { title: (loaderData as string) || "ClipForge" },
      {
        name: "description",
        content:
          "AI-powered platform that lets SMBs produce polished video commercials in minutes — no camera, studio, or agency needed.",
      },
    ],
    links: [{ rel: "stylesheet", href: appCss }],
  }),
  notFoundComponent: () => (
    <div className="flex min-h-dvh items-center justify-center">
      <div className="text-center">
        <h1 className="text-4xl font-bold">404</h1>
        <p className="mt-2 text-gray-500">Page not found</p>
        <Link to="/" className="mt-4 inline-block text-indigo-600 hover:underline">
          Go home
        </Link>
      </div>
    </div>
  ),
  component: RootComponent,
});

function RootComponent() {
  const businessName = Route.useLoaderData();
  return (
    <RootDocument>
      <NavBar businessName={businessName} />
      <Outlet />
    </RootDocument>
  );
}

function NavBar({ businessName }: { businessName: string }) {
  return (
    <header className="sticky top-0 z-50 border-b border-gray-200 bg-white/80 backdrop-blur-md dark:border-gray-800 dark:bg-gray-950/80">
      <div className="mx-auto flex max-w-7xl items-center justify-between px-6 py-4">
        <Link to="/" className="text-xl font-bold tracking-tight text-gray-900 dark:text-white">
          {businessName}
        </Link>
        <nav className="hidden items-center gap-6 text-sm font-medium sm:flex">
          <Link to="/" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Home
          </Link>
          <a href="#features" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Features
          </a>
          <a href="#pricing" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Pricing
          </a>
          <Link to="/login" className="text-gray-600 hover:text-gray-900 dark:text-gray-400 dark:hover:text-white">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-indigo-600 px-4 py-2 text-white hover:bg-indigo-700 transition-colors"
          >
            Get started
          </Link>
        </nav>
        {/* Mobile hamburger — simplified */}
        <div className="flex gap-3 sm:hidden">
          <Link to="/login" className="text-sm font-medium text-gray-600 dark:text-gray-400">
            Log in
          </Link>
          <Link
            to="/signup"
            className="rounded-lg bg-indigo-600 px-3 py-1.5 text-sm font-medium text-white"
          >
            Sign up
          </Link>
        </div>
      </div>
    </header>
  );
}

function RootDocument({ children }: { children: ReactNode }) {
  return (
    <html lang="en">
      <head>
        <HeadContent />
      </head>
      <body className="bg-white text-gray-900 antialiased dark:bg-gray-950 dark:text-gray-100">
        {children}
        <Scripts />
      </body>
    </html>
  );
}
