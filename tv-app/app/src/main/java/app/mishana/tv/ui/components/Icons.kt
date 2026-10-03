package app.mishana.tv.ui.components

import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.PathFillType
import androidx.compose.ui.graphics.SolidColor
import androidx.compose.ui.graphics.StrokeCap
import androidx.compose.ui.graphics.StrokeJoin
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.graphics.vector.addPathNodes
import androidx.compose.ui.unit.dp
import app.mishana.tv.AvatarShape

/**
 * DESIGN §5.1 icon set: 24 × 24 grid, 2 px stroke, round caps and joins. Tinted by `Icon(tint = …)`.
 * `autoMirror = true` for the icons that mirror in RTL (§10).
 */
object MishIcons {
    private fun stroke(name: String, vararg paths: String, autoMirror: Boolean = false, width: Float = 2f): ImageVector {
        val b = ImageVector.Builder(
            name = name,
            defaultWidth = 24.dp,
            defaultHeight = 24.dp,
            viewportWidth = 24f,
            viewportHeight = 24f,
            autoMirror = autoMirror,
        )
        for (d in paths) {
            b.addPath(
                pathData = addPathNodes(d),
                fill = null,
                stroke = SolidColor(Color.White),
                strokeLineWidth = width,
                strokeLineCap = StrokeCap.Round,
                strokeLineJoin = StrokeJoin.Round,
            )
        }
        return b.build()
    }

    val Check = stroke("check", "M5 12.5l4.5 4.5L19 7.5", width = 3f)
    val X = stroke("x", "M6 6l12 12M18 6L6 18", width = 2.5f)
    val WifiOff = stroke(
        "wifi-off",
        "M2 8.8a15.5 15.5 0 0 1 5.2-3.3M22 8.8a15.5 15.5 0 0 0-10-4.3",
        "M5.3 12.3a10.5 10.5 0 0 1 3.9-2.4M18.7 12.3a10.5 10.5 0 0 0-2.6-1.7",
        "M8.7 15.6a5.5 5.5 0 0 1 6.6 0",
        "M12 19.5h.01",
        "M3 3l18 18",
        width = 2.5f,
    )
    val Crown = stroke("crown", "M3.5 8l4.5 4L12 5l4 7 4.5-4-2 10.5h-13z", width = 2.5f)
    val DoorOut = stroke("door-out", "M13 4H6.5v16H13", "M10 12h10.5", "M17 8.5l3.5 3.5-3.5 3.5", autoMirror = true, width = 2.5f)
    val UserX = stroke(
        "user-x",
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "M2.5 21v-1a6 6 0 0 1 6-6h1.5a6 6 0 0 1 3.5 1.1",
        "M16 15l5 5M21 15l-5 5",
    )
    val Dice = stroke(
        "dice",
        "M6 3h12a3 3 0 0 1 3 3v12a3 3 0 0 1-3 3H6a3 3 0 0 1-3-3V6a3 3 0 0 1 3-3z",
        "M8.5 8.5h.01M15.5 8.5h.01M12 12h.01M8.5 15.5h.01M15.5 15.5h.01",
    )
    val Trophy = stroke(
        "trophy",
        "M8 21h8M12 17v4",
        "M7 3.5h10v5.5a5 5 0 0 1-10 0z",
        "M17 5.5h3v1.5a3.5 3.5 0 0 1-3.2 3.5M7 5.5H4v1.5a3.5 3.5 0 0 0 3.2 3.5",
    )
    val Phone = stroke("phone", "M8 2h8a2.5 2.5 0 0 1 2.5 2.5v15A2.5 2.5 0 0 1 16 22H8a2.5 2.5 0 0 1-2.5-2.5v-15A2.5 2.5 0 0 1 8 2z", "M10.5 18.5h3")
    val Globe = stroke(
        "globe",
        "M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18z",
        "M3 12h18",
        "M12 3c2.5 2.6 3.8 5.6 3.8 9s-1.3 6.4-3.8 9c-2.5-2.6-3.8-5.6-3.8-9s1.3-6.4 3.8-9z",
    )
    val Settings = stroke(
        "settings",
        "M12 15.5a3.5 3.5 0 1 0 0-7 3.5 3.5 0 0 0 0 7z",
        "M12 2.5v3M12 18.5v3M3.8 7.3l2.6 1.5M17.6 15.2l2.6 1.5M3.8 16.7l2.6-1.5M17.6 8.8l2.6-1.5",
    )
    val Play = ImageVector.Builder("play", 24.dp, 24.dp, 24f, 24f).apply {
        addPath(pathData = addPathNodes("M8 5.2v13.6a1 1 0 0 0 1.5.9l10.6-6.8a1 1 0 0 0 0-1.7L9.5 4.3A1 1 0 0 0 8 5.2z"), fill = SolidColor(Color.White))
    }.build()
    val ChevronForward = stroke("chevron-forward", "M9 5.5l6.5 6.5L9 18.5", autoMirror = true, width = 2.5f)
    val ChevronBack = stroke("chevron-back", "M15 5.5L8.5 12l6.5 6.5", autoMirror = true, width = 2.5f)
    val Refresh = stroke("refresh", "M20 12a8 8 0 1 1-2.4-5.7", "M20 4v5h-5")
    val Users = stroke(
        "users",
        "M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8z",
        "M2.5 21v-1a6 6 0 0 1 6-6h1a6 6 0 0 1 6 6v1",
        "M16 3.6a4 4 0 0 1 0 7.3M21.5 21v-1a6 6 0 0 0-3.5-5.4",
    )
    val Pause = stroke("pause", "M8.5 5v14M15.5 5v14", width = 3f)
    val Timer = stroke("timer", "M12 21.5a8 8 0 1 0 0-16 8 8 0 0 0 0 16z", "M12 9.5v4l2.5 2", "M10 2.5h4")
    val Vote = stroke(
        "vote",
        "M3 13h7.5",
        "M10.5 9.5h5.5a2 2 0 0 1 0 4h-1",
        "M10.5 9.5V8a2.5 2.5 0 0 0-5 0v8a5 5 0 0 0 5 5h3a3 3 0 0 0 3-3v-4.5",
        "M20.5 13h.01",
        autoMirror = true,
    )
}

