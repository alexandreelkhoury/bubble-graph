package app.mishana.tv.ui.screens

/**
 * PAYMENTS-SPEC §4.4 Store layout metrics (dp), Android-free so StoreLayoutFitTest can check the hard fit rule with the
 * real Cairo fonts on the JVM: the Premium card (title + pitch, the "Unlock Premium · {price}" button, the one-time
 * purchase line) fits above the packs row without scrolling at the 20 sp floor in every shipped locale (960×540 dp
 * canvas, 48/27 dp safe margins).
 * The Compose screenshot half of §4.9 StoreLayoutTest still runs on the owner's machine.
 */
object StoreMetrics {
    const val CANVAS_W = 960
    const val CANVAS_H = 540
    const val SAFE_H = 48
    const val SAFE_V = 27
    const val CONTENT_W = CANVAS_W - 2 * SAFE_H // 864
    const val CONTENT_H = CANVAS_H - 2 * SAFE_V // 486

    const val HEADER_H = 40
    const val HEADER_GAP = 4

    const val CARD_PAD_H = 20
    const val CARD_PAD_V = 12
    const val CARD_INNER_W = CONTENT_W - 2 * CARD_PAD_H // 824
    const val CARD_GAP = 8
    const val TITLE_PITCH_GAP = 16

    /**
     * The one Premium button: a single line "Unlock Premium · $29.99" (titleS), at least [UNLOCK_MIN_W] wide and
     * growing with its label up to the card's inner width; 48 dp minimum height.
     */
    const val UNLOCK_MIN_W = 360
    const val UNLOCK_H = 52
    const val UNLOCK_PAD_H = 24

    /** Font size (sp) of the button label (MishType titleS). */
    const val UNLOCK_LABEL_SP = 22

    const val CARD_TO_PACKS = 6
    const val PACKS_TITLE_GAP = 0
    const val PACK_CARD_W = 232
    const val PACK_CARD_PAD_V = 8
    const val PACK_ROW_PAD_V = 4 // room for the 1.04 focus scale

    const val FOOTER_H = 48

    /**
     * The footer's single text line (§4.4): a pending purchase notice wins; then, while nothing is bought on this
     * account, `store.cardTip` (add a card on the phone, so nobody types a card number with the remote); else
     * `store.help`, hidden when there is no email.
     */
    enum class FooterLine { PENDING, CARD_TIP, HELP, NONE }

    /** Where `store.cardTip` sends the viewer: Google's own payment methods page (not another way to pay, so not steering). */
    const val CARD_TIP_URL = "pay.google.com"

    /** Widest the footer's text may be: the content width minus the Restore button and the Back label (both conservative). */
    const val FOOTER_TEXT_W = 520

    fun footerLine(pending: Boolean, supportEmail: String, ownsNothing: Boolean = false): FooterLine = when {
        pending -> FooterLine.PENDING
        ownsNothing -> FooterLine.CARD_TIP
        supportEmail.isNotBlank() -> FooterLine.HELP
        else -> FooterLine.NONE
    }

    /** Text lines the footer shows (at most one, so it fits FOOTER_H in every script). */
    fun footerLines(pending: Boolean, supportEmail: String, ownsNothing: Boolean = false): Int =
        if (footerLine(pending, supportEmail, ownsNothing) == FooterLine.NONE) 0 else 1

    /** Line heights of the type scale used here (MishType: Latin / Arabic). */
    fun titleLh(arabic: Boolean) = if (arabic) 40 else 32
    fun captionLh(arabic: Boolean) = if (arabic) 30 else 26
    fun labelLh(arabic: Boolean) = if (arabic) 30 else 24
    fun titleSLh(arabic: Boolean) = if (arabic) 34 else 28

    /** A pack card: title (titleS), pairs (caption), state (label), never clipped: 94 dp Latin, 110 dp Arabic. */
    fun packCardH(arabic: Boolean): Int = 2 * PACK_CARD_PAD_V + titleSLh(arabic) + captionLh(arabic) + labelLh(arabic)

    /** Height left for the Premium card once the header, the packs row and the footer are placed. */
    fun cardBudget(arabic: Boolean): Int =
        CONTENT_H - HEADER_H - HEADER_GAP - CARD_TO_PACKS - (labelLh(arabic) + PACKS_TITLE_GAP + packCardH(arabic) + 2 * PACK_ROW_PAD_V) - FOOTER_H

    /**
     * The Premium card's tallest form (not premium: the Unlock button and the `store.premiumLifetime` line) with
     * [pitchLines] lines of pitch and [lifetimeLines] lines of the one-time purchase note.
     */
    fun cardHeight(arabic: Boolean, pitchLines: Int, lifetimeLines: Int): Int =
        2 * CARD_PAD_V + maxOf(titleLh(arabic), pitchLines * captionLh(arabic)) + CARD_GAP + UNLOCK_H + CARD_GAP +
            lifetimeLines * captionLh(arabic)
}
