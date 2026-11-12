package app.jamaa.tv.games.bluff.ui

import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.Stable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import app.jamaa.tv.game.Countdown
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.bluff.BluffCues
import app.jamaa.tv.games.bluff.BluffFit
import app.jamaa.tv.games.bluff.BluffGameView
import app.jamaa.tv.games.bluff.BluffInput
import app.jamaa.tv.games.bluff.BluffMoments
import app.jamaa.tv.games.bluff.BluffPhase
import app.jamaa.tv.games.bluff.BluffScore
import app.jamaa.tv.games.bluff.BluffScript
import app.jamaa.tv.games.bluff.BluffView
import app.jamaa.tv.platform.Moment
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.LocalSounds
import app.jamaa.tv.ui.components.ProvideFrameClock
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * Bluff! on the TV (GAME-BLUFF §8.2, §12; DESIGN-JAMAA §5.2, §7.6): the Liars' Café stage, the prompt card, the corkboard
 * of anonymous answers, the café row of characters, the reveal script (spotlight, jump-on, stamp, the liar popping out,
 * coins flying into the score pills), the scoreboard race, the awards and the podium. Every timed move samples
 * [BluffMoments] / [BluffScript] through the platform sampler on the server clock. Remote: no focusable control while
 * playing; OK only completes the running moment (JAMAA-PLATFORM §3.10 E); host actions are pause-menu items.
 */
@Composable
fun BluffGameScreen(game: BluffGameView, args: GameScreenArgs) {
    val view = game.view
    val reduce = JamaaTheme.reduceMotion
    val script = rememberScript(view, reduce)
    val clock = rememberPhaseClock(view, script, args.clockOffsetMs, reduce)
    BluffSounds(view, clock, script)

    ProvideFrameClock(active = view.deadline != null) {
        Box(Modifier.fillMaxSize()) {
            CafeStage(view, clock)
            if (view.phase == BluffPhase.RESULTS) {
                BluffResults(view, clock, args)
                return@Box
            }
            val root = remember { FocusRequester() }
            val sounds = LocalSounds.current
            BoxWithConstraints(
                Modifier
                    .fillMaxSize()
                    .focusRequester(root)
                    .focusable()
                    .onKeyEvent { e ->
                        if (e.remoteKey() != RemoteKey.OK) return@onKeyEvent false
                        if (e.type == KeyEventType.KeyDown && !args.overlayOpen && clock.running()) {
                            clock.complete()
                            sounds.stopAll()
                        }
                        true // OK in game never does anything else (GAME-BLUFF §8.2: no on-screen host buttons)
                    },
            ) {
                val density = LocalDensity.current
                val row = BluffFit.row(view.players.size, view.phase, view.options.size)
                val geo = remember(maxWidth, maxHeight, view.phase, view.players.size, row, density) {
                    with(density) {
                        StageGeometry(
                            width = maxWidth.toPx(), height = maxHeight.toPx(), density = density.density,
                            rail = view.phase == BluffPhase.REVEAL, players = view.players.size, row = row,
                        )
                    }
                }
                val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
                val hasRow = BluffFit.hasRow(view.phase)
                Column(Modifier.fillMaxSize()) {
                    Header(view, args)
                    Box(Modifier.weight(1f).fillMaxWidth()) {
                        when (view.phase) {
                            BluffPhase.ROUND_INTRO -> RoundIntroCard(view, clock)
                            BluffPhase.WRITING -> WritingStage(view, clock, args.clockOffsetMs)
                            BluffPhase.VOTING -> VotingBoard(view, clock, rtl)
                            BluffPhase.REVEAL -> Unit // drawn by RevealStage over the whole stage
                            BluffPhase.SCORES -> ScoresRace(view, clock)
                            BluffPhase.AWARDS -> AwardsStage(view, clock)
                            BluffPhase.HOLD -> HoldCard(view, args)
                            BluffPhase.RESULTS -> Unit
                        }
                    }
                    if (hasRow) Box(Modifier.fillMaxWidth().height(row.heightDp.dp))
                }
                if (hasRow) CafeRow(view, game.envelope, args.room, clock, script, geo, rtl, args.clockOffsetMs)
                if (view.phase == BluffPhase.REVEAL && script != null) {
                    RevealStage(view, clock, script, geo, rtl)
                }
            }
            InitialFocus(root, key = "bluff:${view.n}")
        }
    }
}

