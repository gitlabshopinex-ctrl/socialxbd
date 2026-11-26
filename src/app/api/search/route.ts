import { getCurrentUserId, searchAll } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const q = (url.searchParams.get("q") ?? "").trim().slice(0, 80);
  if (!q) return Response.json({ videos: [], users: [] });
  const term = q.replace(/^[@#]/, "");
  const viewerId = await getCurrentUserId();
  const results = await searchAll(term, viewerId);
  return Response.json(results);
}