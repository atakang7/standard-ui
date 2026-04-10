import type { ProviderTheme, ThemeMode } from "./types";

export const claudeTheme: ProviderTheme = {
  providerLabel: "Claude",
  isDark: false,
  layout: {
    main: "relative h-dvh w-full overflow-hidden bg-[#faf9f5] text-[#2f2f2d]",
    sidebarShell:
      "border-r border-[#d6d5d2] bg-[#f6f5f1] text-[#2f2f2d] shadow-[0_8px_20px_rgba(34,30,22,0.06)] md:shadow-none",
    content: "bg-[#faf9f5]",
    overlay: "bg-[#2b2924]/24",
    errorText: "text-[#a35b39]",
    emptySection: "flex min-h-0 flex-1 flex-col justify-center gap-6 pb-4 pt-8 sm:pt-10",
    emptyHeading: "flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#2f2f2d] sm:text-2xl ms-8",
  },
  topbar: {
    header:
      "flex h-14 items-center gap-2 border-b border-[#e6e5e2] bg-[#faf9f5]/95 px-3 backdrop-blur md:px-4",
    iconButton:
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d6d5d2] bg-[#fbfaf6] text-[#6a665d] transition hover:bg-[#f2f1ed]",
    title: "truncate text-sm font-medium tracking-tight text-[#5f5b53]",
    providerBadge:
      "hidden items-center rounded-full border border-[#d6d5d2] bg-[#fbfaf6] px-2.5 py-1 text-[11px] font-medium text-[#6a665d] sm:inline-flex",
  },
  sidebar: {
    newChatButton:
      "flex w-full items-center gap-2 rounded-lg bg-[#fbfaf6] px-2.5 py-1.5 text-[13px] font-medium text-[#3b3934] transition hover:bg-[#f2f1ed]",
    recentsLabel: "px-4 pb-2 pt-1 text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7d786e]",
    emptyText: "px-2 text-xs text-[#8a8479]",
    threadButtonActive: "bg-[#eceae4] text-[#33312d]",
    threadButtonIdle: "text-[#5f5a51] hover:bg-[#f6f5f1]",
    renameForm: "rounded-xl bg-[#fbfaf6] p-1",
    renameInput:
      "h-8 w-full rounded-lg border border-[#d6d5d2] bg-white px-2 text-sm text-[#363430] outline-none focus:border-[#bdbcb9]",
    deleteButton:
      "inline-flex h-6 w-6 items-center justify-center rounded-md text-[#8a8378] transition hover:bg-[#e9e6df] hover:text-[#4e4a43]",
    footerSection: "px-2.5 py-2",
    footerButton:
      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-[#5f5a51] transition hover:bg-[#f6f5f1]",
    footerButtonActive:
      "flex w-full items-center gap-2 rounded-lg bg-[#eceae4] px-2.5 py-1.5 text-[13px] font-medium text-[#33312d]",
  },
  composer: {
    formLanding: "w-full px-4 pb-10 sm:px-6",
    formDocked: "border-t border-[#e6e5e2] bg-[#faf9f5]/95 px-4 pb-4 pt-3 backdrop-blur sm:px-6",
    card:
      "mx-auto w-full max-w-[var(--standard-flow-width)] rounded-3xl border border-[#d6d5d2] bg-[#fbfaf6] p-2 shadow-[0_10px_22px_rgba(34,30,22,0.05)]",
    textarea:
      "min-h-[48px] max-h-44 w-full resize-none rounded-xl border-0 bg-transparent px-3 py-2.5 text-[15px] leading-6 text-[#2f2f2d] placeholder:text-[#8a8479] outline-none disabled:opacity-60",
    controlsDivider: "mt-1 flex items-center justify-between gap-2 border-t border-[#e6e5e2] px-1 pt-2",
    control:
      "h-9 rounded-lg border border-[#d6d5d2] bg-[#fbfaf6] px-2 text-sm text-[#4a453d] outline-none transition focus:border-[#bdbcb9] disabled:opacity-60",
    backendChip:
      "inline-flex h-8 items-center rounded-lg border border-[#d6d5d2] bg-[#fbfaf6] px-2 text-xs font-medium text-[#696359]",
    iconButton:
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d6d5d2] bg-[#fbfaf6] text-[#746d62] transition hover:bg-[#f2f1ed]",
    iconButtonActive:
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#30302e] bg-[#30302e] text-[#faf9f5] transition hover:bg-[#242422]",
    stopButton:
      "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#30302e] bg-[#30302e] text-[#faf9f5] transition hover:bg-[#242422]",
    regenerateButton:
      "inline-flex h-9 w-9 items-center justify-center rounded-lg border border-[#d6d5d2] bg-[#fbfaf6] text-[#746d62] transition hover:bg-[#f2f1ed] disabled:cursor-not-allowed disabled:opacity-40",
    sendButton:
      "inline-flex h-9 w-9 items-center justify-center rounded-full border border-[#30302e] bg-[#30302e] text-[#faf9f5] transition hover:bg-[#242422] disabled:cursor-not-allowed disabled:opacity-40",
    metaRow:
      "mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-[#e6e5e2] px-1 pt-1.5 text-[11px] text-[#7f796f]",
    settingsPanel:
      "mx-auto mt-2 w-full max-w-4xl rounded-2xl border border-[#d6d5d2] bg-[#fbfaf6] px-3 py-3 shadow-[0_1px_0_rgba(34,30,22,0.04)]",
    settingsTitle: "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#7f796f]",
    settingsLabel: "block text-xs font-medium text-[#625c51]",
    settingsInput:
      "w-full rounded-lg border border-[#d6d5d2] bg-white px-2 py-2 text-sm text-[#2f2f2d] outline-none transition focus:border-[#bdbcb9] disabled:opacity-60",
    settingsSwitch:
      "flex items-center justify-between gap-2 rounded-lg border border-[#d6d5d2] bg-[#f7f6f2] px-2.5 py-2.5",
  },
  messages: {
    container: "min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6",
    list: "mx-auto flex w-full max-w-[var(--standard-flow-width)] flex-col gap-3 pb-14",
    emptyTitle: "text-2xl font-semibold text-[#393733]",
    emptyDescription: "mt-2 text-sm text-[#7f796f]",
    userBubble: "max-w-[58ch] rounded-2xl border border-[#dedcd6] bg-[#f1eee8] px-3 py-2 text-[#37342f]",
    assistantBubble: "rounded-2xl px-0 py-0",
    copyButton:
      "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#7f796f] transition hover:bg-[#e6e5e2] hover:text-[#5a5247]",
    regenerateButton:
      "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#7f796f] transition hover:bg-[#e6e5e2] hover:text-[#5a5247]",
    streamingStatus: "text-xs font-medium text-[#7f796f]",
    loadingCursor:
      "after:inline-block after:h-[1.1em] after:w-2 after:rounded-sm after:bg-[#b8b3a8] after:content-['']",
  },
  messageContent: {
    text: "m-0 whitespace-pre-wrap break-words text-[15px] leading-7 text-current",
    codeWrapper: "overflow-hidden rounded-xl border border-[#d6d5d2] bg-transparent",
    codeLanguage:
      "border-b border-[#d6d5d2] bg-[#f2efe8] px-2.5 py-1 text-[10px] font-normal lowercase tracking-wide text-[#7a7469]",
    codeBody: "font-mono whitespace-pre text-[13px] leading-5 text-[#37342f]",
  },
  terminal: {
    frameLanding: "w-full px-4 pb-2 sm:px-6",
    frameDocked: "border-t border-[#e6e5e2] px-4 pb-2 pt-3 sm:px-6",
  },
  copy: {
    heroHeading: "How can I support you today?",
    promptPlaceholder: "Send a message...",
    startConversationTitle: "Start a conversation",
    startConversationSubtitle: "Choose a model and share what you need.",
    generatingLabel: "Generating response...",
  },
};

export const claudeDarkTheme: ProviderTheme = {
  providerLabel: "Claude",
  isDark: true,
  layout: {
    main: "relative h-dvh w-full overflow-hidden bg-[#1F1F1E] text-[#f3efe7]",
    sidebarShell:
      "border-r border-[#3a3934] bg-[#1F1F1E] text-[#f1ede4] shadow-[0_8px_24px_rgba(0,0,0,0.34)] md:shadow-none",
    content: "bg-[#1F1F1E]",
    overlay: "bg-black/55",
    errorText: "text-[#f1b08c]",
    emptySection: "flex min-h-0 flex-1 flex-col justify-center gap-6 pb-4 pt-8 sm:pt-10",
    emptyHeading: "flex items-center gap-2 text-2xl font-semibold tracking-tight text-[#efebe3] sm:text-3xl ms-4",
  },
  topbar: {
    header:
      "flex h-12 items-center gap-2 border-b border-[#34332f] bg-[#1F1F1E] px-2.5 md:px-3",
    iconButton:
      "inline-flex h-8 w-8 items-center justify-center rounded-lg border-0 bg-transparent text-[#d3ccbf] transition hover:bg-[#32312d]",
    title: "truncate text-sm font-medium tracking-tight text-[#c9c2b6]",
    providerBadge:
      "hidden items-center rounded-full border border-[#4a4841] bg-[#1F1F1E] px-2 py-0.5 text-[11px] font-medium text-[#cbc4b8] sm:inline-flex",
  },
  sidebar: {
    newChatButton:
      "flex w-full items-center gap-2 rounded-lg bg-[#1F1F1E] px-2.5 py-1.5 text-[13px] font-medium text-[#f0ece3] transition hover:bg-[#2f2e29]",
    recentsLabel: "px-2.5 pb-1 pt-0.5 text-[10px] font-semibold uppercase tracking-[0.08em] text-[#9f988b]",
    emptyText: "px-2 text-xs text-[#948d80]",
    threadButtonActive: "bg-[#2f2e2a] text-[#f3efe7]",
    threadButtonIdle: "text-[#b9b2a5] hover:bg-[#2f2e29]",
    renameForm: "rounded-lg bg-[#1F1F1E] p-0.5",
    renameInput:
      "h-8 w-full rounded-md border-0 bg-[#1f1f1d] px-2 text-sm text-[#f1ede4] outline-none focus:bg-[#232320]",
    deleteButton:
      "inline-flex h-6 w-6 items-center justify-center rounded-md text-[#aaa295] transition hover:bg-[#3a3833] hover:text-[#ece7dd]",
    footerSection: "px-2 py-1.5",
    footerButton:
      "flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-[13px] text-[#b9b2a5] transition hover:bg-[#2f2e29]",
    footerButtonActive:
      "flex w-full items-center gap-2 rounded-lg bg-[#35342f] px-2.5 py-1.5 text-[13px] font-medium text-[#f1ede4]",
  },
  composer: {
    formLanding: "w-full px-4 pb-10 sm:px-6",
    formDocked: "bg-gradient-to-t from-[#1F1F1E] via-[#1F1F1E]/84 to-transparent px-4 pb-4 pt-2 sm:px-6",
    card:
      "mx-auto w-full max-w-[var(--standard-flow-width)] rounded-[1.6rem] border border-[#3c3b36] bg-[#2f2f2d] px-3 py-2 shadow-[inset_0_1px_0_rgba(255,255,255,0.03),0_10px_22px_rgba(0,0,0,0.24)]",
    textarea:
      "min-h-[42px] max-h-36 w-full resize-none rounded-xl border-0 bg-transparent px-1.5 py-1 text-[15px] leading-[1.55] text-[#f7f3eb] placeholder:text-[#b6ae9f] outline-none disabled:opacity-60",
    controlsDivider: "mt-0.5 flex items-center justify-between gap-2 px-0.5 pt-0.5",
    control:
      "h-8 rounded-lg border border-transparent bg-transparent px-2 text-sm text-[#d8d1c4] outline-none transition hover:bg-[#35342f] focus:bg-[#3b3a34] disabled:opacity-60",
    backendChip:
      "inline-flex h-7 items-center rounded-lg border border-transparent bg-transparent px-2 text-xs font-medium text-[#d8d2c6]",
    iconButton:
      "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-[#beb7ab] transition hover:bg-[#3a3934] hover:text-[#e8e2d7]",
    iconButtonActive:
      "inline-flex h-8 w-8 items-center justify-center rounded-md border border-[#4a4841] bg-[#3a3934] text-[#f0ebe2] transition hover:bg-[#43423d]",
    stopButton:
      "inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[#f0ece3] text-[#2b2925] transition hover:bg-[#dfd8ca]",
    regenerateButton:
      "inline-flex h-8 w-8 items-center justify-center rounded-md border border-transparent bg-transparent text-[#beb7ab] transition hover:bg-[#3a3934] hover:text-[#e8e2d7] disabled:cursor-not-allowed disabled:opacity-40",
    sendButton:
      "inline-flex h-8 w-8 items-center justify-center rounded-full border-0 bg-[#f0ece3] text-[#2b2925] transition hover:bg-[#dfd8ca] disabled:cursor-not-allowed disabled:opacity-40",
    metaRow:
      "mt-0.5 flex flex-wrap items-center gap-x-2.5 gap-y-1 px-0.5 pt-0 text-[11px] text-[#c8c1b5]",
    settingsPanel:
      "mx-auto mt-2 w-full max-w-4xl rounded-2xl bg-[#1F1F1E]/82 px-3 py-3 shadow-[0_1px_0_rgba(0,0,0,0.35)]",
    settingsTitle: "text-[11px] font-semibold uppercase tracking-[0.08em] text-[#a7a092]",
    settingsLabel: "block text-xs font-medium text-[#cbc4b8]",
    settingsInput:
      "w-full rounded-lg border border-[#4a4841] bg-[#1f1f1d] px-2 py-2 text-sm text-[#e9e6df] outline-none transition focus:border-[#69655d] disabled:opacity-60",
    settingsSwitch:
      "flex items-center justify-between gap-2 rounded-lg border border-[#4a4841] bg-[#2b2a27] px-2.5 py-2.5",
  },
  messages: {
    container: "min-h-0 flex-1 overflow-y-auto px-4 py-6 sm:px-6",
    list: "mx-auto flex w-full max-w-[var(--standard-flow-width)] flex-col gap-2.5 pb-20 mb-10",
    emptyTitle: "text-2xl font-semibold text-[#efebe3]",
    emptyDescription: "mt-2 text-sm text-[#9f988b]",
    userBubble: "max-w-[58ch] rounded-2xl border border-[#4a463d] bg-[#312e28] px-3 py-2 text-[#f7f3eb]",
    assistantBubble: "rounded-2xl px-0 py-0",
    copyButton:
      "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#c3bcaf] transition hover:bg-[#34322e] hover:text-[#f2eee6]",
    regenerateButton:
      "inline-flex h-7 items-center gap-1 rounded-md px-2 text-xs text-[#c3bcaf] transition hover:bg-[#34322e] hover:text-[#f2eee6]",
    streamingStatus: "text-xs font-medium text-[#c8c1b5]",
    loadingCursor:
      "after:inline-block after:h-[1.1em] after:w-2 after:rounded-sm after:bg-[#9f988b] after:content-['']",
  },
  messageContent: {
    text: "m-0 whitespace-pre-wrap break-words text-[15px] leading-7 text-current",
    codeWrapper: "overflow-hidden rounded-xl border border-[#4f493f] bg-transparent",
    codeLanguage:
      "border-b border-[#595245] bg-[#23221f] px-2.5 py-1 text-[10px] font-normal lowercase tracking-wide text-[#b5aea1]",
    codeBody: "font-mono whitespace-pre text-[13px] leading-5 text-[#f7f2e9]",
  },
  terminal: {
    frameLanding: "w-full px-4 pb-2 sm:px-6",
    frameDocked: "px-4 pb-2 pt-2 sm:px-6",
  },
  copy: {
    heroHeading: "How can I support you today?",
    promptPlaceholder: "Send a message...",
    startConversationTitle: "Start a conversation",
    startConversationSubtitle: "Choose a model and share what you need.",
    generatingLabel: "Generating response...",
  },
};

const CLAUDE_LIGHT_THEME_SNAPSHOT = JSON.stringify(claudeTheme);
const CLAUDE_DARK_THEME_SNAPSHOT = JSON.stringify(claudeDarkTheme);

export function readClaudeTheme(mode: ThemeMode): ProviderTheme {
  return JSON.parse(mode === "dark" ? CLAUDE_DARK_THEME_SNAPSHOT : CLAUDE_LIGHT_THEME_SNAPSHOT) as ProviderTheme;
}
