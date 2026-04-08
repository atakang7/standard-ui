import type { ChatArtifact, ChatMessage, Role } from "./types";
import { splitByCodeBlocks } from "./utils";

export const AUTO_CODE_ARTIFACT_SOURCE = "auto-code-bundle";
export const AUTO_TEXT_ARTIFACT_SOURCE = "auto-text-bundle";

const AUTO_ARTIFACT_SOURCES = new Set<string>([
  AUTO_CODE_ARTIFACT_SOURCE,
  AUTO_TEXT_ARTIFACT_SOURCE,
]);
const ARTIFACT_PREVIEW_MAX_CHARS = 240;
const CODE_BLOCK_MIN_CHARS = 1800;
const CODE_BLOCK_MIN_LINES = 50;
const CODE_TOTAL_MIN_CHARS = 2600;
const PLAIN_CODE_MIN_CHARS = 3000;
const PLAIN_CODE_MIN_LINES = 50;
const TEXT_ARTIFACT_MIN_CHARS = 5200;
const TEXT_ARTIFACT_MIN_LINES = 90;

type AutoBundleKind = "code" | "text";

function generateId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function normalizeCodeLanguage(content: string) {
  const fence = content.match(/```([a-zA-Z0-9_+-]{1,32})/);
  if (!fence?.[1]) return undefined;
  return fence[1].toLowerCase();
}

function countLines(content: string) {
  if (!content) return 0;
  return content.split(/\r?\n/).length;
}

function countSpecialCodeChars(content: string) {
  const matches = content.match(/[{}()[\];<>:=/*+\-_%$#`|&]/g);
  return matches ? matches.length : 0;
}

function hasFencedCode(content: string) {
  return /```[\s\S]+```/.test(content);
}

function getCodeSegmentStats(content: string) {
  const segments = splitByCodeBlocks(content);
  let totalCodeChars = 0;
  let totalCodeLines = 0;
  let maxCodeChars = 0;
  let maxCodeLines = 0;
  let primaryLanguage = "";

  for (const segment of segments) {
    if (segment.type !== "code") continue;
    const code = segment.value.trimEnd();
    if (!code) continue;

    const segmentChars = code.length;
    const segmentLines = countLines(code);
    totalCodeChars += segmentChars;
    totalCodeLines += segmentLines;

    if (segmentChars > maxCodeChars) {
      maxCodeChars = segmentChars;
      maxCodeLines = segmentLines;
      primaryLanguage = segment.language || primaryLanguage;
      continue;
    }

    if (!primaryLanguage && segment.language) {
      primaryLanguage = segment.language;
    }
  }

  return {
    totalCodeChars,
    totalCodeLines,
    maxCodeChars,
    maxCodeLines,
    primaryLanguage: primaryLanguage || undefined,
  };
}

