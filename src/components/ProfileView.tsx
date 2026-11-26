"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BadgeCheck,
  Bookmark,
  Camera,
  ChevronLeft,
  ChevronRight,
  Copy,
  Heart,
  Images,
  Loader2,
  Lock,
  Menu,
  MoreHorizontal,
  Pencil,
  Play,
  Plus,
  Repeat2,
  UserPlus,
} from "lucide-react";
import Avatar from "@/components/Avatar";
import SocialMenuDialog from "@/components/SocialMenuDialog";
import { useUI } from "@/components/UIProvider";
import type { FeedVideo, ProfileData } from "@/lib/types";
import { cn, formatCount } from "@/lib/utils";

type ProfileTab = "videos" | "photos" | "private" | "reposts" | "saved" | "liked";

function CalendarStarSvg() {
  return (
    <svg width={22} height={22} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <rect x="3" y="4.5" width="18" height="16" rx="2.5" />
      <path d="M8 2.5v3M16 2.5v3M3 9h18" />
      <path d="M12 11.4l.85 1.72 1.9.28-1.38 1.34.33 1.9-1.7-.9-1.7.9.33-1.9-1.38-1.34 1.9-.28L12 11.4Z" fill="currentColor" stroke="none" />
    </svg>
  );
}

function ProfileBarsTabSvg() {
  return (
    <span className="inline-flex items-center gap-0.5">
      <svg width={19} height={19} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.2} strokeLinecap="round" aria-hidden="true">
        <path d="M6 5v6M6 15v4M12 5v10M12 18.5v.5M18 5v4M18 13v6" />
      </svg>
      <svg width={8} height={8} viewBox="0 0 12 12" fill="currentColor" aria-hidden="true">
        <path d="M2.5 4.5 6 8l3.5-3.5H2.5Z" />
      </svg>
    </span>
  );
}

function StickerTabSvg() {
  return (
    <svg width={20} height={20} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.9} strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M15.5 3.5H7A3.5 3.5 0 0 0 3.5 7v10A3.5 3.5 0 0 0 7 20.5h6.5L20.5 13.5V7A3.5 3.5 0 0 0 17 3.5h-1.5Z" />
      <path d="M14 20.5V16a2 2 0 0 1 2-2h4.5" />
      <circle cx="9" cy="10" r="1" fill="currentColor" stroke="none" />
      <circle cx="14" cy="10" r="1" fill="currentColor" stroke="none" />
      <path d="M9.5 13.5c.8.9 2.2.9 3 0" />
    </svg>
  );
}


function formatGridViews(n: number): string {
  if (n < 10_000) return n.toLocaleString("en-US");
  return formatCount(n);
}

function renderBioWithLinks(bio: string) {
  const parts = bio.split(/(https?:\/\/[^\s]+|[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,})/g);
  return parts.map((part, idx) => {
    if (/^https?:\/\//i.test(part)) {
      return (
        <a
          key={idx}
          href={part}
          target="_blank"
          rel="noopener noreferrer"
          className="font-semibold text-[var(--p-text)] hover:underline"
        >
          {part}
        </a>
      );
    }
    if (/^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$/.test(part)) {
      return (
        <a
          key={idx}
          href={`mailto:${part}`}
          className="font-medium text-[var(--p-text)] hover:underline"
        >
          {part}
        </a>
      );
    }
    return <span key={idx}>{part}</span>;
  });
}

