# standard-ui

Local chat workspace for developers using Ollama, OpenAI-compatible APIs, Anthropic, or custom model gateways.

```text
+--------------+   HTTP   +---------+   HTTP   +-------------------+
| app/page.tsx | -------> | app/api | -------> | Ollama / gateways |
+--------------+          +---------+          +-------------------+
       |
       v state
+---------+
| hooks   |
+---------+
       |
       v writes
+--------------+
| localStorage |
+--------------+
```

## Quick start

Use Node 22 (`.nvmrc`).

```sh
npm ci
npm run dev
```

Open http://localhost:3000.

## Layout

| Path | What it is |
| --- | --- |
| [`app/`](app/README.md) | Next.js pages and layout |
| [`app/api/`](app/api/README.md) | HTTP routes and provider adapters |
| [`components/chat/`](components/chat/README.md) | Chat display, composer, settings |
| [`hooks/`](hooks/README.md) | Threads, streams, provider selection |
| [`lib/`](lib/README.md) | Request bounds and local persistence |

## Docs

- [Docs index](docs/README.md)
- [Docker run](docs/how-to/run-with-docker.md)
- [Custom providers](docs/how-to/add-a-provider.md)
- [Configuration](docs/reference/configuration.md)
- [HTTP API](docs/reference/api.md)
- [State](docs/reference/state.md)
- [Architecture](docs/explanation/architecture.md)

## Limits

- HTTP routes have no application authentication; Compose binds to localhost by default.
- Threads stay in browser `localStorage`; there is no cross-browser sync.
- Uploads and custom providers live under server-side `.standard-ui`.
- CI runs `npm run build`; there is no automated test script.
