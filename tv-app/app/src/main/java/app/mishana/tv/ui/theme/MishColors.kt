package app.mishana.tv.ui.theme

import androidx.compose.ui.graphics.Color
import app.mishana.tv.AvatarShape
import app.mishana.tv.Constants

/** DESIGN §2.1 / §2.2 tokens. */
object MishColors {
    val Bg = Color(0xFF120A1F)
    val BgGlow = Color(0xFF2A0F3D)
    val BgDark = Color(0xFF07040D) // TV-10 "the room light drops"
    val Surface = Color(0xFF1E1430)
    val Elevated = Color(0xFF2A1D42)
    val Overlay = Color(0xFF362752)
    val Scrim = Color(0xCC120A1F) // 80 %
    val Outline = Color(0xFF4A3A66)
    val OutlineStrong = Color(0xFF8A77AB)
    val Text = Color(0xFFFFF7EC)
    val TextSecondary = Color(0xFFCBBFDD)
    val TextMuted = Color(0xFFA193B8)
    val Ink = Color(0xFF120A1F)
    val Primary = Color(0xFFFF3D8B)
    val OnPrimary = Ink
    val Accent = Color(0xFFFFC23D)
    val OnAccent = Ink
    val Success = Color(0xFF3DDC97)
    val Danger = Color(0xFFFF5A4E)
    val Focus = Color(0xFFFFF7EC)
    val Civilian = Color(0xFF5AB8FF)
    val Undercover = Color(0xFFFF8A3D)
    val Blank = Color(0xFFECE6F5)
}

/**
 * DESIGN §13.2 swatch enum, derived from the single colour table [Constants.COLORS] (SPEC §3): only the enum names
 * live here; colour, shape and glyph ink come from the table, so the two can never drift.
 */
enum class PlayerSwatch(val id: String) {
    Coral("coral"), Azure("azure"), Lemon("lemon"), Jade("jade"), Grape("grape"), Tangerine("tangerine"),
    Aqua("aqua"), Rose("rose"), Mint("mint"), Plum("plum"), Sand("sand"), Lilac("lilac");

    private val spec = Constants.colorById(id)
    val color: Color = Color(spec.argb)
    val glyph: Color = if (spec.glyphIsCream) MishColors.Text else MishColors.Ink
    val shape: AvatarShape = spec.shape

    /** Plum and grape fall below 3:1 on `surface`/`elevated`: their avatar gets a cream ring at 24 % (DESIGN §2.3). */
    val needsRing: Boolean get() = this == Grape || this == Plum

    companion object {
        fun byId(id: String): PlayerSwatch = entries.firstOrNull { it.id == id } ?: Coral
    }
}
