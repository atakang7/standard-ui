<p align="center">
  <a href="./docs/hero.svg">
    <img src="./docs/hero.svg" alt="standard-ui provider-agnostic chat workspace" width="1100">
  </a>
</p>

<h1 align="center">standard-ui</h1>

<p align="center">
  <strong>One interface for local and hosted model backends. Session-owned history. Local-first state.</strong>
</p>

<p align="center">
  Ollama · OpenAI-compatible APIs · Anthropic · custom gateways
</p>

<p align="center">
  <a href="https://github.com/atakang7/standard-ui/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/atakang7/standard-ui/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-1f6feb.svg"></a>
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-111111?logo=nextdotjs&logoColor=white">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
</p>

<p align="center">
  <a href="#start">Start</a> ·
  <a href="#configure">Configure</a> ·
  <a href="#contracts">Contracts</a> ·
  <a href="#docs">Docs</a>
</p>

`standard-ui` gives one interface to local and hosted model backends. It keeps provider differences at the API boundary and treats saved chat history as session data, not disposable component state.

## Start

One command:

```bash
npm run setup
```

Open `http://localhost:3000`.

Other starts:

| Need | Command |
| --- | --- |
| npm dev | `npm install && npm run dev` |
| Docker | `docker compose up --build` |
| Production | `npm install && npm run prod` |

## Configure

Copy the example only if you need hosted providers:

```bash
cp .env.example .env
```

Useful env vars:

| Backend | Minimum config |
| --- | --- |
| Ollama | none by default; set `OLLAMA_BASE_URL` only when needed |
| OpenAI-compatible | `OPENAI_ENABLED=true`, `OPENAI_BASE_URL`, `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_ENABLED=true`, `ANTHROPIC_API_KEY` |

Docker defaults Ollama to `http://host.docker.internal:11434` so a container can talk to a host Ollama process.

## Contracts

What matters:

- Saved chat history belongs to the thread/session.
- Request history can be windowed before it hits a backend.
- Provider differences stay behind `/api/backends`, `/api/models`, and `/api/chat`.
- Custom gateways live in `.standard-ui/provider-plugins.json`.
- Uploads and provider plugins live in `.standard-ui`; selected UI state lives in browser storage.

Supported backend shapes:

| Backend | Model list | Chat |
| --- | --- | --- |
| OpenAI-compatible | `GET /models` | `POST /chat/completions` |
| Anthropic | `GET /models` | `POST /messages` |
| Ollama | `GET /api/tags` | `POST /api/chat` |
| Custom gateway | `modelsPath` | `chatPath` |

Plugin contract source: [`app/api/_lib/provider-plugins.ts`](./app/api/_lib/provider-plugins.ts).

## Repo Map

- [`app/api/_lib/backends.ts`](./app/api/_lib/backends.ts): provider translation
- [`hooks/use-chat-threads.ts`](./hooks/use-chat-threads.ts): thread lifecycle
- [`hooks/use-chat-streaming.ts`](./hooks/use-chat-streaming.ts): request streaming
- [`lib/thread-storage.ts`](./lib/thread-storage.ts): local thread persistence guard
- [`components/chat`](./components/chat): chat surface
- [`docs/frontend-state.md`](./docs/frontend-state.md): frontend state refactor notes

## Docs

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`CHANGELOG.md`](./CHANGELOG.md)
- [`docs/engineering.md`](./docs/engineering.md)

## License

MIT. See [`LICENSE`](./LICENSE).
