"use client";

import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { MessageContent } from "./message-content";
import type { ChatArtifact, ChatMessage, ChatMessageMetrics } from "../../lib/types";
import { CheckIcon, CopyIcon, EditIcon, RefreshIcon, ChevronDownIcon } from "./ui-icons";
import type { ProviderTheme } from "./providers";
import { splitByCodeBlocks, countLines } from "../../lib/utils";
import {
  ArtifactCard,
  ArtifactStrip,
  AttachmentStrip,
  artifactSizeBytes,
  buildArtifactClasses,
} from "./chat-message-artifacts";
import { useMessageEditing } from "../../hooks/use-message-editing";
import { useStreamingText } from "../../hooks/use-streaming-text";
import { useVirtualScroll } from "../../hooks/use-virtual-scroll";

// ─── Types ────────────────────────────────────────────────────────────────────

type ChatMessagesProps = {
  theme: ProviderTheme;
  threadId: string;
  messages: ChatMessage[];
  isStreaming: boolean;
  streamReadabilityPace: number;
  onRegenerateFromAssistantMessage: (assistantMessageId: string) => Promise<void> | void;
  onEditUserMessage: (messageId: string, content: string) => Promise<void> | void;
  streamForActiveThread: boolean;
};

type ChatMessageRowProps = {
  theme: ProviderTheme;
  message: ChatMessage;
  isStreaming: boolean;
  isLiveStreaming: boolean;
  streamReadabilityPace: number;
  hasPriorUserMessage: boolean;
  isCopied: boolean;
  isEditing: boolean;
  editingDraft: string;
  isApplyingEdit: boolean;
  metricsVisible: boolean;
  onCopy: (messageId: string, content: string) => Promise<void>;
  onRegenerate: (assistantMessageId: string) => Promise<void> | void;
  onBeginEdit: (message: ChatMessage) => void;
  onEditingDraftChange: (nextDraft: string) => void;
  onCancelEdit: () => void;
  onApplyEdit: (messageId: string) => Promise<void>;
  onToggleMetrics: () => void;
};

type MessageMetaBarProps = {
  theme: ProviderTheme;
  message: ChatMessage;
  isStreaming: boolean;
  hasPriorUserMessage: boolean;
  isCopied: boolean;
  isEditing: boolean;
  editingDraft: string;
  isApplyingEdit: boolean;
  metricsVisible: boolean;
  onCopy: (messageId: string, content: string) => Promise<void>;
  onRegenerate: (assistantMessageId: string) => Promise<void> | void;
  onBeginEdit: (message: ChatMessage) => void;
  onCancelEdit: () => void;
  onApplyEdit: (messageId: string) => Promise<void>;
  onToggleMetrics: () => void;
};

type RenderBlock =
  | { type: "text"; content: string }
  | { type: "artifact"; artifact: ChatArtifact };

// ─── Constants ────────────────────────────────────────────────────────────────

const METRICS_STORAGE_KEY = "standard_llm_metrics_visible_v1";
const INITIAL_RENDER_WINDOW = 120;
const RENDER_WINDOW_STEP = 80;
const LARGE_TEXT_MIN_LINES = 90;
const LARGE_TEXT_MIN_CHARS = 5200;
const VIRTUALIZE_THRESHOLD = 24;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatDuration(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  if (value < 1000) return `${Math.round(value)} ms`;
  return `${(value / 1000).toFixed(2)} s`;
}

function formatInteger(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value)) return "n/a";
  return Math.round(value).toLocaleString();
}

function formatRate(value?: number) {
  if (typeof value !== "number" || !Number.isFinite(value) || value <= 0) return "n/a";
  return `${value.toFixed(2)} tok/s`;
}

// ─── Render block builder ─────────────────────────────────────────────────────

function pushTextBlock(target: RenderBlock[], content: string) {
  if (!content) return;
  const prev = target[target.length - 1];
  if (prev?.type === "text") { prev.content += content; return; }
  target.push({ type: "text", content });
}

