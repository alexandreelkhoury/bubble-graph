package app.jamaa.tv.games.trivia

import app.jamaa.tv.platform.Expression

// The pure rules of the Quiz Night TV screens (JVM-tested): answer tokens and their never-mirrored grid (GAME-TRIVIA
// §8.2, DESIGN-JAMAA §1.5), tile states per phase, the tower order, the reveal highlights, the character expressions
// (public data only, DESIGN-JAMAA §4.3), the flame overlay, the leaderboard race and the results podium.

/** The drawn token shapes (GAME-TRIVIA §8.2); never the triangle/diamond/circle/square of other quiz games. */
enum class TokenShape { SUN, WAVE, LEAF, SPARK, CHECK, CROSS }

/**
 * Answer tokens with their DESIGN-JAMAA §1.5 final colours (palette B, shared with the phone and the browser TV).
 * [letter] stays Latin in every locale (null for True/False). [labelKey] is the spoken shape name / True / False.
 * [textOnFill]: false for False's coral (ink on it is 4.497:1): the word sits on a cream strip, only the glyph on coral.
 */
enum class TriviaToken(val letter: String?, val shape: TokenShape, val argb: Long, val labelKey: String, val textOnFill: Boolean = true) {
    A("A", TokenShape.SUN, 0xFFFFC94D, "game.trivia.token.a"),
    B("B", TokenShape.WAVE, 0xFF478CFF, "game.trivia.token.b"),
    C("C", TokenShape.LEAF, 0xFF1FA88A, "game.trivia.token.c"),
    D("D", TokenShape.SPARK, 0xFFFF4F9A, "game.trivia.token.d"),
    TRUE(null, TokenShape.CHECK, 0xFF1FA88A, "game.trivia.tf.true"),
    FALSE(null, TokenShape.CROSS, 0xFFF0183A, "game.trivia.tf.false", textOnFill = false),
    ;

    companion object {
        const val INK = 0xFF120A1F

        fun forType(type: QuestionType): List<TriviaToken> = when (type) {
            QuestionType.MC4 -> listOf(A, B, C, D)
            QuestionType.TF -> listOf(TRUE, FALSE)
        }

        /** The token of displayed position [index] (0..3; tf 0 = True, 1 = False), or null when out of range. */
        fun at(type: QuestionType, index: Int): TriviaToken? = forType(type).getOrNull(index)
    }
}

/** A grid cell in physical (left-to-right) coordinates; the grid is the same on every device and never mirrored. */
data class Cell(val row: Int, val col: Int)

/** Tile rectangles in dp, left-origin (the UI lays them out under a forced LTR direction). */
data class Rect(val x: Float, val y: Float, val w: Float, val h: Float) {
    val cx: Float get() = x + w / 2f
    val cy: Float get() = y + h / 2f
}

/** Where a tile is in a phase, from public data only. */
enum class TileState {
    /** READ: an outlined ghost slot so the layout does not jump at ANSWER. */
    GHOST,

    /** ANSWER (and REVEAL before the wrong-out step): the full token. */
    OPEN,

    /** REVEAL: the right answer (glows, shape spins). */
    CORRECT,

    /** REVEAL: a wrong answer (dims to 30 %, scale 0.96). */
    WRONG,

    /** A voided question: every tile dims, none glows. */
    VOID,
}

object TriviaBoard {
    /** GAME-TRIVIA §12.2: the ANSWER timer is a ring of 20 bulbs. */
    const val BULBS = 20

    /** The last 5 s pulse amber with `sfx.tick` (DESIGN-JAMAA §5.4). */
    const val PULSE_LAST_MS = 5_000L

    /** GAME-TRIVIA §6: stacks of up to 2 rows of 6 characters on a tile. */
    const val STACK_COLS = 6
    const val STACK_ROWS = 2

    /** GAME-TRIVIA §6: the TV tower shows the top 8 and pages the rest every 2 s. */
    const val TOWER_ROWS = 8
    const val TOWER_PAGE_MS = 2_000L

    /** The fixed answer-grid cell of a displayed position: A top-left, B top-right, C bottom-left, D bottom-right. */
    fun cell(type: QuestionType, index: Int): Cell = when (type) {
        QuestionType.MC4 -> Cell(index / 2, index % 2)
        QuestionType.TF -> Cell(0, index)
    }

