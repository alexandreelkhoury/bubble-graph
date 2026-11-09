package app.jamaa.tv.games.trivia.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.Canvas
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.geometry.Offset
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.Path
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.drawscope.DrawScope
import androidx.compose.ui.graphics.drawscope.Stroke
import androidx.compose.ui.graphics.drawscope.rotate
import androidx.compose.ui.graphics.drawscope.scale
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.semantics.clearAndSetSemantics
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextDirection
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.trivia.QuizCardModel
import app.jamaa.tv.games.trivia.TokenShape
import app.jamaa.tv.games.trivia.TriviaBoard
import app.jamaa.tv.games.trivia.TriviaShelf
import app.jamaa.tv.games.trivia.TriviaToken
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.screens.localizedTitle
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.Worlds
import kotlin.math.PI
import kotlin.math.cos
import kotlin.math.sin

// Quiz Night's drawn tokens (GAME-TRIVIA §8.2: sun, wave, leaf, spark; check and cross) and the quiz card pieces
// (stars, domain and topic chips) shared by the in-game quiz intro, the setup summary card and the shelf.

internal val Studio = Worlds.QuizStudio
internal val Ink = Color(TriviaToken.INK)
internal val Flame = Color(0xFFFF7A1F)
internal val FlameCore = Color(0xFFFFE14D)
internal val Lemon = Color(0xFFFFE14D)

internal fun TriviaToken.color(): Color = Color(argb)

/** Draws one token shape in a [size] box in [ink] (24-unit design grid). */
@Composable
fun TokenGlyph(shape: TokenShape, ink: Color, size: Dp, modifier: Modifier = Modifier, spin: () -> Float = { 0f }) {
    Canvas(modifier.size(size).clearAndSetSemantics {}) {
        rotate(spin() * 360f) { drawToken(shape, ink) }
    }
}

internal fun DrawScope.drawToken(shape: TokenShape, ink: Color) {
    val u = size.minDimension / 24f
    val c = Offset(size.width / 2f, size.height / 2f)
    val stroke = Stroke(width = 2.6f * u, cap = StrokeCap.Round, join = StrokeJoin.Round)
    when (shape) {
        TokenShape.SUN -> {
            drawCircle(ink, 5.2f * u, c)
            for (i in 0 until 8) {
                val a = i * PI / 4
                val s = Offset(c.x + cos(a).toFloat() * 8f * u, c.y + sin(a).toFloat() * 8f * u)
                val e = Offset(c.x + cos(a).toFloat() * 11f * u, c.y + sin(a).toFloat() * 11f * u)
                drawLine(ink, s, e, 2.4f * u, StrokeCap.Round)
            }
        }
        TokenShape.WAVE -> {
            for (row in 0 until 2) {
                val y = c.y - 3.5f * u + row * 7f * u
                val p = Path().apply {
                    moveTo(c.x - 10f * u, y)
                    quadraticTo(c.x - 7.5f * u, y - 4f * u, c.x - 5f * u, y)
                    quadraticTo(c.x - 2.5f * u, y + 4f * u, c.x, y)
                    quadraticTo(c.x + 2.5f * u, y - 4f * u, c.x + 5f * u, y)
                    quadraticTo(c.x + 7.5f * u, y + 4f * u, c.x + 10f * u, y)
                }
                drawPath(p, ink, style = stroke)
            }
        }
        TokenShape.LEAF -> {
            val p = Path().apply {
                moveTo(c.x - 8f * u, c.y + 8f * u)
                cubicTo(c.x - 10f * u, c.y - 4f * u, c.x - 1f * u, c.y - 10f * u, c.x + 9f * u, c.y - 9f * u)
                cubicTo(c.x + 10f * u, c.y + 1f * u, c.x + 4f * u, c.y + 10f * u, c.x - 8f * u, c.y + 8f * u)
                close()
            }
            drawPath(p, ink)
            // The stem.
            drawLine(ink, Offset(c.x - 9f * u, c.y + 9f * u), Offset(c.x - 5.5f * u, c.y + 5.5f * u), 2.2f * u, StrokeCap.Round)
        }
        TokenShape.SPARK -> {
            val p = Path().apply {
                moveTo(c.x, c.y - 11f * u)
                quadraticTo(c.x + 1.6f * u, c.y - 1.6f * u, c.x + 11f * u, c.y)
                quadraticTo(c.x + 1.6f * u, c.y + 1.6f * u, c.x, c.y + 11f * u)
                quadraticTo(c.x - 1.6f * u, c.y + 1.6f * u, c.x - 11f * u, c.y)
                quadraticTo(c.x - 1.6f * u, c.y - 1.6f * u, c.x, c.y - 11f * u)
                close()
            }
            drawPath(p, ink)
        }
        TokenShape.CHECK -> {
            val p = Path().apply {
                moveTo(c.x - 8f * u, c.y + 0.5f * u)
                lineTo(c.x - 2.5f * u, c.y + 6f * u)
                lineTo(c.x + 8.5f * u, c.y - 6.5f * u)
            }
            drawPath(p, ink, style = Stroke(width = 3.4f * u, cap = StrokeCap.Round, join = StrokeJoin.Round))
        }
        TokenShape.CROSS -> {
            drawLine(ink, Offset(c.x - 7f * u, c.y - 7f * u), Offset(c.x + 7f * u, c.y + 7f * u), 3.4f * u, StrokeCap.Round)
            drawLine(ink, Offset(c.x + 7f * u, c.y - 7f * u), Offset(c.x - 7f * u, c.y + 7f * u), 3.4f * u, StrokeCap.Round)
        }
    }
}

