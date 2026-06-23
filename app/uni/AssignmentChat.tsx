"use client";

// Inline assignment-tutor chat panel for the dashboard. Tied to the
// active assignment chosen in the WorkspaceBar (via the same localStorage
// key + window event), it holds an ongoing conversation grounded
// server-side in that assignment's brief, rubric, checklist, outline and
// references. The model coaches — it never writes the assignment.

import { api } from "@/convex/_generated/api";
import type { Id } from "@/convex/_generated/dataModel";
import { useAction, useMutation, useQuery } from "convex/react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoredState } from "@/lib/useStoredState";
import { getErrorMessage } from "@/lib/getErrorMessage";
import { extractPdfText } from "@/lib/extractPdfText";
import { extractDocxText } from "@/lib/extractDocxText";

const STORAGE_KEY = "uni-active-assignment-v1";
const ACTIVE_EVENT = "uni:active-assignment-changed";

const MODELS = [
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (default — best tutor)" },
  { value: "deepseek/deepseek-v4-flash", label: "DeepSeek V4 Flash (fastest, cheapest)" },
  { value: "deepseek/deepseek-v4-pro", label: "DeepSeek V4 Pro (thorough)" },
];

const SUGGESTIONS = [
  "What is this assignment actually asking me to do?",
  "What am I missing against the rubric?",
  "Where is my argument weakest?",
  "Help me plan my next section.",
];

