"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowUpRight,
  Copy,
  EyeOff,
  MapPin,
  MessageCircle,
  MoreHorizontal,
  Play,
  Repeat2,
  Share2,
  ShieldCheck,
  Sparkles,
  ThumbsDown,
  ThumbsUp,
} from "lucide-react";
import type { FeedTab } from "@/components/FeedTabs";
import HomeDialog from "@/components/home/HomeDialog";
import PostImage from "@/components/home/PostImage";
import PostMediaGrid, { type PostMedia } from "@/components/home/PostMediaGrid";
import PostMenuModal from "@/components/PostMenuModal";
import ShareSheet from "@/components/ShareSheet";
import useVideoActions from "@/hooks/useVideoActions";
import { useUI } from "@/components/UIProvider";
import { getViewerHandle } from "@/lib/identity";
import type { FeedVideo } from "@/lib/types";
import { cn, formatCount, splitHashtags, timeAgo } from "@/lib/utils";

/** Optional metadata is displayed only if supplied by the application's data source. */
export type SocialFeedPost = FeedVideo & {
  location?: string | null;
  community?: string | null;
  images?: { url: string; alt?: string }[];
};

function buildViewerHref(
  id: number,
  mode: "posts" | "shorts",
  feedTab: FeedTab
): string {
  const params = new URLSearchParams({ mode });
  if (feedTab !== "foryou") params.set("tab", feedTab);
  return `/video/${id}?${params.toString()}`;
}

