import { promises as fs } from "node:fs";
import path from "node:path";

export const dynamic = "force-dynamic";

const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

const MIME: Record<string, string> = {
  ".jpg": "image/jpeg",
  ".jpeg": "image/jpeg",
  ".png": "image/png",
  ".webp": "image/webp",
  ".avif": "image/avif",
  ".gif": "image/gif",
  ".mp4": "video/mp4",
  ".webm": "video/webm",
  ".mov": "video/quicktime",
  ".m4v": "video/x-m4v",
};

/** Streams a locally stored media file: /api/media/file/<filename> */
export async function GET(
  _req: Request,
  { params }: { params: Promise<{ name: string[] }> }
) {
  const { name } = await params;
  const relative = (name ?? []).join("/");
  if (!relative || relative.includes("\0")) return new Response("Not found", { status: 404 });

  const abs = path.resolve(UPLOADS_ROOT, relative);
  if (!abs.startsWith(`${UPLOADS_ROOT}${path.sep}`)) {
    return new Response("Forbidden", { status: 403 });
  }
  try {
    const stat = await fs.stat(abs);
    if (!stat.isFile()) return new Response("Not found", { status: 404 });
    const data = await fs.readFile(abs);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": MIME[path.extname(abs).toLowerCase()] ?? "application/octet-stream",
        "Content-Length": String(stat.size),
        "Cache-Control": "public, max-age=31536000, immutable",
        "Accept-Ranges": "bytes",
      },
    });
  } catch {
    return new Response("Not found", { status: 404 });
  }
}
