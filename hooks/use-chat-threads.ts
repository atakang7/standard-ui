"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { ATTACHMENT_DRAFTS_BY_THREAD_KEY, DRAFTS_BY_THREAD_KEY } from "../lib/constants";
import { createThread, attachmentDraftsMapFromRaw, draftsMapFromRaw } from "../lib/storage";
import {
  persistStoredThreadSelection,
  persistStoredThreads,
  readStoredThreadSelection,
} from "../lib/thread-storage";
import type { ChatArtifact, ChatAttachment, ChatThread } from "../lib/types";
import { areAttachmentsEqual } from "../lib/utils";

type UseChatThreadsOptions = {
  streamingThreadId: string | null;
};

export function useChatThreads({ streamingThreadId }: UseChatThreadsOptions) {
  const [threads, setThreads] = useState<ChatThread[]>([]);
  const [selectedThreadId, setSelectedThreadId] = useState("");
  const [draftsByThread, setDraftsByThread] = useState<Record<string, string>>({});
  const [attachmentDraftsByThread, setAttachmentDraftsByThread] = useState<Record<string, ChatAttachment[]>>({});
  const [promptArtifactsByThread, setPromptArtifactsByThread] = useState<Record<string, ChatArtifact[]>>({});
  const [sessionKeysByThread, setSessionKeysByThread] = useState<Record<string, string>>({});
  const [prompt, setPrompt] = useState("");
  const [composerAttachments, setComposerAttachments] = useState<ChatAttachment[]>([]);
  const [isStorageHydrated, setIsStorageHydrated] = useState(false);

  const promptRef = useRef("");
  const selectedThreadIdRef = useRef("");
  const threadsRef = useRef<ChatThread[]>([]);

  const activeThread = useMemo(
    () => threads.find((thread) => thread.id === selectedThreadId) ?? null,
    [threads, selectedThreadId]
  );

  const sortedThreads = useMemo(
    () => [...threads].sort((left, right) => right.updatedAt - left.updatedAt),
    [threads]
  );

  const composerPromptArtifacts = useMemo(
    () => (selectedThreadId ? promptArtifactsByThread[selectedThreadId] ?? [] : []),
    [promptArtifactsByThread, selectedThreadId]
  );

  useEffect(() => {
    promptRef.current = prompt;
  }, [prompt]);

  useEffect(() => {
    selectedThreadIdRef.current = selectedThreadId;
  }, [selectedThreadId]);

  useEffect(() => {
    threadsRef.current = threads;
  }, [threads]);

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

  const syncPromptDraft = useCallback((nextPrompt: string, threadId: string) => {
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
  }, []);

  const applyPromptValue = useCallback(
    (nextPrompt: string) => {
      promptRef.current = nextPrompt;
      setPrompt(nextPrompt);
      syncPromptDraft(nextPrompt, selectedThreadIdRef.current);
    },
    [syncPromptDraft]
  );

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
      promptRef.current = "";
      setPrompt((current) => (current ? "" : current));
      setComposerAttachments((current) => (current.length ? [] : current));
    }
  }, []);

  const appendPromptArtifacts = useCallback((nextArtifacts: ChatArtifact[]) => {
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
  }, []);

  const removePromptArtifact = useCallback((artifactId: string) => {
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
  }, []);

  const createNewThread = useCallback((backend = "", model = "") => {
    const nextThread = createThread(backend, model);
    setThreads((current) => [nextThread, ...current]);
    setSelectedThreadId(nextThread.id);
    promptRef.current = "";
    setPrompt("");
    setComposerAttachments([]);
    return nextThread;
  }, []);

  const deleteThread = useCallback(
    (threadId: string, fallbackBackend = "", fallbackModel = "") => {
      clearDraftForThread(threadId);

      setThreads((current) => {
        const remaining = current.filter((thread) => thread.id !== threadId);
        const nextThreads = remaining.length ? remaining : [createThread(fallbackBackend, fallbackModel)];

        setSelectedThreadId((currentSelectedId) => {
          if (currentSelectedId !== threadId && nextThreads.some((thread) => thread.id === currentSelectedId)) {
            return currentSelectedId;
          }
          return nextThreads[0].id;
        });

        return nextThreads;
      });
    },
    [clearDraftForThread]
  );

  const renameThread = useCallback(
    (threadId: string, title: string) => {
      const normalized = title.replace(/\s+/g, " ").trim();
      if (!normalized) return;

      patchThread(threadId, (thread) => ({
        ...thread,
        title: normalized,
        updatedAt: Date.now(),
      }));
    },
    [patchThread]
  );

  const setSessionKeyForThread = useCallback((threadId: string, sessionKey: string) => {
    if (!threadId || !sessionKey) return;
    setSessionKeysByThread((current) => ({
      ...current,
      [threadId]: sessionKey,
    }));
  }, []);

  const getSessionKeyForThread = useCallback(
    (threadId: string) => sessionKeysByThread[threadId] || threadId,
    [sessionKeysByThread]
  );

  useEffect(() => {
    try {
      const { threads: nextThreads, selectedThreadId: preferredId } = readStoredThreadSelection(localStorage);
      const rawDrafts = localStorage.getItem(DRAFTS_BY_THREAD_KEY);
      const rawAttachmentDrafts = localStorage.getItem(ATTACHMENT_DRAFTS_BY_THREAD_KEY);

      setDraftsByThread(draftsMapFromRaw(rawDrafts));
      setAttachmentDraftsByThread(attachmentDraftsMapFromRaw(rawAttachmentDrafts));
      setThreads(nextThreads);
      setSelectedThreadId(preferredId);
    } catch {
      const fallback = createThread();
      setDraftsByThread({});
      setAttachmentDraftsByThread({});
      setThreads([fallback]);
      setSelectedThreadId(fallback.id);
    } finally {
      setIsStorageHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!isStorageHydrated || !threads.length) return;
    const timerId = window.setTimeout(() => {
      const result = persistStoredThreads(localStorage, threads, streamingThreadId);
      if (result.status === "skipped-shrink") {
        console.warn("[standard-ui] skipped shrinking thread persistence during active stream", {
          previousMessageCount: result.previousMessageCount,
          nextMessageCount: result.nextMessageCount,
          streamingThreadId: result.streamingThreadId,
        });
      } else if (result.status === "failed") {
        console.warn("[standard-ui] failed to persist threads", result.error);
      }
    }, 220);
    return () => window.clearTimeout(timerId);
  }, [threads, isStorageHydrated, streamingThreadId]);

  useEffect(() => {
    if (!selectedThreadId) return;
    const result = persistStoredThreadSelection(localStorage, selectedThreadId);
    if (result.status === "failed") {
      console.warn("[standard-ui] failed to persist selected thread", result.error);
    }
  }, [selectedThreadId]);

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

  useEffect(() => {
    if (!selectedThreadId) {
      setPrompt((current) => (current ? "" : current));
      setComposerAttachments((current) => (current.length ? [] : current));
      return;
    }

    const restoredDraft = draftsByThread[selectedThreadId] ?? "";
    const restoredAttachmentDrafts = attachmentDraftsByThread[selectedThreadId] ?? [];
    promptRef.current = restoredDraft;
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

  return {
    threads,
    threadsRef,
    selectedThreadId,
    selectedThreadIdRef,
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
  };
}
