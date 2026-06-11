"use client";

import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation } from "convex/react";
import { api } from "@/convex/_generated/api";
import { useState } from "react";
import { ThemeToggle } from "../ThemeProvider";
import { getErrorMessage } from "@/lib/getErrorMessage";

type Mode = "signIn" | "signUp" | "reset";

export default function UniLoginPage() {
  const { signIn } = useAuthActions();
  const requestReset = useMutation(api.passwordReset.requestReset);

  const [mode, setMode] = useState<Mode>("signIn");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  const inputCx =
    "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";

  const onSignInOrUp = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
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
      // Redirect handled by middleware on success.
    } catch (err) {
      setSubmitting(false);
      const msg = getErrorMessage(err, "Could not sign in.");
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

  const onResetSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setError(null);
    setResetMessage(null);
    const cleaned = email.trim().toLowerCase();
    if (!cleaned) {
      setError("Enter your email.");
      return;
    }
    setSubmitting(true);
    try {
      const res = await requestReset({ email: cleaned });
      // Always show the same friendly message regardless of allow-list /
      // account state — avoids enumeration. Then switch to sign-up so the
      // user can immediately set a new password.
      setResetMessage(
        "If your email is registered, the password has been cleared. Set a new one below to finish."
      );
      setMode("signUp");
      setPassword("");
      // res.action used internally only, never surfaced.
      void res;
    } catch (err) {
      setError(getErrorMessage(err, "Reset failed."));
    } finally {
      setSubmitting(false);
    }
  };

  const headingCopy =
    mode === "signIn"
      ? "Sign in with your email and password."
      : mode === "signUp"
        ? "First time? Choose a password (at least 8 characters)."
        : "Forgot your password? Enter your email and we'll clear it so you can set a new one.";

  return (
    <main className="relative flex min-h-screen items-center justify-center px-4 py-12">
      {/* Decorative gradient orbs that subtly tint the login viewport. Pure CSS, no images. */}
      <div
        aria-hidden
        className="pointer-events-none fixed -top-32 -left-32 -z-10 h-96 w-96 rounded-full bg-gradient-to-br from-sky-200/40 via-sky-100/20 to-transparent blur-3xl dark:from-sky-900/30 dark:via-sky-950/15"
      />
      <div
        aria-hidden
        className="pointer-events-none fixed -bottom-32 -right-32 -z-10 h-96 w-96 rounded-full bg-gradient-to-tl from-sky-200/30 via-sky-100/15 to-transparent blur-3xl dark:from-sky-900/25 dark:via-sky-950/10"
      />
      <div className="absolute right-4 top-4">
        <ThemeToggle />
      </div>
      <div className="w-full max-w-md rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-8 shadow-xl dark:border-slate-800 dark:from-slate-950 dark:to-slate-950">
        <h1 className="text-2xl font-display font-semibold tracking-tight text-slate-900 dark:text-slate-100">
          Uni Citation Tool
        </h1>
        <p className="mt-1 text-sm text-slate-500 dark:text-slate-400">{headingCopy}</p>

        {resetMessage && (
          <div className="mt-4 rounded-lg border border-emerald-300 bg-emerald-50 p-3 text-sm text-emerald-800 dark:border-emerald-700/50 dark:bg-emerald-900/30 dark:text-emerald-200">
            {resetMessage}
          </div>
        )}

        {mode === "reset" ? (
          <form onSubmit={onResetSubmit} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-300">Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCx}
                placeholder="you@example.com"
                disabled={submitting}
              />
            </label>

            {error ? (
              <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>
            ) : null}

            <button
              type="submit"
              disabled={submitting}
              className="inline-flex w-full items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
            >
              {submitting ? "Clearing…" : "Clear my password"}
            </button>

            <p className="text-center text-xs text-slate-500 dark:text-slate-400">
              <button
                type="button"
                onClick={() => {
                  setMode("signIn");
                  setError(null);
                  setResetMessage(null);
                }}
                className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
              >
                Back to sign in
              </button>
            </p>
          </form>
        ) : (
          <form onSubmit={onSignInOrUp} className="mt-6 space-y-4">
            <label className="block">
              <span className="text-sm text-slate-700 dark:text-slate-300">Email</span>
              <input
                type="email"
                required
                autoFocus
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={inputCx}
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
                className={inputCx}
                placeholder={mode === "signIn" ? "your password" : "at least 8 characters"}
                disabled={submitting}
              />
            </label>

            {error ? (
              <p className="text-sm text-rose-500 dark:text-rose-400">{error}</p>
            ) : null}

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

            <div className="space-y-1.5 text-center text-xs text-slate-500 dark:text-slate-400">
              <p>
                {mode === "signIn" ? (
                  <>
                    First time?{" "}
                    <button
                      type="button"
                      onClick={() => {
                        setMode("signUp");
                        setError(null);
                        setResetMessage(null);
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
                        setResetMessage(null);
                      }}
                      className="font-medium text-sky-600 hover:text-sky-500 dark:text-sky-400 dark:hover:text-sky-300"
                    >
                      Sign in
                    </button>
                  </>
                )}
              </p>
              <p>
                <button
                  type="button"
                  onClick={() => {
                    setMode("reset");
                    setError(null);
                    setResetMessage(null);
                    setPassword("");
                  }}
                  className="text-slate-500 hover:text-slate-700 dark:text-slate-400 dark:hover:text-slate-200"
                >
                  Forgot password?
                </button>
              </p>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
