"use client";

import Link from "next/link";
import { Heart, Images, Play } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { FeedVideo } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

export default function VideoGrid({
  videos,
  variant = "explore",
  emptyText = "No posts yet",
}: {
  videos: FeedVideo[];
  variant?: "explore" | "profile";
  emptyText?: string;
}) {
  if (videos.length === 0) {
    return (
      <div className="py-16 text-center text-white/40 text-sm">{emptyText}</div>
    );
  }
  return (
    <div
      className={cn(
        "grid",
        variant === "explore"
          ? "grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6"
          : "grid-cols-3 sm:grid-cols-4 lg:grid-cols-5 gap-1.5 md:gap-3"
      )}
    >
      {videos.map((v) => {
        const isPhotoPost = !v.videoUrl || Boolean(v.images && v.images.length > 0);
        const href = isPhotoPost ? `/video/${v.id}?mode=posts&tab=photo` : `/video/${v.id}?mode=shorts`;
        const thumbUrl = v.images?.[0]?.url ?? v.coverUrl;
        return (
          <Link key={v.id} href={href} className="block group min-w-0">
            <div
              className={cn(
                "relative aspect-[9/16] overflow-hidden bg-card",
                variant === "explore" ? "rounded-lg" : "rounded-md"
              )}
            >
              {isPhotoPost ? (
                thumbUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumbUrl}
                    alt={v.caption || "Photo post"}
                    loading="lazy"
                    className="h-full w-full object-cover"
                  />
                ) : (
                  <div className="h-full w-full flex items-center justify-center text-white/30 text-xs">
                    Photo
                  </div>
                )
              ) : (
                <video
                  src={v.videoUrl}
                  poster={v.coverUrl ?? undefined}
                  muted
                  playsInline
                  preload="metadata"
                  className="h-full w-full object-cover"
                  onMouseEnter={(e) => {
                    e.currentTarget.play().catch(() => {});
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.pause();
                    e.currentTarget.currentTime = 0;
                  }}
                />
              )}
              <div className="absolute inset-x-0 bottom-0 h-14 bg-gradient-to-t from-black/70 to-transparent pointer-events-none" />
              {isPhotoPost && (v.images?.length ?? 0) > 1 && (
                <span className="absolute right-2 top-2 flex items-center gap-1 rounded bg-black/55 px-1.5 py-0.5 text-[11px] font-semibold">
                  <Images size={12} />
                  {v.images!.length}
                </span>
              )}
              <span className="absolute left-2 bottom-1.5 flex items-center gap-1 text-[13px] font-semibold drop-shadow">
                {isPhotoPost ? (
                  <Heart size={13} fill="currentColor" strokeWidth={0} />
                ) : (
                  <Play size={14} fill="currentColor" strokeWidth={0} />
                )}
                {formatCount(isPhotoPost ? v.likesCount : v.viewsCount)}
              </span>
            </div>
            {variant === "explore" && (
              <>
                <p className="mt-1.5 text-[13px] leading-snug line-clamp-2 text-white/90">
                  {v.caption}
                </p>
                <div className="flex items-center gap-1.5 mt-1.5">
                  <Avatar src={v.author.avatarUrl} name={v.author.name} size={20} />
                  <span className="text-[12px] text-white/50 truncate flex-1">
                    {v.author.handle}
                  </span>
                  <Heart
                    size={12}
                    className="text-white/40 shrink-0"
                    fill="currentColor"
                    strokeWidth={0}
                  />
                  <span className="text-[12px] text-white/40 shrink-0">
                    {formatCount(v.likesCount)}
                  </span>
                </div>
              </>
            )}
          </Link>
        );
      })}
    </div>
  );
}
