import { Suspense } from "react";
import Link from "next/link";
import VideoDetail from "@/components/VideoDetail";
import { getCurrentHandle, getCurrentUserId, getProfile } from "@/lib/data";

export const dynamic = "force-dynamic";

async function ProfileVideoContent({ id }: { id: string }) {
  const videoId = Number(id);
  if (!Number.isSafeInteger(videoId) || videoId < 1) return <Unavailable />;

  const viewerId = await getCurrentUserId();
  const profile = await getProfile(await getCurrentHandle(), viewerId);
  if (!profile?.isSelf) return <Unavailable />;

  const selected = profile.videos.find((video) => video.id === videoId);
  if (!selected) return <Unavailable />;

  // A creator's video viewer never mixes in videos from other accounts or the home feed.
  const ownItems = profile.videos.filter((video) =>
    selected.videoUrl ? Boolean(video.videoUrl) : !video.videoUrl
  );

  return (
    <VideoDetail
      key={videoId}
      initialVideo={selected}
      feed={ownItems}
      mode={selected.videoUrl ? "shorts" : "posts"}
      profileMode
      profileHandle={profile.user.handle}
      profileOwner={profile.isSelf}
    />
  );
}

function Unavailable() {
  return (
    <div className="sx-profile-video-unavailable">
      <p>This post is no longer available.</p>
      <Link href="/profile">Back to profile</Link>
    </div>
  );
}

export default async function ProfileVideoPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  return (
    <Suspense
      fallback={
        <div className="sx-viewer sx-profile-viewer" aria-label="Loading your video" aria-busy="true">
          <div className="sx-skeleton h-full w-full" />
        </div>
      }
    >
      <ProfileVideoContent id={id} />
    </Suspense>
  );
}
