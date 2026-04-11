"use client";

import { useCallback, useState } from "react";
import type { ChatMessage } from "../lib/types";

type UseMessageEditingOptions = {
  isStreaming: boolean;
  onEditUserMessage: (messageId: string, content: string) => Promise<void> | void;
};

export function useMessageEditing({
  isStreaming,
  onEditUserMessage,
}: UseMessageEditingOptions) {
  const [editingId, setEditingId] = useState("");
  const [editingDraft, setEditingDraft] = useState("");
  const [isApplyingEdit, setIsApplyingEdit] = useState(false);

  const beginEdit = useCallback(
    (message: ChatMessage) => {
      if (isStreaming || message.role !== "user") return;
      setEditingId(message.id);
      setEditingDraft(message.content);
    },
    [isStreaming]
  );

  const cancelEdit = useCallback(() => {
    if (isApplyingEdit) return;
    setEditingId("");
    setEditingDraft("");
  }, [isApplyingEdit]);

  const applyEdit = useCallback(
    async (messageId: string) => {
      const trimmed = editingDraft.trim();
      if (!trimmed || isApplyingEdit) return;

      setIsApplyingEdit(true);
      setEditingId("");
      setEditingDraft("");

      try {
        await onEditUserMessage(messageId, trimmed);
      } catch {
        setEditingId(messageId);
        setEditingDraft(trimmed);
      } finally {
        setIsApplyingEdit(false);
      }
    },
    [editingDraft, isApplyingEdit, onEditUserMessage]
  );

  return {
    editingId,
    editingDraft,
    isApplyingEdit,
    beginEdit,
    setEditingDraft,
    cancelEdit,
    applyEdit,
  };
}
