import { NextResponse } from "next/server";
import {
  listAvailableBackends,
  parseBackendError,
  streamChatFromBackend,
} from "../_lib/backends";
import type { ChatSettings, InputAttachment } from "../_lib/backends";

type InputMessage = {
  role: "user" | "assistant";
  content: string;
  attachments?: InputAttachment[];
};

type RequestBody = {
  backend?: string;
  model?: string;
  sessionKey?: string;
  messages?: InputMessage[];
  settings?: ChatSettings;
};

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const REQUEST_MAX_MESSAGES = 80;
const REQUEST_MIN_PROMPT_BUDGET_TOKENS = 384;
const REQUEST_HARD_CHAR_LIMIT = 220_000;
const REQUEST_MAX_SINGLE_MESSAGE_CHARS = 24_000;
const REQUEST_MESSAGE_TOKEN_OVERHEAD = 8;

function estimateTokensFromText(text: string) {
  const normalized = text.trim();
  if (!normalized) return 0;
  return Math.max(1, Math.round(normalized.length / 4));
}

function clipToTail(text: string, maxChars: number) {
  if (maxChars <= 0) return "";
  if (text.length <= maxChars) return text;
  return text.slice(-maxChars);
}

function boundMessagesForRequest(messages: InputMessage[], settings?: ChatSettings) {
  const normalizedMessages = messages
    .map((message) => ({
      role: message.role,
      content: clipToTail(message.content.trim(), REQUEST_MAX_SINGLE_MESSAGE_CHARS),
      attachments: Array.isArray(message.attachments) ? message.attachments : [],
    }))
    .filter((message) => message.content.length > 0 || message.attachments.length > 0);

  if (!normalizedMessages.length) return [];

  const contextWindow = Math.max(256, Math.round(Number(settings?.contextWindow || 4096)));
  const maxTokens = Math.max(1, Math.round(Number(settings?.maxTokens || 1024)));
  const completionReserve = Math.max(256, Math.min(maxTokens, Math.floor(contextWindow * 0.45)));
  const promptTokenBudget = Math.max(
    REQUEST_MIN_PROMPT_BUDGET_TOKENS,
    contextWindow - completionReserve
  );

  const latestToOldest: InputMessage[] = [];
  let usedTokens = 0;

  for (let index = normalizedMessages.length - 1; index >= 0; index -= 1) {
    const message = normalizedMessages[index];
    const messageTokens =
      estimateTokensFromText(message.content) + REQUEST_MESSAGE_TOKEN_OVERHEAD;

    if (!latestToOldest.length) {
      const latestTokenBudget = Math.max(
        REQUEST_MIN_PROMPT_BUDGET_TOKENS,
        promptTokenBudget - REQUEST_MESSAGE_TOKEN_OVERHEAD
      );
      const latestContent = messageTokens > promptTokenBudget
        ? clipToTail(message.content, latestTokenBudget * 4)
        : message.content;
      if (!latestContent.trim() && message.attachments.length === 0) continue;

      latestToOldest.push({
        role: message.role,
        content: latestContent,
        attachments: message.attachments,
      });
      usedTokens +=
        estimateTokensFromText(latestContent) + REQUEST_MESSAGE_TOKEN_OVERHEAD;
      continue;
    }

    if (latestToOldest.length >= REQUEST_MAX_MESSAGES) break;
    if (usedTokens + messageTokens > promptTokenBudget) break;

    latestToOldest.push({
      role: message.role,
      content: message.content,
      attachments: message.attachments,
    });
    usedTokens += messageTokens;
  }

  const tokenBounded = latestToOldest.reverse();
  let remainingChars = REQUEST_HARD_CHAR_LIMIT;
  const charBoundedLatestToOldest: InputMessage[] = [];

  for (let index = tokenBounded.length - 1; index >= 0; index -= 1) {
    const message = tokenBounded[index];
    const isLatest = charBoundedLatestToOldest.length === 0;
    if (remainingChars <= 0) break;

    if (message.content.length <= remainingChars) {
      charBoundedLatestToOldest.push({
        role: message.role,
        content: message.content,
        attachments: message.attachments,
      });
      remainingChars -= message.content.length;
      continue;
    }

    if (!isLatest) break;

    const clippedLatest = clipToTail(message.content, remainingChars);
    if (!clippedLatest.trim() && (message.attachments?.length ?? 0) === 0) break;

    charBoundedLatestToOldest.push({
      role: message.role,
      content: clippedLatest,
      attachments: message.attachments,
    });
    remainingChars = 0;
  }

  return charBoundedLatestToOldest.reverse();
}