    /**
     * The tile rectangles of a [width] × [height] grid area (dp) with [gap] between tiles, in physical coordinates.
     * Takes no layout direction on purpose: an Arabic TV draws exactly the same grid (GAME-TRIVIA §8.2).
     */
    fun tiles(type: QuestionType, width: Float, height: Float, gap: Float): List<Rect> {
        val n = TriviaToken.forType(type).size
        val rows = if (type == QuestionType.MC4) 2 else 1
        val w = (width - gap) / 2f
        val h = (height - gap * (rows - 1)) / rows
        return (0 until n).map { i ->
            val c = cell(type, i)
            Rect(c.col * (w + gap), c.row * (h + gap), w, h)
        }
    }

    /** The state of tile [index] now. Before REVEAL nothing depends on which answer is right (there is no such data). */
    fun tileState(view: TriviaView, index: Int): TileState {
        val r = view.reveal
        return when {
            view.phase == TriviaPhase.READ -> TileState.GHOST
            r == null -> TileState.OPEN
            r.voided -> TileState.VOID
            index == r.correct -> TileState.CORRECT
            else -> TileState.WRONG
        }
    }

    /** Bulbs still lit for [remainingMs] of [durationMs] (they go dark one by one; all lit at the start). */
    fun bulbsLit(remainingMs: Long, durationMs: Long, bulbs: Int = BULBS): Int {
        if (durationMs <= 0L) return 0
        val f = remainingMs.coerceIn(0L, durationMs).toDouble() / durationMs.toDouble()
        return kotlin.math.ceil(f * bulbs - 1e-9).toInt().coerceIn(0, bulbs)
    }

    /** True while the bulbs pulse amber (the last 5 s, still running). */
    fun pulsing(remainingMs: Long): Boolean = remainingMs in 1..PULSE_LAST_MS

    /** The READ "get ready" bar, 0 → 1 over the phase. */
    fun fill(remainingMs: Long, durationMs: Long): Float =
        if (durationMs <= 0L) 1f else (1.0 - remainingMs.coerceIn(0L, durationMs).toDouble() / durationMs).toFloat()

    /** Milliseconds since the phase started on the server clock (a TV that reconnects mid-reveal resumes in place). */
    fun elapsedInPhase(deadline: Long?, durationMs: Long?, serverNow: Long): Long {
        if (deadline == null || durationMs == null) return 0L
        return (serverNow - (deadline - durationMs)).coerceAtLeast(0L)
    }

    // ---------------------------------------------------------------- tower and ranks

    /** The tower order now: rank ↑ (shared ranks keep seat order), players without a rank (none yet) last. */
    fun towerOrder(view: TriviaView): List<TriviaPlayer> =
        view.players.sortedWith(compareBy<TriviaPlayer>({ it.rank ?: Int.MAX_VALUE }, { -it.score }, { it.seat }))

    /** The tower order before this question's points (REVEAL starts from it and re-sorts at 4.5 s). */
    fun towerOrderBefore(view: TriviaView): List<TriviaPlayer> =
        view.players.sortedWith(compareBy<TriviaPlayer>({ it.rankBefore ?: Int.MAX_VALUE }, { -it.scoreBefore }, { it.seat }))

    /** Places with ties shared: "1, 2, 2, 4" from the server ranks (fallback: computed from the scores). */
    fun places(order: List<TriviaPlayer>): List<Int> {
        if (order.all { it.rank != null }) return order.map { it.rank!! }
        var last = Int.MIN_VALUE
        var place = 0
        return order.mapIndexed { i, p ->
            if (p.score != last) {
                place = i + 1
                last = p.score
            }
            place
        }
    }

    /** The tower pages (top 8 always first, then the rest paged every 2 s when more than 8 play). */
    fun towerPage(order: List<TriviaPlayer>, elapsedMs: Long): List<TriviaPlayer> {
        if (order.size <= TOWER_ROWS) return order
        val rest = order.drop(TOWER_ROWS).chunked(TOWER_ROWS)
        val pages = 1 + rest.size
        val page = ((elapsedMs / TOWER_PAGE_MS) % pages).toInt()
        return if (page == 0) order.take(TOWER_ROWS) else rest[page - 1]
    }

    /** The leader(s) who wear the crown: rank 1 with points. */
    fun leaders(view: TriviaView): Set<String> = view.players.filter { it.rank == 1 && it.score > 0 && !it.left }.map { it.id }.toSet()

