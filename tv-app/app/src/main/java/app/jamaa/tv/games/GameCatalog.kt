package app.jamaa.tv.games

import kotlinx.serialization.json.JsonPrimitive

// Kotlin mirror of the client-safe part of `GAME_META` (shared/src/games/<id>/meta.ts, JAMAA-PLATFORM §2.2): what the
// TV hub, setup, ⓘ sheet and pause menu need. Keep in sync by hand; GameCatalogTest checks every key against the
// generated i18n tables and the shape rules of §2.2/§3.5. G lanes edit only their own game's entry.

/** One setting row as `SettingField` describes it (§2.2). */
sealed interface SettingFieldSpec {
    val key: String
    val labelKey: String

    data class Stepper(override val key: String, override val labelKey: String, val min: Int, val max: Int, val step: Int, val off: Int? = null, val unitKey: String? = null) : SettingFieldSpec
    data class Choice(override val key: String, override val labelKey: String, val options: List<ChoiceOption>) : SettingFieldSpec
    data class Toggle(override val key: String, override val labelKey: String) : SettingFieldSpec
    data class Packs(override val key: String, override val labelKey: String, val single: Boolean) : SettingFieldSpec
}

data class ChoiceOption(val value: JsonPrimitive, val labelKey: String)

data class RuleSectionSpec(val id: String, val titleKey: String, val bodyKey: String, val phases: List<String>)

/** §2.2 `pauseItems`: host actions in the TV pause menu (HUB-06), after Resume and before Rules. */
data class PauseItemSpec(val id: String, val labelKey: String, val intent: String, val phases: List<String>, val confirm: Boolean = false)

data class TvGameMeta(
    val id: String,
    val minPlayers: Int,
    val maxPlayers: Int,
    val phases: List<String>,
    val titleKey: String,
    val taglineKey: String,
    val howToKeys: List<String>,
    val ruleSections: List<RuleSectionSpec>,
    val durationMinutes: Pair<Int, Int>,
    /** §3.4 world id. */
    val world: String,
    val pauseItems: List<PauseItemSpec>,
    val carriesScore: Boolean,
    /** `VIEW_VERSION` of the shared meta this mirror (and the game's TV screens) were written against. */
    val viewVersion: Int,
    val basic: List<SettingFieldSpec>,
    val advanced: List<SettingFieldSpec>,
    val premiumKeys: List<String>,
)

object GameIds {
    const val MISHANA = "mishana"
    const val BLUFF = "bluff"
    const val LIKELY = "likely"
    const val TRIVIA = "trivia"

    /** Registry (hub) order, §2.2 GAME_IDS. */
    val ALL: List<String> = listOf(MISHANA, BLUFF, LIKELY, TRIVIA)
}

/** §3.4 world ids. */
object WorldIds {
    const val NIGHT_MARKET = "night-market"
    const val HAKAWATI_CAFE = "hakawati-cafe"
    const val ROOFTOP = "rooftop"
    const val QUIZ_STUDIO = "quiz-studio"
}

object GameCatalog {
    private fun choice(key: String, labelKey: String, vararg opts: Pair<Any, String>) =
        SettingFieldSpec.Choice(key, labelKey, opts.map { (v, l) -> ChoiceOption(if (v is Number) JsonPrimitive(v) else JsonPrimitive(v.toString()), l) })

    private val MISHANA_IN_GAME = listOf("ROLE_REVEAL", "CLUES", "TIE_BREAK", "VOTING", "ELIMINATION", "MR_WHITE_GUESS")

