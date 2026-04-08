"use client";

import type { ChatAttachment } from "../../lib/types";
import type { ProviderTheme } from "./providers";
import { CloseIcon, FileIcon } from "./ui-icons";

type ComposerAttachmentsProps = {
  theme: ProviderTheme;
  attachments: ChatAttachment[];
  disabled: boolean;
  onRemoveAttachment: (attachmentId: string) => void;
};

export function ComposerAttachments({
  theme,
  attachments,
  disabled,
  onRemoveAttachment,
}: ComposerAttachmentsProps) {
  if (!attachments.length) return null;

  const isDark = theme.isDark;
  const imageAttachments = attachments.filter(
    (attachment) => attachment.kind === "image" && attachment.mimeType.startsWith("image/")
  );
  const nonImageAttachments = attachments.filter(
    (attachment) => !(attachment.kind === "image" && attachment.mimeType.startsWith("image/"))
  );
  const dockShellClass = "mx-auto mb-2 w-full max-w-4xl";
  const dockClass = "w-fit max-w-full bg-transparent px-0 py-0";
  const attachmentChipClass = isDark
    ? "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#4a4841] bg-[#2a2926] px-2 py-1 text-xs text-[#d8d2c6]"
    : "inline-flex max-w-full items-center gap-1.5 rounded-full border border-[#d6d5d2] bg-[#f4f2eb] px-2 py-1 text-xs text-[#5c574f]";
  const attachmentNameClass = isDark ? "truncate text-[#ece7dd]" : "truncate text-[#403d37]";
  const attachmentMetaClass = isDark ? "truncate text-[#a59d90]" : "truncate text-[#7a7368]";
  const attachmentRemoveClass = isDark
    ? "inline-flex h-4 w-4 items-center justify-center rounded-full text-[#b7afa3] transition hover:bg-[#3a3833] hover:text-[#ece7dd]"
    : "inline-flex h-4 w-4 items-center justify-center rounded-full text-[#8a8378] transition hover:bg-[#e9e6df] hover:text-[#4e4a43]";
  const imageCardClass = isDark
    ? "relative h-28 w-40 overflow-hidden rounded-xl border border-[#4a4841] bg-[#1f1f1d]"
    : "relative h-28 w-40 overflow-hidden rounded-xl border border-[#d6d5d2] bg-[#fbfaf6]";
  const imageCaptionClass = isDark
    ? "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#171613f2] to-[#17161300] px-2 py-1 text-[11px] text-[#ece7dd]"
    : "pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-[#fbfaf6f2] to-[#fbfaf600] px-2 py-1 text-[11px] text-[#4a453d]";
  const imageRemoveClass = isDark
    ? "absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#4a4841] bg-[#1f1f1de6] text-[#c9c2b6] transition hover:bg-[#2d2b27]"
    : "absolute right-1 top-1 inline-flex h-5 w-5 items-center justify-center rounded-full border border-[#d6d5d2] bg-[#fbfaf6e6] text-[#6a655c] transition hover:bg-[#f1eee7]";

  return (
    <div className={dockShellClass}>
      <div className={dockClass}>
        {imageAttachments.length ? (
          <div className="mb-1.5 flex flex-wrap gap-1.5">
            {imageAttachments.map((attachment) => (
              <div key={attachment.id} className={imageCardClass}>
                <img
                  src={`/api/uploads/${encodeURIComponent(attachment.id)}`}
                  alt={attachment.name}
                  className="h-full w-full object-cover"
                  loading="lazy"
                />
                <div className={imageCaptionClass}>
                  <span className="block truncate">{attachment.name}</span>
                </div>
                <button
                  type="button"
                  className={imageRemoveClass}
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                  disabled={disabled}
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </div>
            ))}
          </div>
        ) : null}

        {nonImageAttachments.length ? (
          <div className="flex flex-wrap items-center gap-1.5">
            {nonImageAttachments.map((attachment) => (
              <span key={attachment.id} className={attachmentChipClass}>
                <FileIcon className="h-3.5 w-3.5 shrink-0" />
                <span className={attachmentNameClass}>{attachment.name}</span>
                <span className={attachmentMetaClass}>
                  {Math.max(1, Math.round(attachment.sizeBytes / 1024)).toLocaleString()} KB
                </span>
                <button
                  type="button"
                  className={attachmentRemoveClass}
                  onClick={() => onRemoveAttachment(attachment.id)}
                  aria-label={`Remove ${attachment.name}`}
                  disabled={disabled}
                >
                  <CloseIcon className="h-3 w-3" />
                </button>
              </span>
            ))}
          </div>
        ) : null}
      </div>
    </div>
  );
}
