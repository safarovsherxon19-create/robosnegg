import { createServerFn } from "@tanstack/react-start";
import { createClient } from "@supabase/supabase-js";
import type { Database } from "@/integrations/supabase/types";
import type { MemeClip } from "./memes";

export const listMemeClips = createServerFn({ method: "GET" }).handler(async (): Promise<MemeClip[]> => {
  const key = process.env['SUPABASE_PUBLISHABLE_KEY'];
  const url = process.env['SUPABASE_URL'];
  if (!key || !url) throw new Error("Clip library is unavailable.");
  const client = createClient<Database>(url, key, {
    auth: { persistSession: false, autoRefreshToken: false },
    global: { fetch: (input, init) => {
      const headers = new Headers(init?.headers);
      if (key.startsWith("sb_") && headers.get("Authorization") === `Bearer ${key}`) headers.delete("Authorization");
      headers.set("apikey", key);
      return fetch(input, { ...init, headers });
    } },
  });
  const { data, error } = await client.from("meme_clips").select("id,name,path").order("created_at");
  if (error) throw error;
  if (!data.length) return [];
  const signed = await client.storage.from("meme-clips").createSignedUrls(data.map(c => c.path), 86400);
  if (signed.error) throw signed.error;
  const browserUrl = import.meta.env['VITE_SUPABASE_URL'];
  return data.flatMap(c => {
    const signedUrl = signed.data.find(s => s.path === c.path)?.signedUrl;
    if (!signedUrl) return [];
    const playback = new URL(signedUrl);
    const publicBase = new URL(browserUrl);
    playback.protocol = publicBase.protocol;
    playback.host = publicBase.host;
    return [{ id: c.id, name: c.name, caption: "", path: c.path, url: playback.href }];
  });
});