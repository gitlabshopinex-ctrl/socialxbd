import {
  ensureModerationSchedulerStarted,
  getModerationWorkerStatus,
  processDueHiddenRechecks,
  scanOldApprovedPosts,
} from "@/server/moderation/scheduler";

export const dynamic = "force-dynamic";

export async function POST(req: Request) {
  ensureModerationSchedulerStarted();

  const body = (await req.json().catch(() => ({}))) as {
    limit?: number;
    forceAll?: boolean;
  };
  const limit = Math.min(20, Math.max(1, Number(body?.limit ?? 6)));
  const forceAll = Boolean(body?.forceAll);

  const recheckSummary = await processDueHiddenRechecks(10, true);
  const oldScanSummary = await scanOldApprovedPosts(limit, forceAll);

  return Response.json({
    ok: true,
    recheck: recheckSummary,
    oldScan: oldScanSummary,
    worker: getModerationWorkerStatus(),
  });
}
