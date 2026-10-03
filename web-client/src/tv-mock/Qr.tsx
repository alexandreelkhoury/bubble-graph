// TV-02 QR panel (SPEC §9.9 web mirror): content = joinUrl upper-cased, ECC M, margin 0,
// module = floor(panel / (width + 8)), drawn inset by 4 modules inside the cream panel. Never mirrored.
import qrcode from "qrcode-generator";

const ALNUM = /^[0-9A-Z $%*+\-./:]*$/;

export function qrMatrix(url: string): { size: number; dark: (r: number, c: number) => boolean } {
  const content = url.toUpperCase();
  const qr = qrcode(0, "M");
  qr.addData(content, ALNUM.test(content) ? "Alphanumeric" : "Byte");
  qr.make();
  return { size: qr.getModuleCount(), dark: (r, c) => qr.isDark(r, c) };
}

export function Qr({ url, panel = 240 }: { url: string; panel?: number }) {
  const m = qrMatrix(url);
  const mod = Math.floor(panel / (m.size + 8));
  const inner = mod * m.size;
  const off = (panel - inner) / 2;
  let d = "";
  for (let r = 0; r < m.size; r++) {
    for (let c = 0; c < m.size; c++) if (m.dark(r, c)) d += `M${c} ${r}h1v1h-1z`;
  }
  return (
    <div class="qr" dir="ltr" style={{ width: `${panel}px`, height: `${panel}px` }}>
      <svg width={inner} height={inner} viewBox={`0 0 ${m.size} ${m.size}`} shape-rendering="crispEdges" style={{ margin: `${off}px` }} role="img" aria-label={url}>
        <path d={d} fill="#120A1F" />
      </svg>
    </div>
  );
}
