package app.jamaa.tv.games.likely

import app.jamaa.tv.game.Cue
import app.jamaa.tv.platform.Expression
import kotlin.math.sign

// The pure rules of the Likely TV screens (JVM-tested): where the players stand (one centred row), the reveal plan (the
// votes stacking under their targets one by one, the counts, the award stamp), the character expressions (public data
// only, DESIGN-JAMAA §4.3 secrecy rule), the awards pages and wall, and small text helpers. No points anywhere: the game
// is played for laughs and awards (owner decision 2026-11-12, GAME-LIKELY §6).
//
// Secrecy: everything here is computed from the TV's own projection. In secret-vote mode the plan reads only the
// per-card tallies (`counts`, `topIds`, `unanimous`), so two games with identical tallies draw identical frames.

data class LikelyRevealPlan(
    val kind: LikelyChoreo.RevealKind,
    /** Where every jury member stands before the reveal (the CARD/VOTING row) and in the reveal row (seat order). */
    val seats: Map<String, LikelyPt>,
    val row: Map<String, LikelyPt>,
    /** The votes, in arrival order: public mode the voters' own tokens (who voted for whom); secret, anonymous envelopes. */
    val tokens: List<LikelyToken>,
    /** Token size in stage units (one size for every stack). */
    val cell: Double,
    /** Votes and percentage per voted target. */
    val counts: Map<String, LikelyCount>,
    val topIds: List<String>,
    /** Public mode: voters who picked themselves. */
    val selfVoterIds: Set<String>,
    val againId: String?,
    val unanimous: Boolean,
    val timeline: LikelyTimeline,
) {
    /** The index (arrival order) of [voterId]'s token, public mode; null otherwise. */
    fun tokenOf(voterId: String): Int? = tokens.indexOfFirst { it.voterId == voterId }.takeIf { it >= 0 }
}

/** One player's award as AWARDS and RESULTS show it. Tonight's Star rides on the holder's card. */
data class LikelyAwardEntry(val playerId: String, val kind: LikelyAwardKind, val card: LikelyAwardCard?, val extras: List<LikelyAward>, val left: Boolean)

sealed interface LikelyAwardsPage {
    data object Intro : LikelyAwardsPage
    data class Trio(val entries: List<LikelyAwardEntry>) : LikelyAwardsPage
}

data class LikelyAwardsPlan(val pages: List<LikelyAwardsPage>, val startsMs: List<Long>, val totalMs: Long) {
    /** The page showing [elapsedMs] into AWARDS, and how far into it. */
    fun at(elapsedMs: Long): Pair<Int, Long> {
        val t = elapsedMs.coerceAtLeast(0L)
        var i = startsMs.indexOfLast { it <= t }.coerceAtLeast(0)
        if (i >= pages.size) i = pages.size - 1
        return i to (t - startsMs[i])
    }
}

/** The awards wall grid (RESULTS): [cols] × [rows] tiles, and whether a tile has room for the card's prompt line. */
data class LikelyWallGrid(val cols: Int, val rows: Int, val withPrompt: Boolean)

object LikelyStage {
    /** The jury in the CARD/VOTING row, seat order (RTL: seat 0 on the right). */
    fun seats(view: LikelyView, rtl: Boolean): Map<String, LikelyPt> {
        val jury = view.jury
        val pts = LikelyLayout.row(jury.size, rtl)
        return jury.indices.associate { jury[it].id to pts[it] }
    }

    /** The jury in the (flat) reveal row. */
    fun revealRow(view: LikelyView, rtl: Boolean): Map<String, LikelyPt> {
        val jury = view.jury
        val pts = LikelyLayout.row(jury.size, rtl, reveal = true)
        return jury.indices.associate { jury[it].id to pts[it] }
    }

