import type { ChatMessageMetrics, ChatSettings, ChatThread, RequestMessage, StreamChunk } from "./types";
import { STREAM_FLUSH_INTERVAL_MS } from "./constants";
import { buildBoundedRequestMessages, estimateTokensFromText } from "./utils";

export type StreamChatOptions = {
  threadId: string;
  assistantMessageId: string;
  sessionKey?: string;
  requestMessages: RequestMessage[];
  selectedBackend: string;
  selectedModel: string;
  settings: ChatSettings;
  onPatchThread: (threadId: string, update: (thread: ChatThread) => ChatThread) => void;
  onError: (error: unknown) => void;
  onComplete: () => void;
  abortController: AbortController;
};

function patchAssistantMessage(
  thread: ChatThread,
  assistantMessageId: string,
  patch: (message: ChatThread["messages"][number]) => ChatThread["messages"][number]
) {
  const messages = thread.messages;
  const lastIndex = messages.length - 1;

  const applyAtIndex = (index: number) => {
    const currentMessage = messages[index];
    const nextMessage = patch(currentMessage);
    if (nextMessage === currentMessage) return thread;
    const nextMessages = messages.slice();
    nextMessages[index] = nextMessage;
    return {
      ...thread,
      messages: nextMessages,
    };
  };

  if (lastIndex >= 0 && messages[lastIndex].id === assistantMessageId) {
    return applyAtIndex(lastIndex);
  }

  const matchIndex = messages.findIndex((message) => message.id === assistantMessageId);
  if (matchIndex < 0) return thread;
  return applyAtIndex(matchIndex);
}

