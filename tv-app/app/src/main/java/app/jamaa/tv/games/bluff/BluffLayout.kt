package app.jamaa.tv.games.bluff

import app.jamaa.tv.game.Cue
import app.jamaa.tv.game.CuePlay
import app.jamaa.tv.game.SoundCues
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.protocol.GameIntent

// Bluff's TV layout rules, ranking and cues (GAME-BLUFF §7, §8.2, §12.3–§12.6; DESIGN-JAMAA §7.6). Pure; JVM-tested.

/** A card's place on the corkboard: [col] is the visual column from the left edge (already mirrored in RTL). */
data class Cell(val col: Int, val row: Int)

object BluffBoard {
    /** ≤ 6 options: 1 column; 7–13: 2 columns (GAME-BLUFF §8.2). */
    fun columns(optionCount: Int): Int = if (optionCount <= 6) 1 else 2

    fun rows(optionCount: Int): Int = (optionCount + columns(optionCount) - 1) / columns(optionCount)

    /**
     * Reading order fills a row from the start edge: in LTR card 0 sits top-left, in RTL top-right (the mirror of the
     * 2-column layout, GAME-BLUFF §13.4). One column is the same in both directions.
     */
    fun cell(index: Int, optionCount: Int, rtl: Boolean): Cell {
        val cols = columns(optionCount)
        val logical = index % cols
        return Cell(if (rtl) cols - 1 - logical else logical, index / cols)
    }

    /** "Easy one!" when only 2 options exist (GAME-BLUFF §4.2 step 3). */
    fun easyOne(optionCount: Int): Boolean = optionCount == 2

    /**
     * The café row: [count] seats spread evenly over [width], in seat order from the start edge (mirrored in RTL).
     * Returns the centre x of seat [index].
     */
    fun seatX(index: Int, count: Int, width: Float, rtl: Boolean): Float {
        val slot = width / count.coerceAtLeast(1)
        val i = if (rtl) count - 1 - index else index
        return slot * (i + 0.5f)
    }

    /** Character size on the café row: 72 dp up to 8 players, then 56 dp (still ≥ 40 dp, faces on). */
    fun rowCharacterDp(count: Int): Int = if (count <= 8) 72 else 56

    /** Spacing of the characters sitting on the spotlight card's top edge (dp between centres). */
    const val TRAVELLER_STEP_DP = 46f

    /**
     * Horizontal offset (dp, from the card centre) of traveller [k] of [n] landed on the card. A fooled voter's coin
     * leaves from this same slot, so the room sees who paid whom (DESIGN-JAMAA §5.2).
     */
    fun travellerDx(k: Int, n: Int): Float = (k - (n - 1) / 2f) * TRAVELLER_STEP_DP

    /** Height (dp) the platform's "◁ Back: menu & rules" hint takes at the top end corner (52 dp + a 32 dp chip). */
    const val BACK_HINT_SLOT_DP = 40f

    /**
     * How far (dp) the REVEAL score rail sits lower so the platform's back hint (top end corner, shown for
     * [app.jamaa.tv.platform.GameChrome.HINT_AFTER_PHASE_MS] after each phase change) never covers the first pill:
     * the full slot while the hint shows, then the rail eases back up over 300 ms.
     */
    fun railHintShiftDp(sincePhaseMs: Long): Float {
        val visibleUntil = app.jamaa.tv.platform.GameChrome.HINT_AFTER_PHASE_MS
        if (sincePhaseMs < visibleUntil) return BACK_HINT_SLOT_DP
        val q = ((sincePhaseMs - visibleUntil) / 300f).coerceIn(0f, 1f)
        return BACK_HINT_SLOT_DP * (1f - q * q * (3f - 2f * q))
    }
}

/**
 * The score odometer (DESIGN-JAMAA §5.1): from 100 points a pill's number rolls one digit column per place, each
 * column turning only while the places under it pass from 9 to 0 (a mechanical counter). Pure; JVM-tested.
 */
object BluffOdometer {
    /** Counts under this tick as plain integers; from it they roll. */
    const val FROM = 100

    /** Digit columns needed to show every value up to [max] (at least one). */
    fun places(max: Int): Int = max.coerceAtLeast(0).toString().length

    /**
     * The roll position (0 ≤ x < 10, fractional while turning) of the column for 10^[place] at the continuous count
     * [value]: digit k shows `floor(x)` and is `x − floor(x)` of the way to the next digit.
     */
    fun column(value: Double, place: Int): Double {
        val v = value.coerceAtLeast(0.0)
        var p = 1.0
        repeat(place) { p *= 10.0 }
        val whole = kotlin.math.floor(v / p)
        val digit = whole % 10.0
        val lower = v - whole * p
        val roll = (lower - (p - 1.0)).coerceIn(0.0, 1.0)
        return digit + roll
    }
}

