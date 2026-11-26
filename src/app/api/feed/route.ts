import { getCurrentUserId, getFeed } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const tab = url.searchParams.get("tab") === "following" ? "following" : "foryou";
  const viewerId = await getCurrentUserId();
  const videos = await getFeed(tab, viewerId);
  return Response.json({ videos });
}