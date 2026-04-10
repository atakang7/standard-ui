"use client";

import {
  ClipboardEvent as ReactClipboardEvent,
  FormEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ChatComposer } from "../components/chat/chat-composer";
import { ChatMessages } from "../components/chat/chat-messages";
import { OllamaTerminal } from "../components/chat/ollama-terminal";
import { ChatSidebar } from "../components/chat/chat-sidebar";
import { ChatTopbar } from "../components/chat/chat-topbar";
import { SettingsView } from "../components/chat/settings-view";
import type {
  AppearanceMode,
  AppView,
  BackendOption,
  BackendsResponse,
  ChatArtifact,
  ChatAttachment,
  ChatMessage,
  ChatSettings,
  ChatThread,
  ModelOption,
  ModelsResponse,
  RequestMessage,
  UiError,
  UiErrorContext,
  UiErrorScope,
} from "../lib/types";
import { getProviderTheme } from "../components/chat/providers";
import {
  BOOT_PROMPT_MAX_CHARS,
  DEFAULT_BACKEND_CAPABILITIES,
  DEFAULT_CHAT_SETTINGS,
  DEFAULT_MODEL_CAPABILITIES,
  DRAFTS_BY_THREAD_KEY,
  ATTACHMENT_DRAFTS_BY_THREAD_KEY,
  LEGACY_OLLAMA_THREADS_KEY,
  LEGACY_OLLAMA_SELECTED_MODEL_KEY,
  SELECTED_BACKEND_KEY,
  SELECTED_MODELS_KEY,
  SELECTED_THREAD_KEY,
  SETTINGS_BY_BACKEND_KEY,
  THREADS_BACKUP_KEY,
  THREADS_KEY,
  UPLOAD_MAX_FILES_PER_BATCH,
  UPLOAD_MAX_TOTAL_BATCH_BYTES,
} from "../lib/constants";
import {
  areAttachmentsEqual,
  buildThreadTitle,
  createFriendlyUiError,
  formatBytes,
  normalizeArtifacts,
  modelCapabilitiesFromUnknown,
  normalizeAttachments,
  normalizeChatSettings,
  normalizeMessageMetrics,
  normalizeModelOptions,
  supportsAttachmentKind,
} from "../lib/utils";
import { extractInlineDraftArtifacts, mergePromptWithArtifacts } from "../lib/message-artifacts";
import {
  attachmentDraftsMapFromRaw,
  createId,
  createThread,
  draftsMapFromRaw,
  modelStorageMapFromRaw,
  normalizeStreamReadabilityPace,
  persistStreamReadabilityPace,
  readStoredStreamReadabilityPace,
  persistAppearanceMode,
  readStoredAppearanceMode,
  resolveAppearanceMode,
  settingsMapFromRaw,
} from "../lib/storage";
import { streamAssistantResponse } from "../lib/stream-chat";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

function countThreadMessages(threads: ChatThread[]) {
  return threads.reduce((count, thread) => count + thread.messages.length, 0);
}

function normalizeStoredThreads(raw: string | null) {
  if (!raw) return { valid: false, threads: [] as ChatThread[] };

  try {
    const parsed = JSON.parse(raw) as ChatThread[];
    if (!Array.isArray(parsed)) {
      return { valid: false, threads: [] as ChatThread[] };
    }

    return {
      valid: true,
      threads: parsed
        .filter((thread) => thread && typeof thread.id === "string" && Array.isArray(thread.messages))
        .map((thread) => ({
          id: thread.id,
          title: typeof thread.title === "string" && thread.title ? thread.title : "New chat",
          createdAt:
            typeof thread.createdAt === "number" && Number.isFinite(thread.createdAt)
              ? thread.createdAt
              : Date.now(),
          updatedAt:
            typeof thread.updatedAt === "number" && Number.isFinite(thread.updatedAt)
              ? thread.updatedAt
              : Date.now(),
          backend:
            typeof thread.backend === "string" && thread.backend
              ? thread.backend
              : typeof thread.model === "string" && thread.model
                ? "ollama"
                : "",
          model: typeof thread.model === "string" ? thread.model : "",
          messages: thread.messages
            .filter(
              (message) =>
                message &&
                (message.role === "user" || message.role === "assistant") &&
                typeof message.content === "string"
            )
            .map((message) => ({
              id: typeof message.id === "string" ? message.id : createId(),
              role: message.role,
              content: message.content,
              modelContent:
                typeof (message as { modelContent?: unknown }).modelContent === "string" &&
                (message as { modelContent?: string }).modelContent?.trim()
                  ? (message as { modelContent?: string }).modelContent
                  : undefined,
              reasoning:
                typeof (message as { reasoning?: unknown }).reasoning === "string" &&
                (message as { reasoning?: string }).reasoning?.trim()
                  ? (message as { reasoning?: string }).reasoning
                  : undefined,
              artifacts: normalizeArtifacts((message as { artifacts?: unknown }).artifacts),
              attachments: normalizeAttachments((message as { attachments?: unknown }).attachments),
              createdAt:
                typeof message.createdAt === "number" && Number.isFinite(message.createdAt)
                  ? message.createdAt
                  : Date.now(),
              metrics: normalizeMessageMetrics((message as { metrics?: unknown }).metrics),
            })),
        })),
    };
  } catch {
    return { valid: false, threads: [] as ChatThread[] };
  }
}

