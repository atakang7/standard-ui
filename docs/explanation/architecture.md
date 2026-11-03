# Architecture

`app/page.tsx` composes the chat surface from `components/chat/` and the state hooks. The browser sends model requests to Next.js route handlers in `app/api/`.

The handlers convert Ollama, OpenAI-compatible, Anthropic, and custom gateway responses into a common NDJSON stream. Provider-specific formats stay in `app/api/_lib/backends.ts` and `provider-plugins.ts`, so message rendering uses one stream shape.

Saved threads live in browser storage. A request derives a bounded history from the selected thread without shortening its persisted messages. `lib/thread-storage.ts` rejects unintended history loss during writes. This isolates UI changes from saved conversations.

Attachments and custom provider definitions live under `.standard-ui/` on the server. Docker mounts that directory into a named volume. Browser-local threads do not move with the volume.

There is no user database or application login. Exposing the HTTP routes beyond a trusted local network would also expose provider configuration and upload operations. Docker Compose binds port 3000 to localhost.
