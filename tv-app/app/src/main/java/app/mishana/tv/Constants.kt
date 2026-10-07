package app.mishana.tv

/** Avatar glyph shapes, paired 1:1 with the player colours (DESIGN §2.3, SPEC §3 `COLORS[].shape`). */
enum class AvatarShape { Circle, Square, Star, Triangle, Diamond, Hexagon, Plus, Drop, Crescent, Bolt, Flower, Arch }

/** One entry of SPEC §3 `COLORS`: id, ARGB, shape, and whether the avatar glyph is cream (else ink). */
data class PlayerColor(val id: String, val argb: Long, val shape: AvatarShape, val glyphIsCream: Boolean)

/** Bounds and UI step for an integer setting. `off` = the value meaning "timer off" (0), or null. */
data class IntBounds(val min: Int, val max: Int, val step: Int, val off: Int? = null)

data class PackIdsBounds(val maxItems: Int, val idRegex: String)

/** SPEC §3 `SETTINGS_BOUNDS`, one data class per key. */
data class SettingsBounds(
    val undercoverCount: IntBounds,
    val blankCount: IntBounds,
    val clueSeconds: IntBounds,
    val voteSeconds: IntBounds,
    val revealSeconds: IntBounds,
    val guessSeconds: IntBounds,
    val points: IntBounds,
    val packIds: PackIdsBounds,
)

/** Kotlin mirror of shared/src/constants.ts (SPEC §3). Keep in sync by hand; ConstantsTest guards the colours. */
object Constants {
    const val PROTOCOL_VERSION = 1
    const val ROOM_CODE_ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ" // 23 letters, no I L O
    const val ROOM_CODE_LENGTH = 4
    val ROOM_CODE_REGEX = Regex("^[ABCDEFGHJKMNPQRSTUVWXYZ]{4}$")
    const val PARTY_NAME = "room"
    const val WS_PATH_PREFIX = "/parties/room/"
    const val MIN_PLAYERS = 3
    const val MAX_PLAYERS = 12
    const val NAME_MAX_CHARS = 16
    const val GUESS_MAX_CHARS = 40
    const val NAME_MAX_CODEPOINTS = 64
    const val SEAT_HOLD_MS = 120_000L
    const val ELIMINATION_HOLD_MS = 8_000L
    const val VERDICT_HOLD_MS = 8_000L
    const val CLUE_GRACE_MS = 15_000L
    const val TIE_LEAD_IN_MS = 3_000L
    const val MAX_NO_ELIMINATION_STREAK = 3
    const val HEARTBEAT_INTERVAL_MS = 20_000L
    const val PONG_TIMEOUT_MS = 10_000L
    const val HELLO_TIMEOUT_MS = 10_000L
    const val ROOM_TV_MAX_TTL_MS = 12 * 60 * 60_000L
    const val ROOM_TV_GONE_TTL_MS = 15 * 60_000L
    const val MSG_MAX_BYTES = 4096
    const val HTTP_BODY_MAX_BYTES = 4096 // PAYMENTS-SPEC §3.3: was 1024; POST /api/rooms carries the entitlement token
    const val RATE_MSGS_PER_SEC = 5
    const val RATE_BURST = 10
    const val JOINS_PER_MIN_PER_IP = 30
    const val CREATE_ROOMS_PER_MIN_PER_IP = 10
    const val CONNECTS_PER_MIN_PER_IP = 60
    const val MAX_CONNECTIONS_PER_ROOM = 40
    const val MAX_PENDING_CONNECTIONS = 10
    val FATAL_CLOSE_CODES: Set<Int> = setOf(4002, 4003, 4004, 4005, 4006, 4010)
    val SLOW_RECONNECT_CLOSE_CODES: Set<Int> = setOf(4008, 4009)
    const val SLOW_RECONNECT_MS = 10_000L
    const val PING_FRAME = """{"v":1,"t":"ping"}"""
    const val PONG_FRAME = """{"v":1,"t":"pong"}"""
    val LOCALES: List<String> = listOf("en", "fr", "ar")

    // PAYMENTS-SPEC §3.3 mirrors.
    const val ENTITLEMENT_TOKEN_MAX_CHARS = 3000
    const val MAX_PURCHASES_PER_VERIFY = 20
    const val PURCHASE_TOKEN_MAX_CHARS = 2048

    /** §3.11 `TV_BUSY_MAX_MS` (5 min): the TV re-sends `storeOpen{open:true}` every 4 min while busy. */
    const val TV_BUSY_MAX_MS = 5 * 60_000L

    /** DESIGN §2.3 palette in pick order. */
    val COLORS: List<PlayerColor> = listOf(
        PlayerColor("coral", 0xFFF0183AL, AvatarShape.Circle, glyphIsCream = false),
        PlayerColor("azure", 0xFF478CFFL, AvatarShape.Square, glyphIsCream = false),
        PlayerColor("lemon", 0xFFFFF04DL, AvatarShape.Star, glyphIsCream = false),
        PlayerColor("jade", 0xFF1FA88AL, AvatarShape.Triangle, glyphIsCream = false),
        PlayerColor("grape", 0xFF7A43FFL, AvatarShape.Diamond, glyphIsCream = true),
        PlayerColor("tangerine", 0xFFFF7A1FL, AvatarShape.Hexagon, glyphIsCream = false),
        PlayerColor("aqua", 0xFF7BFFF4L, AvatarShape.Plus, glyphIsCream = false),
        PlayerColor("rose", 0xFFFF96C5L, AvatarShape.Drop, glyphIsCream = false),
        PlayerColor("mint", 0xFFBDF5C8L, AvatarShape.Crescent, glyphIsCream = false),
        PlayerColor("plum", 0xFFC02A8FL, AvatarShape.Bolt, glyphIsCream = true),
        PlayerColor("sand", 0xFFE6C486L, AvatarShape.Flower, glyphIsCream = false),
        PlayerColor("lilac", 0xFFC9BFFFL, AvatarShape.Arch, glyphIsCream = false),
    )

    fun colorById(id: String): PlayerColor = COLORS.firstOrNull { it.id == id } ?: COLORS[0]

    /** `off: 0` means 0 is allowed and means "timer off". */
    val SETTINGS_BOUNDS = SettingsBounds(
        undercoverCount = IntBounds(min = 0, max = 5, step = 1),
        blankCount = IntBounds(min = 0, max = 5, step = 1),
        clueSeconds = IntBounds(min = 10, max = 120, step = 5, off = 0),
        voteSeconds = IntBounds(min = 15, max = 300, step = 15, off = 0),
        revealSeconds = IntBounds(min = 10, max = 120, step = 5, off = 0),
        guessSeconds = IntBounds(min = 10, max = 120, step = 5, off = 0),
        points = IntBounds(min = 0, max = 20, step = 1),
        packIds = PackIdsBounds(maxItems = 50, idRegex = "^[a-z0-9-]{1,40}$"),
    )
}
