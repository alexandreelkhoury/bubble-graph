package app.mishana.tv.ui.screens

/**
 * Lobby start-column metrics (DESIGN TV-02), kept free of Android types so a JVM test can check them against the
 * real Cairo font files (LobbyMetricsTest): the widest possible room code and a long join host must fit the column
 * in one line at the minimum sizes the fit-to-width text may step down to.
 */
object LobbyMetrics {
    /** Width of the QR / code / host column. */
    const val START_COLUMN_DP = 264

    /** Room code: 72 dp at most (DESIGN), stepping down to [CODE_MIN_DP]; tracked letters, no joined spaces. */
    const val CODE_MAX_DP = 72
    const val CODE_MIN_DP = 44
    const val CODE_TRACKING_EM = 0.2

    /** Join host line: body 20 dp at most, stepping down to [HOST_MIN_DP] for long hosts (never ellipsized). */
    const val HOST_MAX_DP = 20
    const val HOST_MIN_DP = 13
}
