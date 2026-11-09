package app.jamaa.tv.games.trivia.ui

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.focusable
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.draw.shadow
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.graphicsLayer
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.games.trivia.ShelfAction
import app.jamaa.tv.games.trivia.TriviaBoard
import app.jamaa.tv.games.trivia.TriviaSetupView
import app.jamaa.tv.games.trivia.TriviaShelf
import app.jamaa.tv.platform.RemoteKey
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaFocus
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.platform.remoteKey
import app.jamaa.tv.ui.platform.repeats
import app.jamaa.tv.ui.screens.localizedTitle
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import app.jamaa.tv.ui.theme.WorldStage

/**
 * The setup header slot of Quiz Night (GAME-TRIVIA §9.1): the non-focusable summary card while one quiz is playable,
 * nothing otherwise (the "Quiz ‹ … ›" row then opens [TriviaQuizShelf]).
 */
@Composable
fun TriviaSetupHeader(setup: TriviaSetupView, modifier: Modifier = Modifier) {
    TriviaShelf.summary(setup)?.let { TriviaQuizSummaryCard(it, modifier) }
}

/**
 * The quiz shelf, full screen over the studio stage (DESIGN-JAMAA §2.3.1): one row per domain, 240 × 320 dp cards.
 * Up/Down between rows, Left/Right between cards, OK picks (or, on a locked card, [onLocked] opens the Pass upsell
 * when billing is on), Back closes without change. Focus is local ([TriviaShelf.onKey]): nothing is sent until OK.
 */
@Composable
fun TriviaQuizShelf(setup: TriviaSetupView, onPick: (String) -> Unit, onLocked: ((String) -> Unit)?, onClose: () -> Unit) {
    val rows = remember(setup) { TriviaShelf.rows(setup) }
    var focus by remember(setup.extras.quizzes.map { it.id }) { mutableStateOf(TriviaShelf.initialFocus(rows)) }
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl
    val root = remember { FocusRequester() }
    Box(
        Modifier
            .fillMaxSize()
            .fullBleed()
            .focusRequester(root)
            .onPreviewKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent e.remoteKey() != RemoteKey.OTHER && e.remoteKey() != RemoteKey.INFO
                when (val a = TriviaShelf.onKey(rows, focus, e.remoteKey(), rtl, repeat = e.repeats > 0)) {
                    is ShelfAction.Move -> focus = a.focus
                    is ShelfAction.Pick -> onPick(a.familyId)
                    is ShelfAction.Locked -> onLocked?.invoke(a.familyId)
                    ShelfAction.Close -> onClose()
                    ShelfAction.None -> Unit
                }
                e.remoteKey() != RemoteKey.OTHER && e.remoteKey() != RemoteKey.INFO
            }
            .focusable(),
    ) {
        WorldStage(Studio)
        Column(Modifier.fillMaxSize().padding(horizontal = 48.dp, vertical = 27.dp), verticalArrangement = Arrangement.spacedBy(16.dp)) {
            Text(keyText("game.trivia.quiz.shelfTitle"), style = JamaaTheme.type.headline, color = JamaaColors.Text)
            rows.forEachIndexed { r, row ->
                Text(keyText(TriviaBoard.domainKey(row.domain)), style = JamaaTheme.type.title, color = Studio.accentText)
                Row(Modifier.fillMaxWidth(), horizontalArrangement = Arrangement.spacedBy(20.dp)) {
                    row.cards.forEachIndexed { c, card ->
                        val focused = focus.row == r && focus.col == c
                        val title = localizedTitle(card.info.title)
                        val shape = RoundedCornerShape(24.dp)
                        Box(
                            Modifier
                                .semantics { contentDescription = title }
                                .graphicsLayer {
                                    val s = if (focused) JamaaFocus.TILE_SCALE else 1f
                                    scaleX = s
                                    scaleY = s
                                }
                                .then(if (focused) Modifier.shadow(18.dp, shape, ambientColor = JamaaColors.Primary, spotColor = JamaaColors.Primary) else Modifier)
                                .background(Studio.surface, shape)
                                .then(if (focused) Modifier.border(BorderStroke(3.dp, JamaaColors.Focus), shape) else Modifier),
                        ) {
                            TriviaQuizCard(card, focused)
                        }
                    }
                }
            }
        }
    }
    InitialFocus(root)
}
