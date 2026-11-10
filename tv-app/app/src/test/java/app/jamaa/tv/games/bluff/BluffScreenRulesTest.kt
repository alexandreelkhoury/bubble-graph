package app.jamaa.tv.games.bluff

import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.platform.GameChrome
import app.jamaa.tv.platform.RemoteKey
import kotlinx.serialization.json.JsonPrimitive
import org.junit.Assert.assertEquals
import org.junit.Assert.assertNull
import org.junit.Assert.assertTrue
import org.junit.Test

/**
 * The native TV's screen rules behind the G2 review fixes: the prompt headline (room language first), option letters,
 * the host's pause path to HIDE_OPTION / SKIP_PROMPT, coins leaving from each voter's slot, the rail under the back
 * hint and the odometer.
 */
class BluffScreenRulesTest {
    private fun prompt(original: String, translit: String?, display: String?) =
        BluffPrompt("pr_1", BluffType.FACT_BLANK, original, translit, display, LengthHint.SHORT, rerun = false)

    // ---------------------------------------------------------------- the prompt card (GAME-BLUFF §8.2)

    @Test fun anEnglishFactInAnArabicRoomIsHeadlinedInArabic() {
        val p = prompt("Each year, the Moon drifts about 3.8 ___", null, "كل سنة، القمر بيبعد عنّا حوالي 3.8 ___")
        val l = PromptLines.of(p)
        assertEquals(p.display, l.main)
        assertNull(l.translit)
        assertNull("no English line under the Arabic", l.sub)
    }

    @Test fun anUntranslatedPromptShowsItsOriginal() {
        val l = PromptLines.of(prompt("Each year, the Moon drifts about 3.8 ___", null, null))
        assertEquals("Each year, the Moon drifts about 3.8 ___", l.main)
        assertNull(l.sub)
    }

    @Test fun anArabicProverbKeepsOriginalTransliterationAndTranslation() {
        val l = PromptLines.of(prompt("اللي ما بيعرف الصقر ___", "illi ma bya3ref el-sa2er ___", "Who doesn't know the falcon ___"))
        assertEquals("اللي ما بيعرف الصقر ___", l.main)
        assertEquals("illi ma bya3ref el-sa2er ___", l.translit)
        assertEquals("Who doesn't know the falcon ___", l.sub)
        // A proverb shown in its own language has nothing to repeat under it.
        assertNull(PromptLines.of(prompt("x ___", "x ___", "x ___")).sub)
    }

    @Test fun theLiveFixturesHeadlineTheRoomLanguage() {
        for (s in listOf("writing", "voting")) {
            val p = BluffFixtures.view(s).prompt ?: continue
            val l = PromptLines.of(p)
            if (p.translit == null) assertEquals(s, p.display ?: p.original, l.main)
        }
    }

    // ---------------------------------------------------------------- option letters (BL-TV-03)

    @Test fun lettersFollowTheBoardOrderAndSurviveAHide() {
        val v = BluffFixtures.view("voting")
        val memo = OptionLetters()
        val first = memo.of(v)
        assertEquals(v.options.indices.map { OptionLetters.letterOf(it) }, v.options.map { first.getValue(it.id) })
        assertEquals('A', first.getValue(v.options.first().id))
        // The host hides card B: C stays C (no shift under the couch's feet), B is simply gone from the board.
        val hidden = v.options[1].id
        val after = memo.of(v.copy(options = v.options.filter { it.id != hidden }))
        for (o in v.options.filter { it.id != hidden }) assertEquals(first[o.id], after[o.id])
        // The reveal of the same prompt keeps them; the next prompt starts again at A.
        assertEquals(first[v.options[2].id], memo.of(v.copy(phase = BluffPhase.REVEAL))[v.options[2].id])
        val next = memo.of(v.copy(promptIndex = v.promptIndex + 1, options = v.options.reversed()))
        assertEquals('A', next.getValue(v.options.last().id))
    }

