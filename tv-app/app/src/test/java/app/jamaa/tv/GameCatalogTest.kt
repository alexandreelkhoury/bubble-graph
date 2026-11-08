package app.jamaa.tv

import app.jamaa.tv.games.GameCatalog
import app.jamaa.tv.games.GameDecoders
import app.jamaa.tv.games.GameIds
import app.jamaa.tv.games.SettingFieldSpec
import app.jamaa.tv.i18n.I18nKeys
import app.jamaa.tv.platform.RulesContent
import app.jamaa.tv.protocol.TvGame
import org.junit.Assert.assertEquals
import org.junit.Assert.assertTrue
import org.junit.Test
import java.io.File

/** The TV mirror of GAME_META (JAMAA-PLATFORM §2.2) against the shared metas and the generated i18n tables. */
class GameCatalogTest {
    private val shared = File(Fixtures.dir, "../src/games")

    @Test
    fun registryOrderAndSupportedGames() {
        assertEquals(GameIds.ALL, GameCatalog.ALL.map { it.id })
        assertEquals(GameIds.ALL, GameDecoders.modules.keys.toList())
        // This build renders Mish Ana! only; the G lanes flip their own module to implemented.
        assertEquals(listOf(TvGame("mishana", 1)), GameDecoders.supported())
        assertTrue(GameDecoders.isSupported("mishana"))
        assertTrue(!GameDecoders.isSupported("bluff"))
    }

    /** Each mirror agrees with shared/src/games/<id>/meta.ts on the values the TV relies on. */
    @Test
    fun mirrorsTheSharedMetas() {
        for (m in GameCatalog.ALL) {
            // A G lane may move values into games/<id>/constants.ts: inline them (`minPlayers: MIN_PLAYERS`, `VIEW_VERSION,`).
            var ts = File(shared, "${m.id}/meta.ts").readText()
            val consts = File(shared, "${m.id}/constants.ts").takeIf { it.isFile }?.readText().orEmpty()
            for (c in Regex("""export const ([A-Z_]+)\s*=\s*([0-9_]+)""").findAll(consts)) {
                val (name, value) = c.destructured
                val v = value.replace("_", "")
                ts = ts.replace(Regex(""": $name,"""), ": $v,").replace(Regex("""\b$name,"""), "$name: $v,")
            }
            assertTrue(m.id, ts.contains("VIEW_VERSION: ${m.viewVersion},"))
            assertTrue(m.id, ts.contains("minPlayers: ${m.minPlayers},") && ts.contains("maxPlayers: ${m.maxPlayers},"))
            assertTrue(m.id, ts.contains("durationMinutes: [${m.durationMinutes.first}, ${m.durationMinutes.second}]"))
            assertTrue(m.id, ts.contains("world: \"${m.world}\""))
            assertTrue(m.id, ts.contains("carriesScore: ${m.carriesScore},"))
            for (p in m.pauseItems) assertTrue("${m.id} ${p.id}", ts.contains("intent: \"${p.intent}\""))
            for (r in m.ruleSections) assertTrue("${m.id} ${r.id}", ts.contains("id: \"${r.id}\""))
            for (f in m.basic) assertTrue("${m.id} ${f.key}", ts.contains("key: \"${f.key}\""))
        }
    }

    /** Every key the hub, setup, ⓘ sheet and pause menu resolve exists in the generated tables (else error.internal). */
    @Test
    fun everyPlatformKeyResolves() {
        val missing = mutableListOf<String>()
        fun need(k: String) { if (k !in I18nKeys.strings) missing += k }
        for (m in GameCatalog.ALL) {
            need(m.titleKey); need(m.taglineKey)
            for (r in m.ruleSections) { need(r.titleKey); need(r.bodyKey) }
            if (m.id == GameIds.MISHANA) {
                m.howToKeys.forEach(::need)
                m.pauseItems.forEach { need(it.labelKey) }
                for (f in m.basic) {
                    need(f.labelKey)
                    if (f is SettingFieldSpec.Choice) f.options.forEach { need(it.labelKey) }
                }
            }
        }
        RulesContent.HOW_JAMAA_WORKS.forEach(::need)
        listOf(
            "hub.gameUnsupported", "hint.backMenu", "settings.calmMotion", "settings.showHowTo", "hub.closeConfirm.title",
            "hub.closeConfirm.stay", "rules.youAreHere", "rules.title", "setup.start", "setup.advanced", "setup.content",
            "pass.planMonthly", "pass.planYearly", "pass.save", "pass.manage", "pass.fixPayment", "cup.title",
            "game.mishana.settings.timersCustom",
        ).forEach(::need)
        if ("pass.trialBadge" !in I18nKeys.plurals) missing += "pass.trialBadge (plural)"
        assertEquals("keys without a string", emptyList<String>(), missing)
    }
}
