import "./globals.css";
import type { ReactNode } from "react";
import { cookies } from "next/headers";

export const metadata = {
  title: "standard-ui",
  description: "Provider-agnostic chat UI for OpenAI-compatible APIs, Anthropic, Ollama, and custom gateways",
};

const APPEARANCE_MODE_KEY = "standard_llm_appearance_mode_v1";

type AppearanceMode = "light" | "dark" | "system";
type ResolvedMode = "light" | "dark";

function normalizeAppearanceMode(value: string | undefined): AppearanceMode {
  if (value === "light" || value === "dark" || value === "system") {
    return value;
  }
  return "light";
}

function resolveServerMode(mode: AppearanceMode): ResolvedMode {
  return mode === "dark" ? "dark" : "light";
}

function createThemeBootstrapScript(serverMode: AppearanceMode) {
  return `
(() => {
  try {
    const key = ${JSON.stringify(APPEARANCE_MODE_KEY)};
    const serverMode = ${JSON.stringify(serverMode)};
    const rawMode = window.localStorage.getItem(key);
    const mode =
      rawMode === "light" || rawMode === "dark" || rawMode === "system"
        ? rawMode
        : serverMode;
    if (rawMode !== mode) {
      window.localStorage.setItem(key, mode);
    }
    const prefersDark = window.matchMedia("(prefers-color-scheme: dark)").matches;
    const resolvedMode = mode === "system" ? (prefersDark ? "dark" : "light") : mode;
    document.documentElement.dataset.colorMode = resolvedMode;
    document.documentElement.style.colorScheme = resolvedMode;
    document.cookie = key + "=" + mode + "; Path=/; Max-Age=31536000; SameSite=Lax";
  } catch {
    document.documentElement.dataset.colorMode = "light";
    document.documentElement.style.colorScheme = "light";
  }
})();
`;
}

export default function RootLayout({ children }: { children: ReactNode }) {
  const storedMode = normalizeAppearanceMode(cookies().get(APPEARANCE_MODE_KEY)?.value);
  const initialResolvedMode = resolveServerMode(storedMode);
  const themeBootstrapScript = createThemeBootstrapScript(storedMode);

  return (
    <html
      lang="en"
      data-color-mode={initialResolvedMode}
      style={{ colorScheme: initialResolvedMode }}
      suppressHydrationWarning
    >
      <head>
        <script id="theme-bootstrap" dangerouslySetInnerHTML={{ __html: themeBootstrapScript }} />
      </head>
      <body>
        <a href="#main-content" className="skip-link">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}