    @Test fun theAfterHideFixtureKeepsTheSurvivorsLetters() {
        val before = BluffFixtures.view("voting")
        val after = BluffFixtures.view("voting.after_hide")
        val memo = OptionLetters()
        val first = memo.of(before)
        val second = memo.of(after)
        if (before.n == after.n && before.promptIndex == after.promptIndex && before.prompt?.id == after.prompt?.id) {
            for (o in after.options) if (o.id in first) assertEquals(o.id, first[o.id], second[o.id])
        }
        assertEquals(after.options.size, after.options.mapNotNull { second[it.id] }.distinct().size)
    }

    @Test fun lettersAreWesternUpToThirteenCards() {
        assertEquals("ABCDEFGHIJKLM", (0 until 13).map { OptionLetters.letterOf(it) }.joinToString(""))
    }

    // ---------------------------------------------------------------- the host's pause path (GAME-BLUFF §5.4)

    @Test fun pauseHideOpensThePickerWhoseOkSendsHideOptionWithTheCardId() {
        val v = BluffFixtures.view("voting").let { if (it.hidesLeft > 0) it else it.copy(hidesLeft = 1) }
        assertTrue("the fixture has a card to hide", v.options.size > 2)
        assertEquals(BluffTv.PauseAction.PickOptionToHide, BluffTv.pauseAction("HIDE_OPTION", v))
        // The picker opens on card 0 (A); the host moves down once and presses OK.
        val picker = HidePicker(v.options.map { it.id }, rtl = false)
        assertEquals(0, picker.focus)
        assertTrue(picker.move(RemoteKey.DOWN))
        val intent = picker.confirm()!!
        assertEquals(GameIds.BLUFF, intent.gameId)
        assertEquals(JsonPrimitive("HIDE_OPTION"), intent.i["type"])
        assertEquals(JsonPrimitive(v.options[1].id), intent.i["optionId"])
    }

