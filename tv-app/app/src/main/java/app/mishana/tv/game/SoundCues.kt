package app.mishana.tv.game

import app.mishana.tv.protocol.DeadlineKind
import app.mishana.tv.protocol.GuessStatus
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.Winner
import kotlin.math.max
import kotlin.math.min
import kotlin.math.pow

/**
 * Sound cues (DESIGN §6.4), pure so the rules are JVM-tested; the same rules as the web TV mock
 * (web-client/src/tv-mock/sound/cues.ts). The OGG files in res/raw come from tools/gen-sounds ([Cue.file]).
 */
enum class Cue(val id: String, val bus: Bus) {
    JOIN("sfx.join", Bus.SFX),
    LEAVE("sfx.leave", Bus.SFX),
    READY("sfx.ready", Bus.SFX),
    ALL_READY("sfx.allReady", Bus.SFX),
    TURN("sfx.turn", Bus.SFX),
    TICK("sfx.tick", Bus.SFX),
    TICK_LAST("sfx.tickLast", Bus.SFX),
    TIME_UP("sfx.timeUp", Bus.SFX),
    VOTE_CAST("sfx.voteCast", Bus.SFX),
    DRUMROLL("sfx.drumroll", Bus.SFX),
    CHIP_LAND("sfx.chipLand", Bus.SFX),
    STAMP("sfx.stamp", Bus.SFX),
    FLIP("sfx.flip", Bus.SFX),
    HEARTBEAT("sfx.heartbeat", Bus.SFX),
    WHEEL("sfx.wheel", Bus.SFX),
    ERROR("sfx.error", Bus.SFX),
    STING_CIVILIAN("sting.civilian", Bus.STING),
    STING_MOLE("sting.mole", Bus.STING),
    STING_BLANK("sting.blank", Bus.STING),
    STING_CORRECT("sting.correct", Bus.STING),
    STING_WRONG("sting.wrong", Bus.STING),
    STING_WIN_CIVILIANS("sting.winCivilians", Bus.STING),
    STING_WIN_INFILTRATORS("sting.winInfiltrators", Bus.STING),
    UI_MOVE("ui.move", Bus.UI),
    UI_SELECT("ui.select", Bus.UI),
    UI_BACK("ui.back", Bus.UI),
    ;

    /** `sfx.allReady` → `sfx_all_ready` (the res/raw name). */
    val file: String get() = id.replace('.', '_').replace(Regex("[A-Z]")) { "_" + it.value.lowercase() }

    enum class Bus(val gain: Float) { SFX(0.85f), STING(1f), UI(0.55f) }
}

/** A cue to play, pitch-shifted by [rate] (SoundPool: 0.5–2) and started after [delayMs]. */
data class CuePlay(val cue: Cue, val rate: Float = 1f, val delayMs: Long = 0L)

object SoundCues {
    /** Two octaves of a major pentatonic around the recorded pitch, inside SoundPool's rate range. */
    val PENTATONIC = intArrayOf(-12, -10, -8, -5, -3, 0, 2, 4, 7, 9, 12)

    fun semitones(n: Int): Float = 2.0.pow(n / 12.0).toFloat()

    /** `sfx.join` pitch by seat: a full lobby plays a chord. */
    fun joinRate(seat: Int): Float = semitones(PENTATONIC[Math.floorMod(seat, PENTATONIC.size)])

    /** `sfx.turn`: a different pitch each turn. */
    fun turnRate(index: Int): Float = semitones(PENTATONIC[5 + max(0, index) % 5])

    /** `sfx.chipLand`: rises with the target's tally. */
    fun chipRate(tally: Int): Float = semitones(PENTATONIC[min(PENTATONIC.size - 1, 4 + max(1, tally))])

    fun roleSting(role: Role): Cue = when (role) {
        Role.CIVILIAN -> Cue.STING_CIVILIAN
        Role.UNDERCOVER -> Cue.STING_MOLE
        Role.BLANK -> Cue.STING_BLANK
    }

    private val CLUE_PHASES = setOf(Phase.CLUES, Phase.TIE_BREAK)

