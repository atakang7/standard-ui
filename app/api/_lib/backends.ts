import {
  readStoredAttachment,
  readStoredAttachmentProviderFile,
  upsertStoredAttachmentProviderFile,
} from "./uploads";
import {
  getProviderPluginById,
  listProviderPlugins,
  resolveProviderUrl,
  type ProviderPlugin,
} from "./provider-plugins";

type UserAssistantRole = "user" | "assistant";
type BackendMessageRole = "system" | UserAssistantRole;
type BuiltInBackendId = "ollama" | "openai" | "anthropic";
type CustomBackendMessageRole = UserAssistantRole | "system";

export type BackendId = BuiltInBackendId;
export type AttachmentKind = "image" | "document" | "audio" | "video" | "text" | "binary";

export type ModelCapabilities = {
  textInput: boolean;
  imageInput: boolean;
  documentInput: boolean;
  audioInput: boolean;
  videoInput: boolean;
  binaryInput: boolean;
  maxAttachments: number;
  maxAttachmentBytes: number;
};

export type InputAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  textPreview?: string;
};

export type InputMessage = {
  role: UserAssistantRole;
  content: string;
  attachments?: InputAttachment[];
};

export type ChatSettings = {
  systemPrompt?: string;
  temperature?: number;
  topP?: number;
  topK?: number;
  maxTokens?: number;
  stopSequences?: string;
  seed?: string;
  jsonMode?: boolean;
  contextWindow?: number;
  repeatPenalty?: number;
  keepAlive?: string;
};

export type BackendCapabilities = {
  systemPrompt: boolean;
  temperature: boolean;
  topP: boolean;
  topK: boolean;
  maxTokens: boolean;
  stopSequences: boolean;
  seed: boolean;
  jsonMode: boolean;
  contextWindow: boolean;
  repeatPenalty: boolean;
  keepAlive: boolean;
};

export type BackendOption = {
  id: string;
  label: string;
  meta: string;
  capabilities: BackendCapabilities;
};

export type ModelOption = {
  id: string;
  meta?: string;
  capabilities?: ModelCapabilities;
};

type OllamaModel = {
  name: string;
  size?: number;
  details?: Record<string, unknown> & {
    parameter_size?: string;
    quantization_level?: string;
    family?: string;
  };
  [key: string]: unknown;
};

type OpenAIModel = {
  id: string;
  owned_by?: string;
  [key: string]: unknown;
};

type AnthropicModel = {
  id: string;
  display_name?: string;
  [key: string]: unknown;
};

type StreamEvent = {
  message?: {
    role?: UserAssistantRole;
    content?: string;
  };
  thinking?: {
    content?: string;
  };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  done?: boolean;
  error?: string;
};

type ResolvedAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  textPreview?: string;
  base64Data: string;
};

const OLLAMA_CAPABILITIES: BackendCapabilities = {
  systemPrompt: true,
  temperature: true,
  topP: true,
  topK: true,
  maxTokens: true,
  stopSequences: true,
  seed: true,
  jsonMode: true,
  contextWindow: true,
  repeatPenalty: true,
  keepAlive: true,
};

const OPENAI_CAPABILITIES: BackendCapabilities = {
  systemPrompt: true,
  temperature: true,
  topP: true,
  topK: false,
  maxTokens: true,
  stopSequences: true,
  seed: true,
  jsonMode: true,
  contextWindow: false,
  repeatPenalty: false,
  keepAlive: false,
};

const ANTHROPIC_CAPABILITIES: BackendCapabilities = {
  systemPrompt: true,
  temperature: true,
  topP: true,
  topK: true,
  maxTokens: true,
  stopSequences: true,
  seed: false,
  jsonMode: false,
  contextWindow: false,
  repeatPenalty: false,
  keepAlive: false,
};

const DEFAULT_SETTINGS: Required<ChatSettings> = {
  systemPrompt: "",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 1024,
  stopSequences: "",
  seed: "",
  jsonMode: false,
  contextWindow: 4096,
  repeatPenalty: 1.1,
  keepAlive: "5m",
};

const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  textInput: true,
  imageInput: false,
  documentInput: false,
  audioInput: false,
  videoInput: false,
  binaryInput: false,
  maxAttachments: 8,
  maxAttachmentBytes: 20 * 1024 * 1024,
};

const MAX_TOTAL_ATTACHMENT_BYTES_PER_REQUEST = 32 * 1024 * 1024;
const MODEL_CAPABILITIES_CACHE_TTL_MS = 30 * 60 * 1000;
const MODEL_CAPABILITY_PROBE_ENABLED = process.env.MODEL_CAPABILITY_PROBE !== "false";
const MODEL_CAPABILITY_PROBE_TIMEOUT_MS = 7000;
const PROBE_IMAGE_PNG_BASE64 =
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/nG0AAAAASUVORK5CYII=";
const PROBE_TEXT_FILE_BASE64 = "aGVsbG8=";
const OPENAI_FILE_PURPOSE_DEFAULT = process.env.OPENAI_FILE_PURPOSE || "user_data";
const OPENAI_FILE_PURPOSE_VISION = process.env.OPENAI_FILE_PURPOSE_VISION || "vision";
const ANTHROPIC_FILES_BETA_HEADER = process.env.ANTHROPIC_FILES_BETA || "files-api-2025-04-14";

const MODEL_CAPABILITIES_CACHE = new Map<
  string,
  {
    fetchedAt: number;
    byModelId: Map<string, ModelCapabilities>;
  }
>();

class BackendError extends Error {
  status: number;
  details: string;

  constructor(message: string, status = 502, details = "") {
    super(message);
    this.status = status;
    this.details = details;
  }
}

function parseError(error: unknown) {
  if (error instanceof BackendError) {
    return {
      status: error.status,
      error: error.message,
      details: error.details,
    };
  }

  return {
    status: 502,
    error: "Backend request failed.",
    details: String(error),
  };
}

function toLocalIpv4FallbackUrl(rawUrl: string) {
  try {
    const parsed = new URL(rawUrl);
    if (parsed.hostname !== "localhost") return null;
    parsed.hostname = "127.0.0.1";
    return parsed.toString();
  } catch {
    return null;
  }
}

async function fetchWithLocalhostFallback(url: string, init: RequestInit) {
  try {
    return await fetch(url, init);
  } catch (primaryError) {
    const fallbackUrl = toLocalIpv4FallbackUrl(url);
    if (!fallbackUrl) {
      throw primaryError;
    }
    try {
      return await fetch(fallbackUrl, init);
    } catch {
      throw primaryError;
    }
  }
}

