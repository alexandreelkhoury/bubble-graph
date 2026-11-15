package app.jamaa.tv.games.taqriban.ui

import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.BoxWithConstraints
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxHeight
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.requiredWidth
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.shape.CircleShape
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicText
import androidx.compose.foundation.text.TextAutoSize
import androidx.compose.runtime.Composable
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableLongStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.runtime.withFrameMillis
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.clip
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Brush
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.TransformOrigin
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.TextStyle
import androidx.compose.ui.text.font.FontWeight
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.compose.ui.unit.sp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.GameScreenArgs
import app.jamaa.tv.games.taqriban.TaqPhase
import app.jamaa.tv.games.taqriban.TaqPlayer
import app.jamaa.tv.games.taqriban.TaqView
import app.jamaa.tv.games.taqriban.TaqribanGameView
import app.jamaa.tv.games.taqriban.TaqribanLine
import app.jamaa.tv.games.taqriban.TaqribanLine.Timeline
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.protocol.DeadlineKind
import app.jamaa.tv.protocol.DeadlineView
import app.jamaa.tv.ui.characters.Character
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.Confetti
import app.jamaa.tv.ui.components.DeadlineSounds
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.TimerRing
import app.jamaa.tv.ui.components.focusFallback
import app.jamaa.tv.ui.platform.RoundIconButton
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.PlayerSwatch
import app.jamaa.tv.ui.theme.WorldStage
import app.jamaa.tv.ui.theme.Worlds
import kotlin.math.min

/** The observatory palette (generated from shared/src/worlds/palettes.ts). */
private val Obs get() = Worlds.Observatory
private val Signal: Color get() = Worlds.Observatory.signal ?: Color(0xFFFF6B5B)
private const val K = "game.taqriban"
private const val LTR = "⁦"
private const val PDI = "⁩"

/** Numbers are LTR in every locale (§8.2): an LRI…PDI isolate keeps them whole inside RTL text. */
private fun ltr(s: String) = "$LTR$s$PDI"

@Composable
private fun words(v: Double): String {
    val (m, mag) = TaqribanLine.compactParts(v)
    return if (mag == null) TaqribanLine.groupDigits(v) else "$m ${keyText("$K.mag.$mag")}"
}

/**
 * Taqriban! on the TV (GAME-TAQRIBAN §8.3, TQ-TV-01..05): the observatory stage, the question card with the ring and
 * who has guessed, the number-line reveal, the standings and the results. No focusable control in game: host actions
 * are pause-menu items; OK completes the running reveal (platform §3.10 E). Everything inside the 864 × 486 safe area,
 * text auto-sized, never cropped.
 */
@Composable
fun TaqribanGameScreen(game: TaqribanGameView, args: GameScreenArgs) {
    val view = game.view
    Box(Modifier.fillMaxSize()) {
        WorldStage(Obs)
        Sky()
        if (view.phase == TaqPhase.RESULTS) {
            Results(view, args)
            return@Box
        }
        val root = remember { FocusRequester() }
        val clock = rememberPhaseClock("${view.n}:${view.phase}:${view.index}", JamaaTheme.reduceMotion, paused = args.overlayOpen)
        if (view.phase == TaqPhase.QUESTION && view.deadline != null && view.durationMs != null) {
            DeadlineSounds(DeadlineView(DeadlineKind.GUESS, view.deadline, view.durationMs), args.clockOffsetMs)
        }
        Box(
            Modifier.fillMaxSize().focusRequester(root).focusable().onKeyEvent { e ->
                if (e.remoteKey() != RemoteKey.OK) return@onKeyEvent false
                if (e.type == KeyEventType.KeyDown && !args.overlayOpen) clock.complete()
                true
            },
        ) {
            Column(Modifier.fillMaxSize()) {
                Header(view)
                Box(Modifier.weight(1f).fillMaxWidth()) {
                    when (view.phase) {
                        TaqPhase.QUESTION -> Question(view, args)
                        TaqPhase.REVEAL -> if (view.reveal != null) Reveal(view, clock)
                        TaqPhase.LEADERBOARD -> Board(view, clock, compactTitle = false)
                        TaqPhase.FINAL_INTRO -> Center(keyText("$K.show.finalIntro.title") + " ×2", keyText("$K.show.finalIntro.body"), Signal)
                        TaqPhase.HOLD -> Center(keyText("$K.show.hold"), null, JamaaColors.Text)
                        TaqPhase.RESULTS -> Unit
                    }
                }
            }
        }
        InitialFocus(root, key = "taqriban:${view.n}")
    }
}