function buildRenderBlocks(message: ChatMessage): RenderBlock[] {
  const canonical = message.modelContent ?? message.content;
  if (!canonical.trim()) return [];

  const segments = splitByCodeBlocks(canonical);
  if (!segments.length) return [{ type: "text", content: canonical }];

  const blocks: RenderBlock[] = [];

  for (let index = 0; index < segments.length; index += 1) {
    const segment = segments[index];
    if (segment.type === "code") {
      const code = segment.value.trimEnd();
      if (!code.trim()) continue;
      pushTextBlock(blocks, `\`\`\`${segment.language || ""}\n${code}\n\`\`\`\n`);
      continue;
    }

    const text = segment.value;
    if (!text) continue;

    if (message.role === "user") {
      const normalized = text.trim();
      const isLarge =
        countLines(normalized) >= LARGE_TEXT_MIN_LINES || normalized.length >= LARGE_TEXT_MIN_CHARS;
      if (isLarge) {
        blocks.push({
          type: "artifact",
          artifact: {
            id: `${message.id}-text-${index}`,
            source: "auto-text-bundle",
            title: "Text",
            mimeType: "text/plain",
            sizeBytes: artifactSizeBytes(normalized),
            createdAt: message.createdAt,
            content: normalized,
            lineCount: countLines(normalized),
            charCount: normalized.length,
          },
        });
        continue;
      }
    }

    pushTextBlock(blocks, text);
  }

  return blocks.length ? blocks : [{ type: "text", content: canonical }];
}

// ─── Reasoning section parser ─────────────────────────────────────────────────

function splitReasoningBySentence(text: string) {
  const candidates = text
    .split(/(?<=[.!?])\s+(?=[A-Z0-9])/g)
    .map((p) => p.trim())
    .filter(Boolean);
  if (candidates.length <= 1) return [text];
  const out: string[] = [];
  let buffer = "";
  for (const sentence of candidates) {
    const candidate = buffer ? `${buffer} ${sentence}` : sentence;
    if (candidate.length > 360 && buffer) { out.push(buffer); buffer = sentence; }
    else { buffer = candidate; }
  }
  if (buffer) out.push(buffer);
  return out.filter(Boolean);
}

function splitReasoningSections(text: string) {
  const normalized = text.replace(/\r\n/g, "\n").trim();
  if (!normalized) return [];
  const byBlankLine = normalized.split(/\n{2,}/).map((p) => p.trim()).filter(Boolean);
  if (byBlankLine.length > 1) return byBlankLine;
  const lines = normalized.split("\n").map((p) => p.trim()).filter(Boolean);
  if (lines.length > 1) return lines;
  const sentences = splitReasoningBySentence(normalized);
  if (sentences.length > 1) return sentences;
  return [normalized];
}

// ─── Metrics rows ─────────────────────────────────────────────────────────────

function MetricsRows({ metrics, isDark }: { metrics: ChatMessageMetrics | undefined; isDark: boolean }) {
  const label = "font-medium " + (isDark ? "text-[#b9b2a6]" : "text-[#5f5b53]");
  if (!metrics) {
    return (<><span className={label}>Timing:</span><span>Pending</span></>);
  }
  return (
    <>
      <span className={label}>Latency:</span><span>{formatDuration(metrics.latencyMs)}</span>
      <span className={label}>Time to first token:</span><span>{formatDuration(metrics.timeToFirstTokenMs)}</span>
      <span className={label}>Prompt tokens:</span><span>{formatInteger(metrics.promptTokens)}</span>
      <span className={label}>Completion tokens:</span><span>{formatInteger(metrics.completionTokens)}</span>
      <span className={label}>Total tokens:</span><span>{formatInteger(metrics.totalTokens)}</span>
      <span className={label}>Throughput:</span><span>{formatRate(metrics.tokensPerSecond)}</span>
      <span className={label}>Source:</span><span>{metrics.tokenSource === "provider" ? "Provider" : "Estimate"}</span>
      <span className={label}>Model:</span><span>{metrics.modelId || "n/a"}</span>
    </>
  );
}

// ─── Reasoning block ──────────────────────────────────────────────────────────