    /** Cues for one broadcast (the ELIMINATION reveal plays its own timeline, [timeline]). */
    fun viewCues(before: TvView?, after: TvView): List<CuePlay> {
        if (before == null) return emptyList()
        val out = mutableListOf<CuePlay>()
        if (before.phase == Phase.LOBBY && after.phase == Phase.LOBBY) {
            val was = before.players.filter { !it.left }.associateBy { it.id }
            val now = after.players.filter { !it.left }
            var i = 0
            for (p in now) if (p.id !in was) out += CuePlay(Cue.JOIN, joinRate(p.seat), 90L * i++)
            val nowIds = now.map { it.id }.toSet()
            if (was.keys.any { it !in nowIds }) out += CuePlay(Cue.LEAVE)
            return out
        }
        if (before.phase == Phase.LOBBY && after.phase == Phase.ROLE_REVEAL) return listOf(CuePlay(Cue.FLIP))
        if (before.gameNumber != after.gameNumber) return out

        if (after.history.drop(before.history.size).any { it.cause == HistoryCause.LEAVE || it.cause == HistoryCause.KICK }) {
            out += CuePlay(Cue.LEAVE)
        }
        if (before.phase == Phase.ROLE_REVEAL && after.phase == Phase.ROLE_REVEAL) {
            val wasReady = before.players.filter { it.ready }.map { it.id }.toSet()
            val ready = after.players.count { it.ready && it.id !in wasReady }
            for (i in 0 until min(ready, 3)) out += CuePlay(Cue.READY, delayMs = 80L * i)
        }
        val speaker = after.currentSpeakerId
        val speakerChanged = speaker != null &&
            (speaker != before.currentSpeakerId || after.phase != before.phase || after.round != before.round)
        if (before.phase == Phase.ROLE_REVEAL && after.phase == Phase.CLUES) out += CuePlay(Cue.ALL_READY)
        if (before.phase == Phase.VOTING && after.phase == Phase.TIE_BREAK) out += CuePlay(Cue.STAMP)
        if (after.phase in CLUE_PHASES && speakerChanged) {
            val delay = if (before.phase == Phase.ROLE_REVEAL || before.phase == Phase.VOTING) 550L else 0L
            out += CuePlay(Cue.TURN, turnRate(after.speakingOrder.indexOf(speaker)), delay)
        }
        if (before.phase == Phase.VOTING && after.phase == Phase.VOTING && before.round == after.round && after.votesCast > before.votesCast) {
            for (i in 0 until min(after.votesCast - before.votesCast, 3)) out += CuePlay(Cue.VOTE_CAST, delayMs = 90L * i)
        }
        val g = after.guess
        if (after.phase == Phase.MR_WHITE_GUESS && g != null && before.guess?.status != g.status) {
            when (g.status) {
                GuessStatus.CORRECT -> out += CuePlay(Cue.STING_CORRECT)
                GuessStatus.WRONG -> out += CuePlay(Cue.STING_WRONG)
                GuessStatus.TIMEOUT -> out += CuePlay(Cue.TIME_UP)
                GuessStatus.PENDING -> Unit
            }
        }
        val r = after.result
        if (before.phase != Phase.RESULTS && after.phase == Phase.RESULTS && r != null) {
            out += CuePlay(if (r.winner == Winner.CIVILIANS) Cue.STING_WIN_CIVILIANS else Cue.STING_WIN_INFILTRATORS)
        }
        return out
    }

    private val TICKING = setOf(DeadlineKind.REVEAL, DeadlineKind.CLUE, DeadlineKind.VOTE)
    private val HEARTBEATS = intArrayOf(10, 8, 6, 5, 4, 3, 2, 1)

    /**
     * The cue for a countdown sampled at [prevMs] then [nowMs] remaining, or null: the last 5 s tick (the last one
     * higher) and 0 sounds the horn; the Blank's guess beats a heartbeat every 2 s from 10 s, then every second.
     * Only a crossing between two close samples counts (no stale tick after a late start or a stall).
     */
    fun deadlineCue(kind: DeadlineKind, prevMs: Long?, nowMs: Long): Cue? {
        if (prevMs == null || nowMs >= prevMs || prevMs - nowMs > 1_000L) return null
        fun crossed(s: Int) = prevMs > s * 1_000L && nowMs <= s * 1_000L
        if (kind in TICKING) {
            return when {
                crossed(0) -> Cue.TIME_UP
                crossed(1) -> Cue.TICK_LAST
                (2..5).any { crossed(it) } -> Cue.TICK
                else -> null
            }
        }
        if (kind == DeadlineKind.GUESS) return if (HEARTBEATS.any { crossed(it) }) Cue.HEARTBEAT else null
        return null
    }

    /** A cue on a local animation clock (ms since the sequence started). */
    data class Mark(val atMs: Int, val cue: Cue, val rate: Float = 1f)

    /** How far past a mark the clock may be and still play it: a skip (OK) jumps further and stays silent. */
    const val TIMELINE_SLACK_MS = 250

    /** Marks crossed between [prevMs] (exclusive) and [nowMs] (inclusive), minus those a skip jumped over. */
    fun timeline(marks: List<Mark>, prevMs: Float, nowMs: Float): List<Mark> =
        marks.filter { it.atMs > prevMs && it.atMs <= nowMs && nowMs - it.atMs <= TIMELINE_SLACK_MS }
}

/** At most one play per [gapMs] (the D-pad focus tick stays subtle under key repeat). */
class RateLimiter(private val gapMs: Long) {
    private var last = Long.MIN_VALUE / 2

    fun allow(nowMs: Long): Boolean {
        if (nowMs - last < gapMs) return false
        last = nowMs
        return true
    }
}
