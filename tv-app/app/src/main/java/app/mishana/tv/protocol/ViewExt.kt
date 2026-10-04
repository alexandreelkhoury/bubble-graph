package app.mishana.tv.protocol

/** Model-level helpers over [TvView] (pure; shared by the ViewModel, the event diff and the screens). */

fun TvView.player(id: String?): PublicPlayer? = if (id == null) null else players.firstOrNull { it.id == id }

/** Vote candidates: the tied players in a re-vote, else every alive player. */
fun TvView.voteCandidates(): List<PublicPlayer> =
    if (revote && tieCandidates.isNotEmpty()) tieCandidates.mapNotNull { player(it) } else players.filter { it.alive && !it.left }

/** SPEC §5 `startBlocker` codes. The wire value stays a String (fixtures round-trip exactly); compare through this. */
enum class StartBlocker { NOT_ENOUGH_PLAYERS, INVALID_ROLE_CONFIG, NO_WORDS_AVAILABLE, UNKNOWN }

/** The typed start blocker, or null when the game can start. An unknown future code maps to [StartBlocker.UNKNOWN]. */
val TvView.blocker: StartBlocker?
    get() = startBlocker?.let { code -> StartBlocker.entries.firstOrNull { it.name == code } ?: StartBlocker.UNKNOWN }
