"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { ArrowLeft, BadgeCheck, Loader2, Search } from "lucide-react";
import Avatar from "@/components/Avatar";
import VideoGrid from "@/components/VideoGrid";
import { useUI } from "@/components/UIProvider";
import type { FeedVideo, SearchUser } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

const TRENDING = ["#fyp", "#dance", "#foodtok", "#nature", "#skate", "#puppy", "#sunset"];

function UserRow({ user }: { user: SearchUser }) {
  const { toast } = useUI();
  const [following, setFollowing] = useState(user.viewerFollows);
  const [busy, setBusy] = useState(false);

  const toggle = async () => {
    if (busy) return;
    setBusy(true);
    const next = !following;
    setFollowing(next);
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(user.handle)}/follow`, {
        method: "POST",
      });
      const d = await r.json();
      if (r.ok) {
        setFollowing(d.following);
        toast(d.following ? `Following @${user.handle}` : `Unfollowed @${user.handle}`);
      } else {
        setFollowing(!next);
        toast(d.error ?? "Something went wrong");
      }
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex items-center gap-3 py-2.5">
      <Link href={`/user/${user.handle}`}>
        <Avatar src={user.avatarUrl} name={user.name} size={48} />
      </Link>
      <div className="flex-1 min-w-0">
        <Link
          href={`/user/${user.handle}`}
          className="font-bold text-[15px] hover:underline flex items-center gap-1"
        >
          <span className="truncate">{user.handle}</span>
          {user.verified && <BadgeCheck size={14} className="text-aqua shrink-0" />}
        </Link>
        <p className="text-[13px] text-white/50 truncate">
          {user.name} · {formatCount(user.followersCount)} followers
        </p>
      </div>
      <button
        onClick={toggle}
        disabled={busy}
        className={cn(
          "px-5 py-1.5 rounded-lg text-[13px] font-semibold shrink-0",
          following ? "bg-chip text-white" : "bg-accent text-white"
        )}
      >
        {following ? "Following" : "Follow"}
      </button>
    </div>
  );
}

export default function SearchClient() {
  const router = useRouter();
  const params = useSearchParams();
  const q = params.get("q") ?? "";
  const [input, setInput] = useState(q);
  const [tab, setTab] = useState<"top" | "videos" | "users">("top");
  const [results, setResults] = useState<{ videos: FeedVideo[]; users: SearchUser[] } | null>(null);

  useEffect(() => {
    setInput(q);
    if (!q) {
      setResults(null);
      return;
    }
    let cancelled = false;
    setResults(null);
    fetch(`/api/search?q=${encodeURIComponent(q)}`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setResults({ videos: d.videos ?? [], users: d.users ?? [] });
      })
      .catch(() => {
        if (!cancelled) setResults({ videos: [], users: [] });
      });
    return () => {
      cancelled = true;
    };
  }, [q]);

  return (
    <div className="px-3 md:px-6 py-3 md:py-5 pb-20 md:pb-10 max-w-[1200px] mx-auto">
      <form
        className="flex items-center gap-2 mb-4 max-w-[640px] mx-auto"
        onSubmit={(e) => {
          e.preventDefault();
          if (input.trim()) router.push(`/search?q=${encodeURIComponent(input.trim())}`);
        }}
      >
        <button type="button" onClick={() => router.back()} aria-label="Back" className="p-1">
          <ArrowLeft size={22} />
        </button>
        <div className="flex-1 flex items-center rounded-full bg-chip overflow-hidden">
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Search"
            className="flex-1 bg-transparent px-4 py-2 text-[14px] outline-none placeholder:text-white/40 min-w-0"
          />
          <button type="submit" aria-label="Search" className="px-3 text-white/60">
            <Search size={18} />
          </button>
        </div>
      </form>

      {!q ? (
        <div className="py-10 text-center">
          <Search size={44} className="mx-auto text-white/20" />
          <p className="mt-4 font-semibold text-lg">Find your next favorite video</p>
          <p className="text-white/45 text-sm mt-1">Search videos, creators and sounds</p>
          <div className="mt-6 flex flex-wrap justify-center gap-2">
            {TRENDING.map((t) => (
              <Link
                key={t}
                href={`/search?q=${encodeURIComponent(t)}`}
                className="px-4 py-1.5 rounded-full bg-chip hover:bg-white/20 text-[13px] font-semibold"
              >
                {t}
              </Link>
            ))}
          </div>
        </div>
      ) : (
        <>
          <div className="flex gap-1 border-b border-line mb-4">
            {(["top", "videos", "users"] as const).map((t) => (
              <button
                key={t}
                onClick={() => setTab(t)}
                className={cn(
                  "px-5 py-2.5 text-[14px] font-semibold capitalize border-b-2 -mb-px",
                  tab === t ? "border-white text-white" : "border-transparent text-white/45"
                )}
              >
                {t}
              </button>
            ))}
          </div>

          {results === null ? (
            <div className="flex justify-center py-16">
              <Loader2 size={26} className="animate-spin text-accent" />
            </div>
          ) : results.videos.length === 0 && results.users.length === 0 ? (
            <div className="py-16 text-center text-white/45">
              <p className="font-semibold text-white/70">No results for “{q}”</p>
              <p className="text-sm mt-1">Try different keywords or check the spelling</p>
            </div>
          ) : (
            <>
              {(tab === "top" || tab === "users") && results.users.length > 0 && (
                <div className={cn("mb-6", tab === "top" && "max-w-xl")}>
                  {tab === "top" && (
                    <p className="text-[13px] font-semibold text-white/50 mb-1">Accounts</p>
                  )}
                  {(tab === "users" ? results.users : results.users.slice(0, 3)).map((u) => (
                    <UserRow key={u.id} user={u} />
                  ))}
                </div>
              )}
              {(tab === "top" || tab === "videos") && (
                <VideoGrid videos={results.videos} emptyText="No videos found" />
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}