import { Suspense } from "react";
import Link from "next/link";
import type { FeedTab } from "@/components/FeedTabs";
import VideoDetail from "@/components/VideoDetail";
import { getCurrentUserId, getFeed, getVideoById } from "@/lib/data";

type VideoPageParams = Promise<{ id: string }>;
type VideoPageSearchParams = Promise<{ c?: string; tab?: string; mode?: string }>;

export const dynamic = "force-dynamic";

function ViewerSkeleton() {
  return <div className="sx-viewer" aria-label="Loading post" aria-busy="true"><div className="sx-skeleton h-full w-full" /></div>;
}

async function VideoViewerContent({ params, searchParams }: { params: VideoPageParams; searchParams: VideoPageSearchParams }) {
  const [{ id }, query, viewerId] = await Promise.all([params, searchParams, getCurrentUserId()]);
  const videoId = Number(id);
  if (!Number.isInteger(videoId) || videoId < 1) {
    return <div className="sx-viewport flex flex-col items-center justify-center gap-3"><p>Post unavailable</p><Link href="/">Back to Home</Link></div>;
  }
  const [selected, feed] = await Promise.all([getVideoById(videoId, viewerId), getFeed("foryou", viewerId)]);
  if (!selected) {
    return <div className="sx-viewport flex flex-col items-center justify-center gap-3"><p>Post unavailable</p><Link href="/">Back to Home</Link></div>;
  }
  const initialTab: FeedTab = query.tab === "photo" ? "photo" : query.tab === "following" ? "following" : "foryou";
  const mode = query.mode === "posts" || query.mode === "photo" ? "posts" : "shorts";
  return <VideoDetail initialVideo={selected} feed={feed} mode={mode} initialTab={initialTab} initialCommentsOpen={query.c === "1"} />;
}

export default function VideoPage({ params, searchParams }: { params: VideoPageParams; searchParams: VideoPageSearchParams }) {
  return <Suspense fallback={<ViewerSkeleton />}><VideoViewerContent params={params} searchParams={searchParams} /></Suspense>;
}
