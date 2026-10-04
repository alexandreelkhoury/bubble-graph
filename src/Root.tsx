import React from 'react';
import {AbsoluteFill, Composition, Folder, staticFile} from 'remotion';
import {loadFont} from '@remotion/fonts';
import {CameraMotionBlur} from '@remotion/motion-blur';
import {Film} from './Film';
import {Sound} from './Sound';
import {DURATION, FPS} from './time';
import {AdCompositions} from './ads/Ads';

// The app's own Cairo files (tv-app/app/src/main/res/font, tightened metrics).
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_semibold.ttf'), weight: '600'});
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_bold.ttf'), weight: '700'});
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_bold.ttf'), weight: '800'});
loadFont({family: 'Cairo', url: staticFile('fonts/cairo_black.ttf'), weight: '900'});

type Props = {blur: number};

const Main: React.FC<Props> = ({blur}) => (
  <AbsoluteFill>
    {blur > 1 ? (
      <CameraMotionBlur samples={blur} shutterAngle={180}>
        <Film />
      </CameraMotionBlur>
    ) : (
      <Film />
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
      <Composition key={fm.id} id={fm.id} component={Main} durationInFrames={DURATION} fps={FPS} width={fm.width} height={fm.height}
        defaultProps={{blur: 0} satisfies Props} />
    ))}
  </Folder>
  </>
);
