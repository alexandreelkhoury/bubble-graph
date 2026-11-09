package app.jamaa.tv.ui.characters

import androidx.compose.ui.graphics.Color

/**
 * DESIGN-JAMAA §4.3 / art board 03 ("controls stay controls, bursts are drawings"): the six reaction bursts drawn above
 * a reacting character, in a 24 × 24 box: filled parts get an ink outline, stroke parts are ink-free. Copied from web
 * `components/bursts.ts` (BURST_ART, base tracing). JAMAA-GAP (lane D): the geometry belongs in shared/src/characters
 * with a generated Kotlin copy; until then this copy and the web one must change together.
 */
object CharacterBursts {
    val INK = Color(0xFF120A1F)

    data class BurstPart(val d: String, val fill: Color? = null, val stroke: Color? = null, val width: Float = 1.2f)

    /** Burst id (CharacterPaths.reactionBurst without "burst.") → its drawing. */
    val art: Map<String, List<BurstPart>> = mapOf(
        "tears" to listOf(
            BurstPart("M4.6 8.4C3 10.6 2.3 12.2 3.1 13.4 3.9 14.4 5.6 14.1 5.9 12.7 6.2 11.6 5.6 10.1 4.6 8.4Z", fill = Color(0xFF7BD3FF)),
            BurstPart("M19.4 8.4C21 10.6 21.7 12.2 20.9 13.4 20.1 14.4 18.4 14.1 18.1 12.7 17.8 11.6 18.4 10.1 19.4 8.4Z", fill = Color(0xFF7BD3FF)),
            BurstPart("M2.2 4.6C1.6 5.6 1.4 6.3 1.8 6.8 2.2 7.2 2.9 7 3 6.4 3.1 5.9 2.8 5.3 2.2 4.6Z", fill = Color(0xFF7BD3FF)),
            BurstPart("M21.8 4.6C22.4 5.6 22.6 6.3 22.2 6.8 21.8 7.2 21.1 7 21 6.4 20.9 5.9 21.2 5.3 21.8 4.6Z", fill = Color(0xFF7BD3FF)),
        ),
        "exclaim" to listOf(
            BurstPart("M10.4 2.6L13.8 2.6 13 14.2 11.2 14.2Z", fill = Color(0xFFFFC94D)),
            BurstPart("M12.1 16.2C13.2 16.2 13.9 17 13.9 18 13.9 19 13.1 19.8 12.1 19.8 11.1 19.8 10.3 19 10.3 18 10.3 17 11 16.2 12.1 16.2Z", fill = Color(0xFFFFC94D)),
            BurstPart("M5.4 5.2L8 7.6M18.6 5.2L16 7.6", stroke = Color(0xFFFFC94D), width = 1.4f),
        ),
        "sweat" to listOf(
            BurstPart("M17.4 2.4C15.2 5.8 14.2 7.8 14.8 9.5 15.4 11 17.3 11.4 18.6 10.4 19.9 9.3 19.7 7.4 17.4 2.4Z", fill = Color(0xFF9FE4FF)),
            BurstPart("M20.8 12.2C20.1 13.3 19.8 14 20.2 14.6 20.6 15.1 21.4 14.9 21.6 14.3 21.7 13.8 21.4 13.1 20.8 12.2Z", fill = Color(0xFF9FE4FF)),
        ),
        "heart" to listOf(
            BurstPart("M12 20.4C9 18.4 3.8 14.8 3.8 10.4 3.8 7.7 5.8 6 8 6 9.8 6 11.2 7 12 8.5 12.8 7 14.2 6 16 6 18.2 6 20.2 7.7 20.2 10.4 20.2 14.8 15 18.4 12 20.4Z", fill = Color(0xFFFF7AB3)),
            BurstPart("M19.6 2.6L19.6 4.8M18.5 3.7L20.7 3.7", stroke = Color(0xFFFF7AB3), width = 1.2f),
        ),
        "raincloud" to listOf(
            BurstPart("M6.5 13.6C4.5 13.6 3 12.3 3 10.5 3 8.8 4.4 7.5 6.2 7.5 6.8 5.3 8.8 3.8 11.2 3.8 13.9 3.8 16 5.7 16.3 8.2 18.6 8.3 20.6 9.7 20.6 11.6 20.6 12.8 19.4 13.6 18 13.6Z", fill = Color(0xFFC9BFFF)),
            BurstPart("M8 16.2L7 19.4M12.2 16.2L11.2 19.4M16.4 16.2L15.4 19.4", stroke = Color(0xFF7BD3FF), width = 1.4f),
        ),
        "confetti" to listOf(
            BurstPart("M3.6 6.2L6.2 5.4 7 8 4.4 8.8Z", fill = Color(0xFFFF6B5E)),
            BurstPart("M16.8 3.4L19.2 4.3 18.3 6.7 15.9 5.8Z", fill = Color(0xFF3DDC97)),
            BurstPart("M9.6 1.8L11.4 3.8 9.4 5.6 7.6 3.6Z", fill = Color(0xFFFFC94D)),
            BurstPart("M18.8 11.6L21.4 11.8 21.2 14.4 18.6 14.2Z", fill = Color(0xFFC9BFFF)),
            BurstPart("M2.8 14.2L5 12.9 6.3 15.1 4.1 16.4Z", fill = Color(0xFFFFC94D)),
            BurstPart("M12.4 8.6C13.6 10.2 11.2 11.2 12.4 12.8 13.6 14.4 11.2 15.4 12.4 17", stroke = Color(0xFFFF7AB3), width = 1.2f),
        ),
    )

    /** The drawing for a reaction kind ("laugh" → tears), or null. */
    fun forReaction(kind: String?): List<BurstPart>? = kind?.let { CharacterPaths.reactionBurst[it] }?.removePrefix("burst.")?.let { art[it] }
}
