package app.jamaa.tv.platform

/**
 * JAMAA-PLATFORM §3.8 "Lite motion" and "Reduced motion" (pure; JVM-tested).
 * - **Reduced** (wins over everything): `ANIMATOR_DURATION_SCALE == 0` or the hub's Calm animations toggle. Every
 *   choreography uses its `reduced` variant.
 * - **Lite**: `ActivityManager.isLowRamDevice()` or `memoryClass < 192` [VERIFY threshold on the TCL], or the hidden
 *   debug toggle. Ambient loops ≤ 4 elements, no blur / RenderEffect, at most one Lottie, halved particles.
 */
data class MotionMode(val reduced: Boolean, val lite: Boolean) {
    /** Ambient loop element cap for a world (§3.4: ≤ 12 normally). */
    val ambientElements: Int get() = when {
        reduced -> 0
        lite -> LITE_AMBIENT_ELEMENTS
        else -> FULL_AMBIENT_ELEMENTS
    }

    /** Particle count after the lite halving (reduced: none). */
    fun particles(full: Int): Int = when {
        reduced -> 0
        lite -> full / 2
        else -> full
    }

    /** The 128 × 128 stage grain is off in lite and calm motion (and during the portal and entrance). */
    val grain: Boolean get() = !reduced && !lite

    /** Blur and RenderEffect are never used in lite motion. */
    val blur: Boolean get() = !reduced && !lite

    companion object {
        const val LITE_MEMORY_CLASS_MB = 192 // [VERIFY] on the reference low-end TV
        const val LITE_AMBIENT_ELEMENTS = 4
        const val FULL_AMBIENT_ELEMENTS = 12

        fun decide(
            animatorDurationScale: Float,
            calmPref: Boolean,
            isLowRamDevice: Boolean,
            memoryClassMb: Int,
            debugLite: Boolean = false,
        ): MotionMode {
            val reduced = animatorDurationScale == 0f || calmPref
            val lite = isLowRamDevice || memoryClassMb < LITE_MEMORY_CLASS_MB || debugLite
            return MotionMode(reduced = reduced, lite = lite)
        }
    }
}