// ─── clock ──────────────────────────────────────────────────────────────────────────────────────────────────────────

/** Milliseconds since this phase appeared; OK (or calm motion) jumps to the end. Pauses while an overlay is open. */
private class PhaseClock {
    var t by mutableLongStateOf(0L)
    var done by mutableLongStateOf(Long.MAX_VALUE / 4)
    fun complete() { t = maxOf(t, 60_000L) }
}

@Composable
private fun rememberPhaseClock(key: String, reduce: Boolean, paused: Boolean): PhaseClock {
    val c = remember(key) { PhaseClock() }
    LaunchedEffect(key, reduce, paused) {
        if (reduce) { c.complete(); return@LaunchedEffect }
        if (paused) return@LaunchedEffect
        var last = withFrameMillis { it }
        while (c.t < 60_000L) {
            withFrameMillis { now ->
                c.t += (now - last).coerceIn(0, 100)
                last = now
            }
        }
    }
    return c
}

/** 0..1 progress of an animation starting at [at] lasting [dur] ms. */
private fun PhaseClock.p(at: Long, dur: Long = 500L): Float = ((t - at).toFloat() / dur).coerceIn(0f, 1f)
private fun easeOut(x: Float) = 1f - (1f - x) * (1f - x) * (1f - x)
private fun overshoot(x: Float): Float { val c = 1.7f; val y = x - 1f; return 1f + (c + 1f) * y * y * y + c * y * y }

// ─── shared pieces ──────────────────────────────────────────────────────────────────────────────────────────────────

@Composable
private fun Sky() {
    Canvas(Modifier.fillMaxSize()) {
        val stars = listOf(0.12f to 0.18f, 0.33f to 0.09f, 0.71f to 0.14f, 0.88f to 0.31f, 0.52f to 0.24f, 0.06f to 0.44f, 0.94f to 0.08f, 0.24f to 0.33f)
        for ((i, s) in stars.withIndex()) drawCircle(Color(0xFFFFE7B0), if (i % 2 == 0) 1.6f else 1.1f, Offset(s.first * size.width, s.second * size.height), alpha = 0.6f)
    }
}

/** Auto-sized multi-line text: steps down from [max] to [min] until it fits its box. */
@Composable
private fun Fit(text: String, style: TextStyle, color: Color, max: Dp, min: Dp, maxLines: Int, modifier: Modifier = Modifier, align: TextAlign = TextAlign.Center) {
    val auto = TextAutoSize.StepBased(minFontSize = min.value.sp, maxFontSize = max.value.sp, stepSize = 1.sp)
    BasicText(text, modifier, style.copy(color = color, textAlign = align, lineHeight = 1.2.em()), overflow = TextOverflow.Ellipsis, maxLines = maxLines, autoSize = auto)
}
private fun Double.em() = androidx.compose.ui.unit.TextUnit(this.toFloat(), androidx.compose.ui.unit.TextUnitType.Em)

@Composable
private fun Header(view: TaqView) {
    Row(Modifier.fillMaxWidth().height(40.dp), verticalAlignment = Alignment.CenterVertically) {
        Text(keyText("$K.title"), style = JamaaTheme.type.titleS, color = Obs.accentText, fontWeight = FontWeight.Black, maxLines = 1, modifier = Modifier.weight(1f))
        if (view.isFinal) Chip("×2", Signal)
        if (view.phase == TaqPhase.QUESTION || view.phase == TaqPhase.REVEAL) {
            Spacer(Modifier.width(10.dp))
            Text(
                if (view.isFinal) keyText("$K.show.final") else keyText("$K.show.question", ltr("${view.index + 1}"), ltr("${view.total}")),
                style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, maxLines = 1,
            )
        }
    }
}

