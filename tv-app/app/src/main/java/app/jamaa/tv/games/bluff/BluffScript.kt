package app.jamaa.tv.games.bluff

import app.jamaa.tv.motion.Choreo
import app.jamaa.tv.motion.ChoreoSampler
import app.jamaa.tv.platform.Expression
import kotlin.math.ceil
import kotlin.math.roundToLong

// The Bluff reveal (GAME-BLUFF §12.2 / §12.2.1, DESIGN-JAMAA §5.2) as a pure, deterministic timeline built from the
// server's `reveal` snapshot (JVM-tested against lane A's fixtures and engine-built reveals). The TV plays it locally:
// the server never waits (its REVEAL deadline is `reveal.durationMs`, which this script's total equals in full motion),
// OK completes it to its end state, and reduced motion plays the same order in half the time with fades only.
// Every sub-step is a choreography step sampled by the shared sampler (motion/Choreo.kt), so the curves are the ones
// the browser TV runs. Coins carry the points: a score pill only moves when a coin lands.

enum class SegmentKind { INTRO, QUICK, LIE, HOUSE, TRUTH, FINAL_ANSWER, CROWN, TWIST, NOBODY, LIKES }

/** Where a coin (or a heart) leaves from. */
sealed interface CoinSource {
    /** A voter's character sitting on the card (rounds 1–2: one coin per fooled player, DESIGN-JAMAA §5.2). */
    data class Voter(val playerId: String) : CoinSource
    /** The card itself (truth coins spring from the gold card to each finder). */
    data class Card(val optionId: String) : CoinSource
    /** The neutral ballot box (final: ballots stay anonymous, GAME-BLUFF §6.5). */
    data object BallotBox : CoinSource
    /** A liker's character (likes tally: hearts). */
    data class Liker(val playerId: String) : CoinSource
}

/**
 * One flying coin (or heart). [amount] is what the target pill gains when it lands; the amounts of an award's coins add
 * up exactly to the server's delta. [label] rides with the first coin of an award only ("+120").
 */
data class Coin(
    val segment: Int,
    val from: CoinSource,
    val toPlayerId: String,
    val launchAtMs: Long,
    val landAtMs: Long,
    val amount: Int,
    val label: Int?,
    val heart: Boolean,
)

/** A timed sub-step of a segment ([step] times are relative to the segment start; sampled by the shared sampler). */
data class SubStep(val step: Choreo.Step) {
    val id: String get() = step.id
    fun progress(localMs: Long, index: Int = 0): Float = ChoreoSampler.sample(step, localMs.toDouble(), index).toFloat()
    val endMs: Long get() = (step.startMs + step.durationMs).toLong()
    fun endFor(elements: Int): Long = (step.startMs + step.staggerMs * maxOf(0, elements - 1) + step.durationMs).toLong()
}

data class Segment(
    val index: Int,
    val kind: SegmentKind,
    val startMs: Long,
    val durationMs: Long,
    /** The option this segment reveals (null for intro, crown, twist, nobody, likes). */
    val step: RevealStep?,
    val subs: List<SubStep>,
) {
    val endMs: Long get() = startMs + durationMs
    fun sub(id: String): SubStep? = subs.firstOrNull { it.id == id }

    /** Progress of sub-step [id] at the absolute time [tMs]; a sub-step this variant does not have is done (1). */
    fun p(id: String, tMs: Long, index: Int = 0): Float = sub(id)?.progress(tMs - startMs, index) ?: 1f
}