// Minimal, safe Markdown renderer — bold, inline code, bullet lists and
// paragraphs, rendered as React elements (no HTML injection). Enough for
// the tutor's replies without pulling in a dependency.
function renderInline(text: string, keyBase: string) {
  // Split on **bold** and `code` spans.
  const parts = text.split(/(\*\*[^*]+\*\*|`[^`]+`)/g);
  return parts.map((p, i) => {
    if (p.startsWith("**") && p.endsWith("**") && p.length > 4) {
      return <strong key={`${keyBase}-${i}`}>{p.slice(2, -2)}</strong>;
    }
    if (p.startsWith("`") && p.endsWith("`") && p.length > 2) {
      return (
        <code key={`${keyBase}-${i}`} className="rounded bg-slate-100 px-1 py-0.5 text-[0.85em] dark:bg-slate-800">
          {p.slice(1, -1)}
        </code>
      );
    }
    return <span key={`${keyBase}-${i}`}>{p}</span>;
  });
}

function Markdown({ text }: { text: string }) {
  const lines = text.split("\n");
  const blocks: React.ReactNode[] = [];
  let list: string[] = [];
  const flushList = (key: string) => {
    if (list.length === 0) return;
    const items = [...list];
    blocks.push(
      <ul key={key} className="my-1 list-disc space-y-0.5 pl-5">
        {items.map((it, i) => (
          <li key={i}>{renderInline(it, `${key}-${i}`)}</li>
        ))}
      </ul>,
    );
    list = [];
  };
  lines.forEach((raw, i) => {
    const line = raw.trimEnd();
    const bullet = line.match(/^\s*[-*]\s+(.*)$/);
    if (bullet) {
      list.push(bullet[1]);
      return;
    }
    flushList(`ul-${i}`);
    if (line.trim() === "") return;
    blocks.push(
      <p key={`p-${i}`} className="my-1">
        {renderInline(line, `p-${i}`)}
      </p>,
    );
  });
  flushList("ul-last");
  return <>{blocks}</>;
}

export default function AssignmentChat() {
  const assignments = useQuery(api.assignments.list);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [model, setModel] = useStoredState<string>(
    "uni-assignment-chat-model",
    "anthropic/claude-sonnet-4.6",
  );
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [extracting, setExtracting] = useState(false);
  const scrollRef = useRef<HTMLDivElement | null>(null);
  const fileRef = useRef<HTMLInputElement | null>(null);

  const ask = useAction(api.assignmentChat.ask);
  const clear = useMutation(api.assignmentChatHistory.clear);
  const setDraftDoc = useMutation(api.assignments.setDraft);

  // Track the active assignment from the workspace bar.
  useEffect(() => {
    try {
      const stored = window.localStorage.getItem(STORAGE_KEY);
      if (stored) setActiveId(stored);
    } catch {}
    const onChange = (e: Event) => setActiveId((e as CustomEvent<string | null>).detail);
    window.addEventListener(ACTIVE_EVENT, onChange);
    return () => window.removeEventListener(ACTIVE_EVENT, onChange);
  }, []);

  const assignmentId = activeId as Id<"assignments"> | null;
  const messages = useQuery(
    api.assignmentChatHistory.list,
    assignmentId ? { assignmentId } : "skip",
  );

  const activeAssignment = useMemo(
    () => assignments?.find((a) => a._id === activeId),
    [assignments, activeId],
  );

  // Auto-scroll to the newest message.
  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || !assignmentId) return;
    setDraft("");
    setSending(true);
    try {
      await ask({ assignmentId, message, model });
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send — try again."));
      setDraft(message); // restore so the question isn't lost
    } finally {
      setSending(false);
    }
  };

  const onClear = async () => {
    if (!assignmentId) return;
    try {
      await clear({ assignmentId });
      toast.success("Conversation cleared.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't clear."));
    }
  };

  const onUpload = async (file: File) => {
    if (!assignmentId) return;
    const name = file.name.toLowerCase();
    const isPdf = name.endsWith(".pdf") || file.type === "application/pdf";
    const isDocx =
      name.endsWith(".docx") ||
      file.type ===
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document";
    if (!isPdf && !isDocx) {
      toast.error("Upload a PDF or .docx file. Legacy .doc isn't supported.");
      return;
    }
    setExtracting(true);
    try {
      const text = isPdf
        ? (await extractPdfText(file, { maxChars: 60000 })).text
        : await extractDocxText(file, { maxChars: 60000 });
      await setDraftDoc({ id: assignmentId, draftText: text, draftFileName: file.name });
      toast.success(
        `Attached "${file.name}" — the tutor can now read your draft.`,
      );
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't read that document."));
    } finally {
      setExtracting(false);
    }
  };

  const onRemoveDraft = async () => {
    if (!assignmentId) return;
    try {
      await setDraftDoc({ id: assignmentId, draftText: "" });
      toast.success("Draft removed.");
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't remove draft."));
    }
  };

  const draftWordCount = activeAssignment?.draftText
    ? activeAssignment.draftText.trim().split(/\s+/).filter(Boolean).length
    : 0;

  const sectionCard =
    "rounded-2xl border border-slate-200/80 bg-gradient-to-br from-white via-white to-slate-50/60 shadow-[0_1px_2px_rgba(15,23,42,0.04),0_8px_24px_-12px_rgba(15,23,42,0.08)] dark:border-slate-800/80 dark:from-slate-950 dark:via-slate-950 dark:to-slate-950";

  return (
    <section className={sectionCard}>
      <header className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200/70 px-4 py-3 dark:border-slate-800/70">
        <div className="min-w-0">
          <h2 className="flex items-center gap-2 text-sm font-semibold text-slate-900 dark:text-slate-100">
            <span aria-hidden>💬</span> Assignment tutor
          </h2>
          <p className="mt-0.5 truncate text-xs text-slate-500 dark:text-slate-400">
            {activeAssignment
              ? `Asking about: ${activeAssignment.name}${activeAssignment.courseCode ? ` · ${activeAssignment.courseCode}` : ""}`
              : "Pick an active assignment in the workspace bar above to start."}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <label htmlFor="chat-model" className="sr-only">
            Model
          </label>
          <select
            id="chat-model"
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={sending}
            className="max-w-[12rem] rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-200"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
          {messages && messages.length > 0 && (
            <button
              type="button"
              onClick={onClear}
              className="rounded-md border border-slate-300 bg-white px-2 py-1 text-xs text-slate-600 transition-colors hover:border-rose-400 hover:text-rose-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
            >
              Clear
            </button>
          )}
        </div>
      </header>

      <div
        ref={scrollRef}
        className="max-h-80 min-h-[8rem] space-y-3 overflow-y-auto px-4 py-3"
        aria-live="polite"
      >
        {!assignmentId ? (
          <p className="py-6 text-center text-sm text-slate-400 dark:text-slate-500">
            No assignment selected yet.
          </p>
        ) : messages === undefined ? (
          <div className="space-y-2">
            <div className="h-4 w-2/3 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
            <div className="h-4 w-1/2 animate-pulse rounded bg-slate-100 dark:bg-slate-800" />
          </div>
        ) : messages.length === 0 ? (
          <div className="py-2">
            <p className="text-sm text-slate-500 dark:text-slate-400">
              Ask me anything about this assignment. I can see your brief, rubric, checklist, outline and references — and if you attach your draft with the 📎 button I&apos;ll review that too. I won&apos;t write it for you though. Try:
            </p>
            <div className="mt-2 flex flex-wrap gap-2">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  type="button"
                  onClick={() => send(s)}
                  disabled={sending}
                  className="rounded-full border border-slate-300 bg-white px-3 py-1 text-xs text-slate-700 transition-colors hover:border-sky-400 hover:text-sky-700 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500 dark:hover:text-sky-300"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        ) : (
          messages.map((m) => (
            <div
              key={m._id}
              className={m.role === "user" ? "flex justify-end" : "flex justify-start"}
            >
              <div
                className={
                  m.role === "user"
                    ? "max-w-[85%] rounded-2xl rounded-br-sm bg-sky-600 px-3 py-2 text-sm text-white"
                    : "max-w-[90%] rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-800 dark:bg-slate-800 dark:text-slate-100"
                }
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="leading-relaxed">
                    <Markdown text={m.content} />
                  </div>
                )}
              </div>
            </div>
          ))
        )}
        {sending && (
          <div className="flex justify-start">
            <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 text-sm text-slate-500 dark:bg-slate-800 dark:text-slate-400">
              <span className="inline-flex gap-1" role="status" aria-label="Tutor is typing">
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
              </span>
            </div>
          </div>
        )}
      </div>

      {assignmentId && activeAssignment?.draftFileName && (
        <div className="flex items-center gap-2 border-t border-slate-200/70 px-4 py-2 text-xs text-slate-600 dark:border-slate-800/70 dark:text-slate-400">
          <span aria-hidden>📎</span>
          <span className="min-w-0 truncate">
            Draft attached: <strong className="font-medium">{activeAssignment.draftFileName}</strong>
            {draftWordCount ? ` · ${draftWordCount.toLocaleString("en-NZ")} words` : ""}
          </span>
          <button
            type="button"
            onClick={onRemoveDraft}
            aria-label="Remove attached draft"
            className="ml-auto rounded-md px-1.5 py-0.5 text-slate-400 transition-colors hover:bg-slate-100 hover:text-rose-600 dark:hover:bg-slate-800"
          >
            Remove
          </button>
        </div>
      )}

      <form
        onSubmit={(e) => {
          e.preventDefault();
          void send(draft);
        }}
        className="flex items-end gap-2 border-t border-slate-200/70 px-4 py-3 dark:border-slate-800/70"
      >
        <input
          ref={fileRef}
          type="file"
          accept=".pdf,application/pdf,.docx,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
          className="hidden"
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) void onUpload(f);
            e.target.value = "";
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          disabled={!assignmentId || extracting || sending}
          aria-label="Attach your draft document (PDF or Word)"
          title="Attach your draft (PDF or Word)"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-xl border border-slate-300 bg-white text-slate-600 transition-colors hover:border-sky-400 hover:text-sky-700 disabled:cursor-not-allowed disabled:opacity-60 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300 dark:hover:border-sky-500"
        >
          {extracting ? (
            <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-slate-300 border-t-sky-500" role="status" aria-label="Reading document" />
          ) : (
            <span aria-hidden>📎</span>
          )}
        </button>
        <textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter" && !e.shiftKey) {
              e.preventDefault();
              void send(draft);
            }
          }}
          rows={1}
          disabled={!assignmentId || sending}
          placeholder={assignmentId ? "Ask about this assignment… (Enter to send, Shift+Enter for a new line)" : "Pick an assignment first"}
          className="max-h-32 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
        />
        <button
          type="submit"
          disabled={!assignmentId || sending || !draft.trim()}
          className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-sky-400 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
        >
          Send
        </button>
      </form>
    </section>
  );
}
