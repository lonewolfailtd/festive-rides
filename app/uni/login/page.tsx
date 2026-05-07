"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";

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
    <main className="flex min-h-screen items-center justify-center px-4 py-12">
      <div className="w-full max-w-md rounded-2xl border border-slate-800 bg-slate-900 p-8 shadow-xl">
        <h1 className="text-2xl font-semibold tracking-tight">Uni Citation Tool</h1>
        <p className="mt-1 text-sm text-slate-400">
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
              <span className="text-sm text-slate-300">Email address</span>
              <input
                type="email"
                required
                autoFocus
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="mt-1 block w-full rounded-md border border-slate-700 bg-slate-950 px-3 py-2 text-slate-100 placeholder-slate-500 focus:border-sky-500 focus:outline-none focus:ring-1 focus:ring-sky-500"
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
