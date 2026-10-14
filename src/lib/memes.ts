export type MemeClip = { id: string; name: string; caption: string; url: string; path?: string };
export const MEME_CLIPS: MemeClip[] = [];

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
  return now + 1 + random();
}

export function memeSlot(format: "shorts" | "long", previous = -1, random = Math.random) {
  const slots = Array.from({ length: format === "shorts" ? 3 : 4 }, (_, i) => i).filter(i => i !== previous);
  return slots[Math.min(slots.length - 1, Math.floor(random() * slots.length))] ?? 0;
}

export function gameLayout(W: number, H: number, columns: number, rows: number, withMems: boolean) {
  const vertical = H > W, hud = vertical ? 260 : 120;
  const maxWidth = !vertical && withMems ? W * 0.62 : W - 80;
  const bottom = vertical ? 440 : 40;
  const cell = Math.floor(Math.min(maxWidth / columns, (H - hud - bottom) / rows));
  const bw = cell * columns, bh = cell * rows;
  return { hud, cell, bw, bh, ox: Math.floor((W - bw) / 2), oy: hud + 20 };
}

export function memeRect(W: number, H: number, board: ReturnType<typeof gameLayout>, slot: number) {
  if (H > W) {
    const width = Math.min(300, (W - 100) / 3);
    const height = Math.min(360, H - board.oy - board.bh - 80);
    return { x: 40 + slot * ((W - 80 - width) / 2), y: board.oy + board.bh + 40, width, height };
  }
  const width = Math.max(80, Math.min(board.ox - 70, 310)), height = Math.min(310, (H - board.hud - 80) / 2);
  return { x: slot % 2 === 0 ? (board.ox - width) / 2 : W - (board.ox + width) / 2,
    y: slot < 2 ? board.hud + 40 : H - height - 70, width, height };
}

/** Browser-only playback; the same video frame and shared audio mix get recorded. */
export class MemePlayer {
  private videos = new Map<string, HTMLVideoElement>();
  private nodes: MediaElementAudioSourceNode[] = [];
  active: { clip: MemeClip; video: HTMLVideoElement } | null = null;
  private disposed = false;
  constructor(private context: AudioContext, private output: AudioNode, private onEnded = () => {}) {}
  prepare(clips: MemeClip[]) {
    for (const clip of clips) {
      if (this.videos.has(clip.id)) continue;
      const video = document.createElement("video");
      video.crossOrigin = "anonymous"; video.preload = "auto"; video.playsInline = true;
      video.src = clip.url;
      video.onended = () => { if (this.active?.video === video) { this.active = null; this.onEnded(); } };
      video.onerror = () => { if (this.active?.video === video) { this.active = null; this.onEnded(); } };
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
    void video.play().catch(() => { if (this.active?.video === video) { this.clear(); this.onEnded(); } });
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