    val MISHANA: TvGameMeta = run {
        val k = "game.mishana"
        TvGameMeta(
            id = GameIds.MISHANA,
            minPlayers = 3,
            maxPlayers = 12,
            phases = listOf("ROLE_REVEAL", "CLUES", "VOTING", "TIE_BREAK", "ELIMINATION", "MR_WHITE_GUESS", "RESULTS"),
            titleKey = "$k.title",
            taglineKey = "$k.tagline",
            howToKeys = (1..4).map { "$k.howto.$it" },
            ruleSections = listOf(
                RuleSectionSpec("goal", "$k.rules.goal.title", "$k.rules.goal.body", emptyList()),
                RuleSectionSpec("roles", "$k.rules.roles.title", "$k.rules.roles.body", listOf("ROLE_REVEAL")),
                RuleSectionSpec("words", "$k.rules.words.title", "$k.rules.words.body", listOf("ROLE_REVEAL")),
                RuleSectionSpec("clues", "$k.rules.clues.title", "$k.rules.clues.body", listOf("CLUES")),
                RuleSectionSpec("vote", "$k.rules.vote.title", "$k.rules.vote.body", listOf("VOTING", "ELIMINATION")),
                RuleSectionSpec("tie", "$k.rules.tie.title", "$k.rules.tie.body", listOf("TIE_BREAK")),
                RuleSectionSpec("guess", "$k.rules.guess.title", "$k.rules.guess.body", listOf("MR_WHITE_GUESS")),
                RuleSectionSpec("points", "$k.rules.points.title", "$k.rules.points.body", listOf("RESULTS")),
            ),
            durationMinutes = 10 to 20,
            world = WorldIds.NIGHT_MARKET,
            pauseItems = listOf(PauseItemSpec("skip", "$k.pause.skip", "HOST_ADVANCE", MISHANA_IN_GAME)),
            carriesScore = true,
            viewVersion = 1,
            basic = listOf(
                choice("roleMode", "$k.settings.impostors", "auto" to "$k.settings.impostorsAuto", "custom" to "$k.settings.impostorsCustom"),
                choice(
                    "timers", "$k.settings.timers",
                    "relaxed" to "$k.settings.timersRelaxed", "normal" to "$k.settings.timersNormal",
                    "fast" to "$k.settings.timersFast", "off" to "$k.settings.timersOff",
                ),
                SettingFieldSpec.Packs("packIds", "settings.packs", single = false),
            ),
            advanced = listOf(
                SettingFieldSpec.Stepper("undercoverCount", "settings.undercoverCount", 0, 5, 1),
                SettingFieldSpec.Stepper("blankCount", "settings.blankCount", 0, 5, 1),
                choice("winRule", "settings.winRule", "official" to "settings.winRuleOfficial", "parity" to "settings.winRuleParity"),
                SettingFieldSpec.Toggle("revealRoles", "settings.revealRoles"),
                choice("tieBreak", "settings.tieBreak", "random" to "settings.tieBreakRandom", "none" to "settings.tieBreakNone"),
                SettingFieldSpec.Toggle("blankGuess", "settings.blankGuess"),
                SettingFieldSpec.Toggle("familyFilter", "settings.familyFilter"),
                SettingFieldSpec.Toggle("swapSides", "settings.swapSides"),
                choice("difficulties", "settings.difficulty", 1 to "settings.difficulty1", 2 to "settings.difficulty2", 3 to "settings.difficulty3"),
                SettingFieldSpec.Stepper("points", "settings.points", 0, 20, 1),
            ),
            premiumKeys = listOf("points"),
        )
    }

    // G2–G4: STUB mirrors created in P from the shared stub metas; each G lane replaces its own entry (rule sections,
    // rows) from its GAME doc. Their TV screens are not implemented yet, so the hello never declares them.

    val BLUFF: TvGameMeta = run {
        val k = "game.bluff"
        TvGameMeta(
            id = GameIds.BLUFF, minPlayers = 3, maxPlayers = 12,
            phases = listOf("ROUND_INTRO", "WRITING", "VOTING", "REVEAL", "SCORES", "AWARDS", "RESULTS", "HOLD"),
            titleKey = "$k.title", taglineKey = "$k.tagline", howToKeys = (1..4).map { "$k.howto.$it" },
            ruleSections = emptyList(), durationMinutes = 15 to 20, world = WorldIds.HAKAWATI_CAFE,
            pauseItems = listOf(
                PauseItemSpec("skipPrompt", "$k.pause.skipPrompt", "SKIP_PROMPT", listOf("WRITING")),
                PauseItemSpec("hideOption", "$k.pause.hideOption", "HIDE_OPTION", listOf("VOTING")),
                PauseItemSpec("next", "$k.pause.next", "HOST_ADVANCE", listOf("ROUND_INTRO", "REVEAL", "SCORES", "AWARDS")),
                PauseItemSpec("endGame", "$k.pause.endGame", "END_GAME", listOf("HOLD"), confirm = true),
            ),
            carriesScore = false, viewVersion = 1,
            basic = listOf(
                SettingFieldSpec.Packs("packIds", "$k.settings.packs", single = false),
                choice("length", "$k.settings.length", "short" to "$k.settings.length.short", "normal" to "$k.settings.length.normal", "long" to "$k.settings.length.long"),
                choice("pace", "$k.settings.pace", "relaxed" to "$k.settings.pace.relaxed", "normal" to "$k.settings.pace.normal", "fast" to "$k.settings.pace.fast"),
            ),
            advanced = emptyList(), premiumKeys = emptyList(),
        )
    }

