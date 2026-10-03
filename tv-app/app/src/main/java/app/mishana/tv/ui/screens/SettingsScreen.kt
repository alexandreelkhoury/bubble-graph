package app.mishana.tv.ui.screens

import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.Row
import androidx.compose.foundation.layout.Spacer
import androidx.compose.foundation.layout.fillMaxSize
import androidx.compose.foundation.layout.fillMaxWidth
import androidx.compose.foundation.layout.height
import androidx.compose.foundation.layout.heightIn
import androidx.compose.foundation.layout.padding
import androidx.compose.foundation.layout.size
import androidx.compose.foundation.layout.width
import androidx.compose.foundation.layout.widthIn
import androidx.compose.foundation.lazy.LazyColumn
import androidx.compose.foundation.lazy.itemsIndexed
import androidx.compose.foundation.shape.RoundedCornerShape
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.ClickableSurfaceDefaults
import androidx.tv.material3.Icon
import androidx.tv.material3.Surface
import androidx.tv.material3.Text
import app.mishana.tv.Constants
import app.mishana.tv.IntBounds
import app.mishana.tv.R
import app.mishana.tv.game.SettingsStepper
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.ClientIntent
import app.mishana.tv.protocol.RoleMode
import app.mishana.tv.protocol.Settings
import app.mishana.tv.protocol.SettingsPatch
import app.mishana.tv.protocol.TieBreak
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.UpdateSettings
import app.mishana.tv.protocol.WinRule
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishFocus
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.OverlayCard
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.focusFallback
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.Job
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch

/** Merges [b] over [a] (non-null fields of b win). */
private fun merge(a: SettingsPatch?, b: SettingsPatch): SettingsPatch {
    if (a == null) return b
    return SettingsPatch(
        winRule = b.winRule ?: a.winRule,
        revealRoles = b.revealRoles ?: a.revealRoles,
        roleMode = b.roleMode ?: a.roleMode,
        undercoverCount = b.undercoverCount ?: a.undercoverCount,
        blankCount = b.blankCount ?: a.blankCount,
        clueSeconds = b.clueSeconds ?: a.clueSeconds,
        voteSeconds = b.voteSeconds ?: a.voteSeconds,
        revealSeconds = b.revealSeconds ?: a.revealSeconds,
        guessSeconds = b.guessSeconds ?: a.guessSeconds,
        tieBreak = b.tieBreak ?: a.tieBreak,
        blankGuess = b.blankGuess ?: a.blankGuess,
        wordLocale = b.wordLocale ?: a.wordLocale,
        // A word-language change resets packIds on the server unless the patch carries them (SPEC §4.4).
        packIds = b.packIds ?: if (b.wordLocale != null) null else a.packIds,
        difficulties = b.difficulties ?: a.difficulties,
        familyFilter = b.familyFilter ?: a.familyFilter,
        swapSides = b.swapSides ?: a.swapSides,
        points = b.points ?: a.points,
    )
}

private fun Settings.withDraft(p: SettingsPatch?): Settings {
    if (p == null) return this
    return copy(
        winRule = p.winRule ?: winRule,
        revealRoles = p.revealRoles ?: revealRoles,
        roleMode = p.roleMode ?: roleMode,
        undercoverCount = p.undercoverCount ?: undercoverCount,
        blankCount = p.blankCount ?: blankCount,
        clueSeconds = p.clueSeconds ?: clueSeconds,
        voteSeconds = p.voteSeconds ?: voteSeconds,
        revealSeconds = p.revealSeconds ?: revealSeconds,
        guessSeconds = p.guessSeconds ?: guessSeconds,
        tieBreak = p.tieBreak ?: tieBreak,
        blankGuess = p.blankGuess ?: blankGuess,
        wordLocale = p.wordLocale ?: wordLocale,
        packIds = p.packIds ?: if (p.wordLocale != null && p.wordLocale != wordLocale) emptyList() else packIds,
        difficulties = p.difficulties ?: difficulties,
        familyFilter = p.familyFilter ?: familyFilter,
        swapSides = p.swapSides ?: swapSides,
        points = p.points ?: points,
    )
}

/** One settings row: label, current value text, an optional help line, and how it steps. */
private class RowModel(
    val key: String,
    val label: String,
    val value: String,
    val help: String? = null,
    val helpIsError: Boolean = false,
    val step: ((Int) -> Unit)? = null,
    val open: (() -> Unit)? = null,
)

