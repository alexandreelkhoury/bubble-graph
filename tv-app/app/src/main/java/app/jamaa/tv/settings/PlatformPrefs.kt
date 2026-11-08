package app.jamaa.tv.settings

import android.content.Context
import app.jamaa.tv.games.GameIds

/**
 * Per-device platform settings (JAMAA-PLATFORM §3.2, §3.8): the first-time How to play flags `intro_seen_<gameId>`
 * and the hub's **Calm animations** toggle, in SharedPreferences "jamaa_prefs" (next to the sound mute).
 */
interface PlatformPrefs {
    fun introSeen(gameId: String): Boolean
    fun setIntroSeen(gameId: String)

    /** Hub Settings → "Show how-to again": clears every game's flag. */
    fun clearIntros()
    var calmMotion: Boolean
}

class SharedPlatformPrefs(context: Context) : PlatformPrefs {
    private val prefs = context.applicationContext.getSharedPreferences(SoundPrefs.FILE, Context.MODE_PRIVATE)

    override fun introSeen(gameId: String): Boolean = prefs.getBoolean(introKey(gameId), false)

    override fun setIntroSeen(gameId: String) {
        prefs.edit().putBoolean(introKey(gameId), true).apply()
    }

    override fun clearIntros() {
        val e = prefs.edit()
        for (id in GameIds.ALL) e.remove(introKey(id))
        e.apply()
    }

    override var calmMotion: Boolean
        get() = prefs.getBoolean(KEY_CALM, false)
        set(value) {
            prefs.edit().putBoolean(KEY_CALM, value).apply()
        }

    companion object {
        const val KEY_CALM = "calm_motion"
        fun introKey(gameId: String): String = "intro_seen_$gameId"
    }
}

/** In-memory prefs (tests, previews). */
class MemoryPlatformPrefs(seen: Set<String> = emptySet(), calm: Boolean = false) : PlatformPrefs {
    private val seenIds = seen.toMutableSet()
    override fun introSeen(gameId: String): Boolean = gameId in seenIds
    override fun setIntroSeen(gameId: String) {
        seenIds += gameId
    }
    override fun clearIntros() = seenIds.clear()
    override var calmMotion: Boolean = calm
}
