package app.jamaa.tv.games.bluff

import org.junit.Assert.assertTrue
import org.junit.Test

/** Every Bluff phase fits the 864 × 486 dp safe area for 3–12 players and 2–13 options (owner: "never cropped"). */
class BluffFitTest {
    @Test fun theVotingGridFitsEveryCountAndStaysReadable() {
        for (players in 3..12) for (options in 2..13) {
            val grid = BluffFit.voteGridDp(players, options)
            val card = BluffFit.optionCardDp(options, grid)
            val rows = BluffBoard.rows(options)
            val used = BluffFit.HEADER + BluffFit.VOTE_TITLE + BluffFit.VOTE_PROMPT + 8f + rows * card + (rows - 1) * BluffFit.VOTE_GAP +
                BluffFit.row(players, BluffPhase.VOTING, options).heightDp
            assertTrue("$players/$options used $used", used <= BluffFit.SAFE_H + 0.01f)
            // One line of ≥ 18 sp always fits a card (1.2 line height + 12 dp padding).
            assertTrue("$players/$options card $card", card >= 18f * 1.2f + 12f)
        }
    }

    @Test fun theRevealStackFitsUnderTheHeaderAndAboveTheRow() {
        for (players in 3..12) {
            val stage = BluffFit.stageDp(players, BluffPhase.REVEAL, players + 1)
            val card = BluffFit.revealCardH(stage)
            assertTrue("$players", BluffFit.STRIP + BluffFit.PERCH + card + BluffFit.LIAR <= stage + 0.01f)
            assertTrue(card >= BluffFit.CARD_MIN)
        }
    }

    @Test fun perchedVotersStayOnTheCardEdge() {
        for (n in 1..11) {
            val step = BluffFit.perchStepDp(n, 360f)
            assertTrue((n - 1) * step <= 360f + 0.01f)
            assertTrue(step <= BluffBoard.TRAVELLER_STEP_DP)
        }
    }

    @Test fun scoresAndResultsRowsFitTwelvePlayers() {
        for (n in 3..12) {
            assertTrue(BluffFit.HEADER + BluffFit.SCORES_TITLE + BluffFit.SCORES_TEASE + n * BluffFit.raceRowDp(n) <= BluffFit.SAFE_H + 0.01f)
            assertTrue(BluffFit.RESULTS_TITLE + BluffFit.RESULTS_BUTTONS + n * BluffFit.boardRowDp(n) <= BluffFit.SAFE_H + 0.01f)
        }
    }

    @Test fun theCafeRowIsCompactOnlyForBigVotingBoards() {
        assertTrue(BluffFit.row(12, BluffPhase.VOTING, 13).names.not())
        assertTrue(BluffFit.row(12, BluffPhase.VOTING, 8).names)
        assertTrue(BluffFit.row(12, BluffPhase.REVEAL, 13).names)
        for (n in 3..12) assertTrue(BluffFit.row(n, BluffPhase.WRITING, 0).characterDp >= 40)
    }
}

/** A prompt or round kind added to the content after this build never breaks the frame: it decodes to OTHER. */
class BluffLenientKindTest {
    private val json = app.jamaa.tv.protocol.ProtocolJson.decoder

    @Test fun unknownKindsDecodeToOther() {
        org.junit.Assert.assertEquals(BluffType.OTHER, json.decodeFromString(BluffType.serializer(), "\"impossible_true\""))
        org.junit.Assert.assertEquals(RoundKind.OTHER, json.decodeFromString(RoundKind.serializer(), "\"impossible\""))
        org.junit.Assert.assertEquals(LengthHint.OTHER, json.decodeFromString(LengthHint.serializer(), "\"tiny\""))
        org.junit.Assert.assertEquals(BluffType.FACT_BLANK, json.decodeFromString(BluffType.serializer(), "\"fact_blank\""))
        org.junit.Assert.assertEquals("\"noTruth\"", json.encodeToString(RoundKind.serializer(), RoundKind.NO_TRUTH))
    }
}
