"use client";

import { memo, useEffect, useRef, useState } from "react";
import type { ClipboardEvent, DragEvent, FormEvent, KeyboardEvent } from "react";
import type {
  BackendCapabilities,
  BackendOption,
  ChatArtifact,
  ChatAttachment,
  ChatSettings,
  ModelCapabilities,
  ModelOption,
} from "../../lib/types";
import { CloseIcon, PaperclipIcon, SendIcon, SlidersIcon, StopIcon, TerminalIcon } from "./ui-icons";
import type { ProviderTheme } from "./providers";
import { ComposerAttachments } from "./composer-attachments";
import { formatBytes } from "../../lib/utils";

type ChatComposerProps = {
  theme: ProviderTheme;
  layout: "landing" | "docked";
  backends: BackendOption[];
  selectedBackend: string;
  models: ModelOption[];
  selectedModel: string;
  capabilities: BackendCapabilities;
  modelCapabilities: ModelCapabilities;
  settings: ChatSettings;
  isStreaming: boolean;
  prompt: string;
  promptArtifacts: ChatArtifact[];
  attachments: ChatAttachment[];
  fallbackAttachmentCount: number;
  isUploadingAttachments: boolean;
  isDisabled: boolean;
  canSend: boolean;
  showOllamaTerminal: boolean;
  isOllamaTerminalOpen: boolean;
  onAttachFiles: (files: FileList | null) => void;
  onRemoveAttachment: (attachmentId: string) => void;
  onRemovePromptArtifact: (artifactId: string) => void;
  onSelectBackend: (backendId: string) => void;
  onSelectModel: (modelId: string) => void;
  onRefreshModels: () => void;
  onSettingsChange: (settings: Partial<ChatSettings>) => void;
  onToggleOllamaTerminal: () => void;
  onStopStreaming: () => void;
  onPromptChange: (value: string) => void;
  onPromptKeyDown: (event: KeyboardEvent<HTMLTextAreaElement>) => void;
  onPromptPaste: (event: ClipboardEvent<HTMLTextAreaElement>) => void;
  onSubmit: (event: FormEvent<HTMLFormElement>) => void;
};

function NumberField(props: {
  label: string;
  value: number;
  min?: number;
  max?: number;
  step?: number;
  disabled: boolean;
  labelClass: string;
  inputClass: string;
  onChange: (value: number) => void;
}) {
  const { label, value, min, max, step = 1, disabled, labelClass, inputClass, onChange } = props;

  return (
    <label className="space-y-1.5">
      <span className={labelClass}>{label}</span>
      <input
        type="number"
        min={min}
        max={max}
        step={step}
        value={value}
        disabled={disabled}
        onChange={(event) => {
          const parsed = Number(event.target.value);
          if (Number.isFinite(parsed)) {
            onChange(parsed);
          }
        }}
        className={inputClass}
      />
    </label>
  );
}