/**
 * What a prompt card shows (GAME-BLUFF §8.2; the web's `promptLines`): an Arabic original (a proverb, `translit` set)
 * keeps its place, with the transliteration and the room-language translation under it; any other prompt shows the
 * room-language text only ([BluffPrompt.display], else the original). An EN-sourced fact in a FR/AR/ES room is never
 * headlined in English.
 */
data class PromptLines(val main: String, val translit: String?, val sub: String?) {
    companion object {
        fun of(p: BluffPrompt): PromptLines =
            if (p.translit != null) PromptLines(p.original, p.translit, p.display?.takeIf { it != p.original })
            else PromptLines(p.display ?: p.original, null, null)
    }
}

/**
 * Option letters (A, B, C … M; Western letters in every locale, like the phone and the room code), frozen for one
 * VOTING/REVEAL of one prompt: the first options list seen keys the letters by option id, so a host hide leaves its
 * letter unused instead of shifting the cards below it ("B" stays the card the couch agreed on). Same rule as the web's
 * `optionLetters` (web-client/src/games/bluff/model.ts). A TV that joins after a hide can only letter what it sees.
 */
class OptionLetters {
    private var key: String? = null
    private val ids = ArrayList<String>()

    fun of(view: BluffView): Map<String, Char> {
        val k = "${view.n}:${view.round}:${view.promptIndex}:${view.prompt?.id ?: ""}"
        if (k != key) {
            key = k
            ids.clear()
        }
        for (o in view.options) if (o.id !in ids) ids += o.id
        return ids.withIndex().associate { (i, id) -> id to letterOf(i) }
    }

    companion object {
        fun letterOf(index: Int): Char = 'A' + index

        /** The screen-wide memo (the corkboard, the hide picker and the reveal intro read the same letters). */
        val shared = OptionLetters()
    }
}

/**
 * The host's "Hide an answer" picker (GAME-BLUFF §5.4, §8.2; opened from the pause menu item). Remote-only: the D-pad
 * moves over the cards in their on-screen grid (RTL-aware), OK hides the focused card, Back closes. The picker looks the
 * same whatever the cards are (the hide UI never depends on option kind, GAME-BLUFF §13.4).
 */
class HidePicker(private val optionIds: List<String>, private val rtl: Boolean, initial: Int = 0) {
    var focus: Int = initial.coerceIn(0, (optionIds.size - 1).coerceAtLeast(0))
        private set

    private val cols get() = BluffBoard.columns(optionIds.size)

    /** Moves the focus; returns false at an edge (the focus stays). */
    fun move(key: RemoteKey): Boolean {
        val n = optionIds.size
        if (n == 0) return false
        val step = when (key) {
            RemoteKey.UP -> -cols
            RemoteKey.DOWN -> cols
            RemoteKey.LEFT -> if (cols == 1) 0 else if (rtl) 1 else -1
            RemoteKey.RIGHT -> if (cols == 1) 0 else if (rtl) -1 else 1
            else -> 0
        }
        if (step == 0) return false
        val next = focus + step
        if (next !in 0 until n) return false
        if ((key == RemoteKey.LEFT || key == RemoteKey.RIGHT) && next / cols != focus / cols) return false
        focus = next
        return true
    }

    /** OK: the intent to send (null when there is nothing to hide). */
    fun confirm(): GameIntent? = optionIds.getOrNull(focus)?.let(BluffTv::hideOption)
}

/** One row of the SCORES race (GAME-BLUFF §12.3). */
data class RaceRow(val player: BluffPlayer, val rankBefore: Int, val rank: Int, val delta: Int)

object BluffRanking {
    /** Competition ranks (1, 2, 2, 4): equal scores share the place, no hidden tie-break (GAME-BLUFF §6.6). */
    fun ranks(scores: List<Pair<String, Int>>): Map<String, Int> {
        val sorted = scores.sortedByDescending { it.second }
        val out = HashMap<String, Int>()
        for ((i, s) in sorted.withIndex()) {
            out[s.first] = if (i > 0 && sorted[i - 1].second == s.second) out.getValue(sorted[i - 1].first) else i + 1
        }
        return out
    }

