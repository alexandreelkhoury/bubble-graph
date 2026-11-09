package app.jamaa.tv.games.trivia

import app.jamaa.tv.platform.RemoteKey

// The setup side of Quiz Night (GAME-TRIVIA §9.1, DESIGN-JAMAA §2.3.1), pure (JVM-tested): one playable quiz → a
// non-focusable summary card; two or more → the quiz shelf, one row per domain, D-pad between rows and cards.

/** One quiz card as drawn: the card data, whether it is the room's current pick and whether it is locked here. */
data class QuizCardModel(val info: QuizCardInfo, val selected: Boolean, val locked: Boolean) {
    /** "+n" after the featured chips (max 3 chips, in author order). */
    val featured: List<String> get() = info.featuredTopics.take(3)
    val more: Int get() = info.moreTopics + (info.featuredTopics.size - featured.size).coerceAtLeast(0)
}

data class ShelfRow(val domain: String, val cards: List<QuizCardModel>)

/** The shelf's local focus (row, card); it never sends anything until OK. */
data class ShelfFocus(val row: Int, val col: Int)

/** What a key did on the shelf. */
sealed interface ShelfAction {
    data class Move(val focus: ShelfFocus) : ShelfAction

    /** OK on a free card: pick it (UPDATE_GAME_SETTINGS {quizId}) and close the shelf. */
    data class Pick(val familyId: String) : ShelfAction

    /** OK on a locked card: the platform's Pass upsell (billing on), else nothing. */
    data class Locked(val familyId: String) : ShelfAction

    /** Back: close without change. */
    data object Close : ShelfAction

    data object None : ShelfAction
}

object TriviaShelf {
    /** Shelf row order: the controlled vocabulary's domain order (GAME-TRIVIA §11.1). */
    val DOMAIN_ORDER = listOf("lebanon", "middle-east", "arab-world", "france", "world", "general")

    /** Cards in the shelf/summary: Pass-only quizzes show a lock in free rooms (billing decides if they can open). */
    fun cards(setup: TriviaSetupView): List<QuizCardModel> {
        val current = currentId(setup)
        return setup.extras.quizzes.map { q -> QuizCardModel(q, q.id == current, q.tier == "premium" && !setup.premium) }
    }

    /** The family the room plays: the setting, or the server's default (`extras.quiz`) while it is null. */
    fun currentId(setup: TriviaSetupView): String? = setup.settings.quizId ?: setup.extras.quiz?.id

    /** One playable quiz (launch): the settings pane shows the summary card and no Quiz row (GAME-TRIVIA §9). */
    fun showsSummary(setup: TriviaSetupView): Boolean = setup.extras.quizzes.size <= 1 && setup.extras.quiz != null

    /** The summary card's quiz (the one quiz), or null. */
    fun summary(setup: TriviaSetupView): QuizCardModel? =
        if (!showsSummary(setup)) null else setup.extras.quiz?.let { QuizCardModel(it, true, it.tier == "premium" && !setup.premium) }

    /** The shelf rows: one per domain in vocabulary order (unknown domains last, alphabetically), cards in server order. */
    fun rows(setup: TriviaSetupView): List<ShelfRow> {
        val byDomain = cards(setup).groupBy { it.info.domain }
        val order = byDomain.keys.sortedWith(compareBy<String>({ DOMAIN_ORDER.indexOf(it).let { i -> if (i < 0) Int.MAX_VALUE else i } }, { it }))
        return order.map { ShelfRow(it, byDomain.getValue(it)) }
    }

    /** Initial focus: the selected card, else the first card. */
    fun initialFocus(rows: List<ShelfRow>): ShelfFocus {
        rows.forEachIndexed { r, row -> row.cards.indexOfFirst { it.selected }.takeIf { it >= 0 }?.let { return ShelfFocus(r, it) } }
        return ShelfFocus(0, 0)
    }

    /**
     * D-pad on the shelf (GAME-TRIVIA §9.1): Up/Down between rows (keeping the column, clamped), Left/Right between
     * cards (forward = the reading direction: [rtl] mirrors Left/Right, like every row of cards on the TV), OK picks,
     * Back closes. Edges do not wrap. A repeated OK never picks ([repeat], platform §3.10 E rule 3).
     */
    fun onKey(rows: List<ShelfRow>, focus: ShelfFocus, key: RemoteKey, rtl: Boolean, repeat: Boolean = false): ShelfAction {
        if (rows.isEmpty()) return if (key == RemoteKey.BACK) ShelfAction.Close else ShelfAction.None
        val r = focus.row.coerceIn(0, rows.size - 1)
        val c = focus.col.coerceIn(0, rows[r].cards.size - 1)
        fun move(nr: Int, nc: Int): ShelfAction {
            val rr = nr.coerceIn(0, rows.size - 1)
            val cc = nc.coerceIn(0, rows[rr].cards.size - 1)
            return if (rr == r && cc == c) ShelfAction.None else ShelfAction.Move(ShelfFocus(rr, cc))
        }
        val forward = if (rtl) RemoteKey.LEFT else RemoteKey.RIGHT
        val backward = if (rtl) RemoteKey.RIGHT else RemoteKey.LEFT
        return when (key) {
            RemoteKey.UP -> move(r - 1, c)
            RemoteKey.DOWN -> move(r + 1, c)
            forward -> move(r, c + 1)
            backward -> move(r, c - 1)
            RemoteKey.OK -> {
                if (repeat) return ShelfAction.None
                val card = rows[r].cards[c]
                if (card.locked) ShelfAction.Locked(card.info.id) else ShelfAction.Pick(card.info.id)
            }
            RemoteKey.BACK -> ShelfAction.Close
            else -> ShelfAction.None
        }
    }

    /** "Difficulty 2 of 3" is spoken; the visible line is ★★☆ + Easy/Medium/Hard. Filled stars of 3. */
    fun filledStars(stars: Int): Int = stars.coerceIn(1, 3)
}
