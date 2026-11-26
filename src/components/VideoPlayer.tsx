"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { BadgeCheck, Heart, Music, Play, Volume2, VolumeX } from "lucide-react";
import ActionRail from "@/components/ActionRail";
import ShareSheet from "@/components/ShareSheet";
import { getViewerHandle } from "@/lib/identity";
import useVideoActions from "@/hooks/useVideoActions";
import type { FeedVideo } from "@/lib/types";
import { cn, splitHashtags } from "@/lib/utils";

export default function VideoPlayer({
  video,
  active,
  muted,
  onToggleMute,
  onChange,
  onComment,
  onRemove,
  rounded = true,
}: {
  video: FeedVideo;
  active: boolean;
  muted: boolean;
  onToggleMute: () => void;
  onChange: (patch: Partial<FeedVideo>) => void;
  onComment: () => void;
  onRemove?: (id: number) => void;
  rounded?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const dragging = useRef(false);
  const [paused, setPaused] = useState(false);
  const [progress, setProgress] = useState(0);
  const [burstKey, setBurstKey] = useState(0);
  const [expanded, setExpanded] = useState(false);
  const [shareOpen, setShareOpen] = useState(false);
  const actions = useVideoActions(video, onChange);

  useEffect(() => {
    const el = videoRef.current;
    if (!el) return;
    if (active) {
      el.play().then(() => setPaused(false)).catch(() => setPaused(true));
    } else {
      el.pause();
      el.currentTime = 0;
      setProgress(0);
      setPaused(false);
    }
  }, [active, video.videoUrl]);

  useEffect(() => {
    if (videoRef.current) videoRef.current.muted = muted;
  }, [muted]);

  const togglePlay = () => {
    const el = videoRef.current;
    if (!el) return;
    if (el.paused) {
      el.play().catch(() => {});
    } else {
      el.pause();
    }
  };

  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      togglePlay();
    }, 220);
  };

  const handleDouble = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (!video.viewerLiked) actions.toggleLike();
    setBurstKey((k) => k + 1);
  };

  const seekFromEvent = (e: React.PointerEvent<HTMLDivElement>) => {
    const el = videoRef.current;
    if (!el || !el.duration) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const pct = Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width));
    el.currentTime = pct * el.duration;
    setProgress(pct);
  };

  const railProps = {
    video,
    playing: active && !paused,
    onLike: actions.toggleLike,
    onSave: actions.toggleSave,
    onShare: () => setShareOpen(true),
    onComment,
    onFollow: actions.toggleFollow,
  };

  return (
    <div className="flex h-full w-full md:w-auto items-end justify-center gap-2 max-w-full">
      <div
        className={cn(
          "relative h-full w-full md:w-auto md:aspect-[9/16] overflow-hidden bg-[#101010] shrink min-w-0",
          rounded && "md:rounded-xl"
        )}
      >
        <video
          ref={videoRef}
          src={video.videoUrl}
          poster={video.coverUrl ?? undefined}
          loop
          playsInline
          muted={muted}
          preload={active ? "auto" : "none"}
          className="h-full w-full object-cover md:object-contain"
          onClick={handleClick}
          onDoubleClick={handleDouble}
          onPlay={() => setPaused(false)}
          onPause={() => setPaused(true)}
          onTimeUpdate={(e) => {
            if (!dragging.current) {
              const el = e.currentTarget;
              setProgress(el.duration ? el.currentTime / el.duration : 0);
            }
          }}
        />

        <div className="absolute inset-x-0 bottom-0 h-44 bg-gradient-to-t from-black/80 via-black/25 to-transparent pointer-events-none z-10" />

        {paused && active && (
          <button
            onClick={togglePlay}
            aria-label="Play"
            className="absolute inset-0 z-20 flex items-center justify-center animate-fade-in"
          >
            <Play size={72} fill="rgba(255,255,255,0.85)" strokeWidth={0} className="drop-shadow-2xl" />
          </button>
        )}

        {burstKey > 0 && (
          <div
            key={burstKey}
            className="absolute inset-0 z-30 flex items-center justify-center pointer-events-none"
          >
            <Heart size={100} fill="currentColor" strokeWidth={0} className="text-accent animate-heart-burst drop-shadow-2xl" />
          </div>
        )}

        <button
          onClick={onToggleMute}
          aria-label={muted ? "Unmute" : "Mute"}
          className="absolute top-3 right-3 z-30 rounded-full bg-black/45 hover:bg-black/65 p-2.5 text-white"
        >
          {muted ? <VolumeX size={19} /> : <Volume2 size={19} />}
        </button>

        <div className="absolute left-3 right-16 md:right-4 bottom-4 z-20 pointer-events-none">
          <Link
            href={`/user/${video.author.handle}`}
            className="pointer-events-auto inline-flex items-center gap-1 text-[16px] font-bold drop-shadow hover:underline"
          >
            {video.author.handle}
            {video.author.verified && <BadgeCheck size={15} className="text-aqua" />}
          </Link>
          <p
            className={cn(
              "mt-1 text-[14px] leading-snug drop-shadow pointer-events-auto cursor-pointer",
              !expanded && "line-clamp-2"
            )}
            onClick={() => setExpanded((v) => !v)}
          >
            {splitHashtags(video.caption).map((part, i) =>
              part.isTag ? (
                <Link
                  key={i}
                  href={`/search?q=${encodeURIComponent(part.text)}`}
                  className="font-semibold hover:underline"
                  onClick={(e) => e.stopPropagation()}
                >
                  {part.text}{" "}
                </Link>
              ) : (
                <span key={i}>{part.text}</span>
              )
            )}
          </p>
          <div className="mt-1.5 flex items-center gap-1.5 text-[13px] drop-shadow pointer-events-auto w-fit max-w-full">
            <Music size={14} className="shrink-0" />
            <div className="overflow-hidden max-w-[190px]">
              <div className="flex w-max whitespace-nowrap animate-marquee">
                <span className="pr-10">{video.musicName}</span>
                <span className="pr-10">{video.musicName}</span>
              </div>
            </div>
          </div>
        </div>

        <ActionRail {...railProps} className="absolute right-1.5 bottom-24 z-20 md:hidden" />

        <div
          className="absolute inset-x-0 bottom-0 z-30 py-2 cursor-pointer group/seek touch-none"
          onPointerDown={(e) => {
            dragging.current = true;
            e.currentTarget.setPointerCapture(e.pointerId);
            seekFromEvent(e);
          }}
          onPointerMove={(e) => {
            if (dragging.current) seekFromEvent(e);
          }}
          onPointerUp={() => {
            dragging.current = false;
          }}
        >
          <div className="relative h-[3px] group-hover/seek:h-[6px] transition-all bg-white/25">
            <div
              className="absolute left-0 top-0 bottom-0 bg-white"
              style={{ width: `${progress * 100}%` }}
            />
            <div
              className="absolute top-1/2 -translate-y-1/2 w-3 h-3 rounded-full bg-white opacity-0 group-hover/seek:opacity-100"
              style={{ left: `calc(${progress * 100}% - 6px)` }}
            />
          </div>
        </div>
      </div>

      <ActionRail {...railProps} className="hidden md:flex self-end pb-1 pl-1" />
      {shareOpen && (
        <ShareSheet
          post={video}
          isOwner={video.author.handle === getViewerHandle()}
          onClose={() => setShareOpen(false)}
          onUpdated={onChange}
          onDeleted={(id) => onRemove?.(id)}
          onHide={(id) => onRemove?.(id)}
        />
      )}
    </div>
  );
}