    /**
     * Rows ordered by the new score (ties: seat order, stable), each with its rank before and after the prompt. Left
     * players stay listed (greyed) so the results add up.
     */
    fun race(v: BluffView): List<RaceRow> {
        val before = ranks(v.players.map { it.id to it.scoreBefore })
        val after = ranks(v.players.map { it.id to it.score })
        return v.players.sortedWith(compareByDescending<BluffPlayer> { it.score }.thenBy { it.seat })
            .map { RaceRow(it, before.getValue(it.id), after.getValue(it.id), it.score - it.scoreBefore) }
    }

    /** "New leader!": the sole leader after the prompt was not already the sole leader before it (and has points). */
    fun newLeader(v: BluffView): BluffPlayer? {
        val rows = race(v)
        val lead = rows.filter { it.rank == 1 }.singleOrNull() ?: return null
        if (lead.player.score == 0) return null
        val soleBefore = rows.count { it.rankBefore == 1 } == 1 && lead.rankBefore == 1 && lead.player.scoreBefore > 0
        return if (soleBefore) null else lead.player
    }

    /** "Comeback time!" for the last place when behind the leader by more than 400 (GAME-BLUFF §12.3). */
    fun comeback(v: BluffView): BluffPlayer? {
        val active = v.active.ifEmpty { return null }
        val top = active.maxOf { it.score }
        val last = active.minBy { it.score }
        return last.takeIf { top - it.score > 400 && active.count { p -> p.score == it.score } == 1 }
    }

    /** "The final pays up to +400 for one answer!" on the SCORES just before the final (GAME-BLUFF §12.3). */
    fun finalTease(v: BluffView): Boolean = v.phase == BluffPhase.SCORES && !v.isFinal && v.promptIndex == v.promptCount - 2

    /**
     * The podium: places 1–3 by score, equal scores share a place (and a step). Returns place → players, best first.
     * Nobody stands on the podium with 0 points unless everyone has 0.
     */
    fun podium(v: BluffView): List<Pair<Int, List<BluffPlayer>>> {
        val pool = v.players.filter { !it.left }.ifEmpty { v.players }
        val r = ranks(pool.map { it.id to it.score })
        return pool.groupBy { r.getValue(it.id) }.toSortedMap().entries
            .filter { (place, _) -> place <= 3 }
            .map { (place, ps) -> place to ps.sortedBy { it.seat } }
            .filter { (_, ps) -> ps.any { it.score > 0 } || pool.all { it.score == 0 } }
    }
}

/**
 * Bluff's TV sound plan (GAME-BLUFF §12.6, DESIGN-JAMAA §5.5). Cues are scheduled on the reveal script's own clock, so
 * OK-completion simply stops them. JAMAA-GAP (G2): the platform SoundPool plays only [Cue] (platform res/raw) and has no
 * entry point for the generated per-game index (SoundCuesBluff); the DESIGN-JAMAA §5.5 aliases are used meanwhile:
 * `bluff.coin` = coin_land (pentatonic steps), `bluff.truth` = truth_reveal, `bluff.stampHouse` = house_got_you,
 * `bluff.stampLie` = sfx.stamp, `bluff.tok` = sfx.chipLand (rising pitch), `bluff.envelope` = answer_lock,
 * `bluff.like` = reaction_pop, `sting.bluffIntro` = world_bluff_sting.
 */
object BluffCues {
    /** At most 10 landing ticks per award (platform §3.10 C). */
    const val MAX_LAND_TICKS = 10

    data class Timed(val atMs: Long, val play: CuePlay)