export default function SocialPost({
  post,
  lead = false,
  related = [],
  feedTab = "foryou",
  onChange,
  onComment,
  onHide,
  onDelete,
}: {
  post: SocialFeedPost;
  lead?: boolean;
  related?: FeedVideo[];
  feedTab?: FeedTab;
  onChange: (patch: Partial<FeedVideo>) => void;
  onComment: () => void;
  onHide: () => void;
  onDelete?: (id: number) => void;
}) {
  const router = useRouter();
  const { toast } = useUI();
  const actions = useVideoActions(post, onChange);
  const busy = useRef(false);
  const [menu, setMenu] = useState<"share" | "feedback" | null>(null);
  const [threeDotOpen, setThreeDotOpen] = useState(false);
  const [shareTarget, setShareTarget] = useState<SocialFeedPost | null>(null);
  const topic = post.community ?? post.caption.match(/#[\p{L}\p{N}_]+/u)?.[0];
  const handle = encodeURIComponent(post.author.handle);
  const postCovers = [post, ...related].filter((p) => !!p.coverUrl).slice(0, 2);
  const originalHref = buildViewerHref(post.id, "posts", feedTab);
  const nativePhotos = !!post.images?.length;
  const media: PostMedia[] = nativePhotos
    ? post.images!.map((image) => ({
        src: image.url,
        alt: image.alt ?? `Photo by ${post.author.name}`,
        href: buildViewerHref(post.id, "posts", "photo"),
        kind: "photo" as const,
      }))
    : postCovers.map((item) => ({
        src: item.coverUrl!,
        alt: `Watch ${item.author.name}'s short: ${item.caption}`,
        href: buildViewerHref(item.id, "shorts", feedTab),
        kind: "video-preview" as const,
      }));

  const guarded = async (action: () => Promise<void>) => {
    if (busy.current) return;
    busy.current = true;
    try {
      await action();
    } finally {
      busy.current = false;
    }
  };

  const openPostViewer = (event: React.MouseEvent<HTMLElement>) => {
    if (menu || threeDotOpen) return;
    const target = event.target as HTMLElement | null;
    if (target?.closest("a, button, dialog, input, textarea, select")) return;
    if (typeof window !== "undefined" && window.getSelection()?.toString()) return;
    router.push(originalHref);
  };

  const nativeShare = async () => {
    const url = `${window.location.origin}/video/${post.id}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: `${post.author.name} on SocialX`,
          text: post.caption,
          url,
        });
        const response = await fetch(`/api/videos/${post.id}/share`, { method: "POST" });
        if (response.ok) {
          const data = await response.json();
          onChange({ sharesCount: data.sharesCount });
        }
        setMenu(null);
      } catch (error) {
        if (!(error instanceof DOMException && error.name === "AbortError")) {
          toast("Unable to share. Try copying the link instead.");
        }
      }
    } else {
      await actions.share();
      setMenu(null);
    }
  };

  return (
    <article
      className={cn("sx-post sx-post-clickable", lead && "sx-post-lead")}
      aria-label={`Post by ${post.author.name}`}
      onClick={openPostViewer}
      onPointerEnter={() => router.prefetch(originalHref)}
    >
      <header className="sx-post-header">
        <Link
          href={`/user/${handle}`}
          prefetch={false}
          className="sx-post-avatar"
          aria-label={`Visit ${post.author.name}'s profile`}
        >
          <PostImage src={post.author.avatarUrl} alt={post.author.name} sizes="42px" eager={lead} />
        </Link>
        <div className="sx-post-author">
          <div className="sx-author-name-row">
            <Link href={`/user/${handle}`} prefetch={false} className="sx-author-name">
              {post.author.name}
            </Link>
            {post.author.verified && (
              <ShieldCheck className="sx-verified" size={14} aria-label="Verified account" />
            )}
            {post.author.verified && <span className="sx-creator-badge">Creator</span>}
          </div>
          <div className="sx-post-meta">
            <Link href={`/user/${handle}`} prefetch={false} className="sx-post-handle">
              @{post.author.handle}
            </Link>
            <span aria-hidden="true">·</span>
            <time
              dateTime={post.createdAt}
              title={new Date(post.createdAt).toLocaleString()}
              suppressHydrationWarning
            >
              {timeAgo(post.createdAt)} ago
            </time>
            {post.location && (
              <>
                <span aria-hidden="true">·</span>
                <span className="sx-post-location">
                  <MapPin size={11} />
                  {post.location}
                </span>
              </>
            )}
          </div>
        </div>
        <button
          type="button"
          className="sx-post-menu sx-icon-button"
          aria-label={`More options for ${post.author.name}'s post`}
          onClick={() => setThreeDotOpen(true)}
        >
          <MoreHorizontal size={19} />
        </button>
      </header>

      {lead && topic && (
        <Link href={`/search?q=${encodeURIComponent(topic)}`} prefetch={false} className="sx-topic">
          <Sparkles size={13} className="sx-verified" />
          {post.community ? `Posted in ${topic}` : `Topic · ${topic}`}
        </Link>
      )}

      <p className="sx-post-caption">
        {splitHashtags(post.caption).map((part, index) =>
          part.isTag ? (
            <Link key={index} href={`/search?q=${encodeURIComponent(part.text)}`} prefetch={false}>
              {part.text}
            </Link>
          ) : (
            <span key={index}>{part.text}</span>
          )
        )}
      </p>

      {!lead && (
        <>
          {!nativePhotos && media.length > 1 && (
            <p className="sx-gallery-context">
              {media.length} posts from {post.author.name.split(" ")[0]}
            </p>
          )}
          <PostMediaGrid media={media} />
          {!media.length && post.videoUrl && (
            <Link href={originalHref} className="sx-watch-original">
              <Play size={15} />
              Watch original video
              <ArrowUpRight size={13} />
            </Link>
          )}
        </>
      )}

      <div className="sx-post-actions" aria-label="Post engagement">
        <button
          type="button"
          onClick={() => guarded(actions.toggleLike)}
          aria-label={post.viewerLiked ? "Unlike post" : "Like post"}
          aria-pressed={post.viewerLiked}
          className={cn("sx-engagement", post.viewerLiked && "sx-engagement-active")}
        >
          <ThumbsUp
            size={18}
            strokeWidth={1.7}
            fill={post.viewerLiked ? "currentColor" : "none"}
          />
          <span>{formatCount(post.likesCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => setMenu("feedback")}
          aria-label="Dislike: show less like this"
          className="sx-engagement"
        >
          <ThumbsDown size={18} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={onComment}
          aria-label="Comment on post"
          className="sx-engagement"
        >
          <MessageCircle size={18} strokeWidth={1.7} />
          <span>{formatCount(post.commentsCount)}</span>
        </button>
        <button
          type="button"
          onClick={() => setMenu("share")}
          aria-label="Repost or share the original post"
          className="sx-engagement"
        >
          <Repeat2 size={18} strokeWidth={1.7} />
        </button>
        <button
          type="button"
          onClick={() => setShareTarget(post)}
          aria-label="Share post"
          className="sx-engagement"
        >
          <Share2 size={18} strokeWidth={1.7} />
          <span className="sr-only">{post.sharesCount} shares</span>
        </button>
      </div>

      {threeDotOpen && (
        <PostMenuModal
          post={post}
          onClose={() => setThreeDotOpen(false)}
          onUpdated={onChange}
          onRemoved={(id) => {
            if (onDelete) onDelete(id);
            else onHide();
          }}
        />
      )}

      {shareTarget && (
        <ShareSheet
          post={shareTarget}
          isOwner={shareTarget.author.handle === getViewerHandle()}
          onClose={() => setShareTarget(null)}
          onUpdated={onChange}
          onDeleted={(id) => {
            if (onDelete) onDelete(id);
            else onHide();
          }}
          onHide={() => onHide()}
          onManage={() => {
            setShareTarget(null);
            setThreeDotOpen(true);
          }}
        />
      )}

      {menu && (
        <HomeDialog
          title={menu === "feedback" ? "Your feed, your choice" : "Share this post"}
          onClose={() => setMenu(null)}
        >
          <div className="sx-action-menu">
            {menu === "feedback" && (
              <>
                <p className="sx-action-explanation">
                  You can hide this post for this visit. This doesn&apos;t send a public dislike or
                  change anyone&apos;s counts.
                </p>
                <button
                  type="button"
                  onClick={() => {
                    setMenu(null);
                    onHide();
                  }}
                >
                  <EyeOff size={19} />
                  Hide this post
                </button>
                <button type="button" onClick={() => setMenu(null)}>
                  Keep in my feed
                </button>
              </>
            )}
            {menu === "share" && (
              <>
                <p className="sx-action-explanation">
                  Share the original post with your people. Public reposts aren&apos;t available for
                  these posts yet.
                </p>
                <button type="button" onClick={nativeShare}>
                  <Share2 size={19} />
                  Share a link
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await guarded(actions.share);
                    setMenu(null);
                  }}
                >
                  <Copy size={19} />
                  Copy post link
                </button>
                <Link href={originalHref}>
                  <ArrowUpRight size={19} />
                  Open original post
                </Link>
              </>
            )}
          </div>
        </HomeDialog>
      )}
    </article>
  );
}