class BluffScript private constructor(
    val reveal: BluffReveal,
    val reduced: Boolean,
    val segments: List<Segment>,
    val coins: List<Coin>,
    /** Pill value before any coin lands: score at the start of the prompt + Spot-on points (already paid at VOTING). */
    val base: Map<String, Int>,
    private val unassigned: Map<String, Int>,
) {
    val totalMs: Long get() = segments.lastOrNull()?.endMs ?: 0L

    /** The segment playing at [tMs] (the last one once the script ended, the first one before it starts). */
    fun segmentAt(tMs: Long): Segment? = when {
        segments.isEmpty() -> null
        tMs >= totalMs -> segments.last()
        else -> segments.lastOrNull { tMs >= it.startMs } ?: segments.first()
    }

    /** True while OK should complete the reveal (§3.10 E): before the script's end. */
    fun running(tMs: Long): Boolean = tMs < totalMs

    /**
     * A score pill at [tMs]: [base] plus every landed coin, each counted up over the platform counter step (600 ms,
     * `ease.decel`; integer display). Reduced motion: values jump on landing. At [totalMs] it equals the server score.
     */
    fun pillValue(playerId: String, tMs: Long): Int {
        var v = (base[playerId] ?: 0).toDouble()
        for (c in coins) {
            if (c.toPlayerId != playerId || tMs < c.landAtMs) continue
            v += c.amount * if (reduced) 1.0 else ChoreoSampler.sample(COUNTER, (tMs - c.landAtMs).toDouble())
        }
        if (tMs >= totalMs) v += unassigned[playerId] ?: 0
        return v.roundToLong().toInt()
    }

    /** The pill pops (scale 1.15, `ease.overshoot`, 160 ms) for each landing: the strongest pop running at [tMs]. */
    fun pillPop(playerId: String, tMs: Long): Float {
        if (reduced) return 0f
        var best = 0f
        for (c in coins) {
            if (c.toPlayerId != playerId) continue
            val d = tMs - c.landAtMs
            if (d < 0 || d >= POP_MS) continue
            val p = ChoreoSampler.sample(POP, d.toDouble()).toFloat()
            best = maxOf(best, if (p < 1f) p else 0f)
        }
        return best
    }

    /** Coins in the air at [tMs] (≤ [MAX_SPRITES] by construction). */
    fun coinsInFlight(tMs: Long): List<Coin> = coins.filter { tMs >= it.launchAtMs && tMs < it.landAtMs }

    /** Flight progress of [coin] at [tMs] along its Bézier (0 → 1, `ease.coin`). */
    fun coinProgress(coin: Coin, tMs: Long): Float =
        if (reduced) 1f else ChoreoSampler.cubicBezier(0.4, -0.15, 0.2, 1.0, (tMs - coin.launchAtMs).toDouble() / (coin.landAtMs - coin.launchAtMs)).toFloat()

    /** The options already stamped at [tMs] (their segment's stamp landed), in reveal order. */
    fun stamped(tMs: Long): List<RevealStep> = segments
        .filter { s -> s.step != null && tMs >= s.startMs + ((s.sub("stamp") ?: s.sub("liar"))?.endMs ?: 0L) }
        .mapNotNull { it.step }

    /**
     * The event expression a player's character holds at [tMs] (null = the default, idle). Public by construction:
     * the script exists only in REVEAL, after every secret is out (DESIGN-JAMAA §4.3 secrecy rule).
     */
    fun expressionOf(playerId: String, tMs: Long): Expression? {
        val seg = segmentAt(tMs) ?: return null
        val local = tMs - seg.startMs
        val st = seg.step
        fun after(id: String) = local >= (seg.sub(id)?.step?.startMs?.toLong() ?: 0L)
        return when (seg.kind) {
            SegmentKind.LIE, SegmentKind.QUICK, SegmentKind.HOUSE -> when {
                st == null -> null
                playerId in st.authorIds && after(if (seg.kind == SegmentKind.QUICK) "stamp" else "liar") -> Expression.SMUG
                playerId in st.voterIds && after("stamp") -> if (seg.kind == SegmentKind.HOUSE) Expression.SHOCK else Expression.FACEPALM
                playerId in st.voterIds -> Expression.THINK
                else -> null
            }
            SegmentKind.TRUTH -> when {
                st == null -> null
                !after("stamp") -> if (playerId in st.voterIds || playerId in st.spotOnIds) Expression.THINK else null
                playerId in st.spotOnIds -> Expression.HAPPY
                playerId in st.foundEarlyIds -> Expression.HAPPY
                playerId in st.voterIds -> Expression.CHEER
                nobodyFound -> Expression.SHOCK // "Nobody saw that coming!": every character
                playerId in votersOfAnything -> Expression.SAD
                else -> null
            }
            SegmentKind.FINAL_ANSWER -> if (st != null && playerId in st.authorIds && after("liar")) Expression.SMUG else null
            SegmentKind.CROWN -> if (playerId in topAuthors && after("crown")) Expression.CHEER else null
            SegmentKind.TWIST -> Expression.LAUGH
            SegmentKind.NOBODY -> if (playerId in unpickedAuthors) Expression.SAD else null
            SegmentKind.LIKES -> if (coins.any { it.segment == seg.index && it.toPlayerId == playerId && tMs >= it.landAtMs }) Expression.HAPPY else null
            SegmentKind.INTRO -> null
        }
    }

    private val votersOfAnything: Set<String> = reveal.steps.flatMap { it.voterIds }.toSet()
    private val topAuthors: Set<String> = reveal.steps.filter { it.top }.flatMap { it.authorIds }.toSet()
    private val unpickedAuthors: Set<String> = reveal.unpicked.flatMap { it.authorIds }.toSet()


    /** "Nobody saw that coming!" (GAME-BLUFF §7): votes were cast and none found the truth (every character shocked). */
    val nobodyFound: Boolean = !reveal.final && votersOfAnything.isNotEmpty() &&
        reveal.steps.any { it.kind == OptionKind.TRUTH && it.voteCount == 0 }

    /** "Too easy!" (GAME-BLUFF §7): every vote went to the truth. */
    val tooEasy: Boolean = !reveal.final && reveal.steps.isNotEmpty() && reveal.steps.all { it.kind == OptionKind.TRUTH } &&
        reveal.steps.any { it.voteCount > 0 }

    companion object {
        const val MAX_SPRITES = 24
        const val POP_MS = 160L
        const val REDUCED_FACTOR = 0.5

        // §12.2 budgets (ms), the formula of shared revealDurationMs.
        const val INTRO_MS = 1_500L
        const val QUICK_MS = 1_200L
        const val LIE_BASE_MS = 3_500L
        const val LIE_PER_VOTER_MS = 120L
        const val TRUTH_MS = 4_500L
        const val NOBODY_MS = 2_500L
        const val LIKES_MS = 1_500L
        const val FINAL_ANSWER_MS = 2_800L
        const val CROWN_MS = 3_000L
        const val TWIST_MS = 2_000L

        /** A segment's natural sub-timeline may not run into its last [HOLD_MS] (the beat before the next card). */
        const val HOLD_MS = 250L

        private val COUNTER = Choreo.moments.getValue("points").first { it.id == "counter" }.copy(startMs = 0)
        private val POP = Choreo.moments.getValue("points").first { it.id == "badgePop" }.copy(startMs = 0)

        private fun step(id: String, start: Long, duration: Long, easing: String, stagger: Long = 0) =
            Choreo.Step(id, start.toInt(), duration.toInt(), easing, stagger.toInt(), Choreo.Reduced.FADE, Choreo.Lite.KEEP)

        /** The natural (full-motion) budget of the script for [r]: equals the server's `revealDurationMs`. */
        fun naturalDurationMs(r: BluffReveal): Long = segmentsSpec(r).sumOf { it.second }

        /** (kind, duration, step) in play order. */
        private fun segmentsSpec(r: BluffReveal): List<Triple<SegmentKind, Long, RevealStep?>> = buildList {
            add(Triple(SegmentKind.INTRO, INTRO_MS, null))
            if (r.final) {
                for (st in r.steps) add(Triple(SegmentKind.FINAL_ANSWER, FINAL_ANSWER_MS, st))
                add(Triple(SegmentKind.CROWN, CROWN_MS, null))
                add(Triple(SegmentKind.TWIST, TWIST_MS, null))
            } else {
                for (st in r.steps) {
                    when {
                        st.kind == OptionKind.TRUTH -> Unit
                        st.quick -> add(Triple(SegmentKind.QUICK, QUICK_MS, st))
                        else -> add(Triple(if (st.kind == OptionKind.HOUSE) SegmentKind.HOUSE else SegmentKind.LIE, LIE_BASE_MS + LIE_PER_VOTER_MS * st.voteCount, st))
                    }
                }
                add(Triple(SegmentKind.TRUTH, TRUTH_MS, r.steps.lastOrNull { it.kind == OptionKind.TRUTH }))
            }
            if (r.unpicked.isNotEmpty()) add(Triple(SegmentKind.NOBODY, NOBODY_MS, null))
            if (r.steps.any { it.likerIds.isNotEmpty() } || r.unpicked.any { it.likerIds.isNotEmpty() }) add(Triple(SegmentKind.LIKES, LIKES_MS, null))
        }

        /** Staggered element counts of a segment's sub-steps (voters, envelopes, pins, coins, cards, hearts). */
        private fun elementsOf(kind: SegmentKind, st: RevealStep?, r: BluffReveal): Map<String, Int> {
            val v = st?.voteCount ?: 0
            return when (kind) {
                SegmentKind.LIE, SegmentKind.HOUSE, SegmentKind.QUICK -> mapOf("jump" to v, "coins" to lieCoinCount(st))
                SegmentKind.TRUTH -> mapOf(
                    "jump" to v, "pins" to (st?.spotOnIds?.size ?: 0),
                    "coins" to (st?.deltas?.count { it.reason == DeltaReason.TRUTH } ?: 0),
                )
                SegmentKind.FINAL_ANSWER -> mapOf("envelopes" to minOf(v, 12), "coins" to finalCoinCount(st))
                SegmentKind.CROWN -> mapOf("coins" to r.steps.sumOf { s -> s.deltas.count { it.reason == DeltaReason.CONVINCING } })
                SegmentKind.TWIST -> mapOf("flip" to r.steps.size + r.unpicked.size)
                SegmentKind.LIKES -> mapOf("hearts" to heartCount(r))
                else -> emptyMap()
            }
        }

        /** Coins per author of a lie: one per fooled voter, capped so all authors' coins stay ≤ [MAX_SPRITES]. */
        private fun lieCoinCount(st: RevealStep?): Int {
            if (st == null) return 0
            val authors = st.authorIds.size.coerceAtLeast(1)
            return minOf(st.voterIds.size.coerceAtLeast(1), MAX_SPRITES / authors)
        }

        private fun finalCoinCount(st: RevealStep?): Int {
            if (st == null) return 0
            val authors = st.authorIds.size.coerceAtLeast(1)
            return minOf(st.voteCount, MAX_SPRITES / authors).coerceAtLeast(1)
        }

        private fun likeDeltas(r: BluffReveal): List<Pair<List<String>, BluffDelta>> =
            r.steps.flatMap { st -> st.deltas.filter { it.reason == DeltaReason.LIKE }.map { st.likerIds to it } } +
                r.unpicked.flatMap { u -> u.deltas.filter { it.reason == DeltaReason.LIKE }.map { u.likerIds to it } }

        private fun heartCount(r: BluffReveal): Int {
            val hearts = likeDeltas(r).sumOf { it.first.size.coerceAtLeast(1) }
            return if (hearts > MAX_SPRITES) likeDeltas(r).size else hearts
        }

        /** The sub-steps of one segment (relative times), fitted inside `duration − HOLD_MS`. */
        private fun subsFor(kind: SegmentKind, duration: Long, st: RevealStep?, r: BluffReveal, reduced: Boolean): List<Choreo.Step> {
            val v = st?.voteCount ?: 0
            val natural: List<Choreo.Step> = when (kind) {
                SegmentKind.INTRO -> listOf(step("dim", 0, 600, "ease.decel"), step("title", 300, 400, "ease.overshoot"))
                SegmentKind.QUICK -> listOf(step("spotlight", 0, 200, "ease.standard"), step("jump", 100, 200, "ease.standard"), step("stamp", 250, 300, "ease.overshoot"), step("liar", 450, 300, "ease.overshoot"), step("coins", 600, 450, "ease.coin"))
                SegmentKind.LIE, SegmentKind.HOUSE -> {
                    val jumpEnd = 400 + 120L * maxOf(0, v - 1) + 360
                    listOf(
                        step("spotlight", 0, 400, "ease.decel"),
                        step("jump", 400, 360, "spring.bouncy", 120),
                        step("drumroll", jumpEnd, 600, "linear"),
                        step("stamp", jumpEnd + 600, 400, "ease.overshoot"),
                        step("liar", jumpEnd + 1_000, 500, "spring.bouncy"),
                        step("coins", jumpEnd + 1_500, 450, "ease.coin", 80),
                    )
                }
                SegmentKind.TRUTH -> {
                    val pins = st?.spotOnIds?.size ?: 0
                    val pinsEnd = 1_600L + if (pins > 0) 120L * (pins - 1) + 360 else 0
                    listOf(
                        step("spotlight", 0, 400, "ease.decel"),
                        step("gold", 400, 500, "ease.standard"),
                        step("sweep", 700, 500, "linear"),
                        step("stamp", 1_200, 400, "ease.overshoot"),
                        step("pins", 1_600, 360, "spring.bouncy", 120),
                        step("jump", pinsEnd, 360, "spring.bouncy", 120),
                        step("confetti", 1_600, 1_200, "linear"),
                        step("coins", pinsEnd + 120L * maxOf(0, v - 1) + 360, 450, "ease.coin", 70),
                        step("note", 2_900, 400, "ease.decel"),
                    )
                }
                SegmentKind.FINAL_ANSWER -> {
                    val envEnd = 400 + 100L * maxOf(0, minOf(v, 12) - 1) + 300
                    listOf(
                        step("spotlight", 0, 400, "ease.decel"),
                        step("envelopes", 400, 300, "ease.decel", 100),
                        step("liar", envEnd, 500, "spring.bouncy"),
                        step("coins", envEnd + 500, 450, "ease.coin", 70),
                    )
                }
                SegmentKind.CROWN -> listOf(
                    step("grow", 0, 500, "ease.decel"),
                    step("stamp", 500, 400, "ease.overshoot"),
                    step("crown", 900, 260, "spring.hop"),
                    step("coins", 1_200, 450, "ease.coin", 70),
                    step("confetti", 1_200, 1_200, "linear"),
                )
                SegmentKind.TWIST -> {
                    val cards = r.steps.size + r.unpicked.size
                    val flipEnd = 40L * maxOf(0, cards - 1) + 500
                    listOf(step("flip", 0, 500, "ease.standard", 40), step("stamp", flipEnd, 400, "ease.overshoot"))
                }
                SegmentKind.NOBODY -> listOf(step("fan", 0, 600, "ease.decel"), step("fall", 1_700, 700, "ease.accel"))
                SegmentKind.LIKES -> listOf(step("hearts", 0, 600, "ease.decel", 60))
            }
            val limit = duration - HOLD_MS
            if (reduced) {
                // Calm motion: the same beats, as 200 ms fades at proportional times (DESIGN-JAMAA §5.2 "Reduced").
                val nat = natural.maxOf { it.startMs + it.durationMs }.coerceAtLeast(1)
                val f = minOf(1.0, (limit - 200).toDouble() / nat)
                return natural.map { s ->
                    s.copy(startMs = (s.startMs * f).toInt(), durationMs = 200, easing = "ease.standard", staggerMs = (s.staggerMs * f).toInt(), reduced = Choreo.Reduced.FADE)
                }
            }
            val counts = elementsOf(kind, st, r)
            val elements = { s: Choreo.Step -> counts[s.id] ?: 1 }
            val end = natural.maxOf { it.startMs + it.staggerMs * maxOf(0, elements(it) - 1) + it.durationMs }
            if (end <= limit) return natural
            // Big groups: compress start times and staggers (never a spring's settle time) to fit the server budget.
            val f = limit.toDouble() / end
            return natural.map { s ->
                val d = if (s.easing.startsWith("spring")) s.durationMs else maxOf(120, (s.durationMs * f).toInt())
                s.copy(startMs = (s.startMs * f).toInt(), staggerMs = (s.staggerMs * f).toInt(), durationMs = d)
            }.map { s -> // a kept spring may still overrun by a few ms: pull its start back inside the limit
                val over = s.startMs + s.staggerMs * maxOf(0, elements(s) - 1) + s.durationMs - limit
                if (over > 0) s.copy(startMs = maxOf(0, (s.startMs - over).toInt())) else s
            }
        }

        fun build(r: BluffReveal, scores: List<BluffScore>, reduced: Boolean): BluffScript {
            val spec = segmentsSpec(r)
            val scale = if (reduced) REDUCED_FACTOR else 1.0
            val segments = ArrayList<Segment>(spec.size)
            var t = 0L
            for ((i, s) in spec.withIndex()) {
                val (kind, natural, st) = s
                val d = ceil(natural * scale).toLong()
                segments += Segment(i, kind, t, d, st, subsFor(kind, d, st, r, reduced).map(::SubStep))
                t += d
            }

            val coins = ArrayList<Coin>()
            val assigned = HashMap<String, Int>()
            fun coinsFor(seg: Segment, subId: String, from: (Int) -> CoinSource, count: Int, to: String, total: Int, heart: Boolean = false, offset: Int = 0) {
                if (total <= 0 || count <= 0) return
                val sub = seg.sub(subId) ?: return
                for (k in 0 until count) {
                    val launch = seg.startMs + sub.step.startMs + sub.step.staggerMs.toLong() * (offset + k)
                    val land = launch + sub.step.durationMs
                    val amount = total * (k + 1) / count - total * k / count
                    coins += Coin(seg.index, from(k), to, launch, land, amount, if (k == 0) total else null, heart)
                }
                assigned[to] = (assigned[to] ?: 0) + total
            }

            for (seg in segments) {
                val st = seg.step
                when (seg.kind) {
                    SegmentKind.LIE, SegmentKind.QUICK, SegmentKind.HOUSE -> if (st != null) {
                        for (d in st.deltas) when (d.reason) {
                            DeltaReason.FOOLED -> {
                                val voters = st.voterIds
                                if (voters.isEmpty()) coinsFor(seg, "coins", { CoinSource.Card(st.optionId) }, 1, d.playerId, d.points)
                                else coinsFor(seg, "coins", { k -> CoinSource.Voter(voters[k % voters.size]) }, lieCoinCount(st), d.playerId, d.points)
                            }
                            DeltaReason.LIKE -> Unit // the likes tally
                            else -> Unit
                        }
                    }
                    SegmentKind.TRUTH -> if (st != null) {
                        for ((k, d) in st.deltas.withIndex()) when (d.reason) {
                            DeltaReason.TRUTH -> coinsFor(seg, "coins", { CoinSource.Card(st.optionId) }, 1, d.playerId, d.points, offset = k)
                            DeltaReason.LIKE -> Unit // the likes tally
                            else -> Unit
                        }
                    }
                    SegmentKind.FINAL_ANSWER -> if (st != null) {
                        for (d in st.deltas) when (d.reason) {
                            // One coin per vote from the ballot box, shared by co-authors; ≤ 24 sprites.
                            DeltaReason.FOOLED -> coinsFor(seg, "coins", { CoinSource.BallotBox }, finalCoinCount(st), d.playerId, d.points)
                            DeltaReason.LIKE -> Unit // the likes tally
                            else -> Unit
                        }
                    }
                    else -> Unit
                }
            }
            segments.firstOrNull { it.kind == SegmentKind.CROWN }?.let { crown ->
                var k = 0
                for (st in r.steps) for (d in st.deltas) if (d.reason == DeltaReason.CONVINCING) {
                    coinsFor(crown, "coins", { CoinSource.Card(st.optionId) }, 1, d.playerId, d.points, offset = k++)
                }
            }
            segments.firstOrNull { it.kind == SegmentKind.LIKES }?.let { likes ->
                var offset = 0
                val all = likeDeltas(r)
                val bundle = all.sumOf { it.first.size.coerceAtLeast(1) } > MAX_SPRITES
                for ((likers, d) in all) {
                    val n = if (bundle || likers.isEmpty()) 1 else likers.size
                    coinsFor(likes, "hearts", { k -> if (likers.isEmpty()) CoinSource.BallotBox else CoinSource.Liker(likers[k]) }, n, d.playerId, d.points, heart = true, offset = offset)
                    offset += n
                }
            }

            // Pill bases: score at the start of the prompt + the Spot-on points already paid at VOTING start.
            val spotOn = r.spotOnDeltas.groupBy { it.playerId }.mapValues { (_, v) -> v.sumOf { it.points } }
            val base = scores.associate { it.playerId to it.scoreBefore + (spotOn[it.playerId] ?: 0) }
            // Anything the server paid that no coin carries (a future reason): added at the end so pills never lie.
            val unassigned = scores.associate { s -> s.playerId to (s.score - (base[s.playerId] ?: 0) - (assigned[s.playerId] ?: 0)).coerceAtLeast(0) }
            return BluffScript(r, reduced, segments, coins, base, unassigned)
        }
    }
}
