package app.mishana.tv.ui.screens

/**
 * Lobby start-column metrics (DESIGN TV-02), kept free of Android types so a JVM test can check them against the
 * real Cairo font files (LobbyMetricsTest): the widest possible room code and a long join host must fit the column
 * in one line at the minimum sizes the fit-to-width text may step down to.
 */
object LobbyMetrics {
    /** Width of the start column (wordmark + join ticket). */
    const val START_COLUMN_DP = 264

    /** The wordmark heading the start column: the lobby is the brand's billboard while people arrive. */
    const val WORDMARK_DP = 196

    /** The join ticket's side padding, and the width its code and host line fit in. */
    const val TICKET_PAD_DP = 12
    const val TICKET_INNER_DP = START_COLUMN_DP - 2 * TICKET_PAD_DP

    /** The QR panel inside the ticket (the budget that fits the 486 dp live height with the 196 dp wordmark). */
    const val QR_DP = 200

    /** Room code: 64 dp at most (DESIGN TV-02 ticket), stepping down to [CODE_MIN_DP]; tracked letters, no joined spaces. */
    const val CODE_MAX_DP = 64
    const val CODE_MIN_DP = 44
    const val CODE_TRACKING_EM = 0.2

    /** Join host line: body Bold 20 dp at most, stepping down to [HOST_MIN_DP] for long hosts (never ellipsized). */
    const val HOST_MAX_DP = 20
    const val HOST_MIN_DP = 12

    // ---- PAYMENTS-SPEC §4.4 bottom bar fit: "Premium · Settings · Language · Start" from x 370 dp to the end margin ----

    /** 960 − 48 (end safe margin) − 370 (where the end column starts). */
    const val BAR_WIDTH_DP = 542

    /** MishButton: 24 dp padding each side, a 24 dp icon and a 10 dp gap before the label. */
    const val BUTTON_CHROME_DP = 24 + 24 + 24 + 10
    const val START_MIN_DP = 200
    const val BAR_GAP_DP = 16
    const val ICON_ONLY_DP = 48

    /** The button label style (`label`): 20 sp, tracking 0.02 em in Latin, 0 in Arabic. */
    const val LABEL_DP = 20

    /** Width of one labelled MishButton whose label advances [labelEm] em (tracking included). */
    fun buttonDp(labelEm: Double, minDp: Int = 0): Double = maxOf(minDp.toDouble(), labelEm * LABEL_DP + BUTTON_CHROME_DP)

    /** The bar's width; a null label width means that button is icon-only (48 dp). */
    fun barDp(premiumEm: Double?, settingsEm: Double, languageEm: Double?, startEm: Double): Double =
        (premiumEm?.let { buttonDp(it) } ?: ICON_ONLY_DP.toDouble()) + buttonDp(settingsEm) +
            (languageEm?.let { buttonDp(it) } ?: ICON_ONLY_DP.toDouble()) + buttonDp(startEm, START_MIN_DP) + 3 * BAR_GAP_DP

    /** Which bar buttons drop their label (icon-only 48 × 48 dp, focus tooltip + contentDescription). */
    enum class BarVariant(val premiumIconOnly: Boolean, val languageIconOnly: Boolean) {
        ALL_LABELLED(false, false),
        PREMIUM_ICON(true, false),
        PREMIUM_AND_LANGUAGE_ICON(true, true),
    }

    /**
     * The richest variant that fits [BAR_WIDTH_DP] in UI language [lang], decided by LobbyBarFitTest with the real Cairo
     * Bold metrics. Measured 2026-10-04: Settings + Language + Start alone already take ~537 / 555 / 569 dp in
     * EN / FR / AR, so even an icon-only Premium overflows; the Language button (globe) goes icon-only too.
     * PAY-GAP: §4.4 only foresees an icon-only Premium; the Language fallback is B's conservative extension.
     */
    @Suppress("UNUSED_PARAMETER")
    fun barVariant(lang: String): BarVariant = BarVariant.PREMIUM_AND_LANGUAGE_ICON
}
