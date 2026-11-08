package app.jamaa.tv.platform

import app.jamaa.tv.games.GameIds
import app.jamaa.tv.protocol.CupPublic
import app.jamaa.tv.protocol.GameCard
import app.jamaa.tv.protocol.MemberPublic
import app.jamaa.tv.protocol.RoomPublic

// JAMAA-PLATFORM §3.2 HUB-02 and DESIGN-JAMAA §2.1 as pure data (JVM-tested): carousel order and wrap, the join ticket
// states and QR math, member captions, the cup chip, and the D-pad focus graph.

/** Focus targets of the hub. Top-bar items appear only when shown. */
sealed interface HubFocus {
    data class Poster(val index: Int) : HubFocus
    data class TopBar(val item: TopBarItem) : HubFocus
    data class Member(val index: Int) : HubFocus
}

/** Top-bar items in reading order (the wordmark is not focusable). */
enum class TopBarItem { CUP, INFO, PASS, SETTINGS }

/** The join ticket's two states (DESIGN-JAMAA §2.1). */
enum class TicketState { GATHERING, COMPACT }

object HubModel {
    /** First 60 s after launch the ticket stays in the gathering state. */
    const val GATHERING_MS = 60_000L
    const val GATHERING_MIN_MEMBERS = 3
    const val PANEL_GATHERING_DP = 208
    const val PANEL_COMPACT_DP = 176
    const val COLUMN_GATHERING_DP = 248
    const val COLUMN_COMPACT_DP = 200
    const val POSTER_W_DP = 210
    const val POSTER_H_DP = 290
    const val POSTER_GAP_DP = 28
    const val POSTER_FOCUS_SCALE = 1.08f

    /** The hub stage crossfades this far toward the focused world (never 100 %). */
    const val WORLD_TINT = 0.40f

    fun ticketState(presentMembers: Int, sinceLaunchMs: Long): TicketState =
        if (presentMembers < GATHERING_MIN_MEMBERS || sinceLaunchMs < GATHERING_MS) TicketState.GATHERING else TicketState.COMPACT

    fun panelDp(state: TicketState): Int = if (state == TicketState.GATHERING) PANEL_GATHERING_DP else PANEL_COMPACT_DP
    fun columnDp(state: TicketState): Int = if (state == TicketState.GATHERING) COLUMN_GATHERING_DP else COLUMN_COMPACT_DP

    /** SPEC §9.9: `module = floor(panel / (matrixWidth + 8))` (the 4-module quiet zone sits inside the panel). */
    fun qrModuleDp(panelDp: Int, matrixWidth: Int): Int = panelDp / (matrixWidth + 8)

    /** Member caption length: ≤ 8 graphemes with ≤ 8 members, ≤ 6 at 9–12 (72 dp slots fit 12). */
    fun captionGraphemes(memberCount: Int): Int = if (memberCount <= 8) 8 else 6

    /** Members shown on the strip (left members linger in a game only), by seat. */
    fun strip(room: RoomPublic): List<MemberPublic> = room.members.filter { !it.left }.sortedBy { it.seat }

    /** The cards in carousel (registry) order; only `room.games` (already TV-capability filtered by the server). */
    fun cards(room: RoomPublic): List<GameCard> = room.games.sortedBy { GameIds.ALL.indexOf(it.id).let { i -> if (i < 0) Int.MAX_VALUE else i } }

    /** Initial focus: the last played game, else `mishana`, else the first card. */
    fun initialIndex(cards: List<GameCard>, lastPlayed: String?, focused: String?): Int {
        val prefer = listOfNotNull(focused, lastPlayed, GameIds.MISHANA)
        for (id in prefer) {
            val i = cards.indexOfFirst { it.id == id }
            if (i >= 0) return i
        }
        return 0
    }

    /** The meta line "3–12 players · 10–20 min"; [needs] when the room has fewer than `minPlayers` (shown in danger). */
    data class MetaLine(val minPlayers: Int, val maxPlayers: Int, val minMinutes: Int, val maxMinutes: Int, val needs: Boolean)

    fun metaLine(card: GameCard, presentMembers: Int): MetaLine = MetaLine(
        card.minPlayers, card.maxPlayers, card.durationMinutes.getOrElse(0) { 0 }, card.durationMinutes.getOrElse(1) { 0 },
        needs = presentMembers < card.minPlayers,
    )

    /** "Tonight's cup" chip: hidden until a game has ended; the top 3 by stars (ties by seat). */
    fun cupTop(cup: CupPublic, members: List<MemberPublic>, n: Int = 3): List<Pair<MemberPublic, Int>> {
        if (cup.last == null && cup.stars.isEmpty()) return emptyList()
        return members.filter { !it.left }
            .mapNotNull { m -> cup.stars[m.id]?.takeIf { it > 0 }?.let { m to it } }
            .sortedWith(compareByDescending<Pair<MemberPublic, Int>> { it.second }.thenBy { it.first.seat })
            .take(n)
    }

