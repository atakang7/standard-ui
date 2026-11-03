# Frontend State Contract

This document defines the state model the chat surface is expected to preserve. It is not an implementation wishlist.

## Terms

- `thread history`: the persisted messages owned by a saved chat thread.
- `request history`: the bounded message list sent to a provider for one request.
- `visible history`: the messages rendered in the active thread.
- `session key`: the provider-side conversation identity for a thread. For the built-in flow, it resolves to the thread id.
- `intentional shrink`: an edit, regenerate, or empty-placeholder cleanup that is allowed to shorten a message list.

Do not use `history` without qualifying which one you mean.

## Owners

| Area | Owner | Contract |
| --- | --- | --- |
| Thread list, selected thread, drafts, prompt artifacts | `hooks/use-chat-threads.ts` | Owns thread lifecycle and persistence scheduling. |
| Thread storage and shrink guards | `lib/thread-storage.ts` | Centralizes hydration, normalization, backup recovery, and safe persistence. |
| Streaming, abort, submit, regenerate, edit continuation | `hooks/use-chat-streaming.ts` | Builds the request window and patches only the active stream target. |
| Backend/model selection and capabilities | `hooks/use-provider-selection.ts` | Keeps provider availability separate from thread contents. |
| Generation settings and appearance preferences | `hooks/use-chat-preferences.ts` | Persists user preferences without writing thread messages. |
| Inline edit, copy state, virtual window, mobile panel state | component-local state | May affect presentation only. |

`app/page.tsx` composes these owners. It should not become a second persistence layer.

## Non-Negotiable Invariants

- Thread history must not be cleared by provider, model, settings, theme, sidebar, upload, or render-window state changes.
- Request windowing must happen after a full thread history has been selected; it must not mutate the saved thread.
- A message-list shrink must be explicit and scoped to the exact message-id sequence allowed by the edit/regenerate flow.
- Persistence must wait for storage hydration. Fallback/default threads must not overwrite stored conversations.
- A stream may append to the assistant placeholder it created, finalize metadata for that placeholder, or remove the placeholder when no chunks arrived.
- Regenerate and edit are the only normal user flows that may truncate visible history.
- A selected thread id must resolve to an existing thread after hydration and after deletion.
- UI components must not read or write thread storage keys.

## Request Lifecycle

1. Composer submits user input and attachments.
2. `useChatThreads` appends the user message and assistant placeholder to the selected thread.
3. `useChatStreaming` derives the bounded request history from the selected thread.
4. `/api/chat` normalizes provider-specific streaming into the app stream shape.
5. `useChatStreaming` patches only the assistant placeholder created for that request.
6. `useChatThreads` persists the resulting thread through the guarded storage path.

Any new feature that bypasses this path needs a reason in the PR.

## Change Rules

- State changes must name the owner they modify. If a change touches more than one owner, the PR must explain the boundary.
- History changes must state whether they affect thread history, request history, visible history, or session key behavior.
- Provider changes must stay behind capability flags and API adapters unless the UI behavior genuinely differs by provider.
- Component changes may introduce local UI state, but not persistence, provider routing, request bounding, or stream ownership.
- Storage changes must include the failure mode: hydration failure, malformed storage, stale backup, and unsafe shrink.
- Edit/regenerate changes must be tested against the case where the replacement stream fails before the first chunk.

## Review Gates

Before merging a state-related change, a reviewer should be able to answer:

- Which state owner changed?
- Can any unrelated state transition clear thread history?
- Is request windowing still separate from persistence?
- Which exact flow is allowed to shrink messages?
- What happens if a stream starts, fails, and produces no assistant content?
