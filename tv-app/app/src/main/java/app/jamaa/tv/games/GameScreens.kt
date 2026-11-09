package app.jamaa.tv.games

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.R
import app.jamaa.tv.games.likely.LikelyGameView
import app.jamaa.tv.games.likely.ui.LikelyGameScreen
import app.jamaa.tv.games.mishana.MishanaGameView
import app.jamaa.tv.games.mishana.ui.MishanaGameScreen
import app.jamaa.tv.protocol.ClientIntent
import app.jamaa.tv.protocol.RoomPublic
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme

/** The three results buttons every game ends on (HUB-05): REPLAY, BACK_TO_SETUP, BACK_TO_HUB. */
class ResultsActions(val onReplay: () -> Unit, val onChangeSettings: () -> Unit, val onOtherGames: () -> Unit)

/** What a game's TV screen gets from the platform. */
class GameScreenArgs(
    val game: GameView,
    val room: RoomPublic,
    val clockOffsetMs: Long,
    /** A local overlay (pause menu, rules sheet) is open: reveal choreographies hold their input. */
    val overlayOpen: Boolean,
    val degraded: Boolean,
    val send: (ClientIntent) -> Unit,
    val results: ResultsActions,
    /** HUB-05 cup panel for the results screen. */
    val cupPanel: @Composable () -> Unit,
    /** §4.5 results soft line, or null. */
    val passHook: String?,
    /** Reports that the screen shows a host dialog (the rules sheet yields to it, §3.6). */
    val onHostDialog: (Boolean) -> Unit,
    /** The ⓘ rules sheet (§3.6): the top-bar ⓘ a game shows on its results screen. */
    val onRules: () -> Unit = {},
)

/**
 * gameId → `@Composable` (JAMAA-PLATFORM §2.5). P registers all four ids; a G lane replaces only its own entry with its
 * `games/<id>/` screen. A game this build cannot draw (unknown id, a stub, a decode failure) shows the "Update JAMAA to
 * play this game" card with a way back to the hub — never a crash.
 */
object GameScreens {
    private val screens: Map<String, @Composable (GameScreenArgs) -> Unit> = mapOf(
        GameIds.MISHANA to { a -> (a.game as? MishanaGameView)?.let { MishanaGameScreen(it, a) } ?: UpdateJamaaCard(a) },
        GameIds.BLUFF to { a -> (a.game as? app.jamaa.tv.games.bluff.BluffGameView)?.let { app.jamaa.tv.games.bluff.ui.BluffGameScreen(it, a) } ?: UpdateJamaaCard(a) }, // G2 lane C
        GameIds.LIKELY to { a -> (a.game as? LikelyGameView)?.let { LikelyGameScreen(it, a) } ?: UpdateJamaaCard(a) },
        GameIds.TRIVIA to { a -> (a.game as? app.jamaa.tv.games.trivia.TriviaGameView)?.let { app.jamaa.tv.games.trivia.ui.TriviaGameScreen(it, a) } ?: UpdateJamaaCard(a) }, // G4 lane C
    )

    @Composable
    fun Render(args: GameScreenArgs) {
        val screen = if (args.game is UnsupportedGameView) null else screens[args.game.gameId]
        if (screen != null) screen(args) else UpdateJamaaCard(args)
    }
}

/** "Update JAMAA to play this game" (§2.5): Back to the hub ends the instance first when it has no outcome. */
@Composable
fun UpdateJamaaCard(args: GameScreenArgs) {
    val back = remember { FocusRequester() }
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        Text(stringResource(R.string.hub__game_unsupported), style = JamaaTheme.type.headline, color = JamaaColors.Text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
        JamaaButton(
            stringResource(R.string.cup__other_games),
            {
                if (args.game.envelope.over) {
                    args.results.onOtherGames()
                } else {
                    args.send(app.jamaa.tv.protocol.AbortGame)
                    args.send(app.jamaa.tv.protocol.CloseGame)
                }
            },
            Modifier.focusRequester(back),
            kind = ButtonKind.Primary,
            icon = JamaaIcons.ChevronBack,
        )
    }
    InitialFocus(back)
}
