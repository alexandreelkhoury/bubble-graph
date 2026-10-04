package app.mishana.tv.billing

import android.content.Context
import app.mishana.tv.protocol.EntitlementBody
import kotlinx.serialization.json.Json

/** The last entitlement the server returned and when it was saved (`ent_saved_at`, the "older than 1 h" clock). */
data class SavedEntitlement(val body: EntitlementBody, val savedAt: Long)

/** PAYMENTS-SPEC §4.1 persistence. Tests use an in-memory implementation. */
interface EntitlementStore {
    /** Creates the install id on first use. */
    fun installId(): String
    fun load(): SavedEntitlement?
    fun save(body: EntitlementBody, savedAt: Long)
}

/** SharedPreferences `mishana_billing`: `install_id`, `ent_token`, `ent_json` (last EntitlementBody), `ent_saved_at`. */
class PrefsEntitlementStore(context: Context) : EntitlementStore {
    private val prefs = context.applicationContext.getSharedPreferences(FILE, Context.MODE_PRIVATE)

    @Synchronized
    override fun installId(): String {
        val existing = prefs.getString(KEY_INSTALL_ID, null)
        if (existing != null && InstallId.REGEX.matches(existing)) return existing
        val id = InstallId.generate()
        // commit (not apply): two racing first launches must not end up with two ids.
        prefs.edit().putString(KEY_INSTALL_ID, id).commit()
        return id
    }

    override fun load(): SavedEntitlement? {
        val json = prefs.getString(KEY_ENT_JSON, null) ?: return null
        val body = try {
            JSON.decodeFromString(EntitlementBody.serializer(), json)
        } catch (e: Exception) {
            return null
        }
        return SavedEntitlement(body, prefs.getLong(KEY_ENT_SAVED_AT, 0L))
    }

    override fun save(body: EntitlementBody, savedAt: Long) {
        prefs.edit()
            .putString(KEY_ENT_TOKEN, body.token)
            .putString(KEY_ENT_JSON, JSON.encodeToString(EntitlementBody.serializer(), body))
            .putLong(KEY_ENT_SAVED_AT, savedAt)
            .apply()
    }

    companion object {
        /** Writes nulls explicitly, so the stored body always decodes back. */
        private val JSON = Json { ignoreUnknownKeys = true }

        /** Also named in res/xml/backup_rules.xml and data_extraction_rules.xml (excluded from backup). */
        const val FILE = "mishana_billing"
        const val KEY_INSTALL_ID = "install_id"
        const val KEY_ENT_TOKEN = "ent_token"
        const val KEY_ENT_JSON = "ent_json"
        const val KEY_ENT_SAVED_AT = "ent_saved_at"
    }
}
