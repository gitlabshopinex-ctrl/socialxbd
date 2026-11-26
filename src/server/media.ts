import "server-only";
import { promises as fs } from "node:fs";
import path from "node:path";
import { randomUUID } from "node:crypto";
import {
  isShopinexConfigured,
  uploadToShopinex,
  deleteFromShopinex,
  SHOPINEX_MAX_BYTES,
} from "@/server/shopinex";

export { SHOPINEX_MAX_BYTES };
const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

export type StoredMedia = {
  provider: "shopinex" | "local";
  remoteId: string | null;
  url: string;
  fileName: string;
  mimeType: string;
  sizeBytes: number;
};

export function storageProvider(): "shopinex" | "local" {
  return isShopinexConfigured() ? "shopinex" : "local";
}

/**
 * Stores one media file: Shopinex Media API when configured, otherwise the
 * local `public/uploads` folder so the app keeps working without credentials.
 */
export async function storeMedia(input: {
  buffer: Buffer;
  fileName: string;
  mimeType: string;
}): Promise<StoredMedia> {
  if (input.buffer.byteLength > SHOPINEX_MAX_BYTES) {
    throw new Error("File exceeds the 200 MB upload limit");
  }

  if (isShopinexConfigured()) {
    const result = await uploadToShopinex(input);
    if (result.ok) {
      return {
        provider: "shopinex",
        remoteId: result.item.id || null,
        url: result.item.url,
        fileName: input.fileName,
        mimeType: input.mimeType,
        sizeBytes: input.buffer.byteLength,
      };
    }
    // A configured-but-failing remote storage must surface, not silently fall back.
    throw new Error(result.error);
  }

  const safeExt = path.extname(input.fileName).toLowerCase().slice(0, 8) || ".bin";
  const name = `media-${randomUUID()}${safeExt}`;
  await fs.mkdir(UPLOADS_ROOT, { recursive: true });
  await fs.writeFile(path.join(UPLOADS_ROOT, name), input.buffer);
  return {
    provider: "local",
    remoteId: null,
    url: `/api/media/file/${name}`,
    fileName: input.fileName,
    mimeType: input.mimeType,
    sizeBytes: input.buffer.byteLength,
  };
}

/** Removes a stored file from whichever provider holds it. */
export async function removeStoredMedia(entry: {
  url?: string | null;
  remoteId?: string | null;
  provider?: string | null;
}): Promise<boolean> {
  if (entry.provider === "shopinex" && entry.remoteId) {
    const result = await deleteFromShopinex(entry.remoteId);
    return result.ok;
  }
  const url = entry.url ?? "";
  const prefix = ["/uploads/", "/api/media/file/"].find((value) => url.startsWith(value));
  if (!prefix) return false;
  const abs = path.resolve(UPLOADS_ROOT, url.slice(prefix.length));
  if (!abs.startsWith(`${UPLOADS_ROOT}${path.sep}`)) return false;
  try {
    await fs.unlink(abs);
    return true;
  } catch {
    return false;
  }
}

export function isLocalUploadUrl(url: string | null | undefined): boolean {
  return Boolean(url && (url.startsWith("/uploads/") || url.startsWith("/api/media/file/")));
}