private enum class SubPanel { None, Packs, Difficulty }

/**
 * TV-03 Settings (LOBBY only). Categories on the start side, rows on the end side. On a row, Left/Right step the
 * value in the reading direction (mirrored in RTL) and OK steps forward too; multi-option rows open a sub-panel.
 * Each change sends UPDATE_SETTINGS debounced 300 ms; there is no save button.
 */
@Composable
fun SettingsScreen(
    view: TvView,
    send: (ClientIntent) -> Unit,
    onClose: () -> Unit,
    initialCategory: SettingsCategory,
    toasts: ToastState,
) {
    val type = MishTheme.type
    val scope = rememberCoroutineScope()
    var draft by remember { mutableStateOf<SettingsPatch?>(null) }
    var awaitingSend by remember { mutableStateOf(false) }
    var debounce by remember { mutableStateOf<Job?>(null) }
    var category by remember { mutableStateOf(initialCategory) }
    var subPanel by remember { mutableStateOf(SubPanel.None) }
    var focusedKey by remember { mutableStateOf<String?>(null) }
    var flashKeys by remember { mutableStateOf<Set<String>>(emptySet()) }
    val shown = view.settings.withDraft(draft)
    val b = Constants.SETTINGS_BOUNDS

    fun change(p: SettingsPatch) {
        draft = merge(draft, p)
        awaitingSend = true
        debounce?.cancel()
        debounce = scope.launch {
            delay(300)
            val toSend = draft ?: return@launch
            send(UpdateSettings(toSend))
            awaitingSend = false
            delay(1_500) // if the server never echoes (rejected), fall back to its values
            if (!awaitingSend) draft = null
        }
    }

    // The server echoed our change (or someone else changed something): drop the local overlay.
    val previous = remember { mutableStateOf(view.settings) }
    LaunchedEffect(view.settings) {
        val before = previous.value
        previous.value = view.settings
        if (!awaitingSend) {
            if (draft == null && before != view.settings) {
                flashKeys = changedKeys(before, view.settings)
            }
            draft = null
        }
    }
    LaunchedEffect(flashKeys) {
        if (flashKeys.isNotEmpty()) {
            delay(900)
            flashKeys = emptySet()
        }
    }

    val rows = buildRows(category, shown, view, b, ::change, open = { subPanel = it })

    // VIP sync toast: `settings.changedBy` for changes we did not make.
    // SPEC-GAP: the protocol does not say who changed a setting; only the TV and the VIP may, so it names the VIP.
    val host = view.players.firstOrNull { it.id == view.hostPlayerId }
    val changedFmt = stringResource(R.string.settings__changed_by, "%1", "%2", "%3")
    val allRows = SettingsCategory.entries.flatMap { buildRows(it, shown, view, b, {}, {}) }
    LaunchedEffect(flashKeys) {
        if (flashKeys.isNotEmpty() && host != null) {
            for (k in flashKeys.take(2)) {
                val r = allRows.firstOrNull { it.key == k } ?: continue
                toasts.show(changedFmt.replace("%1", isolate(host.name)).replace("%2", r.label).replace("%3", r.value), MishColors.Accent)
            }
        }
    }

    val done = remember { FocusRequester() }
    val catRequesters = remember { SettingsCategory.entries.associateWith { FocusRequester() } }
    val firstRow = remember { FocusRequester() }
    val rowRequesters = remember { mutableMapOf<String, FocusRequester>() }
    val panelOpen = subPanel != SubPanel.None
    val rtl = LocalLayoutDirection.current == LayoutDirection.Rtl

    CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || panelOpen)) {
        // Settings is a full screen (no focus trap: its sub-panels must be able to take focus).
        BackHandler(enabled = !panelOpen) {
            if (focusedKey != null) {
                // SPEC-GAP: DESIGN TV-03 uses Left/Right both to step values and to return to the categories.
                // Values win on rows; Back from a row returns to the category list, Back from a category closes.
                runCatching { catRequesters.getValue(category).requestFocus() }
            } else {
                onClose()
            }
        }
        run {
            Column(Modifier.fillMaxSize().focusFallback(catRequesters.getValue(category))) {
                Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                    Text(stringResource(R.string.settings__title), style = type.headline, color = MishColors.Text)
                    Spacer(Modifier.weight(1f))
                    MishButton(
                        stringResource(R.string.common__done),
                        onClose,
                        // On Done, Back closes Settings (it is not "on a row" any more).
                        Modifier.focusRequester(done).onFocusChanged { if (it.isFocused) focusedKey = null },
                        icon = MishIcons.Check,
                    )
                }
                Spacer(Modifier.height(16.dp))
                Row(Modifier.fillMaxWidth().weight(1f)) {
                    Column(
                        Modifier.width(220.dp).focusRestorer(catRequesters.getValue(category)),
                        verticalArrangement = Arrangement.spacedBy(10.dp),
                    ) {
                        for (c in SettingsCategory.entries) {
                            CategoryItem(
                                label = stringResource(categoryLabel(c)),
                                selected = c == category,
                                onClick = { runCatching { firstRow.requestFocus() } },
                                onFocused = {
                                    category = c
                                    focusedKey = null
                                },
                                modifier = Modifier.focusRequester(catRequesters.getValue(c)),
                            )
                        }
                    }
                    Spacer(Modifier.width(28.dp))
                    Column(
                        Modifier
                            .weight(1f)
                            .background(MishColors.Surface, RoundedCornerShape(24.dp))
                            .padding(horizontal = 12.dp, vertical = 12.dp),
                    ) {
                        LazyColumn(
                            Modifier.fillMaxWidth().weight(1f, fill = false).heightIn(max = 300.dp),
                            verticalArrangement = Arrangement.spacedBy(6.dp),
                        ) {
                            itemsIndexed(rows, key = { _, r -> r.key }) { i, r ->
                                SettingRow(
                                    model = r,
                                    rtl = rtl,
                                    flash = r.key in flashKeys,
                                    onFocused = { focusedKey = r.key },
                                    modifier = Modifier
                                        .focusRequester(rowRequesters.getOrPut(r.key) { FocusRequester() })
                                        .then(if (i == 0) Modifier.focusRequester(firstRow) else Modifier),
                                )
                            }
                        }
                        val focusedRow = rows.firstOrNull { it.key == focusedKey }
                        val help = focusedRow?.help
                            ?: if (category == SettingsCategory.Roles || category == SettingsCategory.Timers) rows.firstOrNull()?.help else null
                        if (help != null) {
                            Box(Modifier.fillMaxWidth().padding(horizontal = 12.dp).height(1.dp).background(MishColors.Outline))
                            Text(
                                help,
                                style = type.body,
                                color = if (focusedRow?.helpIsError == true) MishColors.Danger else MishColors.TextSecondary,
                                modifier = Modifier.padding(horizontal = 12.dp, vertical = 10.dp),
                                maxLines = 3,
                            )
                        }
                    }
                }
                Spacer(Modifier.height(12.dp))
                Text(
                    stringResource(R.string.settings__applies),
                    style = type.caption,
                    color = MishColors.TextMuted,
                    modifier = Modifier.align(Alignment.CenterHorizontally),
                )
            }
        }
        // Initial focus once; when a sub-panel (or a connection overlay) closes, focus returns to the row that was
        // focused (e.g. Packs), else the current category — never back to Game (DESIGN §7).
        val restore = { focusedKey?.let { rowRequesters[it] } ?: catRequesters.getValue(category) }
        InitialFocus(
            if (initialCategory == SettingsCategory.Game) catRequesters.getValue(SettingsCategory.Game) else firstRow,
            restore = restore,
        )
    }

    when (subPanel) {
        SubPanel.Packs -> PacksPanel(view, shown, onToggle = { change(SettingsPatch(packIds = it)) }, onClose = { subPanel = SubPanel.None })
        SubPanel.Difficulty -> DifficultyPanel(shown, onToggle = { change(SettingsPatch(difficulties = it)) }, onClose = { subPanel = SubPanel.None })
        SubPanel.None -> Unit
    }
}

