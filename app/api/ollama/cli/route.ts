import { NextResponse } from "next/server";

type CliSuccess = {
  ok: true;
  command: string;
  endpoint: string;
  output: string;
};

type CliFailure = {
  ok: false;
  command: string;
  error: string;
  output?: string;
};

type CliResponse = CliSuccess | CliFailure;

type RequestBody = {
  command?: string;
};

const HELP_TEXT = [
  "Supported commands:",
  "  ollama list",
  "  ollama ps",
  "  ollama version",
  "  ollama show <model>",
  '  ollama run <model> "<prompt>"',
  '  ollama chat <model> "<prompt>"',
  "  ollama pull <model>",
  "  ollama push <model>",
  '  ollama create <name> "<modelfile>"',
  "  ollama rm <model>",
  "  ollama copy <source> <destination>",
  '  ollama embed <model> "<text>"',
  '  ollama raw <METHOD> </api/path> \'{"json":"body"}\'',
].join("\n");

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function resolveOllamaBaseUrl() {
  if (process.env.OLLAMA_BASE_URL) {
    return process.env.OLLAMA_BASE_URL;
  }
  if (process.env.KUBERNETES_SERVICE_HOST) {
    return "http://ollama:11434";
  }
  return "http://localhost:11434";
}

function tokenize(command: string) {
  const tokens: string[] = [];
  let current = "";
  let quote: '"' | "'" | "" = "";
  let escape = false;

  for (const char of command.trim()) {
    if (escape) {
      current += char;
      escape = false;
      continue;
    }

    if (char === "\\") {
      escape = true;
      continue;
    }

    if (quote) {
      if (char === quote) {
        quote = "";
      } else {
        current += char;
      }
      continue;
    }

    if (char === '"' || char === "'") {
      quote = char;
      continue;
    }

    if (/\s/.test(char)) {
      if (current) {
        tokens.push(current);
        current = "";
      }
      continue;
    }

    current += char;
  }

  if (current) {
    tokens.push(current);
  }

  return tokens;
}

function formatBytes(bytes?: number) {
  if (!bytes || Number.isNaN(bytes)) return "-";
  const units = ["B", "KB", "MB", "GB", "TB"];
  let value = bytes;
  let index = 0;
  while (value >= 1024 && index < units.length - 1) {
    value /= 1024;
    index += 1;
  }
  const rounded = value >= 10 ? Math.round(value) : Math.round(value * 10) / 10;
  return `${rounded}${units[index]}`;
}

function normalizeError(raw: string) {
  const trimmed = raw.trim();
  if (!trimmed) return "Ollama request failed.";
  return trimmed.slice(0, 700);
}

async function requestOllama(path: string, init?: RequestInit) {
  const url = `${resolveOllamaBaseUrl().replace(/\/$/, "")}${path}`;
  const response = await fetch(url, {
    ...init,
    cache: "no-store",
    headers: {
      "Content-Type": "application/json",
      ...(init?.headers ?? {}),
    },
  });

  if (!response.ok) {
    const raw = await response.text();
    throw new Error(`${path} (${response.status}) ${normalizeError(raw)}`);
  }

  return response;
}

async function requestJson(path: string, init?: RequestInit) {
  const response = await requestOllama(path, init);
  return response.json();
}

async function readNdjson(response: Response) {
  if (!response.body) {
    return (await response.text()).trim();
  }

  const reader = response.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";
  const lines: string[] = [];
  let lastStatus = "";

  const consumeLine = (line: string) => {
    const trimmed = line.trim();
    if (!trimmed) return;

    let parsed: Record<string, unknown>;
    try {
      parsed = JSON.parse(trimmed) as Record<string, unknown>;
    } catch {
      lines.push(trimmed);
      return;
    }

    if (typeof parsed.error === "string" && parsed.error) {
      lines.push(`error: ${parsed.error}`);
    }

    const statusParts: string[] = [];
    if (typeof parsed.status === "string" && parsed.status) {
      statusParts.push(parsed.status);
    }
    if (typeof parsed.completed === "number" && typeof parsed.total === "number" && parsed.total > 0) {
      const percentage = Math.round((parsed.completed / parsed.total) * 100);
      statusParts.push(`${percentage}%`);
    }

    if (statusParts.length) {
      const statusLine = statusParts.join(" ");
      if (statusLine !== lastStatus) {
        lines.push(statusLine);
        lastStatus = statusLine;
      }
    }

    if (typeof parsed.response === "string" && parsed.response.trim()) {
      lines.push(parsed.response);
    }
  };

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;

    buffer += decoder.decode(value, { stream: true });
    let newlineIndex = buffer.indexOf("\n");
    while (newlineIndex >= 0) {
      const line = buffer.slice(0, newlineIndex);
      buffer = buffer.slice(newlineIndex + 1);
      consumeLine(line);
      newlineIndex = buffer.indexOf("\n");
    }
  }

  buffer += decoder.decode();
  if (buffer.trim()) {
    consumeLine(buffer);
  }

  return lines.join("\n").trim();
}

