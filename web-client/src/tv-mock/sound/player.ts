// TV-mock sound player (Web Audio). Nothing is created or fetched before the first key press or click (autoplay
// policy); then every cue is fetched and decoded once. Mute is a per-device setting (Settings + pause menu).
// Reduced motion is not a mute signal: sounds keep playing.
import { signal } from "@preact/signals";
import { BRAND } from "@mishana/shared/brand";
import { readRaw, writeRaw } from "../../lib/storage";
import { busOf, CUE_IDS, cueFile } from "./cues";
import type { Bus, CueId, CuePlay } from "./cues";

export const SOUND_KEY = `${BRAND.storagePrefix}:tvSound`;
/** Bus gains (DESIGN §6.4: SFX and Stingers buses; the remote's UI ticks sit well below both). */
const BUS_GAIN: Record<Bus, number> = { sfx: 0.85, sting: 1, ui: 0.55 };

export const soundMuted = signal(readRaw(SOUND_KEY) === "off");

export function setSoundMuted(muted: boolean): void {
  soundMuted.value = muted;
  writeRaw(SOUND_KEY, muted ? "off" : "on");
  if (muted) stopAll();
}

let ctx: AudioContext | null = null;
let master: GainNode | null = null;
const buffers = new Map<CueId, AudioBuffer>();
const live = new Set<AudioBufferSourceNode>();

async function load(c: AudioContext, cue: CueId): Promise<void> {
  try {
    const res = await fetch(`${import.meta.env.BASE_URL}sounds/${cueFile(cue)}.ogg`);
    if (!res.ok) return;
    buffers.set(cue, await c.decodeAudioData(await res.arrayBuffer()));
  } catch {
    // A missing or undecodable file just stays silent: every sound has a visual counterpart.
  }
}

/** Creates the AudioContext inside a user gesture and starts preloading. Safe to call repeatedly. */
export function unlockAudio(): void {
  if (ctx) {
    if (ctx.state === "suspended") void ctx.resume();
    return;
  }
  const AC = typeof window !== "undefined" ? window.AudioContext : undefined;
  if (!AC) return;
  try {
    ctx = new AC();
  } catch {
    return;
  }
  master = ctx.createGain();
  master.connect(ctx.destination);
  const c = ctx;
  for (const cue of CUE_IDS) void load(c, cue);
}

export function play({ cue, rate = 1, delayMs = 0 }: CuePlay): void {
  if (soundMuted.value || !ctx || !master || ctx.state !== "running") return;
  const buf = buffers.get(cue);
  if (!buf) return;
  const src = ctx.createBufferSource();
  src.buffer = buf;
  src.playbackRate.value = rate;
  const g = ctx.createGain();
  g.gain.value = BUS_GAIN[busOf(cue)];
  src.connect(g).connect(master);
  live.add(src);
  src.onended = () => live.delete(src);
  src.start(ctx.currentTime + Math.max(0, delayMs) / 1000);
}

export function playAll(list: readonly CuePlay[]): void {
  for (const p of list) play(p);
}

/** Cuts every playing cue (mute, or a skipped reveal so the drumroll does not run over the end state). */
export function stopAll(): void {
  for (const s of live) {
    try { s.stop(); } catch { /* already stopped */ }
  }
  live.clear();
}
