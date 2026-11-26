import "server-only";

/**
 * Shopinex Media API — server-only integration.
 * Credentials are read from server env and are NEVER sent to the browser bundle.
 *
 *   SHOPINEX_SITE_ID   (or SOCIAL_SITE_ID)
 *   SHOPINEX_API_KEY   (or SOCIAL_MEDIA_API_KEY)
 */
const API_BASE = "https://www.shopinexbd.com/api/media";
export const SHOPINEX_MAX_BYTES = 200 * 1024 * 1024; // 200 MB

export type ShopinexItem = {
  id: string;
  url: string;
  fileName?: string;
  mimeType?: string;
  sizeBytes?: number;
  kind?: "image" | "video";
  createdAt?: string;
};

function credentials(): { siteId: string; apiKey: string } | null {
  const siteId = (process.env.SHOPINEX_SITE_ID ?? process.env.SOCIAL_SITE_ID ?? "").trim();
  const apiKey = (process.env.SHOPINEX_API_KEY ?? process.env.SOCIAL_MEDIA_API_KEY ?? "").trim();
  if (!siteId || !apiKey) return null;
  return { siteId, apiKey };
}

export function isShopinexConfigured(): boolean {
  return credentials() !== null;
}

function headers(): Record<string, string> {
  const creds = credentials();
  if (!creds) throw new Error("Shopinex media credentials are not configured");
  return { "x-site-id": creds.siteId, "x-api-key": creds.apiKey };
}

/** Recursively finds the first string value for any of the given keys. */
function findString(input: unknown, keys: string[], depth = 0): string | null {
  if (depth > 4 || input == null) return null;
  if (Array.isArray(input)) {
    for (const item of input) {
      const found = findString(item, keys, depth + 1);
      if (found) return found;
    }
    return null;
  }
  if (typeof input !== "object") return null;
  const record = input as Record<string, unknown>;
  for (const key of keys) {
    const value = record[key];
    if (typeof value === "string" && value.trim()) return value.trim();
    if (typeof value === "number") return String(value);
  }
  for (const value of Object.values(record)) {
    const found = findString(value, keys, depth + 1);
    if (found) return found;
  }
  return null;
}

function normalizeItem(raw: unknown, fallback?: Partial<ShopinexItem>): ShopinexItem | null {
  const url = findString(raw, ["url", "mediaUrl", "media_url", "fileUrl", "file_url", "publicUrl", "public_url", "downloadUrl", "src", "path"]);
  const id = findString(raw, ["id", "_id", "mediaId", "media_id", "itemId", "item_id", "fileId", "file_id"]);
  if (!url) return null;
  const mime = findString(raw, ["mimeType", "mime_type", "type", "contentType", "content_type"]) ?? fallback?.mimeType;
  return {
    id: id ?? fallback?.id ?? "",
    url,
    fileName: findString(raw, ["fileName", "file_name", "name", "originalName", "filename"]) ?? fallback?.fileName,
    mimeType: mime ?? undefined,
    sizeBytes: Number(findString(raw, ["size", "sizeBytes", "size_bytes", "bytes"]) ?? 0) || fallback?.sizeBytes,
    kind: (mime ?? "").startsWith("video/") || /\.(mp4|webm|mov|m4v)(\?|$)/i.test(url) ? "video" : "image",
    createdAt: findString(raw, ["createdAt", "created_at", "uploadedAt", "uploaded_at"]) ?? undefined,
  };
}

export type UploadResult =
  | { ok: true; item: ShopinexItem }
  | { ok: false; error: string; status?: number };

/** Uploads one file (multipart/form-data, form field `file`) to Shopinex. */
export async function uploadToShopinex(
  file: { buffer: Buffer; fileName: string; mimeType: string }
): Promise<UploadResult> {
  if (!isShopinexConfigured()) return { ok: false, error: "Media storage is not configured", status: 503 };
  if (file.buffer.byteLength > SHOPINEX_MAX_BYTES) {
    return { ok: false, error: "File exceeds the 200 MB upload limit", status: 413 };
  }
  if (file.buffer.byteLength === 0) return { ok: false, error: "Empty file", status: 400 };

  const form = new FormData();
  const bytes = new Uint8Array(file.buffer);
  form.append("file", new Blob([bytes], { type: file.mimeType || "application/octet-stream" }), file.fileName);

  try {
    const response = await fetch(API_BASE, {
      method: "POST",
      headers: headers(),
      body: form,
      signal: AbortSignal.timeout(120_000),
    });
    const text = await response.text();
    let payload: unknown = null;
    try {
      payload = text ? JSON.parse(text) : null;
    } catch {
      payload = null;
    }
    if (!response.ok) {
      const message =
        findString(payload, ["message", "error", "detail"]) ?? `Upload failed (${response.status})`;
      return { ok: false, error: message, status: response.status };
    }
    const item = normalizeItem(payload, {
      fileName: file.fileName,
      mimeType: file.mimeType,
      sizeBytes: file.buffer.byteLength,
    });
    if (!item) return { ok: false, error: "Storage did not return a media URL", status: 502 };
    return { ok: true, item };
  } catch (error) {
    return {
      ok: false,
      error: error instanceof Error ? error.message : "Upload request failed",
      status: 502,
    };
  }
}

export async function listShopinexMedia(): Promise<
  { ok: true; items: ShopinexItem[] } | { ok: false; error: string }
> {
  if (!isShopinexConfigured()) return { ok: false, error: "Media storage is not configured" };
  try {
    const response = await fetch(API_BASE, { headers: headers(), cache: "no-store", signal: AbortSignal.timeout(20_000) });
    if (!response.ok) return { ok: false, error: `Listing failed (${response.status})` };
    const payload: unknown = await response.json().catch(() => null);
    const candidates = Array.isArray(payload)
      ? payload
      : ((payload as { data?: unknown; items?: unknown; files?: unknown; media?: unknown })?.data ??
          (payload as { items?: unknown })?.items ??
          (payload as { files?: unknown })?.files ??
          (payload as { media?: unknown })?.media ??
          []);
    const list = Array.isArray(candidates) ? candidates : [];
    const items = list.map((entry) => normalizeItem(entry)).filter((entry): entry is ShopinexItem => Boolean(entry));
    return { ok: true, items };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Listing failed" };
  }
}

/** Streams a stored file back through the server so the API key is never exposed. */
export async function downloadFromShopinex(
  itemId: string
): Promise<{ ok: true; response: Response } | { ok: false; error: string; status?: number }> {
  if (!isShopinexConfigured()) return { ok: false, error: "Media storage is not configured", status: 503 };
  try {
    const response = await fetch(`${API_BASE}?download=${encodeURIComponent(itemId)}`, {
      headers: headers(),
      signal: AbortSignal.timeout(60_000),
    });
    if (!response.ok || !response.body) {
      return { ok: false, error: `Download failed (${response.status})`, status: response.status };
    }
    return { ok: true, response };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Download failed", status: 502 };
  }
}

export async function deleteFromShopinex(
  itemId: string
): Promise<{ ok: true } | { ok: false; error: string; status?: number }> {
  if (!isShopinexConfigured()) return { ok: false, error: "Media storage is not configured", status: 503 };
  try {
    const response = await fetch(`${API_BASE}?id=${encodeURIComponent(itemId)}`, {
      method: "DELETE",
      headers: headers(),
      signal: AbortSignal.timeout(30_000),
    });
    if (!response.ok) {
      return { ok: false, error: `Delete failed (${response.status})`, status: response.status };
    }
    return { ok: true };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : "Delete failed", status: 502 };
  }
}