function commandError(command: string, message: string, output?: string): CliFailure {
  return {
    ok: false,
    command,
    error: message,
    output,
  };
}

function commandSuccess(command: string, endpoint: string, output: string): CliSuccess {
  return {
    ok: true,
    command,
    endpoint,
    output: output.trim() || "(no output)",
  };
}

async function handleList(command: string): Promise<CliResponse> {
  const payload = (await requestJson("/api/tags")) as {
    models?: Array<{ name?: string; size?: number; modified_at?: string }>;
  };

  const models = payload.models ?? [];
  if (!models.length) {
    return commandSuccess(command, "/api/tags", "No models found.");
  }

  const lines = models.map((model) => {
    const name = model.name || "(unnamed)";
    const size = formatBytes(model.size);
    const modified = model.modified_at ? new Date(model.modified_at).toLocaleString() : "-";
    return `${name.padEnd(28)}  ${size.padEnd(8)}  ${modified}`;
  });

  return commandSuccess(command, "/api/tags", lines.join("\n"));
}

async function handlePs(command: string): Promise<CliResponse> {
  const payload = (await requestJson("/api/ps")) as {
    models?: Array<{ name?: string; size_vram?: number; expires_at?: string }>;
  };

  const models = payload.models ?? [];
  if (!models.length) {
    return commandSuccess(command, "/api/ps", "No running models.");
  }

  const lines = models.map((model) => {
    const name = model.name || "(unnamed)";
    const vram = formatBytes(model.size_vram);
    const expires = model.expires_at ? new Date(model.expires_at).toLocaleString() : "-";
    return `${name.padEnd(28)}  VRAM ${vram.padEnd(8)}  Expires ${expires}`;
  });

  return commandSuccess(command, "/api/ps", lines.join("\n"));
}

