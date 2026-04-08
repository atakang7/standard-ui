import type { ChatAttachment, ChatSettings, ChatThread, AppearanceMode } from "./types";
import {
  APPEARANCE_COOKIE_MAX_AGE_SECONDS,
  APPEARANCE_MODE_KEY,
  DEFAULT_APPEARANCE_MODE,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_STREAM_READABILITY_PACE,
  STREAM_READABILITY_PACE_KEY,
} from "./constants";
import { normalizeAttachments, normalizeChatSettings } from "./utils";

export function createId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

export function createThread(backend = "", model = ""): ChatThread {
  const now = Date.now();
  return {
    id: createId(),
    title: "New chat",
    createdAt: now,
    updatedAt: now,
    backend,
    model,
    messages: [],
  };
}

export function normalizeAppearanceMode(candidate: string | null): AppearanceMode {
  return candidate === "light" || candidate === "dark" || candidate === "system"
    ? candidate
    : DEFAULT_APPEARANCE_MODE;
}

export function resolveAppearanceMode(mode: AppearanceMode, prefersDark: boolean) {
  if (mode === "system") {
    return prefersDark ? "dark" : "light";
  }
  return mode;
}

export function readStoredAppearanceMode(): AppearanceMode {
  if (typeof window === "undefined") return DEFAULT_APPEARANCE_MODE;
  const rawMode = window.localStorage.getItem(APPEARANCE_MODE_KEY);
  const nextMode = normalizeAppearanceMode(rawMode);

  if (rawMode !== nextMode) {
    window.localStorage.setItem(APPEARANCE_MODE_KEY, nextMode);
  }

  return nextMode;
}

export function persistAppearanceMode(mode: AppearanceMode) {
  if (typeof window !== "undefined") {
    window.localStorage.setItem(APPEARANCE_MODE_KEY, mode);
  }
  if (typeof document !== "undefined") {
    document.cookie = `${APPEARANCE_MODE_KEY}=${mode}; Path=/; Max-Age=${APPEARANCE_COOKIE_MAX_AGE_SECONDS}; SameSite=Lax`;
  }
}

export function normalizeStreamReadabilityPace(candidate: unknown) {
  const parsed =
    typeof candidate === "number"
      ? candidate
      : typeof candidate === "string"
        ? Number(candidate)
        : Number.NaN;
  if (!Number.isFinite(parsed)) return DEFAULT_STREAM_READABILITY_PACE;
  return Math.min(1.1, Math.max(0.45, parsed));
}

export function readStoredStreamReadabilityPace() {
  if (typeof window === "undefined") return DEFAULT_STREAM_READABILITY_PACE;
  const raw = window.localStorage.getItem(STREAM_READABILITY_PACE_KEY);
  const next = normalizeStreamReadabilityPace(raw);
  if (raw !== String(next)) {
    window.localStorage.setItem(STREAM_READABILITY_PACE_KEY, String(next));
  }
  return next;
}

export function persistStreamReadabilityPace(value: number) {
  if (typeof window === "undefined") return;
  const normalized = normalizeStreamReadabilityPace(value);
  window.localStorage.setItem(STREAM_READABILITY_PACE_KEY, String(normalized));
}

export function settingsMapFromRaw(raw: string | null): Record<string, ChatSettings> {
  if (!raw) return {};

  try {
    const parsed = JSON.parse(raw) as Record<string, Partial<ChatSettings>>;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<Record<string, ChatSettings>>((acc, [backendId, settings]) => {
      if (!settings || typeof settings !== "object") return acc;
      acc[backendId] = normalizeChatSettings(settings);
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function modelStorageMapFromRaw(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === "string" && value.trim()) {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function draftsMapFromRaw(raw: string | null): Record<string, string> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, string>;
    if (!parsed || typeof parsed !== "object") return {};
    return Object.entries(parsed).reduce<Record<string, string>>((acc, [key, value]) => {
      if (typeof value === "string") {
        acc[key] = value;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}

export function attachmentDraftsMapFromRaw(raw: string | null): Record<string, ChatAttachment[]> {
  if (!raw) return {};
  try {
    const parsed = JSON.parse(raw) as Record<string, unknown>;
    if (!parsed || typeof parsed !== "object") return {};

    return Object.entries(parsed).reduce<Record<string, ChatAttachment[]>>((acc, [threadId, value]) => {
      const normalized = normalizeAttachments(value);
      if (normalized.length) {
        acc[threadId] = normalized;
      }
      return acc;
    }, {});
  } catch {
    return {};
  }
}