    @Test fun pauseItemsAreUnavailableWhenNothingIsLeft() {
        val voting = BluffFixtures.view("voting")
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("HIDE_OPTION", voting.copy(hidesLeft = 0)))
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("HIDE_OPTION", voting.copy(options = voting.options.take(2), hidesLeft = 1)))
        val writing = BluffFixtures.view("writing")
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("SKIP_PROMPT", writing.copy(skipsLeft = 0)))
        val skip = BluffTv.pauseAction("SKIP_PROMPT", writing.copy(skipsLeft = 1)) as BluffTv.PauseAction.Send
        assertEquals(JsonPrimitive("SKIP_PROMPT"), skip.intent.i["type"])
        assertEquals(JsonPrimitive(writing.prompt!!.id), skip.intent.i["promptId"])
        assertEquals(BluffTv.PauseAction.Unavailable, BluffTv.pauseAction("SKIP_PROMPT", voting.copy(skipsLeft = 1)))
    }

    // ---------------------------------------------------------------- rules ⓘ bodies (GAME-BLUFF §10.2)

    private val locales = listOf("values", "values-fr", "values-ar", "values-es")

    /** `res/<dir>/strings_game_bluff.xml` as name → text (Android escapes undone). */
    private fun strings(dir: String): Map<String, String> {
        val xml = java.io.File("src/main/res/$dir/strings_game_bluff.xml").readText(Charsets.UTF_8)
        return Regex("""<string name="([^"]+)">(.*?)</string>""", RegexOption.DOT_MATCHES_ALL).findAll(xml)
            .associate { it.groupValues[1] to it.groupValues[2].replace("\\'", "'").replace("\\\"", "\"").replace("&amp;", "&").replace("&lt;", "<").replace("&gt;", ">") }
    }

    @Test fun noRuleBodyShowsARawPlaceholderInAnyLanguage() {
        val sections = GameCatalog.BLUFF.ruleSections
        assertTrue(sections.isNotEmpty())
        for (dir in locales) {
            val res = strings(dir)
            for (pace in listOf("relaxed", "normal", "fast", null)) {
                for (sec in sections) {
                    val name = sec.bodyKey.replace(".", "__")
                    val raw = res[name] ?: error("$dir lacks $name")
                    val args = BluffTv.ruleArgs(sec.id, null)
                    val text = if (args.isEmpty()) raw else String.format(java.util.Locale.ROOT, raw, *args)
                    assertTrue("$dir ${sec.id} pace=$pace: $text", '%' !in text)
                }
            }
        }
    }

    @Test fun writingSecondsFollowThePace() {
        val setupRoom = BluffFixtures.state("s2c.state.tv.setup.bluff.json").view.room
        val pace = BluffTv.setupView(setupRoom)!!.settings.pace
        assertEquals(BluffTv.WRITING_SECONDS.getValue(pace).toString(), BluffTv.ruleArgs("writing", setupRoom).single())
        // In game (no Bluff setup in the room view) the last seen pace stays; other sections take no argument.
        val game = BluffFixtures.room("writing").room
        assertEquals(BluffTv.WRITING_SECONDS.getValue(pace).toString(), BluffTv.ruleArgs("writing", game).single())
        assertEquals(0, BluffTv.ruleArgs("voting", game).size)
        assertEquals(setOf("90", "60", "45"), BluffTv.WRITING_SECONDS.values.map { it.toString() }.toSet())
    }

    // ---------------------------------------------------------------- coins, rail, odometer (DESIGN-JAMAA §5.1/§5.2)

    @Test fun eachVoterSitsInItsOwnSlotAndItsCoinLeavesFromThere() {
        assertEquals(0f, BluffBoard.travellerDx(0, 1), 0f)
        assertEquals(listOf(-46f, 0f, 46f), (0 until 3).map { BluffBoard.travellerDx(it, 3) })
        assertEquals(listOf(-23f, 23f), (0 until 2).map { BluffBoard.travellerDx(it, 2) })
        // Distinct voters' coins of one lie leave from distinct slots.
        for ((name, r, s) in BluffFixtures.allReveals()) {
            val sc = BluffScript.build(r, s, reduced = false)
            for (seg in sc.segments) {
                val voters = seg.step?.voterIds ?: continue
                val sources = sc.coins.filter { it.segment == seg.index }.mapNotNull { (it.from as? CoinSource.Voter)?.playerId }.distinct()
                assertTrue(name, sources.all { it in voters })
                val slots = sources.map { BluffBoard.travellerDx(voters.indexOf(it), voters.size) }
                assertEquals(name, slots.size, slots.distinct().size)
            }
        }
    }

    @Test fun theRailWaitsUnderTheBackHintThenComesUp() {
        assertEquals(BluffBoard.BACK_HINT_SLOT_DP, BluffBoard.railHintShiftDp(0), 0f)
        assertEquals(BluffBoard.BACK_HINT_SLOT_DP, BluffBoard.railHintShiftDp(GameChrome.HINT_AFTER_PHASE_MS - 1), 0f)
        val mid = BluffBoard.railHintShiftDp(GameChrome.HINT_AFTER_PHASE_MS + 150)
        assertTrue(mid > 0f && mid < BluffBoard.BACK_HINT_SLOT_DP)
        assertEquals(0f, BluffBoard.railHintShiftDp(GameChrome.HINT_AFTER_PHASE_MS + 300), 0f)
        assertEquals(0f, BluffBoard.railHintShiftDp(60_000), 0f)
    }

    @Test fun theOdometerRollsOneColumnPerPlace() {
        assertEquals(3, BluffOdometer.places(450))
        assertEquals(1, BluffOdometer.places(0))
        // 349 → 350: the ones turn continuously, the tens turn only while the ones pass 9 → 0, the hundreds stay.
        assertEquals(9.5, BluffOdometer.column(349.5, 0), 1e-9)
        assertEquals(4.5, BluffOdometer.column(349.5, 1), 1e-9)
        assertEquals(3.0, BluffOdometer.column(349.5, 2), 1e-9)
        assertEquals(4.0, BluffOdometer.column(345.5, 1), 1e-9)
        // 399.5: every column is half-way to the next digit (a full carry).
        assertEquals(9.5, BluffOdometer.column(399.5, 1), 1e-9)
        assertEquals(3.5, BluffOdometer.column(399.5, 2), 1e-9)
        // Whole values read their digits exactly.
        for (n in listOf(100, 207, 999, 1_250)) {
            val digits = n.toString().reversed().map { it - '0' }
            for ((k, d) in digits.withIndex()) assertEquals("$n place $k", d.toDouble(), BluffOdometer.column(n.toDouble(), k), 1e-9)
        }
    }
}
