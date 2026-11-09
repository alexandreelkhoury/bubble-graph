package app.jamaa.tv.games.likely.ui

import androidx.activity.compose.BackHandler
import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.widthIn
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.jamaa.tv.games.likely.LikelySpicy
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.platform.keyText
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaTheme
import kotlinx.serialization.json.JsonObject

/**
 * GAME-LIKELY §9.1 the full-screen 18+ confirmation, shown by the setup when "Spicy (18+)" is chosen on the TV.
 * Default focus: **Cancel**. Back = Cancel (nothing sent). Only "We're all 18+" returns the patch ([LikelySpicy]).
 * Not reachable while Spicy is compiled out ([LikelySpicy.ENABLED] = false, platform open item).
 */
@Composable
fun LikelySpicyGate(onResult: (JsonObject?) -> Unit) {
    val type = JamaaTheme.type
    val cancel = remember { FocusRequester() }
    BackHandler { onResult(LikelySpicy.onDialogResult(null)) }
    Box(Modifier.fillMaxSize().fullBleed().background(JamaaColors.Scrim), contentAlignment = Alignment.Center) {
        Column(
            Modifier.widthIn(max = 560.dp).background(Rooftop.surface, androidx.compose.foundation.shape.RoundedCornerShape(28.dp)).padding(32.dp),
            horizontalAlignment = Alignment.CenterHorizontally,
        ) {
            Text(keyText("game.likely.spicy.gate.title"), style = type.headline, color = JamaaColors.Text, textAlign = TextAlign.Center)
            Spacer(Modifier.height(12.dp))
            Text(keyText("game.likely.spicy.gate.body"), style = type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
            Spacer(Modifier.height(24.dp))
            Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
                for (b in LikelySpicy.BUTTONS) {
                    when (b) {
                        LikelySpicy.Button.CANCEL -> JamaaButton(
                            keyText("game.likely.spicy.gate.cancel"),
                            { onResult(LikelySpicy.onDialogResult(LikelySpicy.Button.CANCEL)) },
                            Modifier.focusRequester(cancel),
                            kind = ButtonKind.Primary,
                        )
                        LikelySpicy.Button.CONFIRM -> JamaaButton(
                            keyText("game.likely.spicy.gate.confirm"),
                            { onResult(LikelySpicy.onDialogResult(LikelySpicy.Button.CONFIRM)) },
                        )
                    }
                }
            }
        }
    }
    InitialFocus(cancel)
}