@Composable
private fun Chip(text: String, color: Color) {
    Box(Modifier.background(color, RoundedCornerShape(13.dp)).padding(horizontal = 10.dp, vertical = 2.dp)) {
        Text(text, style = JamaaTheme.type.label, color = JamaaColors.Ink, fontWeight = FontWeight.Black)
    }
}

/** The cast row; [lit] = has guessed (never what). */
@Composable
private fun Cast(players: List<TaqPlayer>, lit: (TaqPlayer) -> Boolean, modifier: Modifier = Modifier) {
    val size = if (players.size > 8) 48.dp else 60.dp
    Row(modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(8.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.Bottom) {
        for (p in players) {
            val on = lit(p)
            Column(Modifier.widthIn(max = 76.dp).graphicsLayer { alpha = if (!p.connected) 0.35f else if (on) 1f else 0.7f; translationY = if (on) -6.dp.toPx() else 0f }, horizontalAlignment = Alignment.CenterHorizontally) {
                Box(contentAlignment = Alignment.TopEnd) {
                    Character(p.color, size, if (!p.connected) Expression.AWAY else if (on) Expression.HAPPY else Expression.THINK)
                    if (on) Box(Modifier.size(20.dp).background(Obs.accent, CircleShape), contentAlignment = Alignment.Center) { Text("✓", style = JamaaTheme.type.caption, color = JamaaColors.Ink, fontWeight = FontWeight.Black) }
                }
                Text(p.name, style = JamaaTheme.type.caption, color = JamaaColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold)
            }
        }
    }
}

@Composable
private fun Center(title: String, body: String?, color: Color) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Fit(title, JamaaTheme.type.displayM, color, 56.dp, 28.dp, 2, Modifier.fillMaxWidth())
        if (body != null) {
            Spacer(Modifier.height(12.dp))
            Fit(body, JamaaTheme.type.headline, JamaaColors.TextSecondary, 28.dp, 18.dp, 2, Modifier.fillMaxWidth())
        }
    }
}

// ─── TQ-TV-01 question ──────────────────────────────────────────────────────────────────────────────────────────────