private fun changedKeys(a: Settings, b: Settings): Set<String> = buildSet {
    if (a.winRule != b.winRule) add("game.winRule")
    if (a.revealRoles != b.revealRoles) add("game.revealRoles")
    if (a.tieBreak != b.tieBreak) add("game.tieBreak")
    if (a.blankGuess != b.blankGuess) add("game.blankGuess")
    if (a.points.civilian != b.points.civilian) add("game.points.civilian")
    if (a.points.undercover != b.points.undercover) add("game.points.undercover")
    if (a.points.blank != b.points.blank) add("game.points.blank")
    if (a.roleMode != b.roleMode) add("roles.roleMode")
    if (a.undercoverCount != b.undercoverCount) add("roles.undercoverCount")
    if (a.blankCount != b.blankCount) add("roles.blankCount")
    if (a.clueSeconds != b.clueSeconds) add("timers.clueSeconds")
    if (a.voteSeconds != b.voteSeconds) add("timers.voteSeconds")
    if (a.revealSeconds != b.revealSeconds) add("timers.revealSeconds")
    if (a.guessSeconds != b.guessSeconds) add("timers.guessSeconds")
    if (a.wordLocale != b.wordLocale) add("words.wordLocale")
    if (a.packIds != b.packIds) add("words.packIds")
    if (a.difficulties != b.difficulties) add("words.difficulties")
    if (a.familyFilter != b.familyFilter) add("words.familyFilter")
    if (a.swapSides != b.swapSides) add("words.swapSides")
}