internal const val HEADER_DP = BluffFit.HEADER

/**
 * Stage geometry in px (absolute: x from the left edge, mirrored here for RTL by the callers that need it), from the
 * [BluffFit] budget. The café row spans the width left of the score rail (REVEAL); the reveal stack (progress strip,
 * perched voters, the spotlight card, the liar row) is centred in the stage between the top bar and the row.
 */
@Stable
internal class StageGeometry(val width: Float, val height: Float, val density: Float, val rail: Boolean, val players: Int, val row: BluffFit.CafeRow) {
    fun dp(v: Number): Float = v.toFloat() * density
    val railWidth: Float get() = if (rail) dp(BluffFit.RAIL) else 0f
    val rowWidth: Float get() = width - railWidth
    /** Left edge of the stage (the rail sits at the start side in RTL). */
    fun stageLeft(rtl: Boolean): Float = if (rtl) railWidth else 0f
    val rowTop: Float get() = height - dp(row.heightDp)
    val rowCenterY: Float get() = rowTop + dp(4) + dp(row.characterDp) / 2f
    val contentTop: Float get() = dp(HEADER_DP)
    val contentBottom: Float get() = rowTop
    private val stageH: Float get() = contentBottom - contentTop

    // ---- the reveal stack
    val stripY: Float get() = contentTop + dp(BluffFit.STRIP) / 2f
    /** Centre x of progress-strip badge [k] (from the start edge: earlier reveals never move). */
    fun stripX(k: Int, rtl: Boolean): Float =
        if (rtl) stageLeft(true) + rowWidth - dp(22) - dp(STRIP_STEP_DP) * k else dp(22) + dp(STRIP_STEP_DP) * k
    val cardW: Float get() = minOf(rowWidth - dp(40), dp(BluffFit.CARD_MAX_W))
    val cardH: Float get() = dp(BluffFit.revealCardH(stageH / density))
    val cardTop: Float get() = contentTop + dp(BluffFit.STRIP + BluffFit.PERCH)
    val cardCenterY: Float get() = cardTop + cardH / 2f
    val cardBottom: Float get() = cardTop + cardH
    /** Centre of the spotlight card (in the stage, left of the rail). */
    fun cardCenterX(rtl: Boolean): Float = stageLeft(rtl) + rowWidth / 2f
    /** Perched voters sit on the card's top edge from its start side; the end corner is the stamp's. */
    val perchY: Float get() = cardTop - dp(BluffFit.PERCH_CHARACTER) / 2f + dp(6)
    fun perchX(k: Int, n: Int, rtl: Boolean): Float {
        val step = dp(BluffFit.perchStepDp(n, (cardW - dp(STAMP_CORNER_DP)) / density))
        val from = dp(44) + step * k
        return if (rtl) cardCenterX(true) + cardW / 2f - from else cardCenterX(false) - cardW / 2f + from
    }
    /** The stamp lands on the card's top end corner. */
    fun stampCenter(rtl: Boolean): Offset =
        Offset(cardCenterX(rtl) + (cardW / 2f - dp(104)) * (if (rtl) -1f else 1f), cardTop + dp(4))
    /** The liar row (or the truth's caption) under the card. */
    val liarY: Float get() = cardBottom + dp(BluffFit.LIAR) / 2f

    /** The rail's left edge. */
    fun railX(rtl: Boolean): Float = if (rtl) 0f else width - railWidth
    fun seatX(index: Int, rtl: Boolean): Float =
        stageLeft(rtl) + app.jamaa.tv.games.bluff.BluffBoard.seatX(index, players, rowWidth, rtl)
    /** One seat's width on the café row (name plates are bounded by it). */
    val seatW: Float get() = rowWidth / players.coerceAtLeast(1)
    val railRow: Float get() = dp(BluffFit.railRowDp(players))
    /** Centre of the score pill of the player at [index] (rail rows in seat order, under the rail label). */
    fun pillCenter(index: Int, rtl: Boolean): Pair<Float, Float> =
        (railX(rtl) + railWidth / 2f) to (contentTop + dp(BluffFit.RAIL_LABEL) + railRow * (index + 0.5f))
}