function normalizeErrorMessage(error: unknown) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  return String(error);
}

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return "";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let unitIndex = 0;
  while (value >= 1024 && unitIndex < units.length - 1) {
    value /= 1024;
    unitIndex += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded} ${units[unitIndex]}`;
}

function clampNumber(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

function parseOptionalInteger(value: string) {
  if (!value.trim()) return undefined;
  const parsed = Number.parseInt(value.trim(), 10);
  if (!Number.isFinite(parsed)) return undefined;
  return parsed;
}

function parseFlexibleNumber(value: unknown) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const parsed = Number(value.trim());
    if (Number.isFinite(parsed)) return parsed;
  }
  return undefined;
}

function parseStopSequences(stopSequences: string) {
  return stopSequences
    .split("\n")
    .map((entry) => entry.trim())
    .filter(Boolean)
    .slice(0, 16);
}

function readPositiveInteger(candidate: unknown) {
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) return undefined;
  const rounded = Math.round(candidate);
  if (rounded <= 0) return undefined;
  return rounded;
}

function asRecord(candidate: unknown) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  return candidate as Record<string, unknown>;
}

function normalizeCapabilityToken(value: string) {
  return value.trim().toLowerCase().replace(/[^a-z0-9_.-]/g, "");
}

function addCapabilityTokens(candidate: unknown, output: Set<string>, depth = 0) {
  if (depth > 4 || candidate == null) return;

  if (typeof candidate === "string") {
    const token = normalizeCapabilityToken(candidate);
    if (token) output.add(token);
    return;
  }

  if (Array.isArray(candidate)) {
    candidate.forEach((entry) => addCapabilityTokens(entry, output, depth + 1));
    return;
  }

  const record = asRecord(candidate);
  if (!record) return;

  for (const [key, value] of Object.entries(record)) {
    if (typeof value === "boolean") {
      if (value) {
        const token = normalizeCapabilityToken(key);
        if (token) {
          output.add(token);
        }
      }
      continue;
    }
    addCapabilityTokens(value, output, depth + 1);
  }
}

function addKnownBooleanCapabilityFlags(candidate: unknown, output: Set<string>) {
  const record = asRecord(candidate);
  if (!record) return;

  for (const [key, value] of Object.entries(record)) {
    if (value !== true) continue;
    const normalizedKey = normalizeCapabilityToken(key);
    if (!normalizedKey) continue;

    if (
      normalizedKey.includes("text") ||
      normalizedKey.includes("completion") ||
      normalizedKey.includes("chat") ||
      normalizedKey.includes("image") ||
      normalizedKey.includes("vision") ||
      normalizedKey.includes("multimodal") ||
      normalizedKey.includes("document") ||
      normalizedKey.includes("pdf") ||
      normalizedKey.includes("audio") ||
      normalizedKey.includes("speech") ||
      normalizedKey.includes("voice") ||
      normalizedKey.includes("video") ||
      normalizedKey.includes("binary") ||
      normalizedKey.includes("file") ||
      normalizedKey.includes("attachment")
    ) {
      output.add(normalizedKey);
    }
  }
}

function addTokensFromKnownFields(
  record: Record<string, unknown> | null,
  output: Set<string>,
  fields: string[]
) {
  if (!record) return;
  for (const field of fields) {
    addCapabilityTokens(record[field], output);
  }
}

function hasAnyCapabilityToken(tokens: Set<string>, probes: string[]) {
  return Array.from(tokens).some((token) => probes.some((probe) => token.includes(probe)));
}

function collectOllamaCapabilityTokens(rawModel: Record<string, unknown>, output: Set<string>) {
  addKnownBooleanCapabilityFlags(rawModel, output);
  addTokensFromKnownFields(rawModel, output, ["capabilities", "modalities", "input_modalities", "output_modalities"]);
  addTokensFromKnownFields(asRecord(rawModel.details), output, [
    "capabilities",
    "modalities",
    "input_modalities",
    "output_modalities",
  ]);
  addTokensFromKnownFields(asRecord(rawModel.model_info), output, [
    "capabilities",
    "modalities",
    "input_modalities",
    "output_modalities",
  ]);
}

function collectOpenAICapabilityTokens(rawModel: Record<string, unknown>, output: Set<string>) {
  addKnownBooleanCapabilityFlags(rawModel, output);
  addTokensFromKnownFields(rawModel, output, [
    "capabilities",
    "features",
    "modalities",
    "input_modalities",
    "output_modalities",
    "supported_input_modalities",
    "supported_output_modalities",
  ]);

  const nestedCandidates = [
    asRecord(rawModel.capabilities),
    asRecord(rawModel.features),
    asRecord(rawModel.details),
    asRecord(rawModel.architecture),
  ];

  for (const candidate of nestedCandidates) {
    addTokensFromKnownFields(candidate, output, [
      "capabilities",
      "features",
      "modalities",
      "input",
      "output",
      "input_modalities",
      "output_modalities",
      "supported_input_modalities",
      "supported_output_modalities",
    ]);
    addKnownBooleanCapabilityFlags(candidate, output);
  }
}

function collectAnthropicCapabilityTokens(rawModel: Record<string, unknown>, output: Set<string>) {
  addKnownBooleanCapabilityFlags(rawModel, output);
  addTokensFromKnownFields(rawModel, output, [
    "capabilities",
    "modalities",
    "input_modalities",
    "output_modalities",
    "supported_input_modalities",
    "supported_output_modalities",
  ]);

  const nestedCandidates = [
    asRecord(rawModel.capabilities),
    asRecord(rawModel.features),
    asRecord(rawModel.details),
    asRecord(rawModel.beta_capabilities),
  ];

  for (const candidate of nestedCandidates) {
    addTokensFromKnownFields(candidate, output, [
      "capabilities",
      "modalities",
      "input",
      "output",
      "input_modalities",
      "output_modalities",
      "supported_input_modalities",
      "supported_output_modalities",
    ]);
    addKnownBooleanCapabilityFlags(candidate, output);
  }
}

function resolveDynamicModelCapabilities(backendId: BackendId, rawModel: Record<string, unknown>): ModelCapabilities {
  const next: ModelCapabilities = { ...DEFAULT_MODEL_CAPABILITIES };
  const capabilityTokens = new Set<string>();

  if (backendId === "ollama") {
    collectOllamaCapabilityTokens(rawModel, capabilityTokens);
  } else if (backendId === "openai") {
    collectOpenAICapabilityTokens(rawModel, capabilityTokens);
  } else {
    collectAnthropicCapabilityTokens(rawModel, capabilityTokens);
  }

  if (capabilityTokens.size > 0) {
    const hasTextSupport = hasAnyCapabilityToken(capabilityTokens, [
      "text",
      "completion",
      "chat",
      "messages",
      "prompt",
      "tool",
    ]);
    const hasEmbeddingOnly =
      hasAnyCapabilityToken(capabilityTokens, ["embedding"]) &&
      !hasAnyCapabilityToken(capabilityTokens, ["text", "completion", "chat"]);

    next.textInput = hasTextSupport || !hasEmbeddingOnly;
    next.imageInput = hasAnyCapabilityToken(capabilityTokens, ["image", "vision", "multimodal"]);
    next.documentInput = hasAnyCapabilityToken(capabilityTokens, [
      "document",
      "pdf",
      "file",
      "attachment",
    ]);
    next.audioInput = hasAnyCapabilityToken(capabilityTokens, ["audio", "speech", "voice"]);
    next.videoInput = hasAnyCapabilityToken(capabilityTokens, ["video"]);
    next.binaryInput = hasAnyCapabilityToken(capabilityTokens, ["binary", "file", "attachment"]);
  }

  const rawCapabilities = asRecord(rawModel.capabilities);
  const rawLimits = asRecord(rawModel.limits);

  const maxAttachments =
    readPositiveInteger(rawModel.maxAttachments) ||
    readPositiveInteger(rawModel.max_attachments) ||
    readPositiveInteger(rawCapabilities?.maxAttachments) ||
    readPositiveInteger(rawCapabilities?.max_attachments) ||
    readPositiveInteger(rawLimits?.maxAttachments) ||
    readPositiveInteger(rawLimits?.max_attachments) ||
    next.maxAttachments;

  const maxAttachmentBytes =
    readPositiveInteger(rawModel.maxAttachmentBytes) ||
    readPositiveInteger(rawModel.max_attachment_bytes) ||
    readPositiveInteger(rawCapabilities?.maxAttachmentBytes) ||
    readPositiveInteger(rawCapabilities?.max_attachment_bytes) ||
    readPositiveInteger(rawLimits?.maxAttachmentBytes) ||
    readPositiveInteger(rawLimits?.max_attachment_bytes) ||
    next.maxAttachmentBytes;

  next.maxAttachments = Math.max(1, maxAttachments);
  next.maxAttachmentBytes = Math.max(1, maxAttachmentBytes);
  return next;
}

function cacheModelCapabilities(backendId: string, models: ModelOption[]) {
  const byModelId = new Map<string, ModelCapabilities>();
  for (const model of models) {
    if (model.capabilities) {
      byModelId.set(model.id, model.capabilities);
    }
  }
  MODEL_CAPABILITIES_CACHE.set(backendId, {
    fetchedAt: Date.now(),
    byModelId,
  });
}

function readCachedModelCapabilities(backendId: string, modelId: string) {
  const entry = MODEL_CAPABILITIES_CACHE.get(backendId);
  if (!entry) return undefined;
  if (Date.now() - entry.fetchedAt > MODEL_CAPABILITIES_CACHE_TTL_MS) {
    MODEL_CAPABILITIES_CACHE.delete(backendId);
    return undefined;
  }
  return entry.byModelId.get(modelId);
}

function upsertCachedModelCapabilities(
  backendId: string,
  modelId: string,
  capabilities: ModelCapabilities
) {
  const now = Date.now();
  const current = MODEL_CAPABILITIES_CACHE.get(backendId);
  if (!current || now - current.fetchedAt > MODEL_CAPABILITIES_CACHE_TTL_MS) {
    const byModelId = new Map<string, ModelCapabilities>();
    byModelId.set(modelId, capabilities);
    MODEL_CAPABILITIES_CACHE.set(backendId, { fetchedAt: now, byModelId });
    return;
  }

  current.byModelId.set(modelId, capabilities);
  current.fetchedAt = now;
}

async function fetchSingleModelCapabilities(backendId: BackendId, modelId: string, signal?: AbortSignal) {
  if (backendId === "ollama") {
    const baseUrl = resolveOllamaBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/show`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: modelId,
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new BackendError("Failed to load model capabilities from Ollama.", 502, raw.slice(0, 400));
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return resolveDynamicModelCapabilities("ollama", payload);
  }

  if (backendId === "openai") {
    const baseUrl = resolveOpenAIBaseUrl().replace(/\/$/, "");
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };
    if (process.env.OPENAI_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
    }

    const response = await fetch(`${baseUrl}/models/${encodeURIComponent(modelId)}`, {
      cache: "no-store",
      signal,
      headers,
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new BackendError(
        "Failed to load model capabilities from OpenAI-compatible endpoint.",
        502,
        raw.slice(0, 400)
      );
    }

    const payload = (await response.json()) as Record<string, unknown>;
    return resolveDynamicModelCapabilities("openai", payload);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BackendError("Anthropic API key is missing.", 400);
  }

  const baseUrl = resolveAnthropicBaseUrl().replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/models/${encodeURIComponent(modelId)}`, {
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new BackendError("Failed to load model capabilities from Anthropic.", 502, raw.slice(0, 400));
  }

  const payload = (await response.json()) as Record<string, unknown>;
  return resolveDynamicModelCapabilities("anthropic", payload);
}

function createProbeSignal(parentSignal?: AbortSignal) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => {
    controller.abort();
  }, MODEL_CAPABILITY_PROBE_TIMEOUT_MS);

  const onParentAbort = () => {
    controller.abort();
  };

  if (parentSignal) {
    if (parentSignal.aborted) {
      controller.abort();
    } else {
      parentSignal.addEventListener("abort", onParentAbort, { once: true });
    }
  }

  return {
    signal: controller.signal,
    cleanup: () => {
      clearTimeout(timeoutId);
      if (parentSignal) {
        parentSignal.removeEventListener("abort", onParentAbort);
      }
    },
  };
}

function inferUnsupportedModalityFromError(rawError: string, probes: string[]) {
  const lowered = rawError.toLowerCase();
  const mentionsProbe = probes.some((probe) => lowered.includes(probe));
  if (!mentionsProbe) return undefined;

  if (
    lowered.includes("does not support") ||
    lowered.includes("unsupported") ||
    lowered.includes("not supported") ||
    lowered.includes("only supports text") ||
    lowered.includes("not multimodal") ||
    lowered.includes("invalid content type") ||
    lowered.includes("invalid value") ||
    lowered.includes("expected one of")
  ) {
    return false;
  }

  return undefined;
}

async function probeOpenAIImageInput(modelId: string, signal?: AbortSignal) {
  const baseUrl = resolveOpenAIBaseUrl().replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  const probe = createProbeSignal(signal);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      cache: "no-store",
      signal: probe.signal,
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              { type: "text", text: "Reply with OK." },
              {
                type: "image_url",
                image_url: {
                  url: `data:image/png;base64,${PROBE_IMAGE_PNG_BASE64}`,
                },
              },
            ],
          },
        ],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (response.ok) return true;
    if (response.status === 401 || response.status === 403 || response.status === 429) return undefined;

    const raw = await response.text();
    return inferUnsupportedModalityFromError(raw, ["image", "vision", "multimodal", "image_url"]);
  } catch {
    return undefined;
  } finally {
    probe.cleanup();
  }
}

async function probeOpenAIFileInput(modelId: string, signal?: AbortSignal) {
  const baseUrl = resolveOpenAIBaseUrl().replace(/\/$/, "");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  const probe = createProbeSignal(signal);
  try {
    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      cache: "no-store",
      signal: probe.signal,
      headers,
      body: JSON.stringify({
        model: modelId,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Reply with OK.",
              },
              {
                type: "file",
                file: {
                  file_data: PROBE_TEXT_FILE_BASE64,
                  filename: "probe.txt",
                },
              },
            ],
          },
        ],
        max_tokens: 1,
        stream: false,
      }),
    });

    if (response.ok) return true;
    if (response.status === 401 || response.status === 403 || response.status === 429) return undefined;

    const raw = await response.text();
    return inferUnsupportedModalityFromError(raw, ["file", "input_file"]);
  } catch {
    return undefined;
  } finally {
    probe.cleanup();
  }
}

async function probeAnthropicImageInput(modelId: string, signal?: AbortSignal) {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) return undefined;

  const baseUrl = resolveAnthropicBaseUrl().replace(/\/$/, "");
  const probe = createProbeSignal(signal);

  try {
    const response = await fetch(`${baseUrl}/messages`, {
      method: "POST",
      cache: "no-store",
      signal: probe.signal,
      headers: {
        "Content-Type": "application/json",
        "x-api-key": apiKey,
        "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      },
      body: JSON.stringify({
        model: modelId,
        max_tokens: 1,
        messages: [
          {
            role: "user",
            content: [
              {
                type: "text",
                text: "Reply with OK.",
              },
              {
                type: "image",
                source: {
                  type: "base64",
                  media_type: "image/png",
                  data: PROBE_IMAGE_PNG_BASE64,
                },
              },
            ],
          },
        ],
      }),
    });

    if (response.ok) return true;
    if (response.status === 401 || response.status === 403 || response.status === 429) return undefined;

    const raw = await response.text();
    return inferUnsupportedModalityFromError(raw, ["image", "vision", "multimodal"]);
  } catch {
    return undefined;
  } finally {
    probe.cleanup();
  }
}

async function maybeProbeModelCapabilities(
  backendId: BackendId,
  modelId: string,
  capabilities: ModelCapabilities,
  signal?: AbortSignal
) {
  if (!MODEL_CAPABILITY_PROBE_ENABLED) return capabilities;
  if (backendId !== "openai" && backendId !== "anthropic") return capabilities;

  if (backendId === "openai") {
    const supportsImage = capabilities.imageInput
      ? true
      : await probeOpenAIImageInput(modelId, signal);
    const supportsFile =
      capabilities.documentInput || capabilities.binaryInput
        ? true
        : await probeOpenAIFileInput(modelId, signal);

    return {
      ...capabilities,
      imageInput: typeof supportsImage === "boolean" ? supportsImage : capabilities.imageInput,
      documentInput: typeof supportsFile === "boolean" ? supportsFile : capabilities.documentInput,
      binaryInput: typeof supportsFile === "boolean" ? supportsFile : capabilities.binaryInput,
    };
  }

  if (capabilities.imageInput) return capabilities;
  const supportsImage = await probeAnthropicImageInput(modelId, signal);
  if (typeof supportsImage !== "boolean") return capabilities;
  return {
    ...capabilities,
    imageInput: supportsImage,
  };
}

function attachmentToBlob(attachment: ResolvedAttachment) {
  const bytes = Buffer.from(attachment.base64Data, "base64");
  return new Blob([bytes], {
    type: attachment.mimeType || "application/octet-stream",
  });
}

function shortErrorDetails(raw: string) {
  return raw.slice(0, 400);
}

async function uploadAttachmentToOpenAIFilesApi(
  attachment: ResolvedAttachment,
  signal?: AbortSignal
): Promise<{ fileId: string; purpose: string } | null> {
  const baseUrl = resolveOpenAIBaseUrl().replace(/\/$/, "");
  const headers: Record<string, string> = {};
  if (process.env.OPENAI_API_KEY) {
    headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
  }

  const purposes = Array.from(
    new Set([
      attachment.kind === "image" ? OPENAI_FILE_PURPOSE_VISION : OPENAI_FILE_PURPOSE_DEFAULT,
      "assistants",
    ])
  );
  let lastFailure = "";

  for (const purpose of purposes) {
    const formData = new FormData();
    formData.append("purpose", purpose);
    formData.append("file", attachmentToBlob(attachment), attachment.name || "attachment.bin");

    const response = await fetch(`${baseUrl}/files`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers,
      body: formData,
    });

    if (response.ok) {
      const payload = (await response.json()) as { id?: string };
      if (typeof payload.id === "string" && payload.id.trim()) {
        return {
          fileId: payload.id.trim(),
          purpose,
        };
      }
      throw new BackendError("OpenAI-compatible file upload succeeded but returned no file id.", 502);
    }

    const raw = await response.text();
    lastFailure = shortErrorDetails(raw);

    if (response.status === 404 || response.status === 405 || response.status === 501) {
      return null;
    }

    if (
      response.status === 400 &&
      purpose !== purposes[purposes.length - 1] &&
      (raw.toLowerCase().includes("purpose") || raw.toLowerCase().includes("invalid value"))
    ) {
      continue;
    }

    if (response.status === 401 || response.status === 403) {
      throw new BackendError("OpenAI-compatible file upload authentication failed.", 502, lastFailure);
    }

    throw new BackendError("Failed to upload attachment to OpenAI-compatible file API.", 502, lastFailure);
  }

  if (lastFailure) {
    throw new BackendError("Failed to upload attachment to OpenAI-compatible file API.", 502, lastFailure);
  }
  return null;
}

async function ensureOpenAIProviderFileId(attachment: ResolvedAttachment, signal?: AbortSignal) {
  const cached = await readStoredAttachmentProviderFile(attachment.id, "openai");
  if (cached?.fileId) {
    return cached.fileId;
  }

  const uploaded = await uploadAttachmentToOpenAIFilesApi(attachment, signal);
  if (!uploaded?.fileId) {
    return null;
  }

  await upsertStoredAttachmentProviderFile(attachment.id, "openai", {
    fileId: uploaded.fileId,
    createdAt: Date.now(),
    purpose: uploaded.purpose,
  });
  return uploaded.fileId;
}

async function uploadAttachmentToAnthropicFilesApi(
  attachment: ResolvedAttachment,
  signal?: AbortSignal
): Promise<string | null> {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BackendError("Anthropic API key is missing.", 400);
  }

  const baseUrl = resolveAnthropicBaseUrl().replace(/\/$/, "");
  const formData = new FormData();
  formData.append("file", attachmentToBlob(attachment), attachment.name || "attachment.bin");

  const response = await fetch(`${baseUrl}/files`, {
    method: "POST",
    cache: "no-store",
    signal,
    headers: {
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
      "anthropic-beta": ANTHROPIC_FILES_BETA_HEADER,
    },
    body: formData,
  });

  if (response.ok) {
    const payload = (await response.json()) as { id?: string };
    if (typeof payload.id === "string" && payload.id.trim()) {
      return payload.id.trim();
    }
    throw new BackendError("Anthropic file upload succeeded but returned no file id.", 502);
  }

  const raw = await response.text();
  const details = shortErrorDetails(raw);

  if (response.status === 404 || response.status === 405 || response.status === 501) {
    return null;
  }

  if (response.status === 400) {
    const lowered = raw.toLowerCase();
    if (lowered.includes("unsupported") || lowered.includes("invalid file") || lowered.includes("file type")) {
      return null;
    }
  }

  if (response.status === 401 || response.status === 403) {
    throw new BackendError("Anthropic file upload authentication failed.", 502, details);
  }

  throw new BackendError("Failed to upload attachment to Anthropic file API.", 502, details);
}

async function ensureAnthropicProviderFileId(attachment: ResolvedAttachment, signal?: AbortSignal) {
  const cached = await readStoredAttachmentProviderFile(attachment.id, "anthropic");
  if (cached?.fileId) {
    return cached.fileId;
  }

  const fileId = await uploadAttachmentToAnthropicFilesApi(attachment, signal);
  if (!fileId) {
    return null;
  }

  await upsertStoredAttachmentProviderFile(attachment.id, "anthropic", {
    fileId,
    createdAt: Date.now(),
  });
  return fileId;
}

function formatAttachmentAsText(attachment: Pick<ResolvedAttachment, "name" | "mimeType" | "kind" | "sizeBytes" | "textPreview">) {
  const metaLine = `Attachment: ${attachment.name} (${attachment.mimeType}, ${formatBytes(attachment.sizeBytes)})`;
  if (attachment.textPreview?.trim()) {
    return `${metaLine}\n\n${attachment.textPreview.trim()}`;
  }
  if (attachment.kind === "image") {
    return `${metaLine}\n\nImage attached. If vision input is unavailable, use metadata only and do not invent unseen details.`;
  }
  if (attachment.kind === "document") {
    return `${metaLine}\n\nDocument attached. Raw document bytes are not parsed in this fallback path. Use only available metadata.`;
  }
  if (attachment.kind === "audio" || attachment.kind === "video") {
    return `${metaLine}\n\nMedia attached. Raw media bytes are not parsed in this fallback path. Use only available metadata.`;
  }
  if (attachment.kind === "binary") {
    return `${metaLine}\n\nBinary file attached. The file content is not parsed here; only filename, mime type, and size are available.`;
  }
  return `${metaLine}\n\nAttachment metadata only.`;
}

function getMessageAttachmentIds(message: InputMessage) {
  if (!Array.isArray(message.attachments)) return [];
  return message.attachments
    .map((attachment) => (attachment && typeof attachment.id === "string" ? attachment.id.trim() : ""))
    .filter(Boolean);
}

async function resolveAttachmentsForMessages(messages: InputMessage[]) {
  const uniqueIds = new Set<string>();
  for (const message of messages) {
    for (const attachmentId of getMessageAttachmentIds(message)) {
      uniqueIds.add(attachmentId);
    }
  }

  if (!uniqueIds.size) {
    return new Map<string, ResolvedAttachment>();
  }

  const attachmentMap = new Map<string, ResolvedAttachment>();
  let totalBytes = 0;

  for (const attachmentId of Array.from(uniqueIds)) {
    const loaded = await readStoredAttachment(attachmentId);
    if (!loaded) {
      throw new BackendError(`Attachment "${attachmentId}" is missing. Please upload again.`, 400);
    }

    totalBytes += loaded.meta.sizeBytes;
    if (totalBytes > MAX_TOTAL_ATTACHMENT_BYTES_PER_REQUEST) {
      throw new BackendError(
        `Total attachment payload exceeds ${Math.round(MAX_TOTAL_ATTACHMENT_BYTES_PER_REQUEST / (1024 * 1024))} MB.`,
        400
      );
    }

    attachmentMap.set(attachmentId, {
      ...loaded.meta,
      base64Data: loaded.buffer.toString("base64"),
    });
  }

  return attachmentMap;
}

function validateAttachmentConstraints(
  messages: InputMessage[],
  modelCapabilities: ModelCapabilities,
  attachmentMap: Map<string, ResolvedAttachment>
) {
  const maxAttachments = Math.max(1, modelCapabilities.maxAttachments);
  const maxAttachmentBytes = Math.max(1, modelCapabilities.maxAttachmentBytes);

  for (const message of messages) {
    const attachmentIds = getMessageAttachmentIds(message);
    if (!attachmentIds.length) continue;

    if (attachmentIds.length > maxAttachments) {
      throw new BackendError(
        `Message has ${attachmentIds.length} attachments, but this model allows up to ${maxAttachments}.`,
        400
      );
    }

    for (const attachmentId of attachmentIds) {
      const attachment = attachmentMap.get(attachmentId);
      if (!attachment) {
        throw new BackendError(`Attachment "${attachmentId}" is missing. Please upload again.`, 400);
      }

      if (attachment.sizeBytes > maxAttachmentBytes) {
        throw new BackendError(
          `"${attachment.name}" exceeds this model's file size limit of ${formatBytes(maxAttachmentBytes)}.`,
          400
        );
      }
    }
  }
}

