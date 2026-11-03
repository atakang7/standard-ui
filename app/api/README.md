Part of [standard-ui](../../README.md)

# API

Next.js route handlers translate browser requests to configured model backends and local files.

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
| `OLLAMA_BASE_URL` | `http://localhost:11434` | Ollama endpoint outside Docker |
| `OPENAI_BASE_URL` | `https://api.openai.com/v1` | OpenAI-compatible endpoint |
| `ANTHROPIC_BASE_URL` | `https://api.anthropic.com/v1` | Anthropic endpoint |

Other flags and credentials are in [configuration](../../docs/reference/configuration.md).

## Interfaces

| Route | Methods | Purpose |
| --- | --- | --- |
| `/api/backends` | GET | List configured backends |
| `/api/models` | GET | List models or probe one model |
| `/api/chat` | POST | Return a normalized NDJSON chat stream |
| `/api/providers` | GET, POST, DELETE | Manage custom provider definitions |
| `/api/uploads` | POST | Store multipart file uploads |
| `/api/uploads/[id]` | GET | Read a stored attachment |
| `/api/ollama/cli` | POST | Run supported Ollama API commands |

See the [HTTP reference](../../docs/reference/api.md) for request parameters.
