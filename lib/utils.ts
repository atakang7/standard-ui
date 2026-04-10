import type {
  ChatArtifact,
  ChatAttachment,
  ChatMessageMetrics,
  ChatSettings,
  ContentSegment,
  ModelCapabilities,
  ModelOption,
  RequestMessage,
  UiError,
  UiErrorContext,
  UiErrorScope,
} from "./types";
import {
  DEFAULT_CHAT_SETTINGS,
  LEGACY_DEFAULT_CONTEXT_WINDOW,
  DEFAULT_MODEL_CAPABILITIES,
  REQUEST_HARD_CHAR_LIMIT,
  REQUEST_MAX_MESSAGES,
  REQUEST_MAX_SINGLE_MESSAGE_CHARS,
  REQUEST_MESSAGE_TOKEN_OVERHEAD,
  REQUEST_MIN_PROMPT_BUDGET_TOKENS,
} from "./constants";

// ─── Formatting ───────────────────────────────────────────────────────────────

export function formatBytes(value: number) {
  if (!Number.isFinite(value) || value <= 0) return "0 B";
  const units = ["B", "KB", "MB", "GB"];
  let amount = value;
  let unit = 0;
  while (amount >= 1024 && unit < units.length - 1) {
    amount /= 1024;
    unit += 1;
  }
  const rounded = amount >= 10 || unit === 0 ? Math.round(amount) : Math.round(amount * 10) / 10;
  return `${rounded} ${units[unit]}`;
}

export function buildThreadTitle(input: string) {
  const plain = input.replace(/\s+/g, " ").trim();
  if (!plain) return "New chat";
  return plain.length > 48 ? `${plain.slice(0, 48)}...` : plain;
}

export function formatThreadPreview(messages: { role: string; content: string }[]) {
  if (!messages.length) return "No messages yet";
  const last = messages[messages.length - 1];
  const singleLine = last.content.replace(/\s+/g, " ").trim();
  if (!singleLine) return last.role === "assistant" ? "Assistant replied" : "You sent a message";
  return singleLine.length > 64 ? `${singleLine.slice(0, 64)}...` : singleLine;
}

// ─── Math ─────────────────────────────────────────────────────────────────────

export function clamp(value: number, min: number, max: number) {
  return Math.min(max, Math.max(min, value));
}

export function countLines(content: string) {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

// ─── Error handling ───────────────────────────────────────────────────────────

export function normalizeErrorMessage(error: unknown, fallback: string) {
  if (error instanceof Error && error.message.trim()) return error.message.trim();
  if (typeof error === "string" && error.trim()) return error.trim();
  return fallback;
}

export function extractStatusCode(message: string) {
  const match = message.match(/\((\d{3})\)/);
  if (!match) return null;
  const parsed = Number(match[1]);
  return Number.isFinite(parsed) ? parsed : null;
}

export function createFriendlyUiError(
  scope: UiErrorScope,
  error: unknown,
  context?: UiErrorContext
): UiError {
  const providerLabel = context?.providerLabel || "the selected provider";
  const raw = normalizeErrorMessage(
    error,
    scope === "chat" ? "We couldn't generate a response." : "We couldn't load provider data."
  );
  const lowered = raw.toLowerCase();
  const statusCode = extractStatusCode(raw);

  if (scope === "models") {
    if (lowered.includes("no llm backends are configured") || lowered.includes("no backends")) {
      return {
        scope,
        title: "No providers configured",
        message: "Add at least one provider connection to start loading models.",
      };
    }
    if (lowered.includes("no models found")) {
      return {
        scope,
        title: "No models available",
        message: `No models were returned by ${providerLabel}. Check provider availability and try again.`,
      };
    }
    if (statusCode === 401 || statusCode === 403 || lowered.includes("unauthorized") || lowered.includes("api key")) {
      return {
        scope,
        title: "Provider authentication issue",
        message: `We couldn't authenticate with ${providerLabel}. Verify credentials and retry.`,
      };
    }
    if (statusCode === 429 || lowered.includes("rate limit")) {
      return {
        scope,
        title: "Rate limit reached",
        message: `${providerLabel} is rate limiting requests. Please wait a moment and try again.`,
      };
    }
    if (lowered.includes("failed to fetch") || lowered.includes("network") || lowered.includes("refused")) {
      return {
        scope,
        title: "Connection issue",
        message: `We couldn't reach ${providerLabel} to refresh models. Check connectivity and retry.`,
      };
    }
    return {
      scope,
      title: "Couldn't refresh models",
      message: `We couldn't load the latest models from ${providerLabel}. Please try again.`,
    };
  }

  if (statusCode === 401 || statusCode === 403 || lowered.includes("unauthorized") || lowered.includes("api key")) {
    return {
      scope,
      title: "Provider authentication issue",
      message: `Your request was rejected by ${providerLabel}. Verify credentials and retry.`,
    };
  }
  if (statusCode === 429 || lowered.includes("rate limit")) {
    return {
      scope,
      title: "Rate limit reached",
      message: `${providerLabel} is currently rate limiting requests. Please try again in a moment.`,
    };
  }
  if (lowered.includes("streaming is unavailable")) {
    return {
      scope,
      title: "Streaming not supported",
      message: "This browser session couldn't stream responses. Refresh the page and try again.",
    };
  }
  if (lowered.includes("failed to fetch") || lowered.includes("network") || lowered.includes("refused")) {
    return {
      scope,
      title: "Connection issue",
      message: `We couldn't reach ${providerLabel}. Please check connectivity and retry your message.`,
    };
  }
  return {
    scope,
    title: "Couldn't generate response",
    message: "Your request didn't complete. Please try again.",
  };
}

// ─── Token estimation ─────────────────────────────────────────────────────────

export function estimateTokensFromText(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.round(normalized.length / 4));
}

