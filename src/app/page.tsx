import { Suspense } from "react";
import { eq } from "drizzle-orm";
import { db } from "@/db";
import { users } from "@/db/schema";
import { getActivity, getCurrentUserId, getFeed, toAuthor } from "@/lib/data";
import SocialHome from "@/components/home/SocialHome";
import HomeSkeleton from "@/components/home/HomeSkeleton";

type HomeSearchParams = Promise<{ feed?: string | string[] }>;

export const dynamic = "force-dynamic";

async function HomepageContent({ searchParams }: { searchParams: HomeSearchParams }) {
  const [viewerId, query] = await Promise.all([getCurrentUserId(), searchParams]);
  const [posts, viewerRows, activity] = await Promise.all([
    getFeed("foryou", viewerId),
    db.select().from(users).where(eq(users.id, viewerId)).limit(1),
    getActivity(viewerId),
  ]);
  const initialTab = query.feed === "photo" ? "photo" : "foryou";

  return (
    <SocialHome
      key={initialTab}
      initialPosts={posts}
      viewer={viewerRows[0] ? toAuthor(viewerRows[0]) : null}
      activityDates={activity.map((item) => item.createdAt)}
      initialTab={initialTab}
    />
  );
}

export default function HomePage({ searchParams }: { searchParams: HomeSearchParams }) {
  return <Suspense fallback={<HomeSkeleton />}><HomepageContent searchParams={searchParams} /></Suspense>;
}
