import { db } from "@/db";
import { videos } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";

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
  const [upd] = await db
    .update(videos)
    .set({ sharesCount: sql`${videos.sharesCount} + 1` })
    .where(and(eq(videos.id, videoId), eq(videos.status, "approved")))
    .returning({ sharesCount: videos.sharesCount });
  if (!upd) return Response.json({ error: "Not found" }, { status: 404 });
  return Response.json({ sharesCount: upd.sharesCount });
}