function ChatComposerImpl({
  theme,
  layout,
  backends,
  selectedBackend,
  models,
  selectedModel,
  capabilities,
  modelCapabilities,
  settings,
  isStreaming,
  prompt,
  promptArtifacts,
  attachments,
  fallbackAttachmentCount,
  isUploadingAttachments,
  isDisabled,
  canSend,
  showOllamaTerminal,
  isOllamaTerminalOpen,
  onAttachFiles,
  onRemoveAttachment,
  onRemovePromptArtifact,
  onSelectBackend,
  onSelectModel,
  onRefreshModels,
  onSettingsChange,
  onToggleOllamaTerminal,
  onStopStreaming,
  onPromptChange,
  onPromptKeyDown,
  onPromptPaste,
  onSubmit,
}: ChatComposerProps) {
  const textareaRef = useRef<HTMLTextAreaElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const dragDepthRef = useRef(0);
  const [showSettings, setShowSettings] = useState(false);
  const [isDragOver, setIsDragOver] = useState(false);
  const selectedBackendOption = backends.find((backend) => backend.id === selectedBackend) ?? null;
  const selectedModelOption = models.find((model) => model.id === selectedModel) ?? null;
  const isDark = theme.isDark;
  const attachmentHintClass = isDark ? "text-[#9f988b]" : "text-[#7f796f]";

  const supportsAnyAttachments =
    modelCapabilities.imageInput ||
    modelCapabilities.documentInput ||
    modelCapabilities.audioInput ||
    modelCapabilities.videoInput ||
    modelCapabilities.binaryInput ||
    modelCapabilities.textInput;

  useEffect(() => {
    const node = textareaRef.current;
    if (!node) return;

    const minHeight = 44;
    const maxHeight = 160;

    node.style.height = String(minHeight) + "px";
    const nextHeight = Math.max(minHeight, Math.min(node.scrollHeight, maxHeight));
    node.style.height = String(nextHeight) + "px";
    node.style.overflowY = node.scrollHeight > maxHeight ? "auto" : "hidden";
  }, [prompt]);

  useEffect(() => {
    if (!isDisabled && !isStreaming) return;
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }, [isDisabled, isStreaming]);

  function hasDraggedFiles(event: DragEvent<HTMLElement>) {
    return Array.from(event.dataTransfer?.types ?? []).includes("Files");
  }

  function clearDragState() {
    dragDepthRef.current = 0;
    setIsDragOver(false);
  }

  function handleComposerDragEnter(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled || isStreaming || isUploadingAttachments || !supportsAnyAttachments) return;
    dragDepthRef.current += 1;
    setIsDragOver(true);
  }

  function handleComposerDragOver(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (isDisabled || isStreaming || isUploadingAttachments || !supportsAnyAttachments) return;
    event.dataTransfer.dropEffect = "copy";
    if (!isDragOver) {
      setIsDragOver(true);
    }
  }

  function handleComposerDragLeave(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();
    if (dragDepthRef.current > 0) {
      dragDepthRef.current -= 1;
    }
    if (dragDepthRef.current <= 0) {
      clearDragState();
    }
  }

  function handleComposerDrop(event: DragEvent<HTMLDivElement>) {
    if (!hasDraggedFiles(event)) return;
    event.preventDefault();
    event.stopPropagation();

    if (!isDisabled && !isStreaming && !isUploadingAttachments && supportsAnyAttachments) {
      onAttachFiles(event.dataTransfer?.files ?? null);
    }
    clearDragState();
  }

  const composerCardClass =
    "composer-focus-ring " +
    theme.composer.card +
    (isDragOver
      ? isDark
        ? " ring-2 ring-[#8cb9ff] ring-offset-2 ring-offset-[#1F1F1E]"
        : " ring-2 ring-[#2f7de1] ring-offset-2 ring-offset-[#faf9f5]"
      : "");
  const promptArtifactDockClass = isDark
    ? "mb-2 grid gap-2 sm:grid-cols-2"
    : "mb-2 grid gap-2 sm:grid-cols-2";
  const promptArtifactCardClass = isDark
    ? "rounded-md border border-[#4a4841] bg-[#23221f] px-3 py-2"
    : "rounded-md border border-[#d6d5d2] bg-[#f8f6f0] px-3 py-2";
  const promptArtifactMetaClass = isDark ? "text-[#a9a193]" : "text-[#7a756b]";
  const promptArtifactTextClass = isDark ? "text-[#d6cfc3]" : "text-[#4a453d]";
  const promptArtifactRemoveClass = isDark
    ? "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#5a564c] bg-[#2f2d28] text-[#d6cfc3] hover:bg-[#3a3832]"
    : "inline-flex h-7 w-7 items-center justify-center rounded-md border border-[#c9c7c0] bg-[#f5f3ec] text-[#5d584f] hover:bg-[#ece9e1]";

  function promptArtifactExtension(artifact: ChatArtifact) {
    if (artifact.source === "auto-code-bundle") {
      return (artifact.language || "code").toLowerCase();
    }
    return "txt";
  }

  return (
    <form
      className={layout === "landing" ? theme.composer.formLanding : theme.composer.formDocked}
      onSubmit={onSubmit}
    >
      <ComposerAttachments
        theme={theme}
        attachments={attachments}
        disabled={isStreaming || isUploadingAttachments}
        onRemoveAttachment={onRemoveAttachment}
      />

      <div
        className={composerCardClass}
        onDragEnter={handleComposerDragEnter}
        onDragOver={handleComposerDragOver}
        onDragLeave={handleComposerDragLeave}
        onDrop={handleComposerDrop}
      >
        {promptArtifacts.length ? (
          <div className={promptArtifactDockClass}>
            {promptArtifacts.map((artifact) => (
              <div key={artifact.id} className={promptArtifactCardClass}>
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0">
                    <p className={"truncate text-sm font-medium uppercase tracking-wide " + promptArtifactTextClass}>
                      {promptArtifactExtension(artifact)}
                    </p>
                    <p className={"truncate text-[11px] " + promptArtifactMetaClass}>
                      {(artifact.lineCount ?? 0).toLocaleString()} lines • {formatBytes(artifact.sizeBytes)}
                    </p>
                  </div>
                  <button
                    type="button"
                    className={promptArtifactRemoveClass}
                    onClick={() => onRemovePromptArtifact(artifact.id)}
                    aria-label={`Remove ${promptArtifactExtension(artifact)} artifact`}
                    title="Remove artifact"
                  >
                    <CloseIcon className="h-3.5 w-3.5" />
                  </button>
                </div>
              </div>
            ))}
          </div>
        ) : null}

        <label htmlFor="chat-prompt" className="sr-only">
          Message input
        </label>
        <textarea
          id="chat-prompt"
          ref={textareaRef}
          data-ignore-global-keys="1"
          className={theme.composer.textarea}
          value={prompt}
          onChange={(event) => onPromptChange(event.target.value)}
          onKeyDown={onPromptKeyDown}
          onPaste={onPromptPaste}
          placeholder={theme.copy.promptPlaceholder}
          rows={1}
          disabled={isDisabled}
        />

        <div className={theme.composer.controlsDivider}>
          <div className="flex min-w-0 items-center gap-2">
            {backends.length > 1 ? (
              <select
                className={theme.composer.control + " min-w-[8rem] max-w-[36vw]"}
                value={selectedBackend}
                onChange={(event) => onSelectBackend(event.target.value)}
                disabled={!backends.length || isStreaming}
                aria-label="Backend"
              >
                {!backends.length ? <option value="">Backends...</option> : null}
                {backends.map((backend) => (
                  <option key={backend.id} value={backend.id}>
                    {backend.label}
                  </option>
                ))}
              </select>
            ) : (
              <span className={theme.composer.backendChip}>
                {backends[0]?.label || selectedBackend || "Backend"}
              </span>
            )}

            <select
              className={theme.composer.control + " min-w-[11rem] max-w-[56vw]"}
              value={selectedModel}
              onChange={(event) => onSelectModel(event.target.value)}
              onMouseDown={onRefreshModels}
              onFocus={onRefreshModels}
              disabled={!models.length || !selectedBackend || isStreaming}
              aria-label="Model"
            >
              {!models.length ? <option value="">Models...</option> : null}
              {models.map((model) => (
                <option key={model.id} value={model.id}>
                  {model.meta ? model.id + " · " + model.meta : model.id}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              className="sr-only"
              multiple
              onChange={(event) => {
                onAttachFiles(event.currentTarget.files);
                event.currentTarget.value = "";
              }}
              disabled={isStreaming || isDisabled || isUploadingAttachments || !supportsAnyAttachments}
              data-ignore-global-keys="1"
            />

            <button
              type="button"
              className={theme.composer.iconButton}
              onClick={() => fileInputRef.current?.click()}
              aria-label="Attach files"
              title="Attach files"
              disabled={isStreaming || isDisabled || isUploadingAttachments || !supportsAnyAttachments}
            >
              <PaperclipIcon className="h-4 w-4" />
            </button>

            {showOllamaTerminal ? (
              <button
                type="button"
                className={
                  isOllamaTerminalOpen ? theme.composer.iconButtonActive : theme.composer.iconButton
                }
                onClick={onToggleOllamaTerminal}
                aria-label={isOllamaTerminalOpen ? "Hide Ollama terminal" : "Show Ollama terminal"}
                aria-expanded={isOllamaTerminalOpen}
                aria-controls="ollama-terminal-panel"
              >
                <TerminalIcon className="h-4 w-4" />
              </button>
            ) : null}

            <button
              type="button"
              className={theme.composer.iconButton}
              onClick={() => setShowSettings((value) => !value)}
              aria-label={showSettings ? "Hide settings" : "Show settings"}
            >
              <SlidersIcon className="h-4 w-4" />
            </button>

            {isStreaming ? (
              <button
                type="button"
                className={theme.composer.stopButton}
                onClick={onStopStreaming}
                aria-label="Stop generating"
              >
                  <StopIcon className="h-4 w-4" />
                </button>
              ) : (
                <button
                  type="submit"
                  className={theme.composer.sendButton}
                  disabled={!canSend}
                  aria-label="Send message"
                >
                  <SendIcon className="h-4 w-4" />
                </button>
            )}
          </div>
        </div>

        {(isUploadingAttachments ||
          attachments.length > 0 ||
          fallbackAttachmentCount > 0) && (
          <div className={theme.composer.metaRow}>
            {attachments.length ? (
              <span className={attachmentHintClass}>
                Attachments: {attachments.length}/{modelCapabilities.maxAttachments}
              </span>
            ) : null}
            {fallbackAttachmentCount > 0 ? (
              <span className={attachmentHintClass}>
                {fallbackAttachmentCount} attachment(s) will be sent as text context for this model.
              </span>
            ) : null}
            {isUploadingAttachments ? (
              <span className={attachmentHintClass}>Uploading attachments...</span>
            ) : null}
          </div>
        )}
      </div>

      {showSettings ? (
        <div className={theme.composer.settingsPanel}>
          <p className={theme.composer.settingsTitle}>Generation settings</p>

          {capabilities.systemPrompt ? (
            <div className="mt-3">
              <label className={"mb-1.5 " + theme.composer.settingsLabel}>System prompt</label>
              <textarea
                className={theme.composer.settingsInput}
                rows={3}
                value={settings.systemPrompt}
                onChange={(event) => onSettingsChange({ systemPrompt: event.target.value })}
                disabled={isStreaming}
                placeholder="Instructions for model behavior..."
              />
            </div>
          ) : null}

          <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {capabilities.temperature ? (
              <NumberField
                label="Temperature"
                value={settings.temperature}
                min={0}
                max={2}
                step={0.1}
                disabled={isStreaming}
                labelClass={theme.composer.settingsLabel}
                inputClass={theme.composer.settingsInput}
                onChange={(value) => onSettingsChange({ temperature: value })}
              />
            ) : null}

            {capabilities.topP ? (
              <NumberField
                label="Top P"
                value={settings.topP}
                min={0}
                max={1}
                step={0.05}
                disabled={isStreaming}
                labelClass={theme.composer.settingsLabel}
                inputClass={theme.composer.settingsInput}
                onChange={(value) => onSettingsChange({ topP: value })}
              />
            ) : null}

            {capabilities.topK ? (
              <NumberField
                label="Top K"
                value={settings.topK}
                min={1}
                step={1}
                disabled={isStreaming}
                labelClass={theme.composer.settingsLabel}
                inputClass={theme.composer.settingsInput}
                onChange={(value) => onSettingsChange({ topK: value })}
              />
            ) : null}

            {capabilities.maxTokens ? (
              <NumberField
                label="Max tokens"
                value={settings.maxTokens}
                min={1}
                step={1}
                disabled={isStreaming}
                labelClass={theme.composer.settingsLabel}
                inputClass={theme.composer.settingsInput}
                onChange={(value) => onSettingsChange({ maxTokens: value })}
              />
            ) : null}

            {capabilities.contextWindow ? (
              <NumberField
                label="Context window"
                value={settings.contextWindow}
                min={256}
                step={256}
                disabled={isStreaming}
                labelClass={theme.composer.settingsLabel}
                inputClass={theme.composer.settingsInput}
                onChange={(value) => onSettingsChange({ contextWindow: value })}
              />
            ) : null}

            {capabilities.repeatPenalty ? (
              <NumberField
                label="Repeat penalty"
                value={settings.repeatPenalty}
                min={0.5}
                max={2}
                step={0.05}
                disabled={isStreaming}
                labelClass={theme.composer.settingsLabel}
                inputClass={theme.composer.settingsInput}
                onChange={(value) => onSettingsChange({ repeatPenalty: value })}
              />
            ) : null}

            {capabilities.seed ? (
              <label className="space-y-1.5">
                <span className={theme.composer.settingsLabel}>Seed</span>
                <input
                  type="text"
                  inputMode="numeric"
                  value={settings.seed}
                  onChange={(event) => onSettingsChange({ seed: event.target.value })}
                  disabled={isStreaming}
                  placeholder="Optional"
                  className={theme.composer.settingsInput}
                />
              </label>
            ) : null}

            {capabilities.keepAlive ? (
              <label className="space-y-1.5">
                <span className={theme.composer.settingsLabel}>Keep alive</span>
                <input
                  type="text"
                  value={settings.keepAlive}
                  onChange={(event) => onSettingsChange({ keepAlive: event.target.value })}
                  disabled={isStreaming}
                  placeholder="5m, 1h, -1"
                  className={theme.composer.settingsInput}
                />
              </label>
            ) : null}

            {capabilities.jsonMode ? (
              <label className={theme.composer.settingsSwitch}>
                <span className={theme.composer.settingsLabel}>JSON mode</span>
                <input
                  type="checkbox"
                  checked={settings.jsonMode}
                  onChange={(event) => onSettingsChange({ jsonMode: event.target.checked })}
                  disabled={isStreaming}
                  className="h-4 w-4 rounded border-stone-300 accent-stone-700 disabled:opacity-60"
                />
              </label>
            ) : null}
          </div>

          {capabilities.stopSequences ? (
            <div className="mt-3">
              <label className={"mb-1.5 " + theme.composer.settingsLabel}>
                Stop sequences (one per line)
              </label>
              <textarea
                className={theme.composer.settingsInput}
                rows={2}
                value={settings.stopSequences}
                onChange={(event) => onSettingsChange({ stopSequences: event.target.value })}
                disabled={isStreaming}
                placeholder="###"
              />
            </div>
          ) : null}
        </div>
      ) : null}
    </form>
  );
}

function areComposerPropsEqual(prev: ChatComposerProps, next: ChatComposerProps) {
  if (prev.theme !== next.theme) return false;
  if (prev.layout !== next.layout) return false;
  if (prev.backends !== next.backends) return false;
  if (prev.selectedBackend !== next.selectedBackend) return false;
  if (prev.models !== next.models) return false;
  if (prev.selectedModel !== next.selectedModel) return false;
  if (prev.capabilities !== next.capabilities) return false;
  if (prev.modelCapabilities !== next.modelCapabilities) return false;
  if (prev.settings !== next.settings) return false;
  if (prev.isStreaming !== next.isStreaming) return false;
  if (prev.prompt !== next.prompt) return false;
  if (prev.fallbackAttachmentCount !== next.fallbackAttachmentCount) return false;
  if (prev.isUploadingAttachments !== next.isUploadingAttachments) return false;
  if (prev.isDisabled !== next.isDisabled) return false;
  if (prev.canSend !== next.canSend) return false;
  if (prev.showOllamaTerminal !== next.showOllamaTerminal) return false;
  if (prev.isOllamaTerminalOpen !== next.isOllamaTerminalOpen) return false;
  if (prev.attachments.length !== next.attachments.length) return false;

  for (let index = 0; index < prev.attachments.length; index += 1) {
    const left = prev.attachments[index];
    const right = next.attachments[index];
    if (
      left.id !== right.id ||
      left.name !== right.name ||
      left.kind !== right.kind ||
      left.mimeType !== right.mimeType ||
      left.sizeBytes !== right.sizeBytes
    ) {
      return false;
    }
  }

  return true;
}

export const ChatComposer = memo(ChatComposerImpl, areComposerPropsEqual);
