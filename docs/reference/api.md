# HTTP API

All routes are relative to `http://localhost:3000`.

| Route | Method | Input | Result |
| --- | --- | --- | --- |
| `/api/backends` | GET | none | `backends`, `defaultBackend` |
| `/api/models` | GET | `backend` query | `backend`, `models` |
| `/api/models` | GET | `backend`, `model` query | `backend`, `model`, `capabilities` |
| `/api/chat` | POST | JSON chat request | NDJSON response stream |
| `/api/providers` | GET | none | `providers` |
| `/api/providers` | POST | JSON provider definition | `provider`, HTTP 201 |
| `/api/providers` | DELETE | `id` query | `ok: true` |
| `/api/uploads` | POST | Multipart `files` | `attachments` |
| `/api/uploads/[id]` | GET | Attachment ID in path | Stored file |
| `/api/ollama/cli` | POST | JSON `command` | Command status and output |

## Chat request

| Field | Type | Required |
| --- | --- | --- |
| `backend` | string | yes |
| `model` | string | yes |
| `messages` | array of `{ role, content, attachments? }` | yes |
| `sessionKey` | string | no |
| `settings` | object | no |

`role` is `user` or `assistant`. `Content-Type` for a successful chat response is `application/x-ndjson`.

## Upload limits

| Limit | Value |
| --- | --- |
| Files per request | 10 |
| Total bytes per request | 40 MiB |
| Single file | 20 MiB |

The API routes have no application authentication. The Compose port is bound to loopback.
