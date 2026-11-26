import { and, asc, eq, isNull, lte, or } from "drizzle-orm";
import { db } from "@/db";
import { videos } from "@/db/schema";
import {
  isModerationModelWarmed,
  moderateExistingVideoRecord,
  warmModerationModels,
} from "@/server/moderation";

export type WorkerStatus = {
  started: boolean;
  running: boolean;
  modelWarmed: boolean;
  totalRechecked: number;
  totalOldScanned: number;
  totalAutoDeleted: number;
  lastRecheckAt: string | null;
  lastPeriodicScanAt: string | null;
};

type SchedulerState = {
  started: boolean;
  busyRecheck: boolean;
  busyOldScan: boolean;
  totalRechecked: number;
  totalOldScanned: number;
  totalAutoDeleted: number;
  lastRecheckAt: string | null;
  lastPeriodicScanAt: string | null;
  recheckTimer?: ReturnType<typeof setInterval>;
  oldScanTimer?: ReturnType<typeof setInterval>;
};

const globalScheduler = globalThis as typeof globalThis & {
  __sxModerationScheduler?: SchedulerState;
};

function getState(): SchedulerState {
  if (!globalScheduler.__sxModerationScheduler) {
    globalScheduler.__sxModerationScheduler = {
      started: false,
      busyRecheck: false,
      busyOldScan: false,
      totalRechecked: 0,
      totalOldScanned: 0,
      totalAutoDeleted: 0,
      lastRecheckAt: null,
      lastPeriodicScanAt: null,
    };
  }
  return globalScheduler.__sxModerationScheduler;
}

export function getModerationWorkerStatus(): WorkerStatus {
  const s = getState();
  return {
    started: s.started,
    running: s.busyRecheck || s.busyOldScan,
    modelWarmed: isModerationModelWarmed(),
    totalRechecked: s.totalRechecked,
    totalOldScanned: s.totalOldScanned,
    totalAutoDeleted: s.totalAutoDeleted,
    lastRecheckAt: s.lastRecheckAt,
    lastPeriodicScanAt: s.lastPeriodicScanAt,
  };
}

/** Processes any temporarily hidden posts (`hidden_recheck`) whose re-check is due. */
export async function processDueHiddenRechecks(
  limit = 5,
  ignoreSchedule = false
): Promise<{
  checked: number;
  approved: number;
  autoDeleted: number;
  stillHidden: number;
  escalated: number;
}> {
  const s = getState();
  if (s.busyRecheck) {
    return { checked: 0, approved: 0, autoDeleted: 0, stillHidden: 0, escalated: 0 };
  }
  s.busyRecheck = true;
  const summary = { checked: 0, approved: 0, autoDeleted: 0, stillHidden: 0, escalated: 0 };

  try {
    const now = new Date();
    const whereClause = ignoreSchedule
      ? eq(videos.status, "hidden_recheck")
      : and(
          eq(videos.status, "hidden_recheck"),
          or(isNull(videos.nextRecheckAt), lte(videos.nextRecheckAt, now))
        );

    const dueRows = await db
      .select({ id: videos.id })
      .from(videos)
      .where(whereClause)
      .orderBy(asc(videos.createdAt))
      .limit(limit);

    for (const row of dueRows) {
      const res = await moderateExistingVideoRecord(row.id, {
        deep: true,
        trigger: "fast_recheck",
      });
      summary.checked += 1;
      s.totalRechecked += 1;
      if (res.outcome === "approved") summary.approved += 1;
      else if (res.outcome === "auto_deleted") {
        summary.autoDeleted += 1;
        s.totalAutoDeleted += 1;
      } else if (res.outcome === "manual_review") summary.escalated += 1;
      else if (res.outcome === "hidden_recheck") summary.stillHidden += 1;
    }

    if (summary.checked > 0) {
      s.lastRecheckAt = new Date().toISOString();
    }
  } catch (err) {
    console.error("[moderation-worker] hidden recheck sweep failed:", err);
  } finally {
    s.busyRecheck = false;
  }
  return summary;
}

