"use client";

// Drop-in "ask about this result" chat panel for tool pages. Give it the
// tool key and a text serialisation of the result on screen; it runs a
// conversation scoped to that result. Stateless on the server — the
// conversation lives in this component's state, so it resets when the
// student runs the tool again or leaves the page.
//
//   <ToolChat tool="coach" title="Ask about this feedback" context={ctx} />

import { api } from "@/convex/_generated/api";
import { useAction } from "convex/react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { useStoredState } from "@/lib/useStoredState";
import { getErrorMessage } from "@/lib/getErrorMessage";
import ChatMarkdown from "./ChatMarkdown";

type Msg = { role: "user" | "assistant"; content: string };

const MODELS = [
  { value: "anthropic/claude-sonnet-4.6", label: "Claude Sonnet 4.6 (best)" },
  { value: "deepseek/deepseek-v4-flash", label: "DeepSeek Flash (fast)" },
  { value: "deepseek/deepseek-v4-pro", label: "DeepSeek Pro" },
];

export default function ToolChat({
  tool,
  context,
  title = "Ask about this result",
  suggestions = [],
}: {
  tool: string;
  context: string;
  title?: string;
  suggestions?: string[];
}) {
  const ask = useAction(api.toolChat.ask);
  const [messages, setMessages] = useState<Msg[]>([]);
  const [draft, setDraft] = useState("");
  const [sending, setSending] = useState(false);
  const [model, setModel] = useStoredState<string>(
    "uni-tool-chat-model",
    "anthropic/claude-sonnet-4.6",
  );
  const scrollRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const el = scrollRef.current;
    if (el) el.scrollTop = el.scrollHeight;
  }, [messages, sending]);

  const send = async (text: string) => {
    const message = text.trim();
    if (!message || sending) return;
    const next: Msg[] = [...messages, { role: "user", content: message }];
    setMessages(next);
    setDraft("");
    setSending(true);
    try {
      const res = (await ask({ tool, context, messages: next, model })) as {
        reply: string;
      };
      setMessages((m) => [...m, { role: "assistant", content: res.reply }]);
    } catch (err) {
      toast.error(getErrorMessage(err, "Couldn't send — try again."));
      // Roll the failed user turn back so it isn't left hanging.
      setMessages((m) => m.slice(0, -1));
      setDraft(message);
    } finally {
      setSending(false);
    }
  };

  return (
    <details className="group rounded-2xl border border-slate-200/80 bg-white/60 dark:border-slate-800/80 dark:bg-slate-950/40">
      <summary className="flex cursor-pointer items-center justify-between gap-2 px-4 py-3 text-sm font-semibold text-slate-800 dark:text-slate-200">
        <span className="flex items-center gap-2">
          <span aria-hidden>💬</span> {title}
        </span>
        <span className="text-xs font-normal text-sky-600 group-open:hidden dark:text-sky-400">
          Open
        </span>
        <span className="hidden text-xs font-normal text-slate-500 group-open:inline dark:text-slate-400">
          Hide
        </span>
      </summary>

      <div className="border-t border-slate-200/70 px-4 pb-3 dark:border-slate-800/70">
        <div
          ref={scrollRef}
          className="max-h-72 space-y-3 overflow-y-auto py-3"
          aria-live="polite"
        >
          {messages.length === 0 ? (
            <div>
              <p className="text-sm text-slate-500 dark:text-slate-400">
                Ask me anything about the result above. I can explain a point, expand a recommendation or show you how to act on it — but I won&apos;t write your assignment for you.
              </p>
              {suggestions.length > 0 && (
                <div className="mt-2 flex flex-wrap gap-2">
                  {suggestions.map((s) => (
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
              )}
            </div>
          ) : (
            messages.map((m, i) => (
              <div key={i} className={m.role === "user" ? "flex justify-end" : "flex justify-start"}>
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
                      <ChatMarkdown text={m.content} />
                    </div>
                  )}
                </div>
              </div>
            ))
          )}
          {sending && (
            <div className="flex justify-start">
              <div className="rounded-2xl rounded-bl-sm bg-slate-100 px-3 py-2 dark:bg-slate-800">
                <span className="inline-flex gap-1" role="status" aria-label="Tutor is typing">
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.3s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400 [animation-delay:-0.15s]" />
                  <span className="h-1.5 w-1.5 animate-bounce rounded-full bg-slate-400" />
                </span>
              </div>
            </div>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            void send(draft);
          }}
          className="flex items-end gap-2"
        >
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
            disabled={sending}
            placeholder="Ask about this result… (Enter to send)"
            className="max-h-28 min-h-[2.5rem] flex-1 resize-y rounded-xl border border-slate-300 bg-white px-3 py-2 text-sm text-slate-900 placeholder-slate-400 focus:border-sky-500 focus:outline-none focus:ring-2 focus:ring-sky-500/15 disabled:opacity-60 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-100 dark:placeholder-slate-500"
          />
          <button
            type="submit"
            disabled={sending || !draft.trim()}
            className="inline-flex h-10 items-center justify-center rounded-xl bg-gradient-to-b from-sky-500 to-sky-600 px-4 text-sm font-medium text-white shadow-sm transition-all hover:from-sky-400 hover:to-sky-500 disabled:cursor-not-allowed disabled:opacity-60"
          >
            Send
          </button>
        </form>
        <div className="mt-2 flex items-center justify-end">
          <label htmlFor={`toolchat-model-${tool}`} className="sr-only">
            Model
          </label>
          <select
            id={`toolchat-model-${tool}`}
            value={model}
            onChange={(e) => setModel(e.target.value)}
            disabled={sending}
            className="rounded-md border border-slate-300 bg-white px-2 py-1 text-[11px] text-slate-600 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-300"
          >
            {MODELS.map((m) => (
              <option key={m.value} value={m.value}>
                {m.label}
              </option>
            ))}
          </select>
        </div>
      </div>
    </details>
  );
}
