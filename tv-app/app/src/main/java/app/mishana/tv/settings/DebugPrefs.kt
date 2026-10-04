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

    /**
     * PAYMENTS-SPEC §4.8: debug builds only. "Billing: Google Play / Fake (server test store)". Release builds ignore it
     * (their GatewayFactory always returns PlayBillingGateway, and the fake gateway is not even compiled in).
     */
    var fakeBilling: Boolean
        get() = BuildConfig.DEBUG && prefs.getBoolean(KEY_FAKE_BILLING, false)
        set(value) {
            prefs.edit().putBoolean(KEY_FAKE_BILLING, value).apply()
        }

    /** §4.8: the fake store's purchases, one `productId|state|token` per line (debug builds only). */
    var fakePurchases: String
        get() = prefs.getString(KEY_FAKE_PURCHASES, null).orEmpty()
        set(value) {
            prefs.edit().putString(KEY_FAKE_PURCHASES, value).apply()
        }

    /** Debug: the override if not blank, else BuildConfig.SERVER_URL. Release: always BuildConfig.SERVER_URL. */
    fun effectiveServerUrl(): String =
        if (BuildConfig.DEBUG && serverUrl.isNotBlank()) serverUrl else BuildConfig.SERVER_URL

    companion object {
        const val FILE = "mishana_debug"
        const val KEY_SERVER_URL = "server_url"
        const val KEY_FAKE_BILLING = "fake_billing"
        const val KEY_FAKE_PURCHASES = "fake_purchases"
    }
}
