package app.jamaa.tv.platform

import app.jamaa.tv.games.PauseItemSpec
import app.jamaa.tv.games.RuleSectionSpec
import app.jamaa.tv.games.TvGameMeta

/** Where the ⓘ sheet was opened from (JAMAA-PLATFORM §3.6). */
enum class RulesOrigin { TOP_BAR, PAUSE_MENU, INFO_KEY }

/** Which screen the sheet sits on: it is 420 dp on the hub and setup, 360 dp in game (§3.6). */
enum class RulesContext { HUB, SETUP, GAME }

/** TV overlays above the current screen, top-most last. All are local: none sends anything. */
sealed interface Overlay {
    /** HUB-07. [gameId]: the current game (setup/game/results) or the last-focused one (hub). */
    data class Rules(val gameId: String, val origin: RulesOrigin, val context: RulesContext) : Overlay

    /** HUB-06 (Back in game). */
    data object PauseMenu : Overlay

    /** "Close JAMAA? The room ends for everyone" (hub Back; initial focus Stay). */
    data object CloseConfirm : Overlay

    /** Quit game → ABORT_GAME (initial focus "Keep playing"). */
    data object AbortConfirm : Overlay

    /** A pause item with `confirm: true` (e.g. Bluff "End game"). */
    data class PauseItemConfirm(val item: PauseItemSpec) : Overlay

    /** Hub members strip: Kick / Cancel for one member, then the kick confirm. */
    data class MemberMenu(val memberId: String) : Overlay
    data class KickConfirm(val memberId: String) : Overlay

    /** Hub Settings (sound, interface language, Calm animations, Show how-to again, About). */
    data object HubSettings : Overlay

    /** "Tonight's cup" full standings. */
    data object CupSheet : Overlay

    /** A dimmed poster's content-language dialog. */
    data class SwitchLanguage(val gameId: String) : Overlay

    /** A host dialog the game itself raises (e.g. Mish Ana!'s guess override): the rules sheet yields to it. */
    data object HostDialog : Overlay
}

/** Dialogs that need the host now: opening one closes the ⓘ sheet and takes focus (§3.6). */
private fun Overlay.isHostDialog(): Boolean =
    this is Overlay.CloseConfirm || this is Overlay.AbortConfirm || this is Overlay.PauseItemConfirm ||
        this is Overlay.KickConfirm || this is Overlay.HostDialog || this is Overlay.SwitchLanguage

/**
 * The overlay back stack (pure; JVM-tested). Rules of §3.2 HUB-06 and §3.6:
 * - a rules sheet opened from the pause menu closes with Back **straight to the game** (the menu goes too);
 * - a host dialog closes the rules sheet and takes focus;
 * - opening the rules while they are open does nothing.
 */
class OverlayStack(initial: List<Overlay> = emptyList()) {
    var items: List<Overlay> = initial
        private set

    val top: Overlay? get() = items.lastOrNull()
    val isEmpty: Boolean get() = items.isEmpty()
    val rules: Overlay.Rules? get() = items.lastOrNull { it is Overlay.Rules } as Overlay.Rules?

    fun open(o: Overlay) {
        if (o is Overlay.Rules) {
            if (rules != null) return
            items = items + o
            return
        }
        if (o.isHostDialog()) items = items.filter { it !is Overlay.Rules }
        if (items.lastOrNull() == o) return
        items = items + o
    }

    /** Back (or "Close") on the top overlay. */
    fun back() {
        val t = top ?: return
        items = if (t is Overlay.Rules && t.origin == RulesOrigin.PAUSE_MENU) {
            items.dropLast(1).let { rest -> if (rest.lastOrNull() == Overlay.PauseMenu) rest.dropLast(1) else rest }
        } else {
            items.dropLast(1)
        }
    }

    /** Removes [o] wherever it is (an action from it completed). */
    fun close(o: Overlay) {
        items = items.filter { it != o }
    }

    /** Removes every overlay of a kind (e.g. the pause menu when the game ends, the host dialog when it resolves). */
    fun closeAll(predicate: (Overlay) -> Boolean) {
        items = items.filterNot(predicate)
    }

    fun clear() {
        items = emptyList()
    }
}

/** One section of the ⓘ sheet. */
data class RuleSectionView(val spec: RuleSectionSpec, val youAreHere: Boolean)

object RulesContent {
    /** Sheet width in dp (§3.6). */
    fun widthDp(context: RulesContext): Int = if (context == RulesContext.GAME) 360 else 420

    /**
     * The sections in display order: those whose `phases` include [phase] first ("You are here", highlighted), then the
     * rest in the game's order. [phase] is the envelope phase (null outside a game).
     */
    fun sections(meta: TvGameMeta, phase: String?): List<RuleSectionView> {
        val here = if (phase == null) emptyList() else meta.ruleSections.filter { phase in it.phases }
        val rest = meta.ruleSections.filter { it !in here }
        return here.map { RuleSectionView(it, true) } + rest.map { RuleSectionView(it, false) }
    }

    /** The hub sheet ends with "How JAMAA works" (3 cards). */
    fun showsHowJamaaWorks(context: RulesContext): Boolean = context == RulesContext.HUB

    /** The three "How JAMAA works" cards (i18n keys). */
    val HOW_JAMAA_WORKS: List<String> = listOf("hub.howJamaa.join", "hub.howJamaa.pick", "hub.howJamaa.cup")
}

/** One row of the HUB-06 pause menu. */
sealed interface PauseRow {
    data object Resume : PauseRow
    data class GameItem(val item: PauseItemSpec, val enabled: Boolean) : PauseRow
    data object Rules : PauseRow
    data object Sound : PauseRow
    data object Quit : PauseRow
}

object PauseMenuModel {
    /**
     * §3.2 HUB-06: Resume (initial focus), the game's items in declared order (each enabled only in its phases), Rules ⓘ,
     * Sound, Quit game. Quit (ABORT_GAME) is offered only while the instance has no outcome; on results the menu still
     * opens (Rules, Sound) but the results buttons drive the room.
     */
    fun rows(meta: TvGameMeta?, phase: String?, over: Boolean): List<PauseRow> = buildList {
        add(PauseRow.Resume)
        if (meta != null && !over) for (item in meta.pauseItems) add(PauseRow.GameItem(item, phase != null && phase in item.phases))
        add(PauseRow.Rules)
        add(PauseRow.Sound)
        if (!over) add(PauseRow.Quit)
    }
}
