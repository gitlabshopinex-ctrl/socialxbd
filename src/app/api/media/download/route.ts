import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { promises as fs } from "node:fs";
import path from "node:path";
import { downloadFromShopinex, isShopinexConfigured } from "@/server/shopinex";

export const dynamic = "force-dynamic";

/** Proxies a storage download so the API key is only ever used server-side. */
export async function GET(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) return Response.json({ error: "Missing media id" }, { status: 400 });

  if (isShopinexConfigured()) {
    const result = await downloadFromShopinex(id);
    if (result.ok) {
      const headers = new Headers();
      headers.set("Content-Type", result.response.headers.get("content-type") ?? "application/octet-stream");
      const disposition = result.response.headers.get("content-disposition");
      if (disposition) headers.set("Content-Disposition", disposition);
      headers.set("Cache-Control", "private, max-age=60");
      return new Response(result.response.body, { status: 200, headers });
    }
    return Response.json({ error: result.error }, { status: result.status ?? 502 });
  }

  // Local fallback: stream the stored file straight from disk.
  const numericId = Number(id);
  const [asset] = Number.isInteger(numericId)
    ? await db.select().from(mediaAssets).where(eq(mediaAssets.id, numericId)).limit(1)
    : await db.select().from(mediaAssets).where(eq(mediaAssets.remoteId, id)).limit(1);

  if (!asset?.url) {
    return Response.json({ error: "Media not found" }, { status: 404 });
  }
  const localPrefix = ["/uploads/", "/api/media/file/"].find((value) => asset.url.startsWith(value));
  if (!localPrefix) {
    return Response.redirect(asset.url, 302);
  }

  const root = path.resolve(process.cwd(), "public", "uploads");
  const abs = path.resolve(root, asset.url.slice(localPrefix.length));
  if (!abs.startsWith(`${root}${path.sep}`)) {
    return Response.json({ error: "Forbidden" }, { status: 403 });
  }
  try {
    const data = await fs.readFile(abs);
    return new Response(new Uint8Array(data), {
      status: 200,
      headers: {
        "Content-Type": asset.mimeType || "application/octet-stream",
        "Content-Disposition": `attachment; filename="${asset.fileName || "socialx-media"}"`,
        "Content-Length": String(data.byteLength),
      },
    });
  } catch {
    return Response.json({ error: "Stored file is missing" }, { status: 404 });
  }
}
