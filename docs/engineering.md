# Engineering boundaries

Provider translation stays in server adapters; browser history and presentation state stay in their existing owners.

## Owners

| Area | Owner |
| --- | --- |
| Provider requests and streams | `app/api/_lib/backends.ts` |
| Custom provider settings | `app/api/_lib/provider-plugins.ts` |
| Request bounds, abort, edit, regenerate | `hooks/use-chat-streaming.ts` |
| Thread lifecycle | `hooks/use-chat-threads.ts` |
| Hydration and persistence guards | `lib/thread-storage.ts` |
| Display-only interaction state | `components/chat/` |
| Uploaded files | `app/api/_lib/uploads.ts` |

## Rules

- Validate HTTP input in API routes; normalize provider output before it reaches components.
- Keep request history separate from saved thread history.
- Put new provider environment variables in `.env.example` and the README.
- Keep `.standard-ui`, credentials, and local proxy scripts out of Git.
- Keep Docker's `.standard-ui` volume across restarts.

## Verify

- App changes: `npm run build` and the affected browser flow.
- Docker changes: `docker compose --env-file /dev/null config` and a local HTTP check.
- Provider changes: list models and stream one response from the affected endpoint.
