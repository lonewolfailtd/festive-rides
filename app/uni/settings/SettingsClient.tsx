"use client";

import { api } from "@/convex/_generated/api";
import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import PageHeader from "../PageHeader";

const labelStyle =
  "block text-xs font-medium uppercase tracking-wide text-slate-500 dark:text-slate-400";
const inputStyle =
  "mt-1 block w-full rounded-lg border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 shadow-sm transition-all focus:border-sky-500 focus:outline-none focus:ring-4 focus:ring-sky-500/15 focus:shadow-md dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500 dark:shadow-none dark:focus:shadow-none";
const buttonPrimary =
  "inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-sky-500 to-sky-600 px-4 py-2 text-sm font-medium text-white shadow-sm shadow-sky-900/20 transition-all hover:-translate-y-px hover:from-sky-400 hover:to-sky-500 hover:shadow-md hover:shadow-sky-900/30 active:translate-y-0 active:from-sky-600 active:to-sky-700 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0";
const buttonSecondary =
  "inline-flex items-center justify-center rounded-lg border border-slate-300 bg-white px-3 py-1.5 text-sm text-slate-800 transition-all hover:-translate-y-px hover:border-slate-400 hover:bg-slate-100 hover:text-slate-900 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200 dark:hover:border-slate-500 dark:hover:bg-slate-800 dark:hover:text-white";
const sectionCard =
  "rounded-2xl border border-slate-200 bg-gradient-to-br from-white to-slate-50/50 p-5 shadow-sm dark:border-slate-800 dark:from-slate-950 dark:to-slate-950 dark:shadow-none";

const MIN_PASSWORD_LEN = 8;

