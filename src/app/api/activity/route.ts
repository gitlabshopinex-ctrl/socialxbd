import { getActivity, getCurrentUserId } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewerId = await getCurrentUserId();
  const items = await getActivity(viewerId);
  return Response.json({ items });
}