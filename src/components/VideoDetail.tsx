"use client";

import dynamic from "next/dynamic";
import { memo, useEffect, useLayoutEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Bookmark, Check, Heart, MessageCircle, Play, Plus, Search, Share2 } from "lucide-react";
import FeedTabs, { type FeedTab } from "@/components/FeedTabs";
import HomeDialog from "@/components/home/HomeDialog";
import PostImage from "@/components/home/PostImage";
import PostMenuModal from "@/components/PostMenuModal";
import ShareSheet from "@/components/ShareSheet";
import useVideoActions from "@/hooks/useVideoActions";
import { useUI } from "@/components/UIProvider";
import { getViewerHandle } from "@/lib/identity";
import type { FeedVideo } from "@/lib/types";
import { cn, formatCount, splitHashtags, timeAgo } from "@/lib/utils";

const CommentsPanel = dynamic(() => import("@/components/CommentsPanel"), {
  loading: () => (
    <div className="sx-comment-skeleton" aria-label="Loading comments">
      {[0, 1, 2].map((i) => (
        <div key={i} className="sx-skeleton h-12 rounded-lg" />
      ))}
    </div>
  ),
});

type ViewerMode = "posts" | "shorts";
type Photo = { url: string; alt?: string };
type ViewerItem = FeedVideo & { images?: Photo[] };

