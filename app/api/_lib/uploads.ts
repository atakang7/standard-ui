import { randomUUID } from "crypto";
import { promises as fs } from "fs";
import path from "path";
import { unzipSync } from "fflate";
import type { AttachmentKind, ChatAttachment } from "../../../lib/types";

const UPLOADS_ROOT = path.join(process.cwd(), ".standard-ui", "uploads");
const MAX_SINGLE_ATTACHMENT_BYTES = 20 * 1024 * 1024;
const MAX_TEXT_PREVIEW_BYTES = 128 * 1024;
const MAX_TEXT_PREVIEW_CHARS = 6000;
const MAX_BINARY_STRINGS_LINES = 160;
const MAX_BINARY_STRING_CHARS_PER_LINE = 180;
const MIN_BINARY_STRING_RUN_LENGTH = 6;
const MAX_ARCHIVE_LISTED_ENTRIES = 120;
const MAX_ARCHIVE_SNIPPETS = 4;
const MAX_ARCHIVE_SNIPPET_CHARS = 1200;

type StoredAttachmentMeta = ChatAttachment & {
  fileName: string;
  createdAt: number;
  providerFiles?: Record<
    string,
    {
      fileId: string;
      createdAt: number;
      purpose?: string;
    }
  >;
};

export type StoredProviderFileRef = {
  fileId: string;
  createdAt: number;
  purpose?: string;
};

const TEXT_LIKE_MIME_PREFIXES = ["text/"];
const TEXT_LIKE_MIME_TYPES = new Set([
  "application/json",
  "application/ld+json",
  "application/x-ndjson",
  "application/xml",
  "application/javascript",
  "application/x-javascript",
  "application/typescript",
  "application/x-typescript",
  "application/graphql",
  "application/toml",
  "application/x-yaml",
  "application/yaml",
  "application/x-sh",
  "application/sql",
  "application/x-httpd-php",
]);

const MIME_BY_EXTENSION: Record<string, string> = {
  ".pdf": "application/pdf",
  ".json": "application/json",
  ".jsonl": "application/json",
  ".md": "text/markdown",
  ".mdx": "text/markdown",
  ".txt": "text/plain",
  ".csv": "text/csv",
  ".tsv": "text/tab-separated-values",
  ".html": "text/html",
  ".htm": "text/html",
  ".css": "text/css",
  ".xml": "application/xml",
  ".yaml": "application/yaml",
  ".yml": "application/yaml",
  ".py": "text/x-python",
  ".ts": "application/typescript",
  ".tsx": "text/tsx",
  ".mts": "application/typescript",
  ".cts": "application/typescript",
  ".js": "application/javascript",
  ".mjs": "application/javascript",
  ".cjs": "application/javascript",
  ".jsx": "text/jsx",
  ".java": "text/x-java-source",
  ".kt": "text/x-kotlin",
  ".kts": "text/x-kotlin",
  ".go": "text/x-go",
  ".rs": "text/x-rustsrc",
  ".rb": "text/x-ruby",
  ".php": "application/x-httpd-php",
  ".swift": "text/x-swift",
  ".scala": "text/x-scala",
  ".r": "text/x-rsrc",
  ".c": "text/x-c",
  ".h": "text/x-c",
  ".cpp": "text/x-c++src",
  ".cc": "text/x-c++src",
  ".cxx": "text/x-c++src",
  ".hpp": "text/x-c++src",
  ".hh": "text/x-c++src",
  ".cs": "text/x-csharp",
  ".sql": "application/sql",
  ".sh": "application/x-sh",
  ".bash": "application/x-sh",
  ".zsh": "application/x-sh",
  ".fish": "application/x-sh",
  ".ps1": "text/plain",
  ".bat": "text/plain",
  ".cmd": "text/plain",
  ".dockerfile": "text/plain",
  ".toml": "application/toml",
  ".ini": "text/plain",
  ".cfg": "text/plain",
  ".conf": "text/plain",
  ".env": "text/plain",
  ".properties": "text/plain",
  ".gradle": "text/plain",
  ".gitignore": "text/plain",
  ".gitattributes": "text/plain",
  ".npmrc": "text/plain",
  ".yarnrc": "text/plain",
  ".editorconfig": "text/plain",
  ".log": "text/plain",
  ".srt": "text/plain",
  ".vtt": "text/vtt",
  ".vue": "text/plain",
  ".svelte": "text/plain",
  ".astro": "text/plain",
  ".graphql": "application/graphql",
  ".gql": "application/graphql",
  ".proto": "text/plain",
};

