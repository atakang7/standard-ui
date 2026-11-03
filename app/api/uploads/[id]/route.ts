import { readStoredAttachmentForDownload } from "../../_lib/uploads";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function escapeFileName(fileName: string) {
  return fileName.replace(/["\\\r\n]/g, "_");
}

export async function GET(
  _request: Request,
  context: { params: { id: string } }
) {
  const id = context.params.id?.trim() || "";
  const attachment = await readStoredAttachmentForDownload(id);

  if (!attachment) {
    return new Response("Not found", { status: 404 });
  }

  const contentType = attachment.meta.mimeType || "application/octet-stream";
  const disposition = attachment.meta.kind === "image" || contentType.startsWith("text/")
    ? "inline"
    : "attachment";
  const body = new Uint8Array(attachment.buffer);

  return new Response(body, {
    status: 200,
    headers: {
      "Content-Type": contentType,
      "Content-Length": String(body.byteLength),
      "Content-Disposition": `${disposition}; filename="${escapeFileName(attachment.fileName)}"`,
      "Cache-Control": "private, max-age=31536000, immutable",
    },
  });
}
