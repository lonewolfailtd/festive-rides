"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { ThemeToggle } from "../ThemeProvider";

export default function UniLoginPage() {
  const { signIn } = useAuthActions();
  const [email, setEmail] = useState("");
  const [step, setStep] = useState<"input" | "sent" | "submitting">("input");
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setStep("submitting");
    try {
      const formData = new FormData();
      formData.set("email", email);
      await signIn("resend", formData);
      setStep("sent");
    } catch (err) {
      setStep("input");
      setError(err instanceof Error ? err.message : "Could not send the link.");
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-xl dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
        <h1 className="text-2xl font-semibold tracking-tight">Uni Citation Tool</h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          Sign in with your email. We&apos;ll send you a one-tap login link.
        </p>

        {step === "sent" ? (
          <div className="mt-6 rounded-lg border border-emerald-700 bg-emerald-900/30 p-4 text-sm text-emerald-200">
            Check <span className="font-medium">{email}</span> for a sign-in link.
            It&apos;s valid for 30 minutes. You can close this tab.
          </div>
        ) : (
          <form onSubmit={onSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-300">Email address</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none"
                placeholder="you@example.com"
                disabled={step === "submitting"}
              />
            </label>

            {error ? (
              <p className="text-sm text-rose-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={step === "submitting"}
              className="w-full rounded-md bg-sky-600 px-4 py-2 text-sm font-medium text-white hover:bg-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
            >
              {step === "submitting" ? "Sending link…" : "Send sign-in link"}
            </button>
          </form>
        )}
      </div>
    </main>
  );
}
