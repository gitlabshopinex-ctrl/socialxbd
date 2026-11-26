"use client";

import { useUI } from "@/components/UIProvider";
import type { FeedVideo } from "@/lib/types";

export default function useVideoActions(
  video: FeedVideo,
  onChange: (patch: Partial<FeedVideo>) => void
) {
  const { toast } = useUI();

  const toggleLike = async () => {
    const next = !video.viewerLiked;
    onChange({
      viewerLiked: next,
      likesCount: Math.max(0, video.likesCount + (next ? 1 : -1)),
    });
    try {
      const r = await fetch(`/api/videos/${video.id}/like`, { method: "POST" });
      const d = await r.json();
      if (r.ok) onChange({ viewerLiked: d.liked, likesCount: d.likesCount });
    } catch {
      toast("Something went wrong");
    }
  };

  const toggleSave = async () => {
    const next = !video.viewerSaved;
    onChange({
      viewerSaved: next,
      savesCount: Math.max(0, video.savesCount + (next ? 1 : -1)),
    });
    toast(next ? "Added to Favorites" : "Removed from Favorites");
    try {
      const r = await fetch(`/api/videos/${video.id}/save`, { method: "POST" });
      const d = await r.json();
      if (r.ok) onChange({ viewerSaved: d.saved, savesCount: d.savesCount });
    } catch {
      toast("Something went wrong");
    }
  };

  const share = async () => {
    const link = `${window.location.origin}/video/${video.id}`;
    try {
      await navigator.clipboard.writeText(link);
      toast("Link copied to clipboard");
    } catch {
      toast(`Share this video: /video/${video.id}`);
    }
    try {
      const r = await fetch(`/api/videos/${video.id}/share`, { method: "POST" });
      const d = await r.json();
      if (r.ok) onChange({ sharesCount: d.sharesCount });
    } catch {
      /* ignore */
    }
  };

  const toggleFollow = async () => {
    const next = !video.viewerFollowsAuthor;
    onChange({ viewerFollowsAuthor: next });
    try {
      const r = await fetch(
        `/api/users/${encodeURIComponent(video.author.handle)}/follow`,
        { method: "POST" }
      );
      const d = await r.json();
      if (r.ok) {
        onChange({ viewerFollowsAuthor: d.following });
        toast(d.following ? `Following @${video.author.handle}` : `Unfollowed @${video.author.handle}`);
      } else {
        onChange({ viewerFollowsAuthor: !next });
        toast(d.error ?? "Something went wrong");
      }
    } catch {
      onChange({ viewerFollowsAuthor: !next });
      toast("Something went wrong");
    }
  };

  return { toggleLike, toggleSave, share, toggleFollow };
}