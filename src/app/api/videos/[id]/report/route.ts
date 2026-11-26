import { and, eq } from "drizzle-orm";
import { db } from "@/db";
import { reports, videos } from "@/db/schema";
import { getCurrentUserId } from "@/lib/data";
import { moderateExistingVideoRecord } from "@/server/moderation";
import { scheduleFastRecheck } from "@/server/moderation/scheduler";

export const dynamic = "force-dynamic";

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const body = (await req.json().catch(() => null)) as {
    reason?: string;
    details?: string;
  } | null;

  const reason = (body?.reason ?? "").trim().slice(0, 120);
  const details = (body?.details ?? "").trim().slice(0, 300);
  if (!reason) {
    return Response.json({ error: "Please select a report reason" }, { status: 400 });
  }

  const [existing] = await db
    .select({ id: videos.id, status: videos.status })
    .from(videos)
    .where(and(eq(videos.id, videoId), eq(videos.status, "approved")))
    .limit(1);

  if (!existing) {
    return Response.json({ error: "Post not found or already removed" }, { status: 404 });
  }

  const viewerId = await getCurrentUserId();
  const [reportRow] = await db
    .insert(reports)
    .values({
      videoId,
      reporterId: viewerId,
      reason,
      details,
      status: "pending",
    })
    .returning({ id: reports.id });

  // Immediately run deep open-source AI re-check on reported content
  const check = await moderateExistingVideoRecord(videoId, {
    deep: true,
    trigger: `user_report:${reason}`,
  });

  if (check.outcome === "auto_deleted") {
    await db
      .update(reports)
      .set({ status: "auto_deleted" })
      .where(eq(reports.id, reportRow.id));
    return Response.json(
      {
        ok: true,
        reportId: reportRow.id,
        outcome: "auto_deleted",
        removed: true,
        message: "AI confirmed policy violation — post has been automatically deleted.",
      },
      { status: 200 }
    );
  }

  if (check.outcome === "hidden_recheck" || check.outcome === "manual_review") {
    await db
      .update(reports)
      .set({ status: check.outcome })
      .where(eq(reports.id, reportRow.id));
    if (check.outcome === "hidden_recheck") {
      scheduleFastRecheck(videoId, 3000);
    }
    return Response.json(
      {
        ok: true,
        reportId: reportRow.id,
        outcome: check.outcome,
        removed: true,
        message: "Post temporarily hidden while AI completes a deeper review.",
      },
      { status: 200 }
    );
  }

  await db
    .update(reports)
    .set({ status: "reviewed" })
    .where(eq(reports.id, reportRow.id));

  return Response.json(
    {
      ok: true,
      reportId: reportRow.id,
      outcome: "reported",
      removed: false,
      message: "Report submitted and logged for moderation.",
    },
    { status: 201 }
  );
}
