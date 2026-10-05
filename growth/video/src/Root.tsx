import React from 'react';
import {AbsoluteFill, Composition, Folder, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {Film, FILM_DURATION} from './Film';
import {Sound} from './Sound';
import {FPS} from './time';
import {AdCompositions} from './ads/Ads';

// The app's own Cairo files (tv-app/app/src/main/res/font, tightened metrics).
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_semibold.ttf'), weight: '600'});
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_bold.ttf'), weight: '700'});
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_extrabold.ttf'), weight: '800'});
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_black.ttf'), weight: '900'});

type Props = {blur: number; cta?: 'live' | 'prelaunch'; guide?: boolean; captions?: boolean};

const Main: React.FC<Props> = ({blur, cta = 'live', captions = true}) => (
  <AbsoluteFill>
    {blur > 1 ? (
      <CameraMotionBlur samples={blur} shutterAngle={120}>
        <Film cta={cta} captions={captions} />
      </CameraMotionBlur>
    ) : (
      <Film cta={cta} captions={captions} />
    )}
    <Sound />
  </AbsoluteFill>
);

const FORMATS = [
  {id: 'MishAna-16x9', width: 1920, height: 1080},
  {id: 'MishAna-9x16', width: 1080, height: 1920},
  {id: 'MishAna-1x1', width: 1080, height: 1080},
];

export const RemotionRoot: React.FC = () => (
  <>
  <AdCompositions />
  <Folder name="Film">
    {FORMATS.map((fm) => (
      <Composition key={fm.id} id={fm.id} component={Main} durationInFrames={FILM_DURATION} fps={FPS} width={fm.width} height={fm.height}
        defaultProps={{blur: 0} satisfies Props} />
    ))}
    {/* Before the Google Play launch: the CTA sends people to the free browser version */}
    {FORMATS.map((fm) => (
      <Composition key={fm.id + '-prelaunch'} id={fm.id + '-prelaunch'} component={Main} durationInFrames={FILM_DURATION} fps={FPS} width={fm.width}
        height={fm.height} defaultProps={{blur: 0, cta: 'prelaunch'} satisfies Props} />
    ))}
  </Folder>
  </>
);
