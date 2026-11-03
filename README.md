# standard-ui

standard-ui is a local chat interface for Ollama, OpenAI-compatible APIs, Anthropic, and user-configured gateways. It keeps conversation history in the browser while Next.js API routes handle model discovery and streaming across providers.

## Quick start

Requires Node.js 22 and npm. For the default backend, start Ollama on the host with at least one model installed.

```sh
git clone https://github.com/atakang7/standard-ui.git
cd standard-ui
npm ci
npm run dev
```

Open http://localhost:3000. Ollama is expected at http://localhost:11434 unless you set `OLLAMA_BASE_URL`.

For a local production build:

```sh
npm run build
npm run start
```

## Configuration

Copy the example file, then uncomment only the settings you need:

```sh
cp .env.example .env
```

| Backend | Settings |
| --- | --- |
| Ollama | Enabled by default; optional `OLLAMA_BASE_URL` |
| OpenAI-compatible | `OPENAI_ENABLED=true`, `OPENAI_BASE_URL`, `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_ENABLED=true`, `ANTHROPIC_API_KEY`; optional `ANTHROPIC_BASE_URL` |
| Custom gateway | Add an integration in Settings; its definition is saved to `.standard-ui/provider-plugins.json` |

Backend credentials and custom gateway headers are held by the server. Do not commit `.env` or `.standard-ui`.

## How it works

`/api/backends` lists configured providers. `/api/models` fetches model metadata; `/api/chat` maps the chat request to the selected provider and returns an NDJSON stream.

Thread history and UI preferences are stored in the browser. Uploaded files and custom provider definitions are saved under `.standard-ui` on the server. Switching providers does not rewrite saved conversations. See [frontend state](docs/frontend-state.md) for the storage rules and [engineering](docs/engineering.md) for the provider boundaries.

## Docker

```sh
docker compose up --build
```

The UI is published at http://127.0.0.1:3000, not on the network interface. Compose uses `http://host.docker.internal:11434` for a host Ollama server and the `standard_ui_data` volume for server-side files.

## Limitations

- No authentication or user separation. Keep the server on a trusted machine; do not publish it directly to the internet.
- Browser history is local to each browser profile. Clearing site data can remove it; there is no cross-device sync.
- Uploads are limited to 20 MB per file, 10 files per request, and 40 MB per request.
- Provider availability and supported model inputs depend on the configured endpoint.
- CI runs `npm ci` and `npm run build`. There is no automated test suite.

The repository is MIT licensed; see [LICENSE](LICENSE).
