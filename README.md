# standard-ui

An open-source, provider-agnostic chat UI for OpenAI-compatible APIs, Anthropic, Ollama, and custom provider plugins.

## Philosophy

`standard-ui` is built around a simple idea: your chat interface should adapt to your model stack, not trap you inside one vendor or one workflow.

- Standards over lock-in. The UI is designed to work with common API shapes and multiple providers instead of assuming a single backend.
- Local-first operator control. Conversation state, appearance preferences, uploads, and custom provider definitions stay under your control.
- Thin, inspectable infrastructure. The app keeps the server layer small so it is easy to understand, modify, and run behind your own gateway or directly against provider APIs.
- Bring your own backend. Private proxy layers and internal deployment details are intentionally left out of this public repository.

## What It Includes

- Multi-provider chat with OpenAI-compatible, Anthropic, and Ollama backends
- Streaming responses and per-backend model settings
- File attachments for supported providers and models
- Custom provider plugin support stored locally in `.standard-ui/provider-plugins.json`
- Threaded conversations with local persistence
- Light and dark appearance modes

## Getting Started

```bash
npm install
npm run dev
```

Open `http://localhost:3000`.

## Environment

Create a local `.env` file with only the providers you want to enable. For example:

```dotenv
OPENAI_ENABLED=true
OPENAI_BASE_URL=https://api.openai.com/v1
OPENAI_API_KEY=sk-...

# Optional
# ANTHROPIC_ENABLED=true
# ANTHROPIC_BASE_URL=https://api.anthropic.com/v1
# ANTHROPIC_API_KEY=sk-ant-...

# Optional
# OLLAMA_BASE_URL=http://localhost:11434
```

## Notes

- Private proxy helpers used in the original local setup are excluded from this public repository.
- Runtime files under `.standard-ui/`, local env files, logs, and process IDs are ignored by Git.

## Working On It

- Read `CONTRIBUTING.md` for the practical contribution rules.
- Read `docs/engineering.md` for the codebase map and the small engineering playbook.

## License

MIT. See `LICENSE`.
