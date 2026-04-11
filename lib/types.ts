// ─── Core domain types ────────────────────────────────────────────────────────

export type Role = "user" | "assistant";
export type AttachmentKind = "image" | "document" | "audio" | "video" | "text" | "binary";
export type AppearanceMode = "light" | "dark" | "system";
export type AppView = "chat" | "settings";

// ─── Attachments & artifacts ──────────────────────────────────────────────────

export type ChatAttachment = {
  id: string;
  name: string;
  mimeType: string;
  sizeBytes: number;
  kind: AttachmentKind;
  textPreview?: string;
};

export type ChatArtifact = {
  id: string;
  source?: "auto-code-bundle" | "auto-text-bundle";
  title: string;
  mimeType: string;
  sizeBytes: number;
  createdAt: number;
  content: string;
  preview?: string;
  language?: string;
  lineCount?: number;
  charCount?: number;
};

// ─── Messages ─────────────────────────────────────────────────────────────────

export type ChatMessageMetrics = {
  startedAt: number;
  firstTokenAt?: number;
  completedAt?: number;
  latencyMs?: number;
  timeToFirstTokenMs?: number;
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  estimatedTokens?: number;
  tokensPerSecond?: number;
  tokenSource?: "provider" | "estimate";
  providerId?: string;
  modelId?: string;
};

export type ChatMessage = {
  id: string;
  role: Role;
  content: string;
  modelContent?: string;
  reasoning?: string;
  artifacts?: ChatArtifact[];
  attachments?: ChatAttachment[];
  createdAt: number;
  metrics?: ChatMessageMetrics;
};

// ─── Threads ──────────────────────────────────────────────────────────────────

export type ChatThread = {
  id: string;
  title: string;
  createdAt: number;
  updatedAt: number;
  backend?: string;
  model?: string;
  messages: ChatMessage[];
};

export type ThreadPatchOptions = {
  allowMessageShrink?: boolean;
  reason?: string;
};

// ─── Backend & model config ───────────────────────────────────────────────────

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

export type BackendOption = {
  id: string;
  label: string;
  meta?: string;
  capabilities?: BackendCapabilities;
};

export type ModelOption = {
  id: string;
  meta?: string;
  capabilities?: ModelCapabilities;
};

// ─── Settings ─────────────────────────────────────────────────────────────────

export type ChatSettings = {
  systemPrompt: string;
  temperature: number;
  topP: number;
  topK: number;
  maxTokens: number;
  stopSequences: string;
  seed: string;
  jsonMode: boolean;
  contextWindow: number;
  repeatPenalty: number;
  keepAlive: string;
};

// ─── Content parsing ──────────────────────────────────────────────────────────

export type ContentSegment =
  | { type: "text"; value: string }
  | { type: "code"; value: string; language: string; isUnterminated?: boolean };

// ─── API / streaming protocol ─────────────────────────────────────────────────

export type RequestMessage = {
  role: Role;
  content: string;
  attachments?: ChatAttachment[];
};

export type StreamChunk = {
  message?: { role?: string; content?: string };
  thinking?: { content?: string };
  usage?: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  };
  prompt_eval_count?: number;
  eval_count?: number;
  total_duration?: number;
  done?: boolean;
  error?: string;
};

// ─── API responses ────────────────────────────────────────────────────────────

export type BackendsResponse = {
  backends?: BackendOption[];
  defaultBackend?: string;
  error?: string;
};

export type ModelsResponse = {
  backend?: string;
  model?: string;
  models?: ModelOption[];
  capabilities?: ModelCapabilities;
  error?: string;
};

// ─── UI ───────────────────────────────────────────────────────────────────────

export type UiErrorScope = "models" | "chat";

export type UiError = {
  scope: UiErrorScope;
  title: string;
  message: string;
};

export type UiErrorContext = {
  providerLabel?: string;
};
