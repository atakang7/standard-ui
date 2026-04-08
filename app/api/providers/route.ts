import { NextResponse } from "next/server";
import {
  deleteProviderPlugin,
  listProviderPlugins,
  upsertProviderPlugin,
} from "../_lib/provider-plugins";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

export async function GET() {
  return NextResponse.json({
    providers: listProviderPlugins(),
  });
}

export async function POST(request: Request) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON body." }, { status: 400 });
  }

  try {
    const provider = upsertProviderPlugin((body ?? {}) as Record<string, unknown>);
    return NextResponse.json({ provider }, { status: 201 });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Failed to save provider.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}

export async function DELETE(request: Request) {
  const url = new URL(request.url);
  const id = url.searchParams.get("id")?.trim() || "";
  if (!id) {
    return NextResponse.json({ error: "Provider id is required." }, { status: 400 });
  }

  const deleted = deleteProviderPlugin(id);
  if (!deleted) {
    return NextResponse.json({ error: `Provider "${id}" was not found.` }, { status: 404 });
  }

  return NextResponse.json({ ok: true });
}
