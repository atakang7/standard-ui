import { NextResponse } from "next/server";
import { listAvailableBackends } from "../_lib/backends";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  const backends = listAvailableBackends();
  return NextResponse.json({
    backends,
    defaultBackend: backends[0]?.id || "ollama",
  });
}
