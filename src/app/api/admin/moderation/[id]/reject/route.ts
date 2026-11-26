import { permanentlyDeletePostAndStorage } from "@/server/storage";

export const dynamic = "force-dynamic";

export async function POST(
  _req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;
  const videoId = Number(id);
  if (!Number.isInteger(videoId)) {
    return Response.json({ error: "Invalid id" }, { status: 400 });
  }

  const result = await permanentlyDeletePostAndStorage(videoId, {
    action: "moderator_deleted",
    status: "moderator_deleted",
    reason: "Rejected and permanently deleted by moderator",
    reviewedBy: "admin",
  });

  if (!result.deleted) {
    return Response.json({ error: "Not found" }, { status: 404 });
  }

  return Response.json({
    ok: true,
    status: "moderator_deleted",
    deletedFiles: result.deletedFiles,
  });
}
