package app.mishana.tv.ui.screens

import android.content.Context
import androidx.activity.compose.BackHandler
import androidx.compose.animation.animateColorAsState
import androidx.compose.animation.core.tween
import androidx.compose.foundation.background
import androidx.compose.foundation.clickable
import androidx.compose.foundation.interaction.MutableInteractionSource
import androidx.compose.foundation.interaction.collectIsFocusedAsState
import androidx.compose.foundation.layout.Arrangement
import androidx.compose.foundation.layout.Box
import androidx.compose.foundation.layout.Column
import androidx.compose.foundation.layout.PaddingValues
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
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.LaunchedEffect
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.rememberUpdatedState
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusProperties
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.graphics.Color
import androidx.compose.ui.graphics.vector.ImageVector
import androidx.compose.ui.input.key.Key
import androidx.compose.ui.input.key.KeyEventType
import androidx.compose.ui.input.key.key
import androidx.compose.ui.input.key.onPreviewKeyEvent
import androidx.compose.ui.input.key.type
import androidx.compose.ui.platform.LocalConfiguration
import androidx.compose.ui.platform.LocalContext
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Border
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.Constants
import app.mishana.tv.IntBounds
import app.mishana.tv.R
import app.mishana.tv.billing.Products
import app.mishana.tv.billing.StoreEntry
import app.mishana.tv.billing.StoreOrigin
import app.mishana.tv.game.Cue
import app.mishana.tv.game.CuePlay
import app.mishana.tv.ui.components.LocalSounds
import app.mishana.tv.ui.components.LockBadge
import androidx.compose.animation.core.Animatable
import androidx.compose.runtime.rememberCoroutineScope
import androidx.compose.ui.platform.LocalDensity
import androidx.compose.ui.res.pluralStringResource
import kotlinx.coroutines.launch
import app.mishana.tv.SettingsBounds
import app.mishana.tv.game.SettingsStepper
import app.mishana.tv.game.TvEvent
import app.mishana.tv.game.withDraft
import app.mishana.tv.i18n.Locales
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.RoleMode
import app.mishana.tv.protocol.Settings
import app.mishana.tv.protocol.SettingsPatch
import app.mishana.tv.protocol.StartBlocker
import app.mishana.tv.protocol.TieBreak
import app.mishana.tv.protocol.TvView
import app.mishana.tv.protocol.WinRule
import app.mishana.tv.protocol.blocker
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.Divider
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.LocalFocusBlocked
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishFocus
import app.mishana.tv.ui.components.MishFocusSurface
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.OverlayCard
import app.mishana.tv.ui.components.ToastState
import app.mishana.tv.ui.components.focusFallback
import app.mishana.tv.ui.components.inertWhen
import app.mishana.tv.ui.components.tryFocus
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishMotion
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.flow.filterIsInstance

/** Which settings category to open (Start on an invalid config jumps to the offending one). */
enum class SettingsCategory { Game, Roles, Timers, Words }

/** One settings row: label, current value text, an optional help line, and how it steps. */
private class RowModel(
    val key: String,
    val label: String,
    val value: String,
    val help: String? = null,
    val helpIsError: Boolean = false,
    val step: ((Int) -> Unit)? = null,
    val open: (() -> Unit)? = null,
    /** PAYMENTS-SPEC §4.4: a premium-only setting in a free room. Left/Right shake + sfx.error; OK runs [open] (Store). */
    val locked: Boolean = false,
)

private enum class SubPanel { None, Packs, Difficulty }

/**
 * TV-03 Settings (LOBBY only). Categories on the start side, rows on the end side. On a row, Left/Right step the
 * value in the reading direction (mirrored in RTL) and OK steps forward too; multi-option rows open a sub-panel.
 * A pointer can click either chevron. Changes go through [onChange] (the ViewModel's optimistic draft: debounced
 * UPDATE_SETTINGS, echo reconciliation); [draft] is that overlay. There is no save button.
 */