function buildOllamaMessages(
  messages: InputMessage[],
  systemPrompt: string,
  attachmentMap: Map<string, ResolvedAttachment>,
  modelCapabilities: ModelCapabilities
) {
  const normalizedMessages: Array<{ role: BackendMessageRole; content: string; images?: string[] }> = [];

  if (systemPrompt.trim()) {
    normalizedMessages.push({
      role: "system",
      content: systemPrompt.trim(),
    });
  }

  for (const message of messages) {
    const textParts: string[] = [];
    const images: string[] = [];
    if (message.content.trim()) {
      textParts.push(message.content.trim());
    }

    for (const attachmentId of getMessageAttachmentIds(message)) {
      const attachment = attachmentMap.get(attachmentId);
      if (!attachment) continue;

      if (
        attachment.kind === "image" &&
        attachment.mimeType.startsWith("image/") &&
        modelCapabilities.imageInput
      ) {
        images.push(attachment.base64Data);
      } else {
        textParts.push(formatAttachmentAsText(attachment));
      }
    }

    normalizedMessages.push({
      role: message.role,
      content: textParts.join("\n\n").trim() || (images.length ? "Use the attached image(s)." : "(empty)"),
      images: images.length ? images : undefined,
    });
  }

  return normalizedMessages;
}

function shouldUseOpenAIFilePart(
  attachment: ResolvedAttachment,
  modelCapabilities: ModelCapabilities
) {
  if (attachment.kind === "image") return false;
  return (
    modelCapabilities.documentInput ||
    modelCapabilities.binaryInput ||
    modelCapabilities.audioInput ||
    modelCapabilities.videoInput
  );
}

