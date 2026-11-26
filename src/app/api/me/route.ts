import { NextResponse } from "next/server";
import { getCurrentUserIdentity } from "@/lib/data";

export const dynamic = "force-dynamic";

/**
 * Returns the signed-in identity and refreshes the `sx_uid` / `sx_handle`
 * cookies, so client-side ownership checks stay correct after a username change.
 */
export async function GET() {
  const identity = await getCurrentUserIdentity();
  const response = NextResponse.json(identity);
  const options = { path: "/", maxAge: 60 * 60 * 24 * 365, sameSite: "lax" as const };
  response.cookies.set("sx_uid", String(identity.id), options);
  response.cookies.set("sx_handle", identity.handle, options);
  return response;
}
