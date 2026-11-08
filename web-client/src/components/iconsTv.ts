// Icon paths drawn only by the /tv mock; registered when its chunk loads (components/Icon registerIcons).
import { MISHANA_ICONS } from "../games/mishana/icons";

export const TV_ICONS: Readonly<Record<string, string>> = { ...MISHANA_ICONS, ...{
  "pause": "M8 5v14M16 5v14",
  "minus": "M6 12h12",
  "plus": "M12 6v12M6 12h12",
  "volume": "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM15.5 9a4 4 0 0 1 0 6M18.2 6.3a7.8 7.8 0 0 1 0 11.4",
  "volume-off": "M4 9.5h3.5L12 5.5v13l-4.5-4H4zM16 9.5l5 5M21 9.5l-5 5",
  "grid": "M4 4h6.5v6.5H4zM13.5 4H20v6.5h-6.5zM4 13.5h6.5V20H4zM13.5 13.5H20V20h-6.5z",
  "arrow-back": "M19 12H5M11 6l-6 6 6 6",
  "qr": "M4 4h6v6H4zM14 4h6v6h-6zM4 14h6v6H4zM14 14h2.5v2.5H14zM17.5 17.5H20V20h-2.5z",
} };