async function buildOpenAIMessageContent(
  message: InputMessage,
  attachmentMap: Map<string, ResolvedAttachment>,
  modelCapabilities: ModelCapabilities,
  signal?: AbortSignal
) {
  const parts: Array<
    | { type: "text"; text: string }
    | { type: "image_url"; image_url: { url: string } }
    | { type: "file"; file: { file_id?: string; file_data?: string; filename?: string } }
  > = [];

  if (message.content.trim()) {
    parts.push({ type: "text", text: message.content.trim() });
  }

  for (const attachmentId of getMessageAttachmentIds(message)) {
    const attachment = attachmentMap.get(attachmentId);
    if (!attachment) continue;

    if (
      attachment.kind === "image" &&
      attachment.mimeType.startsWith("image/") &&
      modelCapabilities.imageInput
    ) {
      parts.push({
        type: "image_url",
        image_url: {
          url: `data:${attachment.mimeType};base64,${attachment.base64Data}`,
        },
      });
      continue;
    }

    if (shouldUseOpenAIFilePart(attachment, modelCapabilities)) {
      const providerFileId = await ensureOpenAIProviderFileId(attachment, signal);
      if (providerFileId) {
        parts.push({
          type: "file",
          file: {
            file_id: providerFileId,
          },
        });
      } else {
        parts.push({
          type: "file",
          file: {
            file_data: attachment.base64Data,
            filename: attachment.name || "attachment.bin",
          },
        });
      }
      continue;
    }

    parts.push({
      type: "text",
      text: formatAttachmentAsText(attachment),
    });
  }

  if (!parts.length) {
    return "(empty)";
  }

  if (parts.length === 1 && parts[0].type === "text") {
    return parts[0].text;
  }

  return parts;
}

function canUseAnthropicProviderFileSource(
  attachment: ResolvedAttachment,
  modelCapabilities: ModelCapabilities
) {
  if (attachment.kind === "image") {
    return modelCapabilities.imageInput && attachment.mimeType.startsWith("image/");
  }
  if (attachment.kind === "document" || attachment.kind === "text") {
    return modelCapabilities.documentInput;
  }
  return false;
}

async function buildAnthropicMessageContent(
  message: InputMessage,
  attachmentMap: Map<string, ResolvedAttachment>,
  modelCapabilities: ModelCapabilities,
  signal?: AbortSignal
) {
  const parts: Array<Record<string, unknown>> = [];

  if (message.content.trim()) {
    parts.push({
      type: "text",
      text: message.content.trim(),
    });
  }

  for (const attachmentId of getMessageAttachmentIds(message)) {
    const attachment = attachmentMap.get(attachmentId);
    if (!attachment) continue;

    if (
      attachment.kind === "image" &&
      attachment.mimeType.startsWith("image/") &&
      modelCapabilities.imageInput
    ) {
      const providerFileId = canUseAnthropicProviderFileSource(attachment, modelCapabilities)
        ? await ensureAnthropicProviderFileId(attachment, signal)
        : null;

      if (providerFileId) {
        parts.push({
          type: "image",
          source: {
            type: "file",
            file_id: providerFileId,
          },
        });
        continue;
      }

      parts.push({
        type: "image",
        source: {
          type: "base64",
          media_type: attachment.mimeType,
          data: attachment.base64Data,
        },
      });
      continue;
    }

    if (
      (attachment.kind === "document" || attachment.kind === "text") &&
      modelCapabilities.documentInput
    ) {
      const providerFileId = canUseAnthropicProviderFileSource(attachment, modelCapabilities)
        ? await ensureAnthropicProviderFileId(attachment, signal)
        : null;

      if (providerFileId) {
        parts.push({
          type: "document",
          source: {
            type: "file",
            file_id: providerFileId,
          },
        });
        continue;
      }

      if (attachment.mimeType !== "application/pdf") {
        parts.push({
          type: "text",
          text: formatAttachmentAsText(attachment),
        });
        continue;
      }

      parts.push({
        type: "document",
        source: {
          type: "base64",
          media_type: attachment.mimeType,
          data: attachment.base64Data,
        },
      });
      continue;
    }

    parts.push({
      type: "text",
      text: formatAttachmentAsText(attachment),
    });
  }

  if (!parts.length) {
    return [
      {
        type: "text",
        text: "(empty)",
      },
    ];
  }

  return parts;
}

