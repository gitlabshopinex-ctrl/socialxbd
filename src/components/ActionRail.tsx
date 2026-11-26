"use client";

import Link from "next/link";
import { BadgeCheck, Bookmark, Check, Heart, MessageCircle, Plus } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { FeedVideo } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

function ShareArrow({ size = 30 }: { size?: number }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="currentColor" aria-hidden>
      <path d="M14 4.5c0-.8.9-1.3 1.6-.8l7 5.9c.6.5.6 1.4 0 1.9l-7 5.9c-.7.5-1.6 0-1.6-.8v-3.1c-5.6 0-9 1.7-11.2 4.9-.4.6-1.4.2-1.3-.5C2.3 11.6 6 7.6 14 7.2V4.5z" />
    </svg>
  );
}

export default function ActionRail({
  video,
  playing,
  onLike,
  onSave,
  onShare,
  onComment,
  onFollow,
  className,
}: {
  video: FeedVideo;
  playing: boolean;
  onLike: () => void;
  onSave: () => void;
  onShare: () => void;
  onComment: () => void;
  onFollow: () => void;
  className?: string;
}) {
  return (
    <div className={cn("flex flex-col items-center gap-4", className)}>
      <div className="relative mb-2">
        <Link href={`/user/${video.author.handle}`} aria-label={video.author.handle}>
          <Avatar
            src={video.author.avatarUrl}
            name={video.author.name}
            size={48}
            className="ring-2 ring-white/20"
          />
        </Link>
        <button
          onClick={onFollow}
          aria-label={video.viewerFollowsAuthor ? "Unfollow" : "Follow"}
          className={cn(
            "absolute -bottom-2.5 left-1/2 -translate-x-1/2 w-5 h-5 rounded-full flex items-center justify-center text-white transition-colors",
            video.viewerFollowsAuthor ? "bg-white text-accent" : "bg-accent"
          )}
        >
          {video.viewerFollowsAuthor ? (
            <Check size={12} strokeWidth={3.5} />
          ) : (
            <Plus size={12} strokeWidth={3.5} />
          )}
        </button>
      </div>

      <button onClick={onLike} className="flex flex-col items-center gap-1" aria-label="Like">
        <span key={video.viewerLiked ? "liked" : "unliked"} className="animate-like-pop">
          <Heart
            size={31}
            fill="currentColor"
            strokeWidth={0}
            className={cn(
              "drop-shadow-lg",
              video.viewerLiked ? "text-accent" : "text-white"
            )}
          />
        </span>
        <span className="text-[13px] font-semibold drop-shadow">{formatCount(video.likesCount)}</span>
      </button>

      <button onClick={onComment} className="flex flex-col items-center gap-1" aria-label="Comments">
        <MessageCircle size={31} fill="currentColor" strokeWidth={0} className="text-white drop-shadow-lg" />
        <span className="text-[13px] font-semibold drop-shadow">{formatCount(video.commentsCount)}</span>
      </button>

      <button onClick={onSave} className="flex flex-col items-center gap-1" aria-label="Save">
        <span key={video.viewerSaved ? "saved" : "unsaved"} className="animate-like-pop">
          <Bookmark
            size={30}
            fill="currentColor"
            strokeWidth={0}
            className={cn(
              "drop-shadow-lg",
              video.viewerSaved ? "text-[#face15]" : "text-white"
            )}
          />
        </span>
        <span className="text-[13px] font-semibold drop-shadow">{formatCount(video.savesCount)}</span>
      </button>

      <button onClick={onShare} className="flex flex-col items-center gap-1" aria-label="Share">
        <span className="text-white drop-shadow-lg">
          <ShareArrow size={30} />
        </span>
        <span className="text-[13px] font-semibold drop-shadow">{formatCount(video.sharesCount)}</span>
      </button>


      <div
        title={video.musicName}
        className="mt-1 w-11 h-11 rounded-full bg-gradient-to-br from-[#3f3f3f] via-black to-[#3f3f3f] border-[3px] border-[#262626] flex items-center justify-center animate-spin-slow"
        style={{ animationPlayState: playing ? "running" : "paused" }}
      >
        <Avatar src={video.author.avatarUrl} name={video.author.name} size={24} />
      </div>

      {video.author.verified && (
        <BadgeCheck size={16} className="text-aqua -mt-2" aria-label="Verified" />
      )}
    </div>
  );
}