function formatDateForFilename(d: Date): string {
  const yyyy = d.getFullYear();
  const mm = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

export default function SettingsClient() {
  const me = useQuery(api.userSettings.me);
  const usage = useQuery(api.usage.myUsage);
  const exportData = useQuery(api.dataExport.exportAll);
  const changePassword = useMutation(api.userSettings.changePassword);
  const signOutEverywhere = useMutation(api.userSettings.signOutEverywhere);
  const deleteMyAccount = useMutation(api.userSettings.deleteMyAccount);
  const { signOut } = useAuthActions();
  const router = useRouter();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [changingPassword, setChangingPassword] = useState(false);
  const [signingOutAll, setSigningOutAll] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteConfirmEmail, setDeleteConfirmEmail] = useState("");
  const [deletingAccount, setDeletingAccount] = useState(false);

  const handleChangePassword = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (newPassword.length < MIN_PASSWORD_LEN) {
      toast.error(`New password must be at least ${MIN_PASSWORD_LEN} characters.`);
      return;
    }
    if (newPassword !== confirmPassword) {
      toast.error("New password and confirmation do not match.");
      return;
    }
    if (!currentPassword) {
      toast.error("Please enter your current password.");
      return;
    }
    setChangingPassword(true);
    try {
      await changePassword({ currentPassword, newPassword });
      toast.success(
        "Password reset. You'll be signed out — sign in again with your new password."
      );
      setCurrentPassword("");
      setNewPassword("");
      setConfirmPassword("");
      // Give the toast a moment to render before the redirect.
      setTimeout(() => {
        void signOut();
      }, 1200);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not change password."
      );
    } finally {
      setChangingPassword(false);
    }
  };

  const handleSignOutEverywhere = async () => {
    if (!confirm("Sign out of every device? You'll need to sign in again here too.")) {
      return;
    }
    setSigningOutAll(true);
    try {
      await signOutEverywhere({});
      toast.success("Signed out of every device.");
      setTimeout(() => {
        void signOut();
      }, 800);
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not sign out everywhere."
      );
      setSigningOutAll(false);
    }
  };

  const handleExport = () => {
    if (!exportData) {
      toast.error("Export is still loading — please try again in a moment.");
      return;
    }
    setExporting(true);
    try {
      const json = JSON.stringify(exportData, null, 2);
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `uni-citation-export-${formatDateForFilename(new Date())}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      toast.success("Export downloaded.");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not build the export file."
      );
    } finally {
      setExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    if (!me?.email) {
      toast.error("Couldn't read your account email — try refreshing.");
      return;
    }
    setDeletingAccount(true);
    try {
      await deleteMyAccount({ confirmEmail: deleteConfirmEmail });
      toast.success("Account deleted");
      // Sign out client-side too in case the auth row hasn't propagated.
      void signOut();
      router.push("/uni/login");
    } catch (err) {
      toast.error(
        err instanceof Error ? err.message : "Could not delete account."
      );
      setDeletingAccount(false);
    }
  };

  const deleteEmailMatches =
    me?.email !== undefined &&
    me?.email !== null &&
    deleteConfirmEmail.trim().toLowerCase() ===
      (me?.email ?? "").trim().toLowerCase();

  const exportCounts = exportData
    ? {
        assignments: exportData.assignments.length,
        courses: exportData.courses.length,
        references: exportData.references.length,
        analyses: exportData.analyses.length,
      }
    : null;

  return (
    <main className="mx-auto max-w-3xl px-4 py-10">
      <PageHeader
        eyebrow="Settings"
        title="Account and data"
        description="Manage your password, sign out of other devices and download a complete copy of your data."
      />

      <div className="space-y-6">
        <section className={sectionCard}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Account
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Signed in as{" "}
            <span className="font-medium text-slate-900 dark:text-slate-100">
              {me?.email ?? "…"}
            </span>
          </p>
        </section>

        <section className={sectionCard}>
          <form onSubmit={handleChangePassword} className="space-y-4">
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              Change password
            </h2>
            <p className="-mt-2 text-xs text-slate-500 dark:text-slate-400">
              For safety this will sign you out — sign back in with your new
              password.
            </p>

            <div>
              <span className={labelStyle}>Current password</span>
              <input
                type="password"
                value={currentPassword}
                onChange={(e) => setCurrentPassword(e.target.value)}
                autoComplete="current-password"
                className={inputStyle}
                required
              />
            </div>
            <div>
              <span className={labelStyle}>New password</span>
              <input
                type="password"
                value={newPassword}
                onChange={(e) => setNewPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LEN}
                className={inputStyle}
                required
              />
              <p className="mt-1 text-xs text-slate-500 dark:text-slate-400">
                At least {MIN_PASSWORD_LEN} characters.
              </p>
            </div>
            <div>
              <span className={labelStyle}>Confirm new password</span>
              <input
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                autoComplete="new-password"
                minLength={MIN_PASSWORD_LEN}
                className={inputStyle}
                required
              />
              {confirmPassword.length > 0 && confirmPassword !== newPassword && (
                <p className="mt-1 text-xs text-rose-500 dark:text-rose-400">
                  Passwords do not match.
                </p>
              )}
            </div>

            <button
              type="submit"
              disabled={changingPassword}
              className={buttonPrimary}
            >
              {changingPassword ? "Updating…" : "Change password"}
            </button>
          </form>
        </section>

        {/* AI usage — daily call count + monthly spend, with progress bars */}
        {usage && (
          <section className={sectionCard}>
            <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
              AI usage this month
            </h2>
            <p className="mt-1 text-sm text-slate-600 dark:text-slate-400">
              Caps protect you (and me) from a runaway loop burning through OpenRouter credits.
              Resets on the 1st of each month.
            </p>
            <div className="mt-4 space-y-4">
              {(() => {
                const dailyPct = Math.min(100, Math.round((usage.todayCalls / usage.dailyCap) * 100));
                const dailyTone = dailyPct >= 80 ? "bg-rose-500" : dailyPct >= 50 ? "bg-amber-500" : "bg-emerald-500";
                const spentUsd = usage.monthSpentMicrocents / 1_000_000;
                const spentPct = Math.min(100, Math.round((usage.monthSpentMicrocents / usage.monthCapMicrocents) * 100));
                const spendTone = spentPct >= 80 ? "bg-rose-500" : spentPct >= 50 ? "bg-amber-500" : "bg-emerald-500";
                return (
                  <>
                    <div>
                      <div className="flex items-baseline justify-between text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-medium">Today</span>
                        <span>
                          <span className="font-mono">{usage.todayCalls}</span> of {usage.dailyCap} calls
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className={`h-full ${dailyTone} transition-all`} style={{ width: `${dailyPct}%` }} />
                      </div>
                    </div>
                    <div>
                      <div className="flex items-baseline justify-between text-xs text-slate-700 dark:text-slate-300">
                        <span className="font-medium">This month spend</span>
                        <span>
                          ~<span className="font-mono">${spentUsd.toFixed(3)}</span> of ${usage.monthCapUsd} cap (
                          <span className="font-mono">{usage.monthCalls}</span> calls)
                        </span>
                      </div>
                      <div className="mt-1 h-1.5 w-full overflow-hidden rounded-full bg-slate-200 dark:bg-slate-800">
                        <div className={`h-full ${spendTone} transition-all`} style={{ width: `${spentPct}%` }} />
                      </div>
                    </div>
                    {usage.byAction.length > 0 && (
                      <details className="text-xs text-slate-700 dark:text-slate-300">
                        <summary className="cursor-pointer hover:text-sky-700 dark:hover:text-sky-300">
                          By tool ({usage.byAction.length})
                        </summary>
                        <ul className="mt-2 space-y-1">
                          {[...usage.byAction]
                            .sort((a, b) => b.microcents - a.microcents)
                            .map((row) => (
                              <li key={row.action} className="flex items-baseline justify-between gap-3 font-mono">
                                <span>{row.action}</span>
                                <span>
                                  {row.calls} calls · ~${(row.microcents / 1_000_000).toFixed(4)}
                                </span>
                              </li>
                            ))}
                        </ul>
                      </details>
                    )}
                  </>
                );
              })()}
            </div>
          </section>
        )}

        <section className={sectionCard}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Calendar subscription
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Generate, rotate or revoke the long-lived URL that lets Google
            Calendar and Apple Calendar pull your assignment due dates.
          </p>
          <div className="mt-4">
            <Link
              href="/uni/calendar"
              className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
            >
              Manage on the calendar page →
            </Link>
          </div>
        </section>

        <section className={sectionCard}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            Data export
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Download a complete JSON dump of every assignment, course,
            reference, analysis and your calendar token. Keep the file
            private — it contains everything you've stored in the tool.
          </p>

          {exportCounts && (
            <p className="mt-3 text-xs text-slate-500 dark:text-slate-400">
              Currently: {exportCounts.assignments} assignments ·{" "}
              {exportCounts.courses} courses · {exportCounts.references}{" "}
              references · {exportCounts.analyses} analyses
            </p>
          )}

          <div className="mt-4">
            <button
              type="button"
              onClick={handleExport}
              disabled={exporting || !exportData}
              className={buttonPrimary}
            >
              {exporting
                ? "Building file…"
                : exportData
                  ? "Export my data"
                  : "Loading…"}
            </button>
          </div>
        </section>

        <section className="rounded-2xl border border-rose-200 bg-rose-50 p-5 shadow-sm dark:border-rose-900/60 dark:bg-rose-950/30">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-rose-800 dark:text-rose-200">
            Danger zone
          </h2>
          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              type="button"
              onClick={handleSignOutEverywhere}
              disabled={signingOutAll}
              className="rounded-md border border-rose-400 bg-white px-2 py-1 text-xs text-rose-800 hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-900/30"
            >
              {signingOutAll ? "Signing out…" : "Sign out everywhere"}
            </button>
            <p className="text-xs text-slate-600 dark:text-slate-400">
              Wipes every active session including this one.
            </p>
          </div>

          <div className="mt-5 border-t border-rose-200 pt-4 dark:border-rose-900/60">
            {!showDeleteConfirm ? (
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(true)}
                  className="rounded-md border border-rose-400 bg-white px-2 py-1 text-xs text-rose-800 hover:bg-rose-50 dark:border-rose-700 dark:bg-slate-900 dark:text-rose-200 dark:hover:bg-rose-900/30"
                >
                  Delete account
                </button>
                <p className="text-xs text-slate-600 dark:text-slate-400">
                  Permanently removes your login and every assignment, course, reference and analysis. This cannot be undone.
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                <h3 className="text-sm font-semibold text-rose-800 dark:text-rose-200">
                  Are you sure?
                </h3>
                <p className="text-xs text-slate-700 dark:text-slate-300">
                  This will permanently delete your login and all of your data — assignments, courses, references, analyses, calendar tokens and AI usage history. There is no recovery.
                </p>
                <div>
                  <span className={labelStyle}>Your email</span>
                  <input
                    type="email"
                    readOnly
                    value={me?.email ?? ""}
                    className={`${inputStyle} cursor-not-allowed opacity-70`}
                  />
                </div>
                <div>
                  <span className={labelStyle}>
                    Type your email to confirm
                  </span>
                  <input
                    type="email"
                    value={deleteConfirmEmail}
                    onChange={(e) => setDeleteConfirmEmail(e.target.value)}
                    autoComplete="off"
                    className={inputStyle}
                  />
                </div>
                <div className="flex flex-wrap items-center gap-3 pt-1">
                  <button
                    type="button"
                    onClick={handleDeleteAccount}
                    disabled={!deleteEmailMatches || deletingAccount}
                    className="inline-flex items-center justify-center rounded-lg bg-gradient-to-b from-rose-500 to-rose-600 px-4 py-2 text-sm font-medium text-white shadow-sm transition-all hover:-translate-y-px hover:from-rose-400 hover:to-rose-500 active:translate-y-0 disabled:cursor-not-allowed disabled:opacity-60 disabled:hover:translate-y-0"
                  >
                    {deletingAccount
                      ? "Deleting…"
                      : "Permanently delete my account"}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setShowDeleteConfirm(false);
                      setDeleteConfirmEmail("");
                    }}
                    disabled={deletingAccount}
                    className={buttonSecondary}
                  >
                    Cancel
                  </button>
                </div>
              </div>
            )}
          </div>
        </section>

        <section className={sectionCard}>
          <h2 className="text-sm font-semibold uppercase tracking-wide text-slate-700 dark:text-slate-300">
            About
          </h2>
          <p className="mt-2 text-sm text-slate-600 dark:text-slate-400">
            Uni Citation Tool · powered by DeepSeek V4 via OpenRouter · NZ
            English · APA 7
          </p>
        </section>
      </div>
    </main>
  );
}
