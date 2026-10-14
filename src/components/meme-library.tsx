import { useEffect, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Clapperboard, ChevronDown, Plus, Play, Trash2, LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Switch } from "@/components/ui/switch";
import { supabase } from "@/integrations/supabase/client";
import { lovable } from "@/integrations/lovable";
import { deleteMeme, uploadMeme } from "@/lib/meme-library";
import type { MemeClip } from "@/lib/memes";

export function MemeLibrary({ clips, enabled, onEnabled, onPreview, onDelete }: {
  clips: MemeClip[]; enabled: boolean; onEnabled: (enabled: boolean) => void;
  onPreview: (clip: MemeClip) => void; onDelete: (id: string) => void;
}) {
  const queryClient = useQueryClient();
  const uploadInput = useRef<HTMLInputElement>(null);
  const [open, setOpen] = useState(false);
  const [owner, setOwner] = useState(false);
  const [signedIn, setSignedIn] = useState(false);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState("");
  const [progress, setProgress] = useState(0);
  const sessionVersion = queryClient.getQueryState(["meme-library"])?.dataUpdatedAt;
  useEffect(() => {
    let live = true;
    void supabase.auth.getUser().then(async ({ data: { user } }) => {
      if (!live) return;
      setSignedIn(Boolean(user));
      if (!user) { setOwner(false); return; }
      const roles = await supabase.from("user_roles").select("role").eq("user_id", user.id).eq("role", "admin");
      if (live) setOwner(Boolean(roles.data?.length));
    });
    return () => { live = false; };
  }, [sessionVersion]);
  return <div className="flex flex-col gap-1">
    <label htmlFor="with-mems" className="text-xs text-muted-foreground">With mems</label>
    <div className="flex h-10 items-center gap-3 rounded-lg border border-border px-3">
      <Switch id="with-mems" checked={enabled} onCheckedChange={onEnabled} />
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild><Button variant="ghost" size="sm" aria-label="Choose memes" className="h-8 gap-2 px-1"><Clapperboard className="size-4" />{clips.length} clips<ChevronDown className="size-3" /></Button></PopoverTrigger>
        <PopoverContent aria-label="Meme clips" className="w-80 max-w-[calc(100vw-2rem)] p-3">
          <div className="mb-3 flex items-center justify-between"><span className="text-sm font-semibold">Meme clips</span>
            {owner && <Button variant="outline" size="sm" disabled={Boolean(busy)} onClick={() => uploadInput.current?.click()}><Plus />Add clips</Button>}
          </div>
          {!signedIn && <Button variant="outline" className="mb-3 w-full" onClick={async () => {
            const result = await lovable.auth.signInWithOAuth("google", { redirect_uri: window.location.origin });
            if (result.error) setError(result.error.message);
            else await queryClient.invalidateQueries({ queryKey: ["meme-library"] });
          }}>Sign in to manage clips</Button>}
          {signedIn && !owner && <p className="mb-3 text-sm text-muted-foreground">Only the channel owner can manage clips.</p>}
          {!clips.length && <p className="py-5 text-center text-sm text-muted-foreground">No clips yet</p>}
          <div className="grid max-h-80 grid-cols-2 gap-2 overflow-y-auto">
            {clips.map(clip => <div key={clip.id} className="relative min-w-0">
              <Button variant="outline" aria-label={`Preview ${clip.name}`} className="h-auto w-full flex-col items-stretch gap-1.5 p-1.5" onClick={() => { onPreview(clip); setOpen(false); }}>
                <video src={clip.url} muted preload="metadata" playsInline className="aspect-square w-full rounded-sm object-contain" />
                <span className="flex items-center justify-between gap-1 text-xs"><span className="truncate">{clip.name}</span><Play className="size-3 shrink-0" /></span>
              </Button>
              {owner && <Button variant="destructive" size="icon" title={`Delete ${clip.name}`} aria-label={`Delete ${clip.name}`} disabled={Boolean(busy)} className="absolute right-2 top-2 size-7" onClick={async () => {
                setBusy(clip.id); setError("");
                try { await deleteMeme(clip); onDelete(clip.id); await queryClient.invalidateQueries({ queryKey: ["meme-library"] }); }
                catch (e) { setError(e instanceof Error ? e.message : "Could not delete clip."); }
                finally { setBusy(""); }
              }}><Trash2 className="size-3.5" /></Button>}
            </div>)}
          </div>
          {busy === "upload" && <p role="status" className="mt-3 text-sm">Uploading… {progress}%</p>}
          {error && <p role="alert" className="mt-3 text-xs text-destructive">{error}</p>}
          {signedIn && <Button variant="ghost" size="sm" className="mt-3" onClick={async () => { await supabase.auth.signOut(); setOwner(false); setSignedIn(false); }}><LogOut />Sign out</Button>}
        </PopoverContent>
      </Popover>
    </div>
    <input ref={uploadInput} type="file" multiple accept="video/*" aria-label="Upload meme clips" className="hidden" onChange={async e => {
      const files = Array.from(e.target.files ?? []); e.target.value = "";
      setBusy("upload"); setError("");
      try { for (const file of files) { setProgress(0); await uploadMeme(file, setProgress); await queryClient.invalidateQueries({ queryKey: ["meme-library"] }); } }
      catch (e) { setError(e instanceof Error ? e.message : "Upload failed."); }
      finally { setBusy(""); }
    }} />
  </div>;
}