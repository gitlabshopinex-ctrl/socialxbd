"use client";

import { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { Search } from "lucide-react";
import VideoGrid from "@/components/VideoGrid";
import type { FeedVideo } from "@/lib/types";
import { cn } from "@/lib/utils";

const CATEGORIES: { label: string; keywords: string[] }[] = [
  { label: "All", keywords: [] },
  { label: "Dance", keywords: ["dance", "choreo"] },
  { label: "Food", keywords: ["cook", "food", "pasta", "recipe", "chef", "knife"] },
  { label: "Nature", keywords: ["nature", "waterfall", "mountain", "hiking", "drone", "aerial", "clouds"] },
  { label: "City", keywords: ["city", "night", "architecture", "neon"] },
  { label: "Fitness", keywords: ["fitness", "workout", "gym", "strength", "grind", "cycling"] },
  { label: "Pets", keywords: ["dog", "puppy", "puppies", "zoomies"] },
  { label: "Travel", keywords: ["travel", "beach", "sunset", "ocean"] },
  { label: "Skate", keywords: ["skate"] },
];

export default function ExplorePage() {
  const [videos, setVideos] = useState<FeedVideo[] | null>(null);
  const [category, setCategory] = useState("All");

  useEffect(() => {
    fetch("/api/feed")
      .then((r) => r.json())
      .then((d) => setVideos(d.videos ?? []))
      .catch(() => setVideos([]));
  }, []);

  const filtered = useMemo(() => {
    if (!videos) return null;
    const cat = CATEGORIES.find((c) => c.label === category);
    if (!cat || cat.keywords.length === 0) return videos;
    return videos.filter((v) => {
      const hay = `${v.caption} ${v.musicName}`.toLowerCase();
      return cat.keywords.some((k) => hay.includes(k));
    });
  }, [videos, category]);

  return (
    <div className="px-3 md:px-6 py-4 pb-20 md:pb-10 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between mb-3">
        <h1 className="text-lg font-bold">Explore</h1>
        <Link href="/search" aria-label="Search" className="p-1">
          <Search size={22} />
        </Link>
      </div>

      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-5 pb-1">
        {CATEGORIES.map((c) => (
          <button
            key={c.label}
            onClick={() => setCategory(c.label)}
            className={cn(
              "px-3.5 py-1.5 rounded-lg text-[13px] font-semibold whitespace-nowrap transition-colors",
              category === c.label
                ? "bg-white text-black"
                : "bg-chip text-white hover:bg-white/20"
            )}
          >
            {c.label}
          </button>
        ))}
      </div>

      {filtered === null ? (
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-x-3 gap-y-6">
          {Array.from({ length: 10 }).map((_, i) => (
            <div key={i} className="aspect-[9/16] rounded-lg bg-card animate-pulse" />
          ))}
        </div>
      ) : (
        <VideoGrid videos={filtered} emptyText="Nothing in this category yet" />
      )}
    </div>
  );
}