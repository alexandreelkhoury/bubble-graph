package app.jamaa.tv.ui.components

import androidx.compose.foundation.background
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaTheme

/**
 * PAYMENTS-SPEC §4.4: lock icon + label on locked packs and premium-only settings. Icon AND text, never colour alone
 * (DESIGN §11). Not focusable: the row that carries it is.
 */
@Composable
fun LockBadge(label: String?, modifier: Modifier = Modifier, icon: ImageVector = JamaaIcons.Lock) {
    Row(
        modifier
            .background(JamaaColors.Accent.copy(alpha = 0.16f), JamaaShapes.pill)
            .padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = JamaaColors.Accent, modifier = Modifier.size(18.dp))
        if (label != null) {
            Spacer(Modifier.width(6.dp))
            Text(label, style = JamaaTheme.type.caption, color = JamaaColors.Accent, maxLines = 1)
        }
    }
}
