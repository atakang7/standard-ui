"use client";

import { memo } from "react";
import { MenuIcon } from "./ui-icons";
import type { ProviderTheme } from "./providers";

type ChatTopbarProps = {
  theme: ProviderTheme;
  providerLabel?: string;
  threadTitle: string;
  onOpenMobileSidebar: () => void;
};

export const ChatTopbar = memo(function ChatTopbar({
  theme,
  providerLabel,
  threadTitle,
  onOpenMobileSidebar,
}: ChatTopbarProps) {
  return (
    <header className={theme.topbar.header} aria-label="Chat header">
      <button
        type="button"
        className={`md:hidden ${theme.topbar.iconButton}`}
        onClick={onOpenMobileSidebar}
        aria-label="Open sidebar"
      >
        <MenuIcon className="h-4 w-4" />
      </button>

      <div className="min-w-0 flex-1">
        <h2 className={theme.topbar.title}>{threadTitle || "New chat"}</h2>
      </div>

      <span className={theme.topbar.providerBadge}>{providerLabel || theme.providerLabel}</span>
    </header>
  );
});
