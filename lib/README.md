Part of [standard-ui](../README.md)

# Shared library

Client-side utilities normalize chat data, build request windows, and guard persisted history.

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
| `standard_llm_threads_backup_v1` | none | Backup copy in `localStorage` |
| `standard_llm_debug_chat_payload_v1` | off | Optional browser request logging |

## Interfaces

| File | Contract |
| --- | --- |
| `thread-storage.ts` | Hydrate, guard, and persist threads |
| `stream-chat.ts` | Send requests and read NDJSON events |
| `storage.ts` | Normalize saved preferences and drafts |
| `types.ts` | Thread, message, attachment, setting types |
| `constants.ts` | Storage names and request limits |
| `utils.ts` | Normalization and request history bounds |

Saved history and request history have separate lifecycles in [state](../docs/reference/state.md).
