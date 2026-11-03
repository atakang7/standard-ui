Part of [standard-ui](../README.md)

# App

The Next.js App Router renders the chat workspace and dispatches API requests.

## Run

```sh
npm run dev
```

Open http://localhost:3000.

## Test

```sh
npm run build
```

## Config

| Variable | Default | What |
| --- | --- | --- |
| `PORT` | `3000` | Listener port for `npm run start` |

## Interfaces

| Path | Role |
| --- | --- |
| `page.tsx` | Composes the chat UI and state hooks |
| `layout.tsx` | Initializes appearance from a cookie |
| [`api/`](api/README.md) | HTTP routes and model adapters |
| `globals.css` | Global styles |

The request and state boundaries are in [architecture](../docs/explanation/architecture.md).
