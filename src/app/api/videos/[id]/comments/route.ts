import { db } from "@/db";
import { comments, users, videos } from "@/db/schema";
import { and, eq, sql } from "drizzle-orm";
import { getCurrentUserId, getComments, toAuthor } from "@/lib/data";
import { syncCommentById } from "@/server/supabase-sync";

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
  const items = await getComments(videoId);
  return Response.json({ comments: items });
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }
  const body = (await req.json().catch(() => null)) as { text?: string } | null;
  const text = (body?.text ?? "").trim();
  if (!text || text.length > 300) {
    return Response.json({ error: "Comment must be 1–300 characters" }, { status: 400 });
  }
  const [approvedVideo] = await db
    .select({ id: videos.id })
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.status, "approved")))
    .limit(1);
  if (!approvedVideo) return Response.json({ error: "Not found" }, { status: 404 });

  const viewerId = await getCurrentUserId();
  const [row] = await db
    .insert(comments)
    .values({ videoId, userId: viewerId, text })
    .returning();
  if (!row) return Response.json({ error: "Not found" }, { status: 404 });
  const [upd] = await db
    .update(videos)
    .set({ commentsCount: sql`${videos.commentsCount} + 1` })
    .where(eq(videos.id, videoId))
    .returning({ commentsCount: videos.commentsCount });
  void syncCommentById(row.id);
  const [u] = await db.select().from(users).where(eq(users.id, viewerId)).limit(1);
  return Response.json(
    {
      comment: {
        id: row.id,
        text: row.text,
        likesCount: row.likesCount,
        createdAt: row.createdAt.toISOString(),
        author: toAuthor(u),
      },
      commentsCount: upd?.commentsCount ?? 0,
    },
    { status: 201 }
  );
}