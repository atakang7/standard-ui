"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  DEFAULT_BACKEND_CAPABILITIES,
  DEFAULT_MODEL_CAPABILITIES,
  LEGACY_OLLAMA_SELECTED_MODEL_KEY,
  SELECTED_BACKEND_KEY,
  SELECTED_MODELS_KEY,
} from "../lib/constants";
import { modelStorageMapFromRaw } from "../lib/storage";
import type { BackendOption, BackendsResponse, ChatThread, ModelOption, ModelsResponse } from "../lib/types";
import { modelCapabilitiesFromUnknown, normalizeModelOptions } from "../lib/utils";

type UseProviderSelectionOptions = {
  activeThread: ChatThread | null;
  isStreaming: boolean;
  onClearModelsError: () => void;
  onModelsError: (error: unknown, providerLabel?: string) => void;
};

export function useProviderSelection({
  activeThread,
  isStreaming,
  onClearModelsError,
  onModelsError,
}: UseProviderSelectionOptions) {
  const [backends, setBackends] = useState<BackendOption[]>([]);
  const [selectedBackend, setSelectedBackend] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [backendsReady, setBackendsReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [backendsReloadNonce, setBackendsReloadNonce] = useState(0);

  const lastModelsRefreshAtRef = useRef(0);
  const backendsRef = useRef<BackendOption[]>([]);
  const selectedBackendRef = useRef("");
  const selectedModelRef = useRef("");
  const onClearModelsErrorRef = useRef(onClearModelsError);
  const onModelsErrorRef = useRef(onModelsError);
  const activeThreadRef = useRef(activeThread);

  const activeBackend = useMemo(
    () => backends.find((backend) => backend.id === selectedBackend) ?? null,
    [backends, selectedBackend]
  );

  const activeModelOption = useMemo(
    () => models.find((model) => model.id === selectedModel) ?? null,
    [models, selectedModel]
  );

  const activeCapabilities = useMemo(
    () => activeBackend?.capabilities ?? DEFAULT_BACKEND_CAPABILITIES,
    [activeBackend]
  );

  const activeModelCapabilities = useMemo(
    () => activeModelOption?.capabilities ?? DEFAULT_MODEL_CAPABILITIES,
    [activeModelOption]
  );

  useEffect(() => {
    backendsRef.current = backends;
  }, [backends]);

  useEffect(() => {
    selectedBackendRef.current = selectedBackend;
  }, [selectedBackend]);

  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  useEffect(() => {
    onClearModelsErrorRef.current = onClearModelsError;
  }, [onClearModelsError]);

  useEffect(() => {
    onModelsErrorRef.current = onModelsError;
  }, [onModelsError]);

  useEffect(() => {
    activeThreadRef.current = activeThread;
  }, [activeThread]);

  const clearModelsError = useCallback(() => {
    onClearModelsErrorRef.current();
  }, []);

  const reportModelsError = useCallback((error: unknown, providerLabel?: string) => {
    onModelsErrorRef.current(error, providerLabel);
  }, []);

  const getBackendLabel = useCallback((backendId: string) => {
    return backendsRef.current.find((backend) => backend.id === backendId)?.label || backendId;
  }, []);

  const reloadBackends = useCallback(() => {
    setBackendsReloadNonce((current) => current + 1);
  }, []);

  const selectBackend = useCallback((backendId: string) => {
    setSelectedBackend(backendId);
  }, []);

  const selectModel = useCallback((modelId: string) => {
    setSelectedModel(modelId);
  }, []);

  const selectThreadProvider = useCallback((thread: ChatThread) => {
    if (thread.backend && backendsRef.current.some((backend) => backend.id === thread.backend)) {
      setSelectedBackend(thread.backend);
    }

    if (thread.model) {
      setSelectedModel(thread.model);
    }
  }, []);

  useEffect(() => {
    if (!selectedBackend) return;
    localStorage.setItem(SELECTED_BACKEND_KEY, selectedBackend);
  }, [selectedBackend]);

  useEffect(() => {
    if (!selectedBackend || !selectedModel) return;

    const currentMap = modelStorageMapFromRaw(localStorage.getItem(SELECTED_MODELS_KEY));
    currentMap[selectedBackend] = selectedModel;
    localStorage.setItem(SELECTED_MODELS_KEY, JSON.stringify(currentMap));
  }, [selectedBackend, selectedModel]);

  useEffect(() => {
    async function loadBackends() {
      clearModelsError();
      setBackendsReady(false);

      try {
        const response = await fetch("/api/backends", { cache: "no-store" });
        if (!response.ok) {
          throw new Error(`Failed to load backends (${response.status})`);
        }

        const payload = (await response.json()) as BackendsResponse;
        const nextBackends = Array.isArray(payload.backends) ? payload.backends : [];
        setBackends(nextBackends);

        if (!nextBackends.length) {
          reportModelsError("No LLM backends are configured.");
          return;
        }

        const savedBackend = localStorage.getItem(SELECTED_BACKEND_KEY) ?? "";
        const fallbackBackend = payload.defaultBackend || nextBackends[0].id;

        const selected = [savedBackend, fallbackBackend].find((candidate) =>
          nextBackends.some((backend) => backend.id === candidate)
        );

        setSelectedBackend(selected || fallbackBackend);
      } catch (error) {
        const backendId = selectedBackendRef.current;
        const message = error instanceof Error ? error.message : "Failed to load backends.";
        reportModelsError(message, getBackendLabel(backendId));
      } finally {
        setBackendsReady(true);
      }
    }

    loadBackends();
  }, [backendsReloadNonce, clearModelsError, getBackendLabel, reportModelsError]);

  useEffect(() => {
    if (!selectedBackend) {
      setModels([]);
      setModelsReady(true);
      return;
    }

    setModelsReady(false);
    let cancelled = false;

    async function loadModels() {
      clearModelsError();

      try {
        const response = await fetch(`/api/models?backend=${encodeURIComponent(selectedBackend)}`, {
          cache: "no-store",
        });

        const payload = (await response.json()) as ModelsResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load models (${response.status})`);
        }

        if (cancelled) return;

        const nextModels = normalizeModelOptions(payload.models);
        setModels(nextModels);

        if (!nextModels.length) {
          reportModelsError(`No models found for ${getBackendLabel(selectedBackend)}.`, getBackendLabel(selectedBackend));
          setSelectedModel("");
          setModelsReady(true);
          return;
        }

        const savedMap = modelStorageMapFromRaw(localStorage.getItem(SELECTED_MODELS_KEY));
        const legacyOllamaModel = localStorage.getItem(LEGACY_OLLAMA_SELECTED_MODEL_KEY) || "";
        const currentActiveThread = activeThreadRef.current;
        const modelFromActiveThread =
          currentActiveThread?.backend === selectedBackend && currentActiveThread.model
            ? currentActiveThread.model
            : "";

        const preferredModel = [
          modelFromActiveThread,
          selectedModelRef.current,
          savedMap[selectedBackend] || "",
          selectedBackend === "ollama" ? legacyOllamaModel : "",
        ].find((candidate) => nextModels.some((model) => model.id === candidate));

        setSelectedModel(preferredModel || nextModels[0].id);
        setModelsReady(true);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load models.";
        reportModelsError(message, getBackendLabel(selectedBackend));
        setModelsReady(true);
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [selectedBackend, clearModelsError, getBackendLabel, reportModelsError]);

  useEffect(() => {
    if (!selectedBackend || !selectedModel) return;
    let cancelled = false;

    async function loadSelectedModelCapabilities() {
      try {
        const response = await fetch(
          `/api/models?backend=${encodeURIComponent(selectedBackend)}&model=${encodeURIComponent(selectedModel)}`,
          { cache: "no-store" }
        );
        const payload = (await response.json()) as ModelsResponse;
        if (!response.ok) {
          throw new Error(payload.error || `Failed to load model capabilities (${response.status})`);
        }

        if (cancelled) return;
        const capabilities = modelCapabilitiesFromUnknown(payload.capabilities);
        if (!capabilities) return;

        setModels((current) =>
          current.map((model) =>
            model.id === selectedModel
              ? {
                  ...model,
                  capabilities,
                }
              : model
          )
        );
      } catch {
        // Keep existing capabilities when provider capability lookup is unavailable.
      }
    }

    void loadSelectedModelCapabilities();

    return () => {
      cancelled = true;
    };
  }, [selectedBackend, selectedModel]);

  const refreshModels = useCallback(async () => {
    if (!selectedBackend || isStreaming) return;

    const now = Date.now();
    if (now - lastModelsRefreshAtRef.current < 700) return;
    lastModelsRefreshAtRef.current = now;

    clearModelsError();

    try {
      const response = await fetch(`/api/models?backend=${encodeURIComponent(selectedBackend)}`, {
        cache: "no-store",
      });

      const payload = (await response.json()) as ModelsResponse;
      if (!response.ok) {
        throw new Error(payload.error || `Failed to load models (${response.status})`);
      }

      const nextModels = normalizeModelOptions(payload.models);
      setModels(nextModels);

      if (!nextModels.length) {
        reportModelsError(`No models found for ${getBackendLabel(selectedBackend)}.`, getBackendLabel(selectedBackend));
        setSelectedModel("");
        return;
      }

      setSelectedModel((current) => {
        if (current && nextModels.some((model) => model.id === current)) {
          return current;
        }
        return nextModels[0].id;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Failed to load models.";
      reportModelsError(message, getBackendLabel(selectedBackend));
    }
  }, [clearModelsError, getBackendLabel, isStreaming, reportModelsError, selectedBackend]);

  return {
    backends,
    backendsRef,
    selectedBackend,
    selectedBackendRef,
    selectBackend,
    models,
    selectedModel,
    selectedModelRef,
    selectModel,
    backendsReady,
    modelsReady,
    activeBackend,
    activeCapabilities,
    activeModelCapabilities,
    reloadBackends,
    refreshModels,
    selectThreadProvider,
  };
}
