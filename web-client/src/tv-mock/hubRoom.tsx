// DESIGN-JAMAA §1.1 / art board 03 (hub, dark): "the hub feels like a lit living room". A code-drawn Beirut living room
// behind the hub UI, in three depths: far (the city through an arched window, a crescent moon), mid (the window, its
// curtains, a long divan along the wall where the gang sits) and near (a cement-tile floor row and a pendant lamp's
// warm cone). Dimmed under the UI; .tvhub__tint above it pulls it 40 % toward the focused game's world.
// JAMAA-GAP (lane D): the geometry belongs in shared/src (scenes) so the native hub draws the same layers; it lives
// here until lane D moves it. Everything is plain SVG (no image assets, ~2 KB).

/** The divan's seat line in canvas dp: the members strip's characters sit on it (tvPlatform.css .tvmembers). */
export const DIVAN_SEAT_Y = 486;

/** Cement-tile motif (one 28 dp tile): a quatrefoil in a square, the classic Beirut floor. */
function TilePattern() {
  return (
    <pattern id="hubtile" width="28" height="28" patternUnits="userSpaceOnUse">
      <rect width="28" height="28" fill="#3A2C26" />
      <path d="M0 0H28V28H0Z" fill="none" stroke="#24191A" stroke-width="1.2" />
      <path d="M14 3C17 7 21 11 25 14 21 17 17 21 14 25 11 21 7 17 3 14 7 11 11 7 14 3Z" fill="#4C6B66" opacity=".55" />
      <circle cx="14" cy="14" r="3" fill="#B5674D" opacity=".7" />
      <path d="M0 0L4 0 0 4ZM28 0L24 0 28 4ZM0 28L4 28 0 24ZM28 28L24 28 28 24Z" fill="#B5674D" opacity=".5" />
    </pattern>
  );
}

export function HubRoom({ gathering }: { gathering: boolean }) {
  return (
    <svg class={`tvroom${gathering ? " is-gathering" : ""}`} viewBox="0 0 960 540" width="960" height="540" preserveAspectRatio="none" aria-hidden="true" focusable="false">
      <defs>
        <TilePattern />
        <linearGradient id="hubwall" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#2A1E1B" />
          <stop offset="1" stop-color="#1A1314" />
        </linearGradient>
        <linearGradient id="hubsky" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#131A33" />
          <stop offset="1" stop-color="#2B2440" />
        </linearGradient>
        <radialGradient id="hublamp" cx="0.5" cy="0" r="1">
          <stop offset="0" stop-color="#FFC56B" stop-opacity=".34" />
          <stop offset=".55" stop-color="#FFB45A" stop-opacity=".08" />
          <stop offset="1" stop-color="#FFB45A" stop-opacity="0" />
        </radialGradient>
        <clipPath id="hubarch"><path d="M548 380V150C548 104 576 74 614 74 652 74 680 104 680 150V380Z" /></clipPath>
      </defs>

      {/* wall: warm plaster, a picture rail */}
      <rect class="tvroom__wall" width="960" height="540" fill="url(#hubwall)" />
      <path d="M0 64H960" stroke="#3A2A24" stroke-width="2" opacity=".6" />

      {/* far: the city through the arched window (layer moves least) */}
      <g class="tvroom__far">
        <g clip-path="url(#hubarch)">
          <rect x="540" y="70" width="150" height="320" fill="url(#hubsky)" />
          <path d="M650 108C641 110 636 118 638 127 640 135 648 140 656 138 650 136 645 130 645 123 645 116 648 111 650 108Z" fill="#FFE7A0" opacity=".85" />
          <path d="M548 380V286H560V266H574V292H584V248H600V274H612V236H622V230H630V262H644V280H656V254H670V296H680V380Z" fill="#0E1022" />
          <g fill="#FFC56B" opacity=".75">
            <rect x="588" y="256" width="3" height="4" /><rect x="592" y="268" width="3" height="4" /><rect x="616" y="244" width="3" height="4" />
            <rect x="634" y="270" width="3" height="4" /><rect x="660" y="266" width="3" height="4" /><rect x="564" y="276" width="3" height="4" />
          </g>
        </g>
      </g>

      {/* mid: the window frame and mullion, the curtains, the divan */}
      <g class="tvroom__mid">
        <path d="M548 380V150C548 104 576 74 614 74 652 74 680 104 680 150V380" fill="none" stroke="#5A3F33" stroke-width="7" />
        <path d="M614 76V380M550 230H678" stroke="#5A3F33" stroke-width="4" />
        <path d="M540 384H688" stroke="#6B4C3D" stroke-width="8" stroke-linecap="round" />
        <path d="M528 60C538 140 530 260 544 396H524C516 270 522 150 516 60Z" fill="#7A2E2A" opacity=".85" />
        <path d="M700 60C690 140 698 260 684 396H704C712 270 706 150 712 60Z" fill="#7A2E2A" opacity=".85" />
        <path d="M512 58H716" stroke="#8C6A4A" stroke-width="4" stroke-linecap="round" />

        {/* the divan along the wall: backrest, cushions, seat, base and feet */}
        <path class="tvroom__divan" d="M24 486V452C24 440 32 434 44 434H916C928 434 936 440 936 452V486Z" fill="#4A2B33" />
        <g fill="#5A3540" opacity=".9">
          <path d="M52 470C52 450 60 444 76 444H196C212 444 220 450 220 470Z" />
          <path d="M248 470C248 450 256 444 272 444H392C408 444 416 450 416 470Z" />
          <path d="M444 470C444 450 452 444 468 444H588C604 444 612 450 612 470Z" />
          <path d="M640 470C640 450 648 444 664 444H784C800 444 808 450 808 470Z" />
        </g>
        <path d="M14 482H946V500C946 506 942 510 936 510H24C18 510 14 506 14 500Z" fill="#62394A" />
        <path d="M14 484H946" stroke="#7B4C5E" stroke-width="2" opacity=".7" />
        <path d="M30 510V516M930 510V516M480 510V516" stroke="#2A1A1E" stroke-width="5" stroke-linecap="round" />
      </g>

      {/* near: the cement-tile floor row, the pendant lamp and its cone (drawn last, over everything) */}
      <g class="tvroom__near">
        <rect y="512" width="960" height="28" fill="url(#hubtile)" />
        <rect y="512" width="960" height="28" fill="#120A1F" opacity=".35" />
        <path d="M470 0V30" stroke="#1A1212" stroke-width="2" />
        <path d="M452 46C452 36 460 30 470 30 480 30 488 36 488 46Z" fill="#B5674D" />
        <ellipse cx="470" cy="47" rx="7" ry="2.4" fill="#FFE7A0" />
        <path class="tvroom__cone" d="M456 46L250 540H690L484 46Z" fill="url(#hublamp)" />
      </g>
    </svg>
  );
}