function ReasoningBlock({ reasoning, theme }: { reasoning: string; theme: ProviderTheme }) {
  const sections = splitReasoningSections(reasoning);
  if (!sections.length) return null;

  const [isOpen, setIsOpen] = useState(false);
  const isDark = theme.isDark;

  const detailsClass = isDark
    ? "mb-2 overflow-hidden rounded-md border border-[#4a4841] bg-[#23221f]"
    : "mb-2 overflow-hidden rounded-md border border-[#d6d5d2] bg-[#f8f6f0]";
  const summaryClass = isDark
    ? "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#d6cfc3] hover:bg-[#2d2c28]"
    : "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#5d584f] hover:bg-[#efede6]";
  const bodyClass = isDark
    ? "space-y-2 border-t border-[#4a4841] bg-[#1f1f1d] px-3 py-2"
    : "space-y-2 border-t border-[#d6d5d2] bg-[#fbfaf6] px-3 py-2";
  const chunkClass = isDark ? "text-[13px] leading-6 text-[#d6cfc3]" : "text-[13px] leading-6 text-[#4a453d]";
  const dividerClass = isDark ? "border-t border-[#4a4841] pt-2" : "border-t border-[#d6d5d2] pt-2";

  return (
    <details className={detailsClass} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <summary className={summaryClass}>
        <span className="inline-flex items-center gap-2">
          <span className={"h-1.5 w-1.5 rounded-full " + (isDark ? "bg-[#bfb8ab]" : "bg-[#847e73]")} />
          <span>Thinking</span>
        </span>
        <span className={isDark ? "text-[#b8b1a5]" : "text-[#7a756b]"}>{isOpen ? "Hide" : "Show"}</span>
      </summary>
      <div className={bodyClass}>
        {sections.map((section, i) => (
          <div key={`${i}-${section.slice(0, 24)}`} className={i > 0 ? dividerClass : ""}>
            <pre className={chunkClass + " whitespace-pre-wrap"}>{section}</pre>
          </div>
        ))}
      </div>
    </details>
  );
}

// ─── Message meta bar ─────────────────────────────────────────────────────────

const MessageMetaBar = memo(
  function MessageMetaBar({
    theme,
    message,
    isStreaming,
    hasPriorUserMessage,
    isCopied,
    isEditing,
    editingDraft,
    isApplyingEdit,
    metricsVisible,
    onCopy,
    onRegenerate,
    onBeginEdit,
    onCancelEdit,
    onApplyEdit,
    onToggleMetrics,
  }: MessageMetaBarProps) {
    const isDark = theme.isDark;
    const copySource = message.modelContent ?? message.content;

    return (
      <>
        <div className={"mt-1 flex items-center gap-1 " + (message.role === "user" ? "justify-end" : "justify-start")}>
          <button type="button" className={theme.messages.copyButton} onClick={() => void onCopy(message.id, copySource)} aria-label="Copy message" disabled={isApplyingEdit}>
            {isCopied ? <CheckIcon className="h-3.5 w-3.5" /> : <CopyIcon className="h-3.5 w-3.5" />}
            <span>{isCopied ? "Copied" : "Copy"}</span>
          </button>

          {message.role === "assistant" && hasPriorUserMessage ? (
            <button type="button" className={theme.messages.regenerateButton} onClick={() => void onRegenerate(message.id)} aria-label="Regenerate response" disabled={isStreaming}>
              <RefreshIcon className="h-3.5 w-3.5" />
              <span>Regenerate from here</span>
            </button>
          ) : null}

          {message.role === "assistant" ? (
            <button type="button" className={theme.messages.copyButton} onClick={onToggleMetrics} aria-label={metricsVisible ? "Hide metrics" : "Show metrics"} aria-expanded={metricsVisible}>
              <ChevronDownIcon className={"h-3.5 w-3.5 transition " + (metricsVisible ? "rotate-180" : "")} />
              <span>{metricsVisible ? "Hide metrics" : "Show metrics"}</span>
            </button>
          ) : null}

          {message.role === "user" && !isEditing ? (
            <button type="button" className={theme.messages.copyButton} onClick={() => onBeginEdit(message)} aria-label="Edit user message" disabled={isStreaming}>
              <EditIcon className="h-3.5 w-3.5" />
              <span>Edit</span>
            </button>
          ) : null}

          {isEditing ? (
            <>
              <button type="button" className={theme.messages.regenerateButton} onClick={onCancelEdit} disabled={isApplyingEdit}>
                <span>Cancel</span>
              </button>
              <button type="button" className={theme.messages.regenerateButton} onClick={() => void onApplyEdit(message.id)} disabled={!editingDraft.trim() || isApplyingEdit} aria-label="Save message and continue from here">
                <span>{isApplyingEdit ? "Applying..." : "Save and continue"}</span>
              </button>
            </>
          ) : null}
        </div>

        {message.role === "assistant" && metricsVisible ? (
          <div className={"mt-1 px-0 py-1 text-[11px] leading-5 " + (isDark ? "text-[#a7a092]" : "text-[#6b655b]")}>
            <div className="grid grid-cols-2 gap-x-3 gap-y-0.5 sm:grid-cols-4">
              <MetricsRows metrics={message.metrics} isDark={isDark} />
            </div>
          </div>
        ) : null}
      </>
    );
  },
  (prev, next) =>
    prev.theme === next.theme &&
    prev.message === next.message &&
    prev.isStreaming === next.isStreaming &&
    prev.hasPriorUserMessage === next.hasPriorUserMessage &&
    prev.isCopied === next.isCopied &&
    prev.isEditing === next.isEditing &&
    prev.editingDraft === next.editingDraft &&
    prev.isApplyingEdit === next.isApplyingEdit &&
    prev.metricsVisible === next.metricsVisible &&
    prev.onCopy === next.onCopy &&
    prev.onRegenerate === next.onRegenerate &&
    prev.onBeginEdit === next.onBeginEdit &&
    prev.onCancelEdit === next.onCancelEdit &&
    prev.onApplyEdit === next.onApplyEdit &&
    prev.onToggleMetrics === next.onToggleMetrics
);