export async function POST(request: Request) {
  let body: RequestBody;

  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  const backend = body.backend?.trim() || "";
  const model = body.model?.trim() || "";
  const sessionKey = typeof body.sessionKey === "string" ? body.sessionKey.trim() : "";
  const messages = Array.isArray(body.messages)
    ? body.messages.filter(
        (message) =>
          message &&
          (message.role === "user" || message.role === "assistant") &&
          typeof message.content === "string"
      )
    : [];

  const normalizedMessages: InputMessage[] = messages
    .map((message) => ({
      role: message.role,
      content: message.content.trim(),
      attachments: Array.isArray(message.attachments)
        ? message.attachments
            .filter(
              (attachment): attachment is InputAttachment =>
                Boolean(attachment) &&
                typeof attachment.id === "string" &&
                typeof attachment.name === "string" &&
                typeof attachment.mimeType === "string" &&
                typeof attachment.sizeBytes === "number" &&
                (attachment.kind === "image" ||
                  attachment.kind === "document" ||
                  attachment.kind === "audio" ||
                  attachment.kind === "video" ||
                  attachment.kind === "text" ||
                  attachment.kind === "binary")
            )
            .map((attachment) => ({
              id: attachment.id.trim(),
              name: attachment.name.trim() || "attachment",
              mimeType: attachment.mimeType.trim().toLowerCase() || "application/octet-stream",
              sizeBytes: Math.max(0, Math.round(attachment.sizeBytes)),
              kind: attachment.kind,
              textPreview:
                typeof attachment.textPreview === "string" && attachment.textPreview.trim()
                  ? attachment.textPreview.slice(0, 6000)
                  : undefined,
            }))
            .filter((attachment) => attachment.id.length > 0)
        : [],
    }))
    .filter((message) => message.content.length > 0 || (message.attachments?.length ?? 0) > 0);

  if (!backend) {
    return NextResponse.json({ error: "Backend is required." }, { status: 400 });
  }

  if (!model) {
    return NextResponse.json({ error: "Model is required." }, { status: 400 });
  }

  if (!normalizedMessages.length) {
    return NextResponse.json({ error: "At least one message or attachment is required." }, { status: 400 });
  }

  const boundedMessages = boundMessagesForRequest(normalizedMessages, body.settings);
  if (!boundedMessages.length) {
    return NextResponse.json(
      { error: "Conversation context is empty after applying limits." },
      { status: 400 }
    );
  }

  const availableBackends = listAvailableBackends();
  if (!availableBackends.some((item) => item.id === backend)) {
    return NextResponse.json(
      { error: `Backend "${backend}" is not configured.` },
      { status: 400 }
    );
  }

  try {
    const stream = await streamChatFromBackend({
      backendId: backend,
      model,
      sessionKey,
      messages: boundedMessages,
      settings: body.settings,
      signal: request.signal,
    });

    return new Response(stream, {
      status: 200,
      headers: {
        "Content-Type": "application/x-ndjson; charset=utf-8",
        "Cache-Control": "no-cache, no-transform",
        Connection: "keep-alive",
      },
    });
  } catch (error) {
    const parsed = parseBackendError(error);
    console.error("[/api/chat] backend failure", {
      backend,
      model,
      sessionKey: sessionKey || null,
      status: parsed.status,
      error: parsed.error,
      details: parsed.details,
    });
    return NextResponse.json(
      {
        error: parsed.error,
        details: parsed.details,
      },
      { status: parsed.status }
    );
  }
}
