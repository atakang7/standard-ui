# Contributing

Contributions are expected to preserve the project contracts, not just make the diff pass.

## Before Coding

- Identify the owner you are changing: provider adapter, thread state, streaming, UI component, runtime config, or docs.
- Keep unrelated refactors out unless they remove risk for the same change.
- Do not introduce private deployment assumptions, secrets, `.env` files, logs, uploads, or ignored proxy helpers.

## Pull Request Standard

Every PR should state:

- the contract it changes or preserves
- the user-visible behavior, if any
- the risk area: history persistence, request windowing, provider compatibility, uploads, Docker/runtime, or visual-only
- the validation that matches that risk

Extra requirements:

- Chat history changes must distinguish thread history from request history.
- Edit/regenerate changes must cover failure before the first replacement chunk.
- Provider changes must name the capability or adapter boundary they use.
- Runtime changes must cover native start and Docker behavior when both are affected.
- Documentation changes should remove ambiguity; do not add onboarding prose that repeats what the UI or commands already show.

## Required Checks

Run the smallest set that proves the changed contract:

| Change | Check |
| --- | --- |
| App behavior | `npm run build` and the affected manual flow |
| Docker/runtime | `docker compose --env-file /dev/null config` and a container smoke test |
| Provider adapter | model list and one streaming response for the affected provider shape |
| Docs only | format/link sanity; no build required unless docs reference generated app behavior |

If you skip an applicable check, say why in the PR.