    fun revealPlan(view: LikelyView, rtl: Boolean): LikelyRevealPlan? {
        val r = view.reveal ?: return null
        val seats = seats(view, rtl)
        val row = revealRow(view, rtl)
        val ids = view.jury.map { it.id }
        val rowPts = ids.map { row.getValue(it) }
        val kind = LikelyChoreo.revealKind(r, view.anonymous)
        // Public: ballots in the order the view sends them (voter seat order). Secret: never read, even if present.
        val publicMode = !view.anonymous && r.ballots != null
        val tokens = when {
            kind == LikelyChoreo.RevealKind.NONE -> emptyList()
            publicMode -> LikelyLayout.publicTokens(rowPts, ids, r.ballots.orEmpty(), rtl)
            else -> LikelyLayout.secretTokens(rowPts, ids, r.counts, rtl)
        }
        val most = r.counts.filter { it.playerId in row }.maxOfOrNull { it.count } ?: 0
        val cell = LikelyLayout.stackGrid(ids.size, most).cell
        val selfVoters = if (publicMode) r.ballots.orEmpty().filter { it.voterId == it.targetId && it.voterId in row }.map { it.voterId }.toSet() else emptySet()
        val shape = LikelyChoreo.RevealShape(tokens = tokens.size, chaos = r.chaos, none = kind == LikelyChoreo.RevealKind.NONE, unanimous = r.unanimous)
        return LikelyRevealPlan(
            kind = kind,
            seats = seats,
            row = row,
            tokens = tokens,
            cell = cell,
            counts = r.counts.filter { it.playerId in row }.associateBy { it.playerId },
            topIds = if (r.chaos) emptyList() else r.topIds.filter { it in row },
            selfVoterIds = selfVoters,
            againId = r.againId?.takeIf { it in row },
            unanimous = r.unanimous,
            timeline = LikelyChoreo.reveal(r, shape),
        )
    }

    /** Percent descending, then seat order (§5.1); the server already sends this order, it is re-applied defensively. */
    fun boardLines(r: LikelyReveal, view: LikelyView): List<LikelyCount> {
        val seat = view.players.associate { it.id to it.seat }
        return r.counts.sortedWith(compareByDescending<LikelyCount> { it.percent }.thenBy { seat[it.playerId] ?: Int.MAX_VALUE })
    }

    /** Look direction (face units) from [from] toward [to]. */
    fun look(from: LikelyPt, to: LikelyPt): Float = (to.x - from.x).sign.toFloat()

    /**
     * A jury member's expression during the reveal at [tMs] on the plan's timeline (public data only). Disconnection
     * (`away`) wins and is applied by the caller through the platform's CharacterRules.
     */
    fun revealExpression(plan: LikelyRevealPlan, id: String, tMs: Double): Expression {
        val tl = plan.timeline
        val stamp = tl.step("stamp")
        val stamped = stamp != null && tMs >= stamp.startMs + stamp.durationMs / 2
        when (plan.kind) {
            LikelyChoreo.RevealKind.NONE -> return Expression.SHY
            LikelyChoreo.RevealKind.CHAOS -> {
                val s = tl.step("scramble") ?: return Expression.LAUGH
                return when {
                    tMs < s.startMs -> Expression.THINK
                    tMs < s.startMs + s.durationMs -> Expression.SHOCK
                    else -> Expression.LAUGH
                }
            }
            LikelyChoreo.RevealKind.SECRET -> {
                if (stamped && id in plan.topIds) return Expression.SHY
                if (stamped && plan.unanimous) return Expression.CHEER
                return Expression.IDLE
            }
            LikelyChoreo.RevealKind.PUBLIC -> {
                if (id in plan.topIds && stamped) {
                    return when {
                        id in plan.selfVoterIds -> Expression.SMUG
                        plan.unanimous || plan.againId == id -> Expression.SHOCK
                        else -> Expression.SHY
                    }
                }
                if (stamped) return if (plan.unanimous) Expression.CHEER else Expression.HAPPY
                val i = plan.tokenOf(id) ?: return Expression.IDLE
                val tk = tl.step("token") ?: return Expression.IDLE
                // A voter points at its pick as its token leaves (a self-voter looks smug about it).
                if (tMs >= tk.startMs + tk.staggerMs.toDouble() * i) return if (id in plan.selfVoterIds) Expression.SMUG else Expression.POINT
                return Expression.IDLE
            }
        }
    }

