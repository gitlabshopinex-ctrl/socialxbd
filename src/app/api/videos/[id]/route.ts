import { eq } from "drizzle-orm";
import { db } from "@/db";
import { moderationLogs, users, videos } from "@/db/schema";
import { getCurrentUserId, getVideoById, getVideoViewerData } from "@/lib/data";
import { runModeration } from "@/server/moderation";
import { scheduleFastRecheck } from "@/server/moderation/scheduler";
import { syncVideoById } from "@/server/supabase-sync";
import {
  permanentlyDeletePostAndStorage,
  resolveLocalUploadPath,
} from "@/server/storage";

export const dynamic = "force-dynamic";

export async function GET(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const viewerId = await getCurrentUserId();
  const data = await getVideoViewerData(videoId, viewerId);
  if (!data) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json(data);
}

export async function PATCH(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const viewerId = await getCurrentUserId();
  const [existing] = await db
    .select({ v: videos, handle: users.handle })
    .from(videos)
    .innerJoin(users, eq(videos.userId, users.id))
    .where(eq(videos.id, videoId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }
  if (existing.v.userId !== viewerId) {
    return Response.json({ error: "You can only edit your own post" }, { status: 403 });
  }

  const body = (await req.json().catch(() => null)) as {
    caption?: string;
    musicName?: string;
  } | null;

  const caption =
    typeof body?.caption === "string"
      ? body.caption.trim().slice(0, 300)
      : existing.v.caption;
  const musicName =
    typeof body?.musicName === "string"
      ? body.musicName.trim().slice(0, 120) || "original sound"
      : existing.v.musicName;

  // Re-moderate edited text + existing media via server-side open-source AI
  const localVideo = resolveLocalUploadPath(existing.v.videoUrl);
  const localImages: string[] = [];
  if (existing.v.mediaUrls) {
    try {
      const parsed = JSON.parse(existing.v.mediaUrls);
      if (Array.isArray(parsed)) {
        for (const entry of parsed) {
          const url = typeof entry === "string" ? entry : entry?.url;
          const local = resolveLocalUploadPath(url);
          if (local) localImages.push(local);
        }
      }
    } catch {
      /* ignore */
    }
  }

  const modResult = await runModeration({
    caption,
    musicName,
    coverUrl: existing.v.coverUrl,
    videoFilePath: localVideo,
    imageFilePaths: localImages.length > 0 ? localImages : undefined,
    deep: false,
  });

  const now = new Date();

  if (modResult.verdict === "rejected") {
    await permanentlyDeletePostAndStorage(videoId, {
      action: "auto_deleted",
      status: "auto_deleted",
      reason: modResult.reason,
      imageScore: modResult.details.imageScore,
      textScore: modResult.details.textScore,
      imageVerdict: modResult.details.imageVerdict,
      textVerdict: modResult.details.textVerdict,
      details: { ...modResult.details, stage: "edit" },
      reviewedBy: "ai-moderator",
    });
    return Response.json(
      {
        error: modResult.reason,
        deleted: true,
        deletedId: videoId,
        moderation: {
          status: "auto_deleted",
          reason: modResult.reason,
        },
      },
      { status: 422 }
    );
  }

  if (modResult.verdict === "hidden_recheck") {
    await db
      .update(videos)
      .set({
        caption,
        musicName,
        status: "hidden_recheck",
        recheckCount: 0,
        nextRecheckAt: new Date(Date.now() + 2500),
        moderatedAt: now,
        moderationReason: modResult.reason,
      })
      .where(eq(videos.id, videoId));

    await db
      .insert(moderationLogs)
      .values({
        videoId,
        action: "hidden_recheck",
        status: "hidden_recheck",
        authorHandle: existing.handle,
        captionSnapshot: caption,
        imageScore: modResult.details.imageScore != null ? String(modResult.details.imageScore) : null,
        textScore: modResult.details.textScore != null ? String(modResult.details.textScore) : null,
        imageVerdict: modResult.details.imageVerdict,
        textVerdict: modResult.details.textVerdict,
        reason: modResult.reason,
        details: JSON.stringify({ ...modResult.details, stage: "edit" }),
      })
      .catch(() => {});

    scheduleFastRecheck(videoId, 2500);

    return Response.json(
      {
        hidden: true,
        videoId,
        moderation: {
          status: "hidden_recheck",
          reason: modResult.reason,
        },
      },
      { status: 202 }
    );
  }

  await db
    .update(videos)
    .set({
      caption,
      musicName,
      status: "approved",
      moderatedAt: now,
      nextRecheckAt: null,
      moderationReason: modResult.reason,
    })
    .where(eq(videos.id, videoId));

  void syncVideoById(videoId);
  const updated = await getVideoById(videoId, viewerId);
  return Response.json({
    video: updated,
    moderation: {
      status: "approved",
      reason: modResult.reason,
    },
  });
}

export async function DELETE(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const viewerId = await getCurrentUserId();
  const [existing] = await db
    .select({ id: videos.id, userId: videos.userId, handle: users.handle })
    .from(videos)
    .innerJoin(users, eq(videos.userId, users.id))
    .where(eq(videos.id, videoId))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Post not found" }, { status: 404 });
  }
  if (existing.userId !== viewerId) {
    return Response.json({ error: "You can only delete your own post" }, { status: 403 });
  }

  const deleted = await permanentlyDeletePostAndStorage(videoId, {
    action: "user_deleted",
    status: "user_deleted",
    reason: "Deleted by creator",
    reviewedBy: existing.handle,
  });

  return Response.json({
    ok: true,
    deletedId: videoId,
    deletedFiles: deleted.deletedFiles,
  });
}
