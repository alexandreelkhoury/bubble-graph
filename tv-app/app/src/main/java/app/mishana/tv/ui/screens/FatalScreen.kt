package app.mishana.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import app.mishana.tv.R
import app.mishana.tv.i18n.MessageKeys
import app.mishana.tv.i18n.messageText
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.StatusStage
import app.mishana.tv.ui.theme.MishColors

/**
 * TV-13e/13g: the room is gone (4010 outside an empty lobby) or another fatal close (4002/4003/4004/4005).
 * Full screen with the error text and (• New room). Back exits the app (activity default).
 */
@Composable
fun FatalScreen(messageKey: String, onNewRoom: () -> Unit) {
    val expired = messageKey == MessageKeys.ROOM_EXPIRED
    StatusStage(
        icon = if (expired) MishIcons.DoorOut else MishIcons.WifiOff,
        tint = if (expired) MishColors.Accent else MishColors.Danger,
        title = if (expired) stringResource(R.string.tv__room_closed) else messageText(messageKey),
        body = if (expired) messageText(messageKey) else null,
        actionLabel = stringResource(R.string.tv__new_room),
        onAction = onNewRoom,
    )
}
