"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Heart, Loader2, X } from "lucide-react";
import Avatar from "@/components/Avatar";
import type { CommentItem } from "@/lib/types";
import { cn, formatCount, timeAgo } from "@/lib/utils";

export default function CommentsPanel({
  videoId,
  authorHandle,
  onClose,
  className,
  onPosted,
}: {
  videoId: number;
  authorHandle: string;
  onClose?: () => void;
  className?: string;
  onPosted?: (commentsCount: number) => void;
}) {
  const [items, setItems] = useState<CommentItem[] | null>(null);
  const [text, setText] = useState("");
  const [posting, setPosting] = useState(false);
  const [likedIds, setLikedIds] = useState<Set<number>>(new Set());
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    let cancelled = false;
    fetch(`/api/videos/${videoId}/comments`)
      .then((r) => r.json())
      .then((d) => {
        if (!cancelled) setItems(d.comments ?? []);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [videoId]);

  const post = async () => {
    const trimmed = text.trim();
    if (!trimmed || posting) return;
    setPosting(true);
    try {
      const r = await fetch(`/api/videos/${videoId}/comments`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: trimmed }),
      });
      const d = await r.json();
      if (r.ok) {
        setItems((prev) => [d.comment, ...(prev ?? [])]);
        setText("");
        if (typeof d.commentsCount === "number") onPosted?.(d.commentsCount);
      }
    } finally {
      setPosting(false);
    }
  };

  const toggleCommentLike = (id: number) => {
    setLikedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  return (
    <div className={cn("flex flex-col h-full min-h-0", className)}>
      <div className="flex items-center justify-between px-4 py-3 border-b border-line shrink-0">
        <span className="font-semibold text-[15px]">
          Comments {items ? `(${formatCount(items.length)})` : ""}
        </span>
        {onClose && (
          <button onClick={onClose} aria-label="Close comments" className="p-1 hover:bg-white/10 rounded-full">
            <X size={20} />
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto thin-scrollbar px-4 py-4 space-y-5 min-h-0">
        {items === null && (
          <div className="flex justify-center py-10">
            <Loader2 size={24} className="animate-spin text-accent" />
          </div>
        )}
        {items?.length === 0 && (
          <p className="text-center text-white/40 text-sm py-10">
            Be the first to comment!
          </p>
        )}
        {items?.map((c) => {
          const liked = likedIds.has(c.id);
          return (
            <div key={c.id} className="flex gap-2.5">
              <Link href={`/user/${c.author.handle}`} className="shrink-0 pt-0.5">
                <Avatar src={c.author.avatarUrl} name={c.author.name} size={32} />
              </Link>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5">
                  <Link
                    href={`/user/${c.author.handle}`}
                    className="text-[13px] font-semibold text-white/60 hover:underline truncate"
                  >
                    {c.author.name}
                  </Link>
                  {c.author.handle === authorHandle && (
                    <span className="text-[11px] font-semibold text-accent shrink-0">Creator</span>
                  )}
                </div>
                <p className="text-[14px] leading-snug break-words mt-0.5">{c.text}</p>
                <div className="flex items-center gap-4 mt-1 text-[12px] text-white/40">
                  <span>{timeAgo(c.createdAt)}</span>
                  <button
                    className="font-semibold hover:text-white/70"
                    onClick={() => {
                      setText(`@${c.author.handle} `);
                      inputRef.current?.focus();
                    }}
                  >
                    Reply
                  </button>
                </div>
              </div>
              <button
                onClick={() => toggleCommentLike(c.id)}
                className="flex flex-col items-center gap-0.5 pt-4 shrink-0"
                aria-label="Like comment"
              >
                <Heart
                  size={16}
                  fill="currentColor"
                  strokeWidth={0}
                  className={liked ? "text-accent" : "text-white/40"}
                />
                <span className="text-[11px] text-white/40">
                  {formatCount(c.likesCount + (liked ? 1 : 0))}
                </span>
              </button>
            </div>
          );
        })}
      </div>

      <div className="border-t border-line p-3 flex items-center gap-2 shrink-0">
        <input
          ref={inputRef}
          value={text}
          onChange={(e) => setText(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") post();
          }}
          maxLength={300}
          placeholder="Add comment..."
          className="flex-1 bg-chip rounded-lg px-3.5 py-2.5 text-[14px] outline-none placeholder:text-white/35 focus:ring-1 focus:ring-white/25"
        />
        <button
          onClick={post}
          disabled={!text.trim() || posting}
          className="px-2 py-2 text-accent font-semibold text-[14px] disabled:opacity-40 shrink-0"
        >
          {posting ? <Loader2 size={18} className="animate-spin" /> : "Post"}
        </button>
      </div>
    </div>
  );
}