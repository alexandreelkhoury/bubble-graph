package app.jamaa.tv.platform

import app.jamaa.tv.games.WorldIds

/**
 * World tokens (JAMAA-PLATFORM §3.4, DESIGN-JAMAA §1.5) as ARGB, pure (JVM-tested for contrast).
 * JAMAA-GAP: the binding source is `shared/src/worlds/palettes.ts` → lane D's generated `WorldColors.kt`. Neither exists
 * yet (shared/src/worlds has ids only), so the values are DESIGN-JAMAA §1.5's table; `night-market` keeps the native
 * night stage (DESIGN-JAMAA §1.5 note). Replace this table with a delegation to WorldColors.kt when it lands.
 */
data class WorldPalette(
    val id: String,
    val deep: Long,
    val stageTop: Long,
    val surface: Long,
    val elevated: Long,
    val accent: Long,
    val accentText: Long,
    val onAccent: Long,
    val glow: Long,
    /** One game-specific accent, or null (`night-market`). */
    val signal: Long?,
)

object Worlds {
    val NIGHT_MARKET = WorldPalette(
        WorldIds.NIGHT_MARKET, deep = 0xFF120A1F, stageTop = 0xFF2A0F3D, surface = 0xFF1E1430, elevated = 0xFF2A1D42,
        accent = 0xFFFF3D8B, accentText = 0xFFFF7AB3, onAccent = 0xFF120A1F, glow = 0xFFFFC23D, signal = null,
    )
    val HAKAWATI_CAFE = WorldPalette(
        WorldIds.HAKAWATI_CAFE, deep = 0xFF1C1209, stageTop = 0xFF2E1D0E, surface = 0xFF33230F, elevated = 0xFF4A3418,
        accent = 0xFFE9A23B, accentText = 0xFFE9A23B, onAccent = 0xFF120A1F, glow = 0xFFFFE3A3, signal = 0xFFFF5A5F,
    )
    val ROOFTOP = WorldPalette(
        WorldIds.ROOFTOP, deep = 0xFF071A24, stageTop = 0xFF0E2C3B, surface = 0xFF0F2E3D, elevated = 0xFF17404F,
        accent = 0xFF29D3C2, accentText = 0xFF29D3C2, onAccent = 0xFF120A1F, glow = 0xFFB8FFF6, signal = 0xFFFFC94D,
    )
    val QUIZ_STUDIO = WorldPalette(
        WorldIds.QUIZ_STUDIO, deep = 0xFF0A0F2E, stageTop = 0xFF141C52, surface = 0xFF161D4A, elevated = 0xFF222B63,
        accent = 0xFF5B7CFF, accentText = 0xFF8FA8FF, onAccent = 0xFF120A1F, glow = 0xFFFFD84D, signal = 0xFF3DDC97,
    )

    val ALL: List<WorldPalette> = listOf(NIGHT_MARKET, HAKAWATI_CAFE, ROOFTOP, QUIZ_STUDIO)

    /** The palette of a world id; unknown ids fall back to the night market (the hub stage). */
    fun of(id: String?): WorldPalette = ALL.firstOrNull { it.id == id } ?: NIGHT_MARKET

    /** Cream text `#FFF7EC`. */
    const val TEXT = 0xFFFFF7EC

    /** WCAG 2.x contrast ratio between two opaque ARGB colours. */
    fun contrast(a: Long, b: Long): Double {
        fun lum(c: Long): Double {
            fun ch(v: Long): Double {
                val s = v / 255.0
                return if (s <= 0.03928) s / 12.92 else Math.pow((s + 0.055) / 1.055, 2.4)
            }
            return 0.2126 * ch((c shr 16) and 0xFF) + 0.7152 * ch((c shr 8) and 0xFF) + 0.0722 * ch(c and 0xFF)
        }
        val la = lum(a)
        val lb = lum(b)
        return (maxOf(la, lb) + 0.05) / (minOf(la, lb) + 0.05)
    }

    /** Linear blend of two ARGB colours (the hub's 40 % world tint). */
    fun mix(a: Long, b: Long, t: Float): Long {
        fun ch(c: Long, s: Int) = ((c shr s) and 0xFF).toDouble()
        fun m(s: Int) = (ch(a, s) + (ch(b, s) - ch(a, s)) * t).toLong().coerceIn(0, 255)
        return (0xFFL shl 24) or (m(16) shl 16) or (m(8) shl 8) or m(0)
    }
}
