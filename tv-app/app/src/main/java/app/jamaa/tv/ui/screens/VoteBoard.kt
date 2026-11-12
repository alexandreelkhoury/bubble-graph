package app.jamaa.tv.ui.screens

import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.runtime.Composable
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.unit.dp
import app.jamaa.tv.games.mishana.MishanaLayout
import app.jamaa.tv.protocol.PublicPlayer

/**
 * The vote board's tiles (DESIGN TV-06, reused by TV-07 so no tile moves between the vote and its reveal): rows of
 * [grid] centred on the stage, the last row centred under the others. [item] draws one tile at its index.
 */
@Composable
fun PlayerGrid(
    players: List<PublicPlayer>,
    grid: MishanaLayout.Grid,
    modifier: Modifier = Modifier,
    item: @Composable (PublicPlayer, Int) -> Unit,
) {
    Column(modifier, verticalArrangement = Arrangement.spacedBy(grid.gapY.dp), horizontalAlignment = Alignment.CenterHorizontally) {
        players.chunked(grid.cols).forEachIndexed { r, row ->
            Row(horizontalArrangement = Arrangement.spacedBy(grid.gapX.dp)) {
                row.forEachIndexed { c, p -> item(p, r * grid.cols + c) }
            }
        }
    }
}
