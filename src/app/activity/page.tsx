"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Bell, Film, Loader2 } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { ActivityItem } from "@/lib/types";
import { cn, timeAgo } from "@/lib/utils";

const TABS = [
  { key: "all", label: "All activity" },
  { key: "like", label: "Likes" },
  { key: "comment", label: "Comments" },
  { key: "follow", label: "Followers" },
] as const;

function FollowBack({ handle }: { handle: string }) {
  const [following, setFollowing] = useState(false);
  const [busy, setBusy] = useState(false);
  return (
    <button
      onClick={async () => {
        if (busy) return;
        setBusy(true);
        try {
          const r = await fetch(`/api/users/${encodeURIComponent(handle)}/follow`, {
            method: "POST",
          });
          const d = await r.json();
          if (r.ok) setFollowing(d.following);
        } finally {
          setBusy(false);
        }
      }}
      className={cn(
        "px-4 py-1.5 rounded-lg text-[13px] font-semibold shrink-0",
        following ? "bg-chip text-white" : "bg-accent text-white"
      )}
    >
      {following ? "Following" : "Follow back"}
    </button>
  );
}

export default function ActivityPage() {
  const [items, setItems] = useState<ActivityItem[] | null>(null);
  const [tab, setTab] = useState<(typeof TABS)[number]["key"]>("all");

  useEffect(() => {
    fetch("/api/activity")
      .then((r) => r.json())
      .then((d) => setItems(d.items ?? []))
      .catch(() => setItems([]));
  }, []);

  const filtered = items?.filter((i) => tab === "all" || i.type === tab) ?? null;

  return (
    <div className="px-4 md:px-6 py-4 pb-20 md:pb-10 max-w-[720px] mx-auto">
      <h1 className="text-lg font-bold text-center md:text-left mb-4">Activity</h1>
      <div className="flex gap-2 overflow-x-auto no-scrollbar mb-4">
        {TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setTab(t.key)}
            className={cn(
              "px-3.5 py-1.5 rounded-full text-[13px] font-semibold whitespace-nowrap",
              tab === t.key ? "bg-white text-black" : "bg-chip hover:bg-white/20"
            )}
          >
            {t.label}
          </button>
        ))}
      </div>

      {filtered === null ? (
        <div className="flex justify-center py-16">
          <Loader2 size={26} className="animate-spin text-accent" />
        </div>
      ) : filtered.length === 0 ? (
        <div className="py-16 text-center">
          <Bell size={44} className="mx-auto text-white/20" />
          <p className="mt-4 font-semibold">Activity will appear here</p>
          <p className="text-white/45 text-sm mt-1">
            Likes, comments and new followers on your content
          </p>
        </div>
      ) : (
        <div className="divide-y divide-line">
          {filtered.map((item) => (
            <div key={item.key} className="flex items-center gap-3 py-3">
              <Link href={`/user/${item.actor.handle}`} className="shrink-0">
                <Avatar src={item.actor.avatarUrl} name={item.actor.name} size={42} />
              </Link>
              <div className="flex-1 min-w-0 text-[14px] leading-snug">
                <Link href={`/user/${item.actor.handle}`} className="font-bold hover:underline">
                  {item.actor.handle}
                </Link>{" "}
                <span className="text-white/70">
                  {item.type === "like" && "liked your video."}
                  {item.type === "comment" && `commented: “${item.text}”`}
                  {item.type === "follow" && "started following you."}
                </span>{" "}
                <span className="text-white/40 text-[12px]">{timeAgo(item.createdAt)}</span>
              </div>
              {item.video ? (
                <Link
                  href={`/video/${item.video.id}`}
                  className="w-11 h-14 rounded-md overflow-hidden bg-card shrink-0 flex items-center justify-center"
                >
                  {item.video.coverUrl ? (
                    <img
                      src={item.video.coverUrl}
                      alt=""
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <Film size={16} className="text-white/40" />
                  )}
                </Link>
              ) : (
                <FollowBack handle={item.actor.handle} />
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}