@Composable
private fun Question(view: TaqView, args: GameScreenArgs) {
    val q = view.question ?: return
    val guessers = view.guessers
    Column(Modifier.fillMaxSize().padding(top = 8.dp)) {
        Column(
            Modifier.fillMaxWidth().weight(1f).padding(horizontal = 24.dp)
                .background(Brush.verticalGradient(listOf(Obs.elevated, Obs.surface)), RoundedCornerShape(24.dp))
                .border(2.dp, Obs.accent.copy(alpha = 0.4f), RoundedCornerShape(24.dp))
                .padding(horizontal = 32.dp, vertical = 16.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
            verticalArrangement = Arrangement.Center,
        ) {
            Fit(q.text, JamaaTheme.type.displayS, JamaaColors.Text, 40.dp, 20.dp, 4, Modifier.fillMaxWidth().weight(1f, fill = false))
            if (q.unit.isNotEmpty()) {
                Spacer(Modifier.height(10.dp))
                Box(Modifier.background(Obs.accent.copy(alpha = 0.16f), RoundedCornerShape(99.dp)).padding(horizontal = 16.dp, vertical = 4.dp)) {
                    Text(q.unit, style = JamaaTheme.type.title, color = Obs.accentText, maxLines = 1)
                }
            }
        }
        Row(Modifier.fillMaxWidth().height(76.dp), horizontalArrangement = Arrangement.Center, verticalAlignment = Alignment.CenterVertically) {
            if (view.deadline != null && view.durationMs != null) {
                TimerRing(DeadlineView(DeadlineKind.GUESS, view.deadline, view.durationMs), args.clockOffsetMs, 60.dp, 6.dp, number = JamaaTheme.type.title, calmColor = Obs.accent)
                Spacer(Modifier.width(16.dp))
            }
            Text(
                keyText("$K.show.guessed") + "  " + ltr("${guessers.count { it.guessed }}/${guessers.size}"),
                style = JamaaTheme.type.label, color = JamaaColors.TextSecondary,
            )
        }
        Cast(view.cast, { it.guessed }, Modifier.height(96.dp))
    }
}

// ─── TQ-TV-02 the number-line reveal (the star) ─────────────────────────────────────────────────────────────────────

@Composable
private fun Reveal(view: TaqView, clock: PhaseClock) {
    val r = view.reveal ?: return
    val unit = view.question?.unit ?: ""
    val line = remember(r) { TaqribanLine.layout(r.answer, r.guesses.map { it.id to it.value }, r.logLine) }
    val bySeat = remember(r, view.players) { line.dots.sortedBy { view.player(it.id)?.seat ?: 0 }.mapIndexed { i, d -> d.id to i }.toMap() }
    val n = line.dots.size
    val tAns = Timeline.answerAt(n)
    val tStamp = Timeline.stampAt(n)
    val wild = r.wildId?.let { id -> r.guesses.firstOrNull { it.id == id } }
    Column(Modifier.fillMaxSize()) {
        Fit(view.question?.text ?: "", JamaaTheme.type.title, JamaaColors.TextSecondary, 22.dp, 15.dp, 2, Modifier.fillMaxWidth().height(56.dp).padding(horizontal = 24.dp))
        // Verdict row: "Closest!" + names (+ Bullseye), stamped after the pin lands.
        Row(
            Modifier.fillMaxWidth().height(52.dp).graphicsLayer {
                val s = clock.p(tStamp, 420)
                alpha = s
                val k = 1f + (1f - overshoot(s)) * 0.8f
                scaleX = k; scaleY = k
            },
            horizontalArrangement = Arrangement.spacedBy(14.dp, Alignment.CenterHorizontally),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            if (r.guesses.isEmpty()) {
                Stamp(keyText("$K.show.nobody"), Obs.accent)
            } else {
                Stamp(if (r.closestIds.size > 1) keyText("$K.show.tie") else keyText("$K.show.closest"), Obs.accent)
                Text(r.closestIds.mapNotNull { view.player(it)?.name }.joinToString(" · ") { isolate(it) }, style = JamaaTheme.type.headline, color = JamaaColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 380.dp))
                if (r.bullseyeIds.isNotEmpty()) Stamp(keyText("$K.show.bullseye"), Signal)
            }
        }
        // The line itself: always LTR (numbers grow to the right in every locale).
        androidx.compose.runtime.CompositionLocalProvider(androidx.compose.ui.platform.LocalLayoutDirection provides LayoutDirection.Ltr) {
            BoxWithConstraints(Modifier.fillMaxWidth().weight(1f).padding(horizontal = 24.dp)) {
                val w = maxWidth
                val axisY = maxHeight * 0.62f
                val laneH = min(52f, (axisY.value - 70f) / 4f).dp
                Canvas(Modifier.fillMaxSize()) {
                    val y = axisY.toPx()
                    val grow = easeOut(clock.p(Timeline.LINE_IN, 600))
                    drawLine(Obs.glow.copy(alpha = 0.85f), Offset(0f, y), Offset(size.width * grow, y), 4.dp.toPx())
                    val ta = clock.p(Timeline.LINE_IN + 400, 400)
                    for (t in line.ticks) drawLine(Obs.glow.copy(alpha = 0.5f * ta), Offset(t.x * size.width, y - 6.dp.toPx()), Offset(t.x * size.width, y + 6.dp.toPx()), 2.dp.toPx())
                }
                for (t in line.ticks) {
                    Text(
                        words(t.value), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1, textAlign = TextAlign.Center,
                        modifier = Modifier.requiredWidth(96.dp).offset(x = w * t.x - 48.dp, y = axisY + 10.dp).graphicsLayer { alpha = clock.p(Timeline.LINE_IN + 400, 400) },
                    )
                }
                if (r.logLine) {
                    Text(keyText("$K.show.logScale"), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, modifier = Modifier.align(Alignment.TopEnd).offset(y = axisY + 30.dp))
                }
                for (d in line.dots) {
                    val p = view.player(d.id)
                    val g = r.guesses.first { it.id == d.id }
                    val win = d.id in r.closestIds
                    val at = Timeline.dotAt(bySeat[d.id] ?: 0)
                    val headY = axisY - 34.dp - laneH * d.lane
                    Box(Modifier.offset(x = w * d.x - 60.dp, y = headY - 46.dp).requiredWidth(120.dp).graphicsLayer {
                        val s = clock.p(at, 520)
                        alpha = s * (if (win || clock.t < tStamp) 1f else 0.5f + 0.5f * (1f - clock.p(tStamp, 500)))
                        translationY = -(1f - overshoot(s)) * 70.dp.toPx()
                    }) {
                        Column(horizontalAlignment = Alignment.CenterHorizontally, modifier = Modifier.fillMaxWidth()) {
                            Text(p?.name ?: "", style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis, fontWeight = FontWeight.Bold)
                            Text(ltr(words(g.value)), style = JamaaTheme.type.label, color = JamaaColors.Text, maxLines = 1, fontWeight = FontWeight.Black)
                            Box(
                                Modifier.size(34.dp).graphicsLayer {
                                    val s = if (win) clock.p(tStamp, 600) else 0f
                                    val k = 1f + 0.18f * s
                                    scaleX = k; scaleY = k
                                }.background(if (win) Obs.accent else Color.Transparent, CircleShape).padding(3.dp)
                                    .clip(CircleShape).background(p?.let { PlayerSwatch.byId(it.color).color } ?: JamaaColors.TextMuted),
                                contentAlignment = Alignment.Center,
                            ) { if (p != null) Character(p.color, 28.dp, if (win && clock.t >= tStamp) Expression.CHEER else Expression.THINK) }
                            // The stem to the axis.
                            Box(Modifier.width(2.dp).height(laneH * d.lane + 4.dp).background(p?.let { PlayerSwatch.byId(it.color).color } ?: JamaaColors.TextMuted))
                        }
                        if (win && g.points > 0) {
                            Box(Modifier.align(Alignment.TopEnd).offset(y = 40.dp).graphicsLayer { val s = clock.p(tStamp + 200, 360); alpha = s; scaleX = overshoot(s); scaleY = overshoot(s) }
                                .background(Obs.accent, RoundedCornerShape(10.dp)).padding(horizontal = 6.dp)) {
                                Text(ltr("+${g.points}"), style = JamaaTheme.type.caption, color = JamaaColors.Ink, fontWeight = FontWeight.Black)
                            }
                        }
                    }
                }
                // The true answer's pin falls onto the line, its flag under it.
                Column(
                    Modifier.offset(x = w * line.answerX - 110.dp, y = axisY - 20.dp).requiredWidth(220.dp).graphicsLayer {
                        val s = clock.p(tAns, 700)
                        alpha = if (s > 0f) 1f else 0f
                        translationY = -(1f - overshoot(s)) * 220.dp.toPx()
                    },
                    horizontalAlignment = Alignment.CenterHorizontally,
                ) {
                    Box(Modifier.width(4.dp).height(36.dp).background(Signal, RoundedCornerShape(2.dp)))
                    Column(Modifier.background(Signal, RoundedCornerShape(14.dp)).padding(horizontal = 14.dp, vertical = 4.dp), horizontalAlignment = Alignment.CenterHorizontally) {
                        Text(keyText("$K.show.answer"), style = JamaaTheme.type.caption, color = JamaaColors.Ink, fontWeight = FontWeight.Bold, maxLines = 1)
                        androidx.compose.foundation.text.BasicText(
                            ltr(TaqribanLine.groupDigits(r.answer)), style = JamaaTheme.type.headline.copy(color = JamaaColors.Ink, fontWeight = FontWeight.Black, textAlign = TextAlign.Center),
                            maxLines = 1, autoSize = TextAutoSize.StepBased(14.sp, 30.sp, 1.sp),
                        )
                        val wd = words(r.answer)
                        val sub = listOfNotNull(wd.takeIf { it != TaqribanLine.groupDigits(r.answer) }, unit.takeIf { it.isNotEmpty() }).joinToString(" ")
                        if (sub.isNotEmpty()) Text(sub, style = JamaaTheme.type.caption, color = JamaaColors.Ink, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    }
                }
            }
        }
        Box(Modifier.fillMaxWidth().height(44.dp), contentAlignment = Alignment.Center) {
            if (wild != null) {
                Text(
                    keyText("$K.show.wayOff", isolate(view.player(wild.id)?.name ?: ""), ltr(words(wild.value) + if (unit.isNotEmpty()) " $unit" else "")),
                    style = JamaaTheme.type.title, color = Obs.glow, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center,
                    modifier = Modifier.graphicsLayer { alpha = clock.p(tStamp + 700, 500) },
                )
            } else {
                Text(keyText("$K.show.source", r.source), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
        if (wild != null) Text(keyText("$K.show.source", r.source), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth())
    }
}

@Composable
private fun Stamp(text: String, color: Color) {
    Box(Modifier.graphicsLayer { rotationZ = -4f }.background(color, RoundedCornerShape(12.dp)).padding(horizontal = 18.dp, vertical = 4.dp)) {
        Text(text, style = JamaaTheme.type.headline, color = JamaaColors.Ink, fontWeight = FontWeight.Black, maxLines = 1)
    }
}

// ─── TQ-TV-03 standings / TQ-TV-05 results ──────────────────────────────────────────────────────────────────────────

@Composable
private fun Board(view: TaqView, clock: PhaseClock, compactTitle: Boolean, modifier: Modifier = Modifier) {
    val rows = view.ranked
    val max = maxOf(1, rows.maxOfOrNull { it.score.score } ?: 1)
    val compact = rows.size > 8
    val rowH = if (compact) 28.dp else 40.dp
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    Column(modifier.fillMaxSize(), verticalArrangement = Arrangement.Center) {
        if (!compactTitle) {
            Text(keyText("$K.show.standings"), style = JamaaTheme.type.headline, color = Obs.accentText, fontWeight = FontWeight.Black, textAlign = TextAlign.Center, modifier = Modifier.fillMaxWidth().padding(bottom = 10.dp))
        }
        rows.forEachIndexed { i, p ->
            val top = p.score.rank == 1 && p.score.score > 0
            Row(
                Modifier.fillMaxWidth().height(rowH).padding(horizontal = 40.dp).graphicsLayer {
                    val s = clock.p(i * 70L, 420)
                    alpha = s; translationY = (1f - easeOut(s)) * 14.dp.toPx()
                }.background(if (top) Obs.accent.copy(alpha = 0.16f) else Color.White.copy(alpha = 0.05f), RoundedCornerShape(12.dp))
                    .border(if (top) 2.dp else 0.dp, if (top) Obs.accent.copy(alpha = 0.5f) else Color.Transparent, RoundedCornerShape(12.dp))
                    .padding(horizontal = 12.dp),
                verticalAlignment = Alignment.CenterVertically,
                horizontalArrangement = Arrangement.spacedBy(10.dp),
            ) {
                Text(ltr("${p.score.rank ?: 0}"), style = JamaaTheme.type.title, color = JamaaColors.TextSecondary, fontWeight = FontWeight.Black, modifier = Modifier.width(28.dp), textAlign = TextAlign.Center)
                Character(p.color, if (compact) 24.dp else 34.dp, if (top) Expression.CHEER else Expression.IDLE)
                Text(p.name, style = if (compact) JamaaTheme.type.label else JamaaTheme.type.title, color = JamaaColors.Text, fontWeight = FontWeight.Bold, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.width(170.dp))
                Box(Modifier.weight(1f).height(12.dp).clip(RoundedCornerShape(6.dp)).background(Color.White.copy(alpha = 0.06f))) {
                    val from = p.score.scoreBefore.toFloat() / max
                    val to = p.score.score.toFloat() / max
                    Box(Modifier.fillMaxHeight().fillMaxWidth().graphicsLayer {
                        val s = easeOut(clock.p(300L + i * 70L, 900))
                        transformOrigin = TransformOrigin(if (rtl) 1f else 0f, 0.5f)
                        scaleX = maxOf(0.02f, from + (to - from) * s)
                    }.background(PlayerSwatch.byId(p.color).color, RoundedCornerShape(6.dp)))
                }
                Text(keyText("$K.show.won", ltr("${p.score.closest}")), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, maxLines = 1)
                Text(ltr("${p.score.score}"), style = JamaaTheme.type.title, color = JamaaColors.Text, fontWeight = FontWeight.Black, textAlign = TextAlign.End, modifier = Modifier.width(72.dp))
            }
            Spacer(Modifier.height(if (compact) 4.dp else 6.dp))
        }
    }
}

@Composable
private fun Results(view: TaqView, args: GameScreenArgs) {
    val playAgain = remember { FocusRequester() }
    val clock = rememberPhaseClock("results:${view.n}", JamaaTheme.reduceMotion, paused = false)
    val top = view.ranked.filter { it.score.rank == 1 && it.score.score > 0 }
    Box(Modifier.fillMaxSize()) {
        Column(Modifier.fillMaxSize().focusFallback(playAgain)) {
            Row(Modifier.fillMaxWidth().height(48.dp), verticalAlignment = Alignment.CenterVertically) {
                val title = when {
                    top.size == 1 -> keyText("$K.show.results.winner", isolate(top[0].name))
                    top.size > 1 -> keyText("$K.show.results.tie")
                    else -> keyText("$K.show.results.title")
                }
                Fit(title, JamaaTheme.type.headline, Obs.accentText, 32.dp, 18.dp, 1, Modifier.weight(1f), TextAlign.Start)
                RoundIconButton(JamaaIcons.Info, stringResource(R.string.rules__open), args.onRules, size = 36.dp)
            }
            Row(Modifier.fillMaxWidth().weight(1f), verticalAlignment = Alignment.CenterVertically) {
                Box(Modifier.weight(1f).fillMaxHeight()) { Board(view, clock, compactTitle = true) }
                Spacer(Modifier.width(12.dp))
                Box(Modifier.widthIn(max = 280.dp)) { args.cupPanel() }
            }
            if (view.endedEarly) Text(keyText("$K.show.endedEarly"), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.fillMaxWidth())
            args.passHook?.let { Text(it, style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center, maxLines = 1, modifier = Modifier.fillMaxWidth()) }
            Row(Modifier.fillMaxWidth().height(58.dp), horizontalArrangement = Arrangement.spacedBy(16.dp, Alignment.CenterHorizontally), verticalAlignment = Alignment.CenterVertically) {
                JamaaButton(stringResource(R.string.results__play_again), args.results.onReplay, Modifier.focusRequester(playAgain), kind = ButtonKind.Primary, icon = JamaaIcons.Refresh, minWidth = 220.dp)
                JamaaButton(stringResource(R.string.results__change_settings), args.results.onChangeSettings, icon = JamaaIcons.Settings)
                JamaaButton(stringResource(R.string.cup__other_games), args.results.onOtherGames, icon = JamaaIcons.Users)
            }
        }
        if (top.isNotEmpty()) Confetti(Modifier.fillMaxSize(), durationMs = 1_400, seed = view.n)
    }
    InitialFocus(playAgain, key = "taqriban-results:${view.n}")
}
