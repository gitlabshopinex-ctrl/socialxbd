import { Suspense } from "react";
import Link from "next/link";
import { Compass } from "lucide-react";
import VideoDetail from "@/components/VideoDetail";
import { getCurrentUserId, getFeed } from "@/lib/data";

export const dynamic = "force-dynamic";

function ShortsSkeleton() {
  return (
    <div className="sx-viewer" aria-label="Loading shorts" aria-busy="true">
      <div className="sx-skeleton h-full w-full" />
    </div>
  );
}

async function ShortsPageContent() {
  const viewerId = await getCurrentUserId();
  const feed = await getFeed("foryou", viewerId);
  const shorts = feed.filter((item) => Boolean(item.videoUrl));

  if (shorts.length === 0) {
    return (
      <div className="sx-viewport flex flex-col items-center justify-center gap-4 px-8 text-center">
        <p className="font-semibold text-lg">No shorts available yet</p>
        <Link
          href="/explore"
          className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-white font-semibold text-sm"
        >
          <Compass size={16} /> Explore SocialX
        </Link>
      </div>
    );
  }

  return (
    <VideoDetail
      initialVideo={shorts[0]}
      feed={shorts}
      mode="shorts"
      initialTab="foryou"
      syncUrl={false}
    />
  );
}

export default function FollowingPage() {
  return (
    <Suspense fallback={<ShortsSkeleton />}>
      <ShortsPageContent />
    </Suspense>
  );
}
