package app.mishana.tv.settings

import android.content.Context
import app.mishana.tv.BuildConfig

/** Debug-only server override (SPEC §9.3/§9.4): SharedPreferences "mishana_debug", key "server_url". */
class DebugPrefs(context: Context) {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    var serverUrl: String
        get() = prefs.getString(KEY_SERVER_URL, null).orEmpty()
        set(value) {
            prefs.edit().putString(KEY_SERVER_URL, value.trim()).apply()
        }

    /** Debug: the override if not blank, else BuildConfig.SERVER_URL. Release: always BuildConfig.SERVER_URL. */
    fun effectiveServerUrl(): String =
        if (BuildConfig.DEBUG && serverUrl.isNotBlank()) serverUrl else BuildConfig.SERVER_URL

    companion object {
        const val FILE = "mishana_debug"
        const val KEY_SERVER_URL = "server_url"
    }
}
