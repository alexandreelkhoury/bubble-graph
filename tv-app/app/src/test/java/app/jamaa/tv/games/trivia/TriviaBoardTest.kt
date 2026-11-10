package app.jamaa.tv.games.trivia

import app.jamaa.tv.Fixtures
import app.jamaa.tv.i18n.I18nKeys
import app.jamaa.tv.platform.Expression
import app.jamaa.tv.platform.WorldPalettes
import kotlinx.serialization.json.Json
import kotlinx.serialization.json.jsonArray
import kotlinx.serialization.json.jsonObject
import kotlinx.serialization.json.jsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The pure rules of the Quiz Night TV screens (GAME-TRIVIA §6, §8, §12; DESIGN-JAMAA §1.5, §4.3, §5.4). */
class TriviaBoardTest {
    private val rami = "p_0a1b2c3d4e5f60718293a4b5"
    private val lea = "p_1b2c3d4e5f60718293a4b5c6"
    private val nour = "p_2c3d4e5f60718293a4b5c6d7"
    private val sam = "p_3d4e5f60718293a4b5c6d7e8"
    private val fifth = "p_4e5f60718293a4b5c6d7e8f9"

    // ---------------------------------------------------------------- tokens and the grid

    @Test
    fun tokensAreTheStudioShapesWithTheFinalColours() {
        assertEquals(listOf(TokenShape.SUN, TokenShape.WAVE, TokenShape.LEAF, TokenShape.SPARK), TriviaToken.forType(QuestionType.MC4).map { it.shape })
        assertEquals(listOf("A", "B", "C", "D"), TriviaToken.forType(QuestionType.MC4).map { it.letter })
        assertEquals(listOf(TokenShape.CHECK, TokenShape.CROSS), TriviaToken.forType(QuestionType.TF).map { it.shape })
        // DESIGN-JAMAA §1.5 final values (palette B), shared with the phone and the browser TV.
        assertEquals(listOf(0xFFFFC94D, 0xFF478CFF, 0xFF1FA88A, 0xFFFF4F9A, 0xFF1FA88A, 0xFFF0183A), TriviaToken.entries.map { it.argb })
        assertNull(TriviaToken.at(QuestionType.TF, 2))
    }

    @Test
    fun inkOnEveryTokenMeetsContrastAndFalseKeepsItsWordOffTheCoral() {
        for (t in TriviaToken.entries) {
            val c = WorldPalettes.contrast(TriviaToken.INK, t.argb)
            if (t.textOnFill) assertTrue("$t text $c", c >= 4.5) else {
                assertTrue("$t is just under 4.5 (4.497)", c < 4.5)
                assertTrue("$t glyph ≥ 3:1", c >= 3.0)
            }
            // Against the studio surface the token reads as a graphic (≥ 3:1).
            assertTrue("$t vs surface", WorldPalettes.contrast(t.argb, WorldPalettes.QUIZ_STUDIO.surface) >= 3.0)
        }
    }

    @Test
    fun theGridIsFixedAndNeverMirrored() {
        assertEquals(listOf(Cell(0, 0), Cell(0, 1), Cell(1, 0), Cell(1, 1)), (0..3).map { TriviaBoard.cell(QuestionType.MC4, it) })
        assertEquals(listOf(Cell(0, 0), Cell(0, 1)), (0..1).map { TriviaBoard.cell(QuestionType.TF, it) })
        val r = TriviaBoard.tiles(QuestionType.MC4, 600f, 140f, 12f)
        assertTrue(r[0].x < r[1].x && r[0].y == r[1].y) // A left of B
        assertTrue(r[2].y > r[0].y && r[2].x == r[0].x) // C under A
        assertEquals(294f, r[0].w, 0.01f)
        assertEquals(64f, r[0].h, 0.01f)
        // An Arabic room draws exactly the same grid: the layout takes no direction and the fixture is the same shape.
        val ar = TriviaFixtures.view("answer.ar")
        val en = TriviaFixtures.view("answer")
        assertEquals(
            TriviaBoard.tiles(en.question!!.type, 600f, 140f, 12f),
            TriviaBoard.tiles(ar.question!!.type, 600f, 140f, 12f),
        )
        assertEquals("ar", ar.contentLocale)
        val tf = TriviaBoard.tiles(QuestionType.TF, 600f, 140f, 12f)
        assertEquals(2, tf.size)
        assertEquals(140f, tf[0].h, 0.01f)
    }

    // ---------------------------------------------------------------- timers

