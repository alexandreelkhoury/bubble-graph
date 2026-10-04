package app.mishana.tv.billing

import app.mishana.tv.i18n.Locales

/**
 * PAYMENTS-SPEC §1.3 / §1.6: exact mirror of shared/src/billing/products.ts. ProductsTest checks it against
 * shared/fixtures/billing.products.json. Pure.
 */
object Products {
    const val PREMIUM_PRODUCT_ID = "premium"

    /** Display order on the TV is yearly first (§4.4); this list keeps the shared order. */
    val BASE_PLAN_IDS: List<String> = listOf("monthly", "yearly")
    const val BASE_PLAN_MONTHLY = "monthly"
    const val BASE_PLAN_YEARLY = "yearly"
    const val TRIAL_OFFER_ID = "trial-7d"
    const val PACK_PRODUCT_PREFIX = "pack_"
    const val PRODUCT_ID_MAX = 40
    const val PREMIUM_PACK_ID_MAX = PRODUCT_ID_MAX - PACK_PRODUCT_PREFIX.length // 35
    val PRODUCT_ID_REGEX = Regex("^[a-z0-9][a-z0-9_.]{0,39}$")
    private val PACK_REST_REGEX = Regex("^[a-z0-9]+(_[a-z0-9]+)*$")

    /** §1.6: settings only a premium room may change from the defaults. */
    val PREMIUM_SETTING_KEYS: List<String> = listOf("points")

    /**
     * §4.7 `{email}` = shared `SUPPORT_EMAIL` (the owner fills both; empty hides `store.help` and selects
     * `store.installLimitNoHelp`). Keep it equal to shared/src/billing/products.ts.
     */
    const val SUPPORT_EMAIL = ""

    /** The Play package name (applicationId); also used in the manage-subscription link. */
    const val PACKAGE_NAME = "app.mishana.tv"

    /** §4.4: the Play subscriptions page for this product. */
    const val MANAGE_SUBSCRIPTION_URL = "https://play.google.com/store/account/subscriptions?sku=premium&package=app.mishana.tv"

    /** "lb-food-01" → "pack_lb_food_01". */
    fun packProductId(packId: String): String = PACK_PRODUCT_PREFIX + packId.replace("-", "_")

    /** "pack_lb_food_01" → "lb-food-01"; null for anything that is not a well-formed pack product id. */
    fun packIdFromProductId(productId: String): String? {
        if (!productId.startsWith(PACK_PRODUCT_PREFIX)) return null
        val rest = productId.substring(PACK_PRODUCT_PREFIX.length)
        return if (PACK_REST_REGEX.matches(rest)) rest.replace("_", "-") else null
    }

    /** SPEC `languageOf(locale)`: "ar-LB" → "ar". */
    fun languageOf(locale: String): String = Locales.normalize(locale.substringBefore('-'))
}
