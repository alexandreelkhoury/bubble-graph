package app.mishana.tv.game

import android.app.Application
import app.mishana.tv.i18n.LocaleController
import app.mishana.tv.net.RoomApi
import app.mishana.tv.net.RoomSocket
import app.mishana.tv.audio.SoundPoolPlayer
import app.mishana.tv.settings.DebugPrefs
import app.mishana.tv.settings.SoundPrefs

/** Real dependencies: server URL resolution (SPEC §9.4), app language, OkHttp API and socket, SoundPool cues. */
internal fun productionDeps(app: Application): GameDeps {
    val prefs = DebugPrefs(app)
    val soundPrefs = SoundPrefs(app)
    return GameDeps(
        serverUrl = { prefs.effectiveServerUrl() },
        appLocale = { LocaleController.currentLanguage() },
        createRoom = { baseUrl, locale -> RoomApi.createRoom(baseUrl, locale) },
        newConnection = { scope, url -> RoomSocket(serverUrl = url, scope = scope) },
        sound = SoundPoolPlayer(app),
        loadMuted = { soundPrefs.muted },
        saveMuted = { soundPrefs.muted = it },
    )
}
