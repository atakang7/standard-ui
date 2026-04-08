"use client";

import { FormEvent, useEffect, useMemo, useState } from "react";
import type { ProviderTheme } from "./providers";
import type { AppearanceMode } from "../../lib/types";

type AppearanceChoice = {
  id: AppearanceMode;
  label: string;
  note: string;
};

type SettingsSection = "general" | "integrations";
type ProviderStreamFormat = "ndjson" | "sse-standard" | "openai";
type ProviderModelsSource = "remote" | "static";

type ProviderSummary = {
  id: string;
  name: string;
  baseUrl: string;
  modelsPath: string;
  chatPath: string;
  modelsSource: ProviderModelsSource;
  staticModels?: Array<{ id?: string; meta?: string }>;
  headers?: Record<string, string>;
  streamFormat: ProviderStreamFormat;
};

const APPEARANCE_CHOICES: AppearanceChoice[] = [
  { id: "light", label: "Light", note: "Always use the light interface." },
  { id: "system", label: "System", note: "Match your system appearance." },
  { id: "dark", label: "Dark", note: "Always use the dark interface." },
];

const STREAM_FORMAT_OPTIONS: Array<{ id: ProviderStreamFormat; label: string; note: string }> = [
  {
    id: "ndjson",
    label: "NDJSON",
    note: "Expect newline-delimited JSON events.",
  },
  {
    id: "sse-standard",
    label: "SSE (standard)",
    note: "Expect SSE data events with JSON chunks.",
  },
  {
    id: "openai",
    label: "SSE (OpenAI)",
    note: "Expect OpenAI-style SSE deltas.",
  },
];

type SettingsViewProps = {
  theme: ProviderTheme;
  appearanceMode: AppearanceMode;
  streamReadabilityPace: number;
  onAppearanceModeSelect: (mode: AppearanceMode) => void;
  onStreamReadabilityPaceChange: (value: number) => void;
  onProvidersChanged?: () => void;
};

function parseStaticModelsInput(input: string) {
  return input
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => {
      const [idPart, ...metaParts] = line.split("|");
      const id = idPart?.trim() || "";
      const meta = metaParts.join("|").trim();
      if (!id) return null;
      return {
        id,
        ...(meta ? { meta } : {}),
      };
    })
    .filter((entry): entry is { id: string; meta?: string } => Boolean(entry));
}

