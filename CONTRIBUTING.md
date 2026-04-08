# Contributing

This repo is meant to stay practical.

## Ground Rules

- Keep changes small, reviewable, and easy to back out.
- Do not commit secrets, `.env` files, private proxy scripts, logs, or local runtime state.
- Prefer explicit code over clever abstractions.
- Keep the UI provider-agnostic unless there is a strong reason not to.
- If a feature only works with one private deployment setup, it does not belong in the public repo.

## Local Workflow

```bash
npm install
npm run dev
npm run build
```

`npm run build` is the required pre-merge check right now.

## Pull Request Shape

- Explain what changed and why.
- Call out any provider-specific behavior.
- Mention any follow-up work instead of hiding it in the diff.
- Avoid bundling refactors with behavior changes unless they are tightly connected.

## Documentation Rule

If you add a new backend, new settings, new attachment behavior, or a new storage contract, update `README.md` or `docs/engineering.md` in the same change.