function normalizeSettings(settings?: ChatSettings): Required<ChatSettings> {
  const merged = { ...DEFAULT_SETTINGS, ...(settings ?? {}) };

  return {
    systemPrompt: merged.systemPrompt,
    temperature: clampNumber(Number(merged.temperature ?? DEFAULT_SETTINGS.temperature), 0, 2),
    topP: clampNumber(Number(merged.topP ?? DEFAULT_SETTINGS.topP), 0, 1),
    topK: Math.max(1, Math.round(Number(merged.topK ?? DEFAULT_SETTINGS.topK))),
    maxTokens: Math.max(1, Math.round(Number(merged.maxTokens ?? DEFAULT_SETTINGS.maxTokens))),
    stopSequences: merged.stopSequences,
    seed: merged.seed,
    jsonMode: Boolean(merged.jsonMode),
    contextWindow: Math.max(256, Math.round(Number(merged.contextWindow ?? DEFAULT_SETTINGS.contextWindow))),
    repeatPenalty: clampNumber(Number(merged.repeatPenalty ?? DEFAULT_SETTINGS.repeatPenalty), 0.5, 2),
    keepAlive: merged.keepAlive.trim() || DEFAULT_SETTINGS.keepAlive,
  };
}

function resolveOllamaBaseUrl() {
  if (process.env.OLLAMA_BASE_URL) {
    return process.env.OLLAMA_BASE_URL;
  }
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return "http://ollama:11434";
  }
  return "http://localhost:11434";
}

function resolveOpenAIBaseUrl() {
  return process.env.OPENAI_BASE_URL || "https://api.openai.com/v1";
}

function resolveAnthropicBaseUrl() {
  return process.env.ANTHROPIC_BASE_URL || "https://api.anthropic.com/v1";
}

function encodeEvent(event: StreamEvent) {
  return `${JSON.stringify(event)}\n`;
}

