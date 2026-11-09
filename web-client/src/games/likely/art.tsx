// Most Likely's original vector props (DESIGN-JAMAA §4.5): the gold award rosette, the cream ballot envelope and the
// Mind Reader's crystal ball. Drawn in code (no image assets), shared by the phone and the /tv screens.

let uid = 0;

/** The gold rosette (`world.signal` gold) with two ribbon tails; `label` is printed on the ribbon (first word). */
export function Rosette({ size = 96, label, class: cls }: { size?: number; label?: string; class?: string }) {
  const id = `lkr${++uid}`;
  const petals = Array.from({ length: 14 }, (_, i) => i * (360 / 14));
  return (
    <svg class={`lk-rosette${cls ? ` ${cls}` : ""}`} viewBox="0 0 100 120" width={size} height={size * 1.2} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={`${id}g`} cx="40%" cy="35%" r="70%">
          <stop offset="0" stop-color="#FFF1C2" /><stop offset=".45" stop-color="#FFC94D" /><stop offset="1" stop-color="#C98A1A" />
        </radialGradient>
        <linearGradient id={`${id}r`} x1="0" x2="1">
          <stop offset="0" stop-color="#E23B5A" /><stop offset=".5" stop-color="#FF5A7A" /><stop offset="1" stop-color="#B8213F" />
        </linearGradient>
      </defs>
      <path d="M36 62 L22 116 L34 106 L42 118 L50 66 Z" fill={`url(#${id}r)`} />
      <path d="M64 62 L78 116 L66 106 L58 118 L50 66 Z" fill={`url(#${id}r)`} />
      <g transform="translate(50 46)">
        {petals.map((a) => <ellipse key={a} cx="0" cy="-30" rx="9" ry="13" transform={`rotate(${a})`} fill="#E8A92E" stroke="#7A4A00" stroke-width="1.2" />)}
        <circle r="27" fill={`url(#${id}g)`} stroke="#7A4A00" stroke-width="2" />
        <circle r="20" fill="none" stroke="#FFF1C2" stroke-opacity=".7" stroke-width="1.5" stroke-dasharray="2 3" />
        <path d="M0 -11 l3.2 6.6 7.2 .9-5.3 5 1.4 7.1L0 5.1l-6.5 3.5 1.4-7.1-5.3-5 7.2-.9z" fill="#7A4A00" opacity=".85" />
      </g>
      {label && <text x="50" y="96" text-anchor="middle" class="lk-rosette__label">{label}</text>}
    </svg>
  );
}

/** One identical cream ballot envelope (secret votes: no voter colour, GAME-LIKELY §12.2). */
export function Envelope({ size = 40, class: cls }: { size?: number; class?: string }) {
  return (
    <svg class={`lk-env${cls ? ` ${cls}` : ""}`} viewBox="0 0 40 28" width={size} height={size * 0.7} aria-hidden="true" focusable="false">
      <rect x="1" y="1" width="38" height="26" rx="4" fill="#FFF7EC" stroke="#C9B48A" stroke-width="1.5" />
      <path d="M2 3 L20 16 L38 3" fill="none" stroke="#C9B48A" stroke-width="1.8" stroke-linejoin="round" />
      <circle cx="20" cy="16" r="3.4" fill="#E23B5A" />
    </svg>
  );
}

/** The Mind Reader's crystal ball prop. */
export function CrystalBall({ size = 64, class: cls }: { size?: number; class?: string }) {
  const id = `lkc${++uid}`;
  return (
    <svg class={`lk-crystal${cls ? ` ${cls}` : ""}`} viewBox="0 0 64 70" width={size} height={size * 1.1} aria-hidden="true" focusable="false">
      <defs>
        <radialGradient id={id} cx="38%" cy="32%" r="70%">
          <stop offset="0" stop-color="#FFFFFF" /><stop offset=".3" stop-color="#B8FFF6" /><stop offset=".75" stop-color="#29D3C2" /><stop offset="1" stop-color="#0E6E78" />
        </radialGradient>
      </defs>
      <path d="M14 58 h36 l6 10 H8z" fill="#C98A1A" stroke="#7A4A00" stroke-width="1.5" />
      <circle cx="32" cy="32" r="26" fill={`url(#${id})`} stroke="#B8FFF6" stroke-opacity=".8" stroke-width="1.5" />
      <path d="M20 22 a14 14 0 0 1 12 -8" fill="none" stroke="#FFFFFF" stroke-width="3" stroke-linecap="round" opacity=".85" />
      <circle cx="40" cy="38" r="2" fill="#FFFFFF" opacity=".8" /><circle cx="26" cy="42" r="1.4" fill="#FFFFFF" opacity=".6" />
    </svg>
  );
}

/** A small "?" puff (the Mystery Award). */
export function MysteryPuff({ size = 96, class: cls }: { size?: number; class?: string }) {
  return (
    <svg class={`lk-puff${cls ? ` ${cls}` : ""}`} viewBox="0 0 100 100" width={size} height={size} aria-hidden="true" focusable="false">
      <g fill="#B8A8D6" opacity=".9">
        <circle cx="30" cy="58" r="20" /><circle cx="52" cy="44" r="24" /><circle cx="72" cy="60" r="18" /><circle cx="50" cy="66" r="20" />
      </g>
      <text x="51" y="66" text-anchor="middle" class="lk-puff__q">?</text>
    </svg>
  );
}