    /** Players who moved up since the previous board, with how many places ([rankBefore] − [rank], ≥ 1). */
    fun climbs(view: TriviaView): Map<String, Int> = view.players.mapNotNull { p ->
        val b = p.rankBefore ?: return@mapNotNull null
        val a = p.rank ?: return@mapNotNull null
        (b - a).takeIf { it > 0 }?.let { p.id to it }
    }.toMap()

    /** GAME-TRIVIA §12.4: the biggest climber gets the "+3 places!" arrow (ties: none, so no favourite is picked). */
    fun biggestClimber(view: TriviaView): Pair<String, Int>? {
        val c = climbs(view)
        val best = c.values.maxOrNull() ?: return null
        val who = c.filterValues { it == best }.keys
        return if (who.size == 1) who.first() to best else null
    }

    /** Overtakers hop during the re-sort: they now sit above someone who was above them. */
    fun overtakers(view: TriviaView): Set<String> {
        val before = towerOrderBefore(view).map { it.id }
        val after = towerOrder(view).map { it.id }
        return after.filterIndexed { i, id -> before.indexOf(id) > i }.toSet()
    }

    /** One leaderboard-race row: the player, its index before the points ([from]) and after the re-sort ([to]). */
    data class RaceRow(val player: TriviaPlayer, val from: Int, val to: Int)

    /**
     * Every player of the leaderboard race (TR-TV-04), in the order before this question's points, with where each one
     * ends. All rows are drawn (compact when more than [TOWER_ROWS] play, like the browser TV), so a climber from 10th
     * into the top 3 is always on screen and no row slides off the stage.
     */
    fun raceRows(view: TriviaView): List<RaceRow> {
        val after = towerOrder(view).map { it.id }
        return towerOrderBefore(view).mapIndexed { i, p -> RaceRow(p, i, after.indexOf(p.id).coerceAtLeast(0)) }
    }

    /** The race switches to compact rows (smaller characters, label type) above 8 players. */
    fun raceCompact(players: Int): Boolean = players > TOWER_ROWS

    /** The race's row height (dp) in an area [height] dp tall: 8 slots up to 52 dp, or every player when compact. */
    fun raceRowHeight(players: Int, height: Float): Float =
        if (raceCompact(players)) height / players else minOf(height / TOWER_ROWS, 52f)

    /**
     * The odometer (DESIGN-JAMAA §5.1, values ≥ 100): the position of each digit column, ones first, for a counter at
     * [value] (fractional while it runs). The ones column rolls continuously; a higher column turns only while every
     * column below it rolls over from 9, so whole values rest on exact digits.
     */
    fun odometer(value: Double, places: Int): List<Float> {
        val v = value.coerceAtLeast(0.0)
        return (0 until places).map { k ->
            val unit = Math.pow(10.0, k.toDouble())
            val digit = Math.floor(v / unit) % 10.0
            val below = v - Math.floor(v / unit) * unit // what the lower columns show, 0 ≤ below < unit
            val frac = if (k == 0) v - Math.floor(v) else (below - (unit - 1.0)).coerceIn(0.0, 1.0)
            (digit + frac).toFloat()
        }
    }

    /** Digit columns the odometer needs for a count running from [a] to [b]. */
    fun odometerPlaces(a: Int, b: Int): Int = maxOf(a, b, 0).toString().length

    /** The leaderboard race bars: each player's share of the leader's total (0..1), before and after. */
    fun barShare(score: Int, max: Int): Float = if (max <= 0) 0f else (score.toFloat() / max).coerceIn(0f, 1f)

    // ---------------------------------------------------------------- reveal

    /** The banner line of a reveal (one at a time, most specific first). */
    enum class Headline { VOIDED, TOO_SLOW, STUMPED, GENIUS, FASTEST, NONE }

    fun headline(r: TriviaReveal): Headline = when {
        r.voided -> Headline.VOIDED
        r.tooSlow -> Headline.TOO_SLOW
        r.stumped -> Headline.STUMPED
        r.genius -> Headline.GENIUS
        r.fastestIds.isNotEmpty() -> Headline.FASTEST
        else -> Headline.NONE
    }