function stringifyHeaders(headers?: Record<string, string>) {
  if (!headers || typeof headers !== "object") return "{}";
  const entries = Object.entries(headers).filter(([key, value]) => key && typeof value === "string");
  if (!entries.length) return "{}";
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

export function SettingsView({
  theme,
  appearanceMode,
  streamReadabilityPace,
  onAppearanceModeSelect,
  onStreamReadabilityPaceChange,
  onProvidersChanged,
}: SettingsViewProps) {
  const isDark = theme.isDark;
  const [section, setSection] = useState<SettingsSection>("general");
  const [providers, setProviders] = useState<ProviderSummary[]>([]);
  const [providersLoading, setProvidersLoading] = useState(false);
  const [providersError, setProvidersError] = useState("");
  const [providerName, setProviderName] = useState("");
  const [providerBaseUrl, setProviderBaseUrl] = useState("");
  const [modelsPath, setModelsPath] = useState("/models");
  const [chatPath, setChatPath] = useState("/chat/stream");
  const [modelsSource, setModelsSource] = useState<ProviderModelsSource>("remote");
  const [streamFormat, setStreamFormat] = useState<ProviderStreamFormat>("ndjson");
  const [headersInput, setHeadersInput] = useState("{\n  \"accept\": \"application/x-ndjson\"\n}");
  const [staticModelsInput, setStaticModelsInput] = useState("");
  const [providerSaveState, setProviderSaveState] = useState<"idle" | "saving" | "saved" | "error">("idle");
  const [providerSaveMessage, setProviderSaveMessage] = useState("");

  const providerCountLabel = useMemo(() => {
    if (providersLoading) return "Loading...";
    if (!providers.length) return "No custom integrations yet";
    return `${providers.length} integration${providers.length > 1 ? "s" : ""}`;
  }, [providers.length, providersLoading]);

  async function loadProviders() {
    setProvidersLoading(true);
    setProvidersError("");

    try {
      const response = await fetch("/api/providers", { cache: "no-store" });
      const payload = (await response.json()) as { providers?: ProviderSummary[]; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load integrations (${response.status})`);
      }
      setProviders(Array.isArray(payload.providers) ? payload.providers : []);
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load integrations.";
      setProvidersError(message);
      setProviders([]);
    } finally {
      setProvidersLoading(false);
    }
  }

  useEffect(() => {
    void loadProviders();
  }, []);

  async function handleSaveProvider(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setProviderSaveState("saving");
    setProviderSaveMessage("");

    let parsedHeaders: Record<string, string> = {};
    try {
      const parsed = JSON.parse(headersInput || "{}") as unknown;
      if (parsed && typeof parsed === "object" && !Array.isArray(parsed)) {
        parsedHeaders = Object.entries(parsed as Record<string, unknown>).reduce<Record<string, string>>(
          (acc, [key, value]) => {
            if (typeof value === "string" && key.trim() && value.trim()) {
              acc[key.trim()] = value.trim();
            }
            return acc;
          },
          {}
        );
      } else {
        throw new Error("Headers must be a JSON object.");
      }
    } catch (error) {
      const message = error instanceof Error ? error.message : "Headers JSON is invalid.";
      setProviderSaveState("error");
      setProviderSaveMessage(message);
      return;
    }

    try {
      const response = await fetch("/api/providers", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          name: providerName,
          baseUrl: providerBaseUrl,
          modelsPath,
          chatPath,
          modelsSource,
          streamFormat,
          headers: parsedHeaders,
          staticModels: parseStaticModelsInput(staticModelsInput),
        }),
      });

      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to save integration (${response.status})`);
      }

      setProviderSaveState("saved");
      setProviderSaveMessage("Integration saved.");
      if (modelsSource === "static") {
        setStaticModelsInput("");
      }

      await loadProviders();
      onProvidersChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to save integration.";
      setProviderSaveState("error");
      setProviderSaveMessage(message);
    }
  }

  async function handleDeleteProvider(providerId: string, providerNameValue: string) {
    const confirmed = window.confirm(`Delete integration "${providerNameValue}"?`);
    if (!confirmed) return;

    setProviderSaveState("idle");
    setProviderSaveMessage("");

    try {
      const response = await fetch(`/api/providers?id=${encodeURIComponent(providerId)}`, {
        method: "DELETE",
      });
      const payload = (await response.json()) as { error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Failed to delete integration (${response.status})`);
      }
      await loadProviders();
      onProvidersChanged?.();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to delete integration.";
      setProviderSaveState("error");
      setProviderSaveMessage(message);
    }
  }

  return (
    <section className="min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6">
      <div className="mx-auto grid w-full max-w-5xl gap-6 md:grid-cols-[220px_minmax(0,1fr)]">
        <aside className="space-y-1">
          <button
            type="button"
            className={
              "w-full rounded-xl px-3 py-2 text-left text-sm font-medium " +
              (section === "general"
                ? isDark
                  ? "bg-[#2f2d29] text-[#f0ece4]"
                  : "bg-[#e5e2db] text-[#33312d]"
                : isDark
                  ? "text-[#b9b3a8] hover:bg-[#2b2925]"
                  : "text-[#5f594f] hover:bg-[#ece8e0]")
            }
            onClick={() => setSection("general")}
            aria-current={section === "general" ? "page" : undefined}
          >
            General
          </button>
          <button
            type="button"
            className={
              "w-full rounded-xl px-3 py-2 text-left text-sm font-medium " +
              (section === "integrations"
                ? isDark
                  ? "bg-[#2f2d29] text-[#f0ece4]"
                  : "bg-[#e5e2db] text-[#33312d]"
                : isDark
                  ? "text-[#b9b3a8] hover:bg-[#2b2925]"
                  : "text-[#5f594f] hover:bg-[#ece8e0]")
            }
            onClick={() => setSection("integrations")}
            aria-current={section === "integrations" ? "page" : undefined}
          >
            Integrations
          </button>
        </aside>

        <div
          className={
            "rounded-2xl border px-5 py-5 sm:px-6 " +
            (isDark ? "border-[#3a3934] bg-[#252522]" : "border-[#dcd9d2] bg-[#f7f5f0]")
          }
        >
          {section === "general" ? (
            <>
              <h3 className={"text-lg font-semibold " + (isDark ? "text-[#efebe3]" : "text-[#34322d]")}>
                Appearance
              </h3>
              <p className={"mt-1 text-sm " + (isDark ? "text-[#a9a193]" : "text-[#6e675c]")}>
                Select the color mode for your interface.
              </p>

              <div className="mt-4 grid gap-3 sm:grid-cols-3">
                {APPEARANCE_CHOICES.map((choice) => {
                  const selected = appearanceMode === choice.id;
                  return (
                    <button
                      key={choice.id}
                      type="button"
                      className={
                        "rounded-2xl border p-3 text-left " +
                        (selected
                          ? isDark
                            ? "border-[#6aa6ff] bg-[#2b323b] shadow-[0_0_0_1px_rgba(106,166,255,0.35)_inset]"
                            : "border-[#4f98ff] bg-[#eef5ff] shadow-[0_0_0_1px_rgba(79,152,255,0.3)_inset]"
                          : isDark
                            ? "border-[#4a4841] bg-[#2a2926] hover:bg-[#31302c]"
                            : "border-[#d6d3cc] bg-[#fbfaf6] hover:bg-[#f4f2eb]")
                      }
                      onClick={() => onAppearanceModeSelect(choice.id)}
                      aria-pressed={selected}
                    >
                      <div
                        className={
                          "mb-3 rounded-xl border p-2 " +
                          (choice.id === "dark"
                            ? "border-[#4a4841] bg-[#1f1f1d]"
                            : choice.id === "light"
                              ? "border-[#d9d6cf] bg-[#faf9f5]"
                              : isDark
                                ? "border-[#4a4841] bg-[#232321]"
                                : "border-[#d9d6cf] bg-[#f2f0ea]")
                        }
                      >
                        <div
                          className={
                            "h-1.5 w-12 rounded-full " +
                            (choice.id === "dark" ? "bg-[#6b6559]" : "bg-[#d2cec6]")
                          }
                        />
                        <div
                          className={
                            "mt-2 h-5 rounded-md border " +
                            (choice.id === "dark"
                              ? "border-[#4a4841] bg-[#2a2926]"
                              : "border-[#d5d2cb] bg-[#fbfaf6]")
                          }
                        />
                      </div>
                      <p className={"text-sm font-medium " + (isDark ? "text-[#ece7dd]" : "text-[#37342f]")}>
                        {choice.label}
                      </p>
                      <p className={"mt-1 text-xs leading-5 " + (isDark ? "text-[#a9a193]" : "text-[#716a5e]")}>
                        {choice.note}
                      </p>
                    </button>
                  );
                })}
              </div>

              <div
                className={
                  "mt-6 rounded-2xl border px-4 py-4 " +
                  (isDark ? "border-[#4a4841] bg-[#2a2926]" : "border-[#d6d3cc] bg-[#fbfaf6]")
                }
              >
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <h4 className={"text-sm font-semibold " + (isDark ? "text-[#ece7dd]" : "text-[#37342f]")}>
                    Streaming readability pace
                  </h4>
                  <span className={"text-xs tabular-nums " + (isDark ? "text-[#b8b1a5]" : "text-[#6e675c]")}>
                    {Math.round(streamReadabilityPace * 100)}%
                  </span>
                </div>
                <p className={"mt-1 text-xs " + (isDark ? "text-[#9f988b]" : "text-[#756f63]")}>
                  Lower values slow on-screen token reveal for easier reading.
                </p>
                <input
                  type="range"
                  min={45}
                  max={110}
                  step={1}
                  value={Math.round(streamReadabilityPace * 100)}
                  onChange={(event) => {
                    const next = Math.max(45, Math.min(110, Number(event.target.value) || 99));
                    onStreamReadabilityPaceChange(next / 100);
                  }}
                  className="mt-3 w-full accent-[#b9b2a5]"
                  aria-label="Streaming readability pace"
                />
                <div className={"mt-1 flex items-center justify-between text-[11px] " + (isDark ? "text-[#918a7f]" : "text-[#8b8478]")}>
                  <span>Slower</span>
                  <span>Balanced</span>
                  <span>Faster</span>
                </div>
              </div>
            </>
          ) : (
            <>
              <div className="flex flex-wrap items-center justify-between gap-2">
                <div>
                  <h3 className={"text-lg font-semibold " + (isDark ? "text-[#efebe3]" : "text-[#34322d]")}>
                    Third-party Integrations
                  </h3>
                  <p className={"mt-1 text-sm " + (isDark ? "text-[#a9a193]" : "text-[#6e675c]")}>
                    Add provider plugins without code changes.
                  </p>
                </div>
                <span
                  className={
                    "rounded-full border px-3 py-1 text-xs " +
                    (isDark ? "border-[#4a4841] text-[#bcb6aa]" : "border-[#d8d5ce] text-[#6d665a]")
                  }
                >
                  {providerCountLabel}
                </span>
              </div>

              <div
                className={
                  "mt-4 rounded-xl border px-4 py-3 text-xs leading-5 " +
                  (isDark ? "border-[#43413c] bg-[#292824] text-[#c7c0b5]" : "border-[#ddd9d1] bg-[#f6f3ed] text-[#5f594f]")
                }
              >
                Chat endpoint should accept JSON: `model`, `messages`, `settings`, `stream`.
                <br />
                Stream should return NDJSON or SSE chunk events based on selected stream format.
              </div>

              {providersError ? (
                <p className={"mt-3 text-sm " + (isDark ? "text-[#d89d8a]" : "text-[#9c4e32]")}>{providersError}</p>
              ) : null}

              <div className="mt-4 space-y-2">
                {providers.length ? (
                  providers.map((provider) => (
                    <article
                      key={provider.id}
                      className={
                        "flex flex-col gap-3 rounded-xl border px-4 py-3 sm:flex-row sm:items-start sm:justify-between " +
                        (isDark ? "border-[#43413c] bg-[#2a2926]" : "border-[#ddd9d1] bg-[#fbfaf6]")
                      }
                    >
                      <div className="min-w-0">
                        <p className={"truncate text-sm font-semibold " + (isDark ? "text-[#efe9de]" : "text-[#3a362f]")}>
                          {provider.name}
                        </p>
                        <p className={"mt-0.5 truncate text-xs " + (isDark ? "text-[#b5aea0]" : "text-[#6a6257]")}>
                          ID: {provider.id}
                        </p>
                        <p className={"mt-0.5 truncate text-xs " + (isDark ? "text-[#b5aea0]" : "text-[#6a6257]")}>
                          {provider.baseUrl}
                          {provider.chatPath}
                        </p>
                        <p className={"mt-0.5 truncate text-xs " + (isDark ? "text-[#b5aea0]" : "text-[#6a6257]")}>
                          Models: {provider.modelsSource} · Stream: {provider.streamFormat}
                        </p>
                        {provider.modelsSource === "static" && provider.staticModels?.length ? (
                          <p
                            className={
                              "mt-1 truncate text-xs " + (isDark ? "text-[#b5aea0]" : "text-[#6a6257]")
                            }
                          >
                            Static models: {provider.staticModels.map((model) => model.id).join(", ")}
                          </p>
                        ) : null}
                      </div>

                      <button
                        type="button"
                        className={
                          "self-start rounded-lg border px-3 py-1.5 text-xs transition " +
                          (isDark
                            ? "border-[#5c463d] text-[#d8aa94] hover:bg-[#3b2f2a]"
                            : "border-[#e3c7bb] text-[#9f5134] hover:bg-[#fff1eb]")
                        }
                        onClick={() => handleDeleteProvider(provider.id, provider.name)}
                      >
                        Delete
                      </button>
                    </article>
                  ))
                ) : (
                  <p className={"text-sm " + (isDark ? "text-[#a9a193]" : "text-[#6e675c]")}>
                    No integrations configured yet.
                  </p>
                )}
              </div>

              <form className="mt-6 grid gap-3 sm:grid-cols-2" onSubmit={handleSaveProvider}>
                <label className="space-y-1.5 sm:col-span-1">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Name
                  </span>
                  <input
                    type="text"
                    value={providerName}
                    onChange={(event) => setProviderName(event.target.value)}
                    placeholder="Outlier Bridge"
                    required
                    className={
                      "w-full rounded-xl border px-3 py-2 text-sm outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de] placeholder:text-[#918a7f]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832] placeholder:text-[#8b8478]")
                    }
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Base URL
                  </span>
                  <input
                    type="url"
                    value={providerBaseUrl}
                    onChange={(event) => setProviderBaseUrl(event.target.value)}
                    placeholder="https://your-proxy.example.com"
                    required
                    className={
                      "w-full rounded-xl border px-3 py-2 text-sm outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de] placeholder:text-[#918a7f]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832] placeholder:text-[#8b8478]")
                    }
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Models path
                  </span>
                  <input
                    type="text"
                    value={modelsPath}
                    onChange={(event) => setModelsPath(event.target.value)}
                    placeholder="/models"
                    className={
                      "w-full rounded-xl border px-3 py-2 text-sm outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de] placeholder:text-[#918a7f]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832] placeholder:text-[#8b8478]")
                    }
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Chat path
                  </span>
                  <input
                    type="text"
                    value={chatPath}
                    onChange={(event) => setChatPath(event.target.value)}
                    placeholder="/chat/stream"
                    className={
                      "w-full rounded-xl border px-3 py-2 text-sm outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de] placeholder:text-[#918a7f]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832] placeholder:text-[#8b8478]")
                    }
                  />
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Models source
                  </span>
                  <select
                    value={modelsSource}
                    onChange={(event) => setModelsSource(event.target.value as ProviderModelsSource)}
                    className={
                      "w-full rounded-xl border px-3 py-2 text-sm outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832]")
                    }
                  >
                    <option value="remote">Remote endpoint</option>
                    <option value="static">Static list</option>
                  </select>
                </label>

                <label className="space-y-1.5 sm:col-span-1">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Stream format
                  </span>
                  <select
                    value={streamFormat}
                    onChange={(event) => setStreamFormat(event.target.value as ProviderStreamFormat)}
                    className={
                      "w-full rounded-xl border px-3 py-2 text-sm outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832]")
                    }
                  >
                    {STREAM_FORMAT_OPTIONS.map((option) => (
                      <option key={option.id} value={option.id}>
                        {option.label}
                      </option>
                    ))}
                  </select>
                  <p className={"text-xs " + (isDark ? "text-[#9f988b]" : "text-[#756f63]")}>
                    {STREAM_FORMAT_OPTIONS.find((option) => option.id === streamFormat)?.note}
                  </p>
                </label>

                <label className="space-y-1.5 sm:col-span-2">
                  <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                    Headers JSON
                  </span>
                  <textarea
                    rows={5}
                    value={headersInput}
                    onChange={(event) => setHeadersInput(event.target.value)}
                    placeholder={stringifyHeaders()}
                    className={
                      "w-full rounded-xl border px-3 py-2 font-mono text-xs outline-none " +
                      (isDark
                        ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de] placeholder:text-[#918a7f]"
                        : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832] placeholder:text-[#8b8478]")
                    }
                  />
                </label>

                {modelsSource === "static" ? (
                  <label className="space-y-1.5 sm:col-span-2">
                    <span className={"text-xs font-medium " + (isDark ? "text-[#c4bdb2]" : "text-[#655f54]")}>
                      Static models
                    </span>
                    <textarea
                      rows={4}
                      value={staticModelsInput}
                      onChange={(event) => setStaticModelsInput(event.target.value)}
                      placeholder={"gpt-4.1\nclaude-opus-4-6 | Premium tier"}
                      className={
                        "w-full rounded-xl border px-3 py-2 font-mono text-xs outline-none " +
                        (isDark
                          ? "border-[#4a4841] bg-[#2d2b27] text-[#efe9de] placeholder:text-[#918a7f]"
                          : "border-[#d6d2c9] bg-[#fffdf9] text-[#3b3832] placeholder:text-[#8b8478]")
                      }
                    />
                    <p className={"text-xs " + (isDark ? "text-[#9f988b]" : "text-[#756f63]")}>
                      One model per line. Use `id | meta` for optional labels.
                    </p>
                  </label>
                ) : null}

                <div className="sm:col-span-2">
                  <button
                    type="submit"
                    disabled={providerSaveState === "saving"}
                    className={
                      "rounded-xl px-4 py-2 text-sm font-semibold transition " +
                      (isDark
                        ? "bg-[#d8d0c2] text-[#1f1d1a] hover:bg-[#e7dfd2] disabled:opacity-60"
                        : "bg-[#2f2d28] text-[#f7f3eb] hover:bg-[#1f1d1a] disabled:opacity-60")
                    }
                  >
                    {providerSaveState === "saving" ? "Saving..." : "Save integration"}
                  </button>
                  {providerSaveMessage ? (
                    <p
                      className={
                        "mt-2 text-sm " +
                        (providerSaveState === "error"
                          ? isDark
                            ? "text-[#d89d8a]"
                            : "text-[#9c4e32]"
                          : isDark
                            ? "text-[#a9c68e]"
                            : "text-[#567a35]")
                      }
                    >
                      {providerSaveMessage}
                    </p>
                  ) : null}
                </div>
              </form>
            </>
          )}
        </div>
      </div>
    </section>
  );
}
