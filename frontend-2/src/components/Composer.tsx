"use client";

import { useRef, useState } from "react";
import { ArrowUp, Square } from "lucide-react";
import { useStore } from "@/store/useStore";
import { cn } from "@/utils/cn";

export function Composer({
  onSend,
  onStop,
}: {
  onSend: (text: string) => void;
  onStop: () => void;
}) {
  const [value, setValue] = useState("");
  const streaming = useStore((s) => s.streaming);
  const settings = useStore((s) => s.settings);
  const setSettingsOpen = useStore((s) => s.setSettingsOpen);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const apiKey = settings.apiKeys[settings.provider];
  const ready = Boolean(apiKey && settings.model);

  const submit = () => {
    const text = value.trim();
    if (!text || streaming) return;
    if (!ready) {
      setSettingsOpen(true);
      return;
    }
    onSend(text);
    setValue("");
    if (textareaRef.current) textareaRef.current.style.height = "auto";
  };

  const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      submit();
    }
  };

  const autoGrow = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setValue(e.target.value);
    const el = e.target;
    el.style.height = "auto";
    el.style.height = Math.min(el.scrollHeight, 200) + "px";
  };

  return (
    <div className="px-4 pb-4">
      <div className="mx-auto w-full max-w-3xl">
        {!ready && (
          <button
            onClick={() => setSettingsOpen(true)}
            className="mb-2 w-full rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs text-amber-200 transition hover:bg-amber-500/15"
          >
            Add your API key and pick a model in Settings to start chatting.
          </button>
        )}
        <div className="flex items-end gap-2 rounded-2xl border border-[var(--color-border)] bg-[var(--color-bg-elev)] p-2 shadow-xl focus-within:border-[var(--color-accent)]/50">
          <textarea
            ref={textareaRef}
            value={value}
            onChange={autoGrow}
            onKeyDown={handleKeyDown}
            rows={1}
            placeholder="Ask Curro to build or change something…"
            className="max-h-[200px] flex-1 resize-none bg-transparent px-2 py-1.5 text-sm outline-none placeholder:text-[var(--color-muted)]"
          />
          {streaming ? (
            <button
              onClick={onStop}
              className="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[var(--color-bg-elev2)] text-[var(--color-fg)] transition hover:bg-red-500/20 hover:text-red-300"
              title="Stop"
            >
              <Square className="h-4 w-4" />
            </button>
          ) : (
            <button
              onClick={submit}
              disabled={!value.trim()}
              className={cn(
                "flex h-9 w-9 shrink-0 items-center justify-center rounded-xl transition",
                value.trim()
                  ? "bg-[var(--color-accent)] text-white hover:opacity-90"
                  : "cursor-not-allowed bg-[var(--color-bg-elev2)] text-[var(--color-muted)]",
              )}
              title="Send"
            >
              <ArrowUp className="h-4 w-4" />
            </button>
          )}
        </div>
        <p className="mt-1.5 text-center text-[11px] text-[var(--color-muted)]">
          Curro runs locally — files are written to your workspace and shell commands run on your machine.
        </p>
      </div>
    </div>
  );
}
