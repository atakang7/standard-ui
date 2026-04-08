import type { ProviderTheme, ProviderUi, ThemeMode } from "./types";
import { readClaudeTheme } from "./claude-ui";

type BackendLike = {
  id?: string;
  label?: string;
} | null;

export function resolveProviderUi(_backend: BackendLike, _selectedBackendId = ""): ProviderUi {
  return "claude";
}

export function getProviderTheme(_providerUi: ProviderUi, mode: ThemeMode): ProviderTheme {
  return readClaudeTheme(mode);
}

export type { ProviderTheme, ProviderUi, ThemeMode };
