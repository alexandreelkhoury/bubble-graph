package app.jamaa.tv.games.likely

import app.jamaa.tv.game.Cue
import app.jamaa.tv.platform.Expression
import kotlin.math.sign

// The pure rules of the Likely TV screens (JVM-tested): who stands where on the jury arc, the reveal plan (conga
// runners, ballot envelopes, counters, coins, the percentage board), the character expressions (public data only,
// DESIGN-JAMAA §4.3 secrecy rule), the awards pages, the Mind Reader ranking, and small text helpers.
//
// Secrecy: everything here is computed from the TV's own projection. In secret-vote mode the plan reads only the
// per-card tallies (`counts`, `topIds`, `unanimous`), so two games with identical tallies draw identical frames.

/** A traveller of the public reveal: a voter's character running to stand behind its pick. */
data class LikelyRunner(val voterId: String, val targetId: String, val from: LikelyPt, val to: LikelyPt, val index: Int, val self: Boolean)

/** Secret votes: one identical cream envelope per vote, in tally order (never by voter). */
data class LikelyEnvelope(val targetId: String, val index: Int, val to: LikelyPt)

/** The counter bubble above a voted target. */
data class LikelyCounter(val targetId: String, val at: LikelyPt, val count: Int, val percent: Int)

/** Public mode: an agreement coin from the head of the voter's line (its pick) to the voter's own character. */
data class LikelyCoin(val voterId: String, val from: LikelyPt, val to: LikelyPt, val points: Int, val index: Int)

/** One line of the secret-vote percentage board ("50% voted for Alex"), largest first. */
data class LikelyBoardLine(val playerId: String, val percent: Int, val count: Int)

data class LikelyRevealPlan(
    val kind: LikelyChoreo.RevealKind,
    /** Where every jury member stands before the reveal (seat order on the arc). */
    val seats: Map<String, LikelyPt>,
    val runners: List<LikelyRunner>,
    val envelopes: List<LikelyEnvelope>,
    val counters: List<LikelyCounter>,
    val topIds: List<String>,
    /** Public mode: voters who picked themselves (they stay in place, `pointSelf`). */
    val selfVoterIds: Set<String>,
    val coins: List<LikelyCoin>,
    val board: List<LikelyBoardLine>,
    /** "{name}, defend yourself!": the first top target (a single winner only; ties say "It's a tie"). */
    val defendId: String?,
    val againId: String?,
    val unanimous: Boolean,
    val timeline: LikelyTimeline,
) {
    /** Where [id] stands at the end of the run (its conga place, or its seat). */
    fun endOf(id: String): LikelyPt? = runners.firstOrNull { it.voterId == id }?.to ?: seats[id]
}

/** One player's award as AWARDS and RESULTS show it. Extras (Tonight's Star, Self-aware) ride on the holder's card. */
data class LikelyAwardEntry(val playerId: String, val kind: LikelyAwardKind, val card: LikelyAwardCard?, val extras: List<LikelyAward>, val left: Boolean)

sealed interface LikelyAwardsPage {
    data object Intro : LikelyAwardsPage
    data class Trio(val entries: List<LikelyAwardEntry>) : LikelyAwardsPage
    data class MindReader(val award: LikelyAward, val podium: List<LikelyRankRow>) : LikelyAwardsPage
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

/** A Mind Reader ranking row: competition ranking (ties share a rank). */
data class LikelyRankRow(val playerId: String, val rank: Int, val score: Int)

object LikelyStage {
    const val CHAR = LikelyLayout.CHAR_SIZE

    /** The jury arc in seat order (RTL: seat 0 on the right). */
    fun seats(view: LikelyView, rtl: Boolean): Map<String, LikelyPt> {
        val jury = view.jury
        val arc = LikelyLayout.juryArc(jury.size, rtl)
        return jury.indices.associate { jury[it].id to arc[it] }
    }

    /** The head of a character standing at [feet] (its top centre). */
    fun head(feet: LikelyPt): LikelyPt = LikelyPt(feet.x, feet.y - CHAR)