    @Test
    fun bulbsGoDarkOneByOneAndPulseInTheLastFiveSeconds() {
        assertEquals(20, TriviaBoard.bulbsLit(15_000, 15_000))
        assertEquals(20, TriviaBoard.bulbsLit(14_300, 15_000)) // first bulb goes at 750 ms
        assertEquals(19, TriviaBoard.bulbsLit(14_250, 15_000))
        assertEquals(10, TriviaBoard.bulbsLit(7_500, 15_000))
        assertEquals(1, TriviaBoard.bulbsLit(1, 15_000))
        assertEquals(0, TriviaBoard.bulbsLit(0, 15_000))
        assertEquals(0, TriviaBoard.bulbsLit(500, 0))
        assertFalse(TriviaBoard.pulsing(5_001))
        assertTrue(TriviaBoard.pulsing(5_000))
        assertTrue(TriviaBoard.pulsing(1))
        assertFalse(TriviaBoard.pulsing(0))
        assertEquals(0.5f, TriviaBoard.fill(2_000, 4_000), 0.0001f)
        assertEquals(1f, TriviaBoard.fill(0, 4_000), 0.0001f)
    }

    @Test
    fun phaseTimeComesFromTheServerClock() {
        val v = TriviaFixtures.view("answer")
        val start = v.deadline!! - v.durationMs!!
        assertEquals(0L, TriviaBoard.elapsedInPhase(v.deadline, v.durationMs, start - 300))
        assertEquals(1_200L, TriviaBoard.elapsedInPhase(v.deadline, v.durationMs, start + 1_200))
        assertEquals(0L, TriviaBoard.elapsedInPhase(null, null, 123))
    }

    // ---------------------------------------------------------------- tower

    @Test
    fun towerOrdersByRankAndSharesPlaces() {
        val v = TriviaFixtures.view("reveal")
        assertEquals(listOf(rami, nour, sam, lea), TriviaBoard.towerOrder(v).map { it.id })
        assertEquals(listOf(1, 2, 3, 4), TriviaBoard.places(TriviaBoard.towerOrder(v)))
        // Before the points everyone was tied at 0: seat order.
        assertEquals(listOf(rami, lea, nour, sam), TriviaBoard.towerOrderBefore(v).map { it.id })
        // Score-based fallback when a rank is missing: ties share a place.
        val tied = v.copy(players = v.players.map { it.copy(rank = null, score = if (it.id == lea) 0 else 500) })
        assertEquals(listOf(1, 1, 1, 4), TriviaBoard.places(tied.players.sortedByDescending { it.score }))
    }

    @Test
    fun theTowerPagesTwelvePlayersEveryTwoSeconds() {
        val v = TriviaFixtures.view("reveal")
        val twelve = (0 until 12).map { i -> v.players[0].copy(id = "p$i", seat = i, rank = i + 1) }
        val order = TriviaBoard.towerOrder(v.copy(players = twelve))
        assertEquals((0 until 8).map { "p$it" }, TriviaBoard.towerPage(order, 0).map { it.id })
        assertEquals((8 until 12).map { "p$it" }, TriviaBoard.towerPage(order, 2_000).map { it.id })
        assertEquals((0 until 8).map { "p$it" }, TriviaBoard.towerPage(order, 4_100).map { it.id })
        assertEquals(4, TriviaBoard.towerPage(order.take(4), 9_999).size)
    }

    @Test
    fun climbsOvertakersAndTheCrown() {
        val v = TriviaFixtures.view("reveal.streak")
        // rankBefore → rank: Léa 3 → 2, Nour 5 → 3.
        assertEquals(mapOf(lea to 1, nour to 2), TriviaBoard.climbs(v))
        assertEquals(nour to 2, TriviaBoard.biggestClimber(v))
        assertEquals(setOf(lea, nour), TriviaBoard.overtakers(v))
        assertEquals(setOf(rami), TriviaBoard.leaders(v))
        // The first leaderboard has no previous ranks: no arrow, nobody "climbs".
        val lb = TriviaFixtures.view("leaderboard")
        assertNull(TriviaBoard.biggestClimber(lb))
        // A tie for the biggest climb shows no arrow.
        val tie = v.copy(players = v.players.map { if (it.id == lea) it.copy(rankBefore = 4) else it })
        assertNull(TriviaBoard.biggestClimber(tie))
        assertEquals(0.5f, TriviaBoard.barShare(500, 1_000), 0.0001f)
        assertEquals(0f, TriviaBoard.barShare(5, 0), 0.0001f)
    }

    // ---------------------------------------------------------------- reveal

