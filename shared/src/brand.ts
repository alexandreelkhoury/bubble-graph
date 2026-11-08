// The platform brand (JAMAA-PLATFORM §0, §1.3). Game #1's own name lives in ./games/mishana/meta.ts.
export const BRAND = {
  name: "JAMAA",
  nameAr: "جماعة",
  slug: "jamaa",               // URL slug (the Worker itself is named "play" in server/wrangler.jsonc)
  storagePrefix: "jamaa",      // localStorage / prefs prefix (web migrates the legacy keys, JAMAA-PLATFORM §1.5)
  androidAppId: "app.jamaa.tv",
} as const;
