import type { BackendCapabilities, ChatSettings, ModelCapabilities, AppearanceMode } from "./types";

export const STREAM_FLUSH_INTERVAL_MS = 48;
export const REQUEST_MAX_MESSAGES = 240;
export const REQUEST_MIN_PROMPT_BUDGET_TOKENS = 384;
export const REQUEST_HARD_CHAR_LIMIT = 500_000;
export const REQUEST_MAX_SINGLE_MESSAGE_CHARS = 60_000;
export const REQUEST_MESSAGE_TOKEN_OVERHEAD = 8;
export const CHAT_PAYLOAD_DEBUG_STORAGE_KEY = "standard_llm_debug_chat_payload_v1";
export const LEGACY_DEFAULT_CONTEXT_WINDOW = 4096;
export const UPLOAD_MAX_FILES_PER_BATCH = 10;
export const UPLOAD_MAX_TOTAL_BATCH_BYTES = 40 * 1024 * 1024;

export const THREADS_KEY = "standard_llm_threads_v1";
export const SELECTED_THREAD_KEY = "standard_llm_selected_thread_v1";
export const SELECTED_BACKEND_KEY = "standard_llm_selected_backend_v1";
export const SELECTED_MODELS_KEY = "standard_llm_selected_models_v1";
export const SETTINGS_BY_BACKEND_KEY = "standard_llm_settings_by_backend_v1";
export const DRAFTS_BY_THREAD_KEY = "standard_llm_drafts_by_thread_v1";
export const ATTACHMENT_DRAFTS_BY_THREAD_KEY = "standard_llm_attachment_drafts_by_thread_v1";
export const APPEARANCE_MODE_KEY = "standard_llm_appearance_mode_v1";
export const STREAM_READABILITY_PACE_KEY = "standard_llm_stream_readability_pace_v1";
export const LEGACY_OLLAMA_THREADS_KEY = "standard_ollama_threads_v1";
export const LEGACY_OLLAMA_SELECTED_MODEL_KEY = "standard_ollama_selected_model_v1";
export const THREADS_BACKUP_KEY = "standard_llm_threads_backup_v1";

export const DEFAULT_APPEARANCE_MODE: AppearanceMode = "light";
export const DEFAULT_STREAM_READABILITY_PACE = 0.985;
export const APPEARANCE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;
export const BOOT_PROMPT_MAX_CHARS = 12000;

export const DEFAULT_BACKEND_CAPABILITIES: BackendCapabilities = {
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

export const DEFAULT_MODEL_CAPABILITIES: ModelCapabilities = {
  textInput: true,
  imageInput: false,
  documentInput: false,
  audioInput: false,
  videoInput: false,
  binaryInput: false,
  maxAttachments: 8,
  maxAttachmentBytes: 20 * 1024 * 1024,
};

export const DEFAULT_CHAT_SETTINGS: ChatSettings = {
  systemPrompt: "",
  temperature: 0.7,
  topP: 0.9,
  topK: 40,
  maxTokens: 1024,
  stopSequences: "",
  seed: "",
  jsonMode: false,
  contextWindow: 16384,
  repeatPenalty: 1.1,
  keepAlive: "5m",
};
