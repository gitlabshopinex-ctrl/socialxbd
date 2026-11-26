"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Search as SearchIcon } from "lucide-react";
import { ChevronDown, ChevronUp, Compass, Users } from "lucide-react";
import VideoPlayer from "@/components/VideoPlayer";
import type { FeedVideo } from "@/lib/types";

export default function Feed({ tab }: { tab: "foryou" | "following" }) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [activeIdx, setActiveIdx] = useState(0);
  const [muted, setMuted] = useState(true);

  useEffect(() => {
    const stored = window.localStorage.getItem("sx-muted");
    if (stored === "false") setMuted(false);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setVideos(null);
    setError(null);
    setActiveIdx(0);
    fetch(`/api/feed?tab=${tab}`)
      .then(async (response) => {
        if (!response.ok) throw new Error("Failed to load feed");
        return response.json();
      })
      .then((data) => { if (!cancelled) setVideos(data.videos); })
      .catch((err) => { if (!cancelled) setError(err.message ?? "Failed to load feed"); });
    return () => { cancelled = true; };
  }, [tab]);

  useEffect(() => {
    const root = containerRef.current;
    if (!root || !videos?.length) return;
    const observer = new IntersectionObserver((entries) => {
      for (const entry of entries) {
        if (entry.isIntersecting) {
          const index = Number((entry.target as HTMLElement).dataset.idx);
          if (!Number.isNaN(index)) setActiveIdx(index);
        }
      }
    }, { root, threshold: 0.6 });
    Array.from(root.children).forEach((child) => observer.observe(child));
    return () => observer.disconnect();
  }, [videos]);

  const scrollToIdx = useCallback((index: number) => {
    const root = containerRef.current;
    if (!root) return;
    // Scroll this feed only; don't displace the shared header or bottom navigation.
    root.scrollTo({ top: root.clientHeight * index, behavior: window.matchMedia("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth" });
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      const tag = (event.target as HTMLElement)?.tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || !videos?.length) return;
      if (event.key === "ArrowDown" || event.key === "j") {
        event.preventDefault();
        scrollToIdx(Math.min(videos.length - 1, activeIdx + 1));
      } else if (event.key === "ArrowUp" || event.key === "k") {
        event.preventDefault();
        scrollToIdx(Math.max(0, activeIdx - 1));
      } else if (event.key === "m") {
        setMuted((value) => {
          window.localStorage.setItem("sx-muted", String(!value));
          return !value;
        });
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [videos, activeIdx, scrollToIdx]);

  const toggleMute = () => setMuted((value) => {
    window.localStorage.setItem("sx-muted", String(!value));
    return !value;
  });
  const patchVideo = (id: number, patch: Partial<FeedVideo>) => {
    setVideos((items) => items ? items.map((video) => video.id === id ? { ...video, ...patch } : video) : items);
  };

  return (
    <div className="relative h-full max-w-[640px] mx-auto">
      {videos === null && !error && <div className="h-full flex items-center justify-center"><div className="h-[82%] aspect-[9/16] rounded-xl bg-card animate-pulse" /></div>}
      {error && <div className="h-full flex flex-col items-center justify-center gap-3 text-white/50"><p>{error}</p><button onClick={() => window.location.reload()} className="px-5 py-2 rounded-full bg-accent text-white font-semibold text-sm">Retry</button></div>}
      {videos?.length === 0 && (
        <div className="h-full flex flex-col items-center justify-center gap-4 px-8 text-center">
          <Users size={52} className="text-white/25" />
          <p className="font-semibold text-lg">Videos from accounts you follow</p>
          <p className="text-white/50 text-sm max-w-xs">Follow creators you love and their latest videos will show up here.</p>
          <Link href="/explore" className="flex items-center gap-2 px-6 py-2.5 rounded-full bg-accent text-white font-semibold text-sm"><Compass size={16} />Explore creators</Link>
        </div>
      )}
      {!!videos?.length && (
        <div ref={containerRef} className="h-full overflow-y-auto snap-y snap-mandatory no-scrollbar">
          {videos.map((video, index) => (
            <section key={video.id} data-idx={index} className="h-full w-full snap-start snap-always flex items-center justify-center md:py-3 md:px-4">
              <VideoPlayer video={video} active={index === activeIdx} muted={muted} onToggleMute={toggleMute} onChange={(patch) => patchVideo(video.id, patch)} onComment={() => router.push(`/video/${video.id}?c=1`)} onRemove={(id) => setVideos((items) => items ? items.filter((v) => v.id !== id) : items)} />
            </section>
          ))}
        </div>
      )}
      <div className="sx-feed-overlay">
        <div className="sx-feed-tabs sx-feed-tabs-with-controls sx-feed-tabs-visible sx-feed-tabs-for-you" role="navigation" aria-label="Feed filters">
          <button type="button" onClick={() => router.push("/")} aria-label="Back" className="sx-feed-tabs-edge sx-feed-tabs-back">
            <ArrowLeft size={22} strokeWidth={1.9} />
          </button>
          <div className="sx-feed-tabs-list">
            <button
              type="button"
              className="sx-feed-tabs-item sx-feed-tabs-for-you-active"
              onClick={() => { containerRef.current?.scrollTo({ top: 0, behavior: "smooth" }); setActiveIdx(0); }}
              aria-current="page"
            >For You</button>
          </div>
          <Link href="/search" aria-label="Search" className="sx-feed-tabs-edge sx-feed-tabs-search">
            <SearchIcon size={21} strokeWidth={1.9} />
          </Link>
        </div>
      </div>
      {!!videos?.length && (
        <div className="hidden md:flex absolute right-4 bottom-6 z-30 flex-col gap-3">
          <button onClick={() => scrollToIdx(Math.max(0, activeIdx - 1))} disabled={activeIdx === 0} aria-label="Previous video" className="w-11 h-11 rounded-full bg-chip hover:bg-white/25 flex items-center justify-center disabled:opacity-30 transition-colors"><ChevronUp size={22} /></button>
          <button onClick={() => scrollToIdx(Math.min(videos.length - 1, activeIdx + 1))} disabled={activeIdx === videos.length - 1} aria-label="Next video" className="w-11 h-11 rounded-full bg-chip hover:bg-white/25 flex items-center justify-center disabled:opacity-30 transition-colors"><ChevronDown size={22} /></button>
        </div>
      )}
    </div>
  );
}
