import wait from "@/assets/meme-wait.mp4.asset.json";
import seven from "@/assets/meme-six-seven.mp4.asset.json";
import shark from "@/assets/meme-shark.mp4.asset.json";
import coffee from "@/assets/meme-coffee.mp4.asset.json";
import bro from "@/assets/meme-bro.mp4.asset.json";
import bite from "@/assets/meme-one-more.mp4.asset.json";

export type MemeClip = { id: string; name: string; caption: string; url: string };
export const MEME_CLIPS: MemeClip[] = [
  { id: "wait", name: "Wait… how?", caption: "Wait, how did we get here?", url: wait.url },
  { id: "six-seven", name: "Six seven", caption: "SIX SEVEN!", url: seven.url },
  { id: "shark", name: "Sneaker shark", caption: "Sneaker shark energy", url: shark.url },
  { id: "coffee", name: "Espresso dance", caption: "Espresso. Not depresso.", url: coffee.url },
  { id: "bro", name: "Built different", caption: "This snake is built different", url: bro.url },
  { id: "one-more", name: "One more bite", caption: "One more bite!", url: bite.url },
];

/** A shuffled bag survives restarts and does not repeat until exhausted. */
export class MemeBag {
  private used = new Set<string>();
  private last = "";
  next(clips: MemeClip[], random = Math.random): MemeClip | null {
    if (!clips.length) return null;
    let pool = clips.filter((clip) => !this.used.has(clip.id) && clip.id !== this.last);
    if (!pool.length) {
      this.used.clear();
      pool = clips.filter((clip) => clip.id !== this.last);
    }
    if (!pool.length) pool = clips;
    const clip = pool[Math.min(pool.length - 1, Math.floor(random() * pool.length))];
    if (!clip) return null;
    this.used.add(clip.id); this.last = clip.id;
    return clip;
  }
}

export function nextMemeTime(now: number, random = Math.random) {
  return now + 10 + random() * 8;
}

/** Browser-only playback; the same video frame and shared audio mix get recorded. */
export class MemePlayer {
  private videos = new Map<string, HTMLVideoElement>();
  private nodes: MediaElementAudioSourceNode[] = [];
  active: { clip: MemeClip; video: HTMLVideoElement } | null = null;
  private disposed = false;
  constructor(private context: AudioContext, private output: AudioNode) {}
  prepare(clips: MemeClip[]) {
    for (const clip of clips) {
      if (this.videos.has(clip.id)) continue;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous"; video.preload = "auto"; video.playsInline = true;
      video.src = clip.url;
      const node = this.context.createMediaElementSource(video);
      const gain = this.context.createGain(); gain.gain.value = 0.75;
      node.connect(gain); gain.connect(this.output); this.nodes.push(node);
      this.videos.set(clip.id, video); video.load();
    }
  }
  play(clip: MemeClip) {
    this.clear(); this.prepare([clip]);
    const video = this.videos.get(clip.id);
    if (!video || this.disposed) return;
    video.currentTime = 0; this.active = { clip, video };
    void video.play().catch(() => { if (this.active?.video === video) this.clear(); });
  }
  pause() { this.active?.video.pause(); }
  resume() { const video = this.active?.video; if (video && !video.ended) void video.play().catch(() => this.clear()); }
  clear() { this.active?.video.pause(); this.active = null; }
  dispose() {
    this.disposed = true; this.clear();
    for (const video of this.videos.values()) { video.pause(); video.removeAttribute("src"); video.load(); }
    for (const node of this.nodes) node.disconnect();
    this.videos.clear();
  }
}