const TEXT_LIKE_EXTENSIONS = new Set(
  Object.entries(MIME_BY_EXTENSION)
    .filter(([, mimeType]) => TEXT_LIKE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix)) || TEXT_LIKE_MIME_TYPES.has(mimeType))
    .map(([extension]) => extension)
);

const TEXT_LIKE_BASENAMES = new Set([
  "dockerfile",
  "makefile",
  ".env",
  ".gitignore",
  ".gitattributes",
  ".npmrc",
  ".yarnrc",
  ".editorconfig",
]);

const DOCUMENT_MIME_PREFIXES = [
  "application/pdf",
  "application/msword",
  "application/vnd.openxmlformats-officedocument",
  "application/vnd.ms-",
];

const ARCHIVE_MIME_TYPES = new Set([
  "application/java-archive",
  "application/x-java-archive",
  "application/jar",
  "application/zip",
  "application/x-zip-compressed",
  "application/vnd.android.package-archive",
]);

const ARCHIVE_EXTENSIONS = new Set([".jar", ".zip", ".war", ".ear", ".apk"]);

let pdfParseLoader: Promise<(input: Buffer) => Promise<{ text?: string }>> | null = null;

function normalizeName(name: string) {
  const trimmed = name.trim().replace(/\0/g, "");
  if (!trimmed) return "attachment";
  return trimmed.slice(0, 180);
}

function normalizeMimeType(mimeType: string, name: string) {
  const normalized = mimeType.trim().toLowerCase();
  const shouldInferFromName =
    normalized === "" ||
    normalized === "application/octet-stream" ||
    normalized === "binary/octet-stream";

  const extension = path.extname(name).toLowerCase();
  if (shouldInferFromName && extension && MIME_BY_EXTENSION[extension]) {
    return MIME_BY_EXTENSION[extension];
  }

  const basename = path.basename(name).toLowerCase();
  if (shouldInferFromName && TEXT_LIKE_BASENAMES.has(basename)) {
    return "text/plain";
  }

  if (normalized) return normalized;
  return "application/octet-stream";
}

