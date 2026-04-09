<p align="center">
  <img src="./docs/standard-ui-first-look.png" alt="standard-ui interface screenshot" width="1200">
</p>

<h1 align="center">standard-ui</h1>

<p align="center">
  <strong>Ship one chat UI across OpenAI-compatible APIs, Anthropic, Ollama, and custom gateways.</strong>
</p>

<p align="center">
  A clean, local-first interface for teams that want control over their model stack without rebuilding the frontend for every provider.
</p>

<p align="center">
  <a href="https://github.com/atakang7/standard-ui/actions/workflows/ci.yml"><img alt="CI" src="https://github.com/atakang7/standard-ui/actions/workflows/ci.yml/badge.svg"></a>
  <a href="./LICENSE"><img alt="MIT License" src="https://img.shields.io/badge/license-MIT-1f6feb.svg"></a>
  <img alt="Next.js 14" src="https://img.shields.io/badge/Next.js-14-111111?logo=nextdotjs&logoColor=white">
  <img alt="React 18" src="https://img.shields.io/badge/React-18-149eca?logo=react&logoColor=white">
  <img alt="TypeScript 5" src="https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript&logoColor=white">
</p>

<p align="center">
  <a href="#quick-start">Quick Start</a> ·
  <a href="#why-standard-ui">Why standard-ui</a> ·
  <a href="#supported-backends">Supported Backends</a> ·
  <a href="#repo-map">Repo Map</a>
</p>

`standard-ui` is an open source chat UI for real model stacks. It gives you one polished interface across multiple providers, keeps the server layer thin and inspectable, and stays simple enough to fork, audit, and adapt.

## Why standard-ui

- One UI, many backends.
- Local-first threads, drafts, settings, and uploads.
- Thin server routes instead of hidden orchestration.
- Custom gateway support without rewriting the app shell.
- Small enough to understand end to end.

## Highlights

| Capability | What it gives you |
| --- | --- |
| Multi-provider chat | OpenAI-compatible APIs, Anthropic, Ollama, and custom gateways |
| Streaming-first UX | Responses stream into the interface as they arrive |
| Attachments | Model-aware file support where the backend allows it |
| Local persistence | Threads, drafts, settings, and appearance preferences stay local |
| Custom providers | Add provider plugins in `.standard-ui/provider-plugins.json` |
| Thin backend layer | API routes stay direct, readable, and easy to modify |

## Quick Start

### 1. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### 2. Configure one backend

Create a local `.env` file with only the provider you want to use.

Ollama:

```dotenv
OLLAMA_BASE_URL=http://localhost:11434
```

OpenAI-compatible:

```dotenv
OPENAI_ENABLED=true
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...
```

Anthropic:

```dotenv
ANTHROPIC_ENABLED=true
ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
ANTHROPIC_API_KEY=sk-ant-...
```

### 3. Start chatting

1. Choose a backend.
2. Pick a model.
3. Send your first prompt.

If no models appear:

- make sure the provider is reachable
- double-check the API key and base URL
- restart `npm run dev` after updating `.env`
- for Ollama, confirm the server is running and at least one model is installed

### Production

```bash
npm run build
npm run start
```

## Supported Backends

| Backend | Status | Notes |
| --- | --- | --- |
| OpenAI-compatible APIs | Built in | Works with OpenAI-style `/models`, `/chat/completions`, and file upload flows |
| Anthropic | Built in | Supports direct model loading and chat requests |
| Ollama | Built in | Supports local model workflows and terminal integration |
| Custom gateways | Built in | Configure provider plugins locally with base URL, paths, headers, and model metadata |

## Repo Map

- [`app/page.tsx`](./app/page.tsx): main chat shell, local state, drafts, and interaction flow
- [`app/api/_lib/backends.ts`](./app/api/_lib/backends.ts): provider-specific backend translation
- [`app/api/_lib/provider-plugins.ts`](./app/api/_lib/provider-plugins.ts): local custom gateway definitions
- [`components/chat`](./components/chat): chat UI components, settings, and provider-facing UX
- [`docs/engineering.md`](./docs/engineering.md): engineering guide for contributors

## Principles

- Standards over lock-in.
- Local-first control.
- Thin infrastructure.
- Public-repo-friendly boundaries.

## Docs

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`docs/engineering.md`](./docs/engineering.md)
- [`SECURITY.md`](./SECURITY.md)
- [`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT. See [`LICENSE`](./LICENSE).
