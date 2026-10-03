package app.mishana.tv.i18n

import androidx.appcompat.app.AppCompatDelegate
import androidx.core.os.LocaleListCompat
import java.util.Locale

/** Per-app language (AppCompat; stored automatically on API < 33 by AppLocalesMetadataHolderService). */
object LocaleController {
    val SUPPORTED: List<String> = listOf("en", "fr", "ar")

    fun set(tag: String) {
        AppCompatDelegate.setApplicationLocales(LocaleListCompat.forLanguageTags(tag))
    }

    /** en | fr | ar: the app language if set, else the system language if supported, else en. */
    fun currentLanguage(): String {
        val app = AppCompatDelegate.getApplicationLocales()
        val lang = if (!app.isEmpty) app.get(0)?.language else Locale.getDefault().language
        return normalize(lang)
    }

    fun normalize(lang: String?): String = when (lang?.lowercase()) {
        "fr" -> "fr"
        "ar" -> "ar"
        else -> "en"
    }
}