@Composable
fun SettingsScreen(
    view: TvView,
    draft: SettingsPatch?,
    events: Flow<TvEvent>,
    onChange: (SettingsPatch) -> Unit,
    onClose: () -> Unit,
    initialCategory: SettingsCategory,
    toasts: ToastState,
    soundOn: Boolean = true,
    onToggleSound: () -> Unit = {},
    /** PAYMENTS-SPEC §4.4 entry points 2 and 3; null when billing is off. */
    onOpenStore: ((StoreEntry) -> Unit)? = null,
    /** Play said BILLING_UNAVAILABLE this session: locked rows read `settings.locked` (§4.4 state machine). */
    billingUnavailable: Boolean = false,
) {
    val type = MishTheme.type
    val context = LocalContext.current
    // Row texts are resolved through the Context (so the changed-by toast can build them outside composition);
    // reading the configuration keeps them in step with a language change.
    val lang = uiLanguage()
    val configuration = LocalConfiguration.current
    var category by remember { mutableStateOf(initialCategory) }
    var subPanel by remember { mutableStateOf(SubPanel.None) }
    var focusedKey by remember { mutableStateOf<String?>(null) }
    var flashKeys by remember { mutableStateOf<Set<String>>(emptySet()) }
    val shown = view.settings.withDraft(draft)
    val change by rememberUpdatedState(onChange)
    val currentView by rememberUpdatedState(view)

    // Someone else (the VIP) changed settings: flash those rows and say who (`settings.changedBy`).
    // SPEC-GAP: the protocol does not say who changed a setting; only the TV and the VIP may, so it names the VIP.
    LaunchedEffect(events) {
        events.filterIsInstance<TvEvent.SettingsChanged>().collect { e ->
            flashKeys = e.keys
            val host = e.hostName ?: return@collect
            val v = currentView
            val all = SettingsCategory.entries.flatMap { buildRows(context, lang, it, v.settings, v, Constants.SETTINGS_BOUNDS, {}, {}, null) }
            for (k in e.keys.take(2)) {
                val r = all.firstOrNull { it.key == k } ?: continue
                toasts.show(context.getString(R.string.settings__changed_by, isolate(host), r.label, r.value), MishColors.Accent)
            }
        }
    }
    LaunchedEffect(flashKeys) {
        if (flashKeys.isNotEmpty()) {
            delay(900)
            flashKeys = emptySet()
        }
    }

    val storeOpener by rememberUpdatedState(onOpenStore)
    val rows = remember(category, shown, view.roleCounts, view.players, view.startBlocker, view.availablePacks, view.premium, configuration, onOpenStore != null) {
        val premiumStore: (() -> Unit)? = if (onOpenStore == null) null else {
            { storeOpener?.invoke(StoreEntry(focusProductId = Products.PREMIUM_PRODUCT_ID, origin = StoreOrigin.LOCKED_SETTING)) }
        }
        buildRows(context, lang, category, shown, view, Constants.SETTINGS_BOUNDS, { change(it) }, open = { subPanel = it }, premiumStore)
    }

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
                catRequesters.getValue(category).tryFocus()
            } else {
                onClose()
            }
        }
        Column(Modifier.fillMaxSize().inertWhen(panelOpen).focusFallback(catRequesters.getValue(category))) {
            Row(Modifier.fillMaxWidth().height(56.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(stringResource(R.string.settings__title), style = type.headline, color = MishColors.Text)
                Spacer(Modifier.weight(1f))
                // DESIGN §6.4 global mute: a TV device setting next to Done (never sent to the server).
                MishButton(
                    stringResource(if (soundOn) R.string.tv__sound_on else R.string.tv__sound_off),
                    onToggleSound,
                    Modifier.onFocusChanged { if (it.isFocused) focusedKey = null },
                    icon = if (soundOn) MishIcons.Volume else MishIcons.VolumeOff,
                )
                Spacer(Modifier.width(MishSpace.s3))
                MishButton(
                    stringResource(R.string.common__done),
                    onClose,
                    // On Done, Back closes Settings (it is not "on a row" any more).
                    Modifier.onFocusChanged { if (it.isFocused) focusedKey = null },
                    icon = MishIcons.Check,
                )
            }
            Spacer(Modifier.height(MishSpace.s4))
            Row(Modifier.fillMaxWidth().weight(1f)) {
                Column(
                    Modifier.width(220.dp).focusRestorer(catRequesters.getValue(category)),
                    verticalArrangement = Arrangement.spacedBy(10.dp),
                ) {
                    for (c in SettingsCategory.entries) {
                        CategoryItem(
                            label = stringResource(categoryLabel(c)),
                            selected = c == category,
                            onClick = { firstRow.tryFocus() },
                            onFocused = {
                                category = c
                                focusedKey = null
                            },
                            modifier = Modifier.focusRequester(catRequesters.getValue(c)),
                        )
                    }
                }
                Spacer(Modifier.width(MishSpace.s5))
                Column(
                    Modifier
                        .weight(1f)
                        .background(MishColors.Surface, MishShapes.tile)
                        .padding(vertical = MishSpace.s1),
                ) {
                    LazyColumn(
                        // Entering the rows from a category lands on the first row, never on whichever is level.
                        Modifier.fillMaxWidth().weight(1f, fill = false).heightIn(max = 316.dp).focusRestorer(firstRow),
                        // Room for the focus scale + ring, which the list would otherwise clip.
                        contentPadding = PaddingValues(horizontal = MishFocus.ListPadH, vertical = MishFocus.ListPadV),
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
                                    .then(if (i == 0) Modifier.focusRequester(firstRow) else Modifier)
                                    // Down on the last row stays put: 2D search would otherwise land on a lower
                                    // category in the start column and switch the category under the user.
                                    .then(if (i == rows.lastIndex) Modifier.focusProperties { down = FocusRequester.Cancel } else Modifier),
                            )
                        }
                    }
                    val focusedRow = rows.firstOrNull { it.key == focusedKey }
                    val help = focusedRow?.help
                        ?: if (category == SettingsCategory.Roles || category == SettingsCategory.Timers) rows.firstOrNull()?.help else null
                    if (help != null) {
                        Divider(Modifier.padding(horizontal = MishSpace.s5))
                        Text(
                            help,
                            style = type.body,
                            color = if (focusedRow?.helpIsError == true) MishColors.Danger else MishColors.TextSecondary,
                            modifier = Modifier.padding(horizontal = MishSpace.s5, vertical = 10.dp),
                            maxLines = 3,
                        )
                    }
                }
            }
            Spacer(Modifier.height(MishSpace.s3))
            // "Applies to the next game · Back: categories": Back is the way from the rows to the categories,
            // because Left/Right step values.
            Text(
                stringResource(R.string.settings__applies) + "  ·  " + stringResource(R.string.tv__back_to_categories),
                style = type.caption,
                color = MishColors.TextMuted,
                modifier = Modifier.align(Alignment.CenterHorizontally),
            )
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
        SubPanel.Packs -> PacksPanel(
            view, shown,
            onToggle = { change(SettingsPatch(packIds = it)) },
            onClose = { subPanel = SubPanel.None },
            onOpenStore = onOpenStore,
            billingUnavailable = billingUnavailable,
        )
        SubPanel.Difficulty -> DifficultyPanel(shown, onToggle = { change(SettingsPatch(difficulties = it)) }, onClose = { subPanel = SubPanel.None })
        SubPanel.None -> Unit
    }
}

