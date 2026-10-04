package app.mishana.tv.ui.screens

import androidx.compose.ui.unit.Dp
import androidx.compose.ui.unit.dp

/** Tile geometry for the vote board (DESIGN TV-06, reused by TV-07): ≤ 8 candidates 136 × 112 (4 per row), else 120 × 96 (6 per row). */
data class BoardSpec(val tileW: Dp, val tileH: Dp, val avatar: Dp, val perRow: Int)

fun boardSpec(n: Int) = if (n <= 8) BoardSpec(136.dp, 112.dp, 60.dp, 4) else BoardSpec(120.dp, 96.dp, 50.dp, 6)
