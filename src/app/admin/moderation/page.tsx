import Link from "next/link";
import {
  ArrowLeft,
  Clock,
  Flag,
  ShieldAlert,
  ShieldCheck,
  ShieldQuestion,
  Trash2,
} from "lucide-react";
import { desc, eq, inArray } from "drizzle-orm";
import { db } from "@/db";
import { moderationLogs, reports, users, videos } from "@/db/schema";
import {
  ensureModerationSchedulerStarted,
  getModerationWorkerStatus,
} from "@/server/moderation/scheduler";
import AdminModerationQueue, { ModerationScanButton } from "./AdminModerationQueue";
import { timeAgo } from "@/lib/utils";

export const dynamic = "force-dynamic";

export default async function ModerationPage() {
  ensureModerationSchedulerStarted();
  const worker = getModerationWorkerStatus();

  const [hiddenRecheck, reviewRows, recentDeleted, recentReports] = await Promise.all([
    db
      .select({
        id: videos.id,
        caption: videos.caption,
        createdAt: videos.createdAt,
        recheckCount: videos.recheckCount,
        reason: videos.moderationReason,
        handle: users.handle,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.status, "hidden_recheck"))
      .orderBy(desc(videos.createdAt))
      .limit(30),
    db
      .select({
        id: videos.id,
        caption: videos.caption,
        status: videos.status,
        createdAt: videos.createdAt,
        reason: videos.moderationReason,
        handle: users.handle,
        name: users.name,
        avatarUrl: users.avatarUrl,
      })
      .from(videos)
      .innerJoin(users, eq(videos.userId, users.id))
      .where(eq(videos.status, "manual_review"))
      .orderBy(desc(videos.createdAt))
      .limit(50),
    db
      .select({
        id: moderationLogs.id,
        action: moderationLogs.action,
        authorHandle: moderationLogs.authorHandle,
        captionSnapshot: moderationLogs.captionSnapshot,
        reason: moderationLogs.reason,
        createdAt: moderationLogs.createdAt,
      })
      .from(moderationLogs)
      .where(inArray(moderationLogs.action, ["auto_deleted", "moderator_deleted", "user_deleted"]))
      .orderBy(desc(moderationLogs.createdAt))
      .limit(15),
    db
      .select({
        id: reports.id,
        videoId: reports.videoId,
        reason: reports.reason,
        details: reports.details,
        status: reports.status,
        createdAt: reports.createdAt,
        reporterHandle: users.handle,
      })
      .from(reports)
      .innerJoin(users, eq(reports.reporterId, users.id))
      .orderBy(desc(reports.createdAt))
      .limit(15),
  ]);

  return (
    <div className="mx-auto max-w-[720px] px-4 md:px-6 py-6 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 hover:text-white"
      >
        <ArrowLeft size={15} /> Back to SocialX
      </Link>

      <header className="mt-5 flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="text-[12px] font-bold tracking-widest text-emerald-400 uppercase">
            24/7 Open-Source AI Moderation
          </p>
          <h1 className="mt-1 text-2xl md:text-3xl font-bold">Moderation Center</h1>
          <p className="mt-1.5 text-[13px] text-white/55 leading-relaxed">
            Explicit images &amp; videos are auto-deleted from Database &amp; Storage. Uncertain posts
            are temporarily hidden for fast deep AI re-check, and older posts are scanned periodically.
          </p>
        </div>
        <ModerationScanButton />
      </header>

      {/* Live Worker Metrics */}
      <div className="mt-5 grid grid-cols-2 sm:grid-cols-4 gap-2.5">
        <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3.5">
          <span className="text-[11px] font-semibold text-white/45 uppercase">AI Engine</span>
          <p className="mt-1 text-[14px] font-bold text-emerald-400">
            {worker.started ? "Active 24/7" : "Standby"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3.5">
          <span className="text-[11px] font-semibold text-white/45 uppercase">Hidden Recheck</span>
          <p className="mt-1 text-[18px] font-bold text-amber-300">{hiddenRecheck.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3.5">
          <span className="text-[11px] font-semibold text-white/45 uppercase">Manual Review</span>
          <p className="mt-1 text-[18px] font-bold text-white">{reviewRows.length}</p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3.5">
          <span className="text-[11px] font-semibold text-white/45 uppercase">Old Scans</span>
          <p className="mt-1 text-[18px] font-bold text-white">{worker.totalOldScanned}</p>
        </div>
      </div>

      {/* Temporarily Hidden for Fast AI Re-check */}
      {hiddenRecheck.length > 0 && (
        <section className="mt-7">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-amber-300">
            <Clock size={16} /> Temporarily Hidden — Fast AI Re-checking ({hiddenRecheck.length})
          </h2>
          <div className="mt-3 space-y-2.5">
            {hiddenRecheck.map((item) => (
              <article
                key={item.id}
                className="rounded-2xl border border-amber-400/20 bg-[#0d0d0d] p-4 flex items-start gap-3"
              >
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <span className="text-[14px] font-bold">@{item.handle}</span>
                    <span className="rounded bg-amber-400/15 px-2 py-0.5 text-[10px] font-bold text-amber-300 uppercase">
                      Hidden · Pass #{item.recheckCount + 1}
                    </span>
                  </div>
                  <p className="mt-1 text-[13.5px] text-white/85 line-clamp-2">
                    {item.caption || "(no caption)"}
                  </p>
                  <p className="mt-1.5 text-[11.5px] text-white/50">
                    {item.reason ?? "Temporarily hidden pending fast AI re-check."}
                  </p>
                </div>
                <AdminModerationQueue videoId={item.id} />
              </article>
            ))}
          </div>
        </section>
      )}

      {/* Manual Review Queue */}
      <section className="mt-7">
        <h2 className="flex items-center gap-2 text-[14px] font-bold text-white/80">
          <ShieldQuestion size={16} className="text-amber-300" /> Manual Review Queue (
          {reviewRows.length})
        </h2>
        <div className="mt-3 space-y-3">
          {reviewRows.length === 0 && (
            <div className="rounded-2xl border border-white/8 bg-[#0b0b0b] p-8 text-center">
              <ShieldCheck size={34} className="mx-auto text-emerald-400" />
              <p className="mt-2.5 text-[15px] font-semibold">All clear.</p>
              <p className="mt-1 text-[13px] text-white/50">
                No posts are waiting for manual review right now.
              </p>
            </div>
          )}
          {reviewRows.map((item) => (
            <article
              key={item.id}
              className="rounded-2xl border border-white/8 bg-[#0b0b0b] p-4 md:p-5"
            >
              <div className="flex items-start gap-3">
                {item.avatarUrl ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img
                    src={item.avatarUrl}
                    alt=""
                    className="h-10 w-10 rounded-full object-cover shrink-0"
                  />
                ) : (
                  <span className="h-10 w-10 rounded-full bg-chip shrink-0" />
                )}
                <div className="min-w-0 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[14px] font-bold">@{item.handle}</span>
                    <span className="text-[11px] text-white/45">{item.name}</span>
                  </div>
                  <p className="mt-1.5 text-[13.5px] leading-snug line-clamp-2 text-white/85">
                    {item.caption || "(no caption)"}
                  </p>
                  <p className="mt-2 text-[11.5px] text-amber-200/80">
                    {item.reason ?? "Held for human review."}
                  </p>
                  <p className="mt-1.5 text-[11px] text-white/40">
                    queued {timeAgo(item.createdAt.toISOString())} ago
                  </p>
                </div>
                <AdminModerationQueue videoId={item.id} />
              </div>
            </article>
          ))}
        </div>
      </section>

      {/* Recent User Reports */}
      {recentReports.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-white/80">
            <Flag size={15} className="text-sky-400" /> Recent User Reports
          </h2>
          <ul className="mt-3 space-y-2">
            {recentReports.map((rep) => (
              <li
                key={rep.id}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-[#0b0b0b] px-4 py-3 text-[13px]"
              >
                <span className="shrink-0 rounded-md bg-white/10 px-2 py-0.5 text-[10px] font-bold uppercase text-white/80">
                  {rep.status}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">@{rep.reporterHandle}</span>
                  <span className="text-white/50">
                    {" "}
                    reported {rep.videoId ? `post #${rep.videoId}` : "deleted post"} ·{" "}
                    {timeAgo(rep.createdAt.toISOString())} ago
                  </span>
                  <p className="mt-0.5 text-white/75">{rep.reason}</p>
                  {rep.details && <p className="mt-0.5 text-[12px] text-white/45">{rep.details}</p>}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      {/* Auto-Deleted & Removed Audit Trail */}
      {recentDeleted.length > 0 && (
        <section className="mt-8">
          <h2 className="flex items-center gap-2 text-[14px] font-bold text-white/80">
            <Trash2 size={15} className="text-accent" /> Auto-Deleted &amp; Removed Content
          </h2>
          <ul className="mt-3 space-y-2">
            {recentDeleted.map((item) => (
              <li
                key={item.id}
                className="flex items-start gap-3 rounded-xl border border-white/8 bg-[#0b0b0b] px-4 py-3 text-[13px]"
              >
                <span className="shrink-0 rounded-md bg-accent/15 px-2 py-0.5 text-[10px] font-bold tracking-wide text-accent uppercase">
                  {item.action === "auto_deleted"
                    ? "AI Deleted"
                    : item.action === "user_deleted"
                      ? "User Deleted"
                      : "Removed"}
                </span>
                <div className="min-w-0 flex-1">
                  <span className="font-semibold">@{item.authorHandle ?? "unknown"}</span>
                  <span className="text-white/50">
                    {" "}
                    · {timeAgo(item.createdAt.toISOString())} ago
                  </span>
                  <p className="mt-0.5 truncate text-white/70">
                    {item.captionSnapshot || "(no caption)"}
                  </p>
                  {item.reason && (
                    <p className="mt-0.5 text-[11.5px] text-white/45">{item.reason}</p>
                  )}
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className="mt-8 flex items-center gap-2 text-[12px] text-white/35 leading-relaxed">
        <ShieldAlert size={14} className="shrink-0" />
        Running 100% free open-source models on SocialX Server (nsfwjs MobileNetV2Mid + ffmpeg-static
        + toxicity) with automatic background re-checking and periodic old-post scans.
      </p>
    </div>
  );
}