// ─── Context window / request building ───────────────────────────────────────

export function clipToTail(text: string, maxChars: number) {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

export function buildBoundedRequestMessages(messages: RequestMessage[], settings: ChatSettings) {
  const normalizedMessages = messages
    .map((message) => ({
      role: message.role,
      content: clipToTail(message.content.trim(), REQUEST_MAX_SINGLE_MESSAGE_CHARS),
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
    }))
    .filter((message) => message.content.length > 0 || message.attachments.length > 0);

  if (!normalizedMessages.length) return [];

  const normalizedContextWindow = Math.max(
    256,
    Math.round(Number(settings.contextWindow || DEFAULT_CHAT_SETTINGS.contextWindow))
  );
  const contextWindow =
    normalizedContextWindow === LEGACY_DEFAULT_CONTEXT_WINDOW
      ? DEFAULT_CHAT_SETTINGS.contextWindow
      : normalizedContextWindow;
  const completionReserve = Math.max(
    256,
    Math.min(
      Math.round(Number(settings.maxTokens || DEFAULT_CHAT_SETTINGS.maxTokens)),
      Math.floor(contextWindow * 0.45)
    )
  );
  const promptTokenBudget = Math.max(REQUEST_MIN_PROMPT_BUDGET_TOKENS, contextWindow - completionReserve);

  const latestToOldest: RequestMessage[] = [];
  let usedTokens = 0;

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const message = normalizedMessages[index];
    const messageTokens = estimateTokensFromText(message.content) + REQUEST_MESSAGE_TOKEN_OVERHEAD;

    if (!latestToOldest.length) {
      const latestTokenBudget = Math.max(REQUEST_MIN_PROMPT_BUDGET_TOKENS, promptTokenBudget - REQUEST_MESSAGE_TOKEN_OVERHEAD);
      const latestContent =
        messageTokens > promptTokenBudget
          ? clipToTail(message.content, latestTokenBudget * 4)
          : message.content;
      if (!latestContent.trim() && message.attachments.length === 0) continue;

      latestToOldest.push({ role: message.role, content: latestContent, attachments: message.attachments });
      usedTokens += estimateTokensFromText(latestContent) + REQUEST_MESSAGE_TOKEN_OVERHEAD;
      continue;
    }

    if (latestToOldest.length >= REQUEST_MAX_MESSAGES) break;
    if (usedTokens + messageTokens > promptTokenBudget) break;

    latestToOldest.push({ role: message.role, content: message.content, attachments: message.attachments });
    usedTokens += messageTokens;
  }

  const tokenBounded = latestToOldest.reverse();
  let remainingChars = REQUEST_HARD_CHAR_LIMIT;
  const charBoundedLatestToOldest: RequestMessage[] = [];

  for (let index = tokenBounded.length - 1; index >= 0; index -= 1) {
    const message = tokenBounded[index];
    const isLatest = charBoundedLatestToOldest.length === 0;
    if (remainingChars <= 0) break;

    if (message.content.length <= remainingChars) {
      charBoundedLatestToOldest.push({ role: message.role, content: message.content, attachments: message.attachments });
      remainingChars -= message.content.length;
      continue;
    }

    if (!isLatest) break;

    const clippedLatest = clipToTail(message.content, remainingChars);
    if (!clippedLatest.trim() && (message.attachments?.length ?? 0) === 0) break;

    charBoundedLatestToOldest.push({ role: message.role, content: clippedLatest, attachments: message.attachments });
    remainingChars = 0;
  }

  return charBoundedLatestToOldest.reverse();
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export function supportsAttachmentKind(kind: ChatAttachment["kind"], capabilities: ModelCapabilities) {
  if (kind === "image") return capabilities.imageInput;
  if (kind === "document") return capabilities.documentInput;
  if (kind === "audio") return capabilities.audioInput;
  if (kind === "video") return capabilities.videoInput;
  if (kind === "text") return capabilities.textInput;
  return capabilities.binaryInput;
}

export function normalizeAttachment(candidate: unknown): ChatAttachment | null {
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  const kind = raw.kind;
  if (kind !== "image" && kind !== "document" && kind !== "audio" && kind !== "video" && kind !== "text" && kind !== "binary") {
    return null;
  }

  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const name = typeof raw.name === "string" ? raw.name.trim() : "";
  const mimeType = typeof raw.mimeType === "string" ? raw.mimeType.trim().toLowerCase() : "";
  const sizeBytes =
    typeof raw.sizeBytes === "number" && Number.isFinite(raw.sizeBytes)
      ? Math.max(0, Math.round(raw.sizeBytes))
      : 0;

  if (!id || !name || !mimeType) return null;

  return {
    id,
    name,
    mimeType,
    sizeBytes,
    kind,
    textPreview:
      typeof raw.textPreview === "string" && raw.textPreview.trim()
        ? raw.textPreview.slice(0, 6000)
        : undefined,
  };
}

export function normalizeAttachments(candidate: unknown): ChatAttachment[] {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => normalizeAttachment(item))
    .filter((a): a is ChatAttachment => Boolean(a));
}

