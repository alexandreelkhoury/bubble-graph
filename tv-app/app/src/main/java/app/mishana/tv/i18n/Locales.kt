package app.mishana.tv.i18n

import app.mishana.tv.Constants

/** The supported languages (UI and word packs): SPEC §3 `LOCALES`, from the one table in [Constants]. Pure. */
object Locales {
    val ALL: List<String> get() = Constants.LOCALES

    /** en | fr | ar: any other (or missing) language falls back to en. */
    fun normalize(lang: String?): String = lang?.lowercase()?.takeIf { it in ALL } ?: "en"
}

/** Message keys the TV compares against (generated keys live in I18nKeys; these are the ones code branches on). */
object MessageKeys {
    const val ROOM_EXPIRED = "error.roomExpired"
    const val INTERNAL = "error.internal"

    /** Local sentinel for a failed POST /api/rooms without a server error code (`tv.createFailed`). */
    const val TV_CREATE_FAILED = "tv.createFailed"
}
