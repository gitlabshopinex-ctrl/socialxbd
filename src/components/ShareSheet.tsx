"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Download,
  Flag,
  HeartCrack,
  Link2,
  Loader2,
  Lock,
  Mic2,
  Plus,
  Repeat2,
  Search,
  Sparkles,
  Trash2,
  Users,
  Wallet,
  X,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import { useUI } from "@/components/UIProvider";
import { getViewerHandle } from "@/lib/identity";
import type { Author, FeedVideo } from "@/lib/types";
import { cn } from "@/lib/utils";

const REPORT_REASONS = [
  "Obscene or explicit content",
  "Harassment or hate speech",
  "Violence or dangerous content",
  "Spam or misleading link",
] as const;

function WhatsAppGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2.4a9.3 9.3 0 0 0-8 14l-1 3.6 3.7-1A9.3 9.3 0 1 0 12 2.4Zm0 2a7.3 7.3 0 1 1-3.8 13.5l-.5-.3-2 .5.6-2-.4-.5A7.3 7.3 0 0 1 12 4.4Zm-3 3.2c-.2 0-.5.1-.7.4-.2.3-.8.8-.8 2s.8 2.3.9 2.5c.2.3 2.2 3.4 5.4 4.6 2.7 1 3.2.8 3.8.8.6-.1 1.8-.8 2.1-1.5.3-.7.3-1.4.2-1.5-.1-.2-.3-.2-.7-.4l-2-1c-.3-.1-.5-.2-.7.1l-.8 1c-.2.2-.3.2-.6.1-.3-.1-1.3-.5-2.4-1.5-.9-.8-1.5-1.8-1.7-2.1-.2-.3 0-.4.1-.6l.5-.6c.2-.2.2-.3.3-.5.1-.2 0-.4 0-.6l-.8-2c-.2-.5-.4-.5-.6-.5Z" />
    </svg>
  );
}

function MessengerGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 2C6.6 2 2.2 6 2.2 11c0 2.9 1.5 5.5 3.8 7.2V22l3.7-2c1 .3 1.5.4 2.3.4 5.4 0 9.8-4 9.8-9S17.4 2 12 2Zm.1 3.8c3.9 0 7 2.9 7 6.4 0 3.6-3.1 6.4-7 6.4-.8 0-1.5-.1-2.2-.3l-1.8 1v-1.8c-1.5-1-2.5-2.5-2.5-4.3 0-3.5 3-6.4 6.5-6.4Zm-3.2 4.1-1.8 2.9 3.5 1.8 3-3.6-3.2-1.9-1.5.8Z" />
    </svg>
  );
}

function FacebookGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M13.6 22v-8.2h2.8l.4-3.2h-3.2V8.5c0-.9.3-1.6 1.7-1.6h1.7V4.1c-.3 0-1.3-.1-2.5-.1-2.5 0-4.2 1.5-4.2 4.3v2.3H7.5v3.2h2.8V22h3.3Z" />
    </svg>
  );
}

function StatusGlyph() {
  return (
    <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true">
      <path d="M12 3a9 9 0 1 0 9 9" />
      <path d="M18 3h3v3M12 8v8M8 12h8" />
    </svg>
  );
}

type View = "main" | "report" | "delete";

