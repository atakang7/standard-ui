"use client";

import { useEffect, useRef, useState, type MouseEvent } from "react";
import type { ChatArtifact, ChatAttachment } from "../../lib/types";
import { formatBytes } from "../../lib/utils";
import { CheckIcon, CopyIcon, FileIcon } from "./ui-icons";
import { MessageContent } from "./message-content";
import type { ProviderTheme } from "./providers";

export function artifactSizeBytes(content: string) {
  try {
    return Math.max(1, new TextEncoder().encode(content).length);
  } catch {
    return Math.max(1, content.length);
  }
}

function attachmentUrl(id: string) {
  return `/api/uploads/${encodeURIComponent(id)}`;
}

export function buildArtifactClasses(isDark: boolean) {
  return {
    card: isDark
      ? "mb-2 overflow-hidden rounded-md border border-[#4a4841] bg-[#23221f]"
      : "mb-2 overflow-hidden rounded-md border border-[#d6d5d2] bg-[#f8f6f0]",
    summary: isDark
      ? "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[#ded7cb] hover:bg-[#2d2c28]"
      : "flex cursor-pointer list-none items-center justify-between gap-2 px-3 py-2 text-[#4a453d] hover:bg-[#efede6]",
    meta: isDark ? "text-[#a9a193]" : "text-[#7a756b]",
    panel: isDark
      ? "border-t border-[#4a4841] bg-[#1f1f1d] px-3 py-2"
      : "border-t border-[#d6d5d2] bg-[#fbfaf6] px-3 py-2",
  };
}

export function AttachmentStrip({
  attachments,
  isDark,
}: {
  attachments: ChatAttachment[];
  isDark: boolean;
}) {
  if (!attachments.length) return null;

  const images = attachments.filter((a) => a.kind === "image" && a.mimeType.startsWith("image/"));
  const files = attachments.filter((a) => !(a.kind === "image" && a.mimeType.startsWith("image/")));

  const fileChipClass = isDark
    ? "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#4a4841] bg-[#2a2926] px-2 py-1 text-xs text-[#d8d2c6] hover:bg-[#33322e]"
    : "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#d6d5d2] bg-[#fbfaf6] px-2 py-1 text-xs text-[#5d584f] hover:bg-[#f1eee7]";
  const imageCardClass = isDark
    ? "relative block h-28 w-40 overflow-hidden rounded-xl border border-[#4a4841] bg-[#1f1f1d]"
    : "relative block h-28 w-40 overflow-hidden rounded-xl border border-[#d6d5d2] bg-[#fbfaf6]";
  const imageCaptionClass = isDark
    ? "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#171613f2] to-[#17161300] px-2 py-1 text-[11px] text-[#ece7dd]"
    : "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#fbfaf6f2] to-[#fbfaf600] px-2 py-1 text-[11px] text-[#4a453d]";

  return (
    <div className="mb-2 w-fit max-w-full bg-transparent px-0 py-0">
      {images.length ? (
        <div className="mb-1.5 flex flex-wrap gap-1.5">
          {images.map((a) => (
            <a key={a.id} href={attachmentUrl(a.id)} target="_blank" rel="noreferrer noopener" className={imageCardClass}>
              <img src={attachmentUrl(a.id)} alt={a.name} loading="lazy" className="h-full w-full object-cover" />
              <div className={imageCaptionClass}><span className="block truncate">{a.name}</span></div>
            </a>
          ))}
        </div>
      ) : null}
      {files.length ? (
        <div className="flex flex-wrap gap-1.5">
          {files.map((a) => (
            <a key={a.id} href={attachmentUrl(a.id)} target="_blank" rel="noreferrer noopener" className={fileChipClass}>
              <FileIcon className="h-3.5 w-3.5 shrink-0" />
              <span className="truncate">{a.name}</span>
              <span className="shrink-0 opacity-75">{formatBytes(a.sizeBytes)}</span>
            </a>
          ))}
        </div>
      ) : null}
    </div>
  );
}

export function ArtifactStrip({
  artifacts,
  theme,
  isGenerating = false,
  isCompleted = false,
}: {
  artifacts: ChatArtifact[];
  theme: ProviderTheme;
  isGenerating?: boolean;
  isCompleted?: boolean;
}) {
  if (!artifacts.length) return null;
  const classes = buildArtifactClasses(theme.isDark);
  return (
    <div className="mb-2 space-y-1.5">
      {artifacts.map((artifact) => (
        <ArtifactCard
          key={artifact.id}
          artifact={artifact}
          theme={theme}
          isGenerating={isGenerating}
          isCompleted={isCompleted}
          cardClass={classes.card}
          summaryClass={classes.summary}
          metaClass={classes.meta}
          panelClass={classes.panel}
        />
      ))}
    </div>
  );
}

