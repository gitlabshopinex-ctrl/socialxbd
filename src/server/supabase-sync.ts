import "server-only";
import { eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { comments, mediaAssets, moderationLogs, users, videos } from "@/db/schema";
import { getSupabaseAdmin, isSupabaseConfigured } from "@/server/supabase";

/**
 * Mirrors SocialX text data into Supabase (best-effort, never blocks a request).
 * Media binaries stay in Shopinex storage; only their URLs / ids are mirrored.
 */
async function mirror(
  table: string,
  rows: Record<string, unknown> | Record<string, unknown>[],
  onConflict?: string
): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    const payload = Array.isArray(rows) ? rows : [rows];
    if (payload.length === 0) return;
    const { error } = await client
      .from(table)
      .upsert(payload, onConflict ? { onConflict } : undefined);
    if (error) console.warn(`[supabase] upsert ${table} failed:`, error.message);
  } catch (error) {
    console.warn(`[supabase] upsert ${table} error:`, error);
  }
}

async function removeMirror(table: string, match: Record<string, unknown>): Promise<void> {
  const client = getSupabaseAdmin();
  if (!client) return;
  try {
    let query = client.from(table).delete();
    for (const [key, value] of Object.entries(match)) query = query.eq(key, value as never);
    const { error } = await query;
    if (error) console.warn(`[supabase] delete ${table} failed:`, error.message);
  } catch (error) {
    console.warn(`[supabase] delete ${table} error:`, error);
  }
}

function iso(value: Date | null | undefined): string | null {
  return value ? value.toISOString() : null;
}

export async function syncVideoById(videoId: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const [row] = await db
      .select({ v: videos, authorHandle: users.handle, authorName: users.name })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.id, videoId))
      .limit(1);
    if (!row) return;
    await mirror(
      "videos",
      {
        id: row.v.id,
        user_id: row.v.userId,
        author_handle: row.authorHandle,
        author_name: row.authorName,
        caption: row.v.caption,
        music_name: row.v.musicName,
        video_url: row.v.videoUrl,
        cover_url: row.v.coverUrl,
        media_urls: row.v.mediaUrls,
        media_id: row.v.mediaId,
        cover_media_id: row.v.coverMediaId,
        storage_provider: row.v.storageProvider,
        status: row.v.status,
        moderation_reason: row.v.moderationReason,
        views_count: row.v.viewsCount,
        likes_count: row.v.likesCount,
        comments_count: row.v.commentsCount,
        saves_count: row.v.savesCount,
        shares_count: row.v.sharesCount,
        created_at: iso(row.v.createdAt),
        moderated_at: iso(row.v.moderatedAt),
      },
      "id"
    );

    const mediaRows = await db.select().from(mediaAssets).where(eq(mediaAssets.videoId, videoId));
    if (mediaRows.length > 0) {
      await mirror(
        "media_assets",
        mediaRows.map((item) => ({
          id: item.id,
          provider: item.provider,
          remote_id: item.remoteId,
          url: item.url,
          file_name: item.fileName,
          mime_type: item.mimeType,
          kind: item.kind,
          size_bytes: item.sizeBytes,
          video_id: item.videoId,
          uploaded_by: item.uploadedBy,
          created_at: iso(item.createdAt),
        })),
        "id"
      );
    }
  } catch (error) {
    console.warn("[supabase] syncVideoById failed:", error);
  }
}

export async function removeVideoMirror(videoId: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  await removeMirror("videos", { id: videoId });
  await removeMirror("media_assets", { video_id: videoId });
}

export async function syncUserByHandle(handle: string): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const [row] = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
    if (!row) return;
    await mirror(
      "users",
      {
        id: row.id,
        handle: row.handle,
        name: row.name,
        avatar_url: row.avatarUrl,
        bio: row.bio,
        verified: row.verified,
        created_at: iso(row.createdAt),
      },
      "id"
    );
  } catch (error) {
    console.warn("[supabase] syncUserByHandle failed:", error);
  }
}

export async function syncCommentById(commentId: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const [row] = await db.select().from(comments).where(eq(comments.id, commentId)).limit(1);
    if (!row) return;
    await mirror(
      "comments",
      {
        id: row.id,
        video_id: row.videoId,
        user_id: row.userId,
        text: row.text,
        likes_count: row.likesCount,
        created_at: iso(row.createdAt),
      },
      "id"
    );
  } catch (error) {
    console.warn("[supabase] syncCommentById failed:", error);
  }
}

