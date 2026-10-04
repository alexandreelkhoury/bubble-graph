// TV-02 QR panel (SPEC §9.9 web mirror): content = joinUrl upper-cased, ECC M, margin 0,
// module = floor(panel / (width + 8)), drawn inset by 4 modules inside the cream panel. Never mirrored.
import qrcode from "qrcode-generator";
import { PALETTE } from "../components/UI";
import { tvScale } from "./tvStore";

const ALNUM = /^[0-9A-Z $%*+\-./:]*$/;

export function qrMatrix(url: string): { size: number; dark: (r: number, c: number) => boolean } {
  const content = url.toUpperCase();
  const qr = qrcode(0, "M");
  qr.addData(content, ALNUM.test(content) ? "Alphanumeric" : "Byte");
  qr.make();
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

/** Module size in dp, snapped so one module is a whole number of device pixels at the canvas scale (even modules). */
export function moduleSize(panel: number, size: number, devicePxPerDp = 1): number {
  const k = devicePxPerDp > 0 ? devicePxPerDp : 1;
  return Math.max(1, Math.floor((panel * k) / (size + 8))) / k;
}

export function Qr({ url, panel = 240 }: { url: string; panel?: number }) {
  const m = qrMatrix(url);
  const mod = moduleSize(panel, m.size, tvScale.value * (typeof devicePixelRatio === "number" ? devicePixelRatio : 1));
  const inner = mod * m.size;
  const off = (panel - inner) / 2;
  let d = "";
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  return (
    <div class="qr" dir="ltr" style={{ width: `${panel}px`, height: `${panel}px` }}>
      <svg width={inner} height={inner} viewBox={`0 0 ${m.size} ${m.size}`} shape-rendering="crispEdges" style={{ margin: `${off}px` }} role="img" aria-label={url}>
        <path d={d} fill={PALETTE.ink} />
      </svg>
    </div>
  );
}
