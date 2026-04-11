<p align="center">
  <a href="./docs/hero.svg">
    <img src="./docs/hero.svg" alt="standard-ui clean provider-agnostic chat workspace" width="1100">
  </a>
</p>

<p align="center">
  <sub>Lab-clean, local-first chat UI for teams that do not want to hardcode one model vendor.</sub>
</p>

<h1 align="center">standard-ui</h1>

<p align="center">
  <strong>One chat UI for OpenAI-compatible APIs, Anthropic, Ollama, and custom gateways.</strong>
</p>

<p align="center">
  Quiet interface. Clear contracts. Serious about state.
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
  <a href="#what-it-is">What It Is</a> ·
  <a href="#standards-in-this-project">Standards</a> ·
  <a href="#supported-backends">Backends</a> ·
  <a href="#repo-map">Repo Map</a>
</p>

`standard-ui` is a provider-agnostic chat workspace for real model stacks. It is built for a simple promise: the interface should stay calm, the contracts should stay readable, and chat history should belong to the session.

The main idea is simple: if a backend can list models, stream chat, and expose a few capability flags, this UI can sit on top of it.

## What It Is

- A Next.js chat UI for OpenAI-compatible APIs, Anthropic, Ollama, and custom gateways.
- A local-first workspace for threads, drafts, settings, attachments, and provider plugins.
- A thin backend routing layer that keeps provider differences out of the UI.
- A repo meant to be read, forked, and modified without inheriting a private platform.

## Product Feel

The intended feel is a long white lab corridor: clean, quiet, structured, and hard to accidentally break. That shows up in the product and the repo:

- chat history is treated as session-owned data, not disposable component state
- request history can be bounded, but saved thread history remains complete
- provider integrations are contracts, not one-off branches hidden in the UI
- UI components should own local interaction only, not persistence or provider orchestration

## Why standard-ui

- One UI for many backends.
- Local-first threads, drafts, settings, and uploads.
- Thin server routes you can read in one sitting.
- Guardrails around session history and persistence.
- Custom gateways without rewriting the app.
- Small enough to understand end to end.

## Quick Start

### 1. Install and run

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

### 2. Add one backend

Create a local `.env` file with only the provider you want.

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

If no models show up:

- make sure the provider is running
- check the API key and base URL
- restart `npm run dev` after editing `.env`
- for Ollama, make sure you have pulled a model

### Production

```bash
npm run build
npm run start
```

## Standards in this project

This repo is built around a small set of explicit standards.

### 1. Internal app API

These are the app routes the UI talks to.

| Route | Method | Standard behavior |
| --- | --- | --- |
| `/api/backends` | `GET` | lists configured backends and the default backend |
| `/api/models?backend=...` | `GET` | lists models for one backend |
| `/api/models?backend=...&model=...` | `GET` | returns capability flags for one model |
| `/api/chat` | `POST` | accepts normalized chat input and returns an NDJSON stream |
| `/api/providers` | `GET` | lists local custom providers |
| `/api/providers` | `POST` | creates or updates one local custom provider |
| `/api/providers?id=...` | `DELETE` | deletes one local custom provider |
| `/api/uploads` | `POST` | accepts multipart uploads under the `files` field |
| `/api/uploads/[id]` | `GET` | serves one stored upload back to the UI |

Minimal `/api/chat` request:

```json
{
  "backend": "ollama",
  "model": "llama3.2",
  "messages": [
    {
      "role": "user",
      "content": "Hello"
    }
  ]
}
```

Minimal NDJSON stream shape:

```json
{"message":{"role":"assistant","content":"Hi"}}
{"done":true}
```

### 2. Provider contracts

These are the standard provider interfaces already supported.

| Backend | Model list | Chat interface | Stream shape |
| --- | --- | --- | --- |
| OpenAI-compatible | `GET /models` | `POST /chat/completions` | SSE |
| Anthropic | `GET /models` | `POST /messages` | SSE |
| Ollama | `GET /api/tags` | `POST /api/chat` | NDJSON |
| Custom gateway | `modelsPath` | `chatPath` | `ndjson`, `sse-standard`, or `openai` |

### 3. Custom provider plugin contract

Custom gateways live in `.standard-ui/provider-plugins.json`.

The shape is defined in [`app/api/_lib/provider-plugins.ts`](./app/api/_lib/provider-plugins.ts).

