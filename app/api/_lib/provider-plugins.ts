import { existsSync, mkdirSync, readFileSync, writeFileSync } from "fs";
import path from "path";
import type {
  BackendCapabilities,
  ModelCapabilities,
  ModelOption,
} from "../../../lib/types";

export type ProviderStreamFormat = "ndjson" | "sse-standard" | "openai";
export type ProviderModelsSource = "remote" | "static";

export type ProviderPlugin = {
  id: string;
  name: string;
  baseUrl: string;
  modelsPath: string;
  chatPath: string;
  modelsSource: ProviderModelsSource;
  staticModels: ModelOption[];
  headers: Record<string, string>;
  streamFormat: ProviderStreamFormat;
  capabilities: BackendCapabilities;
  modelCapabilities: ModelCapabilities;
  createdAt: number;
  updatedAt: number;
};

const PROVIDER_PLUGINS_ROOT = path.join(process.cwd(), ".standard-ui");
const PROVIDER_PLUGINS_FILE = path.join(PROVIDER_PLUGINS_ROOT, "provider-plugins.json");
const RESERVED_PROVIDER_IDS = new Set(["ollama", "openai", "anthropic"]);

const DEFAULT_PLUGIN_CAPABILITIES: BackendCapabilities = {
  systemPrompt: true,
  temperature: true,
  topP: true,
  topK: false,
  maxTokens: true,
  stopSequences: true,
  seed: false,
  jsonMode: false,
  contextWindow: false,
  repeatPenalty: false,
  keepAlive: false,
};

const DEFAULT_PLUGIN_MODEL_CAPABILITIES: ModelCapabilities = {
  textInput: true,
  imageInput: false,
  documentInput: false,
  audioInput: false,
  videoInput: false,
  binaryInput: false,
  maxAttachments: 8,
  maxAttachmentBytes: 20 * 1024 * 1024,
};

type ProviderPluginRecord = ProviderPlugin;
type ProviderPluginInput = {
  id?: unknown;
  name?: unknown;
  baseUrl?: unknown;
  modelsPath?: unknown;
  chatPath?: unknown;
  modelsSource?: unknown;
  staticModels?: unknown;
  headers?: unknown;
  streamFormat?: unknown;
  capabilities?: unknown;
  modelCapabilities?: unknown;
  createdAt?: unknown;
  updatedAt?: unknown;
};

function toProviderId(input: string) {
  return input
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9_-]+/g, "-")
    .replace(/-+/g, "-")
    .replace(/^[-_]+|[-_]+$/g, "")
    .slice(0, 48);
}

function normalizeBaseUrl(candidate: unknown) {
  const raw = typeof candidate === "string" ? candidate.trim() : "";
  if (!raw) {
    throw new Error("Base URL is required.");
  }

  let parsed: URL;
  try {
    parsed = new URL(raw);
  } catch {
    throw new Error("Base URL must be a valid absolute URL.");
  }

  if (parsed.protocol !== "http:" && parsed.protocol !== "https:") {
    throw new Error("Base URL must start with http:// or https://");
  }

  const normalizedPath = parsed.pathname.replace(/\/+$/, "");
  return `${parsed.origin}${normalizedPath}` || parsed.origin;
}

function normalizeEndpointPath(candidate: unknown, fallback: string) {
  const raw = typeof candidate === "string" ? candidate.trim() : "";
  if (!raw) return fallback;
  if (raw.startsWith("http://") || raw.startsWith("https://")) return raw;
  return `/${raw.replace(/^\/+/, "")}`;
}

function readBoolean(candidate: unknown, fallback: boolean) {
  return typeof candidate === "boolean" ? candidate : fallback;
}

function asRecord(candidate: unknown) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return null;
  return candidate as Record<string, unknown>;
}

function normalizeBackendCapabilities(candidate: unknown): BackendCapabilities {
  const record = asRecord(candidate);
  return {
    systemPrompt: readBoolean(record?.systemPrompt, DEFAULT_PLUGIN_CAPABILITIES.systemPrompt),
    temperature: readBoolean(record?.temperature, DEFAULT_PLUGIN_CAPABILITIES.temperature),
    topP: readBoolean(record?.topP, DEFAULT_PLUGIN_CAPABILITIES.topP),
    topK: readBoolean(record?.topK, DEFAULT_PLUGIN_CAPABILITIES.topK),
    maxTokens: readBoolean(record?.maxTokens, DEFAULT_PLUGIN_CAPABILITIES.maxTokens),
    stopSequences: readBoolean(record?.stopSequences, DEFAULT_PLUGIN_CAPABILITIES.stopSequences),
    seed: readBoolean(record?.seed, DEFAULT_PLUGIN_CAPABILITIES.seed),
    jsonMode: readBoolean(record?.jsonMode, DEFAULT_PLUGIN_CAPABILITIES.jsonMode),
    contextWindow: readBoolean(record?.contextWindow, DEFAULT_PLUGIN_CAPABILITIES.contextWindow),
    repeatPenalty: readBoolean(record?.repeatPenalty, DEFAULT_PLUGIN_CAPABILITIES.repeatPenalty),
    keepAlive: readBoolean(record?.keepAlive, DEFAULT_PLUGIN_CAPABILITIES.keepAlive),
  };
}

