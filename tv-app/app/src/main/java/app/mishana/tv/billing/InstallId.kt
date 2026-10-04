package app.mishana.tv.billing

import android.content.Context
import java.security.MessageDigest
import java.security.SecureRandom

/**
 * PAYMENTS-SPEC §2.1: 32 lowercase hex characters (16 bytes from SecureRandom), created on first launch and stored in
 * SharedPreferences `mishana_billing` / `install_id` (excluded from backup and device transfer, see the manifest).
 * Its [hash] is the Play `obfuscatedAccountId` and the entitlement token `sub`. The raw id leaves the TV only inside
 * HTTPS request bodies; it is never logged.
 */
object InstallId {
    val REGEX = Regex("^[0-9a-f]{32}$")

    fun get(ctx: Context): String = PrefsEntitlementStore(ctx).installId()

    /**
     * Settings → About (PAYMENTS-SPEC §3.12): the id in eight groups of four ("0123 4567 …") so the owner can read it
     * off the screen for `pnpm grant` (which drops the spaces again).
     */
    fun display(id: String): String = id.chunked(4).joinToString(" ")

    /** sha256 hex, lowercase (64 characters). */
    fun hash(id: String): String =
        MessageDigest.getInstance("SHA-256").digest(id.toByteArray(Charsets.US_ASCII)).joinToString("") { "%02x".format(it) }

    fun generate(random: SecureRandom = SecureRandom()): String {
        val bytes = ByteArray(16)
        random.nextBytes(bytes)
        return bytes.joinToString("") { "%02x".format(it) }
    }
}