export function ArtifactCard({
  artifact,
  theme,
  isGenerating = false,
  isCompleted = false,
  cardClass,
  summaryClass,
  metaClass,
  panelClass,
}: {
  artifact: ChatArtifact;
  theme: ProviderTheme;
  isGenerating?: boolean;
  isCompleted?: boolean;
  cardClass: string;
  summaryClass: string;
  metaClass: string;
  panelClass: string;
}) {
  const isCode = artifact.source === "auto-code-bundle";
  const [isOpen, setIsOpen] = useState(isGenerating && isCode);
  const [isCopied, setIsCopied] = useState(false);
  const [isExpanded, setIsExpanded] = useState(isGenerating && isCode);
  const wasGeneratingRef = useRef(isGenerating);

  const lineCount =
    typeof artifact.lineCount === "number" && Number.isFinite(artifact.lineCount)
      ? Math.max(0, Math.round(artifact.lineCount))
      : artifact.content ? artifact.content.split(/\r?\n/).length : 0;
  const charCount =
    typeof artifact.charCount === "number" && Number.isFinite(artifact.charCount)
      ? Math.max(0, Math.round(artifact.charCount))
      : artifact.content.length;
  const displayTitle =
    isCode && artifact.language ? artifact.language.toLowerCase() : artifact.title.toLowerCase();
  const displayContent = isCode
    ? /```[\s\S]+```/.test(artifact.content)
      ? artifact.content
      : `\`\`\`${artifact.language || "text"}\n${artifact.content}\n\`\`\``
    : artifact.content;

  const copyButtonClass = theme.isDark
    ? "inline-flex h-6 items-center gap-1 rounded-md border border-[#5f584d] bg-[#2a2722] px-2 text-[11px] text-[#e9e3d8] hover:bg-[#3a342d]"
    : "inline-flex h-6 items-center gap-1 rounded-md border border-[#5f564b] bg-[#2f2b25] px-2 text-[11px] text-[#e9e3d8] hover:bg-[#3a342d]";
  const panelActionClass = theme.isDark
    ? "inline-flex h-6 items-center rounded-md border border-[#5f584d] bg-[#2a2722] px-2 text-[11px] text-[#d6cfc3] hover:bg-[#3a342d]"
    : "inline-flex h-6 items-center rounded-md border border-[#c9c7c0] bg-[#f5f3ec] px-2 text-[11px] text-[#5d584f] hover:bg-[#ece9e1]";

  useEffect(() => {
    if (!isCode) { wasGeneratingRef.current = isGenerating; return; }
    const was = wasGeneratingRef.current;
    if (isGenerating && !was) { setIsOpen(true); setIsExpanded(true); }
    else if (!isGenerating && was && isCompleted) { setIsExpanded(false); }
    wasGeneratingRef.current = isGenerating;
  }, [isGenerating, isCompleted, isCode]);

  async function handleCopy(event: MouseEvent<HTMLButtonElement>) {
    event.preventDefault();
    event.stopPropagation();
    if (!artifact.content.trim()) return;
    try {
      await navigator.clipboard.writeText(artifact.content);
      setIsCopied(true);
      window.setTimeout(() => setIsCopied(false), 1400);
    } catch { /* silent */ }
  }

  return (
    <details className={cardClass} onToggle={(e) => setIsOpen(e.currentTarget.open)}>
      <summary className={summaryClass}>
        <div className="min-w-0">
          <p className="truncate text-sm font-medium">{displayTitle}</p>
          <p className={"truncate text-[11px] " + metaClass}>
            {artifact.mimeType} • {formatBytes(artifact.sizeBytes)} •{" "}
            {lineCount.toLocaleString()} lines • {charCount.toLocaleString()} chars
          </p>
        </div>
        <div className="flex shrink-0 items-center gap-1.5">
          <button type="button" className={copyButtonClass} onClick={(e) => void handleCopy(e)}>
            {isCopied ? <CheckIcon className="h-3 w-3" /> : <CopyIcon className="h-3 w-3" />}
            <span>{isCopied ? "Copied" : "Copy"}</span>
          </button>
        </div>
      </summary>
      {isOpen ? (
        <div className={panelClass + (isExpanded ? "" : " max-h-[30rem] overflow-auto")}>
          {isCode ? (
            <div className="mb-2 flex justify-end">
              <button
                type="button"
                className={panelActionClass}
                onClick={(e) => { e.preventDefault(); e.stopPropagation(); setIsExpanded((v) => !v); }}
              >
                {isExpanded ? "Compact" : "Full"}
              </button>
            </div>
          ) : null}
          {isCode ? (
            <MessageContent content={displayContent} theme={theme} minimalCodeBlocks showCodeCopyButton={false} />
          ) : (
            <MessageContent content={displayContent} theme={theme} />
          )}
        </div>
      ) : null}
    </details>
  );
}