    @Test
    fun stacksPutEachPlayerOnTheTileTheyChoseFastestFirst() {
        val v = TriviaFixtures.view("reveal")
        assertEquals(mapOf(1 to listOf(rami, nour, sam), 2 to listOf(lea)), TriviaBoard.stacks(v))
        assertEquals(TileState.CORRECT, TriviaBoard.tileState(v, 1))
        assertEquals(TileState.WRONG, TriviaBoard.tileState(v, 0))
        assertEquals(emptyMap<Int, List<String>>(), TriviaBoard.stacks(TriviaFixtures.view("reveal.too_slow")))
        assertTrue((0..3).all { TriviaBoard.tileState(TriviaFixtures.view("reveal.voided"), it) == TileState.VOID })
    }

    @Test
    fun twelveStackInTwoRowsOfSixInsideTheTile() {
        // The native stage: grid 184 dp tall (two 86 dp rows), tiles about 320 dp wide.
        val tile = TriviaBoard.tiles(QuestionType.MC4, 652f, 184f, 12f)[1]
        assertEquals(86f, tile.h, 0.01f)
        val size = TriviaBoard.stackCharSize(12)
        assertEquals(32f, size, 0f)
        val spots = (0 until 12).map { TriviaBoard.stackOffset(it, tile.copy(x = 0f, y = 0f), size) }
        assertEquals(12, spots.toSet().size)
        assertEquals(2, spots.map { it.second }.toSet().size)
        assertTrue(spots.all { (x, _) -> x >= TriviaBoard.REVEAL_START_RESERVE && x + size <= tile.w })
        assertTrue(spots.take(6).all { it.second > spots[6].second }) // row 2 stands behind (higher)
        // Nobody covers the answer text: every head stays below the one-line text band.
        assertTrue(spots.all { it.second >= TriviaBoard.REVEAL_TEXT_BAND })
        // Six or fewer: one row of 40 dp characters, also below the band and clear of the token column.
        assertEquals(40f, TriviaBoard.stackCharSize(6), 0f)
        val one = (0 until 6).map { TriviaBoard.stackOffset(it, tile.copy(x = 0f, y = 0f), 40f) }
        assertTrue(one.all { (x, y) -> y >= TriviaBoard.REVEAL_TEXT_BAND && x >= TriviaBoard.REVEAL_START_RESERVE && x + 40f <= tile.w })
    }

    // ---------------------------------------------------------------- leaderboard race

    private fun twelve(): TriviaView {
        val base = TriviaFixtures.view("leaderboard")
        val p0 = base.players.first()
        // Before: player k is (k+1)th with 1200 - 100k. After: "j" (10th before) jumps to 3rd.
        val players = (0 until 12).map { k ->
            val before = 1_200 - 100 * k
            val after = if (k == 9) 1_050 else before
            p0.copy(id = "p_$k", name = "P$k", seat = k, score = after, scoreBefore = before, rankBefore = k + 1, rank = 0, left = false)
        }
        val ranked = players.sortedByDescending { it.score }.mapIndexed { i, p -> p.copy(rank = i + 1) }.associateBy { it.id }
        return base.copy(players = players.map { ranked.getValue(it.id) })
    }

    @Test
    fun twelvePlayerRaceDrawsEveryRowAndTheClimberFromTenthToThird() {
        val v = twelve()
        val rows = TriviaBoard.raceRows(v)
        assertEquals(12, rows.size)
        assertEquals((0 until 12).toList(), rows.map { it.from })
        assertEquals((0 until 12).toList(), rows.map { it.to }.sorted()) // a permutation: no hole, no overlap
        val climber = rows.single { it.player.id == "p_9" }
        assertEquals(9, climber.from)
        assertEquals(2, climber.to)
        assertEquals("p_9" to 7, TriviaBoard.biggestClimber(v))
        // Every row fits the stage: compact rows over 8 players, and no row lands below the area.
        assertTrue(TriviaBoard.raceCompact(12))
        assertFalse(TriviaBoard.raceCompact(8))
        val h = 400f
        val rowH = TriviaBoard.raceRowHeight(12, h)
        assertTrue(rows.all { (it.from + 1) * rowH <= h + 0.01f && (it.to + 1) * rowH <= h + 0.01f })
        assertEquals(50f, TriviaBoard.raceRowHeight(8, h), 0.01f)
        assertEquals(52f, TriviaBoard.raceRowHeight(4, 600f), 0.01f)
    }