function readPositiveInteger(candidate: unknown, fallback: number) {
  if (typeof candidate !== "number" || !Number.isFinite(candidate)) return fallback;
  return Math.max(1, Math.round(candidate));
}

function normalizeModelCapabilities(candidate: unknown): ModelCapabilities {
  const record = asRecord(candidate);
  return {
    textInput: readBoolean(record?.textInput, DEFAULT_PLUGIN_MODEL_CAPABILITIES.textInput),
    imageInput: readBoolean(record?.imageInput, DEFAULT_PLUGIN_MODEL_CAPABILITIES.imageInput),
    documentInput: readBoolean(record?.documentInput, DEFAULT_PLUGIN_MODEL_CAPABILITIES.documentInput),
    audioInput: readBoolean(record?.audioInput, DEFAULT_PLUGIN_MODEL_CAPABILITIES.audioInput),
    videoInput: readBoolean(record?.videoInput, DEFAULT_PLUGIN_MODEL_CAPABILITIES.videoInput),
    binaryInput: readBoolean(record?.binaryInput, DEFAULT_PLUGIN_MODEL_CAPABILITIES.binaryInput),
    maxAttachments: readPositiveInteger(
      record?.maxAttachments,
      DEFAULT_PLUGIN_MODEL_CAPABILITIES.maxAttachments
    ),
    maxAttachmentBytes: readPositiveInteger(
      record?.maxAttachmentBytes,
      DEFAULT_PLUGIN_MODEL_CAPABILITIES.maxAttachmentBytes
    ),
  };
}

function normalizeHeaders(candidate: unknown) {
  const record = asRecord(candidate);
  if (!record) return {};

  const headers: Record<string, string> = {};
  for (const [key, value] of Object.entries(record)) {
    if (typeof value !== "string") continue;
    const normalizedKey = key.trim();
    const normalizedValue = value.trim();
    if (!normalizedKey || !normalizedValue) continue;
    headers[normalizedKey] = normalizedValue;
  }
  return headers;
}

function normalizeStaticModels(candidate: unknown, fallbackCapabilities: ModelCapabilities) {
  if (!Array.isArray(candidate)) return [];
  const deduped = new Map<string, ModelOption>();

  for (const entry of candidate) {
    if (typeof entry === "string") {
      const id = entry.trim();
      if (!id) continue;
      deduped.set(id, {
        id,
        capabilities: fallbackCapabilities,
      });
      continue;
    }

    const record = asRecord(entry);
    if (!record) continue;
    const id = typeof record.id === "string" ? record.id.trim() : "";
    if (!id) continue;
    const meta = typeof record.meta === "string" ? record.meta : undefined;
    deduped.set(id, {
      id,
      meta,
      capabilities: normalizeModelCapabilities(record.capabilities ?? fallbackCapabilities),
    });
  }

  return Array.from(deduped.values());
}

function normalizeStreamFormat(candidate: unknown): ProviderStreamFormat {
  if (candidate === "ndjson" || candidate === "sse-standard" || candidate === "openai") {
    return candidate;
  }
  return "ndjson";
}

function normalizeModelsSource(candidate: unknown, staticModels: ModelOption[]): ProviderModelsSource {
  if (candidate === "remote" || candidate === "static") {
    return candidate;
  }
  return staticModels.length ? "static" : "remote";
}

function readPluginsFile() {
  if (!existsSync(PROVIDER_PLUGINS_FILE)) {
    return [] as ProviderPluginRecord[];
  }

  try {
    const raw = readFileSync(PROVIDER_PLUGINS_FILE, "utf8");
    const parsed = JSON.parse(raw) as { providers?: unknown };
    if (!Array.isArray(parsed.providers)) {
      return [] as ProviderPluginRecord[];
    }
    return parsed.providers
      .map((entry) => {
        const record = asRecord(entry);
        if (!record) return null;
        try {
          return normalizePluginRecord(record, {
            preserveTimestamps: true,
          });
        } catch {
          return null;
        }
      })
      .filter((plugin): plugin is ProviderPluginRecord => Boolean(plugin));
  } catch {
    return [] as ProviderPluginRecord[];
  }
}

