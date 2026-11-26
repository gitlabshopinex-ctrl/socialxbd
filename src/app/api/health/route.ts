import { db } from "@/db";
import { sql } from "drizzle-orm";
import { isSupabaseConfigured } from "@/server/supabase";
import { isShopinexConfigured } from "@/server/shopinex";

export const dynamic = "force-dynamic";

export async function GET() {
  try {
    await db.execute(sql`select 1`);
    return Response.json({
      ok: true,
      supabase: isSupabaseConfigured() ? "configured" : "not_configured",
      media: isShopinexConfigured() ? "shopinex" : "local",
    });
  } catch {
    return Response.json({ ok: false }, { status: 500 });
  }
}