private fun categoryLabel(c: SettingsCategory): Int = when (c) {
    SettingsCategory.Game -> R.string.settings__cat_game
    SettingsCategory.Roles -> R.string.settings__cat_roles
    SettingsCategory.Timers -> R.string.settings__cat_timers
    SettingsCategory.Words -> R.string.settings__cat_words
}

@Composable
private fun onOff(v: Boolean) = stringResource(if (v) R.string.common__on else R.string.common__off)

@Composable
private fun timerText(seconds: Int) =
    if (seconds == 0) stringResource(R.string.common__timer_off) else pluralStringResource(R.plurals.common__seconds, seconds, seconds)

@Composable
private fun pointsText(n: Int) = pluralStringResource(R.plurals.common__points, n, n)

@Composable
private fun buildRows(
    category: SettingsCategory,
    s: Settings,
    view: TvView,
    b: app.mishana.tv.SettingsBounds,
    change: (SettingsPatch) -> Unit,
    open: (SubPanel) -> Unit,
): List<RowModel> {
    fun intStep(v: Int, bounds: IntBounds, make: (Int) -> SettingsPatch): (Int) -> Unit = { dir ->
        val n = SettingsStepper.stepInt(v, bounds, dir)
        if (n != v) change(make(n))
    }
    return when (category) {
        SettingsCategory.Game -> listOf(
            RowModel(
                "game.winRule", stringResource(R.string.settings__win_rule),
                stringResource(if (s.winRule == WinRule.OFFICIAL) R.string.settings__win_rule_official else R.string.settings__win_rule_parity),
                help = stringResource(if (s.winRule == WinRule.OFFICIAL) R.string.settings__win_rule_official_help else R.string.settings__win_rule_parity_help),
                step = { d -> change(SettingsPatch(winRule = SettingsStepper.cycle(WinRule.entries, s.winRule, d))) },
            ),
            RowModel("game.revealRoles", stringResource(R.string.settings__reveal_roles), onOff(s.revealRoles), step = { change(SettingsPatch(revealRoles = !s.revealRoles)) }),
            RowModel(
                "game.tieBreak", stringResource(R.string.settings__tie_break),
                stringResource(if (s.tieBreak == TieBreak.RANDOM) R.string.settings__tie_break_random else R.string.settings__tie_break_none),
                step = { d -> change(SettingsPatch(tieBreak = SettingsStepper.cycle(TieBreak.entries, s.tieBreak, d))) },
            ),
            RowModel("game.blankGuess", stringResource(R.string.settings__blank_guess), onOff(s.blankGuess), step = { change(SettingsPatch(blankGuess = !s.blankGuess)) }),
            RowModel(
                "game.points.civilian", stringResource(R.string.settings__points) + " · " + stringResource(R.string.role__civilian), pointsText(s.points.civilian),
                step = intStep(s.points.civilian, b.points) { SettingsPatch(points = s.points.copy(civilian = it)) },
            ),
            RowModel(
                "game.points.undercover", stringResource(R.string.settings__points) + " · " + stringResource(R.string.role__undercover), pointsText(s.points.undercover),
                step = intStep(s.points.undercover, b.points) { SettingsPatch(points = s.points.copy(undercover = it)) },
            ),
            RowModel(
                "game.points.blank", stringResource(R.string.settings__points) + " · " + stringResource(R.string.role__blank), pointsText(s.points.blank),
                step = intStep(s.points.blank, b.points) { SettingsPatch(points = s.points.copy(blank = it)) },
            ),
        )
        SettingsCategory.Roles -> {
            val rc = view.roleCounts
            val n = view.players.count { !it.left }
            val preview = if (rc != null) {
                stringResource(R.string.settings__role_preview, rc.civilian + rc.undercover + rc.blank, rc.civilian.toString(), rc.undercover.toString(), rc.blank.toString())
            } else if (n >= Constants.MIN_PLAYERS) {
                stringResource(R.string.lobby__blocker_roles)
            } else {
                null
            }
            val invalid = rc == null && n >= Constants.MIN_PLAYERS
            val list = mutableListOf(
                RowModel(
                    "roles.roleMode", stringResource(R.string.settings__role_mode),
                    stringResource(if (s.roleMode == RoleMode.AUTO) R.string.settings__role_mode_auto else R.string.settings__role_mode_custom),
                    help = preview, helpIsError = invalid,
                    step = { d -> change(SettingsPatch(roleMode = SettingsStepper.cycle(RoleMode.entries, s.roleMode, d))) },
                ),
            )
            if (s.roleMode == RoleMode.CUSTOM) {
                list += RowModel(
                    "roles.undercoverCount", stringResource(R.string.settings__undercover_count), s.undercoverCount.toString(),
                    help = preview, helpIsError = invalid,
                    step = intStep(s.undercoverCount, b.undercoverCount) { SettingsPatch(undercoverCount = it) },
                )
                list += RowModel(
                    "roles.blankCount", stringResource(R.string.settings__blank_count), s.blankCount.toString(),
                    help = preview, helpIsError = invalid,
                    step = intStep(s.blankCount, b.blankCount) { SettingsPatch(blankCount = it) },
                )
            }
            list
        }
        SettingsCategory.Timers -> {
            val help = stringResource(R.string.settings__timer_off_help)
            listOf(
                RowModel("timers.clueSeconds", stringResource(R.string.settings__clue_seconds), timerText(s.clueSeconds), help,
                    step = intStep(s.clueSeconds, b.clueSeconds) { SettingsPatch(clueSeconds = it) }),
                RowModel("timers.voteSeconds", stringResource(R.string.settings__vote_seconds), timerText(s.voteSeconds), help,
                    step = intStep(s.voteSeconds, b.voteSeconds) { SettingsPatch(voteSeconds = it) }),
                RowModel("timers.revealSeconds", stringResource(R.string.settings__reveal_seconds), timerText(s.revealSeconds), help,
                    step = intStep(s.revealSeconds, b.revealSeconds) { SettingsPatch(revealSeconds = it) }),
                RowModel("timers.guessSeconds", stringResource(R.string.settings__guess_seconds), timerText(s.guessSeconds), help,
                    step = intStep(s.guessSeconds, b.guessSeconds) { SettingsPatch(guessSeconds = it) }),
            )
        }
        SettingsCategory.Words -> {
            val packs = if (s.packIds.isEmpty()) {
                stringResource(R.string.settings__all_packs)
            } else {
                s.packIds.mapNotNull { id -> view.availablePacks.firstOrNull { it.id == id } }
                    .map { localizedTitle(it.title) }
                    .joinToString(", ")
                    .ifEmpty { s.packIds.size.toString() }
            }
            val diffNames = listOf(R.string.settings__difficulty1, R.string.settings__difficulty2, R.string.settings__difficulty3)
            val diffs = s.difficulties.sorted().mapNotNull { diffNames.getOrNull(it - 1) }.map { stringResource(it) }.joinToString(", ")
            val blocker = if (view.startBlocker == "NO_WORDS_AVAILABLE") stringResource(R.string.lobby__blocker_words) else null
            listOf(
                RowModel("words.wordLocale", stringResource(R.string.settings__word_locale), stringResource(langNameRes(s.wordLocale)), blocker, blocker != null,
                    step = { d -> change(SettingsPatch(wordLocale = SettingsStepper.cycle(Constants.LOCALES, s.wordLocale, d))) }),
                RowModel("words.packIds", stringResource(R.string.settings__packs), packs, blocker, blocker != null, open = { open(SubPanel.Packs) }),
                RowModel("words.difficulties", stringResource(R.string.settings__difficulty), diffs, blocker, blocker != null, open = { open(SubPanel.Difficulty) }),
                RowModel("words.familyFilter", stringResource(R.string.settings__family_filter), onOff(s.familyFilter), blocker, blocker != null,
                    step = { change(SettingsPatch(familyFilter = !s.familyFilter)) }),
                RowModel("words.swapSides", stringResource(R.string.settings__swap_sides), onOff(s.swapSides),
                    step = { change(SettingsPatch(swapSides = !s.swapSides)) }),
            )
        }
    }
}

