# Engineering Guide

This is the short version of how to work on `standard-ui` without turning it into a mess.

## Project Map

- `app/page.tsx`: main chat application shell and client state orchestration
- `app/api/*`: backend adapters, model loading, chat routing, uploads, and provider plugin endpoints
- `components/chat/*`: chat UI, composer, sidebar, message rendering, settings
- `lib/*`: shared types, storage helpers, constants, and utility functions
- `public/fonts/*`: UI fonts used by the frontend
- `.standard-ui/`: local runtime state for provider plugins and uploads, intentionally not committed

## Engineering Principles

- Provider-agnostic first. Favor common interfaces and capability flags over provider-specific branching in the UI.
- Local-first state. If state is user-local or operational, prefer keeping it on disk or in browser storage instead of inventing a service.
- Thin server layer. Keep API routes simple, direct, and easy to inspect.
- Pragmatic over abstract. Add abstraction only after duplication is clearly hurting us.
- Public repo boundary. Private infrastructure glue stays out of this repository.

## Common Changes

### Add or update a backend

- Start in `app/api/_lib/backends.ts`.
- Keep capability detection explicit.
- If the backend needs custom settings, make them obvious in the UI and document them.

### Change message rendering

- Start in `components/chat/chat-messages.tsx`.
- Preserve readable plain text and code block behavior.
- Be careful with large user messages, artifact bundling, and streaming output.

### Change settings UX

- Start in `components/chat/settings-view.tsx`.
- Keep labels concrete.
- Prefer a few good controls over a large panel of edge-case toggles.

## Review Checklist

- Does this still work without private proxy files?
- Are `.env` files, local artifacts, and generated runtime files still ignored?
- Did we keep the default local workflow simple?
- Did we run `npm run build`?
- Did we document user-visible behavior changes?
