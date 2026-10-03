package app.mishana.tv.game

import java.text.BreakIterator

/** Display helpers for player-provided names (pure). */
object Names {
    /** Truncates to [max] user-perceived characters (grapheme clusters) with an ellipsis (DESIGN §7: 12 on tiles, 20 in the spotlight). */
    fun ellipsize(name: String, max: Int): String {
        if (max <= 0) return ""
        val it = BreakIterator.getCharacterInstance()
        it.setText(name)
        var count = 0
        var end = it.first()
        while (true) {
            val next = it.next()
            if (next == BreakIterator.DONE) return name
            count++
            if (count > max) return name.substring(0, end).trimEnd() + "…"
            end = next
        }
    }

    /** True if the text contains Arabic letters (Latin names "type on"; Arabic names fade in, DESIGN §6.2-F). */
    fun hasArabic(text: String): Boolean = text.any { c ->
        c in '؀'..'ۿ' || c in 'ݐ'..'ݿ' || c in 'ࢠ'..'ࣿ' || c in 'ﭐ'..'﷿' || c in 'ﹰ'..'﻿'
    }
}
