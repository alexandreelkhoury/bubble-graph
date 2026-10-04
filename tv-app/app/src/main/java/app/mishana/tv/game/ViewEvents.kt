package app.mishana.tv.game

import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.Phase
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.Settings
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.player

/**
 * Game events the TV announces as toasts, derived by diffing two consecutive views (pure; JVM-tested).
 * Living in the ViewModel, the diff sees every broadcast, whichever screen is showing (Settings over the Lobby,
 * the activity recreation a language change causes), so no join/leave/away/skip is lost.
 */
sealed interface ViewEvent {
    /** `lobby.joined` */
    data class PlayerJoined(val name: String) : ViewEvent

    /** `lobby.left` */
    data class PlayerLeft(val name: String) : ViewEvent

    /** `conn.playerAway` (TV-13c): someone dropped mid-game. */
    data class PlayerAway(val name: String) : ViewEvent

    /** `elim.forfeit`: an in-game LEAVE/KICK, with the role it revealed. */
    data class Forfeit(val name: String, val role: Role) : ViewEvent

    /** `clues.skipped`: the turn passed over an away player. */
    data class TurnSkipped(val name: String) : ViewEvent
}

private val CLUE_PHASES = setOf(Phase.CLUES, Phase.TIE_BREAK)

fun diffViews(before: TvView?, after: TvView): List<ViewEvent> {
    if (before == null) return emptyList()
    val out = mutableListOf<ViewEvent>()

    // Lobby roster (left players are dropped from the lobby list).
    if (before.phase == Phase.LOBBY && after.phase == Phase.LOBBY) {
        val was = before.players.filter { !it.left }.associateBy { it.id }
        val now = after.players.filter { !it.left }.associateBy { it.id }
        for ((id, p) in now) if (id !in was) out += ViewEvent.PlayerJoined(p.name)
        for ((id, p) in was) if (id !in now) out += ViewEvent.PlayerLeft(p.name)
        return out
    }
    if (before.gameNumber != after.gameNumber) return out

    // Forfeits: new history entries caused by LEAVE / KICK (their role is public).
    for (h in after.history.drop(before.history.size)) {
        if (h.cause != HistoryCause.LEAVE && h.cause != HistoryCause.KICK) continue
        val p = after.player(h.eliminatedId) ?: continue
        val role = h.role ?: continue
        out += ViewEvent.Forfeit(p.name, role)
    }

    // Away: connected → disconnected during a game.
    if (after.phase != Phase.LOBBY) {
        for (p in after.players) {
            val old = before.player(p.id) ?: continue
            if (old.connected && !p.connected && !p.left) out += ViewEvent.PlayerAway(p.name)
        }
    }

    // Skipped turns: the speaker jumped past away players within the same speaking order.
    if (before.phase in CLUE_PHASES && before.round == after.round && before.speakingOrder == after.speakingOrder) {
        val order = after.speakingOrder
        val from = order.indexOf(before.currentSpeakerId)
        val to = after.currentSpeakerId?.let { order.indexOf(it) } ?: order.size
        if (from >= 0 && to > from + 1) {
            for (id in order.subList(from + 1, to)) {
                val p = after.player(id) ?: continue
                if (!p.connected) out += ViewEvent.TurnSkipped(p.name)
            }
        }
    }
    return out
}

/** Settings keys (the TV row keys) whose values differ between [a] and [b]. */
fun changedSettingKeys(a: Settings, b: Settings): Set<String> = buildSet {
    if (a.winRule != b.winRule) add("game.winRule")
    if (a.revealRoles != b.revealRoles) add("game.revealRoles")
    if (a.tieBreak != b.tieBreak) add("game.tieBreak")
    if (a.blankGuess != b.blankGuess) add("game.blankGuess")
    if (a.points.civilian != b.points.civilian) add("game.points.civilian")
    if (a.points.undercover != b.points.undercover) add("game.points.undercover")
    if (a.points.blank != b.points.blank) add("game.points.blank")
    if (a.roleMode != b.roleMode) add("roles.roleMode")
    if (a.undercoverCount != b.undercoverCount) add("roles.undercoverCount")
    if (a.blankCount != b.blankCount) add("roles.blankCount")
    if (a.clueSeconds != b.clueSeconds) add("timers.clueSeconds")
    if (a.voteSeconds != b.voteSeconds) add("timers.voteSeconds")
    if (a.revealSeconds != b.revealSeconds) add("timers.revealSeconds")
    if (a.guessSeconds != b.guessSeconds) add("timers.guessSeconds")
    if (a.wordLocale != b.wordLocale) add("words.wordLocale")
    if (a.packIds != b.packIds) add("words.packIds")
    if (a.difficulties != b.difficulties) add("words.difficulties")
    if (a.familyFilter != b.familyFilter) add("words.familyFilter")
    if (a.swapSides != b.swapSides) add("words.swapSides")
}
