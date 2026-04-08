"use client";

import { FormEvent, useMemo, useState } from "react";
import { CloseIcon, TerminalIcon } from "./ui-icons";
import type { ProviderTheme } from "./providers";

type TerminalEntry = {
  id: string;
  command: string;
  output: string;
  ok: boolean;
  endpoint?: string;
};

type OllamaTerminalProps = {
  theme: ProviderTheme;
  isOpen: boolean;
  layout: "landing" | "docked";
  selectedModel: string;
  onClose: () => void;
};

type CliResponse = {
  ok: boolean;
  command?: string;
  endpoint?: string;
  output?: string;
  error?: string;
};

function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return String(Date.now()) + "-" + Math.random().toString(16).slice(2);
}

export function OllamaTerminal({
  theme,
  isOpen,
  layout,
  selectedModel,
  onClose,
}: OllamaTerminalProps) {
  const [command, setCommand] = useState("");
  const [entries, setEntries] = useState<TerminalEntry[]>([]);
  const [isRunning, setIsRunning] = useState(false);

  const quickCommands = useMemo(() => {
    const model = selectedModel || "llama3.2:1b";
    return ["ollama list", "ollama ps", "ollama show " + model, "ollama run " + model + ' "hello"'];
  }, [selectedModel]);

  if (!isOpen) return null;

  async function runCliCommand(raw: string) {
    const nextCommand = raw.trim();
    if (!nextCommand) return;

    setIsRunning(true);
    setCommand("");

    try {
      const response = await fetch("/api/ollama/cli", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ command: nextCommand }),
      });

      const payload = (await response.json()) as CliResponse;
      const ok = Boolean(response.ok && payload.ok);
      const output = ok
        ? payload.output || "(no output)"
        : [payload.error || "Command failed (" + response.status + ")", payload.output || ""]
            .filter(Boolean)
            .join("\n");

      setEntries((current) => [
        {
          id: createId(),
          command: payload.command || nextCommand,
          output,
          ok,
          endpoint: payload.endpoint,
        },
        ...current,
      ]);
    } catch (error) {
      setEntries((current) => [
        {
          id: createId(),
          command: nextCommand,
          ok: false,
          output: error instanceof Error ? error.message : "Terminal command failed.",
        },
        ...current,
      ]);
    } finally {
      setIsRunning(false);
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    runCliCommand(command);
  }

  return (
    <section
      id="ollama-terminal-panel"
      role="region"
      aria-label="Ollama terminal"
      className={layout === "landing" ? theme.terminal.frameLanding : theme.terminal.frameDocked}
    >
      <div className="mx-auto w-full max-w-4xl overflow-hidden rounded-2xl border border-stone-800 bg-stone-950 text-stone-100 shadow-[0_14px_36px_rgba(10,10,12,0.35)]">
        <header className="flex items-center justify-between border-b border-stone-800 px-3 py-2.5">
          <div className="flex items-center gap-2">
            <TerminalIcon className="h-4 w-4 text-emerald-300" />
            <p className="text-sm font-semibold tracking-wide">Ollama Terminal</p>
          </div>

          <button
            type="button"
            className="inline-flex h-8 w-8 items-center justify-center rounded-md border border-stone-700 bg-stone-900 text-stone-300 transition hover:bg-stone-800"
            onClick={onClose}
            aria-label="Close terminal panel"
          >
            <CloseIcon className="h-4 w-4" />
          </button>
        </header>

        <div className="border-b border-stone-800 px-3 py-2">
          <div className="flex flex-wrap gap-1.5">
            {quickCommands.map((quick) => (
              <button
                key={quick}
                type="button"
                className="inline-flex h-7 items-center rounded-md border border-stone-700 bg-stone-900 px-2 font-mono text-[11px] text-emerald-300 transition hover:border-stone-600 hover:bg-stone-800"
                onClick={() => runCliCommand(quick)}
                disabled={isRunning}
              >
                {quick}
              </button>
            ))}
          </div>
        </div>

        <div
          className="max-h-60 overflow-y-auto px-3 py-2.5 font-mono text-xs leading-5"
          role="log"
          aria-live="polite"
          aria-relevant="additions text"
        >
          {!entries.length ? (
            <p className="text-stone-400">
              No output yet. Run <span className="text-emerald-300">ollama list</span> to begin.
            </p>
          ) : null}

          <div className="space-y-3">
            {entries.slice(0, 40).map((entry) => (
              <article key={entry.id}>
                <p className="text-emerald-300">$ {entry.command}</p>
                {entry.endpoint ? <p className="text-stone-500"># {entry.endpoint}</p> : null}
                <pre
                  className={
                    "mt-1 overflow-x-auto whitespace-pre-wrap break-words " +
                    (entry.ok ? "text-stone-200" : "text-rose-300")
                  }
                >
                  {entry.output}
                </pre>
              </article>
            ))}
          </div>
        </div>

        <form className="border-t border-stone-800 px-3 py-2.5" onSubmit={handleSubmit}>
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm text-emerald-300">$</span>
            <input
              type="text"
              className="h-9 flex-1 rounded-md border border-stone-700 bg-stone-900 px-2.5 font-mono text-sm text-stone-100 outline-none transition focus:border-emerald-400"
              placeholder='ollama run llama3.2:1b "say hello"'
              value={command}
              onChange={(event) => setCommand(event.target.value)}
              disabled={isRunning}
              aria-label="Ollama CLI command"
            />
            <button
              type="submit"
              className="inline-flex h-9 items-center rounded-md border border-emerald-400/80 bg-emerald-400/15 px-3 text-sm font-semibold text-emerald-200 transition hover:bg-emerald-400/25 disabled:cursor-not-allowed disabled:opacity-40"
              disabled={isRunning || !command.trim()}
            >
              {isRunning ? "..." : "Run"}
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