    fun showCup(cup: CupPublic): Boolean = cup.last != null

    /** The cup leader (a unique top star count), who wears the tiny crown on the hub (§3.10 D). */
    fun cupLeader(cup: CupPublic): String? {
        val max = cup.stars.values.maxOrNull() ?: return null
        if (max <= 0) return null
        val top = cup.stars.filterValues { it == max }.keys
        return top.singleOrNull()
    }

    /** Visible top-bar items, in reading order. */
    fun topBar(showCup: Boolean, showPass: Boolean): List<TopBarItem> = buildList {
        if (showCup) add(TopBarItem.CUP)
        add(TopBarItem.INFO)
        if (showPass) add(TopBarItem.PASS)
        add(TopBarItem.SETTINGS)
    }

    /**
     * The hub focus graph (§3.2, DESIGN-JAMAA §2.1). Keys are physical; [rtl] mirrors Left/Right. Returns the new focus
     * or null when the key does nothing (it then must not move focus anywhere else).
     */
    fun move(from: HubFocus, key: RemoteKey, rtl: Boolean, posters: Int, members: Int, topBar: List<TopBarItem>): HubFocus? {
        val forward = if (rtl) RemoteKey.LEFT else RemoteKey.RIGHT
        val backward = if (rtl) RemoteKey.RIGHT else RemoteKey.LEFT
        return when (from) {
            is HubFocus.Poster -> when (key) {
                forward -> if (posters <= 1) null else HubFocus.Poster((from.index + 1) % posters)
                backward -> if (posters <= 1) null else HubFocus.Poster((from.index - 1 + posters) % posters)
                RemoteKey.UP -> HubFocus.TopBar(TopBarItem.INFO)
                RemoteKey.DOWN -> if (members > 0) HubFocus.Member(0) else null
                else -> null
            }
            is HubFocus.TopBar -> {
                val i = topBar.indexOf(from.item)
                when (key) {
                    forward -> topBar.getOrNull(i + 1)?.let { HubFocus.TopBar(it) }
                    backward -> topBar.getOrNull(i - 1)?.let { HubFocus.TopBar(it) }
                    RemoteKey.DOWN -> HubFocus.Poster(-1) // the focused poster: resolved by the caller
                    else -> null
                }
            }
            is HubFocus.Member -> when (key) {
                forward -> if (from.index + 1 < members) HubFocus.Member(from.index + 1) else null
                backward -> if (from.index > 0) HubFocus.Member(from.index - 1) else null
                RemoteKey.UP -> HubFocus.Poster(-1)
                else -> null
            }
        }
    }
}

/** Setup (HUB-03) focus targets: the title-strip ⓘ, the how-to pane, and the settings column. */
sealed interface SetupTarget {
    data object Info : SetupTarget
    data object HowTo : SetupTarget
    data class Column(val index: Int) : SetupTarget
}

object SetupFocusGraph {
    /**
     * §3.2 HUB-03 focus graph. The column is Content, the visible rows, Advanced (if any) and Start, in that order.
     * [steps] tells whether a column item steps its value with Left/Right (choice/toggle/stepper rows): on those the
     * keys step and never leave the row. // JAMAA-GAP: the spec says both "Left/Right steps a value" and "Left from any
     * row → the how-to pane"; stepping rows keep Left/Right for stepping, the other items (Content, packs, Advanced,
     * Start) move to the how-to pane.
     */
    fun move(
        from: SetupTarget,
        key: RemoteKey,
        rtl: Boolean,
        columnSize: Int,
        steps: (Int) -> Boolean,
        lastColumn: Int?,
        firstRow: Int,
    ): SetupTarget? {
        val towardHowTo = if (rtl) RemoteKey.RIGHT else RemoteKey.LEFT
        val towardColumn = if (rtl) RemoteKey.LEFT else RemoteKey.RIGHT
        return when (from) {
            SetupTarget.Info -> if (key == RemoteKey.DOWN) SetupTarget.HowTo else null
            SetupTarget.HowTo -> when (key) {
                towardColumn -> SetupTarget.Column((lastColumn ?: firstRow).coerceIn(0, (columnSize - 1).coerceAtLeast(0)))
                RemoteKey.UP -> SetupTarget.Info
                else -> null
            }
            is SetupTarget.Column -> when (key) {
                RemoteKey.UP -> if (from.index == 0) SetupTarget.Info else SetupTarget.Column(from.index - 1)
                RemoteKey.DOWN -> if (from.index + 1 < columnSize) SetupTarget.Column(from.index + 1) else null
                towardHowTo -> if (steps(from.index)) null else SetupTarget.HowTo
                else -> null
            }
        }
    }
}
