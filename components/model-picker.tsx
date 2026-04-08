"use client";

import { useEffect, useState } from "react";

type Model = {
  id: string;
  meta?: string;
};

type ModelsResponse = {
  models: Model[];
};

export function ModelPicker() {
  const [models, setModels] = useState<Model[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [selectedId, setSelectedId] = useState("");

  useEffect(() => {
    let isActive = true;

    async function load() {
      try {
        const response = await fetch("/api/models");
        if (!response.ok) {
          throw new Error(`Request failed: ${response.status}`);
        }
        const data = (await response.json()) as ModelsResponse;
        if (!isActive) return;
        const nextModels = Array.isArray(data.models) ? data.models : [];
        setModels(nextModels);
        setSelectedId((current) => current || nextModels[0]?.id || "");
        setStatus("ready");
      } catch (error) {
        if (!isActive) return;
        setStatus("error");
      }
    }

    load();
    return () => {
      isActive = false;
    };
  }, []);

  const selectedModel = models.find((model) => model.id === selectedId) ?? models[0];
  const hasModels = models.length > 0;
  const helperText =
    status === "ready"
      ? hasModels
        ? `${models.length} available`
        : "No models found"
      : status === "loading"
        ? "Connecting to Ollama"
        : "Ollama not reachable";

  return (
    <div className="insight-block">
      <div className="insight-label">Current model</div>
      <div className="insight-value">
        <select
          className="select"
          value={selectedId}
          onChange={(event) => setSelectedId(event.target.value)}
          disabled={status !== "ready" || !hasModels}
          aria-label="Select model"
        >
          {status === "loading" && <option>Loading models...</option>}
          {status === "error" && <option>Ollama unavailable</option>}
          {status === "ready" && !hasModels && <option>No models found</option>}
          {status === "ready" &&
            hasModels &&
            models.map((model) => (
              <option key={model.id} value={model.id}>
                {model.id}
              </option>
            ))}
        </select>
      </div>
      <div className="insight-meta">
        <span>{helperText}</span>
        {selectedModel?.meta ? <span className="dot">{selectedModel.meta}</span> : null}
      </div>
    </div>
  );
}