    /** Before the reveal: the named player (Spicy) steps forward `shy`; everyone else idles (`done` comes from doneIds). */
    fun cardExpression(view: LikelyView, id: String): Expression =
        if (view.card?.namedPlayerId == id) Expression.SHY else Expression.IDLE

    // ---------------------------------------------------------------- awards (§6.2, §12.4)

    /** Every holder's award (signature or mystery), in the server's order, with Tonight's Star attached. */
    fun awardEntries(view: LikelyView): List<LikelyAwardEntry> {
        val left = view.players.filter { it.left }.map { it.id }.toSet()
        val extras = view.awards.filter { it.kind == LikelyAwardKind.STAR }
        return view.awards
            .filter { it.kind == LikelyAwardKind.SIGNATURE || it.kind == LikelyAwardKind.MYSTERY }
            .flatMap { a -> a.playerIds.map { id -> LikelyAwardEntry(id, a.kind, a.card, extras.filter { id in it.playerIds }, id in left) } }
    }

    /** The AWARDS pages on the server's clock: a 3 s intro, then a 4 s page per trio of holders (= `likelyAwardsMs`). */
    fun awardsPlan(view: LikelyView): LikelyAwardsPlan {
        val entries = awardEntries(view)
        val pages = mutableListOf<LikelyAwardsPage>(LikelyAwardsPage.Intro)
        val starts = mutableListOf(0L)
        var t = LikelyTiming.AWARDS_BASE_MS
        for (trio in entries.chunked(3)) {
            pages += LikelyAwardsPage.Trio(trio)
            starts += t
            t += LikelyTiming.AWARDS_TRIO_MS
        }
        return LikelyAwardsPlan(pages, starts, t)
    }

    /**
     * The RESULTS awards wall: 1–3 tiles in one row, 4 as 2 × 2, 5–6 as 3 × 2, 7–9 as 3 × 3, 10–12 as 4 × 3. Up to 6 tiles
     * have room for the card's prompt under the award; above that the award title alone (in full, never cut).
     */
    fun wallGrid(n: Int): LikelyWallGrid {
        val cols = when {
            n <= 3 -> maxOf(1, n)
            n == 4 -> 2
            n <= 9 -> 3
            else -> 4
        }
        val rows = (maxOf(1, n) + cols - 1) / cols
        return LikelyWallGrid(cols, rows, withPrompt = n <= 6)
    }

    // ---------------------------------------------------------------- text helpers

    /** "50%" (en, ar: Western digits), "50 %" with a narrow no-break space (fr), "50 %" with a no-break space (es). */
    fun percentText(percent: Int, uiLanguage: String): String = when (uiLanguage) {
        "fr" -> "$percent %"
        "es" -> "$percent %"
        else -> "$percent%"
    }

    /** The named player's name inside the resolved prompt (Spicy, §8.2), to set it in their colour; null if absent. */
    fun namedSpan(prompt: String, name: String?): IntRange? {
        if (name.isNullOrEmpty()) return null
        val i = prompt.indexOf(name)
        return if (i < 0) null else i until i + name.length
    }

    /**
     * The card question split for the card (GAME-LIKELY §8; web `Question`): [formatted] is `game.likely.card.question`
     * formatted with [mark] as the prompt. Returns the lead-in (trimmed: "Who's most likely to", "¿Quién es más capaz de")
     * and the locale's closing ("?", " ?" with the French narrow no-break space, "؟"), so the punctuation is the
     * locale's own and never hard-coded.
     */
    fun questionParts(formatted: String, mark: String = QUESTION_MARK): Pair<String, String> {
        val i = formatted.indexOf(mark)
        if (i < 0) return formatted.trim() to ""
        return formatted.substring(0, i).trim() to formatted.substring(i + mark.length).trimEnd()
    }

    /** A private-use placeholder for [questionParts] (never in a prompt). */
    const val QUESTION_MARK = ""