export function areAttachmentsEqual(left: ChatAttachment[], right: ChatAttachment[]) {
  if (left === right) return true;
  if (left.length !== right.length) return false;
  for (let i = 0; i < left.length; i += 1) {
    const lhs = left[i];
    const rhs = right[i];
    if (lhs.id !== rhs.id || lhs.name !== rhs.name || lhs.mimeType !== rhs.mimeType || lhs.sizeBytes !== rhs.sizeBytes || lhs.kind !== rhs.kind || lhs.textPreview !== rhs.textPreview) {
      return false;
    }
  }
  return true;
}

// ─── Artifacts ────────────────────────────────────────────────────────────────

export function normalizeArtifact(candidate: unknown): ChatArtifact | null {
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  const source =
    raw.source === "auto-code-bundle" || raw.source === "auto-text-bundle" ? raw.source : undefined;
  const title = typeof raw.title === "string" ? raw.title.trim() : "";
  const mimeType = typeof raw.mimeType === "string" ? raw.mimeType.trim().toLowerCase() : "";
  const content = typeof raw.content === "string" ? raw.content : "";
  if (!id || !title || !mimeType || !content) return null;

  const sizeBytes =
    typeof raw.sizeBytes === "number" && Number.isFinite(raw.sizeBytes)
      ? Math.max(1, Math.round(raw.sizeBytes))
      : Math.max(1, new TextEncoder().encode(content).length);
  const createdAt =
    typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt) ? raw.createdAt : Date.now();
  const preview =
    typeof raw.preview === "string" && raw.preview.trim() ? raw.preview.slice(0, 480) : undefined;
  const language =
    typeof raw.language === "string" && raw.language.trim()
      ? raw.language.trim().toLowerCase().slice(0, 48)
      : undefined;
  const lineCount =
    typeof raw.lineCount === "number" && Number.isFinite(raw.lineCount)
      ? Math.max(0, Math.round(raw.lineCount))
      : content.split(/\r?\n/).length;
  const charCount =
    typeof raw.charCount === "number" && Number.isFinite(raw.charCount)
      ? Math.max(0, Math.round(raw.charCount))
      : content.length;

  return { id, source, title, mimeType, sizeBytes, createdAt, content, preview, language, lineCount, charCount };
}

