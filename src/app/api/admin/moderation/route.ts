import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { moderationLogs, reports, users, videos } from "@/db/schema";
import {
  ensureModerationSchedulerStarted,
  getModerationWorkerStatus,
} from "@/server/moderation/scheduler";

export const dynamic = "force-dynamic";

export async function GET() {
  ensureModerationSchedulerStarted();

  const [hiddenRecheck, manualReview, recentDeleted, recentReports] = await Promise.all([
    db
      .select({
        id: videos.id,
        status: videos.status,
        caption: videos.caption,
        coverUrl: videos.coverUrl,
        createdAt: videos.createdAt,
        recheckCount: videos.recheckCount,
        nextRecheckAt: videos.nextRecheckAt,
        reason: videos.moderationReason,
        handle: users.handle,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.status, "hidden_recheck"))
      .orderBy(desc(videos.createdAt))
      .limit(30),
    db
      .select({
        id: videos.id,
        status: videos.status,
        caption: videos.caption,
        videoUrl: videos.videoUrl,
        coverUrl: videos.coverUrl,
        createdAt: videos.createdAt,
        moderatedAt: videos.moderatedAt,
        recheckCount: videos.recheckCount,
        reason: videos.moderationReason,
        handle: users.handle,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.status, "manual_review"))
      .orderBy(desc(videos.createdAt))
      .limit(50),
    db
      .select({
        id: moderationLogs.id,
        action: moderationLogs.action,
        status: moderationLogs.status,
        authorHandle: moderationLogs.authorHandle,
        captionSnapshot: moderationLogs.captionSnapshot,
        reason: moderationLogs.reason,
        imageScore: moderationLogs.imageScore,
        textScore: moderationLogs.textScore,
        createdAt: moderationLogs.createdAt,
      })
      .from(moderationLogs)
      .where(inArray(moderationLogs.action, ["auto_deleted", "moderator_deleted", "user_deleted"]))
      .orderBy(desc(moderationLogs.createdAt))
      .limit(20),
    db
      .select({
        id: reports.id,
        videoId: reports.videoId,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt,
        reporterHandle: users.handle,
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .orderBy(desc(reports.createdAt))
      .limit(20),
  ]);

  return Response.json({
    worker: getModerationWorkerStatus(),
    hiddenRecheck,
    queue: manualReview,
    recentDeleted,
    recentReports,
  });
}