function isLikelyCode(content: string) {
  if (!content.trim()) return false;
  if (hasFencedCode(content)) return true;

  const normalized = content.replace(/\r\n/g, "\n");
  const lines = normalized.split("\n");
  const nonEmpty = lines.map((line) => line.trim()).filter(Boolean);
  if (!nonEmpty.length) return false;

  let codeLineHits = 0;
  for (const line of nonEmpty) {
    if (
      /^(const|let|var|function|class|if|else|for|while|switch|case|return|import|export|from|async|await|try|catch|finally|throw|def|lambda|SELECT|INSERT|UPDATE|DELETE|CREATE|ALTER|DROP|WITH|FROM|WHERE)\b/i.test(
        line
      )
    ) {
      codeLineHits += 1;
      continue;
    }
    if (/=>|::|<\/?[a-zA-Z][^>]*>|[{[\]}();]/.test(line)) {
      codeLineHits += 1;
      continue;
    }
    if (/^[a-zA-Z0-9_.-]+\s*:\s*.+$/.test(line) && line.length < 120) {
      codeLineHits += 0.5;
      continue;
    }
    if (/^[#\-*]{1,2}\s+\w+/.test(line)) {
      continue;
    }
  }

  const codeLineRatio = codeLineHits / Math.max(1, nonEmpty.length);
  const symbolRatio = countSpecialCodeChars(content) / Math.max(1, content.length);

  if (codeLineRatio >= 0.35) return true;
  if (nonEmpty.length >= 8 && symbolRatio >= 0.085) return true;
  return false;
}

function shouldBundleCodeArtifact(content: string) {
  const stats = getCodeSegmentStats(content);
  const lines = countLines(content);

  if (stats.maxCodeChars >= CODE_BLOCK_MIN_CHARS || stats.maxCodeLines >= CODE_BLOCK_MIN_LINES) {
    return true;
  }

  if (
    stats.totalCodeChars >= CODE_TOTAL_MIN_CHARS &&
    stats.totalCodeChars / Math.max(1, content.length) >= 0.42
  ) {
    return true;
  }

  if (stats.totalCodeChars > 0) {
    return false;
  }

  if (!isLikelyCode(content)) return false;
  return content.length >= PLAIN_CODE_MIN_CHARS || lines >= PLAIN_CODE_MIN_LINES;
}

function shouldBundleTextArtifact(content: string) {
  if (!content.trim()) return false;
  if (hasFencedCode(content)) return false;
  if (isLikelyCode(content)) return false;

  const lines = countLines(content);
  return content.length >= TEXT_ARTIFACT_MIN_CHARS || lines >= TEXT_ARTIFACT_MIN_LINES;
}

function resolveAutoBundleKind(content: string): AutoBundleKind | null {
  if (shouldBundleCodeArtifact(content)) return "code";
  if (shouldBundleTextArtifact(content)) return "text";
  return null;
}

function buildAutoArtifact(
  content: string,
  createdAt: number,
  role: ChatMessage["role"],
  kind: AutoBundleKind,
  preferredLanguage?: string
): ChatArtifact {
  const codeStats = getCodeSegmentStats(content);
  const language =
    kind === "code"
      ? preferredLanguage || normalizeCodeLanguage(content) || codeStats.primaryLanguage
      : undefined;
  const sizeBytes = Math.max(1, new TextEncoder().encode(content).length);
  const preview = content.replace(/\s+/g, " ").trim().slice(0, ARTIFACT_PREVIEW_MAX_CHARS);
  const lineCount = countLines(content);
  const charCount = content.length;
  const source = kind === "code" ? AUTO_CODE_ARTIFACT_SOURCE : AUTO_TEXT_ARTIFACT_SOURCE;

  return {
    id: `artifact-${generateId()}`,
    source,
    title:
      kind === "code"
        ? role === "assistant"
          ? "Assistant code"
          : "Code"
        : role === "assistant"
          ? "Assistant text"
          : "Text",
    mimeType: "text/plain",
    sizeBytes,
    createdAt,
    content,
    preview: preview || undefined,
    language,
    lineCount,
    charCount,
  };
}

export function resolveDraftBundleArtifact(content: string, role: Role = "user") {
  const normalized = content.trim();
  if (!normalized) return null;
  const kind = resolveAutoBundleKind(normalized);
  if (!kind) return null;
  return buildAutoArtifact(normalized, Date.now(), role, kind);
}

// Backward-compatible name used by existing composer imports.
export const resolveDraftCodeArtifact = resolveDraftBundleArtifact;

export function extractInlineDraftArtifacts(content: string, role: Role = "user") {
  const normalizedInput = content.replace(/\r\n/g, "\n");
  if (!normalizedInput.trim()) {
    return {
      remainingText: normalizedInput,
      artifacts: [] as ChatArtifact[],
    };
  }

  const segments = splitByCodeBlocks(normalizedInput);
  const artifacts: ChatArtifact[] = [];
  let remainingText = "";

  for (const segment of segments) {
    if (segment.type === "code") {
      const code = segment.value.trimEnd();
      if (!code.trim()) continue;

      const shouldExtract = shouldBundleCodeArtifact(code) || countLines(code) >= CODE_BLOCK_MIN_LINES;
      if (shouldExtract) {
        artifacts.push(
          buildAutoArtifact(code, Date.now(), role, "code", segment.language || undefined)
        );
      } else {
        remainingText += `\`\`\`${segment.language || ""}\n${code}\n\`\`\`\n`;
      }
      continue;
    }

    const text = segment.value;
    if (!text) continue;

    if (role === "user" && shouldBundleTextArtifact(text)) {
      artifacts.push(buildAutoArtifact(text.trim(), Date.now(), role, "text"));
    } else {
      remainingText += text;
    }
  }

  return {
    remainingText,
    artifacts,
  };
}

export function mergePromptWithArtifacts(promptText: string, artifacts: ChatArtifact[]) {
  const parts: string[] = [];
  const trimmedPrompt = promptText.trim();
  if (trimmedPrompt) {
    parts.push(trimmedPrompt);
  }

  for (const artifact of artifacts) {
    if (!artifact.content.trim()) continue;
    if (artifact.source === AUTO_CODE_ARTIFACT_SOURCE) {
      const language = artifact.language || "";
      parts.push(`\`\`\`${language}\n${artifact.content}\n\`\`\``);
      continue;
    }
    parts.push(artifact.content);
  }

  return parts.join("\n\n").trim();
}

function asCanonicalContent(message: ChatMessage) {
  return message.role === "assistant" ? message.modelContent ?? message.content : message.content;
}

export function applyAutoCodeArtifact(message: ChatMessage, createdAt: number): ChatMessage {
  const canonicalContent = asCanonicalContent(message);
  if (!canonicalContent) return message;

  const artifacts = Array.isArray(message.artifacts) ? message.artifacts : [];
  const nonAutoArtifacts = artifacts.filter(
    (artifact) => !AUTO_ARTIFACT_SOURCES.has(artifact.source || "")
  );
  const kind = resolveAutoBundleKind(canonicalContent);

  if (!kind) {
    const nextArtifacts = nonAutoArtifacts.length ? nonAutoArtifacts : undefined;
    const hasAutoArtifacts = artifacts.some((artifact) =>
      AUTO_ARTIFACT_SOURCES.has(artifact.source || "")
    );
    const assistantCanonicalReady =
      message.role !== "assistant" || message.modelContent === canonicalContent;
    if (!hasAutoArtifacts && assistantCanonicalReady && message.content === canonicalContent) {
      return message;
    }
    return {
      ...message,
      content: canonicalContent,
      modelContent: message.role === "assistant" ? canonicalContent : message.modelContent,
      artifacts: nextArtifacts,
    };
  }

  const expectedSource = kind === "code" ? AUTO_CODE_ARTIFACT_SOURCE : AUTO_TEXT_ARTIFACT_SOURCE;
  const existingAutoMatch = artifacts.find(
    (artifact) => artifact.source === expectedSource && artifact.content === canonicalContent
  );
  const nextAuto = existingAutoMatch ?? buildAutoArtifact(canonicalContent, createdAt, message.role, kind);
  const nextArtifacts = [...nonAutoArtifacts, nextAuto];
  const assistantCanonicalReady =
    message.role !== "assistant" || message.modelContent === canonicalContent;
  const hasExactArtifacts =
    artifacts.length === nextArtifacts.length &&
    artifacts.every((artifact, index) => artifact === nextArtifacts[index]);
  if (assistantCanonicalReady && message.content === canonicalContent && hasExactArtifacts) {
    return message;
  }

  return {
    ...message,
    content: canonicalContent,
    modelContent: message.role === "assistant" ? canonicalContent : message.modelContent,
    artifacts: nextArtifacts,
  };
}