// ─── Measured row wrapper ─────────────────────────────────────────────────────

function MeasuredRow({
  messageId,
  onHeightChange,
  children,
}: {
  messageId: string;
  onHeightChange: (id: string, height: number) => void;
  children: ReactNode;
}) {
  const rowRef = useRef<HTMLDivElement | null>(null);

  const measure = useCallback(() => {
    const row = rowRef.current;
    if (!row) return;
    onHeightChange(messageId, Math.max(48, Math.round(row.getBoundingClientRect().height)));
  }, [messageId, onHeightChange]);

  useLayoutEffect(() => {
    measure();
    const row = rowRef.current;
    if (!row || typeof ResizeObserver === "undefined") return;
    const observer = new ResizeObserver(() => measure());
    observer.observe(row);
    return () => observer.disconnect();
  }, [measure]);

  return <div ref={rowRef}>{children}</div>;
}

// ─── Chat message row ─────────────────────────────────────────────────────────

const ChatMessageRow = memo(
  function ChatMessageRow({
    theme,
    message,
    isStreaming,
    isLiveStreaming,
    streamReadabilityPace,
    hasPriorUserMessage,
    isCopied,
    isEditing,
    editingDraft,
    isApplyingEdit,
    metricsVisible,
    onCopy,
    onRegenerate,
    onBeginEdit,
    onEditingDraftChange,
    onCancelEdit,
    onApplyEdit,
    onToggleMetrics,
  }: ChatMessageRowProps) {
    const isDark = theme.isDark;
    const isAssistant = message.role === "assistant";
    const isUser = message.role === "user";
    const attachments = Array.isArray(message.attachments) ? message.attachments : [];
    const allArtifacts = Array.isArray(message.artifacts) ? message.artifacts : [];
    const explicitArtifacts = allArtifacts.filter(
      (a) => a.source !== "auto-code-bundle" && a.source !== "auto-text-bundle"
    );

    const canonical = message.modelContent ?? message.content;
    const visibleContent = useStreamingText({
      content: canonical,
      isLive: isAssistant && isLiveStreaming,
      pace: streamReadabilityPace,
      completionTokens: message.metrics?.completionTokens,
      tokensPerSecond: message.metrics?.tokensPerSecond,
    });

    const messageForRender = isAssistant && isLiveStreaming
      ? { ...message, content: visibleContent, modelContent: undefined }
      : message;
    const blocks = buildRenderBlocks(messageForRender);
    const hasText = blocks.some((b) => b.type === "text" && b.content.trim());
    const shouldShowLoadingBubble = !isEditing && !hasText && blocks.length === 0 && !attachments.length;

    const bubbleClass = isUser ? theme.messages.userBubble : theme.messages.assistantBubble;
    const columnClass =
      "w-full max-w-[var(--standard-flow-width)] px-6" + (isUser ? " flex flex-col items-end" : "");
    const artifactClasses = buildArtifactClasses(isDark);

    return (
      <article className="group flex w-full justify-center" aria-label={isUser ? "User message" : "Assistant message"}>
        <div className={columnClass}>
          <AttachmentStrip attachments={attachments} isDark={isDark} />

          {explicitArtifacts.length ? (
            <ArtifactStrip
              artifacts={explicitArtifacts}
              theme={theme}
              isGenerating={isLiveStreaming && isAssistant}
              isCompleted={Boolean(message.metrics?.completedAt)}
            />
          ) : null}

          {!isEditing && isAssistant && message.reasoning?.trim() ? (
            <ReasoningBlock reasoning={message.reasoning} theme={theme} />
          ) : null}

          {(isEditing || shouldShowLoadingBubble) ? (
            <div className={bubbleClass}>
              {isEditing ? (
                <textarea
                  className={
                    "w-full max-w-[58ch] resize-y rounded-xl border px-3 py-2 text-[14px] leading-6 outline-none " +
                    (isDark
                      ? "border-[#4a4841] bg-[#1f1f1d] text-[#e9e6df] focus:border-[#6a675f]"
                      : "border-[#d6d5d2] bg-[#fffdf9] text-[#2f2f2d] focus:border-[#bdbcb9]")
                  }
                  value={editingDraft}
                  onChange={(e) => onEditingDraftChange(e.target.value)}
                  rows={3}
                  disabled={isApplyingEdit}
                  aria-label="Edit user message"
                />
              ) : null}
            </div>
          ) : null}

          {!isEditing ? (
            <div className="mt-2 space-y-2">
              {blocks.map((block, i) =>
                block.type === "artifact" ? (
                  <ArtifactCard
                    key={block.artifact.id}
                    artifact={block.artifact}
                    theme={theme}
                    isGenerating={isLiveStreaming && isAssistant}
                    isCompleted={Boolean(message.metrics?.completedAt)}
                    cardClass={artifactClasses.card.replace("mb-2", "mb-1")}
                    summaryClass={artifactClasses.summary}
                    metaClass={artifactClasses.meta}
                    panelClass={artifactClasses.panel}
                  />
                ) : block.content.trim() ? (
                  <div key={`${message.id}-text-${i}`} className={bubbleClass}>
                    <MessageContent content={block.content} theme={theme} />
                  </div>
                ) : null
              )}
            </div>
          ) : null}

          <MessageMetaBar
            theme={theme}
            message={message}
            isStreaming={isStreaming}
            hasPriorUserMessage={hasPriorUserMessage}
            isCopied={isCopied}
            isEditing={isEditing}
            editingDraft={editingDraft}
            isApplyingEdit={isApplyingEdit}
            metricsVisible={metricsVisible}
            onCopy={onCopy}
            onRegenerate={onRegenerate}
            onBeginEdit={onBeginEdit}
            onCancelEdit={onCancelEdit}
            onApplyEdit={onApplyEdit}
            onToggleMetrics={onToggleMetrics}
          />
        </div>
      </article>
    );
  },
  (prev, next) =>
    prev.message === next.message &&
    prev.theme === next.theme &&
    prev.isStreaming === next.isStreaming &&
    prev.isLiveStreaming === next.isLiveStreaming &&
    prev.streamReadabilityPace === next.streamReadabilityPace &&
    prev.hasPriorUserMessage === next.hasPriorUserMessage &&
    prev.isCopied === next.isCopied &&
    prev.isEditing === next.isEditing &&
    prev.editingDraft === next.editingDraft &&
    prev.isApplyingEdit === next.isApplyingEdit &&
    prev.metricsVisible === next.metricsVisible
);

