import type { ProviderTheme } from "./types";
import { claudeTheme } from "./claude-ui";

export const geminiTheme: ProviderTheme = {
  ...claudeTheme,
  providerLabel: "Gemini",
  copy: {
    ...claudeTheme.copy,
    promptPlaceholder: "Message model",
  },
};
