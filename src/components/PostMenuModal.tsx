"use client";

import { useState } from "react";
import Link from "next/link";
import {
  Bookmark,
  Check,
  ChevronLeft,
  Copy,
  Flag,
  Loader2,
  Pencil,
  Trash2,
  UserRound,
} from "lucide-react";
import HomeDialog from "@/components/home/HomeDialog";
import { useUI } from "@/components/UIProvider";
import { getViewerHandle } from "@/lib/identity";
import type { FeedVideo } from "@/lib/types";
import { cn } from "@/lib/utils";

const REPORT_REASONS = [
  "Obscene or explicit content",
  "Harassment or hate speech",
  "Violence or dangerous content",
  "Spam or misleading link",
] as const;

type ModalView = "menu" | "edit" | "delete" | "report";

export default function PostMenuModal({
  post,
  onClose,
  onUpdated,
  onRemoved,
  initialView = "menu",
}: {
  post: FeedVideo;
  onClose: () => void;
  onUpdated: (patch: Partial<FeedVideo>) => void;
  onRemoved: (videoId: number) => void;
  initialView?: ModalView;
}) {
  const { toast } = useUI();
  const isOwner = post.author.handle === getViewerHandle();
  const [view, setView] = useState<ModalView>(initialView);
  const [caption, setCaption] = useState(post.caption);
  const [musicName, setMusicName] = useState(post.musicName);
  const [reportReason, setReportReason] = useState<string>(REPORT_REASONS[0]);
  const [reportDetails, setReportDetails] = useState("");
  const [busy, setBusy] = useState(false);

  const handleToggleSave = async () => {
    if (busy) return;
    const next = !post.viewerSaved;
    onUpdated({
      viewerSaved: next,
      savesCount: Math.max(0, post.savesCount + (next ? 1 : -1)),
    });
    toast(next ? "Saved to Favorites" : "Removed from Favorites");
    try {
      const r = await fetch(`/api/videos/${post.id}/save`, { method: "POST" });
      if (r.ok) {
        const d = await r.json();
        onUpdated({ viewerSaved: d.saved, savesCount: d.savesCount });
      }
    } catch {
      /* ignore */
    }
    onClose();
  };

  const handleCopyLink = async () => {
    const url = `${window.location.origin}/video/${post.id}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Link copied to clipboard");
    } catch {
      toast(`Link: /video/${post.id}`);
    }
    onClose();
  };

  const handleSaveEdit = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${post.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ caption, musicName }),
      });
      const data = await res.json();

      if (res.status === 202 || data.hidden) {
        onRemoved(post.id);
        toast("Temporarily hidden while AI re-checks your edit");
        onClose();
        return;
      }

      if (!res.ok) {
        if (data.deleted) {
          onRemoved(post.id);
          toast(data.error ?? "Removed automatically by AI moderation");
          onClose();
          return;
        }
        toast(data.error ?? "Could not update post");
        return;
      }

      onUpdated({
        caption: data.video?.caption ?? caption,
        musicName: data.video?.musicName ?? musicName,
      });
      toast("Post updated");
      onClose();
    } catch {
      toast("Could not update post — please try again");
    } finally {
      setBusy(false);
    }
  };

  const handleConfirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${post.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not delete post");
        return;
      }
      onRemoved(post.id);
      toast("Post permanently deleted");
      onClose();
    } catch {
      toast("Delete failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitReport = async () => {
    if (busy || !reportReason) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${post.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          reason: reportReason,
          details: reportDetails.trim(),
        }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not submit report");
        return;
      }
      if (data.removed) {
        onRemoved(post.id);
      }
      toast(data.message ?? "Report submitted");
      onClose();
    } catch {
      toast("Report failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  const dialogTitle =
    view === "menu"
      ? "Options"
      : view === "edit"
        ? "Edit post"
        : view === "delete"
          ? "Delete post"
          : "Report post";

  const handle = encodeURIComponent(post.author.handle);

  return (
    <HomeDialog title={dialogTitle} onClose={() => !busy && onClose()}>
      {view === "menu" && (
        <div className="sx-action-menu">
          {isOwner && (
            <>
              <button
                type="button"
                onClick={() => setView("edit")}
                aria-label="Edit"
              >
                <Pencil size={19} />
                <span>Edit</span>
              </button>
              <button
                type="button"
                onClick={() => setView("delete")}
                aria-label="Delete"
                className="text-[#fe2c55] font-semibold"
              >
                <Trash2 size={19} />
                <span>Delete</span>
              </button>
            </>
          )}

          <button
            type="button"
            onClick={() => setView("report")}
            aria-label="Report"
          >
            <Flag size={19} />
            <span>Report</span>
          </button>

          <div className="my-1 border-t border-white/10" />

          <button type="button" onClick={handleToggleSave}>
            <Bookmark size={19} fill={post.viewerSaved ? "currentColor" : "none"} />
            <span>{post.viewerSaved ? "Remove from favorites" : "Save to favorites"}</span>
            {post.viewerSaved && <Check size={17} className="ml-auto text-white/70" />}
          </button>

          <button type="button" onClick={handleCopyLink}>
            <Copy size={19} />
            <span>Copy link</span>
          </button>

          <Link href={`/user/${handle}`} onClick={onClose}>
            <UserRound size={19} />
            <span>View @{post.author.handle}</span>
          </Link>
        </div>
      )}

      {view === "edit" && (
        <div className="p-4 space-y-4">
          <button
            type="button"
            onClick={() => setView("menu")}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white/55 hover:text-white"
          >
            <ChevronLeft size={15} /> Back
          </button>

          <div>
            <div className="flex items-center justify-between mb-1.5">
              <label htmlFor="sx-edit-caption" className="text-[13px] font-semibold text-white/85">
                Caption
              </label>
              <span className="text-[11.5px] text-white/40">{caption.length}/300</span>
            </div>
            <textarea
              id="sx-edit-caption"
              value={caption}
              onChange={(e) => setCaption(e.target.value.slice(0, 300))}
              rows={4}
              placeholder="Write your caption..."
              className="w-full rounded-xl bg-[#181818] border border-white/10 p-3 text-[14px] text-white outline-none focus:border-white/30 resize-none"
            />
          </div>

          <div>
            <label htmlFor="sx-edit-sound" className="block text-[13px] font-semibold text-white/85 mb-1.5">
              Sound name
            </label>
            <input
              id="sx-edit-sound"
              value={musicName}
              onChange={(e) => setMusicName(e.target.value.slice(0, 120))}
              placeholder="original sound"
              className="w-full rounded-xl bg-[#181818] border border-white/10 px-3 py-2.5 text-[14px] text-white outline-none focus:border-white/30"
            />
          </div>

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setView("menu")}
              className="flex-1 h-11 rounded-xl bg-white/10 font-semibold text-[14px] hover:bg-white/15"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSaveEdit}
              className="flex-1 h-11 rounded-xl bg-white text-black font-bold text-[14px] hover:bg-white/90 disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              <span>{busy ? "Saving…" : "Save changes"}</span>
            </button>
          </div>
        </div>
      )}

      {view === "delete" && (
        <div className="p-5 space-y-4">
          <div className="space-y-1.5">
            <p className="text-[15px] font-bold text-white">Delete permanently?</p>
            <p className="text-[13px] leading-relaxed text-white/60">
              This will permanently remove your post and its uploaded files from SocialX, including
              Feed, Profile, Search, Database, and Storage. This action cannot be undone.
            </p>
          </div>
          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setView("menu")}
              className="flex-1 h-11 rounded-xl bg-white/10 font-semibold text-[14px] hover:bg-white/15"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleConfirmDelete}
              className="flex-1 h-11 rounded-xl bg-[#fe2c55] text-white font-bold text-[14px] hover:bg-[#ef2950] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              <span>{busy ? "Deleting…" : "Confirm Delete"}</span>
            </button>
          </div>
        </div>
      )}

      {view === "report" && (
        <div className="p-4 space-y-3.5">
          <button
            type="button"
            onClick={() => setView("menu")}
            className="inline-flex items-center gap-1 text-[12.5px] font-semibold text-white/55 hover:text-white"
          >
            <ChevronLeft size={15} /> Back
          </button>

          <p className="text-[13px] text-white/65 leading-snug">
            Why are you reporting this content? Our server AI will immediately re-check it.
          </p>

          <div className="space-y-2" role="radiogroup" aria-label="Report reason">
            {REPORT_REASONS.map((r) => {
              const selected = reportReason === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="radio"
                  aria-checked={selected}
                  onClick={() => setReportReason(r)}
                  className={cn(
                    "w-full flex items-center justify-between px-3.5 py-2.5 rounded-xl border text-left text-[13.5px] transition-colors",
                    selected
                      ? "border-white bg-white/10 text-white font-semibold"
                      : "border-white/10 bg-[#141414] text-white/75 hover:bg-white/5"
                  )}
                >
                  <span>{r}</span>
                  {selected && <Check size={16} />}
                </button>
              );
            })}
          </div>

          <textarea
            value={reportDetails}
            onChange={(e) => setReportDetails(e.target.value.slice(0, 300))}
            rows={2}
            placeholder="Optional details..."
            className="w-full rounded-xl bg-[#181818] border border-white/10 p-3 text-[13.5px] text-white outline-none focus:border-white/30 resize-none"
          />

          <div className="flex gap-2.5 pt-1">
            <button
              type="button"
              disabled={busy}
              onClick={() => setView("menu")}
              className="flex-1 h-11 rounded-xl bg-white/10 font-semibold text-[14px] hover:bg-white/15"
            >
              Cancel
            </button>
            <button
              type="button"
              disabled={busy}
              onClick={handleSubmitReport}
              className="flex-1 h-11 rounded-xl bg-[#fe2c55] text-white font-bold text-[14px] hover:bg-[#ef2950] disabled:opacity-50 inline-flex items-center justify-center gap-2"
            >
              {busy && <Loader2 size={15} className="animate-spin" />}
              <span>{busy ? "Checking…" : "Submit Report"}</span>
            </button>
          </div>
        </div>
      )}
    </HomeDialog>
  );
}
