/** Downsample the same composited frame before encoding, not the game simulation. */
export const RECORDING_FPS = 30;
export const RECORDING_MAX_EDGE = 1280;

export function recordingSize(width: number, height: number) {
  const scale = Math.min(1, RECORDING_MAX_EDGE / Math.max(width, height));
  return { width: Math.max(2, Math.round(width * scale / 2) * 2), height: Math.max(2, Math.round(height * scale / 2) * 2) };
}

export function createRecordingCapture(source: HTMLCanvasElement, audioTracks: MediaStreamTrack[]) {
  const output = document.createElement("canvas");
  const size = recordingSize(source.width, source.height);
  output.width = size.width; output.height = size.height;
  const context = output.getContext("2d", { alpha: false });
  if (!context) throw new Error("Video canvas is unavailable");
  const stream = output.captureStream(0);
  const track = stream.getVideoTracks()[0] as CanvasCaptureMediaStreamTrack | undefined;
  const render = () => {
    context.drawImage(source, 0, 0, output.width, output.height);
    track?.requestFrame();
  };
  audioTracks.forEach(audio => stream.addTrack(audio.clone()));
  render();
  const timer = window.setInterval(render, 1000 / RECORDING_FPS);
  return {
    stream,
    dispose: () => { window.clearInterval(timer); stream.getTracks().forEach(t => t.stop()); },
  };
}

export function recordingOptions(): MediaRecorderOptions {
  // VP8 is substantially lighter than software VP9/AV1 encoding on daily runners.
  const mimeType = ["video/webm;codecs=vp8,opus", "video/webm", "video/mp4"].find(type => MediaRecorder.isTypeSupported(type));
  return { ...(mimeType ? { mimeType } : {}), videoBitsPerSecond: 5_000_000, audioBitsPerSecond: 192_000 };
}