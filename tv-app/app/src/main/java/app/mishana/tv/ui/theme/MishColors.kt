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

/** DESIGN §13.2 swatch enum; identical to SPEC §3 `COLORS` (ConstantsTest compares them). */
enum class PlayerSwatch(val id: String, val color: Color, val glyph: Color, val shape: AvatarShape) {
    Coral("coral", Color(0xFFF0183A), MishColors.Ink, AvatarShape.Circle),
    Azure("azure", Color(0xFF478CFF), MishColors.Ink, AvatarShape.Square),
    Lemon("lemon", Color(0xFFFFF04D), MishColors.Ink, AvatarShape.Star),
    Jade("jade", Color(0xFF1FA88A), MishColors.Ink, AvatarShape.Triangle),
    Grape("grape", Color(0xFF7A43FF), MishColors.Text, AvatarShape.Diamond),
    Tangerine("tangerine", Color(0xFFFF7A1F), MishColors.Ink, AvatarShape.Hexagon),
    Aqua("aqua", Color(0xFF7BFFF4), MishColors.Ink, AvatarShape.Plus),
    Rose("rose", Color(0xFFFF96C5), MishColors.Ink, AvatarShape.Drop),
    Mint("mint", Color(0xFFBDF5C8), MishColors.Ink, AvatarShape.Crescent),
    Plum("plum", Color(0xFFC02A8F), MishColors.Text, AvatarShape.Bolt),
    Sand("sand", Color(0xFFE6C486), MishColors.Ink, AvatarShape.Flower),
    Lilac("lilac", Color(0xFFC9BFFF), MishColors.Ink, AvatarShape.Arch);

    /** Plum and grape fall below 3:1 on `elevated`: tiles get a cream ring at 24 % (DESIGN §2.3). */
    val needsRingOnElevated: Boolean get() = this == Grape || this == Plum

    companion object {
        fun byId(id: String): PlayerSwatch = entries.firstOrNull { it.id == id } ?: Coral

        /** Same table built from [Constants.COLORS], used by the swatch/constant consistency test. */
        fun fromConstants(): List<Triple<String, Long, AvatarShape>> =
            Constants.COLORS.map { Triple(it.id, it.argb, it.shape) }
    }
}
