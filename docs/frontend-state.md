# Frontend state

Thread history survives provider, model, settings, and layout changes; only edit or regenerate may intentionally truncate messages.

```text
+---------------------------+
| hooks/use-chat-threads.ts |
+---------------------------+
             |
          persists
             v
+---------------------------+
| lib/thread-storage.ts     |
+---------------------------+
             |
           writes
             v
+---------------------------+
| browser localStorage      |
+---------------------------+
```

## Terms

- **Thread history:** full saved message sequence.
- **Request history:** bounded messages sent to a backend.
- **Visible history:** messages rendered for the active thread.
- **Session key:** provider conversation identifier; built-in providers use the thread ID.

## Rules

- Hydrate before writing; fallback threads must not replace stored conversations.
- Bound requests without editing the stored message sequence.
- Scope edit and regenerate truncation to the selected message IDs.
- A stream updates only its assistant placeholder; remove it if no content arrives.
- Keep the selected thread ID valid after hydration or deletion.
- Components must not read or write thread storage keys.

## Verify

- Change provider, model, theme, and sidebar state; thread history stays intact.
- Abort or fail before the first chunk; earlier messages remain.
- Edit and regenerate; only the intended history tail changes.
