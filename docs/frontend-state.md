# Frontend State Plan

This document is intentionally practical. The goal is not to do a clever rewrite. The goal is to make the chat flow reliable, make state ownership obvious, and make future bugs easier to isolate.

## Current Problems

- `app/page.tsx` owns too many responsibilities: thread state, persistence, provider/model loading, streaming, drafts, uploads, settings, keyboard shortcuts, mobile sidebar state, and boot behavior all live in one component.
- State is split across many `useState` calls and refs. Some refs mirror state for async callbacks, which makes it hard to know which value is authoritative.
- Chat history has more than one meaning: saved thread history, request payload history, visible message window, regenerate/edit history, and provider session key. These should not share loose names.
- Persistence is side-effect driven. Thread writes happen from effects, while thread edits happen from event handlers and streaming callbacks. That makes accidental overwrites possible if hydration, fallback state, or streaming timing changes.
- Streaming mutates thread messages from an async function outside the component. This is workable, but the mutation contract is implicit.
- Normalization and bounding logic is duplicated between the client and server. Some duplication is acceptable for safety, but the intended source of truth should be obvious.
- Components are not cleanly split between presentational UI and state orchestration. Several components receive broad props and know too much about app behavior.
- Theme data is large string-based configuration. That is fine for now, but it should stay isolated from business state and not leak into state orchestration.

## Target Shape

Keep the app local-first and React-native. Do not add Redux, Zustand, XState, or a backend database just to feel organized. First make ownership explicit.

State owners should be:

- `useChatThreads`: owns `threads`, `selectedThreadId`, drafts by thread, prompt artifacts by thread, session keys by thread, and thread persistence.
- `useChatStreaming`: owns active stream state, abort controller, request submission, response patching, stop, regenerate, and edit continuation.
- `useProviderSelection`: owns backend list, selected backend, model list, selected model, and model capabilities refresh.
- `useChatPreferences`: owns appearance mode, generation settings by backend, stream readability pace, and local preference persistence.
- Component-local state: owns purely visual state such as sidebar collapse, mobile sidebar open, copied message id, inline edit draft, render window size, and metrics visibility.

`app/page.tsx` should eventually become orchestration glue: compose hooks, derive `activeThread`, and pass narrow props to components.

## Required Invariants

- Never persist thread state before storage hydration has completed.
- Never replace a stored conversation with fallback state unless the user explicitly deleted all chats.
- Saved thread history and request payload history are different things. Saved history should remain complete; request history can be bounded.
- A stream may only append to the assistant message it created, finalize its metrics, or remove that assistant placeholder when no chunks arrived.
- Regenerate and edit are the only normal flows that intentionally truncate visible thread history.
- A selected thread id must always point to an existing thread after hydration.
- Storage writes should be centralized. Components should not write thread data directly to `localStorage`.
- Components should receive actions like `onSubmitMessage` or `onDeleteThread`, not storage keys or persistence details.

## Refactor Order

1. Move pure thread storage helpers out of `app/page.tsx`.
   Keep behavior unchanged. Move parsing, normalization, backup reads, and message counting into `lib/thread-storage.ts` with small tests or at least simple fixtures.

2. Introduce `useChatThreads`.
   Move thread list state, selected thread id, draft maps, prompt artifact maps, session keys, `patchThread`, `createThread`, delete, rename, and thread persistence into one hook.

3. Introduce a small reducer for thread mutations.
   Use explicit actions such as `hydrate`, `createThread`, `appendUserAndAssistantPlaceholder`, `patchAssistantMessage`, `deleteThread`, `renameThread`, `truncateForRegenerate`, and `truncateForEdit`.

4. Move streaming orchestration into `useChatStreaming`.
   Keep `streamAssistantResponse` as the lower-level stream consumer, but make the hook responsible for preparing request messages, owning abort state, and dispatching thread actions.

5. Move provider/model loading into `useProviderSelection`.
   Keep backend API contracts unchanged. The hook should expose `backends`, `models`, selected ids, readiness flags, refresh methods, and errors.

6. Split app-level and component-local state.
   `ChatComposer`, `ChatMessages`, `ChatSidebar`, and `SettingsView` should stay mostly presentational. Their local state should only cover UI behavior inside that component.

7. Add focused regression tests around pure logic.
   Start with thread storage hydration, request message bounding, regenerate/edit truncation, and stream patching. Do not block the cleanup on a large test framework redesign.

## What Not To Do Yet

- Do not rewrite the app into a new state library.
- Do not move local thread history to a backend service.
- Do not merge all state into one giant reducer in `app/page.tsx`.
- Do not refactor theme strings and chat state at the same time.
- Do not change the provider API while cleaning up frontend state.

## Definition Of Done

This cleanup is working when a developer can answer these questions quickly:

- Where does saved chat history live?
- What code decides what request history is sent to the model?
- Which flows intentionally truncate thread messages?
- What code owns active streaming and cancellation?
- What code persists thread state?
- Which component owns a given piece of UI-only state?

If those answers are obvious, the app is much less likely to flush history or lose state in the middle of a conversation.
