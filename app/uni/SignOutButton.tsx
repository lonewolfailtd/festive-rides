"use client";

import { useAuthActions } from "@convex-dev/auth/react";

export default function SignOutButton({ className = "" }: { className?: string }) {
  const { signOut } = useAuthActions();
  return (
    <button
      type="button"
      onClick={() => signOut()}
      className={`rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-medium text-slate-700 transition-colors hover:border-rose-400 hover:text-rose-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-rose-500 dark:hover:text-rose-300 ${className}`}
    >
      Sign out
    </button>
  );
}