    val LIKELY: TvGameMeta = run {
        val k = "game.likely"
        TvGameMeta(
            id = GameIds.LIKELY, minPlayers = 3, maxPlayers = 12,
            phases = listOf("CARD", "VOTING", "REVEAL", "AWARDS", "RESULTS", "HOLD"),
            titleKey = "$k.title", taglineKey = "$k.tagline", howToKeys = (1..4).map { "$k.howto.$it" },
            ruleSections = emptyList(), durationMinutes = 6 to 10, world = WorldIds.ROOFTOP,
            pauseItems = listOf(
                PauseItemSpec("skipCard", "$k.pause.skipCard", "SKIP_CARD", listOf("CARD", "VOTING")),
                PauseItemSpec("next", "$k.pause.next", "HOST_ADVANCE", listOf("CARD", "REVEAL", "AWARDS")),
                PauseItemSpec("endGame", "$k.pause.endGame", "END_GAME", listOf("HOLD"), confirm = true),
            ),
            carriesScore = false, viewVersion = 1,
            basic = listOf(
                SettingFieldSpec.Packs("packIds", "$k.settings.packs", single = false),
                choice("length", "$k.settings.length", "short" to "$k.settings.length.short", "normal" to "$k.settings.length.normal", "long" to "$k.settings.length.long"),
                SettingFieldSpec.Toggle("showVoters", "$k.settings.showVoters"),
            ),
            advanced = emptyList(), premiumKeys = emptyList(),
        )
    }

    val TRIVIA: TvGameMeta = run {
        val k = "game.trivia"
        TvGameMeta(
            id = GameIds.TRIVIA, minPlayers = 1, maxPlayers = 12,
            phases = listOf("QUIZ_INTRO", "READ", "ANSWER", "REVEAL", "LEADERBOARD", "FINAL_INTRO", "RESULTS", "HOLD"),
            titleKey = "$k.title", taglineKey = "$k.tagline", howToKeys = (1..4).map { "$k.howto.$it" },
            ruleSections = emptyList(), durationMinutes = 5 to 10, world = WorldIds.QUIZ_STUDIO,
            pauseItems = listOf(
                PauseItemSpec("next", "$k.pause.next", "HOST_ADVANCE", listOf("QUIZ_INTRO", "REVEAL", "LEADERBOARD", "FINAL_INTRO")),
                PauseItemSpec("voidQuestion", "$k.pause.voidQuestion", "VOID_QUESTION", listOf("REVEAL"), confirm = true),
                PauseItemSpec("endGame", "$k.pause.endGame", "END_GAME", listOf("HOLD"), confirm = true),
            ),
            carriesScore = false, viewVersion = 1,
            basic = listOf(
                SettingFieldSpec.Packs("quizId", "$k.settings.quiz", single = true),
                choice("length", "$k.settings.length", "short" to "$k.settings.length.short", "normal" to "$k.settings.length.normal", "long" to "$k.settings.length.long"),
                choice("pace", "$k.settings.pace", "relaxed" to "$k.settings.pace.relaxed", "normal" to "$k.settings.pace.normal", "fast" to "$k.settings.pace.fast"),
            ),
            advanced = emptyList(), premiumKeys = emptyList(),
        )
    }

    val ALL: List<TvGameMeta> = listOf(MISHANA, BLUFF, LIKELY, TRIVIA)

    fun meta(id: String?): TvGameMeta? = ALL.firstOrNull { it.id == id }
}