@Composable
private fun CategoryItem(label: String, selected: Boolean, onClick: () -> Unit, onFocused: () -> Unit, modifier: Modifier) {
    val shape = RoundedCornerShape(18.dp)
    Surface(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .onFocusChanged { if (it.isFocused) onFocused() },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = if (selected) MishColors.Surface else Color.Transparent,
            contentColor = if (selected) MishColors.Text else MishColors.TextSecondary,
            focusedContainerColor = MishColors.Elevated,
            focusedContentColor = MishColors.Text,
        ),
        scale = MishFocus.buttonScale(),
        border = MishFocus.border(shape),
        glow = MishFocus.glow(),
    ) {
        Row(Modifier.align(Alignment.CenterStart).padding(horizontal = 20.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(width = 4.dp, height = 22.dp).background(if (selected) MishColors.Primary else Color.Transparent, RoundedCornerShape(2.dp)))
            Spacer(Modifier.width(12.dp))
            Text(label, style = MishTheme.type.titleS)
        }
    }
}

@Composable
private fun SettingRow(model: RowModel, rtl: Boolean, flash: Boolean, onFocused: () -> Unit, modifier: Modifier) {
    val shape = RoundedCornerShape(16.dp)
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val flashBg by animateColorAsState(if (flash) MishColors.Accent.copy(alpha = 0.22f) else Color.Transparent, tween(MishMotion.Slow), label = "rowFlash")
    val step = model.step
    Surface(
        onClick = { if (model.open != null) model.open.invoke() else step?.invoke(+1) },
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .onFocusChanged { if (it.isFocused) onFocused() }
            .onPreviewKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                val open = model.open
                when {
                    // Chevrons follow the reading direction: in RTL the visual left is "next".
                    step != null -> when (e.key) {
                        Key.DirectionRight -> { step(if (rtl) -1 else +1); true }
                        Key.DirectionLeft -> { step(if (rtl) +1 else -1); true }
                        else -> false
                    }
                    // Sub-panel rows: the forward direction (the chevron's side) opens it; the other one does nothing.
                    // Left/Right never leave the rows on any row; Back returns to the categories.
                    open != null -> when (e.key) {
                        Key.DirectionRight -> { if (!rtl) open(); true }
                        Key.DirectionLeft -> { if (rtl) open(); true }
                        else -> false
                    }
                    else -> false
                }
            },
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = flashBg,
            contentColor = MishColors.Text,
            focusedContainerColor = MishColors.Elevated,
            focusedContentColor = MishColors.Text,
        ),
        scale = MishFocus.buttonScale(),
        border = MishFocus.border(shape),
        glow = MishFocus.glow(),
        interactionSource = interaction,
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 8.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(model.label, style = MishTheme.type.titleS, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.width(12.dp))
            if (model.open != null) {
                Text(model.value, style = MishTheme.type.titleS, color = MishColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 260.dp))
                Spacer(Modifier.width(8.dp))
                Icon(MishIcons.ChevronForward, null, Modifier.size(22.dp), tint = MishColors.TextSecondary)
            } else {
                val chevron = if (focused) MishColors.Text else MishColors.TextMuted.copy(alpha = 0.6f)
                Icon(MishIcons.ChevronBack, null, Modifier.size(22.dp), tint = chevron)
                Box(Modifier.widthIn(min = 150.dp, max = 260.dp), contentAlignment = Alignment.Center) {
                    Text(model.value, style = MishTheme.type.titleS, color = MishColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Icon(MishIcons.ChevronForward, null, Modifier.size(22.dp), tint = chevron)
            }
        }
    }
}

