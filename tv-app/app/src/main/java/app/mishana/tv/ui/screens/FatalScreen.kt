package app.mishana.tv.ui.screens

import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.size
import androidx.compose.runtime.Composable
import androidx.compose.runtime.remember
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.LiveRegionMode
import androidx.compose.ui.semantics.liveRegion
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.i18n.messageText
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.CenterStage
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

/**
 * TV-13e/13g: the room is gone (4010 outside an empty lobby) or another fatal close (4002/4003/4004/4005).
 * Full screen with the error text and (• New room). Back exits the app (activity default).
 */
@Composable
fun FatalScreen(messageKey: String, onNewRoom: () -> Unit) {
    val type = MishTheme.type
    val newRoom = remember { FocusRequester() }
    val expired = messageKey == "error.roomExpired"
    CenterStage {
        Icon(
            if (expired) MishIcons.DoorOut else MishIcons.WifiOff,
            contentDescription = null,
            tint = if (expired) MishColors.Accent else MishColors.Danger,
            modifier = Modifier.size(96.dp),
        )
        Spacer(Modifier.height(20.dp))
        Text(
            if (expired) stringResource(R.string.tv__room_closed) else messageText(messageKey),
            style = type.displayS,
            color = MishColors.Text,
            textAlign = TextAlign.Center,
            modifier = Modifier.semantics { liveRegion = LiveRegionMode.Polite },
        )
        if (expired) {
            Spacer(Modifier.height(8.dp))
            Text(messageText(messageKey), style = type.body, color = MishColors.TextSecondary, textAlign = TextAlign.Center)
        }
        Spacer(Modifier.height(32.dp))
        MishButton(
            stringResource(R.string.tv__new_room),
            onNewRoom,
            Modifier.focusRequester(newRoom),
            kind = ButtonKind.Primary,
            icon = MishIcons.Refresh,
            minWidth = 240.dp,
        )
    }
    InitialFocus(newRoom)
}
