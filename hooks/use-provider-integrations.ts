"use client";

import { useCallback, useEffect, useMemo, useState, type FormEvent } from "react";

export type ProviderStreamFormat = "ndjson" | "sse-standard" | "openai";
export type ProviderModelsSource = "remote" | "static";

export type ProviderSummary = {
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

export const STREAM_FORMAT_OPTIONS: Array<{
  id: ProviderStreamFormat;
  label: string;
  note: string;
}> = [
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

type ProviderSaveState = "idle" | "saving" | "saved" | "error";

type UseProviderIntegrationsOptions = {
  onProvidersChanged?: () => void;
};

export function parseStaticModelsInput(input: string) {
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

export function stringifyHeaders(headers?: Record<string, string>) {
  if (!headers || typeof headers !== "object") return "{}";
  const entries = Object.entries(headers).filter(([key, value]) => key && typeof value === "string");
  if (!entries.length) return "{}";
  return JSON.stringify(Object.fromEntries(entries), null, 2);
}

export function useProviderIntegrations({
  onProvidersChanged,
}: UseProviderIntegrationsOptions) {
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
  const [providerSaveState, setProviderSaveState] = useState<ProviderSaveState>("idle");
  const [providerSaveMessage, setProviderSaveMessage] = useState("");

  const providerCountLabel = useMemo(() => {
    if (providersLoading) return "Loading...";
    if (!providers.length) return "No custom integrations yet";
    return `${providers.length} integration${providers.length > 1 ? "s" : ""}`;
  }, [providers.length, providersLoading]);

  const loadProviders = useCallback(async () => {
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
  }, []);

  useEffect(() => {
    void loadProviders();
  }, [loadProviders]);

  const handleSaveProvider = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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
    },
    [
      chatPath,
      headersInput,
      loadProviders,
      modelsPath,
      modelsSource,
      onProvidersChanged,
      providerBaseUrl,
      providerName,
      staticModelsInput,
      streamFormat,
    ]
  );

  const handleDeleteProvider = useCallback(
    async (providerId: string, providerNameValue: string) => {
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
    },
    [loadProviders, onProvidersChanged]
  );

  return {
    providers,
    providersError,
    providerName,
    setProviderName,
    providerBaseUrl,
    setProviderBaseUrl,
    modelsPath,
    setModelsPath,
    chatPath,
    setChatPath,
    modelsSource,
    setModelsSource,
    streamFormat,
    setStreamFormat,
    headersInput,
    setHeadersInput,
    staticModelsInput,
    setStaticModelsInput,
    providerSaveState,
    providerSaveMessage,
    providerCountLabel,
    handleSaveProvider,
    handleDeleteProvider,
  };
}