/** Packs sub-panel: "All packs" or a multi-select list (localised title + pairCount + Teen badge). */
@Composable
private fun PacksPanel(view: TvView, s: Settings, onToggle: (List<String>) -> Unit, onClose: () -> Unit) {
    val first = remember { FocusRequester() }
    val available = view.availablePacks
    OverlayCard(onBack = onClose, width = 560.dp) {
        Text(stringResource(R.string.settings__packs), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(16.dp))
        LazyColumn(Modifier.fillMaxWidth().heightIn(max = 320.dp), verticalArrangement = Arrangement.spacedBy(10.dp)) {
            item(key = "all") {
                ToggleRow(
                    label = stringResource(R.string.settings__all_packs),
                    trailing = null,
                    checked = s.packIds.isEmpty(),
                    onClick = { onToggle(emptyList()) },
                    modifier = Modifier.focusRequester(first),
                )
            }
            items(available.size, key = { available[it].id }) { i ->
                val p = available[i]
                ToggleRow(
                    label = localizedTitle(p.title),
                    trailing = p.pairCount.toString() + if (p.ageRating == "teen") "  ·  " + stringResource(R.string.settings__pack_teen) else "",
                    checked = p.id in s.packIds,
                    onClick = { onToggle(SettingsStepper.togglePack(s.packIds, p.id, available.map { it.id }, Constants.SETTINGS_BOUNDS.packIds.maxItems)) },
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        MishButton(stringResource(R.string.common__done), onClose, kind = ButtonKind.Primary, icon = MishIcons.Check)
    }
    InitialFocus(first)
}

/** Difficulty sub-panel: multi-select Easy / Medium / Subtle (never empty). */
@Composable
private fun DifficultyPanel(s: Settings, onToggle: (List<Int>) -> Unit, onClose: () -> Unit) {
    val first = remember { FocusRequester() }
    val names = listOf(R.string.settings__difficulty1, R.string.settings__difficulty2, R.string.settings__difficulty3)
    OverlayCard(onBack = onClose, width = 480.dp) {
        Text(stringResource(R.string.settings__difficulty), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(16.dp))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for (d in 1..3) {
                ToggleRow(
                    label = stringResource(names[d - 1]),
                    trailing = null,
                    checked = d in s.difficulties,
                    onClick = { SettingsStepper.toggleDifficulty(s.difficulties, d)?.let(onToggle) },
                    modifier = if (d == 1) Modifier.focusRequester(first) else Modifier,
                )
            }
        }
        Spacer(Modifier.height(16.dp))
        MishButton(stringResource(R.string.common__done), onClose, kind = ButtonKind.Primary, icon = MishIcons.Check)
    }
    InitialFocus(first)
}

/** Selected = border + check icon, never colour alone (DESIGN §11). */
@Composable
private fun ToggleRow(label: String, trailing: String?, checked: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = RoundedCornerShape(16.dp)
    Surface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = ClickableSurfaceDefaults.shape(shape = shape),
        colors = ClickableSurfaceDefaults.colors(
            containerColor = MishColors.Surface,
            contentColor = MishColors.Text,
            focusedContainerColor = MishColors.Elevated,
            focusedContentColor = MishColors.Text,
        ),
        scale = MishFocus.buttonScale(),
        border = MishFocus.border(
            shape,
            rest = if (checked) androidx.tv.material3.Border(androidx.compose.foundation.BorderStroke(2.dp, MishColors.Primary), shape = shape) else androidx.tv.material3.Border.None,
        ),
        glow = MishFocus.glow(),
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = 16.dp, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(26.dp)
                    .background(if (checked) MishColors.Primary else MishColors.Overlay, RoundedCornerShape(8.dp)),
                contentAlignment = Alignment.Center,
            ) {
                if (checked) Icon(MishIcons.Check, null, Modifier.size(18.dp), tint = MishColors.Ink)
            }
            Spacer(Modifier.width(14.dp))
            Text(label, style = MishTheme.type.titleS, modifier = Modifier.weight(1f), maxLines = 1, overflow = TextOverflow.Ellipsis)
            if (trailing != null) Text(trailing, style = MishTheme.type.caption, color = MishColors.TextMuted)
        }
    }
}
