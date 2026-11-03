# Engineering Contract

`standard-ui` is a public, provider-agnostic client. The codebase should make its boundaries visible: provider translation at the server edge, session history in the thread layer, and component state inside components.

## Architecture Boundaries

| Boundary | Rule |
| --- | --- |
| Provider adapters | Provider-specific payloads stay in `app/api/_lib/backends.ts` or custom provider plugin code. |
| Chat state | Thread lifecycle and persistence stay in `hooks/use-chat-threads.ts` and `lib/thread-storage.ts`. |
| Streaming | Request construction, abort, edit, and regenerate stay in `hooks/use-chat-streaming.ts`. |
| UI components | Components render state and own interaction-local state only. |
| Runtime files | `.standard-ui` is runtime state and must not be committed. |
| Private infrastructure | Private proxy scripts, credentials, deployment-only assumptions, and local tunnels stay out of the public repo. |

## State Rules

- Persisted thread history is the source of truth for saved conversations.
- Provider request history is derived data and may be windowed.
- Changing backend, model, settings, appearance, uploads, or sidebar state must not mutate thread history.
- Any intentional message-list shrink must pass through the guarded thread persistence path.
- Storage recovery should prefer preserving older valid history over accepting a shorter unsafe write.

See [`frontend-state.md`](./frontend-state.md) for the full state contract.

## Provider Rules

- Add a capability flag before adding provider-specific UI branches.
- Normalize provider streams before they reach chat components.
- Keep API routes thin: validate input, call the adapter, stream normalized output.
- Custom gateways should use `.standard-ui/provider-plugins.json`; do not hardcode one private gateway into the app.
- New provider env vars require `.env.example` and README updates.

## UI Rules

- Components may own presentation state: open panels, inline draft text, copy state, viewport/window size, and transient focus state.
- Components may not own thread persistence, provider routing, request windowing, or active stream identity.
- Large components should be split by ownership, not by arbitrary line count.
- Visual polish should reinforce the product contract: calm state, readable controls, no hidden provider coupling.

## Runtime Rules

- Default local development should work without hosted provider credentials.
- Docker must preserve `.standard-ui` across restarts.
- The public repo must not depend on ignored proxy helpers.
- Build output, logs, runtime uploads, and env files stay ignored.

## Required Validation

Use the smallest validation set that covers the touched contract:

| Change | Minimum validation |
| --- | --- |
| Chat state, streaming, providers, uploads | `npm run build` plus the affected manual flow |
| Docker/runtime start | `docker compose --env-file /dev/null config` and a container HTTP smoke test |
| SVG/docs-only visual asset | XML/format check plus rendered preview |
| Provider contract | Verify model list and one streaming response for that provider shape |

Do not mark a PR as validated by CI alone when the change depends on a provider, browser storage, Docker networking, or stream timing.