private fun categoryLabel(c: SettingsCategory): Int = when (c) {
    SettingsCategory.Game -> R.string.settings__cat_game
    SettingsCategory.Roles -> R.string.settings__cat_roles
    SettingsCategory.Timers -> R.string.settings__cat_timers
    SettingsCategory.Words -> R.string.settings__cat_words
}

private val DIFFICULTY_NAMES = listOf(R.string.settings__difficulty1, R.string.settings__difficulty2, R.string.settings__difficulty3)

/**
 * The rows of one category, as plain data resolved through [ctx] (not @Composable: the screen builds the visible
 * category only, and the changed-by toast resolves a changed key's label and value only when one arrives).
 */
private fun buildRows(
    ctx: Context,
    lang: String,
    category: SettingsCategory,
    s: Settings,
    view: TvView,
    b: SettingsBounds,
    change: (SettingsPatch) -> Unit,
    open: (SubPanel) -> Unit,
    /** Opens the Store on Premium (billing on); premium-only rows are locked in a free room only then. */
    premiumStore: (() -> Unit)?,
): List<RowModel> {
    fun str(id: Int, vararg args: Any): String = ctx.getString(id, *args)
    fun onOff(v: Boolean) = str(if (v) R.string.common__on else R.string.common__off)
    fun timerText(seconds: Int) =
        if (seconds == 0) str(R.string.common__timer_off) else ctx.resources.getQuantityString(R.plurals.common__seconds, seconds, seconds)
    fun pointsText(n: Int) = ctx.resources.getQuantityString(R.plurals.common__points, n, n)
    fun intStep(v: Int, bounds: IntBounds, make: (Int) -> SettingsPatch): (Int) -> Unit = { dir ->
        val n = SettingsStepper.stepInt(v, bounds, dir)
        if (n != v) change(make(n))
    }
    // §1.6 / §4.4: PREMIUM_SETTING_KEYS rows are locked in a free room (they already sit at the bottom of Game, so the
    // category's initial focus never lands on a lock).
    val pointsLocked = premiumStore != null && !view.premium && "points" in Products.PREMIUM_SETTING_KEYS
    fun lockedRow(key: String, label: String) =
        RowModel(key, label, str(R.string.settings__premium_only), open = premiumStore, locked = true)
    return when (category) {
        SettingsCategory.Game -> listOf(
            RowModel(
                "game.winRule", str(R.string.settings__win_rule),
                str(if (s.winRule == WinRule.OFFICIAL) R.string.settings__win_rule_official else R.string.settings__win_rule_parity),
                help = str(if (s.winRule == WinRule.OFFICIAL) R.string.settings__win_rule_official_help else R.string.settings__win_rule_parity_help),
                step = { d -> change(SettingsPatch(winRule = SettingsStepper.cycle(WinRule.entries, s.winRule, d))) },
            ),
            RowModel("game.revealRoles", str(R.string.settings__reveal_roles), onOff(s.revealRoles), step = { change(SettingsPatch(revealRoles = !s.revealRoles)) }),
            RowModel(
                "game.tieBreak", str(R.string.settings__tie_break),
                str(if (s.tieBreak == TieBreak.RANDOM) R.string.settings__tie_break_random else R.string.settings__tie_break_none),
                step = { d -> change(SettingsPatch(tieBreak = SettingsStepper.cycle(TieBreak.entries, s.tieBreak, d))) },
            ),
            RowModel("game.blankGuess", str(R.string.settings__blank_guess), onOff(s.blankGuess), step = { change(SettingsPatch(blankGuess = !s.blankGuess)) }),
        ) + if (pointsLocked) listOf(
            lockedRow("game.points.civilian", str(R.string.settings__points) + " · " + str(R.string.role__civilian)),
            lockedRow("game.points.undercover", str(R.string.settings__points) + " · " + str(R.string.role__undercover)),
            lockedRow("game.points.blank", str(R.string.settings__points) + " · " + str(R.string.role__blank)),
        ) else listOf(
            RowModel(
                "game.points.civilian", str(R.string.settings__points) + " · " + str(R.string.role__civilian), pointsText(s.points.civilian),
                step = intStep(s.points.civilian, b.points) { SettingsPatch(points = s.points.copy(civilian = it)) },
            ),
            RowModel(
                "game.points.undercover", str(R.string.settings__points) + " · " + str(R.string.role__undercover), pointsText(s.points.undercover),
                step = intStep(s.points.undercover, b.points) { SettingsPatch(points = s.points.copy(undercover = it)) },
            ),
            RowModel(
                "game.points.blank", str(R.string.settings__points) + " · " + str(R.string.role__blank), pointsText(s.points.blank),
                step = intStep(s.points.blank, b.points) { SettingsPatch(points = s.points.copy(blank = it)) },
            ),
        )
        SettingsCategory.Roles -> {
            val rc = view.roleCounts
            val n = view.players.count { !it.left }
            val preview = if (rc != null) {
                str(R.string.settings__role_preview, rc.civilian + rc.undercover + rc.blank, rc.civilian.toString(), rc.undercover.toString(), rc.blank.toString())
            } else if (n >= Constants.MIN_PLAYERS) {
                str(R.string.lobby__blocker_roles)
            } else {
                null
            }
            val invalid = rc == null && n >= Constants.MIN_PLAYERS
            val list = mutableListOf(
                RowModel(
                    "roles.roleMode", str(R.string.settings__role_mode),
                    str(if (s.roleMode == RoleMode.AUTO) R.string.settings__role_mode_auto else R.string.settings__role_mode_custom),
                    help = preview, helpIsError = invalid,
                    step = { d -> change(SettingsPatch(roleMode = SettingsStepper.cycle(RoleMode.entries, s.roleMode, d))) },
                ),
            )
            if (s.roleMode == RoleMode.CUSTOM) {
                list += RowModel(
                    "roles.undercoverCount", str(R.string.settings__undercover_count), s.undercoverCount.toString(),
                    help = preview, helpIsError = invalid,
                    step = intStep(s.undercoverCount, b.undercoverCount) { SettingsPatch(undercoverCount = it) },
                )
                list += RowModel(
                    "roles.blankCount", str(R.string.settings__blank_count), s.blankCount.toString(),
                    help = preview, helpIsError = invalid,
                    step = intStep(s.blankCount, b.blankCount) { SettingsPatch(blankCount = it) },
                )
            }
            list
        }
        SettingsCategory.Timers -> {
            val help = str(R.string.settings__timer_off_help)
            listOf(
                RowModel("timers.clueSeconds", str(R.string.settings__clue_seconds), timerText(s.clueSeconds), help,
                    step = intStep(s.clueSeconds, b.clueSeconds) { SettingsPatch(clueSeconds = it) }),
                RowModel("timers.voteSeconds", str(R.string.settings__vote_seconds), timerText(s.voteSeconds), help,
                    step = intStep(s.voteSeconds, b.voteSeconds) { SettingsPatch(voteSeconds = it) }),
                RowModel("timers.revealSeconds", str(R.string.settings__reveal_seconds), timerText(s.revealSeconds), help,
                    step = intStep(s.revealSeconds, b.revealSeconds) { SettingsPatch(revealSeconds = it) }),
                RowModel("timers.guessSeconds", str(R.string.settings__guess_seconds), timerText(s.guessSeconds), help,
                    step = intStep(s.guessSeconds, b.guessSeconds) { SettingsPatch(guessSeconds = it) }),
            )
        }
        SettingsCategory.Words -> {
            val packs = if (s.packIds.isEmpty()) {
                str(R.string.settings__all_packs)
            } else {
                s.packIds.mapNotNull { id -> view.availablePacks.firstOrNull { it.id == id } }
                    .map { it.title.inLanguage(lang) }
                    .joinToString(", ")
                    .ifEmpty { s.packIds.size.toString() }
            }
            val diffs = s.difficulties.sorted().mapNotNull { DIFFICULTY_NAMES.getOrNull(it - 1) }.joinToString(", ") { str(it) }
            val blocker = if (view.blocker == StartBlocker.NO_WORDS_AVAILABLE) str(R.string.lobby__blocker_words) else null
            listOf(
                RowModel("words.wordLocale", str(R.string.settings__word_locale), str(langNameRes(s.wordLocale)), blocker, blocker != null,
                    step = { d -> change(SettingsPatch(wordLocale = SettingsStepper.cycle(Locales.ALL, s.wordLocale, d))) }),
                RowModel("words.packIds", str(R.string.settings__packs), packs, blocker, blocker != null, open = { open(SubPanel.Packs) }),
                RowModel("words.difficulties", str(R.string.settings__difficulty), diffs, blocker, blocker != null, open = { open(SubPanel.Difficulty) }),
                RowModel("words.familyFilter", str(R.string.settings__family_filter), onOff(s.familyFilter), blocker, blocker != null,
                    step = { change(SettingsPatch(familyFilter = !s.familyFilter)) }),
                RowModel("words.swapSides", str(R.string.settings__swap_sides), onOff(s.swapSides),
                    step = { change(SettingsPatch(swapSides = !s.swapSides)) }),
            )
        }
    }
}