function writePluginsFile(providers: ProviderPluginRecord[]) {
  mkdirSync(PROVIDER_PLUGINS_ROOT, { recursive: true });
  writeFileSync(
    PROVIDER_PLUGINS_FILE,
    `${JSON.stringify({ version: 1, providers }, null, 2)}\n`,
    "utf8"
  );
}

function normalizePluginRecord(
  input: ProviderPluginInput,
  options?: {
    existing?: ProviderPluginRecord | null;
    preserveTimestamps?: boolean;
  }
): ProviderPluginRecord {
  const existing = options?.existing ?? null;
  const rawName = typeof input.name === "string" ? input.name.trim() : "";
  if (!rawName) {
    throw new Error("Provider name is required.");
  }

  const requestedId =
    typeof input.id === "string" && input.id.trim()
      ? input.id.trim()
      : existing?.id || rawName;
  const id = toProviderId(requestedId);
  if (!id) {
    throw new Error("Provider ID is invalid.");
  }
  if (RESERVED_PROVIDER_IDS.has(id)) {
    throw new Error(`"${id}" is reserved and cannot be used as a custom provider ID.`);
  }

  const baseUrl = normalizeBaseUrl(input.baseUrl ?? existing?.baseUrl);
  const modelCapabilities = normalizeModelCapabilities(
    input.modelCapabilities ?? existing?.modelCapabilities
  );
  const staticModels = normalizeStaticModels(input.staticModels ?? existing?.staticModels, modelCapabilities);
  const modelsSource = normalizeModelsSource(input.modelsSource ?? existing?.modelsSource, staticModels);
  const now = Date.now();

  return {
    id,
    name: rawName,
    baseUrl,
    modelsPath: normalizeEndpointPath(input.modelsPath ?? existing?.modelsPath, "/models"),
    chatPath: normalizeEndpointPath(input.chatPath ?? existing?.chatPath, "/chat/stream"),
    modelsSource,
    staticModels,
    headers: normalizeHeaders(input.headers ?? existing?.headers),
    streamFormat: normalizeStreamFormat(input.streamFormat ?? existing?.streamFormat),
    capabilities: normalizeBackendCapabilities(input.capabilities ?? existing?.capabilities),
    modelCapabilities,
    createdAt:
      options?.preserveTimestamps && typeof input.createdAt === "number"
        ? input.createdAt
        : existing?.createdAt ?? now,
    updatedAt:
      options?.preserveTimestamps && typeof input.updatedAt === "number"
        ? input.updatedAt
        : now,
  };
}

export function resolveProviderUrl(baseUrl: string, endpointPath: string) {
  const trimmedPath = endpointPath.trim();
  if (!trimmedPath) return baseUrl;
  if (trimmedPath.startsWith("http://") || trimmedPath.startsWith("https://")) {
    return trimmedPath;
  }

  const normalizedBase = baseUrl.replace(/\/+$/, "");
  const normalizedPath = `/${trimmedPath.replace(/^\/+/, "")}`;
  return `${normalizedBase}${normalizedPath}`;
}

export function listProviderPlugins() {
  return readPluginsFile()
    .slice()
    .sort((left, right) => left.name.localeCompare(right.name));
}

export function getProviderPluginById(id: string) {
  const normalizedId = toProviderId(id);
  if (!normalizedId) return null;
  return listProviderPlugins().find((plugin) => plugin.id === normalizedId) ?? null;
}

export function upsertProviderPlugin(input: ProviderPluginInput) {
  const providers = readPluginsFile();
  const normalizedId = toProviderId(typeof input.id === "string" ? input.id : "");
  const existing =
    providers.find((provider) => provider.id === normalizedId) ??
    providers.find((provider) => provider.name === input.name) ??
    null;
  const normalized = normalizePluginRecord(input, { existing });

  const duplicate = providers.find(
    (provider) => provider.id === normalized.id && provider.id !== existing?.id
  );
  if (duplicate) {
    throw new Error(`A provider with ID "${normalized.id}" already exists.`);
  }

  const nextProviders = providers.filter((provider) => provider.id !== normalized.id);
  nextProviders.push(normalized);
  writePluginsFile(nextProviders);
  return normalized;
}

export function deleteProviderPlugin(id: string) {
  const normalizedId = toProviderId(id);
  if (!normalizedId) return false;

  const providers = readPluginsFile();
  const nextProviders = providers.filter((provider) => provider.id !== normalizedId);
  if (nextProviders.length === providers.length) {
    return false;
  }

  writePluginsFile(nextProviders);
  return true;
}
