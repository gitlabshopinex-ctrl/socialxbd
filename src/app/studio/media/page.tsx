import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { isShopinexConfigured } from "@/server/shopinex";
import { isSupabaseConfigured } from "@/server/supabase";
import MediaLibrary from "./MediaLibrary";

export const dynamic = "force-dynamic";

export default function MediaStudioPage() {
  const mediaConfigured = isShopinexConfigured();
  const supabaseConfigured = isSupabaseConfigured();

  return (
    <div className="mx-auto max-w-[820px] px-4 md:px-6 py-6 pb-24">
      <Link
        href="/"
        className="inline-flex items-center gap-1.5 text-[13px] font-semibold text-white/60 hover:text-white"
      >
        <ArrowLeft size={15} /> Back to SocialX
      </Link>

      <header className="mt-5">
        <p className="text-[12px] font-bold tracking-widest text-sky-400 uppercase">
          Media storage · Shopinex
        </p>
        <h1 className="mt-1 text-2xl md:text-3xl font-bold">Media library</h1>
        <p className="mt-1.5 text-[13px] text-white/55 leading-relaxed">
          Photos and videos are uploaded to Shopinex media storage with the API key kept on the
          server. Captions and all other text live in Supabase.
        </p>
      </header>

      <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
        <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3.5">
          <p className="text-[11px] font-semibold uppercase text-white/45">Media storage</p>
          <p className={`mt-1 text-[14px] font-bold ${mediaConfigured ? "text-emerald-400" : "text-amber-300"}`}>
            {mediaConfigured ? "Shopinex connected" : "Local fallback"}
          </p>
          <p className="mt-1 text-[11.5px] text-white/45">
            {mediaConfigured
              ? "Uploads go to shopinexbd.com/api/media (max 200 MB)"
              : "Add SHOPINEX_SITE_ID and SHOPINEX_API_KEY to move files to remote storage"}
          </p>
        </div>
        <div className="rounded-xl border border-white/10 bg-[#0d0d0d] p-3.5">
          <p className="text-[11px] font-semibold uppercase text-white/45">Text database</p>
          <p className={`mt-1 text-[14px] font-bold ${supabaseConfigured ? "text-emerald-400" : "text-amber-300"}`}>
            {supabaseConfigured ? "Supabase configured" : "PostgreSQL only"}
          </p>
          <p className="mt-1 text-[11.5px] text-white/45">
            {supabaseConfigured
              ? "Users, posts, comments and moderation logs are mirrored to Supabase"
              : "Add SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY to mirror text data"}
          </p>
        </div>
      </div>

      <MediaLibrary />
    </div>
  );
}
