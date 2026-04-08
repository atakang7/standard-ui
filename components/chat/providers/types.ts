export type ProviderUi = "openai" | "claude" | "gemini";
export type ThemeMode = "light" | "dark";

export type ProviderTheme = {
  providerLabel: string;
  isDark: boolean;
  layout: {
    main: string;
    sidebarShell: string;
    content: string;
    overlay: string;
    errorText: string;
    emptySection: string;
    emptyHeading: string;
  };
  topbar: {
    header: string;
    iconButton: string;
    title: string;
    providerBadge: string;
  };
  sidebar: {
    newChatButton: string;
    recentsLabel: string;
    emptyText: string;
    threadButtonActive: string;
    threadButtonIdle: string;
    renameForm: string;
    renameInput: string;
    deleteButton: string;
    footerSection: string;
    footerButton: string;
    footerButtonActive: string;
  };
  composer: {
    formLanding: string;
    formDocked: string;
    card: string;
    textarea: string;
    controlsDivider: string;
    control: string;
    backendChip: string;
    iconButton: string;
    iconButtonActive: string;
    stopButton: string;
    regenerateButton: string;
    sendButton: string;
    metaRow: string;
    settingsPanel: string;
    settingsTitle: string;
    settingsLabel: string;
    settingsInput: string;
    settingsSwitch: string;
  };
  messages: {
    container: string;
    list: string;
    emptyTitle: string;
    emptyDescription: string;
    userBubble: string;
    assistantBubble: string;
    copyButton: string;
    regenerateButton: string;
    streamingStatus: string;
    loadingCursor: string;
  };
  messageContent: {
    text: string;
    codeWrapper: string;
    codeLanguage: string;
    codeBody: string;
  };
  terminal: {
    frameLanding: string;
    frameDocked: string;
  };
  copy: {
    heroHeading: string;
    promptPlaceholder: string;
    startConversationTitle: string;
    startConversationSubtitle: string;
    generatingLabel: string;
  };
};
