import { cookies } from "next/headers";
import { db } from "@/db";
import { users, videos, likes, saves, follows, comments } from "@/db/schema";
import { and, desc, eq, ilike, inArray, ne, notInArray, or, sql } from "drizzle-orm";
import type {
  ActivityItem,
  Author,
  CommentItem,
  FeedVideo,
  ProfileData,
  SearchUser,
} from "@/lib/types";

export const CURRENT_USER_HANDLE = "alex.rivera";

type UserRow = typeof users.$inferSelect;
type VideoRow = typeof videos.$inferSelect;
type JoinedRow = { v: VideoRow; u: UserRow };

export function toAuthor(u: UserRow): Author {
  return {
    id: u.id,
    handle: u.handle,
    name: u.name,
    avatarUrl: u.avatarUrl,
    verified: u.verified,
  };
}

/**
 * Resolves the signed-in handle from the `sx_handle` cookie (set when the
 * username changes), falling back to the seeded default handle.
 */
export async function getCurrentHandle(): Promise<string> {
  try {
    const store = await cookies();

    // 1. Preferred: stable user id cookie — survives username changes.
    const uidRaw = store.get("sx_uid")?.value ?? "";
    const uid = Number(uidRaw);
    if (Number.isInteger(uid) && uid > 0) {
      const rows = await db
        .select({ handle: users.handle })
        .from(users)
        .where(eq(users.id, uid))
        .limit(1);
      if (rows[0]) return rows[0].handle;
    }

    // 2. Legacy: handle cookie set by an older session.
    const raw = store.get("sx_handle")?.value ?? "";
    const candidate = decodeURIComponent(raw);
    if (candidate && /^[a-z0-9._]{3,24}$/.test(candidate)) {
      const rows = await db
        .select({ id: users.id })
        .from(users)
        .where(eq(users.handle, candidate))
        .limit(1);
      if (rows[0]) return candidate;
    }
  } catch {
    /* cookies unavailable in this context */
  }

  // 3. Seeded default handle, if it still exists.
  const seeded = await db
    .select({ handle: users.handle })
    .from(users)
    .where(eq(users.handle, CURRENT_USER_HANDLE))
    .limit(1);
  if (seeded[0]) return seeded[0].handle;

  // 4. Last resort: the first account (the demo user), whose username may have changed.
  const first = await db
    .select({ handle: users.handle, id: users.id })
    .from(users)
    .orderBy(users.id)
    .limit(1);
  return first[0]?.handle ?? CURRENT_USER_HANDLE;
}

/** Numeric id of the signed-in user (used for the stable `sx_uid` cookie). */
export async function getCurrentUserIdentity(): Promise<{ id: number; handle: string }> {
  const handle = await getCurrentHandle();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);
  return { id: rows[0]?.id ?? 1, handle };
}

export async function getCurrentUserId(): Promise<number> {
  const handle = await getCurrentHandle();
  const rows = await db
    .select({ id: users.id })
    .from(users)
    .where(eq(users.handle, handle))
    .limit(1);
  return rows[0]?.id ?? 1;
}

