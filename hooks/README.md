Part of [standard-ui](../README.md)

# Hooks

React hooks own thread lifecycle, provider selection, streaming, and local preferences.

## Run

```sh
npm run dev
```

## Test

```sh
npm run build
```

## Config

| Variable | Default | What |
| --- | --- | --- |
| `standard_llm_selected_backend_v1` | none | Selected backend in `localStorage` |
| `standard_llm_threads_v1` | none | Saved threads in `localStorage` |

The storage identifiers are declared in [`lib/constants.ts`](../lib/constants.ts).

## Interfaces

| Hook | Owns |
| --- | --- |
| `use-chat-threads.ts` | Thread selection, drafts, persistence scheduling |
| `use-chat-streaming.ts` | Submit, abort, edit, regenerate |
| `use-provider-selection.ts` | Backend and model availability |
| `use-chat-preferences.ts` | Settings and appearance preferences |
| `use-provider-integrations.ts` | Custom provider management |

See the [state reference](../docs/reference/state.md) for the persistence rules.