export default function ProfileView({
  handle,
  initialProfile = null,
}: {
  handle: string;
  initialProfile?: ProfileData | null;
}) {
  const router = useRouter();
  const { toast, openUpload } = useUI();
  const [profile, setProfile] = useState<ProfileData | null>(initialProfile);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<ProfileTab>("videos");
  const [editOpen, setEditOpen] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [name, setName] = useState(initialProfile?.user.name ?? "");
  const [bio, setBio] = useState(initialProfile?.user.bio ?? "");
  const [saving, setSaving] = useState(false);
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const avatarInputRef = useRef<HTMLInputElement>(null);
  const [fieldEdit, setFieldEdit] = useState<null | "name" | "username" | "bio">(null);
  const [uname, setUname] = useState("");
  const [unameStatus, setUnameStatus] = useState<
    "checking" | "available" | "unavailable" | "invalid"
  >("available");
  const [followBusy, setFollowBusy] = useState(false);

  const load = useCallback(() => {
    setNotFound(false);
    fetch(`/api/users/${encodeURIComponent(handle)}`)
      .then(async (r) => {
        if (!r.ok) throw new Error();
        return r.json();
      })
      .then((d: ProfileData) => {
        setProfile(d);
        setName(d.user.name);
        setBio(d.user.bio);
      })
      .catch(() => setNotFound(true));
  }, [handle]);

  useEffect(() => {
    if (!initialProfile || initialProfile.user.handle !== handle) {
      setProfile(null);
      load();
    }
  }, [handle, initialProfile, load]);

  const toggleFollow = async () => {
    if (!profile || followBusy) return;
    setFollowBusy(true);
    const next = !profile.viewerFollows;
    setProfile({
      ...profile,
      viewerFollows: next,
      followersCount: Math.max(0, profile.followersCount + (next ? 1 : -1)),
    });
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(handle)}/follow`, {
        method: "POST",
      });
      const d = await r.json();
      if (r.ok) {
        setProfile((p) => (p ? { ...p, viewerFollows: d.following } : p));
        toast(d.following ? `Following @${handle}` : `Unfollowed @${handle}`);
      }
    } finally {
      setFollowBusy(false);
    }
  };

  const saveProfile = async () => {
    if (!name.trim() || saving) return;
    setSaving(true);
    try {
      const r = await fetch(`/api/users/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, bio }),
      });
      if (r.ok) {
        toast("Profile updated");
        setEditOpen(false);
        load();
      } else {
        const d = await r.json();
        toast(d.error ?? "Could not save");
      }
    } finally {
      setSaving(false);
    }
  };

  const copyProfileLink = async () => {
    const url = `${window.location.origin}/user/${handle}`;
    try {
      await navigator.clipboard.writeText(url);
      toast("Profile link copied");
    } catch {
      toast(`Link: /user/${handle}`);
    }
  };

  const changeAvatar = async (file: File | undefined | null) => {
    if (!file) return;
    if (!file.type.startsWith("image/")) {
      toast("Please choose an image file");
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      toast("Photo too large (max 5MB)");
      return;
    }
    // Show the chosen photo immediately while the server processes it.
    const previewUrl = URL.createObjectURL(file);
    const previousUrl = profile?.user.avatarUrl ?? "";
    setProfile((p) =>
      p ? { ...p, user: { ...p.user, avatarUrl: previewUrl } } : p
    );
    setUploadingAvatar(true);
    try {
      const fd = new FormData();
      fd.append("avatar", file);
      fd.append("name", name);
      fd.append("bio", bio);
      const r = await fetch(`/api/users/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        body: fd,
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        setProfile((p) =>
          p ? { ...p, user: { ...p.user, avatarUrl: previousUrl } } : p
        );
        toast(d.error ?? "Could not update photo");
        return;
      }
      setProfile((p) =>
        p ? { ...p, user: { ...p.user, avatarUrl: d.avatarUrl, name, bio } } : p
      );
      if (previewUrl.startsWith("blob:")) URL.revokeObjectURL(previewUrl);
      toast("Profile photo updated");
    } catch {
      setProfile((p) =>
        p ? { ...p, user: { ...p.user, avatarUrl: previousUrl } } : p
      );
      toast("Photo upload failed — please try again");
    } finally {
      setUploadingAvatar(false);
      if (avatarInputRef.current) avatarInputRef.current.value = "";
    }
  };

  // Username availability: check the real database while typing.
  useEffect(() => {
    if (fieldEdit !== "username") return;
    const value = uname.trim().toLowerCase();
    if (!/^[a-z0-9._]{3,24}$/.test(value)) {
      setUnameStatus("invalid");
      return;
    }
    if (value === profile?.user.handle) {
      setUnameStatus("available");
      return;
    }
    setUnameStatus("checking");
    const timer = setTimeout(() => {
      fetch(`/api/users/${encodeURIComponent(value)}`)
        .then((r) => r.json())
        .then((d: { user?: { handle?: string } }) =>
          setUnameStatus(d?.user?.handle ? "unavailable" : "available")
        )
        .catch(() => setUnameStatus("checking"));
    }, 350);
    return () => clearTimeout(timer);
  }, [fieldEdit, uname, profile?.user.handle]);

  const saveField = async () => {
    if (!fieldEdit || saving) return;
    if (fieldEdit === "username" && unameStatus !== "available") {
      toast("Username is unavailable");
      return;
    }
    setSaving(true);
    try {
      const payload: { name?: string; bio?: string; handle?: string } = {};
      if (fieldEdit === "name") {
        const trimmed = name.trim();
        if (!trimmed) return;
        payload.name = trimmed;
      }
      if (fieldEdit === "username") payload.handle = uname.trim().toLowerCase();
      if (fieldEdit === "bio") payload.bio = bio;

      const r = await fetch(`/api/users/${encodeURIComponent(handle)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const d = await r.json().catch(() => ({}));
      if (!r.ok) {
        toast(d.error ?? "Could not save");
        if (r.status === 409) setUnameStatus("unavailable");
        return;
      }
      if (payload.handle) {
        toast("Username updated");
        window.location.assign("/profile");
        return;
      }
      setProfile((p) =>
        p
          ? {
              ...p,
              user: {
                ...p.user,
                ...(payload.name ? { name: payload.name } : {}),
                ...(payload.bio !== undefined ? { bio: payload.bio } : {}),
              },
            }
          : p
      );
      toast(fieldEdit === "name" ? "Name updated" : "Bio updated");
      setFieldEdit(null);
    } catch {
      toast("Could not save — please try again");
    } finally {
      setSaving(false);
    }
  };

  const activeVideos = useMemo<FeedVideo[]>(() => {
    if (!profile) return [];
    switch (tab) {
      case "videos":
        return profile.videos;
      case "photos":
        return profile.videos.filter(
          (v) => !v.videoUrl || (v.images && v.images.length > 0)
        );
      case "private":
        return profile.reviewVideos ?? [];
      case "reposts":
        return [];
      case "saved":
        return profile.savedVideos ?? [];
      case "liked":
        return profile.likedVideos ?? [];
    }
  }, [profile, tab]);

  if (notFound) {
    return (
      <div className="sx-profile-page flex flex-col items-center justify-center gap-3 text-center px-6 py-24">
        <p className="font-bold text-lg text-[var(--p-text)]">This account doesn&apos;t exist</p>
        <p className="text-[var(--p-text-2)] text-sm">Try searching for another creator.</p>
        <Link href="/" className="px-6 py-2.5 rounded-full bg-[#FE2C55] text-white font-semibold text-sm">
          Go home
        </Link>
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="sx-profile-page px-4 py-4">
        <div className="flex justify-between items-center h-11 mb-4">
          <span className="w-6 h-6 rounded bg-black/10 animate-pulse" />
          <div className="flex gap-4">
            <span className="w-6 h-6 rounded bg-black/10 animate-pulse" />
            <span className="w-6 h-6 rounded bg-black/10 animate-pulse" />
            <span className="w-6 h-6 rounded bg-black/10 animate-pulse" />
          </div>
        </div>
        <div className="flex justify-between items-start">
          <div className="space-y-2.5 flex-1 pr-4">
            <div className="h-7 w-40 rounded bg-black/10 animate-pulse" />
            <div className="h-4 w-28 rounded bg-black/10 animate-pulse" />
            <div className="flex gap-6 pt-2">
              <div className="h-9 w-16 rounded bg-black/10 animate-pulse" />
              <div className="h-9 w-16 rounded bg-black/10 animate-pulse" />
              <div className="h-9 w-16 rounded bg-black/10 animate-pulse" />
            </div>
          </div>
          <div className="w-24 h-24 rounded-full bg-black/10 animate-pulse" />
        </div>
      </div>
    );
  }

  const u = profile.user;

  return (
    <div className="sx-profile-page">
      {/* Top Action Bar matching Screenshot */}
      <header className="sx-profile-topbar">
        {profile.isSelf ? (
          <button
            type="button"
            onClick={() => setEditOpen(true)}
            aria-label="Edit profile"
            className="sx-profile-top-btn"
          >
            <Pencil size={22} strokeWidth={1.85} />
          </button>
        ) : (
          <button
            type="button"
            onClick={() => router.back()}
            aria-label="Back"
            className="sx-profile-top-btn"
          >
            <ArrowLeft size={23} strokeWidth={2} />
          </button>
        )}

        <div className="flex items-center gap-4">
          <Link href="/activity" aria-label="Activity" className="sx-profile-top-btn">
            <CalendarStarSvg />
          </Link>
          <Link href="/explore" aria-label="Find creators" className="sx-profile-top-btn">
            <UserPlus size={22} strokeWidth={1.85} />
          </Link>
          <button
            type="button"
            onClick={() => setMenuOpen(true)}
            aria-label="Open menu"
            className="sx-profile-top-btn"
          >
            <Menu size={23} strokeWidth={1.9} />
          </button>
        </div>
      </header>

      {/* Main Profile Identity (Left Info/Stats + Right Avatar with Speech Bubble & Cyan +) */}
      <section className="px-4 pt-2 pb-3">
        <div className="flex items-start justify-between gap-3">
          {/* Left Identity & Stats */}
          <div className="min-w-0 flex-1 pt-1">
            {profile.isSelf ? (
              <button
                type="button"
                onClick={() => setEditOpen(true)}
                className="inline-flex items-center gap-1 text-left max-w-full group"
              >
                <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--p-text)] truncate leading-tight">
                  {u.name}
                </h1>
                {u.verified && <BadgeCheck size={17} className="text-[#20D5EC] shrink-0" />}
                <svg
                  width={12}
                  height={12}
                  viewBox="0 0 12 12"
                  fill="currentColor"
                  className="text-[var(--p-text)] shrink-0 mt-0.5"
                  aria-hidden="true"
                >
                  <path d="M2.2 4.2 6 8.2l3.8-4H2.2Z" />
                </svg>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1 max-w-full">
                <h1 className="text-[22px] font-extrabold tracking-tight text-[var(--p-text)] truncate leading-tight">
                  {u.name}
                </h1>
                {u.verified && <BadgeCheck size={17} className="text-[#20D5EC] shrink-0" />}
              </div>
            )}

            <p className="text-[13px] font-normal text-[var(--p-text-2)] mt-0.5">@{u.handle}</p>

            {/* Stacked Stats Row */}
            <div className="mt-3.5 flex items-center gap-6">
              <Link href="/following" className="text-left">
                <span className="block text-[16px] font-extrabold text-[var(--p-text)] leading-tight">
                  {formatCount(profile.followingCount)}
                </span>
                <span className="block text-[12px] text-[var(--p-text-2)] mt-0.5">Following</span>
              </Link>
              <button
                type="button"
                onClick={() => toast(`${formatCount(profile.followersCount)} Followers`)}
                className="text-left"
              >
                <span className="block text-[16px] font-extrabold text-[var(--p-text)] leading-tight">
                  {formatCount(profile.followersCount)}
                </span>
                <span className="block text-[12px] text-[var(--p-text-2)] mt-0.5">Followers</span>
              </button>
              <button
                type="button"
                onClick={() => toast(`${formatCount(profile.likesReceived)} total Likes`)}
                className="text-left"
              >
                <span className="block text-[16px] font-extrabold text-[var(--p-text)] leading-tight">
                  {formatCount(profile.likesReceived)}
                </span>
                <span className="block text-[12px] text-[var(--p-text-2)] mt-0.5">Likes</span>
              </button>
            </div>
          </div>

          {/* Right Avatar with Cyan + Badge */}
          <div className="relative shrink-0 pr-0.5">
            <div className="relative w-[92px] h-[92px]">
              <Avatar
                src={u.avatarUrl}
                name={u.name}
                size={92}
                className="ring-1 ring-black/10"
              />
              {profile.isSelf && (
                <button
                  type="button"
                  onClick={openUpload}
                  aria-label="Add to story or create post"
                  className="absolute bottom-0 right-0 w-[27px] h-[27px] rounded-full bg-[#20D5EC] text-white flex items-center justify-center ring-[3px] ring-white shadow-sm hover:brightness-95"
                >
                  <Plus size={16} strokeWidth={3} />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Bio Text */}
        <div className="mt-3.5 text-[13.5px] leading-[1.42] text-[var(--p-text)] whitespace-pre-line break-words">
          {u.bio ? renderBioWithLinks(u.bio) : "No bio yet."}
        </div>

        {/* Follow / Message Buttons (other user) */}
        {!profile.isSelf && (
          <div className="mt-3.5 flex items-center gap-2">
            <button
              type="button"
              onClick={toggleFollow}
              disabled={followBusy}
              className={cn(
                "px-7 py-2 rounded-lg text-[14px] font-bold transition-colors",
                profile.viewerFollows
                  ? "bg-[var(--p-chip)] text-[var(--p-text)] hover:bg-[var(--p-chip-hover)]"
                  : "bg-[#FE2C55] text-white hover:bg-[#ef2950]"
              )}
            >
              {profile.viewerFollows ? "Following" : "Follow"}
            </button>
            <Link
              href="/messages"
              className="px-5 py-2 rounded-lg bg-[var(--p-chip)] text-[var(--p-text)] text-[14px] font-bold hover:bg-[var(--p-chip-hover)]"
            >
              Message
            </Link>
            <button
              type="button"
              onClick={() => toast(`@${u.handle}`)}
              aria-label="More"
              className="p-2 rounded-lg bg-[var(--p-chip)] text-[var(--p-text)] hover:bg-[var(--p-chip-hover)]"
            >
              <MoreHorizontal size={18} />
            </button>
          </div>
        )}
      </section>

      {/* 6-Icon Profile Tab Bar */}
      <nav className="grid grid-cols-6 border-b border-[var(--p-line)] mt-1" aria-label="Profile tabs">
        <button
          type="button"
          onClick={() => setTab("videos")}
          aria-label="Posts"
          aria-selected={tab === "videos"}
          className={cn("sx-profile-tab", tab === "videos" && "sx-profile-tab-active")}
        >
          <ProfileBarsTabSvg />
        </button>
        <button
          type="button"
          onClick={() => setTab("photos")}
          aria-label="Photo posts"
          aria-selected={tab === "photos"}
          className={cn("sx-profile-tab", tab === "photos" && "sx-profile-tab-active")}
        >
          <StickerTabSvg />
        </button>
        <button
          type="button"
          onClick={() => setTab("private")}
          aria-label="Private and review"
          aria-selected={tab === "private"}
          className={cn("sx-profile-tab", tab === "private" && "sx-profile-tab-active")}
        >
          <Lock size={19} strokeWidth={1.85} />
        </button>
        <button
          type="button"
          onClick={() => setTab("reposts")}
          aria-label="Reposts"
          aria-selected={tab === "reposts"}
          className={cn("sx-profile-tab", tab === "reposts" && "sx-profile-tab-active")}
        >
          <Repeat2 size={21} strokeWidth={1.85} />
        </button>
        <button
          type="button"
          onClick={() => setTab("saved")}
          aria-label="Favorites"
          aria-selected={tab === "saved"}
          className={cn("sx-profile-tab", tab === "saved" && "sx-profile-tab-active")}
        >
          <Bookmark size={19} strokeWidth={1.85} />
        </button>
        <button
          type="button"
          onClick={() => setTab("liked")}
          aria-label="Liked"
          aria-selected={tab === "liked"}
          className={cn("sx-profile-tab", tab === "liked" && "sx-profile-tab-active")}
        >
          <Heart size={19} strokeWidth={1.85} />
        </button>
      </nav>

      {/* 3-Column Edge-to-Edge Video / Photo Grid */}
      {activeVideos.length === 0 ? (
        <div className="py-16 px-6 text-center text-[var(--p-text-2)] text-[13.5px]">
          {tab === "videos" &&
            (profile.isSelf ? "Upload your first photo or video to get started" : "No posts yet")}
          {tab === "photos" && "No photo posts yet"}
          {tab === "private" &&
            (profile.isSelf
              ? "Posts pending AI or manual review appear here"
              : "This user's private posts are hidden")}
          {tab === "reposts" && "No reposts yet"}
          {tab === "saved" &&
            (profile.isSelf
              ? "Posts you bookmark will appear here"
              : "Saved posts are private")}
          {tab === "liked" &&
            (profile.isSelf
              ? "Posts you liked will appear here"
              : "Liked posts are private")}
        </div>
      ) : (
        <div className="grid grid-cols-3 gap-[1.5px] bg-[var(--p-bg)]">
          {activeVideos.map((v) => {
            const isPhotoPost = !v.videoUrl || Boolean(v.images && v.images.length > 0);
            const href = profile.isSelf && (tab === "videos" || tab === "photos")
              ? `/profile/video/${v.id}`
              : isPhotoPost
                ? `/video/${v.id}?mode=posts&tab=photo`
                : `/video/${v.id}?mode=shorts`;
            const thumb = v.images?.[0]?.url ?? v.coverUrl;
            return (
              <Link
                key={v.id}
                href={href}
                className="relative aspect-[3/4] bg-[var(--p-chip)] overflow-hidden block group"
              >
                {thumb ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={thumb}
                    alt={v.caption || "Post thumbnail"}
                    loading="lazy"
                    className="h-full w-full object-cover group-hover:scale-[1.02] transition-transform duration-200"
                  />
                ) : (
                  <video
                    src={v.videoUrl}
                    muted
                    playsInline
                    preload="metadata"
                    className="h-full w-full object-cover"
                  />
                )}
                <div className="absolute inset-x-0 bottom-0 h-12 bg-gradient-to-t from-black/60 via-black/20 to-transparent pointer-events-none" />
                {tab === "private" && v.status && v.status !== "approved" && (
                  <span className="absolute left-1.5 top-1.5 rounded bg-black/75 px-1.5 py-0.5 text-[10px] font-bold text-amber-300">
                    {v.status === "hidden_recheck" ? "AI Checking…" : "Under Review"}
                  </span>
                )}
                {isPhotoPost && (v.images?.length ?? 0) > 1 && (
                  <span className="absolute right-1.5 top-1.5 flex items-center gap-0.5 rounded bg-black/55 px-1.5 py-0.5 text-[10px] font-semibold text-white">
                    <Images size={11} />
                    {v.images!.length}
                  </span>
                )}
                <span className="absolute left-2 bottom-1.5 flex items-center gap-1 text-[12px] font-semibold text-white drop-shadow-[0_1px_2px_rgba(0,0,0,0.7)]">
                  <Play size={12} fill="none" stroke="currentColor" strokeWidth={2.2} />
                  <span>{formatGridViews(v.viewsCount)}</span>
                </span>
              </Link>
            );
          })}
        </div>
      )}

      {/* Edit profile — full page matching the reference layout (no Others section) */}
      {editOpen && (
        <div className="sx-edit-page" role="dialog" aria-modal="true" aria-label="Edit profile">
          <header className="sx-edit-topbar">
            <button
              type="button"
              aria-label="Back"
              onClick={() => !saving && setEditOpen(false)}
              className="sx-edit-back"
            >
              <ChevronLeft size={27} strokeWidth={2.2} />
            </button>
            <h1>Edit profile</h1>
            <span className="sx-edit-topbar-spacer" aria-hidden="true" />
          </header>

          <div className="sx-edit-scroll">
            <div className="sx-edit-avatar-block">
              <button
                type="button"
                className="sx-edit-avatar"
                aria-label="Change photo"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                <Avatar src={u.avatarUrl} name={u.name} size={150} />
                <span className="sx-edit-cam" aria-hidden="true">
                  <Camera size={34} strokeWidth={2.2} />
                </span>
              </button>
              <button
                type="button"
                className="sx-edit-change"
                disabled={uploadingAvatar}
                onClick={() => avatarInputRef.current?.click()}
              >
                {uploadingAvatar ? (
                  <>
                    <Loader2 size={16} className="animate-spin" />
                    <span>Uploading…</span>
                  </>
                ) : (
                  <span>Change photo</span>
                )}
              </button>
              <input
                ref={avatarInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={(e) => void changeAvatar(e.target.files?.[0])}
              />
            </div>

            <div className="sx-edit-card">
              <button
                type="button"
                className="sx-edit-row"
                onClick={() => {
                  setName(profile?.user.name ?? name);
                  setFieldEdit("name");
                }}
              >
                <span className="sx-edit-label">Name</span>
                <span className="sx-edit-readonly">{name}</span>
                <ChevronRight className="sx-edit-chev" size={20} />
              </button>

              <button
                type="button"
                className="sx-edit-row"
                onClick={() => {
                  setUname(profile?.user.handle ?? u.handle);
                  setUnameStatus("available");
                  setFieldEdit("username");
                }}
              >
                <span className="sx-edit-label">Username</span>
                <span className="sx-edit-readonly">{u.handle}</span>
                <ChevronRight className="sx-edit-chev" size={20} />
              </button>

              <div className="sx-edit-row">
                <span className="sx-edit-url">socialx.com/@{u.handle}</span>
                <button
                  type="button"
                  aria-label="Copy profile link"
                  className="sx-edit-copy"
                  onClick={copyProfileLink}
                >
                  <Copy size={19} />
                </button>
              </div>
            </div>

            <p className="sx-edit-section">Basic info</p>
            <div className="sx-edit-card">
              <button
                type="button"
                className="sx-edit-row sx-edit-row-bio"
                onClick={() => setFieldEdit("bio")}
              >
                <span className="sx-edit-label">Bio</span>
                <span className="sx-edit-readonly sx-edit-bio">{bio || "Add your bio"}</span>
                <ChevronRight className="sx-edit-chev" size={20} />
              </button>
            </div>

            {/* "Others" (AI self / Change display order / TikTok Studio) intentionally omitted. */}
          </div>

          <div className="sx-edit-footer">
            <button
              type="button"
              className="sx-edit-cancel"
              disabled={saving || uploadingAvatar}
              onClick={() => setEditOpen(false)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sx-edit-save"
              disabled={saving || uploadingAvatar || !name.trim()}
              onClick={saveProfile}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              <span>Save</span>
            </button>
          </div>
        </div>
      )}

      {/* Field editor sub-page: one left-aligned input, back button, per-field title */}
      {fieldEdit && (
        <div
          className="sx-field-page"
          role="dialog"
          aria-modal="true"
          aria-label={`${fieldEdit === "username" ? "Username" : fieldEdit === "bio" ? "Bio" : "Name"} Change`}
        >
          <header className="sx-edit-topbar">
            <button
              type="button"
              aria-label="Back"
              onClick={() => !saving && setFieldEdit(null)}
              className="sx-edit-back"
            >
              <ChevronLeft size={27} strokeWidth={2.2} />
            </button>
            <h1>
              {fieldEdit === "name"
                ? "Name Change"
                : fieldEdit === "username"
                  ? "Username Change"
                  : "Bio Change"}
            </h1>
            <span className="sx-edit-topbar-spacer" aria-hidden="true" />
          </header>

          <div className="sx-field-scroll">
            {fieldEdit === "username" ? (
              <input
                className="sx-field-input"
                value={uname}
                autoFocus
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                maxLength={24}
                aria-label="Username"
                onChange={(e) =>
                  setUname(
                    e.target.value.replace(/\s+/g, "").toLowerCase().slice(0, 24)
                  )
                }
              />
            ) : fieldEdit === "bio" ? (
              <textarea
                className="sx-field-input sx-field-textarea"
                rows={4}
                maxLength={160}
                value={bio}
                aria-label="Bio"
                onChange={(e) => setBio(e.target.value.slice(0, 160))}
              />
            ) : (
              <input
                className="sx-field-input"
                value={name}
                maxLength={60}
                autoFocus
                aria-label="Name"
                onChange={(e) => setName(e.target.value.slice(0, 60))}
              />
            )}

            {fieldEdit === "username" && (
              <p
                className={cn("sx-field-status", `sx-field-status-${unameStatus}`)}
                role="status"
              >
                {unameStatus === "checking" && "Checking availability…"}
                {unameStatus === "available" && "Available"}
                {unameStatus === "unavailable" && "Unavailable"}
                {unameStatus === "invalid" && "Invalid username"}
              </p>
            )}
            {fieldEdit === "username" && (
              <p className="sx-field-hint">3–24 characters. Letters, numbers, . and _ only.</p>
            )}
            {fieldEdit === "name" && (
              <p className="sx-field-hint">This is how you appear on SocialX.</p>
            )}
            {fieldEdit === "bio" && (
              <p className="sx-field-hint">{bio.length}/160 characters</p>
            )}
          </div>

          <div className="sx-edit-footer">
            <button
              type="button"
              className="sx-edit-cancel"
              disabled={saving}
              onClick={() => setFieldEdit(null)}
            >
              Cancel
            </button>
            <button
              type="button"
              className="sx-edit-save"
              disabled={
                saving ||
                (fieldEdit === "name" && !name.trim()) ||
                (fieldEdit === "username" && unameStatus !== "available")
              }
              onClick={saveField}
            >
              {saving && <Loader2 size={16} className="animate-spin" />}
              <span>Save</span>
            </button>
          </div>
        </div>
      )}

      {menuOpen && <SocialMenuDialog onClose={() => setMenuOpen(false)} />}
    </div>
  );
}