export async function syncModerationLogById(logId: number): Promise<void> {
  if (!isSupabaseConfigured()) return;
  try {
    const [row] = await db.select().from(moderationLogs).where(eq(moderationLogs.id, logId)).limit(1);
    if (!row) return;
    await mirror(
      "moderation_logs",
      {
        id: row.id,
        video_id: row.videoId,
        action: row.action,
        status: row.status,
        author_handle: row.authorHandle,
        caption_snapshot: row.captionSnapshot,
        image_score: row.imageScore,
        text_score: row.textScore,
        image_verdict: row.imageVerdict,
        text_verdict: row.textVerdict,
        reason: row.reason,
        details: row.details,
        created_at: iso(row.createdAt),
        reviewed_by: row.reviewedBy,
        reviewed_at: iso(row.reviewedAt),
      },
      "id"
    );
  } catch (error) {
    console.warn("[supabase] syncModerationLogById failed:", error);
  }
}

/** One-shot backfill of the current social text data into Supabase. */
export async function backfillSupabase(): Promise<{ ok: boolean; message: string }> {
  if (!isSupabaseConfigured()) {
    return { ok: false, message: "Supabase is not configured" };
  }
  try {
    const userRows = await db.select().from(users);
    await mirror(
      "users",
      userRows.map((row) => ({
        id: row.id,
        handle: row.handle,
        name: row.name,
        avatar_url: row.avatarUrl,
        bio: row.bio,
        verified: row.verified,
        created_at: iso(row.createdAt),
      })),
      "id"
    );

    const videoRows = await db
      .select({ v: videos, handle: users.handle, name: users.name })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id));
    await mirror(
      "videos",
      videoRows.map(({ v, handle, name }) => ({
        id: v.id,
        user_id: v.userId,
        author_handle: handle,
        author_name: name,
        caption: v.caption,
        music_name: v.musicName,
        video_url: v.videoUrl,
        cover_url: v.coverUrl,
        media_urls: v.mediaUrls,
        media_id: v.mediaId,
        cover_media_id: v.coverMediaId,
        storage_provider: v.storageProvider,
        status: v.status,
        moderation_reason: v.moderationReason,
        views_count: v.viewsCount,
        likes_count: v.likesCount,
        comments_count: v.commentsCount,
        saves_count: v.savesCount,
        shares_count: v.sharesCount,
        created_at: iso(v.createdAt),
        moderated_at: iso(v.moderatedAt),
      })),
      "id"
    );

    const commentRows = await db.select().from(comments);
    if (commentRows.length > 0) {
      await mirror(
        "comments",
        commentRows.map((row) => ({
          id: row.id,
          video_id: row.videoId,
          user_id: row.userId,
          text: row.text,
          likes_count: row.likesCount,
          created_at: iso(row.createdAt),
        })),
        "id"
      );
    }

    const mediaRows = await db.select().from(mediaAssets);
    if (mediaRows.length > 0) {
      await mirror(
        "media_assets",
        mediaRows.map((item) => ({
          id: item.id,
          provider: item.provider,
          remote_id: item.remoteId,
          url: item.url,
          file_name: item.fileName,
          mime_type: item.mimeType,
          kind: item.kind,
          size_bytes: item.sizeBytes,
          video_id: item.videoId,
          uploaded_by: item.uploadedBy,
          created_at: iso(item.createdAt),
        })),
        "id"
      );
    }

    return {
      ok: true,
      message: `Mirrored ${userRows.length} users, ${videoRows.length} videos, ${commentRows.length} comments`,
    };
  } catch (error) {
    return { ok: false, message: error instanceof Error ? error.message : "Backfill failed" };
  }
}

/** Utility used by tests/diagnostics. */
export async function videoMirrorIds(ids: number[]): Promise<number> {
  if (!isSupabaseConfigured() || ids.length === 0) return 0;
  try {
    const rows = await db.select({ id: videos.id }).from(videos).where(inArray(videos.id, ids));
    for (const row of rows) await syncVideoById(row.id);
    return rows.length;
  } catch {
    return 0;
  }
}