internal const val STRIP_STEP_DP = 38
internal const val STAMP_CORNER_DP = 260

// ---------------------------------------------------------------- the phase clock

/**
 * The current phase's moment (or reveal script) on the server clock: [t] is read in layer, draw and placement lambdas
 * (or through derivedStateOf), so a running moment never recomposes the screen by itself. OK sets [completed]: every
 * step jumps to its end state at once.
 */
@Stable
internal class PhaseClock(val key: String, val moment: Moment, val totalMs: Long) {
    val elapsed = mutableLongStateOf(0L)
    val completed = mutableStateOf(false)

    fun t(): Long = if (completed.value) maxOf(elapsed.longValue, totalMs) else elapsed.longValue

    fun running(): Boolean = BluffInput.okCompletes(elapsed.longValue, totalMs, completed.value)

    /** Progress of phase step [id] (element [index]); a step this variant dropped (calm motion) is done (1). */
    fun p(id: String, index: Int = 0): Float = moment.step(id)?.progress(t(), index) ?: 1f

    fun complete() {
        completed.value = true
    }
}

@Composable
private fun rememberScript(view: BluffView, reduced: Boolean): BluffScript? {
    val reveal = view.reveal ?: return null
    return remember(view.n, view.promptIndex, reveal, reduced) {
        BluffScript.build(reveal, view.players.map { BluffScore(it.id, it.score, it.scoreBefore) }, reduced)
    }
}

@Composable
internal fun rememberPhaseClock(view: BluffView, script: BluffScript?, clockOffsetMs: Long, reduced: Boolean): PhaseClock {
    val key = BluffMoments.key(view)
    val clock = remember(key, reduced, script) {
        val moment = BluffMoments.of(view, reduced)
        PhaseClock(key, moment, if (view.phase == BluffPhase.REVEAL && script != null) script.totalMs else moment.totalMs)
    }
    val firstView by rememberUpdatedState(view)
    LaunchedEffect(clock) {
        // A TV that (re)joins mid-phase lands on the right frame instead of replaying the phase from its start.
        val serverNow = Countdown.serverNow(System.currentTimeMillis(), clockOffsetMs)
        val start = System.currentTimeMillis() - BluffMoments.elapsedAtFirstSight(firstView, serverNow)
        while (true) {
            withFrameMillis { }
            clock.elapsed.longValue = System.currentTimeMillis() - start
            // Keep ticking a little past the end (crown hops, confetti fall), then rest: nothing else moves.
            if (clock.elapsed.longValue > clock.totalMs + 2_000L) break
        }
    }
    return clock
}

/** Phase-entry cues, envelope/ballot drops and the reveal cue track (on the script clock; OK-completion stops it). */
@Composable
private fun BluffSounds(view: BluffView, clock: PhaseClock, script: BluffScript?) {
    val sounds = LocalSounds.current
    val prev = remember { arrayOfNulls<BluffView>(1) }
    LaunchedEffect(view) {
        val before = prev[0]
        prev[0] = view
        if (before == null) return@LaunchedEffect
        BluffCues.progress(before, view).forEach(sounds::play)
    }
    LaunchedEffect(clock) {
        withFrameMillis { }
        if (clock.elapsed.longValue > 600L) return@LaunchedEffect // joined mid-phase: no entry fanfare
        if (view.phase != BluffPhase.REVEAL) BluffCues.entry(view).forEach(sounds::play)
    }
    if (script != null && view.phase == BluffPhase.REVEAL) {
        LaunchedEffect(clock, script) {
            val track = BluffCues.reveal(script)
            withFrameMillis { }
            var i = track.indexOfFirst { it.atMs >= clock.elapsed.longValue - 50L }.let { if (it < 0) track.size else it }
            while (i < track.size) {
                withFrameMillis { }
                if (clock.completed.value) break
                val t = clock.elapsed.longValue
                while (i < track.size && track[i].atMs <= t) sounds.play(track[i++].play)
            }
        }
    }
}
