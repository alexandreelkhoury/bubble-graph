package app.mishana.tv.game

import android.app.Application
import android.util.Log
import app.mishana.tv.BuildConfig
import app.mishana.tv.billing.BillingRepository
import app.mishana.tv.billing.EntitlementApi
import app.mishana.tv.billing.GatewayFactory
import app.mishana.tv.billing.PrefsEntitlementStore
import app.mishana.tv.i18n.LocaleController
import app.mishana.tv.net.RoomApi
import app.mishana.tv.net.RoomSocket
import app.mishana.tv.audio.SoundPoolPlayer
import app.mishana.tv.settings.DebugPrefs
import app.mishana.tv.settings.SoundPrefs
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.cancel

/** Real dependencies: server URL resolution (SPEC §9.4), app language, OkHttp API and socket, SoundPool cues, billing. */
internal fun productionDeps(app: Application): GameDeps {
    val prefs = DebugPrefs(app)
    val soundPrefs = SoundPrefs(app)
    return GameDeps(
        serverUrl = { prefs.effectiveServerUrl() },
        appLocale = { LocaleController.currentLanguage() },
        createRoom = { baseUrl, locale, entitlement -> RoomApi.createRoom(baseUrl, locale, entitlement) },
        newConnection = { scope, url -> RoomSocket(serverUrl = url, scope = scope) },
        sound = SoundPoolPlayer(app),
        loadMuted = { soundPrefs.muted },
        saveMuted = { soundPrefs.muted = it },
        billing = BillingRuntime.get(app),
        installId = { PrefsEntitlementStore(app).installId() },
    )
}

/**
 * PAYMENTS-SPEC §4.1: one [BillingRepository] (and one Play BillingClient) per process. It outlives the ViewModel and the
 * activity; MainActivity forwards ON_START / ON_RESUME / ON_STOP and ends the connection when it finishes.
 */
object BillingRuntime {
    @Volatile private var instance: BillingRepository? = null
    private var scope: CoroutineScope? = null

    fun get(app: Application): BillingRepository = instance ?: synchronized(this) {
        instance ?: create(app).also { instance = it }
    }

    /** `MainActivity.onDestroy` when finishing: `endConnection()`; an ended BillingClient is not reused (a new one is made). */
    fun release() = synchronized(this) {
        instance?.end()
        scope?.cancel()
        instance = null
        scope = null
    }

    private fun create(app: Application): BillingRepository {
        val prefs = DebugPrefs(app)
        val serverUrl = { prefs.effectiveServerUrl() }
        val store = PrefsEntitlementStore(app)
        val scope = CoroutineScope(SupervisorJob() + Dispatchers.Main.immediate).also { this.scope = it }
        val api = EntitlementApi(serverUrl)
        val gateway = GatewayFactory.create(app, scope, api, installId = { store.installId() }, serverUrl = serverUrl)
        return BillingRepository(
            gateway = gateway,
            api = api,
            store = store,
            scope = scope,
            // Release builds log nothing (§4.6: Log.w with the code, debug builds only). Never tokens or ids.
            warn = { msg -> if (BuildConfig.DEBUG) Log.w("MishBilling", msg) },
        ).also { it.start() }
    }
}