    /** The counter bubble sits 30 dp over the head. */
    fun counterAt(feet: LikelyPt): LikelyPt = LikelyPt(feet.x, feet.y - CHAR - 30)

    /** Envelopes pile in rows of three over the target's head, deterministic by tally index. */
    fun envelopeAt(target: LikelyPt, k: Int): LikelyPt = LikelyPt(target.x + ((k % 3) - 1) * 16.0, target.y - CHAR - 12 - 10.0 * (k / 3))

    fun revealPlan(view: LikelyView, rtl: Boolean): LikelyRevealPlan? {
        val r = view.reveal ?: return null
        val seats = seats(view, rtl)
        val anonymous = view.anonymous
        val kind = LikelyChoreo.revealKind(r, anonymous)
        val counters = r.counts.mapNotNull { c -> seats[c.playerId]?.let { LikelyCounter(c.playerId, counterAt(it), c.count, c.percent) } }

        // Public: ballots in the order the view sends them (voter seat order). Secret: never read, even if present.
        // Public mode only (a chaos card in public mode still shows who ran to whom, like the browser TV).
        val publicMode = !anonymous && r.ballots != null
        val ballots = if (publicMode && (kind == LikelyChoreo.RevealKind.PUBLIC || kind == LikelyChoreo.RevealKind.CHAOS)) r.ballots.orEmpty() else emptyList()
        val ids = seats.keys.toList()
        val arc = ids.map { seats.getValue(it) }
        val ends = LikelyLayout.revealPositions(arc, ids, ballots)
        val runners = mutableListOf<LikelyRunner>()
        val selfVoters = mutableSetOf<String>()
        run {
            for (b in ballots) {
                val from = seats[b.voterId] ?: continue
                val to = ends[b.voterId] ?: continue
                if (b.voterId == b.targetId) {
                    selfVoters += b.voterId
                    continue
                }
                runners += LikelyRunner(b.voterId, b.targetId, from, to, runners.size, false)
            }
        }
        val envelopes = mutableListOf<LikelyEnvelope>()
        if (kind == LikelyChoreo.RevealKind.SECRET) {
            for (c in r.counts) {
                val t = seats[c.playerId] ?: continue
                for (k in 0 until c.count) envelopes += LikelyEnvelope(c.playerId, envelopes.size, envelopeAt(t, k))
            }
        }

        // Coins: one per scoring voter, carrying its card total (agree + unanimous + self-aware), in ballot order.
        val coins = mutableListOf<LikelyCoin>()
        if (kind == LikelyChoreo.RevealKind.PUBLIC) {
            val points = LinkedHashMap<String, Int>()
            for (d in r.deltas) points[d.playerId] = (points[d.playerId] ?: 0) + d.points
            for (b in ballots) {
                val p = points[b.voterId] ?: continue
                if (p <= 0) continue
                val target = seats[b.targetId] ?: continue
                val me = ends[b.voterId] ?: seats[b.voterId] ?: continue
                coins += LikelyCoin(b.voterId, head(target), head(me), p, coins.size)
            }
        }
        val board = if (!publicMode && kind != LikelyChoreo.RevealKind.NONE) boardLines(r, view) else emptyList()
        val tops = r.topIds.filter { it in seats }
        val shape = LikelyChoreo.RevealShape(
            runners = runners.size, envelopes = envelopes.size, publicMode = publicMode, chaos = r.chaos, none = kind == LikelyChoreo.RevealKind.NONE,
            unanimous = r.unanimous, coins = coins.size,
        )
        val timeline = LikelyChoreo.reveal(r, shape)
        return LikelyRevealPlan(
            kind = kind,
            seats = seats,
            runners = runners,
            envelopes = envelopes,
            counters = counters,
            topIds = tops,
            selfVoterIds = selfVoters,
            coins = coins,
            board = board,
            defendId = tops.singleOrNull()?.takeIf { kind == LikelyChoreo.RevealKind.PUBLIC || kind == LikelyChoreo.RevealKind.SECRET },
            againId = r.againId?.takeIf { it in seats },
            unanimous = r.unanimous,
            timeline = timeline,
        )
    }

