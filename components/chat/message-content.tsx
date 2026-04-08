"use client";

import { memo, useMemo, useState, type ReactNode } from "react";
import { splitByCodeBlocks } from "../../lib/utils";
import type { ProviderTheme } from "./providers";
import { CheckIcon, CopyIcon } from "./ui-icons";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import Prism from "prismjs";
import "prismjs/components/prism-bash";
import "prismjs/components/prism-c";
import "prismjs/components/prism-cpp";
import "prismjs/components/prism-csharp";
import "prismjs/components/prism-go";
import "prismjs/components/prism-java";
import "prismjs/components/prism-json";
import "prismjs/components/prism-jsx";
import "prismjs/components/prism-kotlin";
import "prismjs/components/prism-markdown";
import "prismjs/components/prism-markup-templating";
import "prismjs/components/prism-php";
import "prismjs/components/prism-powershell";
import "prismjs/components/prism-python";
import "prismjs/components/prism-ruby";
import "prismjs/components/prism-rust";
import "prismjs/components/prism-sql";
import "prismjs/components/prism-swift";
import "prismjs/components/prism-tsx";
import "prismjs/components/prism-typescript";
import "prismjs/components/prism-yaml";

type HighlightedCode = {
  html: string;
  prismLanguage: string;
  displayLanguage: string;
};

const LANGUAGE_ALIASES: Record<string, string> = {
  bash: "bash",
  c: "c",
  cpp: "cpp",
  cs: "csharp",
  csharp: "csharp",
  docker: "bash",
  dockerfile: "bash",
  golang: "go",
  html: "markup",
  htm: "markup",
  java: "java",
  js: "javascript",
  json: "json",
  jsx: "jsx",
  kt: "kotlin",
  kts: "kotlin",
  markdown: "markdown",
  md: "markdown",
  php: "php",
  ps1: "powershell",
  py: "python",
  python: "python",
  rb: "ruby",
  rs: "rust",
  sh: "bash",
  shell: "bash",
  sql: "sql",
  swift: "swift",
  text: "plain",
  plaintext: "plain",
  ts: "typescript",
  tsx: "tsx",
  txt: "plain",
  xml: "markup",
  yaml: "yaml",
  yml: "yaml",
  zsh: "bash",
};

