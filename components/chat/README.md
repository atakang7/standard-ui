Part of [standard-ui](../../README.md)

# Chat components

React components render the thread list, messages, composer, settings, and Ollama terminal.

## Run

```sh
npm run dev
```

## Test

```sh
npm run build
```

## Config

These components receive state and callbacks from `app/page.tsx`; they read no server environment variables.

## Interfaces

| Component | Input or action |
| --- | --- |
| `chat-sidebar.tsx` | Thread selection and deletion |
| `chat-messages.tsx` | Visible messages and edits |
| `chat-composer.tsx` | Text, attachments, send and stop |
| `settings-view.tsx` | Model settings and provider configuration |
| `ollama-terminal.tsx` | Commands sent to `/api/ollama/cli` |
| `providers/` | Provider UI themes |

Thread persistence is owned by [hooks](../../hooks/README.md).