    @Test
    fun odometerRestsOnExactDigitsAndRollsHigherColumnsOnlyOnCarry() {
        assertEquals(listOf(0f, 7f, 8f), TriviaBoard.odometer(870.0, 3))
        assertEquals(listOf(9f, 9f, 8f), TriviaBoard.odometer(899.0, 3))
        // 899.5: every column is half-way to 900.
        assertEquals(listOf(9.5f, 9.5f, 8.5f), TriviaBoard.odometer(899.5, 3))
        // 875.5: only the ones column moves.
        assertEquals(listOf(5.5f, 7f, 8f), TriviaBoard.odometer(875.5, 3))
        assertEquals(4, TriviaBoard.odometerPlaces(870, 1_050))
        assertEquals(1, TriviaBoard.odometerPlaces(0, 0))
    }

    @Test
    fun coinsFlyForEveryCorrectAnswerWithStreakBonusAndTheFinal() {
        val r = TriviaBoard.coins(TriviaFixtures.view("reveal"))
        assertEquals(listOf(rami, nour, sam), r.map { it.playerId })
        assertEquals(listOf(940, 850, 810), r.map { it.total })
        val s = TriviaBoard.coins(TriviaFixtures.view("reveal.streak"))
        val ramiCoin = s.first { it.playerId == rami }
        assertEquals(980, ramiCoin.points)
        assertEquals(200, ramiCoin.bonus)
        assertTrue(ramiCoin.flame) // streak 3
        assertFalse(s.first { it.playerId == lea }.flame)
        // Each coin's total is exactly what the score grew by (GAME-TRIVIA §13.3 invariant 4).
        val v = TriviaFixtures.view("reveal.streak")
        for (c in s) assertEquals(v.player(c.playerId)!!.score - v.player(c.playerId)!!.scoreBefore, c.total)
        assertTrue(TriviaBoard.coins(TriviaFixtures.view("reveal.final")).all { it.doubled })
        assertTrue(TriviaBoard.coins(TriviaFixtures.view("reveal.stumped")).isEmpty())
        assertTrue(TriviaBoard.coins(TriviaFixtures.view("reveal.voided")).isEmpty())
        assertTrue(TriviaBoard.coins(TriviaFixtures.view("answer")).isEmpty())
        assertEquals("+870", TriviaBoard.plus(870))
    }

    @Test
    fun theHeadlineSaysTheMostSpecificThing() {
        assertEquals(TriviaBoard.Headline.FASTEST, TriviaBoard.headline(TriviaFixtures.view("reveal").reveal!!))
        assertEquals(TriviaBoard.Headline.GENIUS, TriviaBoard.headline(TriviaFixtures.view("reveal.genius").reveal!!))
        assertEquals(TriviaBoard.Headline.STUMPED, TriviaBoard.headline(TriviaFixtures.view("reveal.stumped").reveal!!))
        assertEquals(TriviaBoard.Headline.TOO_SLOW, TriviaBoard.headline(TriviaFixtures.view("reveal.too_slow").reveal!!))
        assertEquals(TriviaBoard.Headline.VOIDED, TriviaBoard.headline(TriviaFixtures.view("reveal.voided").reveal!!))
    }

    // ---------------------------------------------------------------- characters

    @Test
    fun revealExpressionsFollowThePublicResult() {
        val v = TriviaFixtures.view("reveal")
        val e = v.players.associate { it.id to TriviaBoard.expression(v, it) }
        assertEquals(Expression.CHEER, e[rami])
        // Léa is the only one wrong: the comic shock.
        assertEquals(Expression.SHOCK, e[lea])
        val stumped = TriviaFixtures.view("reveal.stumped")
        assertTrue(stumped.players.all { TriviaBoard.expression(stumped, it) == Expression.SHOCK })
        val fin = TriviaFixtures.view("reveal.final")
        // Two wrong answers: just sad.
        assertEquals(Expression.SAD, TriviaBoard.expression(fin, fin.player(rami)!!))
        val slow = TriviaFixtures.view("reveal.too_slow")
        assertTrue(slow.players.all { TriviaBoard.snoozing(slow, it) })
        assertFalse(v.players.any { TriviaBoard.snoozing(v, it) })
        val voided = TriviaFixtures.view("reveal.voided")
        assertTrue(voided.players.all { TriviaBoard.expression(voided, it) == Expression.IDLE })
    }

    /** DESIGN-JAMAA §4.3 / §9: before REVEAL a character's look is a function of public data only. */
    @Test
    fun beforeTheRevealCharactersNeverHintAtAnAnswer() {
        val v = TriviaFixtures.view("answer")
        val shuffled = v.copy(options = v.options.reversed())
        for (p in v.players) {
            assertEquals(Expression.IDLE, TriviaBoard.expression(v, p))
            assertEquals(TriviaBoard.expression(v, p), TriviaBoard.expression(shuffled, p))
            assertFalse(TriviaBoard.snoozing(v, p))
        }
        // "Answered" is the only per-player difference (the podium ring and the platform `done` from doneIds).
        assertEquals(setOf(rami, lea), v.players.filter { it.answered }.map { it.id }.toSet())
    }