export default function ShareSheet({
  post,
  isOwner,
  onClose,
  onDeleted,
  onHide,
  onManage,
  onUpdated,
}: {
  post: FeedVideo;
  isOwner: boolean;
  onClose: () => void;
  onDeleted?: (videoId: number) => void;
  onHide?: (videoId: number) => void;
  onManage?: () => void;
  onUpdated?: (patch: Partial<FeedVideo>) => void;
}) {
  const { toast } = useUI();
  const [view, setView] = useState<View>("main");
  const [people, setPeople] = useState<Author[]>([]);
  const [reason, setReason] = useState<string>(REPORT_REASONS[0]);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    fetch("/api/suggestions")
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { following?: Author[]; suggested?: Author[] } | null) => {
        if (!d) return;
        const all = [...(d.following ?? []), ...(d.suggested ?? [])].filter(
          (u) => u.handle !== getViewerHandle()
        );
        const seen = new Set<number>();
        setPeople(all.filter((u) => (seen.has(u.id) ? false : (seen.add(u.id), true))).slice(0, 8));
      })
      .catch(() => setPeople([]));
  }, []);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const shareUrl =
    typeof window === "undefined" ? "" : `${window.location.origin}/video/${post.id}`;

  const recordShare = () => {
    fetch(`/api/videos/${post.id}/share`, { method: "POST" })
      .then((r) => (r.ok ? r.json() : null))
      .then((d: { sharesCount?: number } | null) => {
        if (d?.sharesCount !== undefined) onUpdated?.({ sharesCount: d.sharesCount });
      })
      .catch(() => {});
  };

  const openExternal = (url: string) => {
    window.open(url, "_blank", "noopener,noreferrer");
    recordShare();
  };

  const copyLink = async () => {
    try {
      await navigator.clipboard.writeText(shareUrl);
      toast("Link copied to clipboard");
    } catch {
      toast(`Link: /video/${post.id}`);
    }
    recordShare();
    onClose();
  };

  const sendNativeShare = async () => {
    if (navigator.share) {
      try {
        await navigator.share({ title: `${post.author.name} on SocialX`, text: post.caption, url: shareUrl });
        recordShare();
        onClose();
        return;
      } catch (error) {
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    await copyLink();
  };

  const mediaUrl = post.images?.[0]?.url ?? post.videoUrl ?? post.coverUrl;

  const downloadMedia = () => {
    if (!mediaUrl) {
      toast("No media to download");
      return;
    }
    const anchor = document.createElement("a");
    anchor.href = mediaUrl;
    anchor.download = `socialx-${post.id}`;
    anchor.rel = "noopener";
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    toast("Download started");
    onClose();
  };

  const confirmDelete = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${post.id}`, { method: "DELETE" });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not delete post");
        return;
      }
      onDeleted?.(post.id);
      toast("Post permanently deleted");
      onClose();
    } catch {
      toast("Delete failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  const submitReport = async () => {
    if (busy) return;
    setBusy(true);
    try {
      const res = await fetch(`/api/videos/${post.id}/report`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason }),
      });
      const data = await res.json().catch(() => ({}));
      if (!res.ok) {
        toast(data.error ?? "Could not submit report");
        onClose();
        return;
      }
      if (data.removed) onDeleted?.(post.id);
      toast(data.message ?? "Report submitted");
      onClose();
    } catch {
      toast("Report failed — please try again");
    } finally {
      setBusy(false);
    }
  };

  const AppButton = ({
    label,
    tone,
    glyph,
    onClick,
  }: {
    label: string;
    tone: string;
    glyph: React.ReactNode;
    onClick: () => void;
  }) => (
    <button type="button" onClick={onClick} className="sx-share-app" aria-label={label}>
      <span className="sx-share-app-icon" style={{ background: tone }}>
        {glyph}
      </span>
      <span className="sx-share-app-label">{label}</span>
    </button>
  );

  const ActionButton = ({
    label,
    icon,
    onClick,
    tone,
  }: {
    label: string;
    icon: React.ReactNode;
    onClick: () => void;
    tone?: string;
  }) => (
    <button type="button" onClick={onClick} className="sx-share-action" aria-label={label}>
      <span className="sx-share-action-icon" style={tone ? { background: tone, color: "#fff" } : undefined}>
        {icon}
      </span>
      <span className="sx-share-action-label">{label}</span>
    </button>
  );

  return (
    <div className="sx-share-overlay" role="dialog" aria-modal="true" aria-label="Send to">
      <button type="button" className="sx-share-backdrop" aria-label="Close share sheet" onClick={onClose} />
      <div className="sx-share-sheet animate-sheet-up">
        <header className="sx-share-header">
          <Link href="/search" aria-label="Search" onClick={onClose} className="sx-share-header-btn">
            <Search size={23} strokeWidth={1.9} />
          </Link>
          <h2>Send to</h2>
          <button type="button" aria-label="Close" onClick={onClose} className="sx-share-header-btn">
            <X size={23} strokeWidth={2} />
          </button>
        </header>

        {view === "main" && (
          <>
            <div className="sx-share-people no-scrollbar" aria-label="Send to people">
              {people.map((user) => (
                <button
                  key={user.id}
                  type="button"
                  className="sx-share-person"
                  aria-label={`Send to ${user.name}`}
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(shareUrl);
                      toast(`Link copied for @${user.handle}`);
                    } catch {
                      toast(`Share /video/${post.id} with ${user.name}`);
                    }
                    recordShare();
                    onClose();
                  }}
                >
                  <Avatar src={user.avatarUrl} name={user.name} size={58} />
                  <span className="sx-share-person-name">{user.name.split(" ")[0]}</span>
                </button>
              ))}
              {people.length === 0 && (
                <p className="sx-share-people-empty">Loading people to share with…</p>
              )}
            </div>

            <div className="sx-share-apps no-scrollbar">
              {!isOwner && (
                <AppButton
                  label="Repost"
                  tone="#F4B400"
                  glyph={<Repeat2 size={22} strokeWidth={2.1} />}
                  onClick={() => {
                    toast("Reposts are coming soon");
                  }}
                />
              )}
              <AppButton
                label="WhatsApp"
                tone="#25D366"
                glyph={<WhatsAppGlyph />}
                onClick={() =>
                  openExternal(`https://wa.me/?text=${encodeURIComponent(`${post.caption} ${shareUrl}`)}`)
                }
              />
              <AppButton label="Copy link" tone="#2A6BF2" glyph={<Link2 size={22} strokeWidth={2.1} />} onClick={copyLink} />
              <AppButton
                label="Messenger"
                tone="#0084FF"
                glyph={<MessengerGlyph />}
                onClick={() =>
                  openExternal(
                    `https://www.facebook.com/messages/compose?link=${encodeURIComponent(shareUrl)}`
                  )
                }
              />
              <AppButton
                label="Facebook"
                tone="#1877F2"
                glyph={<FacebookGlyph />}
                onClick={() =>
                  openExternal(
                    `https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(shareUrl)}`
                  )
                }
              />
              <AppButton label="Status" tone="#16A34A" glyph={<StatusGlyph />} onClick={sendNativeShare} />
            </div>

            <div className="sx-share-actions no-scrollbar">
              {isOwner ? (
                <>
                  <ActionButton
                    label="Privacy settings"
                    icon={<Lock size={21} strokeWidth={1.9} />}
                    onClick={() => {
                      onClose();
                      onManage?.();
                    }}
                  />
                  <ActionButton
                    label="Ad settings"
                    icon={<Wallet size={21} strokeWidth={1.9} />}
                    onClick={() => toast("Ad settings are coming soon")}
                  />
                  <ActionButton
                    label="Delete"
                    tone="#E23636"
                    icon={<Trash2 size={21} strokeWidth={1.9} />}
                    onClick={() => setView("delete")}
                  />
                  <ActionButton label="Download" icon={<Download size={21} strokeWidth={1.9} />} onClick={downloadMedia} />
                  <ActionButton
                    label="Add to Story"
                    icon={<Plus size={21} strokeWidth={2} />}
                    onClick={() => toast("Stories are coming soon")}
                  />
                </>
              ) : (
                <>
                  <ActionButton
                    label="Report"
                    icon={<Flag size={21} strokeWidth={1.9} />}
                    onClick={() => setView("report")}
                  />
                  <ActionButton
                    label="Not interested"
                    icon={<HeartCrack size={21} strokeWidth={1.9} />}
                    onClick={() => {
                      onHide?.(post.id);
                      toast("Thanks — you'll see fewer posts like this");
                      onClose();
                    }}
                  />
                  <ActionButton
                    label="Add to Story"
                    icon={<Plus size={21} strokeWidth={2} />}
                    onClick={() => toast("Stories are coming soon")}
                  />
                  <ActionButton
                    label="Create group"
                    icon={<Users size={21} strokeWidth={1.9} />}
                    onClick={() => toast("Group chats are coming soon")}
                  />
                  <ActionButton
                    label="Duet"
                    icon={<Mic2 size={21} strokeWidth={1.9} />}
                    onClick={() => toast("Duet is coming soon")}
                  />
                </>
              )}
            </div>
          </>
        )}

        {view === "report" && (
          <div className="sx-share-panel">
            <p className="sx-share-panel-title">Why are you reporting this?</p>
            <p className="sx-share-panel-note">
              Our server AI immediately re-checks reported posts and removes policy violations.
            </p>
            <div className="sx-share-reasons">
              {REPORT_REASONS.map((r) => (
                <button
                  key={r}
                  type="button"
                  onClick={() => setReason(r)}
                  aria-pressed={reason === r}
                  className={cn("sx-share-reason", reason === r && "sx-share-reason-active")}
                >
                  {r}
                </button>
              ))}
            </div>
            <div className="sx-share-panel-actions">
              <button type="button" onClick={() => setView("main")} className="sx-share-plain-btn">
                Back
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={submitReport}
                className="sx-share-primary-btn"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Submit report
              </button>
            </div>
          </div>
        )}

        {view === "delete" && (
          <div className="sx-share-panel">
            <p className="sx-share-panel-title">Delete this post?</p>
            <p className="sx-share-panel-note">
              This permanently removes the post and its media from SocialX, including Feed, Profile,
              Search, Database and Storage.
            </p>
            <div className="sx-share-panel-actions">
              <button type="button" onClick={() => setView("main")} className="sx-share-plain-btn">
                Cancel
              </button>
              <button
                type="button"
                disabled={busy}
                onClick={confirmDelete}
                className="sx-share-danger-btn"
              >
                {busy && <Loader2 size={15} className="animate-spin" />}
                Delete
              </button>
            </div>
          </div>
        )}

        <p className="sx-share-footer-note">
          <Sparkles size={13} className="inline -mt-0.5" /> Sharing uses real SocialX links and open
          external apps.
        </p>
      </div>
    </div>
  );
}
