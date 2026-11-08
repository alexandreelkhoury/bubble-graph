package app.jamaa.tv.platform

import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.SettingFieldSpec
import app.jamaa.tv.games.TvGameMeta
import app.jamaa.tv.protocol.RoomSetup
import kotlinx.serialization.json.JsonArray
import kotlinx.serialization.json.JsonElement
import kotlinx.serialization.json.JsonNull
import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive
import kotlinx.serialization.json.booleanOrNull
import kotlinx.serialization.json.intOrNull

/** One item of the setup settings column (HUB-03, DESIGN-JAMAA §2.3). */
sealed interface SetupRow {
    val key: String

    /** "Content: English ▾" (room setting): OK opens the content-language dialog. */
    data class Content(val locale: String) : SetupRow {
        override val key: String get() = "contentLocale"
    }

    /** A Left/Right row. [valueKey] is an i18n key, else [valueText] is shown as is. */
    data class Step(
        override val key: String,
        val labelKey: String,
        val valueKey: String?,
        val valueText: String?,
        /** A premium setting (gem after the label). */
        val premium: Boolean,
        /** Premium and the room has no Pass: value greyed with "Pass"; OK opens the Pass store. */
        val locked: Boolean,
        /** An inline sub-row (Mish Ana! Custom impostor counts). */
        val inline: Boolean = false,
    ) : SetupRow

    /** OK opens the pack picker sheet (or the Trivia quiz shelf when [single]). */
    data class Packs(override val key: String, val labelKey: String, val selected: Int, val available: Int, val locked: Int, val single: Boolean) : SetupRow

    /** "Advanced ›" (only when the game has advanced settings). */
    data object Advanced : SetupRow {
        override val key: String get() = "advanced"
    }

    /** The big Start button. */
    data class Start(val canStart: Boolean, val blocker: String?) : SetupRow {
        override val key: String get() = "start"
    }
}

/** Steps on the column: true for rows Left/Right change (they never leave the row, SetupFocusGraph). */
val SetupRow.steps: Boolean get() = this is SetupRow.Step && !locked

/**
 * Builds the setup column from the game's `settings.basic` rows (§2.2, §3.5) — at most 4, a row with one possible value
 * hidden — and computes the `UPDATE_GAME_SETTINGS` patch of a Left/Right step. Mish Ana! adds its virtual "Timers"
 * preset row and the inline Custom impostor steppers (§3.5). Pure; JVM-tested.
 */
object SetupRows {
    const val MAX_BASIC_ROWS = 4

    /** §3.5 Mish Ana! timer presets (shared TIMER_PRESETS): clue / vote / reveal / guess seconds. */
    val TIMER_PRESETS: List<Pair<String, IntArray>> = listOf(
        "relaxed" to intArrayOf(60, 120, 45, 60),
        "normal" to intArrayOf(45, 90, 30, 45),
        "fast" to intArrayOf(30, 60, 20, 30),
        "off" to intArrayOf(0, 0, 0, 0),
    )
    private val TIMER_KEYS = listOf("clueSeconds", "voteSeconds", "revealSeconds", "guessSeconds")

    fun timerPreset(s: JsonObject): String {
        val values = TIMER_KEYS.map { (s[it] as? JsonPrimitive)?.intOrNull }
        return TIMER_PRESETS.firstOrNull { (_, v) -> v.toList() == values }?.first ?: "custom"
    }

    fun column(meta: TvGameMeta, setup: RoomSetup, contentLocale: String, premium: Boolean): List<SetupRow> = buildList {
        add(SetupRow.Content(contentLocale))
        var basic = 0
        for (f in meta.basic) {
            if (basic >= MAX_BASIC_ROWS) break
            val row = row(meta, f, setup, premium) ?: continue
            add(row)
            basic++
            if (meta.id == GameIds.MISHANA && f.key == "roleMode" && str(setup.settings["roleMode"]) == "custom") {
                for (k in listOf("undercoverCount", "blankCount")) {
                    val st = meta.advanced.firstOrNull { it.key == k } as? SettingFieldSpec.Stepper ?: continue
                    add(stepRow(meta, st, setup.settings, premium, inline = true))
                }
            }
        }
        if (meta.advanced.isNotEmpty()) add(SetupRow.Advanced)
        add(SetupRow.Start(setup.canStart, setup.startBlocker))
    }