async function serialize(rows: JoinedRow[], viewerId: number): Promise<FeedVideo[]> {
  if (rows.length === 0) return [];
  const ids = rows.map((r) => r.v.id);
  const authorIds = [...new Set(rows.map((r) => r.u.id))];
  const [likedRows, savedRows, followRows] = await Promise.all([
    db
      .select({ videoId: likes.videoId })
      .from(likes)
      .where(and(eq(likes.userId, viewerId), inArray(likes.videoId, ids))),
    db
      .select({ videoId: saves.videoId })
      .from(saves)
      .where(and(eq(saves.userId, viewerId), inArray(saves.videoId, ids))),
    db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(
        and(eq(follows.followerId, viewerId), inArray(follows.followingId, authorIds))
      ),
  ]);
  const liked = new Set(likedRows.map((r) => r.videoId));
  const saved = new Set(savedRows.map((r) => r.videoId));
  const followed = new Set(followRows.map((r) => r.followingId));
  return rows.map(({ v, u }) => {
    let parsedImages: { url: string; alt?: string }[] | undefined;
    if (v.mediaUrls) {
      try {
        const raw = JSON.parse(v.mediaUrls);
        if (Array.isArray(raw)) {
          parsedImages = raw
            .map((entry) =>
              typeof entry === "string"
                ? { url: entry }
                : entry && typeof entry.url === "string"
                  ? { url: entry.url, alt: typeof entry.alt === "string" ? entry.alt : undefined }
                  : null
            )
            .filter((entry): entry is { url: string; alt?: string } => Boolean(entry));
        }
      } catch {
        parsedImages = undefined;
      }
    }
    return {
      id: v.id,
      caption: v.caption,
      musicName: v.musicName,
      videoUrl: v.videoUrl,
      coverUrl: v.coverUrl,
      viewsCount: v.viewsCount,
      likesCount: v.likesCount,
      commentsCount: v.commentsCount,
      savesCount: v.savesCount,
      sharesCount: v.sharesCount,
      createdAt: v.createdAt.toISOString(),
      viewerLiked: liked.has(v.id),
      viewerSaved: saved.has(v.id),
      viewerFollowsAuthor: followed.has(u.id),
      status: v.status,
      moderationReason: v.moderationReason,
      ...(parsedImages && parsedImages.length > 0 ? { images: parsedImages } : {}),
      author: toAuthor(u),
    };
  });
}

function baseVideoQuery() {
  return db
    .select({ v: videos, u: users })
    .from(videos)
    .innerJoin(users, eq(videos.userId, users.id));
}

export async function getFeed(
  tab: "foryou" | "following",
  viewerId: number
): Promise<FeedVideo[]> {
  const rows =
    tab === "following"
      ? await baseVideoQuery()
          .where(
            and(
              eq(videos.status, "approved"),
              inArray(
                videos.userId,
                db
                  .select({ id: follows.followingId })
                  .from(follows)
                  .where(eq(follows.followerId, viewerId))
              )
            )
          )
          .orderBy(desc(videos.createdAt), desc(videos.id))
      : await baseVideoQuery()
          .where(eq(videos.status, "approved"))
          .orderBy(desc(videos.createdAt), desc(videos.id));
  return serialize(rows, viewerId);
}

export async function getVideoById(
  id: number,
  viewerId: number
): Promise<FeedVideo | null> {
  const rows = await baseVideoQuery()
    .where(and(eq(videos.id, id), eq(videos.status, "approved")))
    .limit(1);
  const out = await serialize(rows, viewerId);
  return out[0] ?? null;
}

export async function getVideoViewerData(
  id: number,
  viewerId: number,
  groupIds?: number[]
): Promise<{ video: FeedVideo; relatedVideos: FeedVideo[] } | null> {
  const rows = await baseVideoQuery()
    .where(and(eq(videos.id, id), eq(videos.status, "approved")))
    .limit(1);
  if (!rows[0]) return null;
  const authorId = rows[0].u.id;
  const siblingRows = await baseVideoQuery()
    .where(and(eq(videos.userId, authorId), eq(videos.status, "approved")))
    .orderBy(desc(videos.createdAt), desc(videos.id))
    .limit(8);

  const allSerialized = await serialize(siblingRows, viewerId);
  const target =
    allSerialized.find((item) => item.id === id) ??
    (await serialize(rows, viewerId))[0];
  if (!target) return null;

  if (groupIds && groupIds.length > 1) {
    const byId = new Map(allSerialized.map((item) => [item.id, item]));
    const matched = groupIds
      .map((gid) => byId.get(gid))
      .filter((item): item is FeedVideo => Boolean(item));
    if (matched.some((item) => item.id === id) && matched.length > 1) {
      return { video: target, relatedVideos: matched };
    }
  }

  const withCover = allSerialized.filter((item) => !!item.coverUrl || item.id === id);
  let relatedVideos = withCover.slice(0, 2);
  if (relatedVideos.length > 0 && !relatedVideos.some((item) => item.id === id)) {
    relatedVideos = [relatedVideos[0], target];
  }

  return {
    video: target,
    relatedVideos: relatedVideos.length > 0 ? relatedVideos : [target],
  };
}

