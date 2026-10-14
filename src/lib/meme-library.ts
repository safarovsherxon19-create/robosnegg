import { queryOptions } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import type { MemeClip } from "./memes";
import { listMemeClips } from "./meme-library.functions";

export const memeLibraryOptions = queryOptions({
  queryKey: ["meme-library"],
  staleTime: 60_000,
  // A failed clip library must never crash the whole site; show an empty library instead.
  queryFn: async () => {
    try {
      return await listMemeClips();
    } catch (error) {
      console.error("Clip library unavailable:", error);
      return [];
    }
  },
});

export const MAX_CLIP_BYTES = 5 * 1024 ** 3;
export function validateMemeFile(file: { type: string; size: number }) {
  if (!file.type.startsWith("video/")) return "Choose a video clip.";
  if (file.size > MAX_CLIP_BYTES) return "Each clip must be 5 GB or smaller.";
  if (!file.size) return "This file is empty.";
  return "";
}

export async function uploadMeme(file: File, onProgress: (progress: number) => void) {
  const validation = validateMemeFile(file);
  if (validation) throw new Error(validation);
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error("Sign in to upload clips.");
  const { data: { session } } = await supabase.auth.getSession();
  if (!session) throw new Error("Sign in again to upload clips.");
  const id = crypto.randomUUID();
  const extension = file.name.split(".").pop()?.replace(/[^a-zA-Z0-9]/g, "") || "video";
  const path = `${user.id}/${id}.${extension}`;
  // Browser-only: tus-js-client pulls Node file APIs that crash the live server.
  const { Upload } = await import("tus-js-client");
  await new Promise<void>((resolve, reject) => {
    const upload = new Upload(file, {
      endpoint: `${import.meta.env['VITE_SUPABASE_URL']}/storage/v1/upload/resumable`,
      headers: { authorization: `Bearer ${session.access_token}`, apikey: import.meta.env['VITE_SUPABASE_PUBLISHABLE_KEY'] },
      metadata: { bucketName: "meme-clips", objectName: path, contentType: file.type, cacheControl: "3600" },
      chunkSize: 6 * 1024 * 1024,
      retryDelays: [0, 1000, 3000, 5000, 10000],
      uploadDataDuringCreation: true,
      removeFingerprintOnSuccess: true,
      onProgress: (sent, total) => onProgress(Math.round(sent / total * 100)),
      onError: reject,
      onSuccess: () => resolve(),
    });
    upload.start();
  });
  const { error } = await supabase.from("meme_clips").insert({ id, name: file.name.slice(0, 255), path, owner_id: user.id });
  if (error) {
    await supabase.storage.from("meme-clips").remove([path]);
    throw error;
  }
}

export async function deleteMeme(clip: MemeClip) {
  if (!clip.path) return;
  // Delete metadata first so the public library stops referencing this clip immediately.
  const result = await supabase.from("meme_clips").delete().eq("id", clip.id).select("id");
  if (result.error) throw result.error;
  if (!result.data.length) throw new Error("Only the channel owner can delete clips.");
  const removed = await supabase.storage.from("meme-clips").remove([clip.path]);
  if (removed.error) throw new Error("Clip removed from the library, but storage cleanup failed. Try again later.");
}