async function executeCommand(rawCommand: string): Promise<CliResponse> {
  const command = rawCommand.trim();
  if (!command) {
    return commandError(rawCommand, "Command is required.");
  }

  const tokens = tokenize(command);
  if (!tokens.length || tokens[0] !== "ollama") {
    return commandError(command, 'Command must start with "ollama".', HELP_TEXT);
  }

  const action = (tokens[1] || "help").toLowerCase();
  const args = tokens.slice(2);

  if (action === "help" || action === "--help" || action === "-h") {
    return commandSuccess(command, "local-help", HELP_TEXT);
  }

  if (action === "list" || action === "ls") {
    return handleList(command);
  }

  if (action === "ps") {
    return handlePs(command);
  }

  if (action === "version") {
    const payload = await requestJson("/api/version");
    return commandSuccess(command, "/api/version", JSON.stringify(payload, null, 2));
  }

  if (action === "show") {
    const name = args[0];
    if (!name) return commandError(command, "Usage: ollama show <model>");
    const payload = await requestJson("/api/show", {
      method: "POST",
      body: JSON.stringify({ name }),
    });
    return commandSuccess(command, "/api/show", JSON.stringify(payload, null, 2));
  }

  if (action === "pull") {
    const name = args[0];
    if (!name) return commandError(command, "Usage: ollama pull <model>");
    const response = await requestOllama("/api/pull", {
      method: "POST",
      body: JSON.stringify({ name, stream: true }),
    });
    const output = await readNdjson(response);
    return commandSuccess(command, "/api/pull", output || `Pulled ${name}.`);
  }

  if (action === "push") {
    const name = args[0];
    if (!name) return commandError(command, "Usage: ollama push <model>");
    const response = await requestOllama("/api/push", {
      method: "POST",
      body: JSON.stringify({ name, stream: true }),
    });
    const output = await readNdjson(response);
    return commandSuccess(command, "/api/push", output || `Pushed ${name}.`);
  }

  if (action === "create") {
    const name = args[0];
    const modelfile = args.slice(1).join(" ").trim();
    if (!name || !modelfile) {
      return commandError(command, 'Usage: ollama create <name> "<modelfile>"');
    }
    const response = await requestOllama("/api/create", {
      method: "POST",
      body: JSON.stringify({ name, modelfile, stream: true }),
    });
    const output = await readNdjson(response);
    return commandSuccess(command, "/api/create", output || `Created ${name}.`);
  }

  if (action === "rm" || action === "delete" || action === "remove") {
    const name = args[0];
    if (!name) return commandError(command, "Usage: ollama rm <model>");
    const payload = await requestJson("/api/delete", {
      method: "DELETE",
      body: JSON.stringify({ name }),
    });
    return commandSuccess(command, "/api/delete", JSON.stringify(payload, null, 2));
  }

  if (action === "copy" || action === "cp") {
    const source = args[0];
    const destination = args[1];
    if (!source || !destination) return commandError(command, "Usage: ollama copy <source> <destination>");
    const payload = await requestJson("/api/copy", {
      method: "POST",
      body: JSON.stringify({ source, destination }),
    });
    return commandSuccess(command, "/api/copy", JSON.stringify(payload, null, 2));
  }

  if (action === "run") {
    const model = args[0];
    const prompt = args.slice(1).join(" ").trim();
    if (!model || !prompt) return commandError(command, 'Usage: ollama run <model> "<prompt>"');
    const payload = (await requestJson("/api/generate", {
      method: "POST",
      body: JSON.stringify({
        model,
        prompt,
        stream: false,
      }),
    })) as { response?: string };
    return commandSuccess(command, "/api/generate", payload.response || "(empty model response)");
  }

  if (action === "chat") {
    const model = args[0];
    const prompt = args.slice(1).join(" ").trim();
    if (!model || !prompt) return commandError(command, 'Usage: ollama chat <model> "<prompt>"');
    const payload = (await requestJson("/api/chat", {
      method: "POST",
      body: JSON.stringify({
        model,
        stream: false,
        messages: [{ role: "user", content: prompt }],
      }),
    })) as {
      message?: { content?: string };
    };
    return commandSuccess(command, "/api/chat", payload.message?.content || "(empty model response)");
  }

  if (action === "embed" || action === "embeddings") {
    const model = args[0];
    const input = args.slice(1).join(" ").trim();
    if (!model || !input) return commandError(command, 'Usage: ollama embed <model> "<text>"');
    const payload = (await requestJson("/api/embed", {
      method: "POST",
      body: JSON.stringify({
        model,
        input,
      }),
    })) as {
      embeddings?: number[][];
    };

    const vector = payload.embeddings?.[0] ?? [];
    const preview = vector.slice(0, 8).map((value) => value.toFixed(4)).join(", ");
    const lines = [`Embedding dimension: ${vector.length}`, `Preview: [${preview}]`];
    return commandSuccess(command, "/api/embed", lines.join("\n"));
  }

  if (action === "raw") {
    const method = (args[0] || "GET").toUpperCase();
    const path = args[1] || "";
    const bodyRaw = args.slice(2).join(" ").trim();

    if (!path.startsWith("/api/")) {
      return commandError(command, 'Usage: ollama raw <METHOD> </api/path> \'{"json":"body"}\'');
    }

    let body: string | undefined;
    if (bodyRaw) {
      try {
        body = JSON.stringify(JSON.parse(bodyRaw));
      } catch {
        return commandError(command, "Raw JSON body is invalid.");
      }
    }

    const response = await requestOllama(path, {
      method,
      body,
    });

    const contentType = response.headers.get("content-type") || "";
    let output = "";

    if (contentType.includes("application/json")) {
      output = JSON.stringify(await response.json(), null, 2);
    } else if (contentType.includes("application/x-ndjson") || contentType.includes("text/event-stream")) {
      output = await readNdjson(response);
    } else {
      output = (await response.text()).trim();
    }

    return commandSuccess(command, `${method} ${path}`, output);
  }

  return commandError(command, `Unsupported ollama command: ${action}`, HELP_TEXT);
}

export async function POST(request: Request) {
  let body: RequestBody;
  try {
    body = (await request.json()) as RequestBody;
  } catch {
    return NextResponse.json(commandError("", "Invalid JSON body."), { status: 400 });
  }

  const command = body.command?.trim() || "";
  if (!command) {
    return NextResponse.json(commandError("", "Command is required."), { status: 400 });
  }

  try {
    const result = await executeCommand(command);
    if (!result.ok) {
      return NextResponse.json(result, { status: 400 });
    }
    return NextResponse.json(result, { status: 200 });
  } catch (error) {
    return NextResponse.json(
      commandError(command, error instanceof Error ? error.message : "Ollama command failed."),
      { status: 502 }
    );
  }
}