export async function getProfile(
  handle: string,
  viewerId: number
): Promise<ProfileData | null> {
  const urows = await db.select().from(users).where(eq(users.handle, handle)).limit(1);
  const u = urows[0];
  if (!u) return null;
  const isSelf = u.id === viewerId;
  const [
    videoRows,
    likedRows,
    savedRows,
    reviewRows,
    followingRows,
    followerRows,
    likesRows,
    viewerFollowRows,
  ] = await Promise.all([
    baseVideoQuery()
      .where(and(eq(videos.userId, u.id), eq(videos.status, "approved")))
      .orderBy(desc(videos.createdAt), desc(videos.id)),
    isSelf
      ? db
          .select({ v: videos, u: users })
          .from(likes)
          .innerJoin(videos, eq(likes.videoId, videos.id))
          .innerJoin(users, eq(videos.userId, users.id))
          .where(and(eq(likes.userId, u.id), eq(videos.status, "approved")))
          .orderBy(desc(likes.createdAt))
      : Promise.resolve([]),
    isSelf
      ? db
          .select({ v: videos, u: users })
          .from(saves)
          .innerJoin(videos, eq(saves.videoId, videos.id))
          .innerJoin(users, eq(videos.userId, users.id))
          .where(and(eq(saves.userId, u.id), eq(videos.status, "approved")))
          .orderBy(desc(saves.createdAt))
      : Promise.resolve([]),
    isSelf
      ? baseVideoQuery()
          .where(
            and(
              eq(videos.userId, u.id),
              inArray(videos.status, ["hidden_recheck", "manual_review"])
            )
          )
          .orderBy(desc(videos.createdAt), desc(videos.id))
      : Promise.resolve([]),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followerId, u.id)),
    db
      .select({ n: sql<number>`count(*)::int` })
      .from(follows)
      .where(eq(follows.followingId, u.id)),
    db
      .select({ n: sql<number>`coalesce(sum(${videos.likesCount}), 0)::int` })
      .from(videos)
      .where(and(eq(videos.userId, u.id), eq(videos.status, "approved"))),
    db
      .select({ followingId: follows.followingId })
      .from(follows)
      .where(and(eq(follows.followerId, viewerId), eq(follows.followingId, u.id)))
      .limit(1),
  ]);
  return {
    user: { ...toAuthor(u), bio: u.bio },
    isSelf,
    viewerFollows: viewerFollowRows.length > 0,
    followingCount: followingRows[0]?.n ?? 0,
    followersCount: followerRows[0]?.n ?? 0,
    likesReceived: likesRows[0]?.n ?? 0,
    videos: await serialize(videoRows, viewerId),
    likedVideos: isSelf ? await serialize(likedRows, viewerId) : [],
    savedVideos: isSelf ? await serialize(savedRows, viewerId) : [],
    reviewVideos: isSelf ? await serialize(reviewRows, viewerId) : [],
  };
}

export async function getComments(videoId: number): Promise<CommentItem[]> {
  const rows = await db
    .select({ c: comments, u: users })
    .from(comments)
    .innerJoin(users, eq(comments.userId, users.id))
    .where(eq(comments.videoId, videoId))
    .orderBy(desc(comments.createdAt))
    .limit(200);
  return rows.map(({ c, u }) => ({
    id: c.id,
    text: c.text,
    likesCount: c.likesCount,
    createdAt: c.createdAt.toISOString(),
    author: toAuthor(u),
  }));
}

