package app.mishana.tv.billing

import app.mishana.tv.protocol.PurchaseResults

/** What the UI does with a Play response code or a server answer (PAYMENTS-SPEC §4.6). Pure. */
sealed interface BillingErrorUi {
    /** Nothing to show (OK, USER_CANCELED). */
    data object None : BillingErrorUi

    /** A toast with this i18n key ([arg] fills its one placeholder, e.g. the support email). */
    data class Toast(val key: String, val arg: String? = null) : BillingErrorUi

    /** The Store goes to `Unavailable(BILLING_UNAVAILABLE)` until the next `ON_START`. */
    data object PlayUnavailable : BillingErrorUi

    /** `store.alreadyOwned`, then run restore. */
    data object AlreadyOwnedRestore : BillingErrorUi
}

object BillingErrors {
    const val NETWORK = "store.network"
    const val ITEM_UNAVAILABLE = "store.itemUnavailable"
    const val GENERIC = "store.errorGeneric"
    const val ALREADY_OWNED = "store.alreadyOwned"
    const val VERIFY_FAILED = "store.verifyFailed"
    const val INSTALL_LIMIT = "store.installLimit"
    const val INSTALL_LIMIT_NO_HELP = "store.installLimitNoHelp"
    const val RATE_LIMITED = "error.rateLimited"
    const val PLAY_UNAVAILABLE = "store.playUnavailable"

    /**
     * §4.6 table for `BillingClient.BillingResponseCode`. Sub-response codes (`PAYMENT_DECLINED_DUE_TO_INSUFFICIENT_FUNDS`,
     * `USER_INELIGIBLE`) are not specialised in v1: they arrive with a non-OK code and map like it (`store.errorGeneric`).
     */
    fun forPlayCode(code: Int): BillingErrorUi = when (code) {
        ResponseCodes.OK, ResponseCodes.USER_CANCELED -> BillingErrorUi.None
        ResponseCodes.SERVICE_UNAVAILABLE, ResponseCodes.NETWORK_ERROR, ResponseCodes.SERVICE_DISCONNECTED -> BillingErrorUi.Toast(NETWORK)
        ResponseCodes.BILLING_UNAVAILABLE -> BillingErrorUi.PlayUnavailable
        ResponseCodes.ITEM_UNAVAILABLE -> BillingErrorUi.Toast(ITEM_UNAVAILABLE)
        ResponseCodes.ITEM_ALREADY_OWNED -> BillingErrorUi.AlreadyOwnedRestore
        // DEVELOPER_ERROR, ERROR, FEATURE_NOT_SUPPORTED, ITEM_NOT_OWNED and anything unknown.
        else -> BillingErrorUi.Toast(GENERIC)
    }

    /** Whether a Play code should be logged with `Log.w` in debug builds (§4.6: developer-side failures). */
    fun isDeveloperSide(code: Int): Boolean =
        code == ResponseCodes.DEVELOPER_ERROR || code == ResponseCodes.ERROR || code == ResponseCodes.FEATURE_NOT_SUPPORTED

    /** §4.6 server rows: a per-purchase `result` of `/verify`. OK / PENDING / NOT_OWNED / INVALID / REVOKED show nothing. */
    fun forPurchaseResult(result: String, supportEmail: String = Products.SUPPORT_EMAIL): BillingErrorUi = when (result) {
        PurchaseResults.UPSTREAM_ERROR -> BillingErrorUi.Toast(VERIFY_FAILED)
        PurchaseResults.INSTALL_LIMIT -> installLimit(supportEmail)
        else -> BillingErrorUi.None
    }

    /** §4.6 server rows for a failed HTTP call: 429 → `error.rateLimited`; any other failure (5xx, network) → verify failed. */
    fun forHttpFailure(httpStatus: Int?, errorCode: String?): BillingErrorUi =
        if (httpStatus == 429 || errorCode == "RATE_LIMITED") BillingErrorUi.Toast(RATE_LIMITED) else BillingErrorUi.Toast(VERIFY_FAILED)

    /** `store.installLimit` with the support email, or the variant without the help sentence when none is set (§4.7). */
    fun installLimit(supportEmail: String): BillingErrorUi.Toast =
        if (supportEmail.isBlank()) BillingErrorUi.Toast(INSTALL_LIMIT_NO_HELP) else BillingErrorUi.Toast(INSTALL_LIMIT, supportEmail)
}
