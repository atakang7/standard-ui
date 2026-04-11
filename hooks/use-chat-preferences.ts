"use client";

import { useCallback, useEffect, useLayoutEffect, useMemo, useState } from "react";
import type { AppearanceMode, ChatSettings } from "../lib/types";
import { DEFAULT_CHAT_SETTINGS, SETTINGS_BY_BACKEND_KEY } from "../lib/constants";
import {
  normalizeStreamReadabilityPace,
  persistAppearanceMode,
  persistStreamReadabilityPace,
  readStoredAppearanceMode,
  readStoredStreamReadabilityPace,
  resolveAppearanceMode,
  settingsMapFromRaw,
} from "../lib/storage";
import { normalizeChatSettings } from "../lib/utils";

const useIsomorphicLayoutEffect = typeof window === "undefined" ? useEffect : useLayoutEffect;

export function useChatPreferences(selectedBackend: string) {
  const [settingsByBackend, setSettingsByBackend] = useState<Record<string, ChatSettings>>({});
  const [settingsHydrated, setSettingsHydrated] = useState(false);
  const [appearanceMode, setAppearanceMode] = useState<AppearanceMode>(() => readStoredAppearanceMode());
  const [streamReadabilityPace, setStreamReadabilityPace] = useState<number>(() =>
    readStoredStreamReadabilityPace()
  );
  const [appearanceModeHydrated, setAppearanceModeHydrated] = useState(false);
  const [prefersDark, setPrefersDark] = useState<boolean>(() => {
    if (typeof window === "undefined") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  const resolvedAppearanceMode = resolveAppearanceMode(appearanceMode, prefersDark);
  const activeSettings = useMemo(
    () => settingsByBackend[selectedBackend] ?? DEFAULT_CHAT_SETTINGS,
    [selectedBackend, settingsByBackend]
  );
  const preferencesReady = appearanceModeHydrated && settingsHydrated;

  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedMode = readStoredAppearanceMode();
    if (storedMode !== appearanceMode) {
      setAppearanceMode(storedMode);
    }
    setAppearanceModeHydrated(true);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const mediaQuery = window.matchMedia("(prefers-color-scheme: dark)");
    const applyResolvedMode = () => {
      setPrefersDark(mediaQuery.matches);
    };

    applyResolvedMode();
    if (typeof mediaQuery.addEventListener === "function") {
      mediaQuery.addEventListener("change", applyResolvedMode);
      return () => mediaQuery.removeEventListener("change", applyResolvedMode);
    }

    mediaQuery.addListener(applyResolvedMode);
    return () => mediaQuery.removeListener(applyResolvedMode);
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!appearanceModeHydrated) return;
    persistAppearanceMode(appearanceMode);
  }, [appearanceMode, appearanceModeHydrated]);

  useEffect(() => {
    persistStreamReadabilityPace(streamReadabilityPace);
  }, [streamReadabilityPace]);

  useEffect(() => {
    try {
      const rawSettings = localStorage.getItem(SETTINGS_BY_BACKEND_KEY);
      setSettingsByBackend(settingsMapFromRaw(rawSettings));
    } catch {
      setSettingsByBackend({});
    } finally {
      setSettingsHydrated(true);
    }
  }, []);

  useEffect(() => {
    if (!settingsHydrated) return;
    localStorage.setItem(SETTINGS_BY_BACKEND_KEY, JSON.stringify(settingsByBackend));
  }, [settingsByBackend, settingsHydrated]);

  useEffect(() => {
    if (!selectedBackend) return;

    setSettingsByBackend((current) => {
      if (current[selectedBackend]) return current;
      return {
        ...current,
        [selectedBackend]: normalizeChatSettings(),
      };
    });
  }, [selectedBackend]);

  useIsomorphicLayoutEffect(() => {
    if (typeof document === "undefined") return;
    const root = document.documentElement;
    root.dataset.colorMode = resolvedAppearanceMode;
    root.style.colorScheme = resolvedAppearanceMode;
    if (!root.hasAttribute("data-theme-switching")) return;
    const timeoutId = window.setTimeout(() => {
      root.removeAttribute("data-theme-switching");
    }, 0);
    return () => window.clearTimeout(timeoutId);
  }, [resolvedAppearanceMode]);

  const selectAppearanceMode = useCallback(
    (nextMode: AppearanceMode) => {
      persistAppearanceMode(nextMode);
      if (nextMode === appearanceMode) return;
      if (typeof document !== "undefined") {
        document.documentElement.setAttribute("data-theme-switching", "1");
        window.setTimeout(() => {
          document.documentElement.removeAttribute("data-theme-switching");
        }, 180);
      }
      setAppearanceMode(nextMode);
    },
    [appearanceMode]
  );

  const selectStreamReadabilityPace = useCallback((value: number) => {
    setStreamReadabilityPace(normalizeStreamReadabilityPace(value));
  }, []);

  const updateActiveSettings = useCallback(
    (nextSettings: Partial<ChatSettings>) => {
      if (!selectedBackend) return;

      setSettingsByBackend((current) => {
        const currentSettings = current[selectedBackend] ?? DEFAULT_CHAT_SETTINGS;
        return {
          ...current,
          [selectedBackend]: normalizeChatSettings({
            ...currentSettings,
            ...nextSettings,
          }),
        };
      });
    },
    [selectedBackend]
  );

  return {
    appearanceMode,
    resolvedAppearanceMode,
    streamReadabilityPace,
    preferencesReady,
    activeSettings,
    selectAppearanceMode,
    selectStreamReadabilityPace,
    updateActiveSettings,
  };
}