    fun reveal(script: BluffScript): List<Timed> = buildList {
        for (seg in script.segments) {
            val at = { id: String, i: Int -> seg.startMs + (seg.sub(id)?.let { it.step.startMs + it.step.staggerMs.toLong() * i } ?: 0L) }
            val st = seg.step
            when (seg.kind) {
                SegmentKind.INTRO -> add(Timed(seg.startMs, CuePlay(Cue.DRUMROLL, rate = 1.2f)))
                SegmentKind.LIE, SegmentKind.HOUSE, SegmentKind.QUICK -> {
                    if (seg.kind != SegmentKind.QUICK) {
                        for (i in 0 until (st?.voterIds?.size ?: 0)) {
                            add(Timed(at("jump", i) + 300, CuePlay(Cue.CHIP_LAND, SoundCues.semitones(SoundCues.PENTATONIC[(5 + i).coerceAtMost(SoundCues.PENTATONIC.size - 1)]))))
                        }
                        add(Timed(at("drumroll", 0), CuePlay(Cue.DRUMROLL)))
                    }
                    add(Timed(at("stamp", 0) + 120, CuePlay(if (seg.kind == SegmentKind.HOUSE) Cue.HOUSE_GOT_YOU else Cue.STAMP)))
                    if (seg.kind != SegmentKind.HOUSE) add(Timed(at("liar", 0), CuePlay(Cue.REACTION_POP)))
                }
                SegmentKind.TRUTH -> {
                    add(Timed(at("gold", 0), CuePlay(Cue.FLIP)))
                    add(Timed(at("stamp", 0) + 120, CuePlay(Cue.TRUTH_REVEAL)))
                }
                SegmentKind.FINAL_ANSWER -> {
                    for (i in 0 until minOf(st?.voteCount ?: 0, 12)) add(Timed(at("envelopes", i) + 200, CuePlay(Cue.ANSWER_LOCK, 0.9f + 0.05f * i)))
                    add(Timed(at("liar", 0), CuePlay(if (st?.kind == OptionKind.HOUSE) Cue.HOUSE_GOT_YOU else Cue.REACTION_POP)))
                }
                SegmentKind.CROWN -> {
                    add(Timed(at("stamp", 0) + 120, CuePlay(Cue.STAMP)))
                    add(Timed(at("crown", 0), CuePlay(Cue.CROWN_DROP)))
                }
                SegmentKind.TWIST -> add(Timed(at("stamp", 0) + 120, CuePlay(Cue.STAMP, rate = 0.9f)))
                SegmentKind.NOBODY -> add(Timed(at("fall", 0), CuePlay(Cue.LEAVE)))
                SegmentKind.LIKES, SegmentKind.END -> Unit
            }
            // Coin landings: rising pentatonic steps, ≤ 10 per segment; the first launch whooshes.
            val coins = script.coins.filter { it.segment == seg.index }
            coins.firstOrNull()?.let { add(Timed(it.launchAtMs, CuePlay(Cue.COIN_FLY))) }
            for ((i, c) in coins.take(MAX_LAND_TICKS).withIndex()) {
                val cue = if (c.heart) Cue.REACTION_POP else Cue.COIN_LAND
                add(Timed(c.landAtMs, CuePlay(cue, SoundCues.semitones(SoundCues.PENTATONIC[(5 + i).coerceAtMost(SoundCues.PENTATONIC.size - 1)]))))
            }
        }
    }.sortedBy { it.atMs }

    /** The cues of entering a non-reveal phase, timed to its moment (delays from the phase start). */
    fun entry(v: BluffView): List<CuePlay> = when (v.phase) {
        BluffPhase.ROUND_INTRO -> if (v.isFinal) listOf(CuePlay(Cue.DRUMROLL), CuePlay(Cue.STAMP, delayMs = 1_520L)) else listOf(CuePlay(Cue.FLIP, delayMs = 120L))
        BluffPhase.WRITING -> listOf(CuePlay(Cue.FLIP))
        BluffPhase.VOTING -> buildList {
            if (v.round == 1 && v.spotOnPlayers.isNotEmpty()) add(CuePlay(Cue.CUP_STAR))
            add(CuePlay(Cue.CHIP_LAND, delayMs = if (isEmpty()) 0L else BluffMoments.KNEW_IT_MS))
        }
        BluffPhase.SCORES -> buildList {
            add(CuePlay(Cue.COUNTER_TICK, delayMs = 200L))
            if (BluffRanking.newLeader(v) != null) add(CuePlay(Cue.CROWN_DROP, delayMs = 1_800L))
        }
        BluffPhase.AWARDS -> v.awards.indices.map { CuePlay(Cue.CUP_STAR, delayMs = BluffMoments.awardAtMs(it)) }
        BluffPhase.RESULTS -> listOf(CuePlay(Cue.DRUMROLL), CuePlay(Cue.CROWN_DROP, delayMs = 2L * BluffMoments.PODIUM_STAGGER_MS + 300L))
        BluffPhase.HOLD, BluffPhase.REVEAL -> emptyList()
    }

    /** WRITING / VOTING: one envelope drop (or ballot) per player who just submitted (or voted); never which answer. */
    fun progress(before: BluffView, after: BluffView): List<CuePlay> {
        if (before.n != after.n || before.phase != after.phase || before.promptIndex != after.promptIndex) return emptyList()
        val fresh = when (after.phase) {
            BluffPhase.WRITING -> after.players.count { it.submitted && before.player(it.id)?.submitted != true }
            BluffPhase.VOTING -> after.players.count { it.voted && before.player(it.id)?.voted != true }
            else -> 0
        }
        val cue = if (after.phase == BluffPhase.WRITING) Cue.ANSWER_LOCK else Cue.VOTE_CAST
        return (0 until fresh).map { CuePlay(cue, delayMs = 120L * it) }
    }
}
