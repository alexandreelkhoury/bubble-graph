package app.mishana.tv.billing

import android.app.Application
import kotlinx.coroutines.CoroutineScope

/**
 * PAYMENTS-SPEC §4.1 / §3.10 defence in depth: release builds always use Google Play. The fake gateway lives only in the
 * debug source set, so it is not part of a release APK at all.
 */
object GatewayFactory {
    @Suppress("UNUSED_PARAMETER")
    fun create(
        app: Application,
        scope: CoroutineScope,
        api: BillingApi,
        installId: () -> String,
        serverUrl: () -> String,
    ): BillingGateway = PlayBillingGateway(app)
}
