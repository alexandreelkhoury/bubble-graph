import React from 'react';
import {interpolate, Sequence, staticFile} from 'remotion';
import {Audio} from '@remotion/media';
import peaks from './sfx-peaks.json';
import {b, DURATION, FPS, MUSIC_TRIM_FRAMES} from './time';

type Hit = {at: number; sfx: keyof typeof peaks; vol?: number; max?: number};

// Every event of the film, by beat. Each effect is shifted so its measured peak lands on `at`.
const HITS: Hit[] = [
  {at: b(0), sfx: 'pop_a', vol: 0.7},
  {at: b(1.3), sfx: 'swoosh_short', vol: 0.45},
  {at: b(2), sfx: 'tick', vol: 0.5, max: 20},
  {at: b(3), sfx: 'tick', vol: 0.5, max: 20},
  {at: b(4), sfx: 'tick', vol: 0.5, max: 20},
  {at: b(5), sfx: 'tick', vol: 0.5, max: 20},
  {at: b(5.9), sfx: 'whoosh_fast', vol: 0.35},
  {at: b(6), sfx: 'typing', vol: 0.55, max: 46},
  {at: b(7), sfx: 'click', vol: 0.8},
  {at: b(7.6), sfx: 'whoosh_fast', vol: 0.3},
  {at: b(8), sfx: 'pop_a', vol: 0.75},
  {at: b(9), sfx: 'pop_b', vol: 0.75},
  {at: b(9.5), sfx: 'pop_a', vol: 0.6},
  {at: b(10), sfx: 'pop_b', vol: 0.75},
  {at: b(10.5), sfx: 'pop_a', vol: 0.6},
  {at: b(11), sfx: 'pop_b', vol: 0.75},
  {at: b(15), sfx: 'click', vol: 0.9},
  {at: b(16), sfx: 'impact_drop', vol: 0.75},
  {at: b(18), sfx: 'tick', vol: 0.55, max: 20},
  {at: b(18.2), sfx: 'swoosh_short', vol: 0.55},
  {at: b(19), sfx: 'pop_b', vol: 0.45},
  {at: b(20), sfx: 'pop_hard', vol: 0.7},
  {at: b(21.3), sfx: 'whoosh_fast', vol: 0.45},
  {at: b(22), sfx: 'pop_a', vol: 0.65},
  {at: b(23), sfx: 'pop_b', vol: 0.65},
  {at: b(24), sfx: 'pop_a', vol: 0.65},
  {at: b(25), sfx: 'pop_b', vol: 0.65},
  {at: b(26), sfx: 'pop_a', vol: 0.65},
  {at: b(27), sfx: 'wrong', vol: 0.5, max: 60},
  {at: b(28.5), sfx: 'bass_hit', vol: 0.7, max: 40},
  {at: b(29), sfx: 'bass_hit', vol: 0.7, max: 40},
  {at: b(29.5), sfx: 'bass_hit', vol: 0.7, max: 40},
  {at: b(30), sfx: 'bass_hit', vol: 0.7, max: 40},
  {at: b(30.5), sfx: 'bass_hit', vol: 0.7, max: 40},
  {at: b(32), sfx: 'stamp', vol: 1},
  {at: b(32.5), sfx: 'correct', vol: 0.45, max: 70},
  {at: b(34), sfx: 'whoosh_impact', vol: 0.6, max: 120},
  {at: b(35.5), sfx: 'pop_hard', vol: 0.55},
  {at: b(36.75), sfx: 'whoosh_fast', vol: 0.5},
  {at: b(38.2), sfx: 'pop_hard', vol: 0.6},
  {at: b(40.3), sfx: 'swoosh_short', vol: 0.5},
  {at: b(41.3), sfx: 'sparkle', vol: 0.7},
  {at: b(42.3), sfx: 'swoosh_short', vol: 0.4},
  {at: b(44), sfx: 'pop_b', vol: 0.6},
  {at: b(44.5), sfx: 'pop_b', vol: 0.6},
  {at: b(45), sfx: 'pop_b', vol: 0.6},
  {at: b(46), sfx: 'pop_hard', vol: 0.75},
];

export const Sound: React.FC = () => (
  <>
    <Audio
      src={staticFile('music/take-this-higher.mp3')}
      trimBefore={MUSIC_TRIM_FRAMES}
      volume={(f) => 0.8 * interpolate(f, [DURATION - 24, DURATION - 1], [1, 0], {extrapolateLeft: 'clamp', extrapolateRight: 'clamp'})}
    />
    {HITS.map((h, i) => {
      const p = peaks[h.sfx];
      const from = Math.round(h.at - p.peak * FPS);
      const len = Math.min(Math.round(p.dur * FPS), h.max ?? 9999);
      return (
        <Sequence key={i} from={from} durationInFrames={len} layout="none">
          <Audio src={staticFile(`sfx/${h.sfx}.mp3`)} volume={h.vol ?? 0.7} />
        </Sequence>
      );
    })}
  </>
);
