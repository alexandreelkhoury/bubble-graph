package app.jamaa.tv.game

import android.app.ActivityManager
import android.app.Application
import android.content.Context
import app.jamaa.tv.platform.MotionMode
import app.jamaa.tv.settings.SharedPlatformPrefs
import android.util.Log
import app.jamaa.tv.BuildConfig
import app.jamaa.tv.billing.BillingRepository
import app.jamaa.tv.billing.EntitlementApi
import app.jamaa.tv.billing.GatewayFactory
import app.jamaa.tv.billing.PrefsEntitlementStore
import app.jamaa.tv.i18n.LocaleController
import app.jamaa.tv.net.RoomApi
import app.jamaa.tv.net.RoomSocket
import app.jamaa.tv.audio.SoundPoolPlayer
import app.jamaa.tv.settings.DebugPrefs
import app.jamaa.tv.settings.SoundPrefs
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
        billingEnabled = { baseUrl -> RoomApi.billingEnabled(baseUrl) },
        newConnection = { scope, url -> RoomSocket(serverUrl = url, scope = scope) },
        sound = SoundPoolPlayer(app),
        loadMuted = { soundPrefs.muted },
        saveMuted = { soundPrefs.muted = it },
        billing = BillingRuntime.get(app),
        installId = { PrefsEntitlementStore(app).installId() },
        prefs = SharedPlatformPrefs(app),
        motion = { calm -> deviceMotion(app, calm) },
    )
}

/** JAMAA-PLATFORM §3.8: reduced (animator scale 0 or Calm animations) and lite (low-RAM device) motion. */
private fun deviceMotion(app: Application, calm: Boolean): MotionMode {
    val am = app.getSystemService(Context.ACTIVITY_SERVICE) as ActivityManager
    val scale = android.provider.Settings.Global.getFloat(app.contentResolver, android.provider.Settings.Global.ANIMATOR_DURATION_SCALE, 1f)
    return MotionMode.decide(scale, calm, am.isLowRamDevice, am.memoryClass)
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
            warn = { msg -> if (BuildConfig.DEBUG) Log.w("JamaaBilling", msg) },
        ).also { it.start() }
    }
}