export async function searchAll(
  q: string,
  viewerId: number
): Promise<{ videos: FeedVideo[]; users: SearchUser[] }> {
  const like = `%${q}%`;
  const [videoRows, userRows] = await Promise.all([
    baseVideoQuery()
      .where(
        and(
          eq(videos.status, "approved"),
          or(
            ilike(videos.caption, like),
          ilike(videos.musicName, like),
            ilike(users.name, like),
            ilike(users.handle, like)
          )
        )
      )
      .orderBy(desc(videos.likesCount))
      .limit(30),
    db
      .select()
      .from(users)
      .where(or(ilike(users.handle, like), ilike(users.name, like)))
      .limit(12),
  ]);
  const ids = userRows.map((u) => u.id);
  const [countRows, followRows] = await Promise.all([
    ids.length
      ? db
          .select({ id: follows.followingId, n: sql<number>`count(*)::int` })
          .from(follows)
          .where(inArray(follows.followingId, ids))
          .groupBy(follows.followingId)
      : Promise.resolve([] as { id: number; n: number }[]),
    ids.length
      ? db
          .select({ followingId: follows.followingId })
          .from(follows)
          .where(and(eq(follows.followerId, viewerId), inArray(follows.followingId, ids)))
      : Promise.resolve([] as { followingId: number }[]),
  ]);
  const counts = new Map(countRows.map((r) => [r.id, r.n]));
  const followed = new Set(followRows.map((r) => r.followingId));
  return {
    videos: await serialize(videoRows, viewerId),
    users: userRows.map((u) => ({
      ...toAuthor(u),
      followersCount: counts.get(u.id) ?? 0,
      viewerFollows: followed.has(u.id),
    })),
  };
}

export async function getActivity(viewerId: number): Promise<ActivityItem[]> {
  const [likeRows, commentRows, followRows] = await Promise.all([
    db
      .select({
        createdAt: likes.createdAt,
        actor: users,
        videoId: videos.id,
        coverUrl: videos.coverUrl,
        caption: videos.caption,
        actorId: likes.userId,
      })
      .from(likes)
      .innerJoin(videos, eq(likes.videoId, videos.id))
      .innerJoin(users, eq(likes.userId, users.id))
      .where(
        and(
          eq(videos.userId, viewerId),
          eq(videos.status, "approved"),
          ne(likes.userId, viewerId)
        )
      ),
    db
      .select({
        createdAt: comments.createdAt,
        actor: users,
        videoId: videos.id,
        coverUrl: videos.coverUrl,
        caption: videos.caption,
        text: comments.text,
        commentId: comments.id,
      })
      .from(comments)
      .innerJoin(videos, eq(comments.videoId, videos.id))
      .innerJoin(users, eq(comments.userId, users.id))
      .where(
        and(
          eq(videos.userId, viewerId),
          eq(videos.status, "approved"),
          ne(comments.userId, viewerId)
        )
      ),
    db
      .select({ createdAt: follows.createdAt, actor: users, actorId: follows.followerId })
      .from(follows)
      .innerJoin(users, eq(follows.followerId, users.id))
      .where(eq(follows.followingId, viewerId)),
  ]);
  const items: ActivityItem[] = [
    ...likeRows.map((r) => ({
      key: `like-${r.actorId}-${r.videoId}`,
      type: "like" as const,
      createdAt: r.createdAt.toISOString(),
      actor: toAuthor(r.actor),
      video: { id: r.videoId, coverUrl: r.coverUrl, caption: r.caption },
    })),
    ...commentRows.map((r) => ({
      key: `comment-${r.commentId}`,
      type: "comment" as const,
      createdAt: r.createdAt.toISOString(),
      actor: toAuthor(r.actor),
      text: r.text,
      video: { id: r.videoId, coverUrl: r.coverUrl, caption: r.caption },
    })),
    ...followRows.map((r) => ({
      key: `follow-${r.actorId}`,
      type: "follow" as const,
      createdAt: r.createdAt.toISOString(),
      actor: toAuthor(r.actor),
    })),
  ];
  items.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return items.slice(0, 50);
}

export async function getSuggestions(
  viewerId: number
): Promise<{ following: Author[]; suggested: Author[] }> {
  const followingRows = await db
    .select({ u: users })
    .from(follows)
    .innerJoin(users, eq(follows.followingId, users.id))
    .where(eq(follows.followerId, viewerId))
    .orderBy(desc(follows.createdAt))
    .limit(5);
  const suggestedRows = await db
    .select()
    .from(users)
    .where(
      and(
        ne(users.id, viewerId),
        notInArray(
          users.id,
          db
            .select({ id: follows.followingId })
            .from(follows)
            .where(eq(follows.followerId, viewerId))
        )
      )
    )
    .limit(4);
  return {
    following: followingRows.map((r) => toAuthor(r.u)),
    suggested: suggestedRows.map(toAuthor),
  };
}