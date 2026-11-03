<p align="center">
  <a href="./docs/hero.svg">
    <img src="./docs/hero.svg" alt="standard-ui provider-agnostic chat workspace" width="1100">
  </a>
</p>

<h1 align="center">standard-ui</h1>

<p align="center">
  <strong>Provider adapters at the edge. Session-owned history in the client. Local runtime state by default.</strong>
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
  <a href="#runtime">Runtime</a> ·
  <a href="#configuration">Configuration</a> ·
  <a href="#project-contracts">Contracts</a> ·
  <a href="#docs">Docs</a>
</p>

`standard-ui` is a provider-agnostic chat workspace for local and hosted model backends. Its core contract is narrow: keep provider differences at the API boundary, preserve saved thread history, and avoid turning local runtime state into a managed platform.

## Runtime

Development:

```bash
npm run setup
```

Open `http://localhost:3000`.

| Need | Command |
| --- | --- |
| npm dev | `npm install && npm run dev` |
| Docker | `docker compose up --build` |
| Production | `npm install && npm run prod` |

## Configuration

Use `.env` only for non-default backends:

```bash
cp .env.example .env
```

| Backend | Minimum config |
| --- | --- |
| Ollama | none by default; set `OLLAMA_BASE_URL` only when needed |
| OpenAI-compatible | `OPENAI_ENABLED=true`, `OPENAI_BASE_URL`, `OPENAI_API_KEY` |
| Anthropic | `ANTHROPIC_ENABLED=true`, `ANTHROPIC_API_KEY` |

Docker defaults Ollama to `http://host.docker.internal:11434` so a container can talk to a host Ollama process.

## Project Contracts

- Thread history is persisted session data; request history is derived and may be windowed.
- Provider-specific payloads stay behind `/api/backends`, `/api/models`, and `/api/chat`.
- Custom gateways live in `.standard-ui/provider-plugins.json`, not in hardcoded UI branches.
- Uploads and provider plugins live in `.standard-ui`; selected UI state lives in browser storage.
- Engineering rules live in [`docs/engineering.md`](./docs/engineering.md) and [`docs/frontend-state.md`](./docs/frontend-state.md).

Supported backend shapes:

| Backend | Model list | Chat |
| --- | --- | --- |
| OpenAI-compatible | `GET /models` | `POST /chat/completions` |
| Anthropic | `GET /models` | `POST /messages` |
| Ollama | `GET /api/tags` | `POST /api/chat` |
| Custom gateway | `modelsPath` | `chatPath` |

Custom provider schema: [`app/api/_lib/provider-plugins.ts`](./app/api/_lib/provider-plugins.ts).

## Repo Map

- [`app/api/_lib/backends.ts`](./app/api/_lib/backends.ts): provider translation
- [`hooks/use-chat-threads.ts`](./hooks/use-chat-threads.ts): thread lifecycle
- [`hooks/use-chat-streaming.ts`](./hooks/use-chat-streaming.ts): request streaming
- [`lib/thread-storage.ts`](./lib/thread-storage.ts): local thread persistence guard
- [`components/chat`](./components/chat): chat surface
- [`docs/frontend-state.md`](./docs/frontend-state.md): frontend state contract

## Docs

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`SECURITY.md`](./SECURITY.md)
- [`CHANGELOG.md`](./CHANGELOG.md)
- [`docs/engineering.md`](./docs/engineering.md)

## License

MIT. See [`LICENSE`](./LICENSE).
