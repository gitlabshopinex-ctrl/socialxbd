import "server-only";
import { createClient, type SupabaseClient } from "@supabase/supabase-js";

/**
 * Supabase is the canonical home for social text data (users, videos, comments,
 * likes, saves, follows, reports, moderation logs). Media binaries live in the
 * Shopinex media storage instead — only their URLs / ids are stored here.
 *
 * Server-only env:
 *   SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY (preferred) or SUPABASE_ANON_KEY
 */
const globalSupabase = globalThis as typeof globalThis & {
  __sxSupabase?: SupabaseClient | null;
};

export function isSupabaseConfigured(): boolean {
  const url = process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "";
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "";
  return Boolean(url.trim() && key.trim());
}

export function getSupabaseAdmin(): SupabaseClient | null {
  if (globalSupabase.__sxSupabase !== undefined) return globalSupabase.__sxSupabase;
  if (!isSupabaseConfigured()) {
    globalSupabase.__sxSupabase = null;
    return null;
  }
  const url = (process.env.SUPABASE_URL ?? process.env.NEXT_PUBLIC_SUPABASE_URL ?? "").trim();
  const key = (process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.SUPABASE_ANON_KEY ?? "").trim();
  globalSupabase.__sxSupabase = createClient(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  return globalSupabase.__sxSupabase;
}

export type SupabaseHealth = {
  configured: boolean;
  reachable: boolean;
  message: string;
};

export async function checkSupabaseHealth(): Promise<SupabaseHealth> {
  const client = getSupabaseAdmin();
  if (!client) {
    return { configured: false, reachable: false, message: "SUPABASE_URL / key not set — using PostgreSQL only" };
  }
  try {
    const { error } = await client.from("users").select("id", { head: true, count: "exact" }).limit(1);
    if (error) {
      return { configured: true, reachable: false, message: `Connected, but table check failed: ${error.message}` };
    }
    return { configured: true, reachable: true, message: "Connected — text data mirrored to Supabase" };
  } catch (error) {
    return {
      configured: true,
      reachable: false,
      message: error instanceof Error ? error.message : "Supabase unreachable",
    };
  }
}
