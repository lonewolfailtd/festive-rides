"use client";

import React from "react";
import Link from "next/link";

interface Props {
  children: React.ReactNode;
  toolName: string;
}

interface State {
  error: Error | null;
}

export class ToolErrorBoundary extends React.Component<Props, State> {
  state: State = { error: null };

  static getDerivedStateFromError(error: Error) {
    return { error };
  }

  componentDidCatch(error: Error, info: React.ErrorInfo) {
    // Always log to the browser console regardless of mode — useful in
    // production via the user's devtools.
    console.error("Tool crashed:", this.props.toolName, error, info);
  }

  render() {
    if (this.state.error) {
      // In production, redact stack traces — they leak file paths, line
      // numbers and sometimes user data fragments through error messages.
      // Show a short reference id instead so the user can paste it in a
      // bug report and the developer can correlate via the console log.
      const isProd = process.env.NODE_ENV === "production";
      const refId =
        // Stable-ish 8-char hash of the message + tool name + day. Same error
        // happening twice gets the same id; different errors get different ids.
        Math.abs(
          [...`${this.props.toolName}|${this.state.error.message}|${new Date().toDateString()}`]
            .reduce((h, c) => (h * 31 + c.charCodeAt(0)) | 0, 0),
        )
          .toString(36)
          .slice(0, 8);

      return (
        <main className="mx-auto max-w-3xl px-4 py-12">
          <div className="rounded-2xl border border-rose-200 bg-rose-50 p-6 dark:border-rose-900/60 dark:bg-rose-950/30">
            <h1 className="text-lg font-semibold text-rose-900 dark:text-rose-200">
              The {this.props.toolName} tool hit a problem
            </h1>
            <p className="mt-2 text-sm text-slate-700 dark:text-slate-300">
              Try the button below. If it keeps failing, sign out and back in, or jump back to the dashboard and pick a different tool.
            </p>
            {isProd ? (
              <p className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                If you need to report this, mention reference{" "}
                <code className="rounded bg-white px-1.5 py-0.5 font-mono dark:bg-slate-900">
                  {refId}
                </code>
                . Full details are in your browser console (Cmd/Ctrl + Shift + J).
              </p>
            ) : (
              <details className="mt-3 text-xs text-slate-600 dark:text-slate-400">
                <summary className="cursor-pointer">Technical details (dev mode)</summary>
                <pre className="mt-2 overflow-auto rounded bg-white p-2 dark:bg-slate-900">
                  {this.state.error.message}
                  {"\n\n"}
                  {this.state.error.stack}
                </pre>
              </details>
            )}
            <div className="mt-4 flex flex-wrap gap-2">
              <button
                onClick={() => this.setState({ error: null })}
                className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white hover:from-sky-400 hover:to-sky-500"
              >
                Try again
              </button>
              <Link
                href="/uni"
                className="inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-4 py-2 text-sm text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
              >
                Back to dashboard
              </Link>
            </div>
          </div>
        </main>
      );
    }
    return this.props.children;
  }
}
