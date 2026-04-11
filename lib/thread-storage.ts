import {
  LEGACY_OLLAMA_THREADS_KEY,
  SELECTED_THREAD_KEY,
  THREADS_BACKUP_KEY,
  THREADS_KEY,
} from "./constants";
import { createId, createThread } from "./storage";
import type { ChatMessage, ChatThread, ThreadPatchOptions } from "./types";
import { normalizeArtifacts, normalizeAttachments, normalizeMessageMetrics } from "./utils";

type ThreadStorage = Pick<Storage, "getItem" | "setItem">;

export type StoredThreadsResult = {
  valid: boolean;
  threads: ChatThread[];
};

export type StoredThreadSelection = {
  threads: ChatThread[];
  selectedThreadId: string;
};

export type ThreadPersistenceResult =
  | { status: "persisted" }
  | {
      status: "skipped-shrink";
      previousMessageCount: number;
      nextMessageCount: number;
      streamingThreadId: string;
    }
  | {
      status: "recovered-shrink";
      recoveredThreadIds: string[];
    }
  | { status: "failed"; error: unknown };

export type ThreadSelectionPersistenceResult = { status: "persisted" } | { status: "failed"; error: unknown };

export function countThreadMessages(threads: ChatThread[]) {
  return threads.reduce((count, thread) => count + thread.messages.length, 0);
}

function isEmptyAssistantPlaceholder(message: ChatMessage) {
  return (
    message.role === "assistant" &&
    !message.content.trim() &&
    !message.modelContent?.trim() &&
    !message.reasoning?.trim() &&
    !message.artifacts?.length &&
    !message.attachments?.length
  );
}

function isOnlyDiscardingEmptyAssistantPlaceholders(
  previousMessages: ChatMessage[],
  nextMessages: ChatMessage[]
) {
  const nextMessageIds = new Set(nextMessages.map((message) => message.id));
  const removedMessages = previousMessages.filter((message) => !nextMessageIds.has(message.id));
  return removedMessages.length > 0 && removedMessages.every(isEmptyAssistantPlaceholder);
}

export function guardThreadHistory(
  previousThread: ChatThread,
  nextThread: ChatThread,
  options: ThreadPatchOptions = {}
) {
  if (nextThread.messages.length >= previousThread.messages.length) {
    return { thread: nextThread, recovered: false };
  }

  if (
    options.allowMessageShrink ||
    isOnlyDiscardingEmptyAssistantPlaceholders(previousThread.messages, nextThread.messages)
  ) {
    return { thread: nextThread, recovered: false };
  }

  return {
    thread: {
      ...nextThread,
      updatedAt: Math.max(previousThread.updatedAt, nextThread.updatedAt),
      messages: previousThread.messages,
    },
    recovered: true,
  };
}

function hasSameMessageIds(messages: ChatMessage[], messageIds: readonly string[]) {
  if (messages.length !== messageIds.length) return false;
  return messages.every((message, index) => message.id === messageIds[index]);
}

export function normalizeStoredThreads(raw: string | null): StoredThreadsResult {
  if (!raw) return { valid: false, threads: [] };

  try {
    const parsed = JSON.parse(raw) as ChatThread[];
    if (!Array.isArray(parsed)) {
      return { valid: false, threads: [] };
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
    return { valid: false, threads: [] };
  }
}

export function readStoredThreadSelection(storage: ThreadStorage): StoredThreadSelection {
  const rawThreads = storage.getItem(THREADS_KEY);
  const rawThreadBackup = storage.getItem(THREADS_BACKUP_KEY);
  const rawLegacyThreads = storage.getItem(LEGACY_OLLAMA_THREADS_KEY);
  const rawSelectedId = storage.getItem(SELECTED_THREAD_KEY);
  const primaryThreads = normalizeStoredThreads(rawThreads);
  const backupThreads = normalizeStoredThreads(rawThreadBackup);
  const legacyThreads = normalizeStoredThreads(rawLegacyThreads);

  let threads = primaryThreads.threads;
  if (!threads.length && rawThreads && !primaryThreads.valid) {
    threads = backupThreads.threads;
  }
  if (!threads.length) {
    threads = legacyThreads.threads;
  }
  if (!threads.length && !rawThreads) {
    threads = backupThreads.threads;
  }
  if (!threads.length) {
    threads = [createThread()];
  }

  const selectedThreadId =
    rawSelectedId && threads.some((thread) => thread.id === rawSelectedId)
      ? rawSelectedId
      : threads[0].id;

  return {
    threads,
    selectedThreadId,
  };
}

export function persistStoredThreads(
  storage: ThreadStorage,
  threads: ChatThread[],
  streamingThreadId: string | null,
  options: {
    allowMessageShrinkThreadMessageIds?: ReadonlyMap<string, readonly string[]>;
  } = {}
): ThreadPersistenceResult {
  try {
    const previousRaw = storage.getItem(THREADS_KEY);
    const previousThreads = normalizeStoredThreads(previousRaw).threads;
    const previousThreadsById = new Map(previousThreads.map((thread) => [thread.id, thread]));
    const recoveredThreadIds: string[] = [];
    const guardedThreads = threads.map((thread) => {
      const previousThread = previousThreadsById.get(thread.id);
      if (!previousThread) return thread;
      const allowedMessageIds = options.allowMessageShrinkThreadMessageIds?.get(thread.id);
      const result = guardThreadHistory(previousThread, thread, {
        allowMessageShrink: Boolean(allowedMessageIds && hasSameMessageIds(thread.messages, allowedMessageIds)),
        reason: "persist",
      });
      if (result.recovered) {
        recoveredThreadIds.push(thread.id);
      }
      return result.thread;
    });
    const previousMessageCount = countThreadMessages(previousThreads);
    const nextMessageCount = countThreadMessages(guardedThreads);

    if (recoveredThreadIds.length) {
      const nextRaw = JSON.stringify(guardedThreads);
      storage.setItem(THREADS_KEY, nextRaw);
      return {
        status: "recovered-shrink",
        recoveredThreadIds,
      };
    }

    if (streamingThreadId && previousMessageCount > nextMessageCount) {
      return {
        status: "skipped-shrink",
        previousMessageCount,
        nextMessageCount,
        streamingThreadId,
      };
    }

    const nextRaw = JSON.stringify(guardedThreads);
    if (previousRaw && previousRaw !== nextRaw) {
      storage.setItem(THREADS_BACKUP_KEY, previousRaw);
    }
    storage.setItem(THREADS_KEY, nextRaw);
    return { status: "persisted" };
  } catch (error) {
    return { status: "failed", error };
  }
}

export function persistStoredThreadSelection(
  storage: ThreadStorage,
  selectedThreadId: string
): ThreadSelectionPersistenceResult {
  try {
    storage.setItem(SELECTED_THREAD_KEY, selectedThreadId);
    return { status: "persisted" };
  } catch (error) {
    return { status: "failed", error };
  }
}