Important fields:

- `baseUrl`: provider root URL
- `modelsPath`: path used to load models
- `chatPath`: path used to stream chat
- `modelsSource`: `remote` or `static`
- `streamFormat`: `ndjson`, `sse-standard`, or `openai`
- `headers`: custom request headers
- `staticModels`: fixed model list when models are not remote
- `capabilities`: backend setting support
- `modelCapabilities`: input and attachment support

Minimal example:

```json
{
  "providers": [
    {
      "name": "My Gateway",
      "baseUrl": "https://gateway.example.com",
      "modelsPath": "/models",
      "chatPath": "/chat/stream",
      "modelsSource": "remote",
      "streamFormat": "ndjson",
      "headers": {
        "accept": "application/x-ndjson"
      }
    }
  ]
}
```

### 4. Shared TypeScript contracts

Shared app types live in [`lib/types.ts`](./lib/types.ts).

| Interface | What it means |
| --- | --- |
| `BackendOption` | backend shown in the UI |
| `ModelOption` | model shown in the picker |
| `BackendsResponse` | response from `/api/backends` |
| `ModelsResponse` | response from `/api/models` |
| `RequestMessage` | normalized message passed into the backend layer |
| `StreamChunk` | normalized streaming event shape |
| `ChatThread` | saved local thread |
| `ChatMessage` | saved local message |
| `ChatAttachment` | attachment metadata used by the UI |
| `ChatArtifact` | bundled prompt artifact metadata |
| `ChatSettings` | shared generation settings |

### 5. Local runtime standards

These are the default places where local runtime data lives.

| Location | Standard use |
| --- | --- |
| `.standard-ui/provider-plugins.json` | saved custom providers |
| `.standard-ui/uploads` | uploaded files and attachment metadata |
| browser local storage | threads, drafts, selected backend/model, settings, appearance |

### 6. Default behavior

These are the default rules the app follows.

- `/api/chat` returns `application/x-ndjson`
- chat requests are bounded before they hit the backend
- uploads use the `files` form field
- uploads are limited to 10 files per request
- total upload batch size is limited to 40 MB
- default single attachment limit is 20 MB

### 7. Core config

These are the main env vars the project expects.

| Env var | Standard use |
| --- | --- |
| `OLLAMA_BASE_URL` | points to the Ollama server |
| `OLLAMA_ENABLED` | turns the built-in Ollama backend on or off |
| `OPENAI_ENABLED` | turns the OpenAI-compatible backend on |
| `OPENAI_BASE_URL` | points to the OpenAI-compatible server |
| `OPENAI_API_KEY` | auth for the OpenAI-compatible backend |
| `ANTHROPIC_ENABLED` | turns the Anthropic backend on |
| `ANTHROPIC_BASE_URL` | points to the Anthropic API |
| `ANTHROPIC_API_KEY` | auth for the Anthropic backend |
| `MODEL_CAPABILITY_PROBE` | turns automatic model capability probing on or off |

## Supported Backends

| Backend | Status | Notes |
| --- | --- | --- |
| OpenAI-compatible APIs | Built in | Uses OpenAI-style model and chat endpoints |
| Anthropic | Built in | Uses Anthropic model and messages endpoints |
| Ollama | Built in | Uses local Ollama model and chat endpoints |
| Custom gateways | Built in | Uses the local provider plugin contract |

## Repo Map

- [`app/page.tsx`](./app/page.tsx): main chat shell and local state
- [`app/api/_lib/backends.ts`](./app/api/_lib/backends.ts): backend translation layer
- [`app/api/_lib/provider-plugins.ts`](./app/api/_lib/provider-plugins.ts): custom gateway contract
- [`app/api/_lib/uploads.ts`](./app/api/_lib/uploads.ts): upload storage and attachment parsing
- [`components/chat`](./components/chat): chat UI components
- [`lib/types.ts`](./lib/types.ts): shared app contracts
- [`docs/engineering.md`](./docs/engineering.md): contributor guide

## Docs

- [`CONTRIBUTING.md`](./CONTRIBUTING.md)
- [`docs/engineering.md`](./docs/engineering.md)
- [`SECURITY.md`](./SECURITY.md)
- [`CHANGELOG.md`](./CHANGELOG.md)

## License

MIT. See [`LICENSE`](./LICENSE).