// ─── Main export ──────────────────────────────────────────────────────────────

export function ChatMessages({
  theme,
  threadId,
  messages,
  isStreaming,
  streamReadabilityPace,
  onRegenerateFromAssistantMessage,
  onEditUserMessage,
  streamForActiveThread,
}: ChatMessagesProps) {
  const [copiedId, setCopiedId] = useState("");
  const [metricsVisible, setMetricsVisible] = useState(false);
  const [metricsReady, setMetricsReady] = useState(false);
  const [showJumpToBottom, setShowJumpToBottom] = useState(false);
  const [renderWindowSize, setRenderWindowSize] = useState(INITIAL_RENDER_WINDOW);
  const {
    editingId,
    editingDraft,
    isApplyingEdit,
    beginEdit,
    setEditingDraft,
    cancelEdit,
    applyEdit,
  } = useMessageEditing({ isStreaming, onEditUserMessage });
  const scrollViewportRef = useRef<HTMLDivElement | null>(null);
  const stickToBottomRef = useRef(true);
  const lastScrollTopRef = useRef(0);
  const stickRafRef = useRef<number | null>(null);
  const suppressScrollUntilRef = useRef(0);

  const hiddenCount = Math.max(0, messages.length - renderWindowSize);
  const visibleMessages = hiddenCount > 0 ? messages.slice(hiddenCount) : messages;

  let liveStreamingId = "";
  if (streamForActiveThread && isStreaming) {
    for (let i = visibleMessages.length - 1; i >= 0; i -= 1) {
      if (visibleMessages[i].role === "assistant") { liveStreamingId = visibleMessages[i].id; break; }
    }
  }

  const hiddenHasUser =
    hiddenCount > 0 ? messages.slice(0, hiddenCount).some((m) => m.role === "user") : false;
  const shouldVirtualize = visibleMessages.length > VIRTUALIZE_THRESHOLD;

  const getItemId = useCallback((i: number) => visibleMessages[i]?.id ?? "", [visibleMessages]);

  const virtual = useVirtualScroll({
    itemCount: visibleMessages.length,
    enabled: shouldVirtualize,
    viewportRef: scrollViewportRef,
    getItemId,
  });

  const hasPriorUserMessage = useMemo(() => {
    const flags = new Array<boolean>(visibleMessages.length);
    let sawUser = hiddenHasUser;
    visibleMessages.forEach((m, i) => {
      flags[i] = m.role === "assistant" && sawUser;
      if (m.role === "user") sawUser = true;
    });
    return flags;
  }, [visibleMessages, hiddenHasUser]);

  const stickToBottom = useCallback((confirmFrame = false) => {
    const vp = scrollViewportRef.current;
    if (!vp) return;

    const apply = () => {
      const nextTop = Math.max(0, vp.scrollHeight - vp.clientHeight);
      if (Math.abs(vp.scrollTop - nextTop) > 0.5) {
        suppressScrollUntilRef.current = performance.now() + 72;
        vp.scrollTop = nextTop;
      }
      lastScrollTopRef.current = vp.scrollTop;
      setShowJumpToBottom(false);
    };

    apply();
    if (!confirmFrame || stickRafRef.current !== null) return;
    stickRafRef.current = window.requestAnimationFrame(() => {
      stickRafRef.current = null;
      apply();
    });
  }, []);

  const handleCopy = useCallback(async (messageId: string, content: string) => {
    if (!content.trim()) return;
    try {
      await navigator.clipboard.writeText(content);
      setCopiedId(messageId);
      window.setTimeout(() => setCopiedId(""), 1400);
    } catch { /* silent */ }
  }, []);

  const toggleMetrics = useCallback(() => setMetricsVisible((v) => !v), []);

  const handleScroll = useCallback(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    virtual.onScroll();
    const currentTop = vp.scrollTop;
    const deltaY = currentTop - lastScrollTopRef.current;
    lastScrollTopRef.current = currentTop;

    if (performance.now() < suppressScrollUntilRef.current && deltaY >= -0.5) return;

    const remaining = vp.scrollHeight - vp.scrollTop - vp.clientHeight;
    setShowJumpToBottom((cur) => {
      const next = remaining > 96;
      return cur === next ? cur : next;
    });

    if (deltaY < -0.5) {
      stickToBottomRef.current = false;
    } else if (!stickToBottomRef.current && deltaY > 0 && remaining < 24) {
      stickToBottomRef.current = true;
    }

    if (currentTop <= 32 && hiddenCount > 0) {
      setRenderWindowSize((cur) => Math.min(messages.length, cur + RENDER_WINDOW_STEP));
    }
  }, [virtual, hiddenCount, messages.length]);

  // Reset on thread change.
  useLayoutEffect(() => {
    const vp = scrollViewportRef.current;
    if (!vp) return;
    stickToBottomRef.current = true;
    setShowJumpToBottom(false);
    stickToBottom(true);
  }, [threadId, stickToBottom]);

  useEffect(() => {
    setRenderWindowSize(INITIAL_RENDER_WINDOW);
    setShowJumpToBottom(false);
    virtual.resetHeights();
  }, [threadId]);

  // Stick to bottom on new messages.
  useLayoutEffect(() => {
    if (!stickToBottomRef.current) return;
    stickToBottom(true);
  }, [messages, isStreaming, streamForActiveThread, stickToBottom]);

  // Evict heights for removed messages.
  useLayoutEffect(() => {
    virtual.clearStaleHeights(new Set(visibleMessages.map((m) => m.id)));
    virtual.syncNow();
  }, [visibleMessages, shouldVirtualize]);

  // Persist metrics preference.
  useEffect(() => {
    try {
      setMetricsVisible(localStorage.getItem(METRICS_STORAGE_KEY) === "1");
    } finally {
      setMetricsReady(true);
    }
  }, []);

  useEffect(() => {
    if (!metricsReady) return;
    localStorage.setItem(METRICS_STORAGE_KEY, metricsVisible ? "1" : "0");
  }, [metricsVisible, metricsReady]);

  // Cleanup stick rAF on unmount.
  useEffect(() => () => {
    if (stickRafRef.current !== null) {
      window.cancelAnimationFrame(stickRafRef.current);
      stickRafRef.current = null;
    }
  }, []);

  const renderedMessages = visibleMessages.slice(virtual.renderStart, virtual.renderEnd);

  const jumpToBottomClass = theme.isDark
    ? "absolute bottom-4 right-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#4a4841] bg-[#2f2e2a] text-[#e6dfd1] shadow-[0_8px_18px_rgba(0,0,0,0.35)] transition hover:bg-[#393833]"
    : "absolute bottom-4 right-4 z-20 inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#d6d5d2] bg-[#fbfaf6] text-[#5d584f] shadow-[0_8px_18px_rgba(34,30,22,0.14)] transition hover:bg-[#f0eee8]";

  return (
    <div ref={scrollViewportRef} className={theme.messages.container + " relative"} aria-busy={isStreaming} onScroll={handleScroll}>
      <div className={theme.messages.list}>
        {!visibleMessages.length ? (
          <div className="mx-auto mt-16 max-w-xl text-center">
            <h3 className={theme.messages.emptyTitle}>{theme.copy.startConversationTitle}</h3>
            <p className={theme.messages.emptyDescription}>{theme.copy.startConversationSubtitle}</p>
          </div>
        ) : null}

        {hiddenCount > 0 ? (
          <div className="flex justify-center">
            <button
              type="button"
              className={theme.messages.copyButton}
              onClick={() => setRenderWindowSize((cur) => Math.min(messages.length, cur + RENDER_WINDOW_STEP))}
            >
              Show {Math.min(RENDER_WINDOW_STEP, hiddenCount)} older messages
            </button>
          </div>
        ) : null}

        {virtual.paddingTop > 0 ? <div style={{ height: virtual.paddingTop }} aria-hidden="true" /> : null}

        {renderedMessages.map((message, i) => {
          const absIdx = virtual.renderStart + i;
          const isEditingThis = message.id === editingId && message.role === "user";
          return (
            <MeasuredRow key={message.id} messageId={message.id} onHeightChange={virtual.onRowHeightChange}>
              <ChatMessageRow
                theme={theme}
                message={message}
                isStreaming={isStreaming}
                isLiveStreaming={message.id === liveStreamingId}
                streamReadabilityPace={streamReadabilityPace}
                hasPriorUserMessage={hasPriorUserMessage[absIdx] ?? false}
                isCopied={copiedId === message.id}
                isEditing={isEditingThis}
                editingDraft={isEditingThis ? editingDraft : ""}
                isApplyingEdit={isApplyingEdit}
                metricsVisible={metricsVisible}
                onCopy={handleCopy}
                onRegenerate={onRegenerateFromAssistantMessage}
                onBeginEdit={beginEdit}
                onEditingDraftChange={setEditingDraft}
                onCancelEdit={cancelEdit}
                onApplyEdit={applyEdit}
                onToggleMetrics={toggleMetrics}
              />
            </MeasuredRow>
          );
        })}

        {virtual.paddingBottom > 0 ? <div style={{ height: virtual.paddingBottom }} aria-hidden="true" /> : null}

        {streamForActiveThread ? (
          <div className="mx-auto w-full max-w-[var(--standard-flow-width)] px-1.5">
            <p className={theme.messages.streamingStatus} role="status" aria-live="polite">
              <span className="sr-only">{theme.copy.generatingLabel}</span>
              <span className="standard-oai-seq ml-5 mt-0.5 sm:ml-6" aria-hidden="true">
                <span>O</span><span>A</span><span>I</span>
              </span>
            </p>
          </div>
        ) : null}
      </div>

      {showJumpToBottom ? (
        <button
          type="button"
          className={jumpToBottomClass}
          onClick={() => { stickToBottomRef.current = true; stickToBottom(); }}
          aria-label="Jump to latest message"
          title="Jump to latest"
        >
          <ChevronDownIcon className="h-4 w-4" />
        </button>
      ) : null}
    </div>
  );
}