const ViewerCard = memo(function ViewerCard({
  item,
  isActive,
  preload,
  forceStaticPhoto,
  activePhotoUrl,
  muted,
  paused,
  onPaused,
  onDoubleTap,
  onOpenComments,
  onOpenShare,
  onPatch,
  onToggleMute,
  profileMode = false,
  profileOwner = false,
}: {
  item: ViewerItem;
  isActive: boolean;
  preload: "auto" | "metadata" | "none";
  forceStaticPhoto: boolean;
  activePhotoUrl?: string | null;
  muted: boolean;
  paused: boolean;
  onPaused: (paused: boolean) => void;
  onDoubleTap: (item: ViewerItem) => void;
  onOpenComments: (item: ViewerItem) => void;
  onOpenShare: (item: ViewerItem) => void;
  onPatch: (id: number, patch: Partial<FeedVideo>) => void;
  onToggleMute: () => void;
  profileMode?: boolean;
  profileOwner?: boolean;
}) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const clickTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [expanded, setExpanded] = useState(false);
  const actions = useVideoActions(item, (patch) => onPatch(item.id, patch));
  const hasPlayableVideo = Boolean(item.videoUrl) && !forceStaticPhoto && !(item.images && item.images.length > 0);

  const onPausedRef = useRef(onPaused);
  onPausedRef.current = onPaused;

  useEffect(() => {
    const video = videoRef.current;
    if (!video || !hasPlayableVideo) return;
    if (isActive) {
      video.play().then(() => onPausedRef.current(false)).catch(() => onPausedRef.current(true));
    } else {
      video.pause();
    }
  }, [isActive, item.id, hasPlayableVideo]);

  useEffect(
    () => () => {
      if (clickTimer.current) clearTimeout(clickTimer.current);
    },
    []
  );

  const handleClick = () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
      return;
    }
    clickTimer.current = setTimeout(() => {
      clickTimer.current = null;
      const video = videoRef.current;
      if (!video || !hasPlayableVideo) return;
      if (video.paused) video.play().catch(() => {});
      else video.pause();
    }, 210);
  };

  const handleDouble = async () => {
    if (clickTimer.current) {
      clearTimeout(clickTimer.current);
      clickTimer.current = null;
    }
    if (!item.viewerLiked) await actions.toggleLike();
    onDoubleTap(item);
  };

  const handle = encodeURIComponent(item.author.handle);
  const posterSrc =
    activePhotoUrl ?? item.images?.[0]?.url ?? item.coverUrl ?? item.author.avatarUrl;

  return (
    <section
      className="sx-viewer-slide"
      data-post-id={item.id}
      aria-label={`Post by ${item.author.name}`}
    >
      <div className="sx-viewer-stage" onClick={handleClick} onDoubleClick={handleDouble}>
        {/* Always-rendered poster: the base layer while the video buffers, so activation never flashes. */}
        <PostImage
          src={posterSrc}
          alt={item.caption || `Post by ${item.author.name}`}
          sizes="(max-width: 640px) 100vw, 640px"
          eager={isActive}
          className="sx-viewer-poster"
        />
        {hasPlayableVideo && (
          <video
            ref={videoRef}
            src={item.videoUrl}
            loop
            playsInline
            autoPlay={isActive}
            muted={muted}
            preload={preload}
            className="sx-viewer-video"
            onPlay={() => onPaused(false)}
            onPause={() => onPaused(true)}
          />
        )}
        <div className="sx-viewer-bottom-scrim" aria-hidden="true" />
      </div>

      {isActive && hasPlayableVideo && paused && (
        <span className="sx-viewer-play-indicator" aria-hidden="true">
          <Play size={64} fill="rgba(255,255,255,0.85)" strokeWidth={0} />
        </span>
      )}

      <aside className="sx-viewer-rail" aria-label="Post actions">
        <div className="sx-viewer-avatar-wrap">
          <Link
            href={`/user/${handle}`}
            aria-label={`Visit ${item.author.name}'s profile`}
            className="sx-viewer-avatar"
          >
            <PostImage
              src={item.author.avatarUrl}
              alt={item.author.name}
              sizes="48px"
              eager={isActive}
            />
          </Link>
          {!profileOwner && (
            <button
              type="button"
              onClick={actions.toggleFollow}
              aria-label={item.viewerFollowsAuthor ? `Unfollow ${item.author.name}` : `Follow ${item.author.name}`}
              className={cn("sx-viewer-follow", item.viewerFollowsAuthor && "sx-viewer-follow-done")}
            >
              {item.viewerFollowsAuthor ? <Check size={11} strokeWidth={3.5} /> : <Plus size={12} strokeWidth={3.5} />}
            </button>
          )}
        </div>
        <button
          type="button"
          onClick={actions.toggleLike}
          aria-label={item.viewerLiked ? "Unlike post" : "Like post"}
          aria-pressed={item.viewerLiked}
          className="sx-viewer-action"
        >
          <span className="sx-viewer-action-icon">
            <Heart
              size={30}
              fill="currentColor"
              strokeWidth={0}
              className={item.viewerLiked ? "text-accent" : "text-white"}
            />
          </span>
          <span className="sx-viewer-action-count">{formatCount(item.likesCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => onOpenComments(item)}
          aria-label="Open comments"
          className="sx-viewer-action"
        >
          <span className="sx-viewer-action-icon">
            <MessageCircle size={29} fill="currentColor" strokeWidth={0} className="text-white" />
          </span>
          <span className="sx-viewer-action-count">{formatCount(item.commentsCount)}</span>
        </button>
        {profileMode && (
          <button
            type="button"
            onClick={actions.toggleSave}
            aria-label={item.viewerSaved ? "Remove from favorites" : "Save to favorites"}
            aria-pressed={item.viewerSaved}
            className="sx-viewer-action"
          >
            <span className="sx-viewer-action-icon">
              <Bookmark size={28} fill="currentColor" strokeWidth={0} className="text-white" />
            </span>
            <span className="sx-viewer-action-count">{formatCount(item.savesCount)}</span>
          </button>
        )}
        <button type="button" onClick={() => onOpenShare(item)} aria-label="Share post" className="sx-viewer-action">
          <span className="sx-viewer-action-icon">
            <Share2 size={29} fill="currentColor" strokeWidth={1.5} className="text-white" />
          </span>
          <span className="sx-viewer-action-count">{formatCount(item.sharesCount)}</span>
        </button>
        <button
          type="button"
          onClick={onToggleMute}
          className="sx-viewer-disc"
          title={item.musicName}
          aria-label={muted ? "Unmute audio" : "Mute audio"}
        >
          <PostImage src={item.author.avatarUrl} alt="" sizes="38px" eager={isActive} />
        </button>
      </aside>

      <div className="sx-viewer-caption-box">
        <div className="flex items-center gap-1.5">
          <Link href={`/user/${handle}`} className="sx-viewer-author">
            {item.author.name}
          </Link>
          {profileMode && (
            <span className="sx-profile-video-age" suppressHydrationWarning>· {timeAgo(item.createdAt)} ago</span>
          )}
        </div>
        <p
          className={cn("sx-viewer-caption", !expanded && "line-clamp-2")}
          onClick={() => setExpanded((value) => !value)}
        >
          {splitHashtags(item.caption).map((part, index) =>
            part.isTag ? (
              <Link
                key={index}
                href={`/search?q=${encodeURIComponent(part.text)}`}
                onClick={(event) => event.stopPropagation()}
                className="font-semibold"
              >
                {part.text}
              </Link>
            ) : (
              <span key={index}>{part.text}</span>
            )
          )}
        </p>
      </div>
    </section>
  );
},
(prev, next) =>
  prev.item === next.item &&
  prev.isActive === next.isActive &&
  prev.preload === next.preload &&
  prev.forceStaticPhoto === next.forceStaticPhoto &&
  prev.activePhotoUrl === next.activePhotoUrl &&
  prev.muted === next.muted &&
  prev.paused === next.paused &&
  prev.profileMode === next.profileMode &&
  prev.profileOwner === next.profileOwner
);

