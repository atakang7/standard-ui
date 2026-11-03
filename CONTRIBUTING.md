# Contributing

Use Node 22 (`.nvmrc`) and install the locked dependencies.

```sh
npm ci
npm run build
```

Open an issue before changing provider behavior or the persisted thread format.

## Pull requests

- Keep changes within the affected module.
- For streaming edits, check send, abort, edit, and regenerate.
- For providers, verify `GET /api/models` and one `POST /api/chat` stream.
- For runtime changes, check `docker compose config` and `docker compose up --build`.
- Include the commands run and any manual checks in the PR description.

Read the [state reference](docs/reference/state.md) before changing thread persistence. See [architecture](docs/explanation/architecture.md) for the API boundary.
