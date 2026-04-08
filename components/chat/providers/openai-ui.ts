import type { ProviderTheme } from "./types";
import { claudeTheme } from "./claude-ui";

export const openAITheme: ProviderTheme = {
  ...claudeTheme,
  providerLabel: "OpenAI",
  copy: {
    ...claudeTheme.copy,
    promptPlaceholder: "Message model",
  },
};