@Composable
private fun CategoryItem(label: String, selected: Boolean, onClick: () -> Unit, onFocused: () -> Unit, modifier: Modifier) {
    MishFocusSurface(
        onClick = onClick,
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .onFocusChanged { if (it.isFocused) onFocused() },
        shape = MishShapes.row,
        container = if (selected) MishColors.Surface else Color.Transparent,
        content = if (selected) MishColors.Text else MishColors.TextSecondary,
    ) {
        Row(Modifier.align(Alignment.CenterStart).padding(horizontal = MishSpace.s5), verticalAlignment = Alignment.CenterVertically) {
            Box(Modifier.size(width = 4.dp, height = 22.dp).background(if (selected) MishColors.Primary else Color.Transparent, MishShapes.pill))
            Spacer(Modifier.width(MishSpace.s3))
            Text(label, style = MishTheme.type.titleS)
        }
    }
}

@Composable
private fun SettingRow(model: RowModel, rtl: Boolean, flash: Boolean, onFocused: () -> Unit, modifier: Modifier) {
    val interaction = remember { MutableInteractionSource() }
    val focused by interaction.collectIsFocusedAsState()
    val flashBg by animateColorAsState(if (flash) MishColors.Accent.copy(alpha = 0.22f) else Color.Transparent, tween(MishMotion.Slow), label = "rowFlash")
    val step = model.step
    val open = model.open
    val sounds = LocalSounds.current
    val shake = remember { Animatable(0f) }
    val scope = rememberCoroutineScope()
    val amplitude = with(LocalDensity.current) { 12.dp.toPx() }
    val reduce = MishTheme.reduceMotion
    MishFocusSurface(
        onClick = { if (open != null) open() else step?.invoke(+1) },
        modifier = modifier
            .fillMaxWidth()
            .heightIn(min = 52.dp)
            .shakeOffset(shake)
            .onFocusChanged { if (it.isFocused) onFocused() }
            .onPreviewKeyEvent { e ->
                if (e.type != KeyEventType.KeyDown) return@onPreviewKeyEvent false
                // The forward direction follows the reading direction: in RTL the visual left is "next".
                val forward = if (rtl) Key.DirectionLeft else Key.DirectionRight
                val backward = if (rtl) Key.DirectionRight else Key.DirectionLeft
                when {
                    // §4.4: a locked premium row never steps; Left/Right give the "disabled shake" + sfx.error.
                    model.locked -> if (e.key == forward || e.key == backward) {
                        sounds.play(CuePlay(Cue.ERROR))
                        if (!reduce) scope.launch { shake.shake(amplitude) }
                        true
                    } else {
                        false
                    }
                    step != null -> when (e.key) {
                        forward -> { step(+1); true }
                        backward -> { step(-1); true }
                        else -> false
                    }
                    // Sub-panel rows: forward (the chevron's side) opens it; backward moves back to the categories.
                    open != null -> if (e.key == forward) { open(); true } else false
                    else -> false
                }
            },
        shape = MishShapes.row,
        container = flashBg,
        interactionSource = interaction,
    ) {
        Row(
            Modifier.fillMaxWidth().padding(horizontal = MishSpace.s4, vertical = MishSpace.s2),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            Text(model.label, style = MishTheme.type.titleS, modifier = Modifier.weight(1f), maxLines = 2, overflow = TextOverflow.Ellipsis)
            Spacer(Modifier.width(MishSpace.s3))
            if (model.locked) {
                LockBadge(model.value)
            } else if (open != null) {
                Text(model.value, style = MishTheme.type.titleS, color = MishColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis, modifier = Modifier.widthIn(max = 260.dp))
                Spacer(Modifier.width(MishSpace.s2))
                Icon(MishIcons.ChevronForward, null, Modifier.size(22.dp), tint = MishColors.TextSecondary)
            } else {
                val chevron = if (focused) MishColors.Text else MishColors.TextMuted.copy(alpha = 0.6f)
                // Pointer remotes: each chevron is its own (non-focusable) click target, so values can go down too.
                Chevron(MishIcons.ChevronBack, chevron) { step?.invoke(-1) }
                Box(Modifier.widthIn(min = 150.dp, max = 260.dp), contentAlignment = Alignment.Center) {
                    Text(model.value, style = MishTheme.type.titleS, color = MishColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
                Chevron(MishIcons.ChevronForward, chevron) { step?.invoke(+1) }
            }
        }
    }
}

/** A chevron that a pointer can click; never a D-pad focus stop (the row handles Left/Right). */
@Composable
private fun Chevron(icon: ImageVector, tint: Color, onClick: () -> Unit) {
    Icon(
        icon,
        contentDescription = null,
        tint = tint,
        modifier = Modifier
            .focusProperties { canFocus = false }
            .clickable(interactionSource = null, indication = null, onClick = onClick)
            .padding(MishSpace.s1)
            .size(22.dp),
    )
}

/** Packs sub-panel: "All packs" or a multi-select list (localised title + pairCount + Teen badge). */
@Composable
private fun PacksPanel(
    view: TvView,
    s: Settings,
    onToggle: (List<String>) -> Unit,
    onClose: () -> Unit,
    onOpenStore: ((StoreEntry) -> Unit)?,
    billingUnavailable: Boolean,
) {
    val first = remember { FocusRequester() }
    val available = view.availablePacks
    // §4.4 entry point 2: locked packs (metadata only) under a divider; OK opens the Store on that pack.
    val locked = if (onOpenStore != null) view.lockedPacks else emptyList()
    val lockedFocus = remember { mutableMapOf<String, FocusRequester>() }
    var reopenOn by remember { mutableStateOf<String?>(null) }
    OverlayCard(onBack = onClose, width = 560.dp, default = first) {
        Text(stringResource(R.string.settings__packs), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(MishSpace.s2))
        LazyColumn(
            Modifier.fillMaxWidth().heightIn(max = 336.dp),
            contentPadding = PaddingValues(horizontal = MishFocus.ListPadH, vertical = MishFocus.ListPadV),
            verticalArrangement = Arrangement.spacedBy(10.dp),
        ) {
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
            if (locked.isNotEmpty() && onOpenStore != null) {
                item(key = "locked-header") {
                    Column(Modifier.fillMaxWidth()) {
                        Divider(Modifier.padding(vertical = MishSpace.s1))
                        Text(stringResource(R.string.settings__locked_packs), style = MishTheme.type.caption, color = MishColors.TextMuted)
                    }
                }
                items(locked.size, key = { "locked:" + locked[it].id }) { i ->
                    val p = locked[i]
                    LockedPackRow(
                        title = localizedTitle(p.title),
                        pairs = pluralStringResource(R.plurals.store__pack_pairs, p.pairCount, p.pairCount),
                        hint = stringResource(if (billingUnavailable) R.string.settings__locked else R.string.settings__unlock_hint),
                        onClick = {
                            reopenOn = p.id
                            onOpenStore(StoreEntry(focusProductId = p.productId, origin = StoreOrigin.LOCKED_PACK))
                        },
                        modifier = Modifier.focusRequester(lockedFocus.getOrPut(p.id) { FocusRequester() }),
                    )
                }
            }
        }
        Spacer(Modifier.height(MishSpace.s2))
        MishButton(stringResource(R.string.common__done), onClose, kind = ButtonKind.Primary, icon = MishIcons.Check)
    }
    // Back from the Store returns to the locked row that opened it (DESIGN §7).
    InitialFocus(first, restore = { reopenOn?.let { lockedFocus[it] } })
}

/** A locked pack: lock + title + pair count + `settings.unlockHint` (`settings.locked` while Play is unavailable). */
@Composable
private fun LockedPackRow(title: String, pairs: String, hint: String, onClick: () -> Unit, modifier: Modifier) {
    MishFocusSurface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = MishShapes.row,
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = MishSpace.s4, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            LockBadge(null)
            Spacer(Modifier.width(14.dp))
            Column(Modifier.weight(1f)) {
                Text(title, style = MishTheme.type.titleS, maxLines = 1, overflow = TextOverflow.Ellipsis)
                Text(pairs, style = MishTheme.type.caption, color = MishColors.TextMuted, maxLines = 1)
            }
            Spacer(Modifier.width(MishSpace.s2))
            Text(hint, style = MishTheme.type.caption, color = MishColors.Accent, maxLines = 1)
        }
    }
}

