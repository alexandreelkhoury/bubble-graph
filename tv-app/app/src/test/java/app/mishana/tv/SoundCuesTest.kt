package app.mishana.tv

import app.mishana.tv.game.Cue
import app.mishana.tv.game.CuePlay
import app.mishana.tv.game.RateLimiter
import app.mishana.tv.game.SoundCues
import app.mishana.tv.protocol.DeadlineKind
import app.mishana.tv.protocol.GuessStatus
import app.mishana.tv.protocol.HistoryCause
import app.mishana.tv.protocol.HistoryEntry
import app.mishana.tv.protocol.Role
import app.mishana.tv.protocol.Winner
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNotEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The same rules as web-client/test/sound.test.ts, on the same fixtures. */
class SoundCuesTest {
    private val lobby = TvFixtures.view("lobby")
    private val reveal = TvFixtures.view("role_reveal")
    private val clues = TvFixtures.view("clues")
    private val voting = TvFixtures.view("voting")
    private val guess = TvFixtures.view("mr_white_guess")
    private val results = TvFixtures.view("results")
    private val tie = TvFixtures.view("tie_break")

    private fun List<CuePlay>.cues() = map { it.cue }

    @Test
    fun everyCueHasAGeneratedRawFile() {
        val raw = File(System.getProperty("user.dir"), "src/main/res/raw").takeIf { it.isDirectory }
            ?: File(Fixtures.dir, "../../tv-app/app/src/main/res/raw")
        val files = raw.listFiles().orEmpty().filter { it.name.endsWith(".ogg") }.map { it.name.removeSuffix(".ogg") }.sorted()
        assertEquals(Cue.entries.map { it.file }.sorted(), files)
        assertEquals("sfx_all_ready", Cue.ALL_READY.file)
        assertEquals("sting_win_infiltrators", Cue.STING_WIN_INFILTRATORS.file)
    }

    @Test
    fun firstViewIsSilent() {
        assertTrue(SoundCues.viewCues(null, lobby).isEmpty())
        assertTrue(SoundCues.viewCues(clues, clues).isEmpty())
    }

    @Test
    fun lobbyJoinIsPitchedBySeatAndLeavePlucks() {
        val two = lobby.copy(players = lobby.players.take(2))
        val joined = SoundCues.viewCues(two, lobby)
        assertEquals(listOf(Cue.JOIN, Cue.JOIN), joined.cues())
        assertEquals(SoundCues.joinRate(2), joined[0].rate, 1e-6f)
        assertNotEquals(joined[0].rate, joined[1].rate)
        assertEquals(listOf(Cue.LEAVE), SoundCues.viewCues(lobby, two).cues())
    }

    @Test
    fun gameStartReadyAndFirstTurn() {
        assertEquals(listOf(Cue.FLIP), SoundCues.viewCues(lobby, reveal).cues())
        val one = reveal.copy(players = reveal.players.mapIndexed { i, p -> p.copy(ready = i == 0) })
        assertEquals(listOf(Cue.READY), SoundCues.viewCues(reveal, one).cues())
        val start = SoundCues.viewCues(one, clues)
        assertEquals(listOf(Cue.ALL_READY, Cue.TURN), start.cues())
        assertTrue(start[1].delayMs > 0)
    }