/** Regularly scans older published posts/videos to catch previously missed or stale content. */
export async function scanOldApprovedPosts(
  limit = 4,
  forceAll = false
): Promise<{
  scanned: number;
  approved: number;
  autoDeleted: number;
  hidden: number;
}> {
  const s = getState();
  if (s.busyOldScan) {
    return { scanned: 0, approved: 0, autoDeleted: 0, hidden: 0 };
  }
  s.busyOldScan = true;
  const summary = { scanned: 0, approved: 0, autoDeleted: 0, hidden: 0 };

  try {
    const staleCutoff = new Date(Date.now() - 10 * 60 * 1000);
    const whereClause = forceAll
      ? eq(videos.status, "approved")
      : and(
          eq(videos.status, "approved"),
          or(isNull(videos.moderatedAt), lte(videos.moderatedAt, staleCutoff))
        );

    const oldRows = await db
      .select({ id: videos.id })
      .from(videos)
      .where(whereClause)
      .orderBy(asc(videos.moderatedAt), asc(videos.id))
      .limit(limit);

    for (const row of oldRows) {
      const res = await moderateExistingVideoRecord(row.id, {
        deep: false,
        trigger: "periodic_old_scan",
      });
      summary.scanned += 1;
      s.totalOldScanned += 1;
      if (res.outcome === "approved") summary.approved += 1;
      else if (res.outcome === "auto_deleted") {
        summary.autoDeleted += 1;
        s.totalAutoDeleted += 1;
      } else if (res.outcome === "hidden_recheck" || res.outcome === "manual_review") {
        summary.hidden += 1;
      }
    }

    if (summary.scanned > 0) {
      s.lastPeriodicScanAt = new Date().toISOString();
    }
  } catch (err) {
    console.error("[moderation-worker] old post scan failed:", err);
  } finally {
    s.busyOldScan = false;
  }
  return summary;
}

/** Triggers a fast asynchronous deep re-check for a temporarily hidden post/video. */
export function scheduleFastRecheck(videoId: number, delayMs = 2500): void {
  ensureModerationSchedulerStarted();
  const timer = setTimeout(() => {
    void moderateExistingVideoRecord(videoId, {
      deep: true,
      trigger: "scheduled_fast_recheck",
    })
      .then((res) => {
        const s = getState();
        s.totalRechecked += 1;
        s.lastRecheckAt = new Date().toISOString();
        if (res.outcome === "auto_deleted") s.totalAutoDeleted += 1;
      })
      .catch((err) => console.error("[moderation-worker] scheduled recheck error:", err));
  }, delayMs);
  if (typeof timer.unref === "function") timer.unref();
}

/** Starts the singleton 24/7 server-side moderation worker if not already running. */
export function ensureModerationSchedulerStarted(): void {
  const s = getState();
  if (s.started) return;
  s.started = true;

  // Warm open-source AI models right away in the background so uploads run fast.
  const warmTimer = setTimeout(() => {
    void warmModerationModels();
  }, 1500);
  if (typeof warmTimer.unref === "function") warmTimer.unref();

  // Check temporarily hidden posts every 10 seconds.
  s.recheckTimer = setInterval(() => {
    void processDueHiddenRechecks(4, false);
  }, 10_000);
  if (typeof s.recheckTimer.unref === "function") s.recheckTimer.unref();

  // Regularly scan older published posts every 3 minutes.
  s.oldScanTimer = setInterval(() => {
    void scanOldApprovedPosts(4, false);
  }, 3 * 60 * 1000);
  if (typeof s.oldScanTimer.unref === "function") s.oldScanTimer.unref();

  // Kick off an initial background scan of older unmoderated posts 20s after boot.
  const bootScan = setTimeout(() => {
    void scanOldApprovedPosts(3, false);
  }, 20_000);
  if (typeof bootScan.unref === "function") bootScan.unref();
}
