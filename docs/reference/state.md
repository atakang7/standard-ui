# Chat state

| Term | Value |
| --- | --- |
| Thread history | Persisted messages in a saved thread |
| Request history | Bounded messages sent to a model for one request |
| Visible history | Messages rendered for the current thread |
| Session ID | Backend conversation identifier, derived from the thread ID in the built-in flow |

## Owners

| Source | State |
| --- | --- |
| `hooks/use-chat-threads.ts` | Thread list, selection, drafts, persistence schedule |
| `lib/thread-storage.ts` | Hydration, backup recovery, history guard |
| `hooks/use-chat-streaming.ts` | Active stream, abort, edit, regenerate |
| `hooks/use-provider-selection.ts` | Backend, model, capabilities |
| `hooks/use-chat-preferences.ts` | Generation settings and appearance |
| `components/chat/` | Render state and transient UI interactions |

## Persistence

- Thread storage is hydrated before writes begin.
- Request history is bounded after selecting a thread; the saved message list remains intact.
- An edit or regeneration may truncate messages at the affected point.
- A failed stream may remove its empty assistant placeholder.
- Provider selection, appearance, settings, and sidebar changes do not rewrite saved thread history.
- The storage guard checks message ID sequences before accepting a shorter saved history.
- If the active selection disappears, the selected ID is reconciled with an existing thread.

Browser storage names and request limits are declared in [`lib/constants.ts`](../../lib/constants.ts).
