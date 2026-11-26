import { checkSupabaseHealth, isSupabaseConfigured } from "@/server/supabase";
import { isShopinexConfigured } from "@/server/shopinex";
import { storageProvider } from "@/server/media";

export const dynamic = "force-dynamic";

/** Reports infrastructure readiness without leaking any credentials. */
export async function GET() {
  const supabase = await checkSupabaseHealth();
  return Response.json({
    supabase: {
      configured: isSupabaseConfigured(),
      reachable: supabase.reachable,
      message: supabase.message,
    },
    media: {
      provider: storageProvider(),
      shopinexConfigured: isShopinexConfigured(),
      maxUploadBytes: 200 * 1024 * 1024,
      message: isShopinexConfigured()
        ? "Shopinex Media API connected — photos & videos stored remotely"
        : "SHOPINEX_SITE_ID / SHOPINEX_API_KEY not set — using local storage",
    },
  });
}
