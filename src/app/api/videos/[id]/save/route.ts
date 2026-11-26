import { db } from "@/db";
import { saves, videos } from "@/db/schema";
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

  const where = and(eq(saves.userId, viewerId), eq(saves.videoId, videoId));
  const existing = await db.select().from(saves).where(where).limit(1);
  let saved: boolean;
  if (existing.length) {
    await db.delete(saves).where(where);
    saved = false;
  } else {
    await db.insert(saves).values({ userId: viewerId, videoId });
    saved = true;
  }
  const [upd] = await db
    .update(videos)
    .set({ savesCount: sql`greatest(${videos.savesCount} + ${saved ? 1 : -1}, 0)` })
    .where(eq(videos.id, videoId))
    .returning({ savesCount: videos.savesCount });
  return Response.json({ saved, savesCount: upd?.savesCount ?? 0 });
}