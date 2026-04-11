"use client";

import {
  ClipboardEvent as ReactClipboardEvent,
  KeyboardEvent,
  useCallback,
  useEffect,
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
  AppView,
  ChatAttachment,
  UiError,
  UiErrorContext,
  UiErrorScope,
} from "../lib/types";
import { getProviderTheme } from "../components/chat/providers";
import {
  BOOT_PROMPT_MAX_CHARS,
  UPLOAD_MAX_FILES_PER_BATCH,
  UPLOAD_MAX_TOTAL_BATCH_BYTES,
} from "../lib/constants";
import {
  areAttachmentsEqual,
  createFriendlyUiError,
  formatBytes,
  normalizeAttachments,
  supportsAttachmentKind,
} from "../lib/utils";
import { extractInlineDraftArtifacts } from "../lib/message-artifacts";
import { useChatPreferences } from "../hooks/use-chat-preferences";
import { useChatStreaming, useChatStreamingController } from "../hooks/use-chat-streaming";
import { useChatThreads } from "../hooks/use-chat-threads";
import { useProviderSelection } from "../hooks/use-provider-selection";

export default function Page() {
  const [isUploadingAttachments, setIsUploadingAttachments] = useState(false);
  const [hasBootedUi, setHasBootedUi] = useState(false);
  const [bootPromptBuffer, setBootPromptBuffer] = useState("");
  const [uiError, setUiError] = useState<UiError | null>(null);
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [mobileSidebarOpen, setMobileSidebarOpen] = useState(false);
  const [ollamaTerminalOpen, setOllamaTerminalOpen] = useState(false);
  const [activeView, setActiveView] = useState<AppView>("chat");

  const bootPromptAppliedRef = useRef(false);
  const streaming = useChatStreamingController();
  const { streamingThreadId, isStreaming, stopStreaming, abortThreadIfStreaming } = streaming;

  const {
    threadsRef,
    selectedThreadId,
    setSelectedThreadId,
    activeThread,
    sortedThreads,
    prompt,
    promptRef,
    applyPromptValue,
    composerAttachments,
    setComposerAttachments,
    composerPromptArtifacts,
    isStorageHydrated,
    patchThread,
    clearDraftForThread,
    appendPromptArtifacts,
    removePromptArtifact,
    createNewThread,
    deleteThread,
    renameThread,
    setSessionKeyForThread,
    getSessionKeyForThread,
  } = useChatThreads({ streamingThreadId });

  const {
    backends,
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
  } = useProviderSelection({
    activeThread,
    isStreaming,
    onClearModelsError: () => clearUiError("models"),
    onModelsError: (error, providerLabel) =>
      showUiError("models", error, providerLabel ? { providerLabel } : undefined),
  });

  const {
    appearanceMode,
    resolvedAppearanceMode,
    streamReadabilityPace,
    preferencesReady,
    activeSettings,
    selectAppearanceMode,
    selectStreamReadabilityPace,
    updateActiveSettings,
  } = useChatPreferences(selectedBackend);

  const {
    canSend,
    submitMessage,
    regenerateFromAssistantMessage,
    editUserMessage,
  } = useChatStreaming({
    activeThread,
    selectedBackend,
    selectedModel,
    activeSettings,
    providerLabel: activeBackend?.label || selectedBackend,
    prompt,
    composerAttachments,
    composerPromptArtifacts,
    isUploadingAttachments,
    patchThread,
    clearDraftForThread,
    getSessionKeyForThread,
    setSessionKeyForThread,
    onClearChatError: () => clearUiError("chat"),
    onChatError: (error, providerLabel) => showUiError("chat", error, { providerLabel }),
    streaming,
  });

  // ── Derived state ──────────────────────────────────────────────────

  const activeMessages = activeThread?.messages ?? [];
  const hasMessages = activeMessages.length > 0;
  const isSettingsView = activeView === "settings";
  const fallbackAttachmentCount = useMemo(
    () =>
      composerAttachments.reduce((count, attachment) => {
        return supportsAttachmentKind(attachment.kind, activeModelCapabilities) ? count : count + 1;
      }, 0),
    [composerAttachments, activeModelCapabilities]
  );

  const providerTheme = useMemo(
    () => getProviderTheme(resolvedAppearanceMode),
    [resolvedAppearanceMode]
  );
  const prerequisitesReady =
    preferencesReady && isStorageHydrated && backendsReady && modelsReady;
  const isBootPhase = !hasBootedUi && !prerequisitesReady;

  // ── Helpers ────────────────────────────────────────────────────────

  function handlePromptChange(nextPrompt: string) {
    applyPromptValue(nextPrompt);
  }

  function handleRemovePromptArtifact(artifactId: string) {
    removePromptArtifact(artifactId);
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
  }, [isBootPhase, applyPromptValue]);

  useEffect(() => {
    if (isBootPhase) return;
    if (bootPromptAppliedRef.current) return;
    bootPromptAppliedRef.current = true;

    const capturedPrompt = bootPromptBuffer;
    if (!capturedPrompt) return;

    const nextPrompt = (promptRef.current + capturedPrompt).slice(0, BOOT_PROMPT_MAX_CHARS);
    applyPromptValue(nextPrompt);
    setBootPromptBuffer("");
  }, [isBootPhase, bootPromptBuffer, applyPromptValue]);

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

  const handleNewChat = useCallback(() => {
    createNewThread(selectedBackendRef.current, selectedModelRef.current);
    setActiveView("chat");
    setUiError((current) => {
      if (!current || current.scope === "chat") return null;
      return current;
    });
    setMobileSidebarOpen(false);
  }, [createNewThread]);

  const handleDeleteChat = useCallback((threadId: string) => {
    abortThreadIfStreaming(threadId);
    deleteThread(threadId, selectedBackendRef.current, selectedModelRef.current);
  }, [abortThreadIfStreaming, deleteThread, selectedBackendRef, selectedModelRef]);

  const handleRenameChat = useCallback((threadId: string, title: string) => {
    renameThread(threadId, title);
  }, [renameThread]);

  const handleSelectChat = useCallback((threadId: string) => {
    const selectedThread = threadsRef.current.find((thread) => thread.id === threadId) ?? null;
    if (!selectedThread) return;

    selectThreadProvider(selectedThread);
    setSelectedThreadId(threadId);
    setActiveView("chat");
    setMobileSidebarOpen(false);
    setUiError((current) => {
      if (!current || current.scope === "chat") return null;
      return current;
    });
  }, [selectThreadProvider, setSelectedThreadId, threadsRef]);

  const handleOpenMobileSidebar = useCallback(() => {
    setMobileSidebarOpen(true);
  }, []);

  const handleToggleDesktopSidebar = useCallback(() => {
    setSidebarCollapsed((value) => !value);
  }, []);

  function handleStopStreaming() {
    stopStreaming();
  }

  function handleSelectBackend(backendId: string) {
    selectBackend(backendId);
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

  function handleRefreshModels() {
    void refreshModels();
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
                onAppearanceModeSelect={selectAppearanceMode}
                onStreamReadabilityPaceChange={selectStreamReadabilityPace}
                onProvidersChanged={reloadBackends}
              />
            ) : hasMessages ? (
              <>
                <ChatMessages
                  theme={providerTheme}
                  threadId={selectedThreadId}
                  messages={activeMessages}
                  isStreaming={isStreaming}
                  streamReadabilityPace={streamReadabilityPace}
                  onRegenerateFromAssistantMessage={regenerateFromAssistantMessage}
                  onEditUserMessage={editUserMessage}
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
                  onSelectModel={selectModel}
                  onRefreshModels={handleRefreshModels}
                  onSettingsChange={updateActiveSettings}
                  onToggleOllamaTerminal={() => setOllamaTerminalOpen((value) => !value)}
                  onStopStreaming={handleStopStreaming}
                  onPromptChange={handlePromptChange}
                  onPromptKeyDown={handlePromptKeyDown}
                  onPromptPaste={handlePromptPaste}
                  onSubmit={submitMessage}
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
                  onSelectModel={selectModel}
                  onRefreshModels={handleRefreshModels}
                  onSettingsChange={updateActiveSettings}
                  onToggleOllamaTerminal={() => setOllamaTerminalOpen((value) => !value)}
                  onStopStreaming={handleStopStreaming}
                  onPromptChange={handlePromptChange}
                  onPromptKeyDown={handlePromptKeyDown}
                  onPromptPaste={handlePromptPaste}
                  onSubmit={submitMessage}
                />
              </section>
            )}
          </div>
        </section>
      </div>
    </main>
  );
}
