"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useState } from "react";
import { ThemeToggle } from "../ThemeProvider";

type Mode = "signIn" | "signUp";

export default function UniLoginPage() {
  const { signIn } = useAuthActions();
  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const onSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    if (!email.trim() || !password) {
      setError("Please enter your email and password.");
      return;
    }
    if (mode === "signUp" && password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    setSubmitting(true);
    try {
      const formData = new FormData();
      formData.set("email", email.trim().toLowerCase());
      formData.set("password", password);
      formData.set("flow", mode);
      await signIn("password", formData);
      // Successful sign-in / sign-up triggers a redirect via middleware.
    } catch (err) {
      setSubmitting(false);
      const msg = err instanceof Error ? err.message : "Could not sign in.";
      // Convex Auth surfaces InvalidAccountId / InvalidSecret etc.
      if (msg.includes("InvalidAccountId") || msg.includes("InvalidSecret")) {
        setError(
          mode === "signIn"
            ? "Email or password didn't match. Check both, or sign up if it's your first time."
            : "Couldn't create the account. The email may not be allow-listed."
        );
      } else if (msg.includes("not authorised")) {
        setError("This email is not allow-listed for the tool.");
      } else {
        setError(msg);
      }
    }
  };

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-xl dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
        <h1 className="text-2xl font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Uni Citation Tool
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">
          {mode === "signIn"
            ? "Sign in with your email and password."
            : "First time? Choose a password (at least 8 characters)."}
        </p>

        <form onSubmit={onSubmit} className="mt-6 space-y-4">
          <label className="block">
            <span className="text-sm text-slate-700 dark:text-slate-300">Email</span>
            <input
              type="email"
              required
              autoFocus
              autoComplete="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none"
              placeholder="you@example.com"
              disabled={submitting}
            />
          </label>

          <label className="block">
            <span className="text-sm text-slate-700 dark:text-slate-300">Password</span>
            <input
              type="password"
              required
              autoComplete={mode === "signIn" ? "current-password" : "new-password"}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none"
              placeholder={mode === "signIn" ? "your password" : "at least 8 characters"}
              disabled={submitting}
            />
          </label>

          {error ? <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p> : null}

          <button
            type="submit"
            disabled={submitting}
            className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
          >
            {submitting
              ? mode === "signIn"
                ? "Signing in…"
                : "Creating account…"
              : mode === "signIn"
                ? "Sign in"
                : "Sign up"}
          </button>

          <p className="text-center text-xs text-slate-500 dark:text-slate-400">
            {mode === "signIn" ? (
              <>
                First time?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signUp");
                    setError(null);
                  }}
                  className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Create an account
                </button>
              </>
            ) : (
              <>
                Already have an account?{" "}
                <button
                  type="button"
                  onClick={() => {
                    setMode("signIn");
                    setError(null);
                  }}
                  className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                >
                  Sign in
                </button>
              </>
            )}
          </p>
        </form>
      </div>
    </main>
  );
}