    /** Percent descending, then seat order (§5.1); the server already sends this order, it is re-applied defensively. */
    fun boardLines(r: LikelyReveal, view: LikelyView): List<LikelyBoardLine> {
        val seat = view.players.associate { it.id to it.seat }
        return r.counts
            .sortedWith(compareByDescending<LikelyCount> { it.percent }.thenBy { seat[it.playerId] ?: Int.MAX_VALUE })
            .map { LikelyBoardLine(it.playerId, it.percent, it.count) }
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
                    tMs < s.startMs -> Expression.IDLE
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
                val coin = plan.coins.firstOrNull { it.voterId == id }
                val coinsAt = tl.step("coin")
                if (coin != null && coinsAt != null && tMs >= coinsAt.startMs + coinsAt.staggerMs * coin.index + coinsAt.durationMs) {
                    return if (plan.unanimous) Expression.CHEER else Expression.HAPPY
                }
                val runStart = tl.step("run")?.startMs ?: 0
                if (id in plan.selfVoterIds && tMs >= runStart) return Expression.SMUG
                if (plan.runners.any { it.voterId == id } && tMs >= runStart) return Expression.POINT
                return Expression.IDLE
            }
        }
    }

    /** Before the reveal: the named player (Spicy) steps forward `shy`; everyone else idles (`done` comes from doneIds). */
    fun cardExpression(view: LikelyView, id: String): Expression =
        if (view.card?.namedPlayerId == id) Expression.SHY else Expression.IDLE

    // ---------------------------------------------------------------- awards (§6.2, §12.4)

    /** Every holder's award (signature or mystery), in the server's order, with their extras attached. */
    fun awardEntries(view: LikelyView): List<LikelyAwardEntry> {
        val left = view.players.filter { it.left }.map { it.id }.toSet()
        val extras = view.awards.filter { it.kind == LikelyAwardKind.STAR || it.kind == LikelyAwardKind.SELF_AWARE }
        return view.awards
            .filter { it.kind == LikelyAwardKind.SIGNATURE || it.kind == LikelyAwardKind.MYSTERY }
            .flatMap { a -> a.playerIds.map { id -> LikelyAwardEntry(id, a.kind, a.card, extras.filter { id in it.playerIds }, id in left) } }
    }

    /** Competition ranking by score, then seat (Mind Reader, public mode). Empty in secret-vote mode (no points). */
    fun ranking(view: LikelyView): List<LikelyRankRow> {
        if (view.anonymous) return emptyList()
        val sorted = view.players.sortedWith(compareByDescending<LikelyPlayer> { it.score }.thenBy { it.seat })
        return sorted.map { p -> LikelyRankRow(p.id, 1 + sorted.count { it.score > p.score }, p.score) }
    }

    /**
     * The AWARDS pages on the server's clock: a 3 s intro, a 4 s page per trio of holders, then (public mode, when the
     * server sent one) the 4 s Mind Reader podium. The total equals the server's `likelyAwardsMs`.
     */
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
        val mind = view.awards.firstOrNull { it.kind == LikelyAwardKind.MIND_READER }
        if (!view.anonymous && mind != null) {
            pages += LikelyAwardsPage.MindReader(mind, ranking(view).take(3))
            starts += t
            t += LikelyTiming.AWARDS_MIND_READER_MS
        }
        return LikelyAwardsPlan(pages, starts, t)
    }

    // ---------------------------------------------------------------- text helpers

    /** "50%" (en, ar: Western digits), "50 %" with a narrow no-break space (fr), "50 %" with a no-break space (es). */
    fun percentText(percent: Int, uiLanguage: String): String = when (uiLanguage) {
        "fr" -> "$percent\u202F%"
        "es" -> "$percent\u00A0%"
        else -> "$percent%"
    }

    /** The named player's name inside the resolved prompt (Spicy, §8.2), to set it in their colour; null if absent. */
    fun namedSpan(prompt: String, name: String?): IntRange? {
        if (name.isNullOrEmpty()) return null
        val i = prompt.indexOf(name)
        return if (i < 0) null else i until i + name.length
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
