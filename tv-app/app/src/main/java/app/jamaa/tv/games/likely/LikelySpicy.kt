package app.jamaa.tv.games.likely

import kotlinx.serialization.json.JsonObject
import kotlinx.serialization.json.JsonPrimitive

/**
 * GAME-LIKELY §9.1, the TV's 18+ gate for Spicy mode (pure; JVM-tested). Spicy is compiled out until the platform
 * gives `settings.apply` an actor (shared `LIKELY_SPICY_ENABLED = false`): the `mode` row is not offered and the
 * server refuses `mode: "spicy"`. The gate is ready for when it lands:
 * - choosing "Spicy (18+)" opens a full-screen dialog whose **default focus is Cancel**;
 * - Back or Cancel closes it and sends nothing;
 * - only "We're all 18+" sends the patch, which carries `ageConfirmed: true` and switches secret votes on (§9.1.4);
 * - it is asked again every time (no "remember"); moving back to Family never asks.
 */
object LikelySpicy {
    /** Mirrors `LIKELY_SPICY_ENABLED` in shared/src/games/likely/meta.ts (checked by LikelySpicyTest). */
    const val ENABLED = false

    enum class Button { CANCEL, CONFIRM }

    /** The dialog's buttons in focus order; [DEFAULT_FOCUS] is where focus lands when it opens. */
    val BUTTONS: List<Button> = listOf(Button.CANCEL, Button.CONFIRM)
    val DEFAULT_FOCUS: Button = Button.CANCEL

    /** The patch the gate sends on confirm; null for Cancel or Back (nothing is sent). */
    fun onDialogResult(pressed: Button?): JsonObject? = if (pressed == Button.CONFIRM) spicyPatch() else null

    fun spicyPatch(): JsonObject = JsonObject(
        mapOf("mode" to JsonPrimitive("spicy"), "ageConfirmed" to JsonPrimitive(true), "showVoters" to JsonPrimitive(false)),
    )

    fun familyPatch(): JsonObject = JsonObject(mapOf("mode" to JsonPrimitive("family")))

    /** Whether selecting [target] on the mode row must open the gate first (only a move to Spicy does). */
    fun needsGate(current: LikelyMode, target: LikelyMode): Boolean = ENABLED && current != LikelyMode.SPICY && target == LikelyMode.SPICY
}
