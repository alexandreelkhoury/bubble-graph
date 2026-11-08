package app.jamaa.tv.ui.screens

import androidx.compose.runtime.Composable
import androidx.compose.ui.res.stringResource
import app.jamaa.tv.R
import app.jamaa.tv.i18n.MessageKeys
import app.jamaa.tv.i18n.messageText
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.StatusStage
import app.jamaa.tv.ui.theme.JamaaColors

/**
 * TV-13e/13g: the room is gone (4010 outside an empty lobby) or another fatal close (4002/4003/4004/4005).
 * Full screen with the error text and (• New room). Back exits the app (activity default).
 */
@Composable
fun FatalScreen(messageKey: String, onNewRoom: () -> Unit) {
    val expired = messageKey == MessageKeys.ROOM_EXPIRED
    StatusStage(
        icon = if (expired) JamaaIcons.DoorOut else JamaaIcons.WifiOff,
        tint = if (expired) JamaaColors.Accent else JamaaColors.Danger,
        title = if (expired) stringResource(R.string.tv__room_closed) else messageText(messageKey),
        body = if (expired) messageText(messageKey) else null,
        actionLabel = stringResource(R.string.tv__new_room),
        onAction = onNewRoom,
    )
}
