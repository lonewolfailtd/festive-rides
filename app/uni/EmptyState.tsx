"use client";

import Link from "next/link";
import type { ReactNode } from "react";

interface EmptyStateProps {
  icon?: ReactNode; // emoji or small SVG
  title: string;
  body: string;
  cta?: { label: string; href?: string; onClick?: () => void };
  variant?: "default" | "soft"; // soft = no border, just centered text
}

export default function EmptyState({ icon, title, body, cta, variant = "default" }: EmptyStateProps) {
  const wrapperCx =
    variant === "soft"
      ? "flex flex-col items-center justify-center py-10 text-center"
      : "flex flex-col items-center justify-center rounded-2xl border border-dashed border-slate-300 bg-white/40 py-12 px-6 text-center dark:border-slate-700 dark:bg-slate-900/40";
  return (
    <div className={wrapperCx}>
      {icon && (
        <div className="mb-3 text-4xl opacity-80" aria-hidden>
          {icon}
        </div>
      )}
      <h3 className="text-base font-semibold text-slate-900 dark:text-slate-100">
        {title}
      </h3>
      <p className="mt-1.5 max-w-md text-sm text-slate-600 dark:text-slate-400">
        {body}
      </p>
      {cta && (
        cta.href ? (
          <Link
            href={cta.href}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500"
          >
            {cta.label} →
          </Link>
        ) : (
          <button
            type="button"
            onClick={cta.onClick}
            className="mt-4 inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-3.5 py-1.5 text-xs font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500"
          >
            {cta.label}
          </button>
        )
      )}
    </div>
  );
}