function escapeHtml(value: string) {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

function normalizeLanguage(rawLanguage: string) {
  const sanitized = rawLanguage.trim().toLowerCase().replace(/[^a-z0-9_+-]/g, "");
  if (!sanitized) return "";
  return LANGUAGE_ALIASES[sanitized] || sanitized;
}

function resolvePrismLanguage(rawLanguage: string) {
  const normalized = normalizeLanguage(rawLanguage);
  if (!normalized || normalized === "plain") return "";
  return Prism.languages[normalized] ? normalized : "";
}

function highlightCode(value: string, rawLanguage: string): HighlightedCode {
  const prismLanguage = resolvePrismLanguage(rawLanguage);
  const displayLanguage = normalizeLanguage(rawLanguage) || "code";

  if (!prismLanguage) {
    return {
      html: escapeHtml(value),
      prismLanguage: "plain",
      displayLanguage,
    };
  }

  const grammar = Prism.languages[prismLanguage];
  if (!grammar) {
    return {
      html: escapeHtml(value),
      prismLanguage: "plain",
      displayLanguage,
    };
  }

  try {
    return {
      html: Prism.highlight(value, grammar, prismLanguage),
      prismLanguage,
      displayLanguage,
    };
  } catch {
    return {
      html: escapeHtml(value),
      prismLanguage: "plain",
      displayLanguage,
    };
  }
}

function extractLanguageFromClassName(className?: string) {
  if (!className) return "";
  const matched = className.match(/language-([a-z0-9_+-]+)/i);
  return matched?.[1] || "";
}

function toText(children: ReactNode): string {
  if (typeof children === "string") return children;
  if (typeof children === "number") return String(children);
  if (!Array.isArray(children)) return "";
  return children.map((child) => toText(child)).join("");
}

function MessageContentView({
  content,
  theme,
  minimalCodeBlocks = false,
  showCodeCopyButton = true,
}: {
  content: string;
  theme: ProviderTheme;
  minimalCodeBlocks?: boolean;
  showCodeCopyButton?: boolean;
}) {
  const segments = useMemo(() => splitByCodeBlocks(content), [content]);
  const highlightedBySegmentKey = useMemo(() => {
    const entries = new Map<string, HighlightedCode>();

    segments.forEach((segment, index) => {
      if (segment.type !== "code") return;
      const segmentKey = `${segment.type}-${index}`;
      entries.set(segmentKey, highlightCode(segment.value, segment.language));
    });

    return entries;
  }, [segments]);
  const [copiedSegmentKey, setCopiedSegmentKey] = useState("");
  const isDark = theme.isDark;
  const codeButtonClass = isDark
    ? "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-[#4f493f] bg-[#2b2a27]/92 px-2 text-[11px] text-[#d8d2c6] transition hover:bg-[#34322e]"
    : "inline-flex h-6 shrink-0 items-center gap-1 rounded-md border border-[#d6d5d2] bg-[#f3f1ea] px-2 text-[11px] text-[#5d584f] transition hover:bg-[#e9e6df]";
  const floatingCodeButtonClass =
    codeButtonClass + (isDark ? " shadow-[0_4px_14px_rgba(0,0,0,0.35)]" : " shadow-[0_4px_14px_rgba(34,30,22,0.14)]");
  const blockquoteClass = isDark
    ? "m-0 border-l-2 border-[#4a4841] pl-3 text-[15px] leading-7 text-[#b8b1a5]"
    : "m-0 border-l-2 border-[#d6d5d2] pl-3 text-[15px] leading-7 text-[#5f5b53]";
  const linkClass = isDark
    ? "text-[#8cb9ff] underline decoration-[#5d7ca5] underline-offset-2 hover:text-[#b2d0ff]"
    : "text-[#1f5fa9] underline decoration-[#8fb3dd] underline-offset-2 hover:text-[#154881]";
  const inlineCodeClass = isDark
    ? "rounded-md border border-[#4a4841] bg-[#2c2a26] px-1.5 py-[1px] font-mono text-[0.92em] text-[#e5dfd3]"
    : "rounded-md border border-[#d6d5d2] bg-[#f2f1ed] px-1.5 py-[1px] font-mono text-[0.92em] text-[#37342f]";
  const preClass = isDark
    ? "m-0 overflow-x-auto rounded-xl border border-[#4f493f] bg-transparent p-3"
    : "m-0 overflow-x-auto rounded-xl border border-[#d6d5d2] bg-transparent p-3";
  const tableHeadClass = isDark
    ? "border border-[#4a4841] bg-[#2c2a26] px-2 py-1 text-left font-semibold"
    : "border border-[#d6d5d2] bg-[#f2f1ed] px-2 py-1 text-left font-semibold";
  const tableCellClass = isDark ? "border border-[#4a4841] px-2 py-1" : "border border-[#d6d5d2] px-2 py-1";
  const hrClass = isDark ? "border-0 border-t border-[#4a4841]" : "border-0 border-t border-[#d6d5d2]";

  async function copyCodeSegment(key: string, code: string) {
    if (!code.trim()) return;
    try {
      await navigator.clipboard.writeText(code);
      setCopiedSegmentKey(key);
      window.setTimeout(() => setCopiedSegmentKey(""), 1400);
    } catch {
      // Ignore clipboard failures silently.
    }
  }

  return (
    <div className="flex max-w-full flex-col gap-2.5">
      {segments.map((segment, index) => {
        const segmentKey = `${segment.type}-${index}`;
        if (segment.type === "code") {
          const highlighted = highlightedBySegmentKey.get(segmentKey) || {
            html: escapeHtml(segment.value),
            prismLanguage: "plain",
            displayLanguage: segment.language || "code",
          };
          const codeLabel = segment.language || highlighted.displayLanguage || "code";
          const headerLabel = codeLabel;
          const isCopied = copiedSegmentKey === segmentKey;

          if (minimalCodeBlocks) {
            return (
              <pre key={segmentKey} className="m-0 overflow-x-auto p-0">
                <code
                  className={`${theme.messageContent.codeBody} prism-code language-${highlighted.prismLanguage}`}
                  dangerouslySetInnerHTML={{ __html: highlighted.html }}
                />
              </pre>
            );
          }

          return (
            <div
              key={segmentKey}
              className={
                "group/code relative"
              }
            >
              <div
                className={
                  theme.messageContent.codeWrapper +
                  (segment.isUnterminated ? " ring-1 ring-[#5a5247]/35" : "")
                }
              >
                <div className="overflow-x-auto">
                  <div className={theme.messageContent.codeLanguage + " flex items-center gap-2"}>
                    <span className="min-w-0 truncate">{headerLabel}</span>
                  </div>
                  <pre className="m-0 overflow-x-auto p-3">
                    <code
                      className={`${theme.messageContent.codeBody} prism-code language-${highlighted.prismLanguage}`}
                      dangerouslySetInnerHTML={{ __html: highlighted.html }}
                    />
                  </pre>
                </div>
              </div>
              {showCodeCopyButton ? (
                <div className="pointer-events-none absolute -bottom-3 right-2 z-[3]">
                  <button
                    type="button"
                    className={floatingCodeButtonClass + " pointer-events-auto"}
                    onClick={() => void copyCodeSegment(segmentKey, segment.value)}
                    aria-label="Copy code block"
                  >
                    {isCopied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
                    <span>{isCopied ? "Copied" : "Copy"}</span>
                  </button>
                </div>
              ) : null}
            </div>
          );
        }

        if (!segment.value.trim()) {
          return null;
        }

        return (
          <div key={segmentKey} className="flex max-w-full flex-col gap-2">
            <ReactMarkdown
              remarkPlugins={[remarkGfm]}
              skipHtml
              components={{
                p: ({ children }) => <p className={theme.messageContent.text}>{children}</p>,
                h1: ({ children }) => (
                  <h1 className="m-0 text-[1.18rem] font-semibold leading-8 text-current">{children}</h1>
                ),
                h2: ({ children }) => (
                  <h2 className="m-0 text-[1.08rem] font-semibold leading-7 text-current">{children}</h2>
                ),
                h3: ({ children }) => <h3 className="m-0 text-[1rem] font-semibold leading-7 text-current">{children}</h3>,
                ul: ({ children }) => (
                  <ul className="my-0 ml-5 list-disc space-y-1 text-[15px] leading-7 text-current">{children}</ul>
                ),
                ol: ({ children }) => (
                  <ol className="my-0 ml-5 list-decimal space-y-1 text-[15px] leading-7 text-current">{children}</ol>
                ),
                li: ({ children }) => <li className="pl-1">{children}</li>,
                blockquote: ({ children }) => (
                  <blockquote className={blockquoteClass}>{children}</blockquote>
                ),
                a: ({ href, children }) => (
                  <a
                    href={href}
                    target="_blank"
                    rel="noreferrer noopener"
                    className={linkClass}
                  >
                    {children}
                  </a>
                ),
                code: ({ className, children }) => {
                  const language = extractLanguageFromClassName(className);
                  if (language) {
                    const codeText = toText(children).replace(/\n$/, "");
                    const highlighted = highlightCode(codeText, language);
                    return (
                      <code
                        className={`${theme.messageContent.codeBody} prism-code language-${highlighted.prismLanguage}`}
                        dangerouslySetInnerHTML={{ __html: highlighted.html }}
                      />
                    );
                  }
                  return <code className={inlineCodeClass}>{children}</code>;
                },
                pre: ({ children }) => <pre className={preClass}>{children}</pre>,
                table: ({ children }) => (
                  <div className="overflow-x-auto">
                    <table className="w-full min-w-[22rem] border-collapse text-[14px] leading-6 text-current">
                      {children}
                    </table>
                  </div>
                ),
                th: ({ children }) => <th className={tableHeadClass}>{children}</th>,
                td: ({ children }) => <td className={tableCellClass}>{children}</td>,
                hr: () => <hr className={hrClass} />,
              }}
            >
              {segment.value}
            </ReactMarkdown>
          </div>
        );
      })}
    </div>
  );
}

export const MessageContent = memo(
  MessageContentView,
  (prev, next) =>
    prev.content === next.content &&
    prev.theme === next.theme
);