export default function VideoDetail({
  initialVideo,
  feed,
  mode,
  initialTab = "foryou",
  initialCommentsOpen = false,
  syncUrl = true,
  profileMode = false,
  profileHandle,
  profileOwner = false,
}: {
  initialVideo: FeedVideo;
  feed: FeedVideo[];
  mode: ViewerMode;
  initialTab?: FeedTab;
  initialCommentsOpen?: boolean;
  syncUrl?: boolean;
  profileMode?: boolean;
  profileHandle?: string;
  profileOwner?: boolean;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const scrollRef = useRef<HTMLDivElement>(null);
  const lastId = useRef(initialVideo.id);
  const [allItems, setAllItems] = useState<ViewerItem[]>(() => {
    if (profileMode) return feed.some((v) => v.id === initialVideo.id) ? feed : [initialVideo, ...feed];
    if (mode === "shorts") {
      return [
        initialVideo,
        ...feed
          .filter((v) => v.id !== initialVideo.id && !!v.videoUrl)
          .sort((a, b) => b.likesCount - a.likesCount),
      ];
    }
    return feed.some((v) => v.id === initialVideo.id) ? feed : [initialVideo, ...feed];
  });
  const [activeTab, setActiveTab] = useState<FeedTab>(initialTab);

  const items = useMemo(() => {
    if (profileMode) return allItems;
    if (activeTab === "following") {
      const followed = allItems.filter((item) => item.viewerFollowsAuthor);
      return followed.length > 0 ? followed : allItems;
    }
    return allItems;
  }, [allItems, activeTab, profileMode]);

  const [activeIndex, setActiveIndex] = useState(() => {
    if (mode === "shorts" && !profileMode) return 0;
    return Math.max(
      0,
      allItems.findIndex((v) => v.id === initialVideo.id)
    );
  });
  const [muted, setMuted] = useState(true);
  const [paused, setPaused] = useState(false);
  const [burstKey, setBurstKey] = useState(0);
  const [photoIndex, setPhotoIndex] = useState(0);
  const [commentsTarget, setCommentsTarget] = useState<ViewerItem | null>(
    initialCommentsOpen
      ? (allItems.find((v) => v.id === initialVideo.id) ?? allItems[0])
      : null
  );
  const [menuTarget, setMenuTarget] = useState<ViewerItem | null>(null);
  const [shareTarget, setShareTarget] = useState<ViewerItem | null>(null);

  const safeIndex = Math.min(activeIndex, Math.max(0, items.length - 1));
  const current = items[safeIndex] ?? items[0] ?? initialVideo;
  const forceStaticPhoto = mode === "posts" || activeTab === "photo" || !current.videoUrl;
  const photos = (current.images ?? []) as Photo[];
  const showThumbnails = photos.length > 1;

  useLayoutEffect(() => {
    if (scrollRef.current && safeIndex > 0) {
      scrollRef.current.scrollTop = scrollRef.current.clientHeight * safeIndex;
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    try {
      setMuted(window.localStorage.getItem("sx-muted") !== "false");
    } catch {
      /* storage disabled */
    }
  }, []);

  useEffect(() => {
    setPaused(false);
    setPhotoIndex(0);
  }, [safeIndex]);

  useEffect(() => {
    if (!syncUrl) return;
    if (lastId.current === current.id) return;
    lastId.current = current.id;
    const url = new URL(window.location.href);
    url.pathname = profileMode ? `/profile/video/${current.id}` : `/video/${current.id}`;
    window.history.replaceState(window.history.state, "", url.pathname + url.search);
  }, [current.id, syncUrl, profileMode]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (["INPUT", "TEXTAREA", "SELECT"].includes(tag) || commentsTarget || menuTarget) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        goTo(Math.min(items.length - 1, safeIndex + 1));
      }
      if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        goTo(Math.max(0, safeIndex - 1));
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [safeIndex, commentsTarget, menuTarget, items.length]);

  const goTo = (index: number) => {
    const scroll = scrollRef.current;
    if (!scroll) return;
    scroll.scrollTo({ top: scroll.clientHeight * index, behavior: "smooth" });
  };

  // IntersectionObserver-driven active slide tracking: zero setState during native
  // swipe/wheel momentum, so the browser snap animation is never interrupted.
  useEffect(() => {
    const root = scrollRef.current;
    if (!root) return;
    const observer = new IntersectionObserver(
      (entries) => {
        let best: { index: number; ratio: number } | null = null;
        for (const entry of entries) {
          if (entry.intersectionRatio < 0.55) continue;
          const slides = Array.from(root.children) as HTMLElement[];
          const index = slides.indexOf(entry.target as HTMLElement);
          if (index < 0) continue;
          if (!best || entry.intersectionRatio > best.ratio) best = { index, ratio: entry.intersectionRatio };
        }
        if (best) {
          const index = (best as { index: number; ratio: number }).index;
          setActiveIndex((old) => (old === index ? old : index));
        }
      },
      { root, threshold: [0.55, 0.75, 0.9] }
    );
    for (const child of Array.from(root.children)) observer.observe(child);
    return () => observer.disconnect();
  }, [items.length]);

  const patchItem = (id: number, patch: Partial<FeedVideo>) => {
    setAllItems((previous) =>
      previous.map((item) => {
        if (item.id === id) return { ...item, ...patch };
        if (
          patch.viewerFollowsAuthor !== undefined &&
          item.author.id === current.author.id
        ) {
          return { ...item, viewerFollowsAuthor: patch.viewerFollowsAuthor };
        }
        return item;
      })
    );
  };

  const removeItem = (id: number) => {
    setAllItems((previous) => previous.filter((item) => item.id !== id));
    if (items.length <= 1) router.replace(profileMode ? "/profile" : "/");
  };

  const toggleMute = () => {
    setMuted((old) => {
      try {
        window.localStorage.setItem("sx-muted", String(!old));
      } catch {
        /* storage disabled */
      }
      toast(old ? "Sound on" : "Sound muted");
      return !old;
    });
  };

  const onTab = (tab: FeedTab) => {
    setActiveTab(tab);
    setActiveIndex(0);
    setPhotoIndex(0);
    requestAnimationFrame(() => {
      scrollRef.current?.scrollTo({ top: 0, behavior: "instant" });
    });
  };

  return (
    <div className={cn("sx-viewer", profileMode && "sx-profile-viewer")} aria-label={profileMode ? "Your videos" : mode === "shorts" ? "Shorts" : "Posts"}>
      <div ref={scrollRef} className="sx-viewer-scroll no-scrollbar">
        {items.map((item, index) => (
          <ViewerCard
            key={item.id}
            item={item}
            isActive={index === safeIndex}
            preload={Math.abs(index - safeIndex) <= 1 ? "auto" : "none"}
            forceStaticPhoto={forceStaticPhoto}
            activePhotoUrl={
              index === safeIndex && showThumbnails ? photos[photoIndex]?.url : undefined
            }
            muted={muted}
            paused={paused}
            onPaused={setPaused}
            onDoubleTap={() => setBurstKey((key) => key + 1)}
            onOpenComments={(target) => setCommentsTarget(target)}
            onOpenShare={(target) => setShareTarget(target)}
            onPatch={patchItem}
            onToggleMute={toggleMute}
            profileMode={profileMode}
            profileOwner={profileOwner}
          />
        ))}
      </div>

      <div className="sx-viewer-top">
        {profileMode ? (
          <nav className="sx-profile-video-header" aria-label="Profile video controls">
            <button type="button" aria-label="Back to profile" onClick={() => router.push(profileOwner ? "/profile" : profileHandle ? `/user/${encodeURIComponent(profileHandle)}` : "/profile")}>
              <ArrowLeft size={24} strokeWidth={2} />
            </button>
            <Link href="/search" aria-label="Search"><Search size={23} strokeWidth={1.9} /></Link>
          </nav>
        ) : <FeedTabs active={activeTab} showControls onSelect={onTab} />}
        {showThumbnails && (
          <div className="sx-viewer-thumbs" role="group" aria-label="Switch photos">
            {photos.map((photo, index) => (
              <button
                key={`${photo.url}-${index}`}
                type="button"
                onClick={() => setPhotoIndex(index)}
                aria-label={`View photo ${index + 1} of ${photos.length}`}
                aria-pressed={index === photoIndex}
                className={cn(
                  "sx-viewer-thumb",
                  index === photoIndex && "sx-viewer-thumb-active"
                )}
              >
                <PostImage
                  src={photo.url}
                  alt={photo.alt ?? `Photo ${index + 1}`}
                  sizes="48px"
                  eager={index < 2}
                />
              </button>
            ))}
          </div>
        )}
      </div>

      {profileMode && (
        <div className="sx-profile-video-footer">
          <span className="sx-profile-video-views"><Play size={14} strokeWidth={1.8} /> {formatCount(current.viewsCount)} views</span>
          {profileOwner && <button type="button" onClick={() => setMenuTarget(current)}>Privacy settings</button>}
        </div>
      )}

      {burstKey > 0 && (
        <div key={burstKey} className="sx-viewer-burst" aria-hidden="true">
          <Heart
            size={96}
            fill="currentColor"
            strokeWidth={0}
            className="text-accent animate-heart-burst"
          />
        </div>
      )}

      {commentsTarget && (
        <HomeDialog
          title="Comments"
          className="sx-comments-dialog"
          hideHeading
          onClose={() => setCommentsTarget(null)}
        >
          <CommentsPanel
            key={commentsTarget.id}
            videoId={commentsTarget.id}
            authorHandle={commentsTarget.author.handle}
            onClose={() => setCommentsTarget(null)}
            onPosted={(commentsCount) => patchItem(commentsTarget.id, { commentsCount })}
          />
        </HomeDialog>
      )}

      {menuTarget && (
        <PostMenuModal
          post={menuTarget}
          onClose={() => setMenuTarget(null)}
          onUpdated={(patch) => patchItem(menuTarget.id, patch)}
          onRemoved={(id) => removeItem(id)}
        />
      )}

      {shareTarget && (
        <ShareSheet
          post={shareTarget}
          isOwner={
            profileOwner || shareTarget.author.handle === getViewerHandle()
          }
          onClose={() => setShareTarget(null)}
          onDeleted={(id) => removeItem(id)}
          onHide={(id) => removeItem(id)}
          onUpdated={(patch) => patchItem(shareTarget.id, patch)}
          onManage={() => {
            setMenuTarget(shareTarget);
            setShareTarget(null);
          }}
        />
      )}
    </div>
  );
}