/** Avatar glyphs (DESIGN §5.2), filled on a 24 × 24 viewBox. Never mirrored. */
object AvatarGlyphs {
    private fun circle(cx: Float, cy: Float, r: Float) =
        "M${cx - r} ${cy}a$r $r 0 1 0 ${2 * r} 0a$r $r 0 1 0 ${-2 * r} 0z"

    private fun filled(name: String, d: String, evenOdd: Boolean = false): ImageVector =
        ImageVector.Builder(name, 24.dp, 24.dp, 24f, 24f).apply {
            addPath(
                pathData = addPathNodes(d),
                pathFillType = if (evenOdd) PathFillType.EvenOdd else PathFillType.NonZero,
                fill = SolidColor(Color.White),
            )
        }.build()

    private val flower = listOf(
        circle(12f, 7.4f, 4.6f), circle(16.6f, 12f, 4.6f), circle(12f, 16.6f, 4.6f), circle(7.4f, 12f, 4.6f), circle(12f, 12f, 4f),
    ).joinToString("")

    private val vectors: Map<AvatarShape, ImageVector> = mapOf(
        AvatarShape.Circle to filled("circle", circle(12f, 12f, 9f)),
        AvatarShape.Square to filled("square", "M7 3.5h10a3.5 3.5 0 0 1 3.5 3.5v10a3.5 3.5 0 0 1-3.5 3.5H7A3.5 3.5 0 0 1 3.5 17V7A3.5 3.5 0 0 1 7 3.5z"),
        AvatarShape.Star to filled("star", "M12 2.5l2.9 6.1 6.6.8-4.9 4.6 1.3 6.6L12 17.3l-5.9 3.3 1.3-6.6-4.9-4.6 6.6-.8z"),
        AvatarShape.Triangle to filled("triangle", "M12 3.2 21.4 19.8H2.6z"),
        AvatarShape.Diamond to filled("diamond", "M12 2.2 21.8 12 12 21.8 2.2 12z"),
        AvatarShape.Hexagon to filled("hexagon", "M12 2.6 20.2 7.3v9.4L12 21.4 3.8 16.7V7.3z"),
        AvatarShape.Plus to filled("plus", "M9 3h6v6h6v6h-6v6H9v-6H3V9h6z"),
        AvatarShape.Drop to filled("drop", "M12 2.5S5 10.4 5 15a7 7 0 0 0 14 0c0-4.6-7-12.5-7-12.5z"),
        AvatarShape.Crescent to filled("crescent", "M15 2.7a9.5 9.5 0 1 0 6.3 13.6A7.6 7.6 0 0 1 15 2.7z"),
        AvatarShape.Bolt to filled("bolt", "M13.5 2 5 13.5h6L10 22l9-12h-6.2z"),
        AvatarShape.Flower to filled("flower", flower),
        AvatarShape.Arch to filled("arch", "M5 21.5V11a7 7 0 0 1 14 0v10.5h-4.5V15a2.5 2.5 0 0 0-5 0v6.5z"),
    )

    fun of(shape: AvatarShape): ImageVector = vectors.getValue(shape)
}

/** Role emblems (DESIGN §5.3), 48-grid silhouettes. The Blank's empty card is drawn with a dashed stroke in [RoleEmblem]. */
object RoleEmblems {
    val House: ImageVector = ImageVector.Builder("house", 48.dp, 48.dp, 48f, 48f).apply {
        addPath(
            pathData = addPathNodes("M24 6 42 20v22H6V20z M19 42V30h10v12z"),
            pathFillType = PathFillType.EvenOdd,
            fill = SolidColor(Color.White),
        )
    }.build()

    /** Domino mask: a wide rounded bowtie with two almond eye holes. */
    val Mask: ImageVector = ImageVector.Builder("mask", 48.dp, 48.dp, 48f, 48f).apply {
        addPath(
            pathData = addPathNodes(
                "M4 19c0-4.4 3.6-7 8.2-7 4.9 0 7.8 2.6 11.8 2.6S30.9 12 35.8 12C40.4 12 44 14.6 44 19c0 8.8-4.9 15.5-10.9 15.5-4.8 0-6.2-4.6-9.1-4.6s-4.3 4.6-9.1 4.6C8.9 34.5 4 27.8 4 19z" +
                    "M10.5 21.5c2.2-3.2 7.3-3.4 9.5 0-2.2 3.1-7.3 3.3-9.5 0z" +
                    "M28 21.5c2.2-3.4 7.3-3.2 9.5 0-2.2 3.3-7.3 3.1-9.5 0z",
            ),
            pathFillType = PathFillType.EvenOdd,
            fill = SolidColor(Color.White),
        )
    }.build()
}