    /** The card phrase's type tier from its grapheme count (web `cardSize`): 0 = displayS, 1 = headline, 2 = title. */
    fun cardTier(prompt: String): Int {
        val n = graphemes(prompt)
        return if (n <= 26) 0 else if (n <= 44) 1 else 2
    }

    /**
     * User-perceived characters (extended grapheme clusters, Unicode UAX #29, the cases a card or a name meets): a base
     * code point plus every combining mark, variation selector, emoji skin-tone modifier and tag character after it;
     * a ZWJ joins the next code point into the same cluster (emoji families); two regional indicators make one flag; CR LF
     * is one. Written out because `java.text.BreakIterator` only learned emoji clusters in JDK 20 (the JVM unit tests run
     * an older one; Android's ICU-backed one already knew), so both now count the same.
     */
    fun graphemes(s: String): Int {
        var n = 0
        var i = 0
        var prev = -1
        var joinNext = false
        var riRun = 0
        while (i < s.length) {
            val cp = s.codePointAt(i)
            i += Character.charCount(cp)
            val ri = cp in 0x1F1E6..0x1F1FF
            val extend = when {
                prev < 0 -> false
                joinNext -> true
                cp == 0x200D -> true
                cp == 0x0A && prev == 0x0D -> true
                isExtend(cp) -> true
                ri && riRun % 2 == 1 -> true
                else -> false
            }
            joinNext = cp == 0x200D
            riRun = if (ri) riRun + 1 else 0
            if (!extend) n++
            prev = cp
        }
        return n
    }

    private fun isExtend(cp: Int): Boolean {
        if (cp in 0xFE00..0xFE0F || cp in 0xE0100..0xE01EF) return true      // variation selectors
        if (cp in 0x1F3FB..0x1F3FF) return true                               // emoji skin-tone modifiers
        if (cp in 0xE0020..0xE007F) return true                               // tag characters (subdivision flags)
        return when (Character.getType(cp).toByte()) {
            Character.NON_SPACING_MARK, Character.ENCLOSING_MARK, Character.COMBINING_SPACING_MARK -> true
            else -> false
        }
    }

    /** VOTING: "{count}/{total} voted" (web `vote.progress`): voters are connected jury members or ones who already voted. */
    fun voteProgress(view: LikelyView): Pair<Int, Int> {
        val voted = view.jury.count { it.voted }
        return voted to view.jury.count { it.connected || it.voted }
    }

    /** "4 / 12": the card counter (1-based). */
    fun cardNumber(view: LikelyView): Int = (view.cardIndex + 1).coerceAtMost(view.cardCount)

    /** HOLD: connected players out of the 3 needed. */
    fun holdCount(view: LikelyView): Int = view.jury.count { it.connected }

    /** The VOTING ring's full duration (the deadline carries no duration; mirrors the server's formula). */
    fun votingDurationMs(view: LikelyView): Long = LikelyTiming.votingMs(view.jury.size)
}

/**
 * Likely's sound cues. The generated res/raw `likely_*` files (SoundCuesLikely) cannot be played yet: the platform
 * sound sink only knows its [Cue] enum (JAMAA-GAP: no per-game cue path in TvSounds/SoundPoolPlayer). Until it does,
 * each Likely cue falls back to the nearest platform cue; platform cue ids map to themselves.
 */
object LikelySounds {
    fun platformCue(id: String): Cue? = Cue.entries.firstOrNull { it.id == id } ?: when (id) {
        "likely.deal" -> Cue.FLIP
        "likely.tok" -> Cue.CHIP_LAND
        "likely.spot" -> Cue.STAMP
        "likely.rosette" -> Cue.REACTION_POP
        "likely.confetti" -> Cue.CUP_STAR
        "likely.scramble" -> Cue.LEAVE
        "likely.ballot" -> Cue.VOTE_CAST
        "likely.puff" -> Cue.REACTION_POP
        "likely.glint" -> Cue.CUP_STAR
        else -> null
    }
}

