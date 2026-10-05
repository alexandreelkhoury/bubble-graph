package app.mishana.tv.i18n

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.stringResource
import app.mishana.tv.R

/** Resolves a server `messageKey` (or any non-plural §11.2 key) via D's generated map (SPEC §11.3 rule 5). */
@StringRes
fun messageKeyRes(key: String): Int = I18nKeys.strings[key] ?: R.string.error__internal

@Composable
@ReadOnlyComposable
fun messageText(key: String): String = stringResource(messageKeyRes(key))

/** Wraps user-provided text (player names) in FSI…PDI so mixed-script strings keep their punctuation (DESIGN §3.4). */
fun isolate(text: String): String = "⁨$text⁩"

/**
 * "Ben, Eli and Maya" (or "Ben or Eli" with [or]) in the UI language, each name isolated (web parity: `listOf`,
 * Intl.ListFormat). ICU's OR lists exist from API 33; below that, [fallbackSeparator] joins them (e.g. " vs ").
 */
@Composable
@ReadOnlyComposable
fun nameList(names: List<String>, or: Boolean = false, fallbackSeparator: String = ", "): String {
    val isolated = names.map(::isolate)
    if (isolated.size < 2) return isolated.joinToString("")
    val locale = androidx.compose.ui.platform.LocalConfiguration.current.locales.get(0) ?: java.util.Locale.ROOT
    return when {
        or && android.os.Build.VERSION.SDK_INT >= 33 -> android.icu.text.ListFormatter
            .getInstance(locale, android.icu.text.ListFormatter.Type.OR, android.icu.text.ListFormatter.Width.WIDE)
            .format(isolated)
        or -> isolated.joinToString(fallbackSeparator)
        else -> android.icu.text.ListFormatter.getInstance(locale).format(isolated)
    }
}