    @Test
    fun flameGrowsAtThreeFiveSeven() {
        assertEquals(listOf(0, 0, 0, 1, 1, 2, 2, 3, 3), (0..8).map { TriviaBoard.flameLevel(it) })
        val v = TriviaFixtures.view("reveal.genius")
        assertTrue(TriviaBoard.flameVisible(v, v.player(rami)!!)) // streak 4
        assertFalse(TriviaBoard.flameVisible(v, v.player(sam)!!))
    }

    // ---------------------------------------------------------------- results

    @Test
    fun podiumAndStats() {
        val v = TriviaFixtures.view("results")
        val podium = TriviaBoard.podium(v)
        assertEquals(listOf(listOf(rami), listOf(lea), listOf(nour)), podium.map { g -> g.map { it.id } })
        assertEquals(Expression.CHEER, TriviaBoard.expression(v, v.player(rami)!!))
        assertEquals(Expression.HAPPY, TriviaBoard.expression(v, v.player(lea)!!))
        assertEquals(Expression.IDLE, TriviaBoard.expression(v, v.player(fifth)!!))
        val stats = TriviaBoard.stats(v)
        assertEquals(listOf(TriviaBoard.StatKind.FASTEST, TriviaBoard.StatKind.STREAK, TriviaBoard.StatKind.CORRECT).filter { k -> stats.any { it.kind == k } }, stats.map { it.kind })
        for (s in stats) assertTrue(s.playerIds.isNotEmpty())
        // A tie at the top shares the step.
        val tie = v.copy(players = v.players.map { if (it.id == lea) it.copy(rank = 1, score = 4420) else it })
        assertEquals(setOf(rami, lea), TriviaBoard.podium(tie).first().map { it.id }.toSet())
    }

    // ---------------------------------------------------------------- vocabulary labels

    @Test
    fun everyDomainTopicAndStarsLabelResolves() {
        val vocab = Json.parseToJsonElement(File(Fixtures.dir, "../../content/vocab.json").readText()).jsonObject
        val missing = mutableListOf<String>()
        for (d in vocab["domains"]!!.jsonArray.map { it.jsonPrimitive.content }) TriviaBoard.domainKey(d).let { if (it !in I18nKeys.strings) missing += it }
        for (t in vocab["topics"]!!.jsonArray.map { it.jsonPrimitive.content }) TriviaBoard.topicKey(t).let { if (it !in I18nKeys.strings) missing += it }
        for (s in 0..4) TriviaBoard.starsKey(s).let { if (it !in I18nKeys.strings) missing += it }
        assertEquals(emptyList<String>(), missing)
        assertEquals("content.domain.middleEast", TriviaBoard.domainKey("middle-east"))
        assertEquals("content.topic.cinemaTv", TriviaBoard.topicKey("cinema-tv"))
        assertEquals(TriviaShelf.DOMAIN_ORDER, vocab["domains"]!!.jsonArray.map { it.jsonPrimitive.content })
    }

    @Test
    fun everyKeyTheScreensUseResolves() {
        val keys = listOf(
            "game.trivia.read.questionOf", "game.trivia.leaderboard.title", "game.trivia.reveal.time", "game.trivia.reveal.fastest",
            "game.trivia.reveal.stumped", "game.trivia.reveal.tooSlow", "game.trivia.reveal.genius", "game.trivia.reveal.didYouKnow",
            "game.trivia.pause.voided", "game.trivia.final.title", "game.trivia.final.stamp", "game.trivia.hold.title", "game.trivia.hold.body",
            "game.trivia.results.title", "game.trivia.results.points", "game.trivia.results.shared", "game.trivia.results.fastestCount",
            "game.trivia.results.longestStreak", "game.trivia.results.mostCorrect", "game.trivia.pad.newRibbon", "game.trivia.quiz.shelfTitle",
            "game.trivia.quiz.selected", "game.trivia.quiz.locked", "game.trivia.quiz.rerun", "content.more", "content.starsLabel",
        ) + TriviaToken.entries.map { it.labelKey }
        assertEquals(emptyList<String>(), keys.filter { it !in I18nKeys.strings })
        val plurals = listOf("game.trivia.quiz.questions", "game.trivia.leaderboard.climb")
        assertEquals(emptyList<String>(), plurals.filter { it !in I18nKeys.plurals })
    }
}
