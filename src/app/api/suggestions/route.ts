import { getCurrentUserId, getSuggestions } from "@/lib/data";

export const dynamic = "force-dynamic";

export async function GET() {
  const viewerId = await getCurrentUserId();
  const data = await getSuggestions(viewerId);
  return Response.json(data);
}