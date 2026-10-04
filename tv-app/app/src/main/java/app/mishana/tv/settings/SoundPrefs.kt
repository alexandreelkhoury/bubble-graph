package app.mishana.tv.settings

import android.content.Context

/** The TV's sound setting (DESIGN §6.4 global mute, in Settings and the pause menu): SharedPreferences "mishana_prefs". */
class SoundPrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var muted: Boolean
        get() = prefs.getBoolean(KEY_MUTED, false)
        set(value) {
            prefs.edit().putBoolean(KEY_MUTED, value).apply()
        }

    companion object {
        const val FILE = "mishana_prefs"
        const val KEY_MUTED = "sound_muted"
    }
}
