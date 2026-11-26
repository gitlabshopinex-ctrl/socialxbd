import { promises as fs } from "node:fs";
import path from "node:path";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { mediaAssets, moderationLogs, users, videos } from "@/db/schema";
import { removeStoredMedia } from "@/server/media";
import { removeVideoMirror, syncModerationLogById } from "@/server/supabase-sync";

const UPLOADS_ROOT = path.resolve(process.cwd(), "public", "uploads");

/** Resolves a `/uploads/...` URL to an absolute path strictly within `public/uploads/`. */
const LOCAL_PREFIXES = ["/uploads/", "/api/media/file/"];

export function resolveLocalUploadPath(url: string | null | undefined): string | null {
  if (!url) return null;
  const prefix = LOCAL_PREFIXES.find((value) => url.startsWith(value));
  if (!prefix) return null;
  const relative = url.slice(prefix.length).split("?")[0].split("#")[0];
  if (!relative || relative.includes("\0")) return null;
  const resolved = path.resolve(UPLOADS_ROOT, relative);
  if (!resolved.startsWith(`${UPLOADS_ROOT}${path.sep}`)) return null;
  return resolved;
}

/** Extracts every local `/uploads/...` URL associated with a video/photo post record. */
export function collectLocalUploadUrls(record: {
  videoUrl?: string | null;
  coverUrl?: string | null;
  mediaUrls?: string | null;
}): string[] {
  const urls = new Set<string>();
  const isLocal = (value?: string | null) =>
    Boolean(value && LOCAL_PREFIXES.some((prefix) => value.startsWith(prefix)));
  if (isLocal(record.videoUrl) && record.videoUrl) urls.add(record.videoUrl);
  if (isLocal(record.coverUrl) && record.coverUrl) urls.add(record.coverUrl);
  if (record.mediaUrls) {
    try {
      const parsed = JSON.parse(record.mediaUrls);
      if (Array.isArray(parsed)) {
        for (const item of parsed) {
          const candidate =
            typeof item === "string"
              ? item
              : item && typeof item.url === "string"
                ? item.url
                : null;
          if (candidate && LOCAL_PREFIXES.some((prefix) => candidate.startsWith(prefix))) urls.add(candidate);
        }
      }
    } catch {
      /* ignore malformed JSON */
    }
  }
  return [...urls];
}

/** Deletes local media files strictly inside `public/uploads/`. Returns deleted public URLs. */
export async function deleteLocalUploadUrls(urls: string[]): Promise<string[]> {
  const deleted: string[] = [];
  for (const url of urls) {
    const absPath = resolveLocalUploadPath(url);
    if (!absPath) continue;
    try {
      await fs.unlink(absPath);
      deleted.push(url);
    } catch (err) {
      if ((err as NodeJS.ErrnoException)?.code !== "ENOENT") {
        console.error("[storage] failed to delete file:", absPath, err);
      }
    }
  }
  return deleted;
}

export type DeletionAudit = {
  action: "user_deleted" | "auto_deleted" | "moderator_deleted";
  status: string;
  reason: string;
  imageScore?: number | null;
  textScore?: number | null;
  imageVerdict?: string | null;
  textVerdict?: string | null;
  details?: unknown;
  reviewedBy?: string | null;
};

/**
 * Safely removes a post/video from PostgreSQL (cascading likes, saves, comments)
 * AND removes all associated media files from local storage (`public/uploads/`),
 * while writing a durable audit entry into `moderation_logs`.
 */
export async function permanentlyDeletePostAndStorage(
  videoId: number,
  audit: DeletionAudit
): Promise<{
  deleted: boolean;
  videoId: number;
  deletedFiles: string[];
  authorHandle?: string;
  caption?: string;
}> {
  const rows = await db
    .select({
      v: videos,
      handle: users.handle,
    })
    .from(videos)
    .innerJoin(users, eq(videos.userId, users.id))
    .where(eq(videos.id, videoId))
    .limit(1);

  const found = rows[0];
  if (!found) {
    return { deleted: false, videoId, deletedFiles: [] };
  }

  const localUrls = collectLocalUploadUrls({
    videoUrl: found.v.videoUrl,
    coverUrl: found.v.coverUrl,
    mediaUrls: found.v.mediaUrls,
  });

  const assets = await db.select().from(mediaAssets).where(eq(mediaAssets.videoId, videoId));

  // Delete from DB first so no visitor can read it even for a millisecond, then purge storage.
  await db.delete(videos).where(eq(videos.id, videoId));
  const deletedFiles = await deleteLocalUploadUrls(localUrls);

  // Purge Shopinex (or other remote) objects tracked for this post.
  await Promise.all(
    assets.map((asset) =>
      removeStoredMedia({
        url: asset.url,
        remoteId: asset.remoteId,
        provider: asset.provider,
      }).catch(() => false)
    )
  );
  // Cover/video uploaded directly with the post but not tracked as an asset row.
  await Promise.all(
    [
      { url: found.v.videoUrl, remoteId: found.v.mediaId, provider: found.v.storageProvider },
      { url: found.v.coverUrl, remoteId: found.v.coverMediaId, provider: found.v.storageProvider },
    ]
      .filter((entry) => entry.provider === "shopinex" && entry.remoteId)
      .map((entry) => removeStoredMedia(entry).catch(() => false))
  );
  await removeVideoMirror(videoId).catch(() => {});

  const now = new Date();
  const [auditLog] = await db
    .insert(moderationLogs)
    .values({
      videoId: null,
      action: audit.action,
      status: audit.status,
      authorHandle: found.handle,
      captionSnapshot: found.v.caption,
      imageScore: audit.imageScore != null ? String(audit.imageScore) : null,
      textScore: audit.textScore != null ? String(audit.textScore) : null,
      imageVerdict: audit.imageVerdict ?? null,
      textVerdict: audit.textVerdict ?? null,
      reason: audit.reason,
      details: audit.details
        ? JSON.stringify({
            ...(typeof audit.details === "object" ? audit.details : { note: audit.details }),
            deletedFiles,
            originalVideoId: videoId,
          })
        : JSON.stringify({ deletedFiles, originalVideoId: videoId }),
      reviewedBy: audit.reviewedBy ?? (audit.action === "auto_deleted" ? "ai-moderator" : null),
      reviewedAt: now,
    })
    .returning({ id: moderationLogs.id })
    .catch((err) => {
      console.error("[storage] failed to write deletion audit log:", err);
      return [];
    });
  if (auditLog?.id) await syncModerationLogById(auditLog.id).catch(() => {});

  return {
    deleted: true,
    videoId,
    deletedFiles,
    authorHandle: found.handle,
    caption: found.v.caption,
  };
}