    /**
     * Who stands on which tile after the jump-on: tile index → player ids, fastest first (then seat), at most 12 per
     * tile (12 players max). No-answer players stay on their podium.
     */
    fun stacks(view: TriviaView): Map<Int, List<String>> {
        val r = view.reveal ?: return emptyMap()
        val seat = view.players.associate { it.id to it.seat }
        return r.choices.filter { it.choice != null }
            .sortedWith(compareBy<TriviaChoice>({ it.timeMs ?: Long.MAX_VALUE }, { seat[it.id] ?: Int.MAX_VALUE }))
            .groupBy({ it.choice!! }, { it.id })
            .mapValues { (_, ids) -> ids.take(STACK_COLS * STACK_ROWS) }
    }

    /**
     * REVEAL tile layout (dp): the answer text moves to a one-line band at the tile's top ([REVEAL_TEXT_BAND]) and the
     * stack stands below it, clear of the token column at the start side ([REVEAL_START_RESERVE]), so the crowd never
     * covers the right answer's wording.
     */
    const val REVEAL_TEXT_BAND = 32f
    const val REVEAL_START_RESERVE = 76f
    const val STACK_CHAR = 40f
    const val STACK_CHAR_CROWD = 32f

    /** Character size on a tile holding [count] players: 40 dp, 32 dp once a second row is needed. */
    fun stackCharSize(count: Int): Float = if (count > STACK_COLS) STACK_CHAR_CROWD else STACK_CHAR

    /**
     * Offset (dp) of the [i]-th character of a stack on a tile of [tile] size, from the tile's top-left: 2 rows of 6
     * at the tile's end side ("feet" on the tile's lower edge; row 2 stands behind row 1, half a step towards the
     * start), [size] dp characters. Every character stays below the text band and after the token column whenever the
     * tile is big enough. Physical coordinates (the grid is never mirrored).
     */
    fun stackOffset(i: Int, tile: Rect, size: Float): Pair<Float, Float> {
        val col = i % STACK_COLS
        val row = i / STACK_COLS
        val room = (tile.w - REVEAL_START_RESERVE - 10f - size).coerceAtLeast(0f)
        val step = minOf(size * 0.86f, room / (STACK_COLS - 1 + 0.5f))
        val lift = minOf(size * 0.58f, (tile.h - 6f - size - REVEAL_TEXT_BAND).coerceAtLeast(0f))
        val x = tile.w - 10f - size - col * step - row * step / 2f
        val y = tile.h - size - 6f - row * lift
        return x to y
    }

    /** Podium slot centres (dp) for [n] players across [width], seat order, at most 72 dp apart. */
    fun podiumSlots(n: Int, width: Float): List<Float> {
        if (n <= 0) return emptyList()
        val step = minOf(72f, width / n)
        val start = (width - step * (n - 1)) / 2f
        return (0 until n).map { start + it * step }
    }

    /**
     * The coin flights of a reveal (platform §3.10 C, DESIGN-JAMAA §5.4): one coin per correct player with points,
     * fastest first, at most 24. [points] is the answer's points ("+870", the final's ×2 included) and [bonus] the
     * streak bonus ("+200"), shown in the same label; the player's score grew by [total].
     */
    data class Coin(val playerId: String, val points: Int, val bonus: Int, val doubled: Boolean, val flame: Boolean) {
        val total: Int get() = points + bonus
    }

    fun coins(view: TriviaView): List<Coin> {
        val r = view.reveal ?: return emptyList()
        if (r.voided) return emptyList()
        val streak = view.players.associate { it.id to it.streak }
        val seat = view.players.associate { it.id to it.seat }
        return r.choices.filter { it.correct && it.points + it.streakBonus > 0 }
            .sortedWith(compareBy<TriviaChoice>({ it.timeMs ?: Long.MAX_VALUE }, { seat[it.id] ?: Int.MAX_VALUE }))
            .take(24)
            .map { Coin(it.id, it.points, it.streakBonus, view.isFinal, (streak[it.id] ?: 0) >= ON_FIRE) }
    }

    /** "+870" / "+200" labels (Western digits in every locale, DESIGN-JAMAA §5.1). */
    fun plus(n: Int): String = "+$n"

    // ---------------------------------------------------------------- characters

    /** A streak from 3 wears the flame; it grows one step at 5 and 7 (GAME-TRIVIA §5.4, DESIGN-JAMAA §5.4). */
    const val ON_FIRE = 3

    fun flameLevel(streak: Int): Int = when {
        streak >= 7 -> 3
        streak >= 5 -> 2
        streak >= ON_FIRE -> 1
        else -> 0
    }

