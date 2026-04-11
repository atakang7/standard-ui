import type { ProviderTheme, ThemeMode } from "./types";
import { readClaudeTheme } from "./claude-ui";

export function getProviderTheme(mode: ThemeMode): ProviderTheme {
  return readClaudeTheme(mode);
}

export type { ProviderTheme, ThemeMode };
