import { db } from "@/db";
import { likes, videos } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/data";

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
  const viewerId = await getCurrentUserId();
  const exists = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.status, "approved")))
    .limit(1);
  if (!exists.length) return Response.json({ error: "Not found" }, { status: 404 });

  const where = and(eq(likes.userId, viewerId), eq(likes.videoId, videoId));
  const existing = await db.select().from(likes).where(where).limit(1);
  let liked: boolean;
  if (existing.length) {
    await db.delete(likes).where(where);
    liked = false;
  } else {
    await db.insert(likes).values({ userId: viewerId, videoId });
    liked = true;
  }
  const [upd] = await db
    .update(videos)
    .set({ likesCount: sql`greatest(${videos.likesCount} + ${liked ? 1 : -1}, 0)` })
    .where(eq(videos.id, videoId))
    .returning({ likesCount: videos.likesCount });
  return Response.json({ liked, likesCount: upd?.likesCount ?? 0 });
}