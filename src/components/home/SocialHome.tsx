"use client";

import dynamic from "next/dynamic";
import { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowUp, UsersRound } from "lucide-react";
import FeedTabs, { type FeedTab } from "@/components/FeedTabs";
import HomeDialog from "@/components/home/HomeDialog";
import SocialPost from "@/components/home/SocialPost";
import Stories from "@/components/home/Stories";
import { useUI } from "@/components/UIProvider";
import type { Author, FeedVideo } from "@/lib/types";

const CommentsPanel = dynamic(() => import("@/components/CommentsPanel"), {
  loading: () => <div className="sx-comment-skeleton" aria-label="Loading comments">{[0, 1, 2].map((i) => <div key={i} className="sx-skeleton h-12 rounded-lg" />)}</div>,
});

type PostGroup = { post: FeedVideo; related: FeedVideo[]; lead: boolean };

export default function SocialHome({
  initialPosts,
  viewer,
  activityDates,
  initialTab = "foryou",
}: {
  initialPosts: FeedVideo[];
  viewer: Author | null;
  activityDates: string[];
  initialTab?: FeedTab;
}) {
  const router = useRouter();
  const { toast, setInboxUpdateCount } = useUI();
  const [posts, setPosts] = useState(initialPosts);
  const [tab, setTab] = useState<FeedTab>(initialTab);
  const [hiddenIds, setHiddenIds] = useState<number[]>([]);
  const [tabsVisible, setTabsVisible] = useState(false);
  const [commentPostId, setCommentPostId] = useState<number | null>(null);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const feedRef = useRef<HTMLElement>(null);

  useEffect(() => { setPosts(initialPosts); }, [initialPosts]);

  useEffect(() => {
    let lastSeen = "";
    try { lastSeen = window.localStorage.getItem("sx-inbox-seen-at") ?? ""; } catch { /* Storage may be disabled. */ }
    setInboxUpdateCount(activityDates.filter((date) => !lastSeen || date > lastSeen).length);
  }, [activityDates, setInboxUpdateCount]);

  useEffect(() => {
    if (initialTab === "foryou") return;
    const frame = requestAnimationFrame(() => feedRef.current?.scrollIntoView({ block: "start" }));
    return () => cancelAnimationFrame(frame);
  }, [initialTab]);

  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(([entry]) => {
      setTabsVisible(!entry.isIntersecting && entry.boundingClientRect.top < 48);
    }, { rootMargin: "-48px 0px 0px 0px", threshold: 0 });
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, []);

  const groups = useMemo(() => {
    const visible = posts.filter((post) => !hiddenIds.includes(post.id))
      .filter((post) => tab !== "following" || post.viewerFollowsAuthor)
      .filter((post) => tab !== "photo" || !!post.coverUrl);
    const result: PostGroup[] = [];
    const byAuthor = new Map<number, PostGroup>();
    for (const [index, post] of visible.entries()) {
      const isNativePhotoPost = Boolean(post.images && post.images.length > 0);
      const lead = index === 0 && tab !== "photo" && !isNativePhotoPost;
      if (lead) {
        result.push({ post, related: [], lead: true });
        continue;
      }
      if (isNativePhotoPost) {
        result.push({ post, related: [], lead: false });
        continue;
      }
      const previous = byAuthor.get(post.author.id);
      if (previous) previous.related.push(post);
      else {
        const group: PostGroup = { post, related: [], lead: false };
        byAuthor.set(post.author.id, group);
        result.push(group);
      }
    }
    return result;
  }, [posts, hiddenIds, tab]);

  const patchPost = (id: number, patch: Partial<FeedVideo>) => {
    setPosts((previous) => previous.map((post) => post.id === id ? { ...post, ...patch } : post));
  };

  const selectTab = (next: FeedTab) => {
    setTab(next);
    requestAnimationFrame(() => {
      feedRef.current?.scrollIntoView({ block: "start", behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
    });
  };

  const commentsPost = posts.find((post) => post.id === commentPostId);

  return (
    <div className="sx-home">
      <h1 className="sr-only">SocialX — your community feed</h1>
      <Stories viewer={viewer} posts={posts} />
      <div ref={sentinelRef} className="sx-feed-sentinel" aria-hidden="true" />
      <div className="sx-tabs-anchor">
        <FeedTabs active={tab} visible={tabsVisible} onSelect={selectTab} controls="sx-feed-posts" />
      </div>
      <section ref={feedRef} id="sx-feed-posts" role="tabpanel" aria-labelledby={`sx-tab-${tab}`} className="sx-feed">
        {tab === "photo" && <p className="sx-photo-note">Photo previews from posts in your feed</p>}
        {groups.length ? groups.map(({ post, lead, related }) => (
          <SocialPost
            key={post.id}
            post={post}
            lead={lead}
            related={related}
            feedTab={tab}
            onChange={(patch) => patchPost(post.id, patch)}
            onComment={() => setCommentPostId(post.id)}
            onHide={() => {
              setHiddenIds((ids) => [...ids, post.id]);
              toast("Post hidden for this visit");
            }}
            onDelete={(id) => {
              setPosts((previous) => previous.filter((item) => item.id !== id));
              router.refresh();
            }}
          />
        )) : (
          <div className="sx-empty-feed">
            <UsersRound size={34} strokeWidth={1.3} />
            <h2>{tab === "following" ? "Your people, right here." : "A little quiet here."}</h2>
            <p>{tab === "following" ? "Follow creators to see their posts in your feed." : "New posts will appear here when they're available."}</p>
            <Link href="/explore">Explore the community</Link>
          </div>
        )}
        {groups.length > 0 && <div className="sx-feed-end"><p>You&apos;re all caught up.</p><button type="button" onClick={() => window.scrollTo({ top: 0, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" })}><ArrowUp size={14} />Back to top</button></div>}
      </section>
      {commentsPost && (
        <HomeDialog title="Comments" className="sx-comments-dialog" hideHeading onClose={() => setCommentPostId(null)}>
          <CommentsPanel videoId={commentsPost.id} authorHandle={commentsPost.author.handle} onClose={() => setCommentPostId(null)} onPosted={(commentsCount) => patchPost(commentsPost.id, { commentsCount })} />
        </HomeDialog>
      )}
    </div>
  );
}
