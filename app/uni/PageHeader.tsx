"use client";

import Link from "next/link";
import { useAuthActions } from "@convex-dev/auth/react";
import { ThemeToggle } from "./ThemeProvider";

interface PageHeaderProps {
  eyebrow: string;
  title: string;
  description?: string;
  showBack?: boolean;
  showSignOut?: boolean;
}

export default function PageHeader({
  eyebrow,
  title,
  description,
  showBack = true,
  showSignOut = true,
}: PageHeaderProps) {
  const { signOut } = useAuthActions();
  return (
    <div className="mb-8">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-3">
        {showBack ? (
          <Link
            href="/uni"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            <span aria-hidden>←</span> Dashboard
          </Link>
        ) : (
          <span />
        )}
        <div className="flex items-center gap-2">
          <Link
            href="/uni/calendar"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            <span aria-hidden>📅</span> Calendar
          </Link>
          <Link
            href="/uni/settings"
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
          >
            <span aria-hidden>⚙</span> Settings
          </Link>
          <ThemeToggle />
          {showSignOut && (
            <button
              type="button"
              onClick={() => signOut()}
              className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-rose-400 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-300"
            >
              Sign out
            </button>
          )}
        </div>
      </div>
      <header>
        <p className="text-sm font-medium text-sky-600 dark:text-sky-400">{eyebrow}</p>
        <h1 className="mt-1 text-3xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          {title}
        </h1>
        {description && (
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">{description}</p>
        )}
      </header>
    </div>
  );
}
