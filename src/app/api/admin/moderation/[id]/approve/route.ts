import { eq } from "drizzle-orm";
import { db } from "@/db";
import { moderationLogs, videos } from "@/db/schema";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const now = new Date();
  const [updated] = await db
    .update(videos)
    .set({
      status: "approved",
      nextRecheckAt: null,
      moderatedAt: now,
      moderationReason: "Approved by moderator",
    })
    .where(eq(videos.id, videoId))
    .returning({ id: videos.id });
  if (!updated) return Response.json({ error: "Not found" }, { status: 404 });

  await db
    .update(moderationLogs)
    .set({ action: "approved", status: "approved", reviewedBy: "admin", reviewedAt: now })
    .where(eq(moderationLogs.videoId, videoId));

  return Response.json({ ok: true, status: "approved" });
}
