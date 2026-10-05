import React from 'react';
import {interpolate, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import peaks from './sfx-peaks.json';
import {B, FILM_DURATION} from './Film';
import {b, clamp, FPS, MUSIC_TRIM_FRAMES} from './time';

type Hit = {at: number; sfx: keyof typeof peaks; vol?: number; max?: number};

// Every event of the film (story beats through B(), so the inserted reading beats move the sound with the picture).
// v2 mix (DECISIONS.md #10, polish.md S1–S8): ≤ 1 SFX per beat, pops ≤ 0.45 with alternating pitch, two bass hits
// for the votes (not five), the stamp alone with a short music "hole" before it, a calm end card.
const HITS: Hit[] = [
  {at: b(5.5), sfx: 'whoosh_fast', vol: 0.3},
  {at: b(6), sfx: 'typing', vol: 0.5, max: 46},
  {at: b(7), sfx: 'click', vol: 0.7},
  {at: b(7.6), sfx: 'whoosh_fast', vol: 0.28},
  {at: b(8), sfx: 'pop_a'},
  {at: b(9), sfx: 'pop_b'},
  {at: b(10), sfx: 'pop_a'},
  {at: b(11), sfx: 'pop_b'},
  {at: b(15), sfx: 'click', vol: 0.8},
  {at: b(16), sfx: 'impact_drop', vol: 0.7},
  {at: b(18.2), sfx: 'swoosh_short', vol: 0.5},
  {at: b(19), sfx: 'pop_b'},
  {at: B(20), sfx: 'pop_hard'},
  {at: B(21.3), sfx: 'whoosh_fast', vol: 0.4},
  {at: B(22), sfx: 'pop_a'},
  {at: B(23), sfx: 'pop_b'},
  {at: B(24), sfx: 'pop_a'},
  {at: B(25), sfx: 'pop_b'},
  {at: B(26), sfx: 'pop_a'},
  {at: B(27), sfx: 'wrong', vol: 0.5, max: 60},
  {at: B(28.5), sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: B(29.5), sfx: 'tick', vol: 0.35, max: 20},
  {at: B(30.5), sfx: 'bass_hit', vol: 0.6, max: 40},
  {at: B(32), sfx: 'stamp', vol: 1},
  {at: B(32.5), sfx: 'impact_drop', vol: 0.45},
  {at: B(33.4), sfx: 'correct', vol: 0.4, max: 70},
  {at: B(34), sfx: 'whoosh_impact', vol: 0.55, max: 120},
  {at: B(35.5), sfx: 'pop_hard'},
  {at: B(36.75), sfx: 'whoosh_fast', vol: 0.45},
  {at: B(38.2), sfx: 'pop_hard'},
  {at: B(40.3), sfx: 'swoosh_short', vol: 0.45},
  {at: B(41.3), sfx: 'sparkle', vol: 0.55},
  {at: B(42.3), sfx: 'swoosh_short', vol: 0.35},
  {at: B(43.8), sfx: 'pop_b', vol: 0.4},
  {at: B(45.5), sfx: 'pop_a', vol: 0.4},
];

const POPS = new Set(['pop_a', 'pop_b', 'pop_hard']);
const PITCH = [0.94, 1, 1.06, 1];

/** Music gain: 0.5 (−6 dB), a −4 dB dip from 6 frames before the stamp to 12 after, a 54-frame cubic fade at the end. */
const musicGain = (f: number) => {
  const st = B(32);
  const dip = f > st - 12 && f < st + 22 ? 1 - 0.37 * clamp(Math.min((f - (st - 12)) / 6, (st + 22 - f) / 10)) : 1;
  const fade = interpolate(f, [FILM_DURATION - 54, FILM_DURATION - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'});
  return 0.5 * dip * (1 - Math.pow(1 - fade, 3));
};

export const Sound: React.FC = () => {
  let popIndex = 0;
  return (
    <>
      <Audio src={staticFile('music/take-this-higher.mp3')} trimBefore={MUSIC_TRIM_FRAMES} volume={musicGain} />
      {HITS.map((h, i) => {
        const p = peaks[h.sfx];
        const from = Math.max(0, Math.round(h.at - p.peak * FPS));
        const len = Math.min(Math.round(p.dur * FPS), h.max ?? 9999);
        const pop = POPS.has(h.sfx);
        return (
          <Sequence key={i} from={from} durationInFrames={len} layout="none">
            <Audio src={staticFile(`sfx/${h.sfx}.mp3`)} volume={pop ? Math.min(h.vol ?? 0.45, 0.45) : h.vol ?? 0.7}
              toneFrequency={pop ? PITCH[popIndex++ % PITCH.length] : 1} />
          </Sequence>
        );
      })}
    </>
  );
};