function inferAttachmentKind(mimeType: string): AttachmentKind {
  if (mimeType.startsWith("image/")) return "image";
  if (mimeType.startsWith("audio/")) return "audio";
  if (mimeType.startsWith("video/")) return "video";
  if (TEXT_LIKE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return "text";
  if (TEXT_LIKE_MIME_TYPES.has(mimeType)) return "text";
  if (DOCUMENT_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return "document";
  return "binary";
}

function isLikelyTextMimeType(mimeType: string) {
  if (TEXT_LIKE_MIME_PREFIXES.some((prefix) => mimeType.startsWith(prefix))) return true;
  if (TEXT_LIKE_MIME_TYPES.has(mimeType)) return true;
  return false;
}

function isLikelyUtf8Text(buffer: Buffer) {
  const sample = buffer.subarray(0, MAX_TEXT_PREVIEW_BYTES);
  if (!sample.length) return false;

  let controlBytes = 0;
  for (let index = 0; index < sample.length; index += 1) {
    const byte = sample[index];
    if (byte === 0x00) {
      return false;
    }

    const isCommonWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d || byte === 0x0c;
    const isPrintableAscii = byte >= 0x20 && byte <= 0x7e;
    const isUtf8Byte = byte >= 0x80;

    if (isCommonWhitespace || isPrintableAscii || isUtf8Byte) continue;
    controlBytes += 1;
  }

  if (controlBytes / sample.length > 0.06) {
    return false;
  }

  const decoded = sample.toString("utf8");
  if (!decoded.trim()) return false;
  const replacementCount = (decoded.match(/\uFFFD/g) ?? []).length;
  return replacementCount <= Math.max(2, Math.floor(decoded.length * 0.01));
}

function canExtractTextPreview(kind: AttachmentKind, mimeType: string, name: string, data: Buffer) {
  if (kind === "image" || kind === "audio" || kind === "video") return false;
  if (kind === "text" || isLikelyTextMimeType(mimeType)) return true;
  if (mimeType === "application/pdf") return false;

  const extension = path.extname(name).toLowerCase();
  if (extension && TEXT_LIKE_EXTENSIONS.has(extension)) return true;

  const basename = path.basename(name).toLowerCase();
  if (TEXT_LIKE_BASENAMES.has(basename)) return true;

  return isLikelyUtf8Text(data);
}

function createBinaryStringsPreview(buffer: Buffer) {
  const sample = buffer.subarray(0, MAX_TEXT_PREVIEW_BYTES);
  if (!sample.length) return undefined;

  const strings: string[] = [];
  let current = "";

  const flushCurrent = () => {
    if (current.length >= MIN_BINARY_STRING_RUN_LENGTH) {
      strings.push(
        current.length > MAX_BINARY_STRING_CHARS_PER_LINE
          ? `${current.slice(0, MAX_BINARY_STRING_CHARS_PER_LINE)}…`
          : current
      );
    }
    current = "";
  };

  for (let index = 0; index < sample.length; index += 1) {
    const byte = sample[index];
    const isPrintableAscii = byte >= 0x20 && byte <= 0x7e;
    const isWhitespace = byte === 0x09 || byte === 0x0a || byte === 0x0d;

    if (isPrintableAscii || isWhitespace) {
      current += String.fromCharCode(byte);
      continue;
    }

    flushCurrent();
    if (strings.length >= MAX_BINARY_STRINGS_LINES) break;
  }
  flushCurrent();

  const normalized = strings
    .map((line) => line.replace(/\s+/g, " ").trim())
    .filter(Boolean);

  if (!normalized.length) return undefined;
  const joined = normalized.join("\n");
  return joined.length > MAX_TEXT_PREVIEW_CHARS ? `${joined.slice(0, MAX_TEXT_PREVIEW_CHARS)}…` : joined;
}

function isArchiveAttachment(name: string, mimeType: string) {
  const extension = path.extname(name).toLowerCase();
  if (ARCHIVE_EXTENSIONS.has(extension)) return true;
  return ARCHIVE_MIME_TYPES.has(mimeType);
}

function createArchivePreview(buffer: Buffer, name: string, mimeType: string) {
  if (!isArchiveAttachment(name, mimeType)) return undefined;

  try {
    const entries = unzipSync(new Uint8Array(buffer));
    const names = Object.keys(entries).filter((entryName) => entryName && !entryName.endsWith("/"));
    if (!names.length) return undefined;

    const listLines = names.slice(0, MAX_ARCHIVE_LISTED_ENTRIES);
    const hiddenCount = Math.max(0, names.length - listLines.length);

    const snippets: string[] = [];
    const preferredEntries = names.filter((entryName) => {
      const ext = path.extname(entryName).toLowerCase();
      const base = path.basename(entryName).toLowerCase();
      if (TEXT_LIKE_EXTENSIONS.has(ext)) return true;
      if (TEXT_LIKE_BASENAMES.has(base)) return true;
      return entryName.toUpperCase() === "META-INF/MANIFEST.MF";
    });

    for (const entryName of preferredEntries) {
      if (snippets.length >= MAX_ARCHIVE_SNIPPETS) break;
      const raw = entries[entryName];
      if (!raw || !raw.length) continue;
      const candidate = Buffer.from(raw);
      if (!isLikelyUtf8Text(candidate)) continue;

      const text = candidate.toString("utf8").replace(/\r\n/g, "\n").replace(/\0/g, "").trim();
      if (!text) continue;

      const clipped = text.length > MAX_ARCHIVE_SNIPPET_CHARS ? `${text.slice(0, MAX_ARCHIVE_SNIPPET_CHARS)}…` : text;
      snippets.push(`--- ${entryName} ---\n${clipped}`);
    }

    const header = `Archive file detected (${name}).`;
    const listSection = `Entries:\n${listLines.join("\n")}${hiddenCount > 0 ? `\n... and ${hiddenCount} more` : ""}`;
    const snippetSection = snippets.length ? `\n\nExtracted text snippets:\n${snippets.join("\n\n")}` : "";
    const combined = `${header}\n\n${listSection}${snippetSection}`;
    return combined.length > MAX_TEXT_PREVIEW_CHARS
      ? `${combined.slice(0, MAX_TEXT_PREVIEW_CHARS)}…`
      : combined;
  } catch {
    return undefined;
  }
}

function createAttachmentPreview(kind: AttachmentKind, mimeType: string, name: string, data: Buffer) {
  if (canExtractTextPreview(kind, mimeType, name, data)) {
    return createTextPreview(data);
  }

  const archivePreview = createArchivePreview(data, name, mimeType);
  if (archivePreview) {
    return archivePreview;
  }

  if (kind === "binary") {
    return createBinaryStringsPreview(data);
  }

  return undefined;
}

function normalizeExtractedPreviewText(text: string | undefined) {
  const normalized = typeof text === "string" ? text.replace(/\r\n/g, "\n").replace(/\0/g, "").trim() : "";
  if (!normalized) return undefined;
  return normalized.length > MAX_TEXT_PREVIEW_CHARS
    ? `${normalized.slice(0, MAX_TEXT_PREVIEW_CHARS)}…`
    : normalized;
}

async function loadPdfParse() {
  if (!pdfParseLoader) {
    pdfParseLoader = import("pdf-parse").then((module) => {
      const resolved = (module as { default?: unknown }).default ?? module;
      if (typeof resolved !== "function") {
        throw new Error("PDF parser module is unavailable.");
      }
      return resolved as (input: Buffer) => Promise<{ text?: string }>;
    });
  }
  return pdfParseLoader;
}

async function extractPdfTextPreview(data: Buffer) {
  if (!data.length) return undefined;
  try {
    const parsePdf = await loadPdfParse();
    const parsed = await parsePdf(data);
    return normalizeExtractedPreviewText(parsed?.text);
  } catch {
    return undefined;
  }
}

async function createAttachmentPreviewAsync(
  kind: AttachmentKind,
  mimeType: string,
  name: string,
  data: Buffer
) {
  if (mimeType === "application/pdf") {
    const pdfPreview = await extractPdfTextPreview(data);
    if (pdfPreview) return pdfPreview;
  }
  return createAttachmentPreview(kind, mimeType, name, data);
}

function createTextPreview(buffer: Buffer) {
  const sample = buffer.subarray(0, MAX_TEXT_PREVIEW_BYTES);
  const decoded = sample.toString("utf8").replace(/\r\n/g, "\n");
  const normalized = decoded.replace(/\0/g, "").trim();
  if (!normalized) return undefined;
  return normalized.length > MAX_TEXT_PREVIEW_CHARS
    ? `${normalized.slice(0, MAX_TEXT_PREVIEW_CHARS)}…`
    : normalized;
}

function buildMetaPath(id: string) {
  return path.join(UPLOADS_ROOT, `${id}.json`);
}

function buildBlobPath(fileName: string) {
  return path.join(UPLOADS_ROOT, fileName);
}

function asPublicAttachment(meta: StoredAttachmentMeta): ChatAttachment {
  return {
    id: meta.id,
    name: meta.name,
    mimeType: meta.mimeType,
    sizeBytes: meta.sizeBytes,
    kind: meta.kind,
    textPreview: meta.textPreview,
  };
}

function normalizeProviderFileRef(candidate: unknown): StoredProviderFileRef | null {
  if (!candidate || typeof candidate !== "object") return null;
  const raw = candidate as Record<string, unknown>;
  const fileId = typeof raw.fileId === "string" ? raw.fileId.trim() : "";
  if (!fileId) return null;

  const createdAt =
    typeof raw.createdAt === "number" && Number.isFinite(raw.createdAt)
      ? Math.max(0, Math.round(raw.createdAt))
      : Date.now();
  const purpose = typeof raw.purpose === "string" && raw.purpose.trim() ? raw.purpose.trim() : undefined;

  return {
    fileId,
    createdAt,
    purpose,
  };
}

function normalizeProviderFilesMap(candidate: unknown) {
  if (!candidate || typeof candidate !== "object" || Array.isArray(candidate)) return undefined;
  const byBackend = candidate as Record<string, unknown>;
  const normalized = Object.entries(byBackend).reduce<Record<string, StoredProviderFileRef>>(
    (acc, [backendId, value]) => {
      if (typeof backendId !== "string" || !backendId.trim()) return acc;
      const ref = normalizeProviderFileRef(value);
      if (!ref) return acc;
      acc[backendId.trim()] = ref;
      return acc;
    },
    {}
  );
  return Object.keys(normalized).length ? normalized : undefined;
}

export function isValidAttachmentId(id: string) {
  return /^[a-f0-9-]{20,}$/i.test(id);
}

async function ensureUploadsRoot() {
  await fs.mkdir(UPLOADS_ROOT, { recursive: true });
}

export async function storeUpload(file: File): Promise<ChatAttachment> {
  const name = normalizeName(file.name || "attachment");
  const mimeType = normalizeMimeType(file.type || "", name);

  if (file.size <= 0) {
    throw new Error(`"${name}" is empty.`);
  }
  if (file.size > MAX_SINGLE_ATTACHMENT_BYTES) {
    throw new Error(`"${name}" exceeds ${Math.round(MAX_SINGLE_ATTACHMENT_BYTES / (1024 * 1024))} MB.`);
  }

  const id = randomUUID();
  const extension = path.extname(name).toLowerCase().slice(0, 12);
  const storedFileName = extension ? `${id}${extension}.bin` : `${id}.bin`;
  const blobPath = buildBlobPath(storedFileName);
  const metaPath = buildMetaPath(id);
  const kind = inferAttachmentKind(mimeType);

  const arrayBuffer = await file.arrayBuffer();
  const data = Buffer.from(arrayBuffer);

  if (data.length > MAX_SINGLE_ATTACHMENT_BYTES) {
    throw new Error(`"${name}" exceeds ${Math.round(MAX_SINGLE_ATTACHMENT_BYTES / (1024 * 1024))} MB.`);
  }

  const textPreview = await createAttachmentPreviewAsync(kind, mimeType, name, data);

  const meta: StoredAttachmentMeta = {
    id,
    name,
    mimeType,
    sizeBytes: data.length,
    kind,
    textPreview,
    fileName: storedFileName,
    createdAt: Date.now(),
  };

  await ensureUploadsRoot();
  await fs.writeFile(blobPath, data);
  await fs.writeFile(metaPath, JSON.stringify(meta));

  return asPublicAttachment(meta);
}

export async function readStoredAttachmentMeta(id: string): Promise<StoredAttachmentMeta | null> {
  if (!isValidAttachmentId(id)) return null;
  const metaPath = buildMetaPath(id);
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    const parsed = JSON.parse(raw) as StoredAttachmentMeta;
    if (!parsed || parsed.id !== id || !parsed.fileName) return null;

    const normalizedName = normalizeName(typeof parsed.name === "string" ? parsed.name : "attachment");
    const normalizedMimeType = normalizeMimeType(
      typeof parsed.mimeType === "string" ? parsed.mimeType : "",
      normalizedName
    );
    const normalizedKind = inferAttachmentKind(normalizedMimeType);

    const normalizedMeta: StoredAttachmentMeta = {
      ...parsed,
      name: normalizedName,
      mimeType: normalizedMimeType,
      kind: normalizedKind,
      providerFiles: normalizeProviderFilesMap(parsed.providerFiles),
    };

    const shouldPersistNormalizedMeta =
      normalizedMeta.name !== parsed.name ||
      normalizedMeta.mimeType !== parsed.mimeType ||
      normalizedMeta.kind !== parsed.kind ||
      JSON.stringify(normalizedMeta.providerFiles ?? {}) !== JSON.stringify(parsed.providerFiles ?? {});

    if (shouldPersistNormalizedMeta) {
      await fs.writeFile(metaPath, JSON.stringify(normalizedMeta));
    }

    return normalizedMeta;
  } catch {
    return null;
  }
}

export async function readStoredAttachment(id: string): Promise<{ meta: ChatAttachment; buffer: Buffer } | null> {
  let meta = await readStoredAttachmentMeta(id);
  if (!meta) return null;

  try {
    const buffer = await fs.readFile(buildBlobPath(meta.fileName));

    if (!meta.textPreview?.trim()) {
      const textPreview = await createAttachmentPreviewAsync(meta.kind, meta.mimeType, meta.name, buffer);
      if (textPreview) {
        meta = {
          ...meta,
          textPreview,
        };
        await fs.writeFile(buildMetaPath(id), JSON.stringify(meta));
      }
    }

    return {
      meta: asPublicAttachment(meta),
      buffer,
    };
  } catch {
    return null;
  }
}

export async function readStoredAttachmentForDownload(id: string): Promise<{
  meta: ChatAttachment;
  fileName: string;
  buffer: Buffer;
} | null> {
  const meta = await readStoredAttachmentMeta(id);
  if (!meta) return null;

  try {
    const buffer = await fs.readFile(buildBlobPath(meta.fileName));
    return {
      meta: asPublicAttachment(meta),
      fileName: meta.name,
      buffer,
    };
  } catch {
    return null;
  }
}

export function getMaxSingleAttachmentBytes() {
  return MAX_SINGLE_ATTACHMENT_BYTES;
}

export async function readStoredAttachmentProviderFile(
  id: string,
  backendId: string
): Promise<StoredProviderFileRef | null> {
  const normalizedBackend = backendId.trim();
  if (!normalizedBackend) return null;

  const meta = await readStoredAttachmentMeta(id);
  if (!meta?.providerFiles) return null;

  const ref = meta.providerFiles[normalizedBackend];
  return normalizeProviderFileRef(ref);
}

export async function upsertStoredAttachmentProviderFile(
  id: string,
  backendId: string,
  ref: StoredProviderFileRef
) {
  const normalizedBackend = backendId.trim();
  if (!normalizedBackend || !isValidAttachmentId(id)) return;

  const normalizedRef = normalizeProviderFileRef(ref);
  if (!normalizedRef) return;

  const meta = await readStoredAttachmentMeta(id);
  if (!meta) return;

  const nextMeta: StoredAttachmentMeta = {
    ...meta,
    providerFiles: {
      ...(meta.providerFiles ?? {}),
      [normalizedBackend]: normalizedRef,
    },
  };

  await fs.writeFile(buildMetaPath(id), JSON.stringify(nextMeta));
}