export default function Page() {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [backends, setBackends] = useState<BackendOption[]>([]);
  const [selectedBackend, setSelectedBackend] = useState("");
  const [models, setModels] = useState<ModelOption[]>([]);
  const [selectedModel, setSelectedModel] = useState("");
  const [settingsByBackend, setSettingsByBackend] = useState<Record<string, ChatSettings>>({});
  const [draftsByThread, setDraftsByThread] = useState<Record<string, string>>({});
  const [attachmentDraftsByThread, setAttachmentDraftsByThread] = useState<Record<string, ChatAttachment[]>>({});
  const [promptArtifactsByThread, setPromptArtifactsByThread] = useState<Record<string, ChatArtifact[]>>({});
  const [sessionKeysByThread, setSessionKeysByThread] = useState<Record<string, string>>({});
  const [composerAttachments, setComposerAttachments] = useState<ChatAttachment[]>([]);
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);
  const [backendsReady, setBackendsReady] = useState(false);
  const [modelsReady, setModelsReady] = useState(false);
  const [backendsReloadNonce, setBackendsReloadNonce] = useState(0);
  const [hasBootedUi, setHasBootedUi] = useState(false);
  const [bootPromptBuffer, setBootPromptBuffer] = useState("");
  const [prompt, setPrompt] = useState("");
  const [uiError, setUiError] = useState<UiError | null>(null);
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [ollamaTerminalOpen, setOllamaTerminalOpen] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(() => readStoredAppearanceMode());
  const [streamReadabilityPace, setStreamReadabilityPace] = useState<number>(() =>
    readStoredStreamReadabilityPace()
  );
  const [appearanceModeHydrated, setAppearanceModeHydrated] = useState(false);
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });
  const [activeView, setActiveView] = useState<AppView>("chat");

  const streamAbortRef = useRef<AbortController | null>(null);
  const lastModelsRefreshAtRef = useRef(0);
  const bootPromptAppliedRef = useRef(false);
  const promptRef = useRef("");
  const selectedThreadIdRef = useRef("");
  const threadsRef = useRef<ChatThread[]>([]);
  const backendsRef = useRef<BackendOption[]>([]);
  const selectedBackendRef = useRef("");
  const selectedModelRef = useRef("");
  const streamingThreadIdRef = useRef<string | null>(null);

  // ── Derived state ──────────────────────────────────────────────────

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );

  const activeMessages = activeThread?.messages ?? [];
  const hasMessages = activeMessages.length > 0;
  const isStreaming = streamingThreadId !== null;
  const isSettingsView = activeView === "settings";
  const sortedThreads = useMemo(
    () => [...threads].sort((left, right) => right.updatedAt - left.updatedAt),
    [threads]
  );
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
  const activeSettings = useMemo(
    () => settingsByBackend[selectedBackend] ?? DEFAULT_CHAT_SETTINGS,
    [selectedBackend, settingsByBackend]
  );
  const fallbackAttachmentCount = useMemo(
    () =>
      composerAttachments.reduce((count, attachment) => {
        return supportsAttachmentKind(attachment.kind, activeModelCapabilities) ? count : count + 1;
      }, 0),
    [composerAttachments, activeModelCapabilities]
  );
  const composerPromptArtifacts = useMemo(
    () => (selectedThreadId ? promptArtifactsByThread[selectedThreadId] ?? [] : []),
    [promptArtifactsByThread, selectedThreadId]
  );

  const resolvedAppearanceMode = resolveAppearanceMode(appearanceMode, prefersDark);
  const providerUi = "claude" as const;
  const providerTheme = useMemo(
    () => getProviderTheme(providerUi, resolvedAppearanceMode),
    [providerUi, resolvedAppearanceMode]
  );
  const prerequisitesReady =
    appearanceModeHydrated && isStorageHydrated && backendsReady && modelsReady;
  const isBootPhase = !hasBootedUi && !prerequisitesReady;

  // ── Helpers ────────────────────────────────────────────────────────

  const patchThread = useCallback((threadId: string, update: (thread: ChatThread) => ChatThread) => {
    setThreads((current) => {
      const threadIndex = current.findIndex((thread) => thread.id === threadId);
      if (threadIndex < 0) return current;

      const existing = current[threadIndex];
      const nextThread = update(existing);
      if (nextThread === existing) return current;

      const next = current.slice();
      next[threadIndex] = nextThread;
      return next;
    });
  }, []);

  const clearDraftForThread = useCallback((threadId: string) => {
    setDraftsByThread((current) => {
      if (!threadId || !(threadId in current)) return current;
      const next = { ...current };
      delete next[threadId];
      return next;
    });

    setAttachmentDraftsByThread((current) => {
      if (!threadId || !(threadId in current)) return current;
      const next = { ...current };
      delete next[threadId];
      return next;
    });

    setPromptArtifactsByThread((current) => {
      if (!threadId || !(threadId in current)) return current;
      const next = { ...current };
      delete next[threadId];
      return next;
    });

    if (threadId && selectedThreadIdRef.current === threadId) {
      setComposerAttachments((current) => (current.length ? [] : current));
    }
  }, []);

  function syncPromptDraft(nextPrompt: string, threadId: string) {
    if (!threadId) return;

    setDraftsByThread((current) => {
      const existing = current[threadId] ?? "";
      if (existing === nextPrompt) return current;

      if (!nextPrompt) {
        if (!(threadId in current)) return current;
        const next = { ...current };
        delete next[threadId];
        return next;
      }

      return {
        ...current,
        [threadId]: nextPrompt,
      };
    });
  }

  function applyPromptValue(nextPrompt: string) {
    promptRef.current = nextPrompt;
    setPrompt(nextPrompt);
    syncPromptDraft(nextPrompt, selectedThreadIdRef.current);
  }

  function handlePromptChange(nextPrompt: string) {
    applyPromptValue(nextPrompt);
  }

  function appendPromptArtifacts(nextArtifacts: ChatArtifact[]) {
    const threadId = selectedThreadIdRef.current;
    if (!threadId || !nextArtifacts.length) return;

    setPromptArtifactsByThread((current) => {
      const existing = current[threadId] ?? [];
      const deduped = [...existing];
      for (const artifact of nextArtifacts) {
        if (
          deduped.some(
            (existingArtifact) =>
              existingArtifact.source === artifact.source &&
              existingArtifact.content === artifact.content
          )
        ) {
          continue;
        }
        deduped.push(artifact);
      }
      return {
        ...current,
        [threadId]: deduped,
      };
    });
  }

  function handleRemovePromptArtifact(artifactId: string) {
    const threadId = selectedThreadIdRef.current;
    if (!threadId || !artifactId) return;

    setPromptArtifactsByThread((current) => {
      const existing = current[threadId] ?? [];
      const nextArtifacts = existing.filter((artifact) => artifact.id !== artifactId);
      if (nextArtifacts.length === existing.length) return current;

      if (!nextArtifacts.length) {
        if (!(threadId in current)) return current;
        const next = { ...current };
        delete next[threadId];
        return next;
      }

      return {
        ...current,
        [threadId]: nextArtifacts,
      };
    });
  }

  function clearUiError(scope?: UiErrorScope) {
    setUiError((current) => {
      if (!current) return current;
      if (!scope || current.scope === scope) return null;
      return current;
    });
  }

  function showUiError(scope: UiErrorScope, error: unknown, context?: UiErrorContext) {
    setUiError(createFriendlyUiError(scope, error, context));
  }

  // ── Effects ────────────────────────────────────────────────────────

  useEffect(() => {
    if (!uiError) return;
    const timeoutId = window.setTimeout(() => {
      setUiError(null);
    }, 5200);
    return () => window.clearTimeout(timeoutId);
  }, [uiError]);

  const canSend = useMemo(() => {
    return (
      (Boolean(prompt.trim()) || composerAttachments.length > 0 || composerPromptArtifacts.length > 0) &&
      Boolean(selectedBackend) &&
      Boolean(selectedModel) &&
      Boolean(activeThread) &&
      !isUploadingAttachments &&
      !isStreaming
    );
  }, [
    prompt,
    composerAttachments.length,
    composerPromptArtifacts.length,
    selectedBackend,
    selectedModel,
    activeThread,
    isUploadingAttachments,
    isStreaming,
  ]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMode = readStoredAppearanceMode();
    if (storedMode !== appearanceMode) {
      setAppearanceMode(storedMode);
    }
    setAppearanceModeHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyResolvedMode = () => {
      setPrefersDark(mediaQuery.matches);
    };

    applyResolvedMode();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyResolvedMode);
      return () => mediaQuery.removeEventListener("change", applyResolvedMode);
    }

    mediaQuery.addListener(applyResolvedMode);
    return () => mediaQuery.removeListener(applyResolvedMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const hasFiles = (event: DragEvent) => {
      const types = event.dataTransfer?.types;
      if (!types) return false;
      return Array.from(types).includes("Files");
    };

    const preventBrowserFileDrop = (event: DragEvent) => {
      if (!hasFiles(event)) return;
      event.preventDefault();
    };

    window.addEventListener("dragover", preventBrowserFileDrop);
    window.addEventListener("drop", preventBrowserFileDrop);
    return () => {
      window.removeEventListener("dragover", preventBrowserFileDrop);
      window.removeEventListener("drop", preventBrowserFileDrop);
    };
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!appearanceModeHydrated) return;
    persistAppearanceMode(appearanceMode);
  }, [appearanceMode, appearanceModeHydrated]);

  useEffect(() => {
    persistStreamReadabilityPace(streamReadabilityPace);
  }, [streamReadabilityPace]);

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

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
    streamingThreadIdRef.current = streamingThreadId;
  }, [streamingThreadId]);

  useEffect(() => {
    if (!prerequisitesReady) return;
    setHasBootedUi(true);
  }, [prerequisitesReady]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const isTypingTarget = (target: EventTarget | null) => {
      if (!(target instanceof HTMLElement)) return false;
      if (target.closest("[data-ignore-global-keys='1']")) return true;
      const tag = target.tagName;
      return (
        target.isContentEditable ||
        tag === "INPUT" ||
        tag === "TEXTAREA" ||
        tag === "SELECT"
      );
    };

    const appendToBootPrompt = (nextChunk: string) => {
      if (!nextChunk) return;
      setBootPromptBuffer((current) => (current + nextChunk).slice(0, BOOT_PROMPT_MAX_CHARS));
    };

    const focusPrompt = () => {
      const node = document.getElementById("chat-prompt");
      if (!(node instanceof HTMLTextAreaElement)) return;
      node.focus();
      const cursorPosition = node.value.length;
      node.setSelectionRange(cursorPosition, cursorPosition);
    };

    const applyGlobalEdit = (transform: (current: string) => string) => {
      if (isBootPhase) {
        setBootPromptBuffer((current) => transform(current).slice(0, BOOT_PROMPT_MAX_CHARS));
        return;
      }

      const nextPrompt = transform(promptRef.current).slice(0, BOOT_PROMPT_MAX_CHARS);
      if (nextPrompt === promptRef.current) return;
      applyPromptValue(nextPrompt);
      window.requestAnimationFrame(focusPrompt);
    };

    const handleWindowKeyDown = (event: globalThis.KeyboardEvent) => {
      if (event.defaultPrevented) return;
      if (event.metaKey || event.ctrlKey || event.altKey) return;
      if (isTypingTarget(event.target)) return;

      if (event.key === "Backspace") {
        event.preventDefault();
        applyGlobalEdit((current) => current.slice(0, -1));
        return;
      }

      if (event.key === "Enter") {
        event.preventDefault();
        applyGlobalEdit((current) => current + "\n");
        return;
      }

      if (event.key.length !== 1) return;

      event.preventDefault();
      applyGlobalEdit((current) => current + event.key);
    };

    const handleWindowPaste = (event: ClipboardEvent) => {
      if (event.defaultPrevented) return;
      if (isTypingTarget(event.target)) return;
      const pastedText = event.clipboardData?.getData("text/plain") ?? "";
      if (!pastedText) return;

      event.preventDefault();
      if (isBootPhase) {
        appendToBootPrompt(pastedText);
        return;
      }
      applyGlobalEdit((current) => current + pastedText);
    };

    window.addEventListener("keydown", handleWindowKeyDown);
    window.addEventListener("paste", handleWindowPaste);
    return () => {
      window.removeEventListener("keydown", handleWindowKeyDown);
      window.removeEventListener("paste", handleWindowPaste);
    };
  }, [isBootPhase]);

  useEffect(() => {
    if (isBootPhase) return;
    if (bootPromptAppliedRef.current) return;
    bootPromptAppliedRef.current = true;

    const capturedPrompt = bootPromptBuffer;
    if (!capturedPrompt) return;

    const nextPrompt = (promptRef.current + capturedPrompt).slice(0, BOOT_PROMPT_MAX_CHARS);
    applyPromptValue(nextPrompt);
    setBootPromptBuffer("");
  }, [isBootPhase, bootPromptBuffer]);

  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.colorMode = resolvedAppearanceMode;
    root.style.colorScheme = resolvedAppearanceMode;
    if (!root.hasAttribute("data-theme-switching")) return;
    const timeoutId = window.setTimeout(() => {
      root.removeAttribute("data-theme-switching");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [resolvedAppearanceMode]);

  // ── Storage hydration ──────────────────────────────────────────────

  useEffect(() => {
    try {
      const rawThreads = localStorage.getItem(THREADS_KEY);
      const rawThreadBackup = localStorage.getItem(THREADS_BACKUP_KEY);
      const rawLegacyThreads = localStorage.getItem(LEGACY_OLLAMA_THREADS_KEY);
      const rawSelectedId = localStorage.getItem(SELECTED_THREAD_KEY);
      const rawSettings = localStorage.getItem(SETTINGS_BY_BACKEND_KEY);
      const rawDrafts = localStorage.getItem(DRAFTS_BY_THREAD_KEY);
      const rawAttachmentDrafts = localStorage.getItem(ATTACHMENT_DRAFTS_BY_THREAD_KEY);
      const primaryThreads = normalizeStoredThreads(rawThreads);
      const backupThreads = normalizeStoredThreads(rawThreadBackup);
      const legacyThreads = normalizeStoredThreads(rawLegacyThreads);

      let nextThreads = primaryThreads.threads;
      if (!nextThreads.length && rawThreads && !primaryThreads.valid) {
        nextThreads = backupThreads.threads;
      }
      if (!nextThreads.length) {
        nextThreads = legacyThreads.threads;
      }
      if (!nextThreads.length && !rawThreads) {
        nextThreads = backupThreads.threads;
      }

      if (!nextThreads.length) {
        nextThreads = [createThread()];
      }

      const preferredId =
        rawSelectedId && nextThreads.some((thread) => thread.id === rawSelectedId)
          ? rawSelectedId
          : nextThreads[0].id;

      setSettingsByBackend(settingsMapFromRaw(rawSettings));
      setDraftsByThread(draftsMapFromRaw(rawDrafts));
      setAttachmentDraftsByThread(attachmentDraftsMapFromRaw(rawAttachmentDrafts));
      setThreads(nextThreads);
      setSelectedThreadId(preferredId);
    } catch {
      const fallback = createThread();
      setSettingsByBackend({});
      setDraftsByThread({});
      setAttachmentDraftsByThread({});
      setThreads([fallback]);
      setSelectedThreadId(fallback.id);
    } finally {
      setIsStorageHydrated(true);
    }
  }, []);

  // ── Storage persistence ────────────────────────────────────────────

  useEffect(() => {
    if (!isStorageHydrated || !threads.length) return;
    const timerId = window.setTimeout(() => {
      try {
        const previousRaw = localStorage.getItem(THREADS_KEY);
        const previousThreads = normalizeStoredThreads(previousRaw).threads;
        const previousMessageCount = countThreadMessages(previousThreads);
        const nextMessageCount = countThreadMessages(threads);

        if (streamingThreadId && previousMessageCount > nextMessageCount) {
          console.warn("[standard-ui] skipped shrinking thread persistence during active stream", {
            previousMessageCount,
            nextMessageCount,
            streamingThreadId,
          });
          return;
        }

        const nextRaw = JSON.stringify(threads);
        if (previousRaw && previousRaw !== nextRaw) {
          localStorage.setItem(THREADS_BACKUP_KEY, previousRaw);
        }
        localStorage.setItem(THREADS_KEY, nextRaw);
      } catch (error) {
        console.warn("[standard-ui] failed to persist threads", error);
      }
    }, 220);
    return () => window.clearTimeout(timerId);
  }, [threads, isStorageHydrated, streamingThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    localStorage.setItem(SELECTED_THREAD_KEY, selectedThreadId);
  }, [selectedThreadId]);

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
    if (!isStorageHydrated) return;
    localStorage.setItem(SETTINGS_BY_BACKEND_KEY, JSON.stringify(settingsByBackend));
  }, [settingsByBackend, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    localStorage.setItem(DRAFTS_BY_THREAD_KEY, JSON.stringify(draftsByThread));
  }, [draftsByThread, isStorageHydrated]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    localStorage.setItem(
      ATTACHMENT_DRAFTS_BY_THREAD_KEY,
      JSON.stringify(attachmentDraftsByThread)
    );
  }, [attachmentDraftsByThread, isStorageHydrated]);

  // ── Draft restore / sync ───────────────────────────────────────────

  useEffect(() => {
    if (!selectedThreadId) {
      setPrompt((current) => (current ? "" : current));
      setComposerAttachments((current) => (current.length ? [] : current));
      return;
    }
    const restoredDraft = draftsByThread[selectedThreadId] ?? "";
    const restoredAttachmentDrafts = attachmentDraftsByThread[selectedThreadId] ?? [];
    setPrompt((current) => (current === restoredDraft ? current : restoredDraft));
    setComposerAttachments((current) =>
      areAttachmentsEqual(current, restoredAttachmentDrafts) ? current : restoredAttachmentDrafts
    );
  }, [selectedThreadId, draftsByThread, attachmentDraftsByThread]);

  useEffect(() => {
    if (!selectedThreadId) return;
    setAttachmentDraftsByThread((current) => {
      const existing = current[selectedThreadId] ?? [];
      if (areAttachmentsEqual(existing, composerAttachments)) return current;

      if (!composerAttachments.length) {
        if (!(selectedThreadId in current)) return current;
        const next = { ...current };
        delete next[selectedThreadId];
        return next;
      }

      return {
        ...current,
        [selectedThreadId]: composerAttachments,
      };
    });
  }, [composerAttachments, selectedThreadId]);

  useEffect(() => {
    if (!isStorageHydrated) return;
    const validThreadIds = new Set(threads.map((thread) => thread.id));
    setDraftsByThread((current) => {
      let changed = false;
      const next: Record<string, string> = {};
      for (const [threadId, draft] of Object.entries(current)) {
        if (validThreadIds.has(threadId)) {
          next[threadId] = draft;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });

    setAttachmentDraftsByThread((current) => {
      let changed = false;
      const next: Record<string, ChatAttachment[]> = {};
      for (const [threadId, attachments] of Object.entries(current)) {
        if (validThreadIds.has(threadId)) {
          next[threadId] = attachments;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });

    setPromptArtifactsByThread((current) => {
      let changed = false;
      const next: Record<string, ChatArtifact[]> = {};
      for (const [threadId, artifacts] of Object.entries(current)) {
        if (validThreadIds.has(threadId)) {
          next[threadId] = artifacts;
        } else {
          changed = true;
        }
      }
      return changed ? next : current;
    });
  }, [threads, isStorageHydrated]);

  useEffect(() => {
    if (!threads.length) return;
    if (!selectedThreadId || !threads.some((thread) => thread.id === selectedThreadId)) {
      setSelectedThreadId(threads[0].id);
    }
  }, [threads, selectedThreadId]);

  useEffect(() => {
    setSessionKeysByThread((current) => {
      const validThreadIds = new Set(threads.map((thread) => thread.id));
      let changed = false;
      const next: Record<string, string> = {};

      for (const thread of threads) {
        const existing = current[thread.id];
        if (existing) {
          next[thread.id] = existing;
          continue;
        }
        next[thread.id] = thread.id;
        changed = true;
      }

      for (const threadId of Object.keys(current)) {
        if (!validThreadIds.has(threadId)) {
          changed = true;
        }
      }

      if (!changed && Object.keys(next).length === Object.keys(current).length) {
        return current;
      }
      return next;
    });
  }, [threads]);

  // ── Backend / model loading ────────────────────────────────────────

  useEffect(() => {
    async function loadBackends() {
      clearUiError("models");
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
          showUiError("models", "No LLM backends are configured.");
          return;
        }

        const savedBackend = localStorage.getItem(SELECTED_BACKEND_KEY) ?? "";
        const fallbackBackend = payload.defaultBackend || nextBackends[0].id;

        const selected = [savedBackend, fallbackBackend].find((candidate) =>
          nextBackends.some((backend) => backend.id === candidate)
        );

        setSelectedBackend(selected || fallbackBackend);
      } catch (error) {
        const message = error instanceof Error ? error.message : "Failed to load backends.";
        showUiError("models", message, { providerLabel: activeBackend?.label || selectedBackend });
      } finally {
        setBackendsReady(true);
      }
    }

    loadBackends();
  }, [backendsReloadNonce]);

  useEffect(() => {
    if (!selectedBackend) return;

    setSettingsByBackend((current) => {
      if (current[selectedBackend]) return current;
      return {
        ...current,
        [selectedBackend]: normalizeChatSettings(),
      };
    });
  }, [selectedBackend]);

  useEffect(() => {
    if (!selectedBackend) {
      setModels([]);
      setModelsReady(true);
      return;
    }

    setModelsReady(false);
    let cancelled = false;

    async function loadModels() {
      clearUiError("models");

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
          showUiError("models", `No models found for ${activeBackend?.label || selectedBackend}.`, { providerLabel: activeBackend?.label || selectedBackend });
          setSelectedModel("");
          setModelsReady(true);
          return;
        }

        const savedMap = modelStorageMapFromRaw(localStorage.getItem(SELECTED_MODELS_KEY));
        const legacyOllamaModel = localStorage.getItem(LEGACY_OLLAMA_SELECTED_MODEL_KEY) || "";
        const modelFromActiveThread =
          activeThread?.backend === selectedBackend && activeThread.model ? activeThread.model : "";

        const preferredModel = [
          modelFromActiveThread,
          selectedModel,
          savedMap[selectedBackend] || "",
          selectedBackend === "ollama" ? legacyOllamaModel : "",
        ].find((candidate) => nextModels.some((model) => model.id === candidate));

        setSelectedModel(preferredModel || nextModels[0].id);
        setModelsReady(true);
      } catch (error) {
        if (cancelled) return;
        const message = error instanceof Error ? error.message : "Failed to load models.";
        showUiError("models", message, { providerLabel: activeBackend?.label || selectedBackend });
        setModelsReady(true);
      }
    }

    loadModels();

    return () => {
      cancelled = true;
    };
  }, [selectedBackend]);

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

  useEffect(() => {
    const maxAttachments = Math.max(1, activeModelCapabilities.maxAttachments);
    const maxAttachmentBytes = Math.max(1, activeModelCapabilities.maxAttachmentBytes);

    setComposerAttachments((current) => {
      if (!current.length) return current;

      const withinSize = current.filter((attachment) => attachment.sizeBytes <= maxAttachmentBytes);
      const trimmed = withinSize.slice(0, maxAttachments);
      return areAttachmentsEqual(current, trimmed) ? current : trimmed;
    });
  }, [
    activeModelCapabilities.maxAttachments,
    activeModelCapabilities.maxAttachmentBytes,
    selectedModel,
  ]);

  useEffect(() => {
    if (!selectedBackend || selectedBackend === "ollama") return;
    setOllamaTerminalOpen(false);
  }, [selectedBackend]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const url = new URL(window.location.href);
    if (url.searchParams.get("ollamaCli") === "1") {
      setOllamaTerminalOpen(true);
    }
  }, []);

  // ── Event handlers ─────────────────────────────────────────────────

  const handleOpenSettings = useCallback(() => {
    setActiveView("settings");
    setMobileSidebarOpen(false);
    setUiError((current) => {
      if (!current || current.scope === "chat") return null;
      return current;
    });
  }, []);

  function handleAppearanceModeSelect(nextMode: AppearanceMode) {
    persistAppearanceMode(nextMode);
    if (nextMode === appearanceMode) return;
    if (typeof document !== "undefined") {
      document.documentElement.setAttribute("data-theme-switching", "1");
      window.setTimeout(() => {
        document.documentElement.removeAttribute("data-theme-switching");
      }, 180);
    }
    setAppearanceMode(nextMode);
  }

  const handleNewChat = useCallback(() => {
    const nextThread = createThread(selectedBackendRef.current, selectedModelRef.current);
    setThreads((current) => [nextThread, ...current]);
    setSelectedThreadId(nextThread.id);
    setActiveView("chat");
    setPrompt("");
    setComposerAttachments([]);
    setUiError((current) => {
      if (!current || current.scope === "chat") return null;
      return current;
    });
    setMobileSidebarOpen(false);
  }, []);

  const handleDeleteChat = useCallback((threadId: string) => {
    if (streamingThreadIdRef.current === threadId) {
      streamAbortRef.current?.abort();
    }
    clearDraftForThread(threadId);

    setThreads((current) => {
      const remaining = current.filter((thread) => thread.id !== threadId);
      const nextThreads = remaining.length
        ? remaining
        : [createThread(selectedBackendRef.current, selectedModelRef.current)];

      setSelectedThreadId((currentSelectedId) => {
        if (currentSelectedId !== threadId && nextThreads.some((thread) => thread.id === currentSelectedId)) {
          return currentSelectedId;
        }
        return nextThreads[0].id;
      });

      return nextThreads;
    });
  }, [clearDraftForThread]);

  const handleRenameChat = useCallback((threadId: string, title: string) => {
    const normalized = title.replace(/\s+/g, " ").trim();
    if (!normalized) return;

    patchThread(threadId, (thread) => ({
      ...thread,
      title: normalized,
      updatedAt: Date.now(),
    }));
  }, [patchThread]);

  const handleSelectChat = useCallback((threadId: string) => {
    const selectedThread = threadsRef.current.find((thread) => thread.id === threadId) ?? null;
    if (!selectedThread) return;

    if (
      selectedThread.backend &&
      backendsRef.current.some((backend) => backend.id === selectedThread.backend)
    ) {
      setSelectedBackend(selectedThread.backend);
    }

    if (selectedThread.model) {
      setSelectedModel(selectedThread.model);
    }

    setSelectedThreadId(threadId);
    setActiveView("chat");
    setMobileSidebarOpen(false);
    setUiError((current) => {
      if (!current || current.scope === "chat") return null;
      return current;
    });
  }, []);

  const handleOpenMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const handleToggleDesktopSidebar = useCallback(() => {
    setSidebarCollapsed((value) => !value);
  }, []);

  function handleStopStreaming() {
    streamAbortRef.current?.abort();
  }

  function handleSelectBackend(backendId: string) {
    setSelectedBackend(backendId);
    clearUiError("chat");
  }

  function handleRemoveAttachment(attachmentId: string) {
    if (!attachmentId || isStreaming || isUploadingAttachments) return;
    setComposerAttachments((current) => {
      if (!current.some((attachment) => attachment.id === attachmentId)) return current;
      return current.filter((attachment) => attachment.id !== attachmentId);
    });
  }

  async function uploadAttachmentFiles(files: File[]) {
    if (!files.length) return;
    if (isStreaming || isUploadingAttachments) return;

    if (!selectedBackend || !selectedModel) {
      showUiError("chat", "Choose a provider and model before attaching files.");
      return;
    }

    const maxAttachments = Math.max(1, activeModelCapabilities.maxAttachments);
    const maxSingleFileBytes = Math.max(1, activeModelCapabilities.maxAttachmentBytes);

    if (files.length > UPLOAD_MAX_FILES_PER_BATCH) {
      showUiError("chat", `You can upload up to ${UPLOAD_MAX_FILES_PER_BATCH} files at once.`);
      return;
    }

    if (composerAttachments.length + files.length > maxAttachments) {
      showUiError(
        "chat",
        `This model allows up to ${maxAttachments} attachments per message.`
      );
      return;
    }

    const totalBatchBytes = files.reduce((sum, file) => sum + file.size, 0);
    if (totalBatchBytes > UPLOAD_MAX_TOTAL_BATCH_BYTES) {
      showUiError(
        "chat",
        `Total upload size exceeds ${formatBytes(UPLOAD_MAX_TOTAL_BATCH_BYTES)}.`
      );
      return;
    }

    const oversizedFile = files.find((file) => file.size > maxSingleFileBytes);
    if (oversizedFile) {
      showUiError(
        "chat",
        `"${oversizedFile.name}" exceeds this model's file size limit of ${formatBytes(maxSingleFileBytes)}.`
      );
      return;
    }

    setIsUploadingAttachments(true);
    clearUiError("chat");

    try {
      const formData = new FormData();
      files.forEach((file) => formData.append("files", file));

      const response = await fetch("/api/uploads", {
        method: "POST",
        body: formData,
      });

      const payload = (await response.json()) as { attachments?: unknown; error?: string };
      if (!response.ok) {
        throw new Error(payload.error || `Upload failed (${response.status})`);
      }

      const uploaded = normalizeAttachments(payload.attachments);
      if (!uploaded.length) {
        throw new Error("No files were uploaded.");
      }

      setComposerAttachments((current) => {
        const dedupedById = new Map<string, ChatAttachment>();
        [...current, ...uploaded].forEach((attachment) => {
          dedupedById.set(attachment.id, attachment);
        });

        const merged = Array.from(dedupedById.values()).slice(0, maxAttachments);
        return areAttachmentsEqual(current, merged) ? current : merged;
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Attachment upload failed.";
      showUiError("chat", message);
    } finally {
      setIsUploadingAttachments(false);
    }
  }

  async function handleAttachFiles(fileList: FileList | null) {
    if (!fileList || !fileList.length) return;
    await uploadAttachmentFiles(Array.from(fileList));
  }

  async function refreshModelsFromProvider() {
    if (!selectedBackend) return;

    clearUiError("models");

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
        showUiError("models", `No models found for ${activeBackend?.label || selectedBackend}.`, { providerLabel: activeBackend?.label || selectedBackend });
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
      showUiError("models", message, { providerLabel: activeBackend?.label || selectedBackend });
    }
  }

  function handleRefreshModels() {
    if (!selectedBackend || isStreaming) return;

    const now = Date.now();
    if (now - lastModelsRefreshAtRef.current < 700) return;
    lastModelsRefreshAtRef.current = now;

    void refreshModelsFromProvider();
  }

  function handleSettingsChange(nextSettings: Partial<ChatSettings>) {
    if (!selectedBackend) return;

    setSettingsByBackend((current) => {
      const currentSettings = current[selectedBackend] ?? DEFAULT_CHAT_SETTINGS;
      return {
        ...current,
        [selectedBackend]: normalizeChatSettings({
          ...currentSettings,
          ...nextSettings,
        }),
      };
    });
  }

  function handleStreamReadabilityPaceChange(value: number) {
    setStreamReadabilityPace(normalizeStreamReadabilityPace(value));
  }

  function handlePromptKeyDown(event: KeyboardEvent<HTMLTextAreaElement>) {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      const form = event.currentTarget.form;
      form?.requestSubmit();
    }
  }

  function handlePromptPaste(event: ReactClipboardEvent<HTMLTextAreaElement>) {
    const items = Array.from(event.clipboardData?.items ?? []);
    const pastedText = event.clipboardData?.getData("text/plain") ?? "";

    const pastedFiles = items
      .map((item) => (item.kind === "file" ? item.getAsFile() : null))
      .filter((file): file is File => file instanceof File && file.size > 0);

    if (pastedFiles.length) {
      event.preventDefault();
      void uploadAttachmentFiles(pastedFiles);
      return;
    }

    if (!pastedText.trim()) return;

    const extracted = extractInlineDraftArtifacts(pastedText, "user");
    if (!extracted.artifacts.length) return;

    event.preventDefault();
    appendPromptArtifacts(extracted.artifacts);

    const target = event.currentTarget;
    const start = target.selectionStart ?? promptRef.current.length;
    const end = target.selectionEnd ?? start;
    const nextPromptRaw =
      promptRef.current.slice(0, start) +
      extracted.remainingText +
      promptRef.current.slice(end);
    const nextPrompt = nextPromptRaw.slice(0, BOOT_PROMPT_MAX_CHARS);
    applyPromptValue(nextPrompt);

    const nextCursor = Math.min(nextPrompt.length, start + extracted.remainingText.length);
    window.requestAnimationFrame(() => {
      target.focus();
      target.setSelectionRange(nextCursor, nextCursor);
    });
  }

  // ── Submit / regenerate / edit ─────────────────────────────────────

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!canSend || !activeThread) {
      return;
    }

    const userText = prompt.trim();
    const outgoingPromptArtifacts = composerPromptArtifacts.slice();
    const mergedUserContent = mergePromptWithArtifacts(userText, outgoingPromptArtifacts);
    const outgoingAttachments = composerAttachments.slice();
    if (!mergedUserContent && !outgoingAttachments.length) {
      return;
    }
    const threadId = activeThread.id;
    const assistantMessageId = createId();
    const titleSeed =
      userText ||
      outgoingPromptArtifacts[0]?.title ||
      outgoingAttachments[0]?.name ||
      "New chat";

    const userMessageBase: ChatMessage = {
      id: createId(),
      role: "user",
      content: mergedUserContent,
      attachments: outgoingAttachments,
      createdAt: Date.now(),
    };
    const userMessage = userMessageBase;

    const assistantMessage: ChatMessage = {
      id: assistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      metrics: {
        startedAt: Date.now(),
        providerId: selectedBackend,
        modelId: selectedModel,
        tokenSource: "estimate",
      },
    };

    const requestMessages: RequestMessage[] = [...activeThread.messages, userMessage].map((message) => ({
      role: message.role,
      content: message.modelContent ?? message.content,
      attachments: message.attachments,
    }));

    setPrompt("");
    setComposerAttachments([]);
    clearDraftForThread(threadId);
    clearUiError("chat");
    setStreamingThreadId(threadId);

    patchThread(threadId, (thread) => ({
      ...thread,
      title: thread.messages.length === 0 ? buildThreadTitle(titleSeed) : thread.title,
      updatedAt: Date.now(),
      backend: selectedBackend,
      model: selectedModel,
      messages: [...thread.messages, userMessage, assistantMessage],
    }));

    const controller = new AbortController();
    streamAbortRef.current = controller;

    await streamAssistantResponse({
      threadId,
      assistantMessageId,
      sessionKey: sessionKeysByThread[threadId] || threadId,
      requestMessages,
      selectedBackend,
      selectedModel,
      settings: activeSettings,
      onPatchThread: patchThread,
      onError: (error) => {
        showUiError("chat", error, { providerLabel: activeBackend?.label || selectedBackend });
      },
      onComplete: () => {
        setStreamingThreadId(null);
        streamAbortRef.current = null;
      },
      abortController: controller,
    });
  }

  async function handleRegenerateFromAssistantMessage(assistantMessageId: string) {
    if (!activeThread || !selectedBackend || !selectedModel || isStreaming) return;

    const messages = activeThread.messages;
    const assistantIndex = messages.findIndex(
      (message) => message.id === assistantMessageId && message.role === "assistant"
    );
    if (assistantIndex < 0) return;

    const baseMessages = messages.slice(0, assistantIndex);
    if (!baseMessages.some((message) => message.role === "user")) return;

    const threadId = activeThread.id;
    const nextSessionKey = createId();
    setSessionKeysByThread((current) => ({
      ...current,
      [threadId]: nextSessionKey,
    }));
    const nextAssistantMessageId = createId();
    const newAssistantMessage: ChatMessage = {
      id: nextAssistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      metrics: {
        startedAt: Date.now(),
        providerId: selectedBackend,
        modelId: selectedModel,
        tokenSource: "estimate",
      },
    };

    clearUiError("chat");
    setStreamingThreadId(threadId);

    patchThread(threadId, (thread) => ({
      ...thread,
      updatedAt: Date.now(),
      backend: selectedBackend,
      model: selectedModel,
      messages: [...baseMessages, newAssistantMessage],
    }));

    const requestMessages: RequestMessage[] = baseMessages.map((message) => ({
      role: message.role,
      content: message.modelContent ?? message.content,
      attachments: message.attachments,
    }));

    const controller = new AbortController();
    streamAbortRef.current = controller;

    await streamAssistantResponse({
      threadId,
      assistantMessageId: nextAssistantMessageId,
      sessionKey: nextSessionKey,
      requestMessages,
      selectedBackend,
      selectedModel,
      settings: activeSettings,
      onPatchThread: patchThread,
      onError: (error) => {
        showUiError("chat", error, { providerLabel: activeBackend?.label || selectedBackend });
      },
      onComplete: () => {
        setStreamingThreadId(null);
        streamAbortRef.current = null;
      },
      abortController: controller,
    });
  }

  async function handleEditUserMessage(messageId: string, nextContent: string) {
    if (!activeThread || !selectedBackend || !selectedModel || isStreaming) return;

    const trimmed = nextContent.trim();
    if (!trimmed) return;

    const messages = activeThread.messages;
    const userMessageIndex = messages.findIndex(
      (message) => message.id === messageId && message.role === "user"
    );
    if (userMessageIndex < 0) return;

    const updatedHistory = messages.slice(0, userMessageIndex + 1).map((message) => {
      if (message.id !== messageId) return message;
      return {
        ...message,
        content: trimmed,
      };
    });

    const threadId = activeThread.id;
    const nextSessionKey = createId();
    setSessionKeysByThread((current) => ({
      ...current,
      [threadId]: nextSessionKey,
    }));
    const newAssistantMessageId = createId();
    const newAssistantMessage: ChatMessage = {
      id: newAssistantMessageId,
      role: "assistant",
      content: "",
      createdAt: Date.now(),
      metrics: {
        startedAt: Date.now(),
        providerId: selectedBackend,
        modelId: selectedModel,
        tokenSource: "estimate",
      },
    };

    clearUiError("chat");
    setStreamingThreadId(threadId);

    patchThread(threadId, (thread) => ({
      ...thread,
      title: userMessageIndex === 0 ? buildThreadTitle(trimmed) : thread.title,
      updatedAt: Date.now(),
      backend: selectedBackend,
      model: selectedModel,
      messages: [...updatedHistory, newAssistantMessage],
    }));

    const requestMessages: RequestMessage[] = updatedHistory.map((message) => ({
      role: message.role,
      content: message.modelContent ?? message.content,
      attachments: message.attachments,
    }));

    const controller = new AbortController();
    streamAbortRef.current = controller;

    await streamAssistantResponse({
      threadId,
      assistantMessageId: newAssistantMessageId,
      sessionKey: nextSessionKey,
      requestMessages,
      selectedBackend,
      selectedModel,
      settings: activeSettings,
      onPatchThread: patchThread,
      onError: (error) => {
        showUiError("chat", error, { providerLabel: activeBackend?.label || selectedBackend });
      },
      onComplete: () => {
        setStreamingThreadId(null);
        streamAbortRef.current = null;
      },
      abortController: controller,
    });
  }

  // ── Render ─────────────────────────────────────────────────────────

  if (isBootPhase) {
    return (
      <main
        id="main-content"
        className="relative h-dvh w-full overflow-hidden"
        style={{ background: "var(--fast-surface-bg)", color: "var(--fast-surface-text)" }}
      />
    );
  }

  return (
    <main id="main-content" className={providerTheme.layout.main}>
      <div className="flex h-full w-full overflow-hidden">
        <ChatSidebar
          theme={providerTheme}
          className={
            "fixed inset-y-0 left-0 z-40 flex h-dvh w-[min(82vw,276px)] flex-col overflow-hidden transition-all duration-200 md:static md:z-auto md:shadow-none " +
            providerTheme.layout.sidebarShell +
            " " +
            (mobileSidebarOpen ? "translate-x-0" : "-translate-x-full") +
            " " +
            (sidebarCollapsed
              ? "md:w-[56px] md:translate-x-0 md:opacity-100 md:pointer-events-auto"
              : "md:w-[248px] md:translate-x-0 md:opacity-100")
          }
          threads={sortedThreads}
          selectedThreadId={selectedThreadId}
          onSelectChat={handleSelectChat}
          onRenameChat={handleRenameChat}
          onDeleteChat={handleDeleteChat}
          onNewChat={handleNewChat}
          isCollapsed={sidebarCollapsed}
          onToggleCollapse={handleToggleDesktopSidebar}
          isSettingsOpen={isSettingsView}
          onOpenSettings={handleOpenSettings}
        />

        <div
          className={
            "absolute inset-0 z-30 transition md:hidden " +
            providerTheme.layout.overlay +
            " " +
            (mobileSidebarOpen ? "pointer-events-auto opacity-100" : "pointer-events-none opacity-0")
          }
          onClick={() => setMobileSidebarOpen(false)}
        />

        <section className={"relative flex min-w-0 flex-1 flex-col overflow-hidden " + providerTheme.layout.content}>
          <ChatTopbar
            theme={providerTheme}
            providerLabel={activeBackend?.label || "Provider"}
            threadTitle={isSettingsView ? "Settings" : activeThread?.title || "New chat"}
            onOpenMobileSidebar={handleOpenMobileSidebar}
          />

          {uiError ? (
            <div
              className="pointer-events-none absolute inset-x-3 top-16 z-40 sm:inset-x-auto sm:right-4 sm:w-[440px]"
              role="status"
              aria-live="polite"
            >
              <div
                className={
                  "pointer-events-auto rounded-2xl border px-4 py-3 shadow-[0_14px_34px_rgba(47,47,45,0.12)] " +
                  (providerTheme.isDark ? "border-[#4a4841] bg-[#2a2926]" : "border-[#d6d5d2] bg-[#fbfaf6]")
                }
              >
                <div className="flex items-start gap-3">
                  <span className="mt-[7px] h-2 w-2 shrink-0 rounded-full bg-[#a35b39]" />
                  <div className="min-w-0 flex-1">
                    <p className={"text-sm font-semibold " + providerTheme.layout.errorText}>{uiError.title}</p>
                    <p className={"mt-0.5 text-sm " + (providerTheme.isDark ? "text-[#c8c1b5]" : "text-[#625c51]")}>
                      {uiError.message}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => clearUiError(uiError.scope)}
                    className={
                      "inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border text-[15px] leading-none transition " +
                      (providerTheme.isDark
                        ? "border-[#4a4841] text-[#b7afa3] hover:bg-[#34322e] hover:text-[#ece7dd]"
                        : "border-[#d6d5d2] text-[#847f74] hover:bg-[#f2f1ed] hover:text-[#4f4b43]")
                    }
                    aria-label="Dismiss notification"
                  >
                    ×
                  </button>
                </div>
              </div>
            </div>
          ) : null}

          <div className="flex min-h-0 flex-1 flex-col">
            {isSettingsView ? (
              <SettingsView
                theme={providerTheme}
                appearanceMode={appearanceMode}
                streamReadabilityPace={streamReadabilityPace}
                onAppearanceModeSelect={handleAppearanceModeSelect}
                onStreamReadabilityPaceChange={handleStreamReadabilityPaceChange}
                onProvidersChanged={() => setBackendsReloadNonce((current) => current + 1)}
              />
            ) : hasMessages ? (
              <>
                <ChatMessages
                  theme={providerTheme}
                  threadId={selectedThreadId}
                  messages={activeMessages}
                  isStreaming={isStreaming}
                  streamReadabilityPace={streamReadabilityPace}
                  onRegenerateFromAssistantMessage={handleRegenerateFromAssistantMessage}
                  onEditUserMessage={handleEditUserMessage}
                  streamForActiveThread={streamingThreadId === activeThread?.id}
                />

                <OllamaTerminal
                  theme={providerTheme}
                  isOpen={selectedBackend === "ollama" && ollamaTerminalOpen}
                  layout="docked"
                  selectedModel={selectedModel}
                  onClose={() => setOllamaTerminalOpen(false)}
                />

                <ChatComposer
                  theme={providerTheme}
                  layout="docked"
                  backends={backends}
                  selectedBackend={selectedBackend}
                  models={models}
                  selectedModel={selectedModel}
                  capabilities={activeCapabilities}
                  modelCapabilities={activeModelCapabilities}
                  settings={activeSettings}
                  isStreaming={isStreaming}
                  prompt={prompt}
                  promptArtifacts={composerPromptArtifacts}
                  attachments={composerAttachments}
                  fallbackAttachmentCount={fallbackAttachmentCount}
                  isUploadingAttachments={isUploadingAttachments}
                  isDisabled={isStreaming || isUploadingAttachments}
                  canSend={canSend}
                  showOllamaTerminal={selectedBackend === "ollama"}
                  isOllamaTerminalOpen={ollamaTerminalOpen}
                  onAttachFiles={handleAttachFiles}
                  onRemoveAttachment={handleRemoveAttachment}
                  onRemovePromptArtifact={handleRemovePromptArtifact}
                  onSelectBackend={handleSelectBackend}
                  onSelectModel={setSelectedModel}
                  onRefreshModels={handleRefreshModels}
                  onSettingsChange={handleSettingsChange}
                  onToggleOllamaTerminal={() => setOllamaTerminalOpen((value) => !value)}
                  onStopStreaming={handleStopStreaming}
                  onPromptChange={handlePromptChange}
                  onPromptKeyDown={handlePromptKeyDown}
                  onPromptPaste={handlePromptPaste}
                  onSubmit={handleSubmit}
                />
              </>
            ) : (
              <section className={providerTheme.layout.emptySection}>
                <div className="mx-auto w-full max-w-[var(--standard-flow-width)]">
                  <h2 className={providerTheme.layout.emptyHeading}>
                    <span>{providerTheme.copy.heroHeading}</span>
                  </h2>
                </div>

                <OllamaTerminal
                  theme={providerTheme}
                  isOpen={selectedBackend === "ollama" && ollamaTerminalOpen}
                  layout="landing"
                  selectedModel={selectedModel}
                  onClose={() => setOllamaTerminalOpen(false)}
                />

                <ChatComposer
                  theme={providerTheme}
                  layout="landing"
                  backends={backends}
                  selectedBackend={selectedBackend}
                  models={models}
                  selectedModel={selectedModel}
                  capabilities={activeCapabilities}
                  modelCapabilities={activeModelCapabilities}
                  settings={activeSettings}
                  isStreaming={isStreaming}
                  prompt={prompt}
                  promptArtifacts={composerPromptArtifacts}
                  attachments={composerAttachments}
                  fallbackAttachmentCount={fallbackAttachmentCount}
                  isUploadingAttachments={isUploadingAttachments}
                  isDisabled={isStreaming || isUploadingAttachments}
                  canSend={canSend}
                  showOllamaTerminal={selectedBackend === "ollama"}
                  isOllamaTerminalOpen={ollamaTerminalOpen}
                  onAttachFiles={handleAttachFiles}
                  onRemoveAttachment={handleRemoveAttachment}
                  onRemovePromptArtifact={handleRemovePromptArtifact}
                  onSelectBackend={handleSelectBackend}
                  onSelectModel={setSelectedModel}
                  onRefreshModels={handleRefreshModels}
                  onSettingsChange={handleSettingsChange}
                  onToggleOllamaTerminal={() => setOllamaTerminalOpen((value) => !value)}
                  onStopStreaming={handleStopStreaming}
                  onPromptChange={handlePromptChange}
                  onPromptKeyDown={handlePromptKeyDown}
                  onPromptPaste={handlePromptPaste}
                  onSubmit={handleSubmit}
                />
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