/**
 * Whether the card phrase fits the 700 × 236-unit card (LK-TV-01) at a type tier, estimated with Cairo's average glyph
 * advance. The tiers are displayS, headline, title, titleS of `jamaaTypeScale` (DESIGN §3.2; the sizes below mirror it,
 * since the theme is Compose code). The card picks the web `cardSize` tier first and steps down while the estimate says
 * the phrase would not fit; at run time a tier that still overflows its box steps down once more, so the phrase is
 * never ellipsized.
 */
object LikelyCardFit {
    const val CARD_W = LikelyLayout.CARD_WIDTH
    const val CARD_H = LikelyLayout.CARD_HEIGHT
    const val PAD_X = 32.0
    const val PAD_Y = 18.0
    const val GAP_LEAD = 8.0
    const val GAP_AWARD = 10.0
    const val AWARD_ICON = 22.0

    /** Stage unit → dp on a 960 × 540 dp TV (the 864 × 442 stage fills the safe area under the 44 dp header). */
    const val UNIT_DP = 1.0

    /** (font size, line height) in sp of displayS, headline, title, titleS: Latin and Arabic scales. */
    val LATIN = listOf(44 to 52, 34 to 42, 26 to 32, 22 to 28)
    val ARABIC = listOf(44 to 64, 34 to 52, 26 to 40, 22 to 34)

    /** Line heights of the lead-in (title on tier 0, titleS below) and of the award line (label). */
    private fun leadLh(tier: Int, arabic: Boolean) = if (tier == 0) (if (arabic) 40 else 32) else (if (arabic) 34 else 28)
    private fun awardLh(arabic: Boolean) = if (arabic) 30 else 24

    /** Average advance in em of a Cairo glyph: Latin Bold, Arabic (connected, narrower). Conservative. */
    const val EM_LATIN = 0.54
    const val EM_ARABIC = 0.47

    fun isArabicScript(text: String): Boolean = text.any { java.lang.Character.UnicodeBlock.of(it) == java.lang.Character.UnicodeBlock.ARABIC }

    /** Greedy word wrap of [text] at [sp] in a box [widthDp] wide: the line count. */
    fun lines(text: String, sp: Int, widthDp: Double, em: Double): Int {
        val perChar = sp * em
        var lines = 1
        var used = 0.0
        for (w in text.split(' ').filter { it.isNotEmpty() }) {
            val ww = LikelyStage.graphemes(w) * perChar
            val need = if (used == 0.0) ww else used + perChar + ww
            if (need <= widthDp || used == 0.0) {
                used = need
                // A single word wider than the box wraps by characters.
                while (used > widthDp) { lines++; used -= widthDp }
            } else {
                lines++
                used = ww
                while (used > widthDp) { lines++; used -= widthDp }
            }
        }
        return lines
    }

    /** Height left for the phrase at [tier], in dp. */
    fun phraseBox(tier: Int, arabicScale: Boolean): Double =
        (CARD_H - 2 * PAD_Y) * UNIT_DP - leadLh(tier, arabicScale) - (GAP_LEAD + GAP_AWARD) * UNIT_DP - maxOf(AWARD_ICON * UNIT_DP, awardLh(arabicScale).toDouble())

    fun fits(phrase: String, tier: Int, arabicScale: Boolean): Boolean {
        val (sp, lh) = (if (arabicScale) ARABIC else LATIN)[tier]
        val em = if (isArabicScript(phrase)) EM_ARABIC else EM_LATIN
        val n = lines(phrase, sp, (CARD_W - 2 * PAD_X) * UNIT_DP, em)
        return n * lh <= phraseBox(tier, arabicScale)
    }

    /** The tier for [prompt] shown with the locale's [closing] mark: the web tier, stepped down until it fits. */
    fun tier(prompt: String, closing: String, arabicScale: Boolean): Int {
        val phrase = prompt + closing
        var t = LikelyStage.cardTier(prompt)
        while (t < LATIN.lastIndex && !fits(phrase, t, arabicScale)) t++
        return t
    }
}

