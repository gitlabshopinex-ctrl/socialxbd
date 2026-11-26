import { desc, eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets } from "@/db/schema";
import { getCurrentHandle } from "@/lib/data";
import {
  SHOPINEX_MAX_BYTES,
  isShopinexConfigured,
  listShopinexMedia,
} from "@/server/shopinex";
import { removeStoredMedia, storageProvider, storeMedia } from "@/server/media";

export const dynamic = "force-dynamic";

const MAX_BYTES = SHOPINEX_MAX_BYTES;

/** Media listing: Shopinex items when configured, plus everything tracked locally. */
export async function GET() {
  const rows = await db
    .select()
    .from(mediaAssets)
    .orderBy(desc(mediaAssets.createdAt))
    .limit(60);

  const tracked = rows.map((row) => ({
    id: row.remoteId ?? String(row.id),
    assetId: row.id,
    url: row.url,
    fileName: row.fileName,
    mimeType: row.mimeType,
    kind: row.kind,
    sizeBytes: row.sizeBytes,
    provider: row.provider,
    videoId: row.videoId,
    createdAt: row.createdAt.toISOString(),
  }));

  let remote: Awaited<ReturnType<typeof listShopinexMedia>> | null = null;
  if (isShopinexConfigured()) remote = await listShopinexMedia();

  return Response.json({
    provider: storageProvider(),
    maxBytes: MAX_BYTES,
    configured: isShopinexConfigured(),
    tracked,
    remote: remote && remote.ok ? remote.items : [],
    remoteError: remote && !remote.ok ? remote.error : null,
  });
}

/** Uploads one image/video file (multipart/form-data, field `file`). */
export async function POST(req: Request) {
  const contentType = req.headers.get("content-type") ?? "";
  if (!contentType.includes("multipart/form-data")) {
    return Response.json({ error: "Use multipart/form-data with a `file` field" }, { status: 400 });
  }

  const form = await req.formData();
  const file = form.get("file");
  if (!(file instanceof File) || file.size === 0) {
    return Response.json({ error: "A file is required" }, { status: 400 });
  }
  const isImage = file.type.startsWith("image/");
  const isVideo = file.type.startsWith("video/");
  if (!isImage && !isVideo) {
    return Response.json({ error: "Only images and videos are allowed" }, { status: 415 });
  }
  if (file.size > MAX_BYTES) {
    return Response.json(
      { error: `File is larger than ${Math.round(MAX_BYTES / 1024 / 1024)} MB` },
      { status: 413 }
    );
  }

  try {
    const stored = await storeMedia({
      buffer: Buffer.from(await file.arrayBuffer()),
      fileName: file.name,
      mimeType: file.type,
    });
    const handle = await getCurrentHandle();

    const [row] = await db
      .insert(mediaAssets)
      .values({
        provider: stored.provider,
        remoteId: stored.remoteId,
        url: stored.url,
        fileName: stored.fileName,
        mimeType: stored.mimeType,
        kind: stored.mimeType.startsWith("video/") ? "video" : "image",
        sizeBytes: stored.sizeBytes,
        uploadedBy: handle,
      })
      .returning();

    return Response.json(
      {
        ok: true,
        asset: {
          id: stored.remoteId ?? String(row.id),
          assetId: row.id,
          url: stored.url,
          fileName: stored.fileName,
          mimeType: stored.mimeType,
          kind: row.kind,
          sizeBytes: stored.sizeBytes,
          provider: stored.provider,
        },
      },
      { status: 201 }
    );
  } catch (error) {
    return Response.json(
      { error: error instanceof Error ? error.message : "Upload failed" },
      { status: 502 }
    );
  }
}

/** Deletes a media item by its Shopinex media id (`?id=`) or tracked asset id. */
export async function DELETE(req: Request) {
  const url = new URL(req.url);
  const id = (url.searchParams.get("id") ?? "").trim();
  if (!id) return Response.json({ error: "Missing media id" }, { status: 400 });

  const numericId = Number(id);
  const [asset] = Number.isInteger(numericId) && numericId > 0
    ? await db.select().from(mediaAssets).where(eq(mediaAssets.id, numericId)).limit(1)
    : await db
        .select()
        .from(mediaAssets)
        .where(eq(mediaAssets.remoteId, id))
        .limit(1);

  if (asset) {
    const removed = await removeStoredMedia({
      url: asset.url,
      remoteId: asset.remoteId,
      provider: asset.provider,
    });
    await db.delete(mediaAssets).where(eq(mediaAssets.id, asset.id));
    if (!removed && asset.provider === "shopinex") {
      return Response.json({ error: "Storage did not confirm the delete" }, { status: 502 });
    }
    return Response.json({ ok: true, deletedId: id });
  }

  // Unknown locally: still attempt remote deletion by id.
  if (isShopinexConfigured()) {
    const { deleteFromShopinex } = await import("@/server/shopinex");
    const result = await deleteFromShopinex(id);
    if (!result.ok) return Response.json({ error: result.error }, { status: result.status ?? 502 });
    return Response.json({ ok: true, deletedId: id });
  }

  return Response.json({ error: "Media not found" }, { status: 404 });
}