    /** Whether the flame shows now: REVEAL from the jump-on, LEADERBOARD and FINAL_INTRO (it persists until broken). */
    fun flameVisible(view: TriviaView, p: TriviaPlayer): Boolean =
        !p.left && flameLevel(p.streak) > 0 && view.phase != TriviaPhase.RESULTS && view.reveal?.voided != true

    /**
     * The event expression of a player in this phase (the platform's away / reaction / done / think rules apply on
     * top, CharacterRules.expression). Public data only: before REVEAL every connected player looks the same apart
     * from `answered` (the envelope's doneIds), never right or wrong (DESIGN-JAMAA §4.3).
     */
    fun expression(view: TriviaView, p: TriviaPlayer): Expression {
        val r = view.reveal
        return when (view.phase) {
            TriviaPhase.REVEAL -> {
                if (r == null || r.voided) return Expression.IDLE
                if (r.stumped) return Expression.SHOCK
                val c = r.choices.firstOrNull { it.id == p.id }
                when {
                    c == null || c.choice == null -> Expression.IDLE
                    c.correct -> Expression.CHEER
                    // The only one wrong gets the comic shock; a crowd of wrong answers is just sad.
                    r.choices.count { it.choice != null && !it.correct } == 1 -> Expression.SHOCK
                    else -> Expression.SAD
                }
            }
            TriviaPhase.LEADERBOARD -> if (p.id in leaders(view)) Expression.HAPPY else Expression.IDLE
            TriviaPhase.RESULTS -> when (p.rank) {
                1 -> Expression.CHEER
                2, 3 -> Expression.HAPPY
                else -> Expression.IDLE
            }
            TriviaPhase.FINAL_INTRO -> Expression.THINK
            else -> Expression.IDLE
        }
    }

    /** No-answer characters stay on the podium with a "z" bubble (DESIGN-JAMAA §5.4). */
    fun snoozing(view: TriviaView, p: TriviaPlayer): Boolean {
        val r = view.reveal ?: return false
        if (r.voided || p.left || p.waiting) return false
        val c = r.choices.firstOrNull { it.id == p.id } ?: return false
        return c.choice == null
    }

    // ---------------------------------------------------------------- results

    /** The podium: up to three steps; tied players share a step (GAME-TRIVIA §6 "Tie at the top"). */
    fun podium(view: TriviaView): List<List<TriviaPlayer>> {
        val order = towerOrder(view).filter { !it.left || it.score > 0 }
        val places = places(order)
        return (1..3).map { step -> order.filterIndexed { i, _ -> places[i] == step } }.filter { it.isNotEmpty() }.take(3)
    }

    /** One results stat card: the best players and the value (ties share the card). */
    data class Stat(val kind: StatKind, val playerIds: List<String>, val value: Int)

    enum class StatKind { FASTEST, STREAK, CORRECT }

    /**
     * GAME-TRIVIA §12.5 stats cards: Fastest finger count, Longest streak, Most correct. A card shows only when it says
     * something (a fastest finger at all; a streak of 2+; one correct answer at least).
     */
    fun stats(view: TriviaView): List<Stat> {
        val ps = view.players
        fun best(kind: StatKind, min: Int, f: (TriviaPlayer) -> Int): Stat? {
            val v = ps.maxOfOrNull(f) ?: return null
            if (v < min) return null
            return Stat(kind, ps.filter { f(it) == v }.sortedBy { it.seat }.map { it.id }, v)
        }
        return listOfNotNull(
            best(StatKind.FASTEST, 1) { it.fastest },
            best(StatKind.STREAK, 2) { it.bestStreak },
            best(StatKind.CORRECT, 1) { it.correct },
        )
    }

    // ---------------------------------------------------------------- vocabulary keys

    /** `middle-east` → `content.domain.middleEast` (lane D's generated keys are camelCase). */
    fun domainKey(domain: String): String = "content.domain." + camel(domain)

    fun topicKey(topic: String): String = "content.topic." + camel(topic)

    /** Easy / Medium / Hard (1..3, clamped). */
    fun starsKey(stars: Int): String = when (stars.coerceIn(1, 3)) {
        1 -> "content.starsEasy"
        2 -> "content.starsMedium"
        else -> "content.starsHard"
    }

    private fun camel(id: String): String = id.split('-').mapIndexed { i, s -> if (i == 0) s else s.replaceFirstChar { it.uppercase() } }.joinToString("")
}