/** Difficulty sub-panel: multi-select Easy / Medium / Subtle (never empty). */
@Composable
private fun DifficultyPanel(s: Settings, onToggle: (List<Int>) -> Unit, onClose: () -> Unit) {
    val first = remember { FocusRequester() }
    OverlayCard(onBack = onClose, width = 480.dp, default = first) {
        Text(stringResource(R.string.settings__difficulty), style = MishTheme.type.headline, color = MishColors.Text)
        Spacer(Modifier.height(MishSpace.s4))
        Column(verticalArrangement = Arrangement.spacedBy(10.dp)) {
            for (d in 1..3) {
                ToggleRow(
                    label = stringResource(DIFFICULTY_NAMES[d - 1]),
                    trailing = null,
                    checked = d in s.difficulties,
                    onClick = { SettingsStepper.toggleDifficulty(s.difficulties, d)?.let(onToggle) },
                    modifier = if (d == 1) Modifier.focusRequester(first) else Modifier,
                )
            }
        }
        Spacer(Modifier.height(MishSpace.s4))
        MishButton(stringResource(R.string.common__done), onClose, kind = ButtonKind.Primary, icon = MishIcons.Check)
    }
    InitialFocus(first)
}

/** Selected = border + check icon, never colour alone (DESIGN §11). */
@Composable
private fun ToggleRow(label: String, trailing: String?, checked: Boolean, onClick: () -> Unit, modifier: Modifier = Modifier) {
    val shape = MishShapes.row
    MishFocusSurface(
        onClick = onClick,
        modifier = modifier.fillMaxWidth().heightIn(min = 52.dp),
        shape = shape,
        rest = if (checked) Border(androidx.compose.foundation.BorderStroke(2.dp, MishColors.Primary), shape = shape) else Border.None,
    ) {
        Row(Modifier.fillMaxWidth().padding(horizontal = MishSpace.s4, vertical = 10.dp), verticalAlignment = Alignment.CenterVertically) {
            Box(
                Modifier
                    .size(26.dp)
                    .background(if (checked) MishColors.Primary else MishColors.Overlay, MishShapes.xs),
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