export async function streamAssistantResponse(options: StreamChatOptions) {
  const {
    threadId,
    assistantMessageId,
    sessionKey,
    requestMessages,
    selectedBackend,
    selectedModel,
    settings,
    onPatchThread,
    onError,
    onComplete,
    abortController,
  } = options;

  const boundedRequestMessages = buildBoundedRequestMessages(requestMessages, settings);
  const effectiveRequestMessages = boundedRequestMessages.length
    ? boundedRequestMessages
    : requestMessages
        .slice(-1)
        .map((message) => ({
          role: message.role,
          content: message.content.trim(),
          attachments: Array.isArray(message.attachments) ? message.attachments : [],
        }))
        .filter((message) => message.content.length > 0 || message.attachments.length > 0);

  let receivedChunk = false;
  let pendingChunk = "";
  let pendingThinkingChunk = "";
  let chunkFlushTimer: number | null = null;
  const estimatedPromptTokens = estimateTokensFromText(
    effectiveRequestMessages.map((message) => message.content).join("\n")
  );
  const providerUsage: {
    promptTokens?: number;
    completionTokens?: number;
    totalTokens?: number;
  } = {};

  const computeMetrics = (
    currentMetrics: ChatMessageMetrics | undefined,
    nextContent: string,
    now: number,
    isFinal = false
  ): ChatMessageMetrics => {
    const baseline: ChatMessageMetrics = currentMetrics ?? {
      startedAt: now,
      providerId: selectedBackend,
      modelId: selectedModel,
    };

    const hasProviderUsage =
      typeof providerUsage.promptTokens === "number" ||
      typeof providerUsage.completionTokens === "number" ||
      typeof providerUsage.totalTokens === "number";

    const estimatedCompletionTokens = estimateTokensFromText(nextContent);
    const promptTokens =
      typeof providerUsage.promptTokens === "number"
        ? providerUsage.promptTokens
        : estimatedPromptTokens;
    const completionTokens =
      typeof providerUsage.completionTokens === "number"
        ? providerUsage.completionTokens
        : estimatedCompletionTokens;
    const totalTokens =
      typeof providerUsage.totalTokens === "number"
        ? providerUsage.totalTokens
        : promptTokens + completionTokens;
    const firstTokenAt =
      baseline.firstTokenAt ?? (nextContent.trim().length > 0 ? now : undefined);
    const latencyMs = Math.max(0, now - baseline.startedAt);
    const timeToFirstTokenMs =
      typeof firstTokenAt === "number" ? Math.max(0, firstTokenAt - baseline.startedAt) : undefined;
    const generationDurationMs =
      typeof firstTokenAt === "number" ? Math.max(0, now - firstTokenAt) : 0;
    const tokensPerSecond =
      generationDurationMs > 0
        ? Number((completionTokens / (generationDurationMs / 1000)).toFixed(2))
        : undefined;

    return {
      ...baseline,
      firstTokenAt,
      completedAt: isFinal ? now : baseline.completedAt,
      latencyMs,
      timeToFirstTokenMs,
      promptTokens,
      completionTokens,
      totalTokens,
      estimatedTokens: estimatedCompletionTokens,
      tokensPerSecond,
      tokenSource: hasProviderUsage ? "provider" : "estimate",
      providerId: baseline.providerId || selectedBackend,
      modelId: baseline.modelId || selectedModel,
    };
  };

  const flushPendingChunk = () => {
    if (!pendingChunk && !pendingThinkingChunk) return;
    const chunk = pendingChunk;
    const thinkingChunk = pendingThinkingChunk;
    pendingChunk = "";
    pendingThinkingChunk = "";

    onPatchThread(threadId, (thread) =>
      patchAssistantMessage(thread, assistantMessageId, (message) => {
        const now = Date.now();
        const nextContent = chunk ? `${message.content}${chunk}` : message.content;
        const nextReasoning = thinkingChunk ? `${message.reasoning ?? ""}${thinkingChunk}` : message.reasoning;
        return {
          ...message,
          content: nextContent,
          reasoning: nextReasoning,
          metrics: computeMetrics(
            message.metrics,
            message.modelContent ?? nextContent,
            now,
            false
          ),
        };
      })
    );
  };

  const clearChunkFlushTimer = () => {
    if (chunkFlushTimer === null) return;
    window.clearTimeout(chunkFlushTimer);
    chunkFlushTimer = null;
  };

  const shouldRetryStatus = (status: number) =>
    status === 500 || status === 502 || status === 503 || status === 504;

  const sleep = (ms: number) => new Promise<void>((resolve) => window.setTimeout(resolve, ms));

  const requestWithRetry = async () => {
    const maxAttempts = 2;
    let lastError: unknown;

    for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
      try {
        const response = await fetch("/api/chat", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          signal: abortController.signal,
          body: JSON.stringify({
            backend: selectedBackend,
            model: selectedModel,
            sessionKey: sessionKey || threadId,
            messages: effectiveRequestMessages,
            settings,
            stream: true,
          }),
        });

        if (response.ok || !shouldRetryStatus(response.status) || attempt >= maxAttempts) {
          return response;
        }

        await sleep(180);
      } catch (error) {
        lastError = error;
        const aborted = error instanceof DOMException && error.name === "AbortError";
        if (aborted || attempt >= maxAttempts) {
          throw error;
        }
        await sleep(180);
      }
    }

    throw lastError instanceof Error ? lastError : new Error("Chat request failed.");
  };

  const scheduleChunkFlush = () => {
    if (chunkFlushTimer !== null) return;
    chunkFlushTimer = window.setTimeout(() => {
      chunkFlushTimer = null;
      flushPendingChunk();
    }, STREAM_FLUSH_INTERVAL_MS);
  };

  try {
    const response = await requestWithRetry();

    if (!response.ok) {
      let message = `Request failed (${response.status})`;
      try {
        const details = (await response.json()) as { error?: string; details?: string };
        if (details.error) {
          const detailText =
            typeof details.details === "string" && details.details.trim()
              ? details.details.trim()
              : "";
          message = detailText
            ? `${details.error} ${detailText}`.slice(0, 520)
            : details.error;
        }
      } catch {
        // Keep fallback message when JSON parse fails.
      }
      throw new Error(message);
    }

    if (!response.body) {
      throw new Error("Streaming is unavailable in this browser.");
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = "";

    const consumeLine = (line: string) => {
      if (!line.trim()) return;

      const parsed = JSON.parse(line) as StreamChunk;
      if (parsed.error) {
        throw new Error(parsed.error);
      }

      if (parsed.usage) {
        if (typeof parsed.usage.promptTokens === "number") {
          providerUsage.promptTokens = parsed.usage.promptTokens;
        }
        if (typeof parsed.usage.completionTokens === "number") {
          providerUsage.completionTokens = parsed.usage.completionTokens;
        }
        if (typeof parsed.usage.totalTokens === "number") {
          providerUsage.totalTokens = parsed.usage.totalTokens;
        }
      }
      if (typeof parsed.prompt_eval_count === "number") {
        providerUsage.promptTokens = parsed.prompt_eval_count;
      }
      if (typeof parsed.eval_count === "number") {
        providerUsage.completionTokens = parsed.eval_count;
      }
      if (
        typeof providerUsage.totalTokens !== "number" &&
        typeof providerUsage.promptTokens === "number" &&
        typeof providerUsage.completionTokens === "number"
      ) {
        providerUsage.totalTokens = providerUsage.promptTokens + providerUsage.completionTokens;
      }

      const chunk = parsed.message?.content;
      if (typeof chunk === "string" && chunk.length > 0) {
        receivedChunk = true;
        pendingChunk += chunk;
        scheduleChunkFlush();
      }

      const thinkingChunk =
        (typeof parsed.thinking?.content === "string" ? parsed.thinking.content : "") ||
        (typeof (parsed.message as { thinking?: unknown } | undefined)?.thinking === "string"
          ? ((parsed.message as { thinking?: string }).thinking ?? "")
          : "") ||
        (typeof (parsed.message as { reasoning?: unknown } | undefined)?.reasoning === "string"
          ? ((parsed.message as { reasoning?: string }).reasoning ?? "")
          : "") ||
        (typeof (parsed as { reasoning?: unknown }).reasoning === "string"
          ? (parsed as { reasoning: string }).reasoning
          : "") ||
        (typeof (parsed as { thinking?: unknown }).thinking === "string"
          ? (parsed as { thinking: string }).thinking
          : "");
      if (typeof thinkingChunk === "string" && thinkingChunk.length > 0) {
        receivedChunk = true;
        pendingThinkingChunk += thinkingChunk;
        scheduleChunkFlush();
      }
    };

    while (true) {
      const { done, value } = await reader.read();

      if (done) {
        break;
      }

      buffer += decoder.decode(value, { stream: true });
      let newlineIndex = buffer.indexOf("\n");

      while (newlineIndex >= 0) {
        const line = buffer.slice(0, newlineIndex).trim();
        buffer = buffer.slice(newlineIndex + 1);
        consumeLine(line);
        newlineIndex = buffer.indexOf("\n");
      }
    }

    buffer += decoder.decode();
    const trailingLine = buffer.trim();
    if (trailingLine) {
      consumeLine(trailingLine);
    }
  } catch (error) {
    const aborted = error instanceof DOMException && error.name === "AbortError";

    if (!aborted) {
      onError(error);
    }

    if (!receivedChunk) {
      onPatchThread(threadId, (thread) => ({
        ...thread,
        updatedAt: Date.now(),
        messages: thread.messages.filter((message) => message.id !== assistantMessageId),
      }));
    }
  } finally {
    clearChunkFlushTimer();
    flushPendingChunk();

    const finalizedAt = Date.now();
    onPatchThread(threadId, (thread) => {
      const nextThread = patchAssistantMessage(thread, assistantMessageId, (message) => {
        return {
          ...message,
          metrics: computeMetrics(
            message.metrics,
            message.modelContent ?? message.content,
            finalizedAt,
            true
          ),
        };
      });
      return nextThread === thread
        ? {
            ...thread,
            updatedAt: finalizedAt,
          }
        : {
            ...nextThread,
            updatedAt: finalizedAt,
          };
    });
    onComplete();
  }
}