    @Test
    fun speakerChangeVotesTieVerdictAndResults() {
        val next = clues.copy(currentSpeakerId = clues.speakingOrder[1])
        val turn = SoundCues.viewCues(clues, next).single()
        assertEquals(Cue.TURN, turn.cue)
        assertEquals(SoundCues.turnRate(1), turn.rate, 1e-6f)
        assertEquals(listOf(Cue.VOTE_CAST, Cue.VOTE_CAST), SoundCues.viewCues(voting.copy(votesCast = 0), voting).cues())
        assertEquals(listOf(Cue.STAMP, Cue.TURN), SoundCues.viewCues(voting, tie).cues())
        assertEquals(SoundCues.STAMP_LAND_MS, SoundCues.viewCues(voting, tie).first().delayMs)
        val pending = guess.copy(guess = guess.guess!!.copy(status = GuessStatus.PENDING))
        assertEquals(listOf(Cue.STING_WRONG), SoundCues.viewCues(pending, guess).cues())
        assertEquals(listOf(Cue.STING_CORRECT), SoundCues.viewCues(pending, guess.copy(guess = guess.guess!!.copy(status = GuessStatus.CORRECT))).cues())
        assertEquals(listOf(Cue.TIME_UP), SoundCues.viewCues(pending, guess.copy(guess = guess.guess!!.copy(status = GuessStatus.TIMEOUT))).cues())
        val before = voting.copy(gameNumber = results.gameNumber)
        assertEquals(listOf(Cue.STING_WIN_CIVILIANS), SoundCues.viewCues(before, results).cues())
        assertEquals(listOf(Cue.STING_WIN_INFILTRATORS), SoundCues.viewCues(before, results.copy(result = results.result!!.copy(winner = Winner.BLANK))).cues())
    }

    @Test
    fun forfeitPlucks() {
        val left = clues.copy(history = clues.history + HistoryEntry(1, clues.players[0].id, Role.CIVILIAN, HistoryCause.LEAVE))
        assertTrue(Cue.LEAVE in SoundCues.viewCues(clues, left).cues())
    }

    @Test
    fun deadlineTicksHornAndHeartbeat() {
        assertEquals(Cue.TICK, SoundCues.deadlineCue(DeadlineKind.CLUE, 5_100, 4_990))
        assertEquals(Cue.TICK_LAST, SoundCues.deadlineCue(DeadlineKind.REVEAL, 1_010, 990))
        assertEquals(Cue.TIME_UP, SoundCues.deadlineCue(DeadlineKind.VOTE, 80, 0))
        assertNull(SoundCues.deadlineCue(DeadlineKind.CLUE, 6_100, 5_900))
        assertNull(SoundCues.deadlineCue(DeadlineKind.ELIMINATION, 3_100, 2_900))
        assertNull(SoundCues.deadlineCue(DeadlineKind.CLUE, null, 900))
        assertNull(SoundCues.deadlineCue(DeadlineKind.CLUE, 4_000, 900)) // a stall: no stale tick
        val beats = mutableListOf<Long>()
        var ms = 12_000L
        while (ms > 0) {
            if (SoundCues.deadlineCue(DeadlineKind.GUESS, ms + 100, ms) != null) beats += ms
            ms -= 100
        }
        assertEquals(listOf(10_000L, 8_000L, 6_000L, 5_000L, 4_000L, 3_000L, 2_000L, 1_000L), beats)
    }

    @Test
    fun timelineSkipsJumpedMarksAndLimiterThrottles() {
        val marks = listOf(SoundCues.Mark(0, Cue.DRUMROLL), SoundCues.Mark(2_400, Cue.STAMP))
        assertEquals(listOf(Cue.DRUMROLL), SoundCues.timeline(marks, -1f, 0f).map { it.cue })
        assertEquals(listOf(Cue.STAMP), SoundCues.timeline(marks, 2_390f, 2_406f).map { it.cue })
        assertTrue(SoundCues.timeline(marks, 100f, 5_000f).isEmpty())
        val r = RateLimiter(70)
        assertEquals(listOf(true, false, true, false, true), listOf(0L, 30L, 70L, 100L, 141L).map { r.allow(it) })
    }

    @Test
    fun ratesStayInSoundPoolRange() {
        for (s in 0 until 12) assertTrue(SoundCues.joinRate(s) in 0.5f..2f)
        for (n in 1 until 12) assertTrue(SoundCues.chipRate(n) in 0.5f..2f)
        assertTrue(SoundCues.chipRate(2) > SoundCues.chipRate(1))
        assertEquals(Cue.STING_MOLE, SoundCues.roleSting(Role.UNDERCOVER))
    }
}