/** A filled 5-point star (difficulty), [filled] or a 2 dp outline. */
@Composable
fun DifficultyStar(filled: Boolean, size: Dp, modifier: Modifier = Modifier, fill: () -> Float = { 1f }) {
    Canvas(modifier.size(size)) {
        val r = size.toPx() / 2f
        val c = Offset(r, r)
        val p = Path()
        for (i in 0 until 10) {
            val a = -PI / 2 + i * PI / 5
            val rr = if (i % 2 == 0) r * 0.95f else r * 0.42f
            val pt = Offset(c.x + cos(a).toFloat() * rr, c.y + sin(a).toFloat() * rr)
            if (i == 0) p.moveTo(pt.x, pt.y) else p.lineTo(pt.x, pt.y)
        }
        p.close()
        drawPath(p, JamaaColors.OutlineStrong, style = Stroke(width = 2.dp.toPx(), join = StrokeJoin.Round))
        if (filled) {
            val f = fill().coerceIn(0f, 1.3f)
            if (f > 0f) {
                scale(scaleX = f, scaleY = f, pivot = c) { drawPath(p, JamaaColors.Accent) }
            }
        }
    }
}

/** ★★☆ + "Medium" (the word always follows; spoken "Difficulty 2 of 3"). [fill] animates star i (0..1). */
@Composable
fun StarsLine(stars: Int, modifier: Modifier = Modifier, size: Dp = 20.dp, fill: (Int) -> Float = { 1f }) {
    val n = TriviaShelf.filledStars(stars)
    val spoken = keyText("content.starsLabel", n, "3")
    Row(
        modifier.semantics(mergeDescendants = true) { contentDescription = spoken },
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(4.dp),
    ) {
        for (i in 0 until 3) DifficultyStar(filled = i < n, size = size, fill = { fill(i) })
        Spacer(Modifier.width(6.dp))
        Text(keyText(TriviaBoard.starsKey(n)), style = JamaaTheme.type.label, color = JamaaColors.TextSecondary)
    }
}

