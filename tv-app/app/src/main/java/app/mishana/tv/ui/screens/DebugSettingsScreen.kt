package app.mishana.tv.ui.screens

import androidx.compose.foundation.BorderStroke
import androidx.compose.foundation.background
import androidx.compose.foundation.border
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.foundation.text.BasicTextField
import androidx.compose.foundation.text.KeyboardOptions
import androidx.compose.runtime.Composable
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.input.KeyboardType
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Text
import app.mishana.tv.BuildConfig
import app.mishana.tv.R
import app.mishana.tv.settings.DebugPrefs
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.OverlayCard
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishTheme

/**
 * Debug builds only (SPEC §9.3/§9.4): edit the server URL override (SharedPreferences "mishana_debug").
 * Blank = use BuildConfig.SERVER_URL. Saving re-creates the room against the new server.
 */
@Composable
fun DebugSettingsScreen(prefs: DebugPrefs, onClose: () -> Unit, onSaved: () -> Unit) {
    val type = MishTheme.type
    var url by remember { mutableStateOf(prefs.serverUrl) }
    val field = remember { FocusRequester() }
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    OverlayCard(onBack = onClose, width = 640.dp) {
        Text(stringResource(R.string.tv__debug_title), style = type.headline, color = MishColors.Text)
        Spacer(Modifier.height(16.dp))
        Text(stringResource(R.string.tv__server_url), style = type.caption, color = MishColors.TextSecondary, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(6.dp))
        BasicTextField(
            value = url,
            onValueChange = { url = it.trim() },
            singleLine = true,
            textStyle = type.titleS.copy(color = MishColors.Text),
            cursorBrush = SolidColor(MishColors.Primary),
            keyboardOptions = KeyboardOptions(keyboardType = KeyboardType.Uri),
            interactionSource = interaction,
            modifier = Modifier
                .fillMaxWidth()
                .focusRequester(field)
                .background(MishColors.Overlay, RoundedCornerShape(14.dp))
                .border(BorderStroke(if (focused) 3.dp else 2.dp, if (focused) MishColors.Focus else MishColors.OutlineStrong), RoundedCornerShape(14.dp))
                .padding(horizontal = 16.dp, vertical = 12.dp),
        )
        Spacer(Modifier.height(8.dp))
        Text(BuildConfig.SERVER_URL, style = type.caption, color = MishColors.TextMuted, modifier = Modifier.fillMaxWidth())
        Spacer(Modifier.height(20.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(16.dp)) {
            MishButton(stringResource(R.string.common__cancel), onClose)
            MishButton(
                stringResource(R.string.common__done),
                {
                    prefs.serverUrl = url
                    onSaved()
                },
                kind = ButtonKind.Primary,
            )
        }
    }
    InitialFocus(field)
}
