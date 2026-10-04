package app.mishana.tv.billing

import android.app.Application
import app.mishana.tv.settings.DebugPrefs
import kotlinx.coroutines.CoroutineScope

/**
 * PAYMENTS-SPEC §4.1 / §4.8 (debug builds only): [FakeBillingGateway] wraps the real gateway and takes over while
 * `DebugPrefs.fakeBilling` is on **and** the server's catalog says `mode:"fake"`; otherwise every call goes to Play.
 */
object GatewayFactory {
    fun create(
        app: Application,
        scope: CoroutineScope,
        api: BillingApi,
        installId: () -> String,
        serverUrl: () -> String,
    ): BillingGateway = FakeBillingGateway(
        play = PlayBillingGateway(app),
        prefs = DebugPrefs(app),
        api = api,
        installId = installId,
        serverUrl = serverUrl,
        scope = scope,
    )
}
