package app.mishana.tv.ui.components

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
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishTheme

/**
 * PAYMENTS-SPEC §4.4: lock icon + label on locked packs and premium-only settings. Icon AND text, never colour alone
 * (DESIGN §11). Not focusable: the row that carries it is.
 */
@Composable
fun LockBadge(label: String?, modifier: Modifier = Modifier, icon: ImageVector = MishIcons.Lock) {
    Row(
        modifier
            .background(MishColors.Accent.copy(alpha = 0.16f), MishShapes.pill)
            .padding(horizontal = 10.dp, vertical = 3.dp),
        verticalAlignment = Alignment.CenterVertically,
    ) {
        Icon(icon, contentDescription = null, tint = MishColors.Accent, modifier = Modifier.size(18.dp))
        if (label != null) {
            Spacer(Modifier.width(6.dp))
            Text(label, style = MishTheme.type.caption, color = MishColors.Accent, maxLines = 1)
        }
    }
}
