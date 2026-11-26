import { db } from "@/db";
import { follows, users } from "@/db/schema";
import { and, eq } from "drizzle-orm";
import { getCurrentUserId } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ handle: string }> }
) {
  const { handle } = await params;
  const viewerId = await getCurrentUserId();
  const [target] = await db
    .select()
    .from(users)
    .where(eq(users.handle, decodeURIComponent(handle)))
    .limit(1);
  if (!target) return Response.json({ error: "Not found" }, { status: 404 });
  if (target.id === viewerId) {
    return Response.json({ error: "You can't follow yourself" }, { status: 400 });
  }
  const where = and(eq(follows.followerId, viewerId), eq(follows.followingId, target.id));
  const existing = await db.select().from(follows).where(where).limit(1);
  let following: boolean;
  if (existing.length) {
    await db.delete(follows).where(where);
    following = false;
  } else {
    await db.insert(follows).values({ followerId: viewerId, followingId: target.id });
    following = true;
  }
  return Response.json({ following });
}