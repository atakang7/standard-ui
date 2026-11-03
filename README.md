# standard-ui

A local Next.js chat UI for Ollama, Anthropic, OpenAI-compatible APIs, and custom gateways; conversations stay in browser storage.

```text
+----------------------------------+
| hooks/use-chat-streaming.ts      |
+----------------------------------+
                 |
              HTTP POST
                 v
+----------------------------------+
| app/api/chat/route.ts            |
+----------------------------------+
                 |
              messages
                 v
+----------------------------------+
| app/api/_lib/backends.ts         |
+----------------------------------+
                 |
            provider HTTP
                 v
+----------------------------------+
| Ollama / Anthropic / OpenAI API  |
+----------------------------------+
```

CI on pushes to `main` and pull requests:

```text
+------------+  push/PR  +--------------------------+  runs  +--------+  then  +---------------+
| GitHub ref | --------> | .github/workflows/ci.yml | -----> | npm ci | -----> | npm run build |
+------------+           +--------------------------+        +--------+        +---------------+
```

## Run

Node 22 is required; start Ollama with an installed model for the default backend.

```sh
git clone https://github.com/atakang7/standard-ui.git
cd standard-ui
npm ci
npm run dev
```

Open `http://localhost:3000`.

Production: `npm run build && npm run start`.

Docker: `docker compose up --build` (available at `http://127.0.0.1:3000`).

## Config

Copy `.env.example` to `.env` for non-default providers.

| Var | Default | What |
| --- | --- | --- |
| `OLLAMA_ENABLED` | `true` | Enable Ollama |
| `OLLAMA_BASE_URL` | `http://localhost:11434` (host); `http://host.docker.internal:11434` (Docker) | Ollama endpoint |
| `OPENAI_ENABLED` | unset | Enable compatible API; also enabled by URL or key |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | Compatible endpoint |
| `OPENAI_API_KEY` | unset | API token |
| `ANTHROPIC_ENABLED` | unset | Enable Anthropic; also enabled by API key |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com/v1` | Anthropic endpoint |
| `ANTHROPIC_API_KEY` | unset | API token |
| `MODEL_CAPABILITY_PROBE` | enabled | Set `false` to disable probing |

Custom gateways are configured in Settings and saved in `.standard-ui/provider-plugins.json`.

## Limits

- No authentication; do not expose the server to untrusted networks.
- Threads are browser-local; clearing site data can erase them.
- Uploads: 20 MB per file, 10 files and 40 MB per request.
- CI runs a build, not automated tests.
- Runtime files live in `.standard-ui`; do not commit this directory or `.env`.

State ownership: [frontend state](docs/frontend-state.md); code boundaries: [engineering](docs/engineering.md).