export function normalizeArtifacts(candidate: unknown): ChatArtifact[] {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((item) => normalizeArtifact(item))
    .filter((a): a is ChatArtifact => Boolean(a));
}

// ─── Models ───────────────────────────────────────────────────────────────────

export function modelCapabilitiesFromUnknown(candidate: unknown): ModelCapabilities | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const raw = candidate as Record<string, unknown>;

  if (
    typeof raw.textInput !== "boolean" ||
    typeof raw.imageInput !== "boolean" ||
    typeof raw.documentInput !== "boolean" ||
    typeof raw.audioInput !== "boolean" ||
    typeof raw.videoInput !== "boolean" ||
    typeof raw.binaryInput !== "boolean"
  ) {
    return undefined;
  }

  const maxAttachments =
    typeof raw.maxAttachments === "number" && Number.isFinite(raw.maxAttachments)
      ? Math.max(1, Math.round(raw.maxAttachments))
      : DEFAULT_MODEL_CAPABILITIES.maxAttachments;
  const maxAttachmentBytes =
    typeof raw.maxAttachmentBytes === "number" && Number.isFinite(raw.maxAttachmentBytes)
      ? Math.max(1, Math.round(raw.maxAttachmentBytes))
      : DEFAULT_MODEL_CAPABILITIES.maxAttachmentBytes;

  return {
    textInput: raw.textInput,
    imageInput: raw.imageInput,
    documentInput: raw.documentInput,
    audioInput: raw.audioInput,
    videoInput: raw.videoInput,
    binaryInput: raw.binaryInput,
    maxAttachments,
    maxAttachmentBytes,
  };
}

export function normalizeModelOption(candidate: unknown): ModelOption | null {
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  const id = typeof raw.id === "string" ? raw.id.trim() : "";
  if (!id) return null;
  const capabilities = modelCapabilitiesFromUnknown(raw.capabilities) ?? DEFAULT_MODEL_CAPABILITIES;
  return { id, meta: typeof raw.meta === "string" ? raw.meta : undefined, capabilities };
}

export function normalizeModelOptions(candidate: unknown): ModelOption[] {
  if (!Array.isArray(candidate)) return [];
  return candidate
    .map((entry) => normalizeModelOption(entry))
    .filter((m): m is ModelOption => Boolean(m));
}

// ─── Message metrics ──────────────────────────────────────────────────────────

export function normalizeMessageMetrics(candidate: unknown): ChatMessageMetrics | undefined {
  if (!candidate || typeof candidate !== "object") return undefined;
  const raw = candidate as Record<string, unknown>;
  if (typeof raw.startedAt !== "number" || !Number.isFinite(raw.startedAt)) return undefined;

  return {
    startedAt: raw.startedAt,
    firstTokenAt: typeof raw.firstTokenAt === "number" ? raw.firstTokenAt : undefined,
    completedAt: typeof raw.completedAt === "number" ? raw.completedAt : undefined,
    latencyMs: typeof raw.latencyMs === "number" ? raw.latencyMs : undefined,
    timeToFirstTokenMs: typeof raw.timeToFirstTokenMs === "number" ? raw.timeToFirstTokenMs : undefined,
    promptTokens: typeof raw.promptTokens === "number" ? raw.promptTokens : undefined,
    completionTokens: typeof raw.completionTokens === "number" ? raw.completionTokens : undefined,
    totalTokens: typeof raw.totalTokens === "number" ? raw.totalTokens : undefined,
    estimatedTokens: typeof raw.estimatedTokens === "number" ? raw.estimatedTokens : undefined,
    tokensPerSecond: typeof raw.tokensPerSecond === "number" ? raw.tokensPerSecond : undefined,
    tokenSource:
      raw.tokenSource === "provider" || raw.tokenSource === "estimate" ? raw.tokenSource : undefined,
    providerId: typeof raw.providerId === "string" ? raw.providerId : undefined,
    modelId: typeof raw.modelId === "string" ? raw.modelId : undefined,
  };
}

