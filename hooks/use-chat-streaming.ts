"use client";

import { FormEvent, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { mergePromptWithArtifacts } from "../lib/message-artifacts";
import { createId } from "../lib/storage";
import { streamAssistantResponse } from "../lib/stream-chat";
import type { ChatArtifact, ChatAttachment, ChatMessage, ChatSettings, ChatThread, RequestMessage } from "../lib/types";
import { buildThreadTitle } from "../lib/utils";

export type ChatStreamingController = ReturnType<typeof useChatStreamingController>;

type UseChatStreamingOptions = {
  activeThread: ChatThread | null;
  selectedBackend: string;
  selectedModel: string;
  activeSettings: ChatSettings;
  providerLabel: string;
  prompt: string;
  composerAttachments: ChatAttachment[];
  composerPromptArtifacts: ChatArtifact[];
  isUploadingAttachments: boolean;
  patchThread: (threadId: string, update: (thread: ChatThread) => ChatThread) => void;
  clearDraftForThread: (threadId: string) => void;
  getSessionKeyForThread: (threadId: string) => string;
  setSessionKeyForThread: (threadId: string, sessionKey: string) => void;
  onClearChatError: () => void;
  onChatError: (error: unknown, providerLabel: string) => void;
  streaming: ChatStreamingController;
};

export function useChatStreamingController() {
  const [streamingThreadId, setStreamingThreadId] = useState<string | null>(null);
  const streamAbortRef = useRef<AbortController | null>(null);
  const streamingThreadIdRef = useRef<string | null>(null);

  useEffect(() => {
    streamingThreadIdRef.current = streamingThreadId;
  }, [streamingThreadId]);

  const startStreaming = useCallback((threadId: string, abortController: AbortController) => {
    streamAbortRef.current = abortController;
    setStreamingThreadId(threadId);
  }, []);

  const completeStreaming = useCallback(() => {
    setStreamingThreadId(null);
    streamAbortRef.current = null;
  }, []);

  const stopStreaming = useCallback(() => {
    streamAbortRef.current?.abort();
  }, []);

  const abortThreadIfStreaming = useCallback((threadId: string) => {
    if (streamingThreadIdRef.current === threadId) {
      streamAbortRef.current?.abort();
    }
  }, []);

  return {
    streamingThreadId,
    streamingThreadIdRef,
    isStreaming: streamingThreadId !== null,
    startStreaming,
    completeStreaming,
    stopStreaming,
    abortThreadIfStreaming,
  };
}

export function useChatStreaming({
  activeThread,
  selectedBackend,
  selectedModel,
  activeSettings,
  providerLabel,
  prompt,
  composerAttachments,
  composerPromptArtifacts,
  isUploadingAttachments,
  patchThread,
  clearDraftForThread,
  getSessionKeyForThread,
  setSessionKeyForThread,
  onClearChatError,
  onChatError,
  streaming,
}: UseChatStreamingOptions) {
  const canSend = useMemo(() => {
    return (
      (Boolean(prompt.trim()) || composerAttachments.length > 0 || composerPromptArtifacts.length > 0) &&
      Boolean(selectedBackend) &&
      Boolean(selectedModel) &&
      Boolean(activeThread) &&
      !isUploadingAttachments &&
      !streaming.isStreaming
    );
  }, [
    activeThread,
    composerAttachments.length,
    composerPromptArtifacts.length,
    isUploadingAttachments,
    prompt,
    selectedBackend,
    selectedModel,
    streaming.isStreaming,
  ]);

  const submitMessage = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
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

      const userMessage: ChatMessage = {
        id: createId(),
        role: "user",
        content: mergedUserContent,
        attachments: outgoingAttachments,
        createdAt: Date.now(),
      };

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

      clearDraftForThread(threadId);
      onClearChatError();

      patchThread(threadId, (thread) => ({
        ...thread,
        title: thread.messages.length === 0 ? buildThreadTitle(titleSeed) : thread.title,
        updatedAt: Date.now(),
        backend: selectedBackend,
        model: selectedModel,
        messages: [...thread.messages, userMessage, assistantMessage],
      }));

      const controller = new AbortController();
      streaming.startStreaming(threadId, controller);

      await streamAssistantResponse({
        threadId,
        assistantMessageId,
        sessionKey: getSessionKeyForThread(threadId),
        requestMessages,
        selectedBackend,
        selectedModel,
        settings: activeSettings,
        onPatchThread: patchThread,
        onError: (error) => {
          onChatError(error, providerLabel || selectedBackend);
        },
        onComplete: streaming.completeStreaming,
        abortController: controller,
      });
    },
    [
      activeSettings,
      activeThread,
      canSend,
      clearDraftForThread,
      composerAttachments,
      composerPromptArtifacts,
      getSessionKeyForThread,
      onChatError,
      onClearChatError,
      patchThread,
      prompt,
      providerLabel,
      selectedBackend,
      selectedModel,
      streaming,
    ]
  );

  const regenerateFromAssistantMessage = useCallback(
    async (assistantMessageId: string) => {
      if (!activeThread || !selectedBackend || !selectedModel || streaming.isStreaming) return;

      const messages = activeThread.messages;
      const assistantIndex = messages.findIndex(
        (message) => message.id === assistantMessageId && message.role === "assistant"
      );
      if (assistantIndex < 0) return;

      const baseMessages = messages.slice(0, assistantIndex);
      if (!baseMessages.some((message) => message.role === "user")) return;

      const threadId = activeThread.id;
      const previousSessionKey = getSessionKeyForThread(threadId);
      const nextSessionKey = createId();
      setSessionKeyForThread(threadId, nextSessionKey);
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

      onClearChatError();

      const requestMessages: RequestMessage[] = baseMessages.map((message) => ({
        role: message.role,
        content: message.modelContent ?? message.content,
        attachments: message.attachments,
      }));

      const controller = new AbortController();
      streaming.startStreaming(threadId, controller);

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
          onChatError(error, providerLabel || selectedBackend);
        },
        onFirstChunk: () => {
          patchThread(threadId, (thread) => ({
            ...thread,
            updatedAt: Date.now(),
            backend: selectedBackend,
            model: selectedModel,
            messages: [...baseMessages, newAssistantMessage],
          }));
        },
        onEmptyResponse: () => {
          setSessionKeyForThread(threadId, previousSessionKey);
        },
        onComplete: streaming.completeStreaming,
        abortController: controller,
      });
    },
    [
      activeSettings,
      activeThread,
      getSessionKeyForThread,
      onChatError,
      onClearChatError,
      patchThread,
      providerLabel,
      selectedBackend,
      selectedModel,
      setSessionKeyForThread,
      streaming,
    ]
  );

  const editUserMessage = useCallback(
    async (messageId: string, nextContent: string) => {
      if (!activeThread || !selectedBackend || !selectedModel || streaming.isStreaming) return;

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
      const previousSessionKey = getSessionKeyForThread(threadId);
      const nextSessionKey = createId();
      setSessionKeyForThread(threadId, nextSessionKey);
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

      onClearChatError();

      const requestMessages: RequestMessage[] = updatedHistory.map((message) => ({
        role: message.role,
        content: message.modelContent ?? message.content,
        attachments: message.attachments,
      }));

      const controller = new AbortController();
      streaming.startStreaming(threadId, controller);

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
          onChatError(error, providerLabel || selectedBackend);
        },
        onFirstChunk: () => {
          patchThread(threadId, (thread) => ({
            ...thread,
            title: userMessageIndex === 0 ? buildThreadTitle(trimmed) : thread.title,
            updatedAt: Date.now(),
            backend: selectedBackend,
            model: selectedModel,
            messages: [...updatedHistory, newAssistantMessage],
          }));
        },
        onEmptyResponse: () => {
          setSessionKeyForThread(threadId, previousSessionKey);
        },
        onComplete: streaming.completeStreaming,
        abortController: controller,
      });
    },
    [
      activeSettings,
      activeThread,
      getSessionKeyForThread,
      onChatError,
      onClearChatError,
      patchThread,
      providerLabel,
      selectedBackend,
      selectedModel,
      setSessionKeyForThread,
      streaming,
    ]
  );

  return {
    canSend,
    submitMessage,
    regenerateFromAssistantMessage,
    editUserMessage,
  };
}
