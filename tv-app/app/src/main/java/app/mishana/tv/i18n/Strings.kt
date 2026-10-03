package app.mishana.tv.i18n

import androidx.annotation.StringRes
import androidx.compose.runtime.Composable
import androidx.compose.runtime.ReadOnlyComposable
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import app.mishana.tv.R

/** Resolves a server `messageKey` (or any non-plural §11.2 key) via D's generated map (SPEC §11.3 rule 5). */
@StringRes
fun messageKeyRes(key: String): Int = I18nKeys.strings[key] ?: R.string.error__internal

@Composable
@ReadOnlyComposable
fun messageText(key: String): String = stringResource(messageKeyRes(key))

/** Plural helper: `{count}` is always the first positional argument in the generated resources. */
@Composable
@ReadOnlyComposable
fun plural(id: Int, count: Int): String = pluralStringResource(id, count, count)

/** Wraps user-provided text (player names) in FSI…PDI so mixed-script strings keep their punctuation (DESIGN §3.4). */
fun isolate(text: String): String = "⁨$text⁩"

/** Room code / URLs: LTR isolate (LRI…PDI), never mirrored (DESIGN §3.5). */
fun ltr(text: String): String = "⁦$text⁩"
