package app.mishana.tv.game

import app.mishana.tv.IntBounds

/** Pure Left/Right stepping rules for the TV settings rows (SPEC §3 `SETTINGS_BOUNDS`, DESIGN TV-03). */
object SettingsStepper {
    /**
     * Steps [value] by `dir * step`. Stepping down from `min` goes to `off` (when present); stepping up from `off`
     * goes to `min`. Values clamp at `max` and at `min`/`off`.
     */
    fun stepInt(value: Int, bounds: IntBounds, dir: Int): Int {
        if (dir == 0) return value
        val off = bounds.off
        if (off != null && value == off) return if (dir > 0) bounds.min else off
        val next = value + dir * bounds.step
        return when {
            next < bounds.min -> off ?: bounds.min
            next > bounds.max -> bounds.max
            else -> next
        }
    }

    /** Cycles through [values] (wrapping), e.g. win rule, word language. */
    fun <T> cycle(values: List<T>, current: T, dir: Int): T {
        if (values.isEmpty()) return current
        val i = values.indexOf(current).let { if (it < 0) 0 else it }
        val n = values.size
        return values[((i + dir) % n + n) % n]
    }

    /**
     * Toggles one pack in `packIds` where `[]` means "all packs". Selecting a pack while "all" is active selects
     * only that pack; deselecting the last one goes back to "all". Order follows [available].
     */
    fun togglePack(packIds: List<String>, id: String, available: List<String>, maxItems: Int = 50): List<String> {
        val selected = packIds.toMutableSet()
        if (id in selected) selected.remove(id) else selected.add(id)
        val ordered = available.filter { it in selected } + selected.filter { it !in available }.sorted()
        return if (ordered.size == available.size && available.isNotEmpty() && selected.all { it in available }) {
            emptyList()
        } else {
            ordered.take(maxItems)
        }
    }

    /** Toggles a difficulty (1..3); returns null when the result would be empty (not allowed). */
    fun toggleDifficulty(difficulties: List<Int>, d: Int): List<Int>? {
        val set = difficulties.toMutableSet()
        if (d in set) set.remove(d) else set.add(d)
        return if (set.isEmpty()) null else set.sorted()
    }
}
