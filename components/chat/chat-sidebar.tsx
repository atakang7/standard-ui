"use client";

import { memo, useEffect, useState } from "react";
import type { ChatThread } from "../../lib/types";
import { EditIcon, PlusIcon, SettingsIcon, SidebarToggleIcon, TrashIcon } from "./ui-icons";
import type { ProviderTheme } from "./providers";

type ChatSidebarProps = {
  className?: string;
  theme: ProviderTheme;
  threads: ChatThread[];
  selectedThreadId: string;
  onSelectChat: (threadId: string) => void;
  onRenameChat: (threadId: string, title: string) => void;
  onDeleteChat: (threadId: string) => void;
  onNewChat: () => void;
  isCollapsed: boolean;
  onToggleCollapse: () => void;
  isSettingsOpen: boolean;
  onOpenSettings: () => void;
};

export const ChatSidebar = memo(function ChatSidebar({
  className = "",
  theme,
  threads,
  selectedThreadId,
  onSelectChat,
  onRenameChat,
  onDeleteChat,
  onNewChat,
  isCollapsed,
  onToggleCollapse,
  isSettingsOpen,
  onOpenSettings,
}: ChatSidebarProps) {
  const [editingThreadId, setEditingThreadId] = useState<string | null>(null);
  const [editingTitle, setEditingTitle] = useState("");

  useEffect(() => {
    if (!editingThreadId) return;
    if (threads.some((thread) => thread.id === editingThreadId)) return;
    setEditingThreadId(null);
    setEditingTitle("");
  }, [threads, editingThreadId]);

  function beginRename(thread: ChatThread) {
    setEditingThreadId(thread.id);
    setEditingTitle(thread.title);
  }

  function finishRename(threadId: string) {
    const normalized = editingTitle.replace(/\s+/g, " ").trim();
    if (normalized) {
      onRenameChat(threadId, normalized);
    }
    setEditingThreadId(null);
    setEditingTitle("");
  }

  function cancelRename() {
    setEditingThreadId(null);
    setEditingTitle("");
  }

  const collapseButtonClass = theme.isDark
    ? "inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#2b2a27] text-[#d8d1c4] transition hover:bg-[#34332e]"
    : "inline-flex h-7 w-7 items-center justify-center rounded-md bg-[#fbfaf6] text-[#6a665d] transition hover:bg-[#f2f1ed]";
  const collapsedSquareButtonClass = theme.isDark
    ? "inline-flex h-8 w-full items-center justify-center rounded-md border border-[#3a3934] bg-[#2b2a27] text-[#d8d1c4] transition hover:bg-[#34332e]"
    : "inline-flex h-8 w-full items-center justify-center rounded-md border border-[#d8d6cf] bg-[#fbfaf6] text-[#6a665d] transition hover:bg-[#f2f1ed]";
  const brandClass = theme.isDark
    ? "px-1 text-[11px] font-semibold tracking-[0.2em] text-[#cdc6b9]"
    : "px-1 text-[11px] font-semibold tracking-[0.2em] text-[#5f5b53]";

  if (isCollapsed) {
    return (
      <aside className={className} aria-label="Conversation sidebar">
        <div className="flex h-full flex-col px-1.5 py-2">
          <div className="flex w-full flex-col gap-1.5">
            <button
              type="button"
              className={collapsedSquareButtonClass}
              onClick={onToggleCollapse}
              aria-label="Expand sidebar"
            >
              <SidebarToggleIcon className="h-4 w-4" collapsed />
            </button>
            <button
              type="button"
              className={collapsedSquareButtonClass}
              onClick={onNewChat}
              aria-label="New chat"
            >
              <PlusIcon className="h-4 w-4" />
            </button>
          </div>
          <div className="mt-auto flex w-full flex-col">
            <button
              type="button"
              className={collapsedSquareButtonClass}
              onClick={onOpenSettings}
              aria-label="Open settings"
              aria-current={isSettingsOpen ? "page" : undefined}
            >
              <SettingsIcon className="h-4 w-4" />
            </button>
          </div>
        </div>
      </aside>
    );
  }

  return (
    <aside className={className} aria-label="Conversation sidebar">
      <nav className="px-2 py-2" aria-label="Primary">
        <div className="mb-1.5 flex items-center justify-between px-1">
          <span className={brandClass}>standard-ui</span>
          <button
            type="button"
            className={collapseButtonClass}
            onClick={onToggleCollapse}
            aria-label="Collapse sidebar"
          >
            <SidebarToggleIcon className="h-4 w-4" />
          </button>
        </div>
        <div className="flex items-center gap-1.5">
          <button type="button" className={theme.sidebar.newChatButton + " flex-1"} onClick={onNewChat}>
            <PlusIcon className="h-4 w-4" />
            <span>New chat</span>
          </button>
        </div>
      </nav>

      <p id="sidebar-recents-heading" className={theme.sidebar.recentsLabel}>
        Recents
      </p>

      <div
        className="min-h-0 flex-1 space-y-px overflow-y-auto px-2 pb-2"
        role="list"
        aria-labelledby="sidebar-recents-heading"
      >
        {!threads.length ? <p className={theme.sidebar.emptyText}>No chats yet</p> : null}
        {threads.map((thread) => {
          const isActive = thread.id === selectedThreadId;
          const isEditing = editingThreadId === thread.id;
          return (
            <div key={thread.id} className="group relative">
              {isEditing ? (
                <form
                  className={theme.sidebar.renameForm}
                  onSubmit={(event) => {
                    event.preventDefault();
                    finishRename(thread.id);
                  }}
                >
                  <input
                    type="text"
                    className={theme.sidebar.renameInput}
                    value={editingTitle}
                    onChange={(event) => setEditingTitle(event.target.value)}
                    onBlur={() => finishRename(thread.id)}
                    onKeyDown={(event) => {
                      if (event.key === "Escape") {
                        event.preventDefault();
                        cancelRename();
                      }
                    }}
                    aria-label="Rename chat"
                    autoFocus
                  />
                </form>
              ) : (
                <>
                  <button
                    type="button"
                    className={`w-full rounded-lg px-2.5 py-1.5 text-left transition ${isActive ? theme.sidebar.threadButtonActive : theme.sidebar.threadButtonIdle
                      }`}
                    onClick={() => onSelectChat(thread.id)}
                    onDoubleClick={() => beginRename(thread)}
                    aria-current={isActive ? "page" : undefined}
                    aria-label={`Open chat ${thread.title}`}
                    title={thread.title}
                  >
                    <div className="truncate pr-10 text-[13px] leading-[1.1rem]">{thread.title}</div>
                  </button>

                  <div className="absolute right-1 top-1 inline-flex items-center gap-0.5 opacity-0 transition group-hover:opacity-100 group-focus-within:opacity-100">
                    <button
                      type="button"
                      className={theme.sidebar.deleteButton}
                      onClick={() => beginRename(thread)}
                      aria-label={`Rename ${thread.title}`}
                    >
                      <EditIcon className="h-3.5 w-3.5" />
                    </button>
                    <button
                      type="button"
                      className={theme.sidebar.deleteButton}
                      onClick={() => onDeleteChat(thread.id)}
                      aria-label={`Delete ${thread.title}`}
                    >
                      <TrashIcon className="h-3.5 w-3.5" />
                    </button>
                  </div>
                </>
              )}
            </div>
          );
        })}
      </div>

      <div className={theme.sidebar.footerSection}>
        <button
          type="button"
          className={isSettingsOpen ? theme.sidebar.footerButtonActive : theme.sidebar.footerButton}
          onClick={onOpenSettings}
          aria-current={isSettingsOpen ? "page" : undefined}
          aria-label="Open settings"
        >
          <SettingsIcon className="h-4.5 w-4.5" />
          <span>Settings</span>
        </button>
      </div>
    </aside>
  );
},
function areSidebarPropsEqual(prev, next) {
  if (prev.className !== next.className) return false;
  if (prev.theme !== next.theme) return false;
  if (prev.selectedThreadId !== next.selectedThreadId) return false;
  if (prev.isSettingsOpen !== next.isSettingsOpen) return false;
  if (prev.onSelectChat !== next.onSelectChat) return false;
  if (prev.onRenameChat !== next.onRenameChat) return false;
  if (prev.onDeleteChat !== next.onDeleteChat) return false;
  if (prev.onNewChat !== next.onNewChat) return false;
  if (prev.isCollapsed !== next.isCollapsed) return false;
  if (prev.onToggleCollapse !== next.onToggleCollapse) return false;
  if (prev.onOpenSettings !== next.onOpenSettings) return false;
  if (prev.threads.length !== next.threads.length) return false;

  for (let index = 0; index < prev.threads.length; index += 1) {
    const prevThread = prev.threads[index];
    const nextThread = next.threads[index];
    if (
      prevThread.id !== nextThread.id ||
      prevThread.title !== nextThread.title ||
      prevThread.updatedAt !== nextThread.updatedAt
    ) {
      return false;
    }
  }

  return true;
});