/** The domain chip: a filled pill with the arch icon for Lebanon, a globe for every other domain. */
@Composable
fun DomainChip(domain: String, modifier: Modifier = Modifier) {
    Row(
        modifier.background(Studio.elevated, RoundedCornerShape(50)).padding(horizontal = 12.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
        horizontalArrangement = Arrangement.spacedBy(6.dp),
    ) {
        if (domain == "lebanon") {
            Canvas(Modifier.size(16.dp)) {
                val u = size.minDimension / 24f
                val p = Path().apply {
                    moveTo(5f * u, 21f * u); lineTo(5f * u, 10.25f * u)
                    cubicTo(5f * u, 1f * u, 19f * u, 1f * u, 19f * u, 10.25f * u)
                    lineTo(19f * u, 21f * u); close()
                }
                drawPath(p, Studio.accentText)
            }
        } else {
            Icon(JamaaIcons.Globe, contentDescription = null, tint = Studio.accentText, modifier = Modifier.size(16.dp))
        }
        Text(keyText(TriviaBoard.domainKey(domain)), style = JamaaTheme.type.caption, color = JamaaColors.Text, maxLines = 1)
    }
}

/** An outlined topic chip (labels only, never filters). */
@Composable
fun TopicChip(text: String, modifier: Modifier = Modifier) {
    Box(
        modifier.border(BorderStroke(1.5.dp, JamaaColors.OutlineStrong), RoundedCornerShape(50)).padding(horizontal = 10.dp, vertical = 2.dp),
    ) {
        Text(text, style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary, maxLines = 1)
    }
}

/** The featured topics in author order (max 3), then "+n". [appear] fades chip i in (0..1). */
@Composable
fun TopicChips(featured: List<String>, more: Int, modifier: Modifier = Modifier, appear: (Int) -> Float = { 1f }) {
    Row(modifier, horizontalArrangement = Arrangement.spacedBy(8.dp), verticalAlignment = Alignment.CenterVertically) {
        featured.take(3).forEachIndexed { i, t ->
            TopicChip(keyText(TriviaBoard.topicKey(t)), Modifier.layerAppear { appear(i) })
        }
        if (more > 0) TopicChip(keyText("content.more", more), Modifier.layerAppear { appear(featured.size.coerceAtMost(3)) })
    }
}

/**
 * The flat cover art of a quiz card: a sunset over coast and hills in the studio palette (no flags or symbols). The
 * world accent only tints the art, never the focus ring (DESIGN-JAMAA §1.5).
 */
@Composable
fun QuizCover(domain: String, modifier: Modifier = Modifier, parallax: () -> Float = { 0f }) {
    Canvas(modifier.clearAndSetSemantics {}) {
        val w = size.width
        val h = size.height
        val shift = parallax() * 8.dp.toPx()
        val sky = if (domain == "lebanon") listOf(Color(0xFFFF8A5B), Color(0xFFFFC94D), Studio.stageTop) else listOf(Studio.accent, Studio.stageTop, Studio.deep)
        drawRect(androidx.compose.ui.graphics.Brush.verticalGradient(sky.reversed()))
        drawCircle(Color(0xFFFFE3A3), h * 0.16f, Offset(w * 0.68f + shift * 0.4f, h * 0.48f))
        val hills = Path().apply {
            moveTo(0f, h * 0.62f)
            cubicTo(w * 0.25f + shift, h * 0.38f, w * 0.45f + shift, h * 0.52f, w * 0.62f + shift, h * 0.44f)
            cubicTo(w * 0.8f + shift, h * 0.36f, w * 0.92f, h * 0.5f, w, h * 0.46f)
            lineTo(w, h); lineTo(0f, h); close()
        }
        drawPath(hills, Studio.elevated)
        val sea = Path().apply {
            moveTo(0f, h * 0.78f)
            quadraticTo(w * 0.5f + shift * 0.6f, h * 0.72f, w, h * 0.8f)
            lineTo(w, h); lineTo(0f, h); close()
        }
        drawPath(sea, Studio.accent.copy(alpha = 0.85f))
    }
}

/**
 * The setup summary card (one playable quiz, DESIGN-JAMAA §2.3.1): 300 × 96 dp, cover 72 × 96, title, stars + word,
 * domain chip and featured topic chips. Not focusable, opens nothing.
 */
@Composable
fun TriviaQuizSummaryCard(card: QuizCardModel, modifier: Modifier = Modifier) {
    Row(
        modifier.width(300.dp).height(96.dp).background(Studio.surface, RoundedCornerShape(16.dp)),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        QuizCover(card.info.domain, Modifier.width(72.dp).height(96.dp).background(Studio.deep, RoundedCornerShape(topStart = 16.dp, bottomStart = 16.dp)))
        Column(Modifier.padding(horizontal = 10.dp, vertical = 6.dp).fillMaxWidth(), verticalArrangement = Arrangement.spacedBy(2.dp)) {
            Text(
                localizedTitle(card.info.title),
                style = JamaaTheme.type.label.copy(textDirection = TextDirection.Content),
                color = JamaaColors.Text,
                maxLines = 1,
                overflow = TextOverflow.Ellipsis,
            )
            StarsLine(card.info.stars, size = 14.dp)
            Row(horizontalArrangement = Arrangement.spacedBy(6.dp), verticalAlignment = Alignment.CenterVertically) {
                DomainChip(card.info.domain)
                card.featured.firstOrNull()?.let { TopicChip(keyText(TriviaBoard.topicKey(it))) }
                val more = card.more + (card.featured.size - 1).coerceAtLeast(0)
                if (more > 0) TopicChip(keyText("content.more", more))
            }
        }
    }
}

/** The 240 × 320 dp quiz card of the shelf (GAME-TRIVIA §9.1). Focus and scale come from the caller's surface. */
@Composable
fun TriviaQuizCard(card: QuizCardModel, focused: Boolean, modifier: Modifier = Modifier) {
    Column(modifier.width(240.dp).height(320.dp)) {
        Box(Modifier.fillMaxWidth().height(120.dp)) {
            QuizCover(card.info.domain, Modifier.fillMaxSize(), parallax = { if (focused) 1f else 0f })
            if (card.selected) {
                Box(
                    Modifier.align(Alignment.TopEnd).padding(8.dp).size(28.dp).background(JamaaColors.Success, RoundedCornerShape(50)),
                    contentAlignment = Alignment.Center,
                ) { Icon(JamaaIcons.Check, contentDescription = keyText("game.trivia.quiz.selected"), tint = Ink, modifier = Modifier.size(18.dp)) }
            }
        }
        Column(Modifier.padding(12.dp), verticalArrangement = Arrangement.spacedBy(6.dp)) {
            Text(
                localizedTitle(card.info.title),
                style = JamaaTheme.type.title.copy(textDirection = TextDirection.Content),
                color = JamaaColors.Text,
                maxLines = 2,
                overflow = TextOverflow.Ellipsis,
            )
            StarsLine(card.info.stars)
            DomainChip(card.info.domain)
            TopicChips(card.featured, card.more)
            Row(Modifier.fillMaxWidth(), verticalAlignment = Alignment.CenterVertically) {
                Text(
                    pluralStringResource(R.plurals.game__trivia__quiz__questions, card.info.questionCount, card.info.questionCount),
                    style = JamaaTheme.type.caption,
                    color = JamaaColors.TextMuted,
                    modifier = Modifier.weight(1f),
                )
                if (card.locked) {
                    Row(verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(4.dp)) {
                        Icon(JamaaIcons.Lock, contentDescription = null, tint = JamaaColors.Accent, modifier = Modifier.size(16.dp))
                        Text(keyText("game.trivia.quiz.locked"), style = JamaaTheme.type.caption, color = JamaaColors.Accent, maxLines = 1)
                    }
                }
            }
        }
    }
}
