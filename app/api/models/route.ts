import { NextResponse } from "next/server";
import {
  getModelCapabilitiesForBackend,
  listAvailableBackends,
  listModelsForBackend,
  parseBackendError,
} from "../_lib/backends";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const requestedBackend = searchParams.get("backend")?.trim() || "";
  const requestedModel = searchParams.get("model")?.trim() || "";

  const availableBackends = listAvailableBackends();
  const defaultBackend = availableBackends[0]?.id || "ollama";
  const backendId = requestedBackend || defaultBackend;

  if (!availableBackends.some((backend) => backend.id === backendId)) {
    return NextResponse.json(
      {
        error: `Backend "${backendId}" is not configured.`,
      },
      { status: 400 }
    );
  }

  try {
    if (requestedModel) {
      const capabilities = await getModelCapabilitiesForBackend({
        backendId,
        modelId: requestedModel,
        signal: request.signal,
      });
      return NextResponse.json({
        backend: backendId,
        model: requestedModel,
        capabilities,
      });
    }

    const models = await listModelsForBackend(backendId);
    return NextResponse.json({
      backend: backendId,
      models,
    });
  } catch (error) {
    const parsed = parseBackendError(error);
    return NextResponse.json(
      {
        error: parsed.error,
        details: parsed.details,
      },
      { status: parsed.status }
    );
  }
}
