import { NextResponse } from "next/server";
import { getMaxSingleAttachmentBytes, storeUpload } from "../_lib/uploads";
import type { ChatAttachment } from "../../../lib/types";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

const MAX_ATTACHMENTS_PER_REQUEST = 10;
const MAX_TOTAL_REQUEST_BYTES = 40 * 1024 * 1024;

export async function POST(request: Request) {
  let formData: FormData;

  try {
    formData = await request.formData();
  } catch {
    return NextResponse.json({ error: "Invalid multipart form body." }, { status: 400 });
  }

  const files = formData
    .getAll("files")
    .filter((entry): entry is File => typeof File !== "undefined" && entry instanceof File);

  if (!files.length) {
    return NextResponse.json({ error: "Attach at least one file." }, { status: 400 });
  }
  if (files.length > MAX_ATTACHMENTS_PER_REQUEST) {
    return NextResponse.json(
      { error: `You can upload up to ${MAX_ATTACHMENTS_PER_REQUEST} files at once.` },
      { status: 400 }
    );
  }

  const totalBytes = files.reduce((sum, file) => sum + file.size, 0);
  if (totalBytes > MAX_TOTAL_REQUEST_BYTES) {
    return NextResponse.json(
      { error: `Total upload size exceeds ${Math.round(MAX_TOTAL_REQUEST_BYTES / (1024 * 1024))} MB.` },
      { status: 400 }
    );
  }

  try {
    const attachments: ChatAttachment[] = [];
    for (const file of files) {
      if (file.size > getMaxSingleAttachmentBytes()) {
        return NextResponse.json(
          {
            error: `"${file.name}" exceeds ${Math.round(getMaxSingleAttachmentBytes() / (1024 * 1024))} MB.`,
          },
          { status: 400 }
        );
      }
      attachments.push(await storeUpload(file));
    }

    return NextResponse.json({ attachments });
  } catch (error) {
    const message = error instanceof Error ? error.message : "Could not upload file.";
    return NextResponse.json({ error: message }, { status: 400 });
  }
}