// ─── Settings normalization ───────────────────────────────────────────────────

export function normalizeChatSettings(candidate?: Partial<ChatSettings>): ChatSettings {
  const merged = { ...DEFAULT_CHAT_SETTINGS, ...(candidate ?? {}) };
  const normalizedContextWindow = Math.max(
    256,
    Math.round(Number(merged.contextWindow ?? DEFAULT_CHAT_SETTINGS.contextWindow))
  );
  return {
    systemPrompt: merged.systemPrompt ?? "",
    temperature: clamp(Number(merged.temperature ?? DEFAULT_CHAT_SETTINGS.temperature), 0, 2),
    topP: clamp(Number(merged.topP ?? DEFAULT_CHAT_SETTINGS.topP), 0, 1),
    topK: Math.max(1, Math.round(Number(merged.topK ?? DEFAULT_CHAT_SETTINGS.topK))),
    maxTokens: Math.max(1, Math.round(Number(merged.maxTokens ?? DEFAULT_CHAT_SETTINGS.maxTokens))),
    stopSequences: merged.stopSequences ?? "",
    seed: merged.seed ?? "",
    jsonMode: Boolean(merged.jsonMode),
    contextWindow:
      normalizedContextWindow === LEGACY_DEFAULT_CONTEXT_WINDOW
        ? DEFAULT_CHAT_SETTINGS.contextWindow
        : normalizedContextWindow,
    repeatPenalty: clamp(Number(merged.repeatPenalty ?? DEFAULT_CHAT_SETTINGS.repeatPenalty), 0.5, 2),
    keepAlive: (merged.keepAlive ?? "").trim() || DEFAULT_CHAT_SETTINGS.keepAlive,
  };
}

// ─── Content parsing ──────────────────────────────────────────────────────────

export function splitByCodeBlocks(content: string): ContentSegment[] {
  const segments: ContentSegment[] = [];
  if (!content) return segments;

  function normalizeLanguage(raw: string) {
    if (!raw) return "";
    const firstToken = raw.split(/\s+/)[0] ?? "";
    return firstToken.toLowerCase().replace(/[^a-z0-9_+-]/g, "");
  }

  function findFenceAtLineStart(start: number) {
    let index = content.indexOf("```", start);
    while (index >= 0) {
      if (index === 0 || content[index - 1] === "\n") return index;
      index = content.indexOf("```", index + 3);
    }
    return -1;
  }

  let cursor = 0;

  while (cursor < content.length) {
    const fenceStart = findFenceAtLineStart(cursor);
    if (fenceStart < 0) {
      segments.push({ type: "text", value: content.slice(cursor) });
      break;
    }

    if (fenceStart > cursor) {
      segments.push({ type: "text", value: content.slice(cursor, fenceStart) });
    }

    const openingLineEnd = content.indexOf("\n", fenceStart + 3);
    if (openingLineEnd < 0) {
      segments.push({
        type: "code",
        language: normalizeLanguage(content.slice(fenceStart + 3).trim()),
        value: "",
        isUnterminated: true,
      });
      return segments;
    }

    const language = normalizeLanguage(content.slice(fenceStart + 3, openingLineEnd).trim());
    const codeStart = openingLineEnd + 1;
    const fenceClose = findFenceAtLineStart(codeStart);

    if (fenceClose < 0) {
      segments.push({ type: "code", language, value: content.slice(codeStart).replace(/\n$/, ""), isUnterminated: true });
      return segments;
    }

    segments.push({ type: "code", language, value: content.slice(codeStart, fenceClose).replace(/\n$/, ""), isUnterminated: false });

    const closingLineEnd = content.indexOf("\n", fenceClose + 3);
    cursor = closingLineEnd < 0 ? content.length : closingLineEnd + 1;
  }

  return segments;
}
