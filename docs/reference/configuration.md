# Configuration

The app reads these server environment variables. Copy `.env.example` to `.env` for non-default backends.

| Variable | Default | Use |
| --- | --- | --- |
| `OLLAMA_ENABLED` | `true` | Set `false` to hide Ollama |
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint in native runs |
| `OPENAI_ENABLED` | unset | Enable OpenAI-compatible backend when `true`, or when URL or credentials are set |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `OPENAI_API_KEY` | unset | Bearer token for OpenAI-compatible HTTP requests |
| `ANTHROPIC_ENABLED` | unset | Enable Anthropic when `true`, or when its API token is set |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com/v1` | Anthropic endpoint |
| `ANTHROPIC_API_KEY` | unset | Anthropic API token |
| `MODEL_CAPABILITY_PROBE` | `true` | Set `false` to skip active capability probes |
| `OPENAI_INCLUDE_USAGE` | conditional | Set `true` to request usage on OpenAI-compatible streams |
| `OPENAI_FILE_PURPOSE` | `user_data` | Purpose for uploaded files |
| `OPENAI_FILE_PURPOSE_VISION` | `vision` | Purpose for vision uploads |
| `ANTHROPIC_VERSION` | `2023-06-01` | Anthropic API version header |
| `ANTHROPIC_MAX_TOKENS` | `2048` | Fallback output token limit |
| `ANTHROPIC_FILES_BETA` | `files-api-2025-04-14` | Anthropic files beta header |

`OPENAI_INCLUDE_USAGE` is also enabled for the default OpenAI API hostname.

## Local files

| Path | Contents |
| --- | --- |
| `.env` | Local server environment variables |
| `.standard-ui/provider-plugins.json` | Custom gateways, headers, model source, and endpoint paths |
| `.standard-ui/uploads/` | Uploaded blobs and metadata |
| Browser `localStorage` | Threads, drafts, selected backend, model settings |

The Docker Compose service sets `OLLAMA_BASE_URL` to `http://host.docker.internal:11434` when the variable is unset and persists `.standard-ui` in `standard_ui_data`.

Custom provider defaults are `/models` for the model path and `/chat/stream` for chat. Model source is `remote` or `static`; stream format is `ndjson`, `sse-standard`, or `openai`.
