import React from 'react';

// Line icons for the M2 checklist: 24-unit grid, 2.2 stroke, round caps (same family as EndCard's TvIcon/PhoneIcon).
type P = {size: number; color: string; bg?: string};

const Svg: React.FC<{size: number; color: string; children: React.ReactNode}> = ({size, color, children}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke={color} strokeWidth={2.2} strokeLinecap="round" strokeLinejoin="round"
    style={{display: 'block', overflow: 'visible'}}>
    {children}
  </svg>
);

export const ControllerIcon: React.FC<P> = ({size, color}) => (
  <Svg size={size} color={color}>
    <path d="M7 6.5h10a4.6 4.6 0 0 1 4.5 3.8l1 5.6a2.9 2.9 0 0 1-5.1 2.3L15.6 16H8.4l-1.8 2.2a2.9 2.9 0 0 1-5.1-2.3l1-5.6A4.6 4.6 0 0 1 7 6.5z" />
    <path d="M7.6 9.8v3.6M5.8 11.6h3.6" />
    <path d="M15.6 10.6h.01M17.8 12.8h.01" strokeWidth={2.8} />
  </Svg>
);

export const PhoneDownIcon: React.FC<P> = ({size, color}) => (
  <Svg size={size} color={color}>
    <rect x="5.5" y="1.8" width="13" height="20.4" rx="3" />
    <path d="M12 6.2v8M8.8 11l3.2 3.2 3.2-3.2" />
    <path d="M10 18.4h4" />
  </Svg>
);

/** Two open hands, palms up, passing a phone between them. */
export const PassIcon: React.FC<P> = ({size, color}) => {
  const hand = 'M1 13.6h2.6c.9 0 1.7.3 2.4.8l2.2 1.6h2.6a1.4 1.4 0 0 1 0 2.8H7.6M1 20.6h6.4l4.4-1.4';
  return (
    <Svg size={size} color={color}>
      <path d={hand} />
      <path d={hand} transform="translate(24 0) scale(-1 1)" />
      <rect x="9" y="1.6" width="6.4" height="10.4" rx="1.6" transform="rotate(16 12.2 6.8)" />
      <path d="M3.4 8.4a8 8 0 0 1 2.4-3.6M20.6 8.4a8 8 0 0 0-2.4-3.6" />
    </Svg>
  );
};

/** TV with a phone in front of it (the "answer" row). `bg` knocks the phone out of the TV outline. */
export const TvPhoneIcon: React.FC<P> = ({size, color, bg = 'none'}) => (
  <Svg size={size} color={color}>
    <rect x="1.4" y="3" width="17.6" height="12.2" rx="2.2" />
    <path d="M6.6 20h7M10.2 15.2V20" />
    <rect x="14.6" y="9" width="7.6" height="13" rx="1.9" fill={bg} />
  </Svg>
);

/** Check / cross drawn on with a 0..1 `draw` (dash offset). */
export const CheckMark: React.FC<{size: number; color: string; draw: number; width?: number}> = ({size, color, draw, width = 3}) => (
  <svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block', overflow: 'visible'}}>
    <path d="M5.5 12.6l4.2 4.2L18.6 7.6" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" strokeLinejoin="round"
      pathLength={1} strokeDasharray={1} strokeDashoffset={1 - draw} />
  </svg>
);

export const CrossMark: React.FC<{size: number; color: string; draw: number; width?: number}> = ({size, color, draw, width = 3}) => {
  const a = Math.min(1, draw * 2), c = Math.max(0, draw * 2 - 1);
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" style={{display: 'block', overflow: 'visible'}}>
      <path d="M6.5 6.5l11 11" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - a} />
      {c > 0 ? <path d="M17.5 6.5l-11 11" fill="none" stroke={color} strokeWidth={width} strokeLinecap="round" pathLength={1} strokeDasharray={1} strokeDashoffset={1 - c} /> : null}
    </svg>
  );
};
