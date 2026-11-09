// vite.config.ts `i18nSplit()`: the phone part and the TV part of each root catalog (src/lib/i18nSplit.ts).
declare module "virtual:jamaa-i18n/*" {
  const table: Record<string, unknown>;
  export default table;
}
declare module "virtual:jamaa-i18n-tv/*" {
  const table: Record<string, unknown>;
  export default table;
}