    private fun row(meta: TvGameMeta, f: SettingFieldSpec, setup: RoomSetup, premium: Boolean): SetupRow? = when (f) {
        is SettingFieldSpec.Packs -> {
            val available = setup.availablePacks.count { it.gameId == meta.id }
            val locked = setup.lockedPacks.count { it.gameId == meta.id }
            if (available + locked <= 1) null
            else SetupRow.Packs(f.key, f.labelKey, selectedPacks(f, setup, meta.id), available, locked, f.single)
        }
        is SettingFieldSpec.Choice -> if (meta.id == GameIds.MISHANA && f.key == "timers") {
            val preset = timerPreset(setup.settings)
            val opt = f.options.firstOrNull { it.value.content == preset }
            SetupRow.Step(f.key, f.labelKey, opt?.labelKey ?: "game.mishana.settings.timersCustom", null, premium = false, locked = false)
        } else if (f.options.size <= 1) null else stepRow(meta, f, setup.settings, premium)
        is SettingFieldSpec.Toggle, is SettingFieldSpec.Stepper -> stepRow(meta, f, setup.settings, premium)
    }

    private fun stepRow(meta: TvGameMeta, f: SettingFieldSpec, s: JsonObject, premium: Boolean, inline: Boolean = false): SetupRow.Step {
        val isPremium = f.key in meta.premiumKeys
        val locked = isPremium && !premium
        val v = s[f.key]
        return when (f) {
            is SettingFieldSpec.Choice -> {
                val opt = f.options.firstOrNull { it.value == v } ?: f.options.firstOrNull { it.value.content == str(v) }
                SetupRow.Step(f.key, f.labelKey, opt?.labelKey ?: "setup.custom", null, isPremium, locked, inline)
            }
            is SettingFieldSpec.Toggle -> SetupRow.Step(f.key, f.labelKey, if ((v as? JsonPrimitive)?.booleanOrNull == true) "common.on" else "common.off", null, isPremium, locked, inline)
            is SettingFieldSpec.Stepper -> {
                val n = (v as? JsonPrimitive)?.intOrNull
                if (n != null && f.off != null && n == f.off) SetupRow.Step(f.key, f.labelKey, "common.timerOff", null, isPremium, locked, inline)
                else SetupRow.Step(f.key, f.labelKey, null, n?.toString() ?: "–", isPremium, locked, inline)
            }
            is SettingFieldSpec.Packs -> SetupRow.Step(f.key, f.labelKey, null, null, isPremium, locked, inline)
        }
    }

    private fun selectedPacks(f: SettingFieldSpec.Packs, setup: RoomSetup, gameId: String): Int {
        val ids = setup.availablePacks.filter { it.gameId == gameId }.map { it.id }.toSet()
        return when (val v = setup.settings[f.key]) {
            is JsonArray -> v.count { str(it) in ids }.let { n -> if (n == 0 && v.isEmpty()) ids.size else n } // [] = every playable pack
            is JsonNull -> 0 // a single-pick row (Trivia quizId) with the server's default choice
            is JsonPrimitive -> 1
            else -> 0
        }
    }

    /**
     * The patch for a Left/Right step on [key] (delta −1/+1), or null when nothing changes or the row is not a stepping
     * row. Choices wrap; steppers clamp (an `off` value sits below `min`); toggles flip.
     */
    fun step(meta: TvGameMeta, setup: RoomSetup, key: String, delta: Int): JsonObject? {
        val s = setup.settings
        if (meta.id == GameIds.MISHANA && key == "timers") {
            val cur = timerPreset(s)
            val i = TIMER_PRESETS.indexOfFirst { it.first == cur }
            val next = if (i < 0) TIMER_PRESETS[1] else TIMER_PRESETS[Math.floorMod(i + delta, TIMER_PRESETS.size)]
            return JsonObject(TIMER_KEYS.mapIndexed { j, k -> k to JsonPrimitive(next.second[j]) }.toMap())
        }
        val f = (meta.basic + meta.advanced).firstOrNull { it.key == key } ?: return null
        val v = s[key]
        val next: JsonElement = when (f) {
            is SettingFieldSpec.Choice -> {
                if (f.options.size <= 1) return null
                val i = f.options.indexOfFirst { it.value == v || it.value.content == str(v) }
                f.options[Math.floorMod((if (i < 0) 0 else i) + delta, f.options.size)].value
            }
            is SettingFieldSpec.Toggle -> JsonPrimitive(!((v as? JsonPrimitive)?.booleanOrNull ?: false))
            is SettingFieldSpec.Stepper -> {
                val n = (v as? JsonPrimitive)?.intOrNull ?: f.min
                JsonPrimitive(stepInt(n, delta, f))
            }
            is SettingFieldSpec.Packs -> return null
        }
        if (next == v) return null
        return JsonObject(mapOf(key to next))
    }

    fun stepInt(n: Int, delta: Int, f: SettingFieldSpec.Stepper): Int {
        val off = f.off
        if (off != null && n == off) return if (delta > 0) f.min else off
        val raw = n + delta * f.step
        return when {
            raw < f.min -> off ?: f.min
            raw > f.max -> f.max
            else -> raw
        }
    }

    private fun str(e: JsonElement?): String? = (e as? JsonPrimitive)?.takeIf { it !is JsonNull }?.content
}
