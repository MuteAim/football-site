import "server-only";
import { CafeError } from "./data";
import { publicClient } from "./supabase-server";

export type SiteUpdate = { id: number; version: string; title: string; body: string; created_at: string };

export async function listSiteUpdates(): Promise<SiteUpdate[]> {
  const supabase = await publicClient();
  const { data, error } = await supabase.from("site_updates")
    .select("id, version, title, body, created_at").order("id", { ascending: false }).limit(50);
  if (error) throw new CafeError(error.message);
  return data ?? [];
}