function parseSSEStream(
  source: ReadableStream<Uint8Array>,
  onData: (dataLine: string) => StreamEvent[] | null
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();

      const flushEvent = (rawEvent: string) => {
        const lines = rawEvent.split("\n");
        const dataLines = lines
          .map((line) => line.trim())
          .filter((line) => line.startsWith("data:"))
          .map((line) => line.slice(5).trim());

        if (!dataLines.length) return;

        const payload = dataLines.join("\n");
        const events = onData(payload);
        if (!events?.length) return;

        for (const event of events) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");

          let boundaryIndex = buffer.indexOf("\n\n");
          while (boundaryIndex >= 0) {
            const rawEvent = buffer.slice(0, boundaryIndex);
            buffer = buffer.slice(boundaryIndex + 2);
            flushEvent(rawEvent);
            boundaryIndex = buffer.indexOf("\n\n");
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          flushEvent(buffer);
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function parseNDJSONStream(
  source: ReadableStream<Uint8Array>,
  onLine: (line: string) => StreamEvent[] | null
) {
  const decoder = new TextDecoder();
  const encoder = new TextEncoder();
  let buffer = "";

  return new ReadableStream<Uint8Array>({
    async start(controller) {
      const reader = source.getReader();

      const flushLine = (rawLine: string) => {
        const line = rawLine.trim();
        if (!line) return;
        const events = onLine(line);
        if (!events?.length) return;
        for (const event of events) {
          controller.enqueue(encoder.encode(encodeEvent(event)));
        }
      };

      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;

          buffer += decoder.decode(value, { stream: true });
          buffer = buffer.replace(/\r\n/g, "\n");

          let newlineIndex = buffer.indexOf("\n");
          while (newlineIndex >= 0) {
            flushLine(buffer.slice(0, newlineIndex));
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf("\n");
          }
        }

        buffer += decoder.decode();
        if (buffer.trim()) {
          flushLine(buffer);
        }

        controller.close();
      } catch (error) {
        controller.error(error);
      } finally {
        reader.releaseLock();
      }
    },
  });
}

function buildPluginMessages(
  messages: InputMessage[],
  systemPrompt: string,
  attachmentMap: Map<string, ResolvedAttachment>
) {
  const normalizedMessages: Array<{
    role: CustomBackendMessageRole;
    content: string;
    attachments?: Array<{
      id: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      kind: AttachmentKind;
      textPreview?: string;
      base64Data: string;
    }>;
  }> = [];

  if (systemPrompt.trim()) {
    normalizedMessages.push({
      role: "system",
      content: systemPrompt.trim(),
    });
  }

  for (const message of messages) {
    const textParts: string[] = [];
    const pluginAttachments: Array<{
      id: string;
      name: string;
      mimeType: string;
      sizeBytes: number;
      kind: AttachmentKind;
      textPreview?: string;
      base64Data: string;
    }> = [];

    if (message.content.trim()) {
      textParts.push(message.content.trim());
    }

    for (const attachmentId of getMessageAttachmentIds(message)) {
      const attachment = attachmentMap.get(attachmentId);
      if (!attachment) continue;
      pluginAttachments.push({
        id: attachment.id,
        name: attachment.name,
        mimeType: attachment.mimeType,
        sizeBytes: attachment.sizeBytes,
        kind: attachment.kind,
        textPreview: attachment.textPreview,
        base64Data: attachment.base64Data,
      });
      textParts.push(formatAttachmentAsText(attachment));
    }

    normalizedMessages.push({
      role: message.role,
      content: textParts.join("\n\n").trim() || "(empty)",
      attachments: pluginAttachments.length ? pluginAttachments : undefined,
    });
  }

  return normalizedMessages;
}

function extractTextFromUnknownParts(candidate: unknown, acceptedTypes?: string[]) {
  if (!Array.isArray(candidate)) return "";

  const normalizedTypes = Array.isArray(acceptedTypes)
    ? acceptedTypes.map((type) => type.trim().toLowerCase()).filter(Boolean)
    : [];
  const hasTypeFilter = normalizedTypes.length > 0;

  const chunks: string[] = [];
  for (const part of candidate) {
    const record = asRecord(part);
    if (!record) continue;

    if (hasTypeFilter) {
      const typeValue = typeof record.type === "string" ? record.type.trim().toLowerCase() : "";
      if (!normalizedTypes.includes(typeValue)) continue;
    }

    if (typeof record.text === "string" && record.text) {
      chunks.push(record.text);
      continue;
    }

    if (typeof record.content === "string" && record.content) {
      chunks.push(record.content);
      continue;
    }

    if (typeof record.reasoning === "string" && record.reasoning) {
      chunks.push(record.reasoning);
      continue;
    }

    if (typeof record.thinking === "string" && record.thinking) {
      chunks.push(record.thinking);
      continue;
    }
  }

  return chunks.join("");
}

function parseOpenAICompatibleSSEEvent(dataLine: string): StreamEvent[] {
  if (dataLine === "[DONE]") {
    return [{ done: true }];
  }

  const parsed = JSON.parse(dataLine) as {
    error?: { message?: string };
    choices?: Array<{
      finish_reason?: string | null;
      delta?: {
        content?: string | Array<{ type?: string; text?: string }>;
        reasoning?: string | Array<{ type?: string; text?: string; content?: string }>;
        reasoning_content?: string;
        thinking?: string | Array<{ type?: string; text?: string; content?: string }>;
      };
    }>;
    usage?: {
      prompt_tokens?: number;
      completion_tokens?: number;
      total_tokens?: number;
    };
  };

  if (parsed.error?.message) {
    throw new BackendError(parsed.error.message, 502);
  }

  const choice = parsed.choices?.[0];
  const delta = asRecord(choice?.delta);
  const deltaContent = choice?.delta?.content;
  const chunk = typeof deltaContent === "string"
    ? deltaContent
    : extractTextFromUnknownParts(deltaContent, ["text", "output_text"]);
  const reasoningChunk =
    (typeof delta?.reasoning_content === "string" ? delta.reasoning_content : "") ||
    (typeof delta?.reasoning === "string" ? delta.reasoning : "") ||
    (typeof delta?.thinking === "string" ? delta.thinking : "") ||
    extractTextFromUnknownParts(delta?.reasoning) ||
    extractTextFromUnknownParts(delta?.thinking) ||
    extractTextFromUnknownParts(deltaContent, ["reasoning", "thinking"]);

  const events: StreamEvent[] = [];

  if (reasoningChunk) {
    events.push({
      thinking: {
        content: reasoningChunk,
      },
    });
  }

  if (chunk) {
    events.push({
      message: {
        role: "assistant",
        content: chunk,
      },
    });
  }

  if (parsed.usage) {
    events.push({
      usage: {
        promptTokens:
          typeof parsed.usage.prompt_tokens === "number" ? parsed.usage.prompt_tokens : undefined,
        completionTokens:
          typeof parsed.usage.completion_tokens === "number"
            ? parsed.usage.completion_tokens
            : undefined,
        totalTokens:
          typeof parsed.usage.total_tokens === "number" ? parsed.usage.total_tokens : undefined,
      },
    });
  }

  if (choice?.finish_reason) {
    events.push({ done: true });
  }

  return events;
}

function parseProviderSSEEvent(dataLine: string): StreamEvent[] | null {
  if (dataLine === "[DONE]") {
    return [{ done: true }];
  }

  const parsed = JSON.parse(dataLine) as unknown;
  const events: StreamEvent[] = [];
  const queue = Array.isArray(parsed) ? parsed : [parsed];

  for (const candidate of queue) {
    const record = asRecord(candidate);
    if (!record) continue;

    const event: StreamEvent = {};

    if (typeof record.error === "string" && record.error.trim()) {
      event.error = record.error.trim();
    }
    if (record.done === true) {
      event.done = true;
    }

    const messageRecord = asRecord(record.message);
    const deltaRecord = asRecord(record.delta);
    const chunkText =
      typeof messageRecord?.content === "string"
        ? messageRecord.content
        : typeof messageRecord?.text === "string"
          ? messageRecord.text
        : typeof record.delta === "string"
          ? record.delta
          : typeof record.response === "string"
            ? record.response
          : typeof record.text === "string"
            ? record.text
            : "";
    if (chunkText) {
      event.message = {
        role:
          messageRecord?.role === "assistant" || messageRecord?.role === "user"
            ? messageRecord.role
            : "assistant",
        content: chunkText,
      };
    }

    const thinkingChunk =
      (typeof messageRecord?.thinking === "string" ? messageRecord.thinking : "") ||
      (typeof messageRecord?.reasoning === "string" ? messageRecord.reasoning : "") ||
      (typeof record.thinking === "string" ? record.thinking : "") ||
      (typeof record.reasoning === "string" ? record.reasoning : "") ||
      (typeof record.reasoning_content === "string" ? record.reasoning_content : "") ||
      (typeof record.delta_reasoning === "string" ? record.delta_reasoning : "") ||
      (typeof deltaRecord?.thinking === "string" ? deltaRecord.thinking : "") ||
      (typeof deltaRecord?.reasoning === "string" ? deltaRecord.reasoning : "") ||
      (typeof record.type === "string" &&
      /(thinking|reasoning)/i.test(record.type) &&
      typeof record.text === "string"
        ? record.text
        : "") ||
      extractTextFromUnknownParts(deltaRecord?.content, ["thinking", "reasoning"]);

    if (thinkingChunk) {
      event.thinking = {
        content: thinkingChunk,
      };
    }

    const usageRecord = asRecord(record.usage);
    const promptFromTopLevel =
      parseFlexibleNumber(record.prompt_eval_count) ?? parseFlexibleNumber(record.input_tokens);
    const completionFromTopLevel =
      parseFlexibleNumber(record.eval_count) ?? parseFlexibleNumber(record.output_tokens);
    const totalFromTopLevel = parseFlexibleNumber(record.total_tokens);
    const promptTokens =
      typeof usageRecord?.promptTokens === "number"
        ? usageRecord.promptTokens
        : typeof usageRecord?.prompt_tokens === "number"
          ? usageRecord.prompt_tokens
          : promptFromTopLevel;
    const completionTokens =
      typeof usageRecord?.completionTokens === "number"
        ? usageRecord.completionTokens
        : typeof usageRecord?.completion_tokens === "number"
          ? usageRecord.completion_tokens
          : completionFromTopLevel;
    const totalTokens =
      typeof usageRecord?.totalTokens === "number"
        ? usageRecord.totalTokens
        : typeof usageRecord?.total_tokens === "number"
          ? usageRecord.total_tokens
          : totalFromTopLevel;

    if (
      typeof promptTokens === "number" ||
      typeof completionTokens === "number" ||
      typeof totalTokens === "number"
    ) {
      event.usage = {
        promptTokens,
        completionTokens,
        totalTokens:
          typeof totalTokens === "number"
            ? totalTokens
            : typeof promptTokens === "number" || typeof completionTokens === "number"
              ? (promptTokens ?? 0) + (completionTokens ?? 0)
              : undefined,
      };
    }

    if (event.message || event.thinking || event.error || event.done || event.usage) {
      events.push(event);
    }
  }

  return events.length ? events : null;
}

function parseProviderStreamByFormat(
  source: ReadableStream<Uint8Array>,
  format: "ndjson" | "sse-standard" | "openai"
) {
  if (format === "ndjson") {
    return parseNDJSONStream(source, parseProviderSSEEvent);
  }

  if (format === "openai") {
    return parseSSEStream(source, parseOpenAICompatibleSSEEvent);
  }

  return parseSSEStream(source, parseProviderSSEEvent);
}

function isBuiltInBackendId(backendId: string): backendId is BuiltInBackendId {
  return backendId === "ollama" || backendId === "openai" || backendId === "anthropic";
}

function resolveBackend(backendId: string) {
  if (isBuiltInBackendId(backendId)) {
    return {
      kind: "built-in" as const,
      backendId,
    };
  }

  const plugin = getProviderPluginById(backendId);
  if (!plugin) return null;
  return {
    kind: "plugin" as const,
    plugin,
  };
}

function resolveBackendOrThrow(backendId: string) {
  const resolved = resolveBackend(backendId);
  if (!resolved) {
    throw new BackendError(`Unsupported backend: ${backendId}`, 400);
  }
  return resolved;
}

function getCapabilitiesForBackend(backendId: string): BackendCapabilities {
  const resolved = resolveBackendOrThrow(backendId);
  if (resolved.kind === "plugin") {
    return resolved.plugin.capabilities;
  }

  if (resolved.backendId === "ollama") return OLLAMA_CAPABILITIES;
  if (resolved.backendId === "openai") return OPENAI_CAPABILITIES;
  return ANTHROPIC_CAPABILITIES;
}

function toBuiltInBackendId(backendId: string): BuiltInBackendId {
  if (!isBuiltInBackendId(backendId)) {
    throw new BackendError(`Unsupported built-in backend: ${backendId}`, 400);
  }
  return backendId;
}

function normalizeProviderModel(rawModel: unknown, plugin: ProviderPlugin) {
  const record = asRecord(rawModel);
  if (!record) return null;
  const id =
    typeof record.id === "string"
      ? record.id.trim()
      : typeof record.name === "string"
        ? record.name.trim()
        : "";
  if (!id) return null;
  const rawCapabilities = asRecord(record.capabilities);
  const capabilities: ModelCapabilities = rawCapabilities
    ? {
        textInput:
          typeof rawCapabilities.textInput === "boolean"
            ? rawCapabilities.textInput
            : plugin.modelCapabilities.textInput,
        imageInput:
          typeof rawCapabilities.imageInput === "boolean"
            ? rawCapabilities.imageInput
            : plugin.modelCapabilities.imageInput,
        documentInput:
          typeof rawCapabilities.documentInput === "boolean"
            ? rawCapabilities.documentInput
            : plugin.modelCapabilities.documentInput,
        audioInput:
          typeof rawCapabilities.audioInput === "boolean"
            ? rawCapabilities.audioInput
            : plugin.modelCapabilities.audioInput,
        videoInput:
          typeof rawCapabilities.videoInput === "boolean"
            ? rawCapabilities.videoInput
            : plugin.modelCapabilities.videoInput,
        binaryInput:
          typeof rawCapabilities.binaryInput === "boolean"
            ? rawCapabilities.binaryInput
            : plugin.modelCapabilities.binaryInput,
        maxAttachments: readPositiveInteger(rawCapabilities.maxAttachments) ?? plugin.modelCapabilities.maxAttachments,
        maxAttachmentBytes:
          readPositiveInteger(rawCapabilities.maxAttachmentBytes) ??
          plugin.modelCapabilities.maxAttachmentBytes,
      }
    : plugin.modelCapabilities;

  return {
    id,
    meta:
      typeof record.meta === "string"
        ? record.meta
        : typeof record.owned_by === "string"
          ? record.owned_by
          : typeof record.display_name === "string"
            ? record.display_name
            : undefined,
    capabilities,
  } satisfies ModelOption;
}

async function listModelsForProviderPlugin(plugin: ProviderPlugin): Promise<ModelOption[]> {
  if (plugin.modelsSource === "static") {
    return plugin.staticModels.map((model) => ({
      id: model.id,
      meta: model.meta,
      capabilities: model.capabilities ?? plugin.modelCapabilities,
    }));
  }

  const endpoint = resolveProviderUrl(plugin.baseUrl, plugin.modelsPath);
  let response: Response;
  try {
    response = await fetchWithLocalhostFallback(endpoint, {
      cache: "no-store",
      headers: {
        Accept: "application/json",
        ...plugin.headers,
      },
    });
  } catch (error) {
    throw new BackendError(
      `Failed to reach ${plugin.name} models endpoint.`,
      503,
      `Endpoint: ${endpoint}. ${normalizeErrorMessage(error)}`
    );
  }

  if (!response.ok) {
    const raw = await response.text();
    throw new BackendError(
      `Failed to load models from ${plugin.name}.`,
      502,
      raw.slice(0, 400)
    );
  }

  const payload = (await response.json()) as unknown;
  const rootArray = Array.isArray(payload)
    ? payload
    : asRecord(payload)?.models && Array.isArray(asRecord(payload)?.models)
      ? (asRecord(payload)?.models as unknown[])
      : asRecord(payload)?.data && Array.isArray(asRecord(payload)?.data)
        ? (asRecord(payload)?.data as unknown[])
        : [];

  if (!rootArray.length) {
    return plugin.staticModels.map((model) => ({
      id: model.id,
      meta: model.meta,
      capabilities: model.capabilities ?? plugin.modelCapabilities,
    }));
  }

  const normalized: ModelOption[] = [];
  for (const entry of rootArray) {
    if (typeof entry === "string") {
      const id = entry.trim();
      if (!id) continue;
      normalized.push({
        id,
        capabilities: plugin.modelCapabilities,
      });
      continue;
    }

    const parsed = normalizeProviderModel(entry, plugin);
    if (!parsed) continue;
    normalized.push({
      ...parsed,
      capabilities: parsed.capabilities ?? plugin.modelCapabilities,
    });
  }

  normalized.sort((left, right) => left.id.localeCompare(right.id));

  if (!normalized.length) {
    return plugin.staticModels.map((model) => ({
      id: model.id,
      meta: model.meta,
      capabilities: model.capabilities ?? plugin.modelCapabilities,
    }));
  }

  return normalized;
}

export function listAvailableBackends(): BackendOption[] {
  const backends: BackendOption[] = [];

  if (process.env.OLLAMA_ENABLED !== "false") {
    backends.push({
      id: "ollama",
      label: "Ollama",
      meta: resolveOllamaBaseUrl(),
      capabilities: OLLAMA_CAPABILITIES,
    });
  }

  if (
    process.env.OPENAI_ENABLED === "true" ||
    process.env.OPENAI_API_KEY ||
    process.env.OPENAI_BASE_URL
  ) {
    backends.push({
      id: "openai",
      label: "OpenAI",
      meta: resolveOpenAIBaseUrl(),
      capabilities: OPENAI_CAPABILITIES,
    });
  }

  if (process.env.ANTHROPIC_ENABLED === "true" || process.env.ANTHROPIC_API_KEY) {
    backends.push({
      id: "anthropic",
      label: "Anthropic",
      meta: resolveAnthropicBaseUrl(),
      capabilities: ANTHROPIC_CAPABILITIES,
    });
  }

  const providerPlugins = listProviderPlugins();
  if (providerPlugins.length) {
    backends.push(
      ...providerPlugins.map((plugin) => ({
        id: plugin.id,
        label: plugin.name,
        meta: plugin.baseUrl,
        capabilities: plugin.capabilities,
      }))
    );
  }

  if (!backends.length) {
    backends.push({
      id: "ollama",
      label: "Ollama",
      meta: resolveOllamaBaseUrl(),
      capabilities: OLLAMA_CAPABILITIES,
    });
  }

  return backends;
}

export async function listModelsForBackend(backendId: string): Promise<ModelOption[]> {
  const resolvedBackend = resolveBackendOrThrow(backendId);
  if (resolvedBackend.kind === "plugin") {
    const pluginModels = await listModelsForProviderPlugin(resolvedBackend.plugin);
    cacheModelCapabilities(
      backendId,
      pluginModels.map((model) => ({
        ...model,
        capabilities: model.capabilities ?? resolvedBackend.plugin.modelCapabilities,
      }))
    );
    return pluginModels;
  }
  const builtInBackendId = toBuiltInBackendId(backendId);

  if (builtInBackendId === "ollama") {
    const baseUrl = resolveOllamaBaseUrl().replace(/\/$/, "");
    const response = await fetch(`${baseUrl}/api/tags`, { cache: "no-store" });
    if (!response.ok) {
      throw new BackendError(
        "Failed to load models from Ollama.",
        502,
        `Status ${response.status}`
      );
    }

    const payload = (await response.json()) as { models?: OllamaModel[] };
    const models = payload.models ?? [];

    const resolvedModels = await Promise.all(models.map(async (model) => {
      const sizeLabel = model.details?.parameter_size ?? "";
      const quantLabel = model.details?.quantization_level ?? "";
      const metaParts = [sizeLabel, quantLabel].filter(Boolean).join(" / ");
      const fallbackFamily =
        typeof model.details?.family === "string" ? model.details.family : "";
      const fallback = formatBytes(model.size) || fallbackFamily || "Model";
      let capabilities = resolveDynamicModelCapabilities("ollama", model as Record<string, unknown>);
      try {
        const detailedCaps = await fetchSingleModelCapabilities("ollama", model.name);
        capabilities = detailedCaps;
      } catch {
        // Keep list-level capabilities when model details are unavailable.
      }

      return {
        id: model.name,
        meta: metaParts || fallback,
        capabilities,
      };
    }));
    cacheModelCapabilities("ollama", resolvedModels);
    return resolvedModels;
  }

  if (builtInBackendId === "openai") {
    const baseUrl = resolveOpenAIBaseUrl().replace(/\/$/, "");
    const includeUsage = /api\.openai\.com/i.test(baseUrl) || process.env.OPENAI_INCLUDE_USAGE === "true";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.OPENAI_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
    }

    const response = await fetch(`${baseUrl}/models`, {
      cache: "no-store",
      headers,
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new BackendError(
        "Failed to load models from OpenAI-compatible endpoint.",
        502,
        raw.slice(0, 400)
      );
    }

    const payload = (await response.json()) as { data?: OpenAIModel[] };
    const models = (payload.data ?? [])
      .map((model) => ({
        id: model.id,
        meta: model.owned_by || "Model",
        capabilities: resolveDynamicModelCapabilities("openai", model as Record<string, unknown>),
      }))
      .sort((left, right) => left.id.localeCompare(right.id));

    cacheModelCapabilities("openai", models);
    return models;
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BackendError("Anthropic API key is missing.", 400);
  }

  const baseUrl = resolveAnthropicBaseUrl().replace(/\/$/, "");
  const response = await fetch(`${baseUrl}/models`, {
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new BackendError("Failed to load models from Anthropic.", 502, raw.slice(0, 400));
  }

  const payload = (await response.json()) as { data?: AnthropicModel[] };
  const models = (payload.data ?? []).map((model) => ({
    id: model.id,
    meta: model.display_name || "Model",
    capabilities: resolveDynamicModelCapabilities("anthropic", model as Record<string, unknown>),
  }));
  cacheModelCapabilities("anthropic", models);
  return models;
}

export async function getModelCapabilitiesForBackend(options: {
  backendId: string;
  modelId: string;
  signal?: AbortSignal;
}) {
  const { backendId, modelId, signal } = options;
  const resolvedBackend = resolveBackendOrThrow(backendId);

  const normalizedModelId = modelId.trim();
  if (!normalizedModelId) {
    throw new BackendError("Model is required.", 400);
  }

  if (resolvedBackend.kind === "plugin") {
    const cached = readCachedModelCapabilities(backendId, normalizedModelId);
    if (cached) return cached;

    const pluginModel =
      resolvedBackend.plugin.staticModels.find((model) => model.id === normalizedModelId) ??
      null;
    const capabilities =
      pluginModel?.capabilities ?? resolvedBackend.plugin.modelCapabilities ?? DEFAULT_MODEL_CAPABILITIES;
    upsertCachedModelCapabilities(backendId, normalizedModelId, capabilities);
    return capabilities;
  }

  const builtInBackendId = toBuiltInBackendId(backendId);
  const cached = readCachedModelCapabilities(backendId, normalizedModelId);
  if (cached) return cached;

  let resolved: ModelCapabilities | null = null;
  let firstError: unknown = null;

  try {
    resolved = await fetchSingleModelCapabilities(builtInBackendId, normalizedModelId, signal);
  } catch (error) {
    firstError = error;
    if (builtInBackendId === "openai" || builtInBackendId === "anthropic") {
      try {
        const listedModels = await listModelsForBackend(backendId);
        const fromList = listedModels.find((model) => model.id === normalizedModelId)?.capabilities;
        if (fromList) {
          resolved = fromList;
        }
      } catch {
        // Fall through to throw the original capability-fetch issue below.
      }
    }
  }

  if (!resolved) {
    if (firstError) {
      throw firstError;
    }
    resolved = await fetchSingleModelCapabilities(builtInBackendId, normalizedModelId, signal);
  }

  const probed = await maybeProbeModelCapabilities(
    builtInBackendId,
    normalizedModelId,
    resolved,
    signal
  );
  upsertCachedModelCapabilities(backendId, normalizedModelId, probed);
  return probed;
}

export async function streamChatFromBackend(options: {
  backendId: string;
  model: string;
  sessionKey?: string;
  messages: InputMessage[];
  settings?: ChatSettings;
  signal: AbortSignal;
}): Promise<ReadableStream<Uint8Array>> {
  const { backendId, model, sessionKey, messages, settings, signal } = options;
  const resolvedBackend = resolveBackendOrThrow(backendId);
  const builtInBackendId = resolvedBackend.kind === "built-in" ? resolvedBackend.backendId : null;

  const capabilities = getCapabilitiesForBackend(backendId);
  const normalizedSettings = normalizeSettings(settings);
  const stopSequences = capabilities.stopSequences
    ? parseStopSequences(normalizedSettings.stopSequences)
    : [];
  const systemPrompt = capabilities.systemPrompt ? normalizedSettings.systemPrompt : "";
  const cachedModelCapabilities = readCachedModelCapabilities(backendId, model);
  let modelCapabilities = cachedModelCapabilities ?? DEFAULT_MODEL_CAPABILITIES;
  if (!cachedModelCapabilities) {
    try {
      modelCapabilities = await getModelCapabilitiesForBackend({
        backendId,
        modelId: model,
        signal,
      });
    } catch {
      // Continue with conservative defaults when capability lookup fails.
    }
  }
  const attachmentMap = await resolveAttachmentsForMessages(messages);
  validateAttachmentConstraints(messages, modelCapabilities, attachmentMap);

  if (resolvedBackend.kind === "plugin") {
    const pluginMessages = buildPluginMessages(messages, systemPrompt, attachmentMap);
    const endpoint = resolveProviderUrl(resolvedBackend.plugin.baseUrl, resolvedBackend.plugin.chatPath);
    let response: Response;
    try {
      response = await fetchWithLocalhostFallback(endpoint, {
        method: "POST",
        cache: "no-store",
        signal,
        headers: {
          "Content-Type": "application/json",
          Accept:
            resolvedBackend.plugin.streamFormat === "ndjson"
              ? "application/x-ndjson"
              : "text/event-stream",
          ...(sessionKey ? { "x-session-key": sessionKey } : {}),
          ...resolvedBackend.plugin.headers,
        },
        body: JSON.stringify({
          model,
          stream: true,
          ...(sessionKey ? { sessionKey } : {}),
          messages: pluginMessages,
          settings: {
            ...normalizedSettings,
            stopSequences,
            systemPrompt,
          },
        }),
      });
    } catch (error) {
      throw new BackendError(
        `${resolvedBackend.plugin.name} proxy is unreachable.`,
        503,
        `Endpoint: ${endpoint}. ${normalizeErrorMessage(error)}`
      );
    }

    if (!response.ok) {
      const raw = await response.text();
      const status = Number.isFinite(response.status) && response.status >= 400 ? response.status : 502;
      throw new BackendError(
        `${resolvedBackend.plugin.name} chat request failed (${status}).`,
        status,
        raw.slice(0, 400)
      );
    }

    if (!response.body) {
      throw new BackendError(`${resolvedBackend.plugin.name} did not return a stream.`, 502);
    }

    return parseProviderStreamByFormat(response.body, resolvedBackend.plugin.streamFormat);
  }

  if (builtInBackendId === "ollama") {
    const baseUrl = resolveOllamaBaseUrl().replace(/\/$/, "");
    const seed = capabilities.seed ? parseOptionalInteger(normalizedSettings.seed) : undefined;

    const ollamaOptions: Record<string, unknown> = {};
    if (capabilities.temperature) ollamaOptions.temperature = normalizedSettings.temperature;
    if (capabilities.topP) ollamaOptions.top_p = normalizedSettings.topP;
    if (capabilities.topK) ollamaOptions.top_k = normalizedSettings.topK;
    if (capabilities.maxTokens) ollamaOptions.num_predict = normalizedSettings.maxTokens;
    if (capabilities.contextWindow) ollamaOptions.num_ctx = normalizedSettings.contextWindow;
    if (capabilities.repeatPenalty) ollamaOptions.repeat_penalty = normalizedSettings.repeatPenalty;
    if (stopSequences.length) ollamaOptions.stop = stopSequences;
    if (typeof seed === "number") ollamaOptions.seed = seed;

    const response = await fetch(`${baseUrl}/api/chat`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model,
        stream: true,
        format: capabilities.jsonMode && normalizedSettings.jsonMode ? "json" : undefined,
        keep_alive: capabilities.keepAlive ? normalizedSettings.keepAlive : undefined,
        messages: buildOllamaMessages(messages, systemPrompt, attachmentMap, modelCapabilities),
        options: ollamaOptions,
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new BackendError("Ollama chat request failed.", 502, raw.slice(0, 400));
    }

    if (!response.body) {
      throw new BackendError("Ollama did not return a stream.", 502);
    }

    return parseProviderStreamByFormat(response.body, "ndjson");
  }

  if (builtInBackendId === "openai") {
    const baseUrl = resolveOpenAIBaseUrl().replace(/\/$/, "");
    const includeUsage = /api\.openai\.com/i.test(baseUrl) || process.env.OPENAI_INCLUDE_USAGE === "true";
    const headers: Record<string, string> = {
      "Content-Type": "application/json",
    };

    if (process.env.OPENAI_API_KEY) {
      headers.Authorization = `Bearer ${process.env.OPENAI_API_KEY}`;
    }

    const seed = capabilities.seed ? parseOptionalInteger(normalizedSettings.seed) : undefined;
    const openAIMessages = await Promise.all(
      messages.map(async (message) => ({
        role: message.role,
        content: await buildOpenAIMessageContent(message, attachmentMap, modelCapabilities, signal),
      }))
    );

    const response = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      cache: "no-store",
      signal,
      headers,
      body: JSON.stringify({
        model,
        messages: [
          ...(systemPrompt.trim()
            ? [
                {
                  role: "system",
                  content: systemPrompt.trim(),
                },
              ]
            : []),
          ...openAIMessages,
        ],
        stream: true,
        stream_options: includeUsage
          ? {
              include_usage: true,
            }
          : undefined,
        temperature: capabilities.temperature ? normalizedSettings.temperature : undefined,
        top_p: capabilities.topP ? normalizedSettings.topP : undefined,
        max_tokens: capabilities.maxTokens ? normalizedSettings.maxTokens : undefined,
        stop: stopSequences.length ? stopSequences : undefined,
        seed,
        response_format:
          capabilities.jsonMode && normalizedSettings.jsonMode
            ? { type: "json_object" }
            : undefined,
      }),
    });

    if (!response.ok) {
      const raw = await response.text();
      throw new BackendError("OpenAI-compatible chat request failed.", 502, raw.slice(0, 400));
    }

    if (!response.body) {
      throw new BackendError("OpenAI-compatible backend did not return a stream.", 502);
    }

    return parseSSEStream(response.body, parseOpenAICompatibleSSEEvent);
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new BackendError("Anthropic API key is missing.", 400);
  }

  const baseUrl = resolveAnthropicBaseUrl().replace(/\/$/, "");
  const anthropicMessages = await Promise.all(
    messages.map(async (message) => ({
      role: message.role,
      content: await buildAnthropicMessageContent(message, attachmentMap, modelCapabilities, signal),
    }))
  );
  const response = await fetch(`${baseUrl}/messages`, {
    method: "POST",
    cache: "no-store",
    signal,
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": process.env.ANTHROPIC_VERSION || "2023-06-01",
    },
    body: JSON.stringify({
      model,
      stream: true,
      system: systemPrompt || undefined,
      max_tokens: capabilities.maxTokens
        ? normalizedSettings.maxTokens
        : Number(process.env.ANTHROPIC_MAX_TOKENS || 2048),
      temperature: capabilities.temperature ? normalizedSettings.temperature : undefined,
      top_p: capabilities.topP ? normalizedSettings.topP : undefined,
      top_k: capabilities.topK ? normalizedSettings.topK : undefined,
      stop_sequences: stopSequences.length ? stopSequences : undefined,
      messages: anthropicMessages,
    }),
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new BackendError("Anthropic chat request failed.", 502, raw.slice(0, 400));
  }

  if (!response.body) {
    throw new BackendError("Anthropic did not return a stream.", 502);
  }

  return parseSSEStream(response.body, (dataLine) => {
    const parsed = JSON.parse(dataLine) as {
      type?: string;
      error?: { message?: string };
      message?: {
        usage?: {
          input_tokens?: number;
          output_tokens?: number;
        };
      };
      usage?: {
        input_tokens?: number;
        output_tokens?: number;
      };
      delta?: { type?: string; text?: string; thinking?: string; content?: string };
      content_block?: { type?: string; text?: string; thinking?: string; content?: string };
    };

    if (parsed.type === "error" && parsed.error?.message) {
      throw new BackendError(parsed.error.message, 502);
    }

    const events: StreamEvent[] = [];

    if (parsed.type === "content_block_delta") {
      if (parsed.delta?.type === "text_delta" && parsed.delta.text) {
        events.push({
          message: {
            role: "assistant",
            content: parsed.delta.text,
          },
        });
      }

      const deltaType = typeof parsed.delta?.type === "string" ? parsed.delta.type.toLowerCase() : "";
      const thinkingChunk =
        (deltaType.includes("thinking") &&
        (parsed.delta?.thinking || parsed.delta?.text || parsed.delta?.content))
          ? (parsed.delta?.thinking || parsed.delta?.text || parsed.delta?.content || "")
          : "";
      if (thinkingChunk) {
        events.push({
          thinking: {
            content: thinkingChunk,
          },
        });
      }
    }

    if (parsed.type === "content_block_start") {
      const contentBlockType =
        typeof parsed.content_block?.type === "string" ? parsed.content_block.type.toLowerCase() : "";
      if (contentBlockType.includes("thinking")) {
        const thinkingChunk =
          parsed.content_block?.thinking || parsed.content_block?.text || parsed.content_block?.content || "";
        if (thinkingChunk) {
          events.push({
            thinking: {
              content: thinkingChunk,
            },
          });
        }
      }
    }

    const inputTokens =
      typeof parsed.message?.usage?.input_tokens === "number"
        ? parsed.message.usage.input_tokens
        : typeof parsed.usage?.input_tokens === "number"
          ? parsed.usage.input_tokens
          : undefined;
    const outputTokens =
      typeof parsed.message?.usage?.output_tokens === "number"
        ? parsed.message.usage.output_tokens
        : typeof parsed.usage?.output_tokens === "number"
          ? parsed.usage.output_tokens
          : undefined;

    if (typeof inputTokens === "number" || typeof outputTokens === "number") {
      events.push({
        usage: {
          promptTokens: inputTokens,
          completionTokens: outputTokens,
          totalTokens:
            typeof inputTokens === "number" || typeof outputTokens === "number"
              ? (inputTokens ?? 0) + (outputTokens ?? 0)
              : undefined,
        },
      });
    }

    if (parsed.type === "message_stop") {
      events.push({ done: true });
    }

    return events.length ? events : null;
  });
}

export function parseBackendError(error: unknown) {
  return parseError(error);
}
