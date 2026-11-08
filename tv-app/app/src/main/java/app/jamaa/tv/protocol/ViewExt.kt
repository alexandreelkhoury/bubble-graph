package app.jamaa.tv.protocol

/** Typed platform start blockers (JAMAA-PLATFORM §2.2). The wire value stays a String; compare through this. */
enum class StartBlocker { NOT_ENOUGH_PLAYERS, INVALID_ROLE_CONFIG, NO_WORDS_AVAILABLE, NO_CONTENT_AVAILABLE, GAME_DISABLED, GAME_FULL, UNKNOWN }

/** The typed start blocker of a raw code, or null when there is none. An unknown future code maps to [StartBlocker.UNKNOWN]. */
fun startBlockerOf(code: String?): StartBlocker? =
    code?.let { c -> StartBlocker.entries.firstOrNull { it.name == c } ?: StartBlocker.UNKNOWN }

/** The setup's typed start blocker, or null when the game can start. */
val RoomSetup.blocker: StartBlocker? get() = startBlockerOf(startBlocker)
