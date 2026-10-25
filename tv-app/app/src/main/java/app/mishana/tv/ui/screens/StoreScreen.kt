package app.mishana.tv.ui.screens

import androidx.compose.foundation.background
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
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.remember
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.platform.LocalLayoutDirection
import androidx.compose.ui.res.pluralStringResource
import androidx.compose.ui.res.stringResource
import androidx.compose.ui.semantics.contentDescription
import androidx.compose.ui.semantics.semantics
import androidx.compose.ui.text.style.TextAlign
import androidx.compose.ui.text.style.TextOverflow
import androidx.compose.ui.unit.LayoutDirection
import androidx.compose.ui.unit.dp
import androidx.tv.material3.Icon
import androidx.tv.material3.Text
import app.mishana.tv.R
import app.mishana.tv.billing.FakeChoice
import app.mishana.tv.billing.PackCard
import app.mishana.tv.billing.PackTrailing
import app.mishana.tv.billing.PremiumCard
import app.mishana.tv.billing.Products
import app.mishana.tv.billing.StoreEntry
import app.mishana.tv.billing.StoreFocusTarget
import app.mishana.tv.billing.StoreModel
import app.mishana.tv.billing.StorePhase
import app.mishana.tv.billing.StoreScreenModel
import app.mishana.tv.billing.StoreUiState
import app.mishana.tv.billing.UnavailableReason
import app.mishana.tv.i18n.isolate
import app.mishana.tv.protocol.TvView
import app.mishana.tv.ui.components.ButtonKind
import app.mishana.tv.ui.components.FocusTrap
import app.mishana.tv.ui.components.InitialFocus
import app.mishana.tv.ui.components.MishButton
import app.mishana.tv.ui.components.MishFocusSurface
import app.mishana.tv.ui.components.MishIcons
import app.mishana.tv.ui.components.OverlayCard
import app.mishana.tv.ui.components.Spinner
import app.mishana.tv.ui.components.blockPointer
import app.mishana.tv.ui.components.fullBleed
import app.mishana.tv.ui.theme.LocalIsArabic
import app.mishana.tv.ui.theme.MishColors
import app.mishana.tv.ui.theme.MishShapes
import app.mishana.tv.ui.theme.MishSpace
import app.mishana.tv.ui.theme.MishTheme

/**
 * PAYMENTS-SPEC §4.4 Store overlay (LOBBY only), remote-only: Up/Down between the Premium card, the packs row and the
 * footer, Left/Right within a row (RTL mirrors), OK activates, Back closes and returns focus to the opener (AppRoot).
 * No element needs Menu or long-press. Layout at 960×540 dp inside the safe area: header (title + room code), the
 * full-width Premium card (one-time lifetime unlock: one button + the one-time purchase line), the packs row, the footer.
 */
@Composable
fun StoreScreen(
    entry: StoreEntry,
    state: StoreUiState,
    view: TvView,
    onClose: () -> Unit,
    onRetry: () -> Unit,
    onBuy: (productId: String) -> Unit,
    onRestore: () -> Unit,
) {
    val now = System.currentTimeMillis()
    val model = if (state.phase == StorePhase.Ready) StoreModel.build(state, view.settings.wordLocale, view.lockedPacks, now) else null
    val target = StoreModel.initialFocus(entry, state.phase, model)

    val closeFocus = remember { FocusRequester() }
    val retryFocus = remember { FocusRequester() }
    val okFocus = remember { FocusRequester() }
    val unlockFocus = remember { FocusRequester() }
    val restoreFocus = remember { FocusRequester() }
    val packFocus = remember { mutableMapOf<String, FocusRequester>() }
    val initial: FocusRequester = when (target) {
        StoreFocusTarget.Loading -> closeFocus
        StoreFocusTarget.Retry -> retryFocus
        StoreFocusTarget.Ok -> okFocus
        StoreFocusTarget.Unlock -> unlockFocus
        StoreFocusTarget.Restore -> restoreFocus
        is StoreFocusTarget.Pack -> packFocus.getOrPut(target.productId) { FocusRequester() }
    }

    Box(
        Modifier
            .fillMaxSize()
            .fullBleed()
            .background(MishColors.Bg)
            .blockPointer(),
    ) {
        FocusTrap(onBack = onClose, modifier = Modifier.fillMaxSize(), default = initial) {
            Column(Modifier.fillMaxSize().padding(horizontal = MishSpace.SafeH, vertical = MishSpace.SafeV)) {
                StoreHeader(view.roomCode, state.fake)
                Spacer(Modifier.height(StoreMetrics.HEADER_GAP.dp))
                when (val phase = state.phase) {
                    StorePhase.Loading -> CenterMessage(stringResource(R.string.store__loading), spinner = true) {
                        MishButton(stringResource(R.string.common__close), onClose, Modifier.focusRequester(closeFocus), icon = MishIcons.X)
                    }
                    is StorePhase.Unavailable -> if (phase.reason == UnavailableReason.NETWORK) {
                        CenterMessage(stringResource(R.string.store__unavailable)) {
                            MishButton(
                                stringResource(R.string.common__retry), onRetry, Modifier.focusRequester(retryFocus),
                                kind = ButtonKind.Primary, icon = MishIcons.Refresh, minWidth = 220.dp,
                            )
                        }
                    } else {
                        CenterMessage(stringResource(R.string.store__play_unavailable)) {
                            MishButton(stringResource(R.string.common__ok), onClose, Modifier.focusRequester(okFocus), kind = ButtonKind.Primary, minWidth = 220.dp)
                        }
                    }
                    StorePhase.Ready -> if (model != null) {
                        ReadyBody(
                            model = model,
                            onBuy = onBuy,
                            onRestore = onRestore,
                            unlockFocus = unlockFocus,
                            packFocus = packFocus,
                            restoreFocus = restoreFocus,
                        )
                    }
                }
            }
        }
        // Re-targets when the phase changes (Loading → Ready / Unavailable), so something is always focused.
        InitialFocus(initial, key = target)
    }
}

@Composable
private fun StoreHeader(roomCode: String, testMode: Boolean) {
    val type = MishTheme.type
    Row(Modifier.fillMaxWidth().height(StoreMetrics.HEADER_H.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(MishIcons.Gem, contentDescription = null, tint = MishColors.Accent, modifier = Modifier.size(26.dp))
        Spacer(Modifier.width(MishSpace.s3))
        Text(stringResource(R.string.store__title), style = type.title, color = MishColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (testMode) {
            Spacer(Modifier.width(MishSpace.s4))
            Text(
                stringResource(R.string.store__test_mode),
                style = type.caption,
                color = MishColors.OnAccent,
                maxLines = 1,
                modifier = Modifier.background(MishColors.Accent, MishShapes.pill).padding(horizontal = 12.dp, vertical = 2.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        // The room code stays readable for late arrivals (same style as the in-game top bar's mini code), LTR-isolated.
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(
                roomCode,
                style = type.label.copy(letterSpacing = type.code.letterSpacing),
                color = MishColors.Accent,
                modifier = Modifier.semantics { contentDescription = roomCode.toCharArray().joinToString(" ") },
            )
        }
    }
}

@Composable
private fun CenterMessage(text: String, spinner: Boolean = false, action: @Composable () -> Unit) {
    Column(Modifier.fillMaxSize(), horizontalAlignment = Alignment.CenterHorizontally, verticalArrangement = Arrangement.Center) {
        if (spinner) {
            Spinner(size = 48.dp)
            Spacer(Modifier.height(MishSpace.s4))
        }
        Text(text, style = MishTheme.type.title, color = MishColors.Text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(MishSpace.s6))
        action()
    }
}

@Composable
private fun ReadyBody(
    model: StoreScreenModel,
    onBuy: (String) -> Unit,
    onRestore: () -> Unit,
    unlockFocus: FocusRequester,
    packFocus: MutableMap<String, FocusRequester>,
    restoreFocus: FocusRequester,
) {
    val type = MishTheme.type
    Column(Modifier.fillMaxSize()) {
        PremiumCardView(model, onBuy, unlockFocus)
        Spacer(Modifier.height(StoreMetrics.CARD_TO_PACKS.dp))
        Text(stringResource(R.string.store__packs_title), style = type.label, color = MishColors.TextSecondary, maxLines = 1)
        Spacer(Modifier.height(StoreMetrics.PACKS_TITLE_GAP.dp))
        PacksRow(model.packs, model.showOtherLanguages, onBuy, packFocus)
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth().height(StoreMetrics.FOOTER_H.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(MishSpace.s4)) {
            MishButton(stringResource(R.string.store__restore), onRestore, Modifier.focusRequester(restoreFocus), icon = MishIcons.Refresh)
            // One caption line fits FOOTER_H (StoreMetrics.footerLine): pending notice, then the card tip, then help.
            Box(Modifier.weight(1f)) {
                when (StoreMetrics.footerLine(model.pendingFooter, Products.SUPPORT_EMAIL, model.ownsNothing)) {
                    StoreMetrics.FooterLine.PENDING ->
                        Text(stringResource(R.string.store__pending_body), style = type.caption, color = MishColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    StoreMetrics.FooterLine.CARD_TIP ->
                        Text(stringResource(R.string.store__card_tip, isolate(StoreMetrics.CARD_TIP_URL)), style = type.caption, color = MishColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    StoreMetrics.FooterLine.HELP ->
                        Text(stringResource(R.string.store__help, isolate(Products.SUPPORT_EMAIL)), style = type.caption, color = MishColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    StoreMetrics.FooterLine.NONE -> Unit
                }
            }
            Text(stringResource(R.string.common__back), style = type.caption, color = MishColors.TextMuted)
        }
    }
}

@Composable
private fun PremiumCardView(model: StoreScreenModel, onBuy: (String) -> Unit, unlockFocus: FocusRequester) {
    val type = MishTheme.type
    Column(
        Modifier
            .fillMaxWidth()
            .background(MishColors.Surface, MishShapes.tile)
            .padding(horizontal = StoreMetrics.CARD_PAD_H.dp, vertical = StoreMetrics.CARD_PAD_V.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.store__premium_title), style = type.title, color = MishColors.Accent, maxLines = 1)
            Spacer(Modifier.width(StoreMetrics.TITLE_PITCH_GAP.dp))
            if (model.pitchCount > 0) {
                Text(
                    pluralStringResource(R.plurals.store__premium_pitch, model.pitchCount, model.pitchCount, isolate(model.pitchPairs.toString())),
                    style = type.caption,
                    color = MishColors.TextSecondary,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(StoreMetrics.CARD_GAP.dp))
        when (val c = model.premium) {
            is PremiumCard.Unlock -> {
                UnlockButton(c, onClick = { if (c.buyable) onBuy(Products.PREMIUM_PRODUCT_ID) }, modifier = Modifier.focusRequester(unlockFocus))
                Spacer(Modifier.height(StoreMetrics.CARD_GAP.dp))
                Text(stringResource(R.string.store__premium_lifetime), style = type.caption, color = MishColors.TextSecondary)
            }
            PremiumCard.Active -> Row(verticalAlignment = Alignment.CenterVertically) {
                Icon(MishIcons.Check, contentDescription = null, tint = MishColors.Success, modifier = Modifier.size(24.dp))
                Spacer(Modifier.width(MishSpace.s2))
                Text(stringResource(R.string.store__premium_active), style = type.titleS, color = MishColors.Success)
            }
            PremiumCard.NoProduct -> Text(stringResource(R.string.store__unavailable), style = type.body, color = MishColors.TextSecondary)
        }
    }
}

/**
 * The one primary button "Unlock Premium · {price}" on a single line (titleS). It stays focusable in every state; while a
 * purchase is pending or being confirmed it shows that status instead of the price, and OK does nothing.
 */
@Composable
private fun UnlockButton(c: PremiumCard.Unlock, onClick: () -> Unit, modifier: Modifier) {
    val type = MishTheme.type
    val label = stringResource(R.string.store__unlock_premium, isolate(c.price))
    MishFocusSurface(
        onClick = onClick,
        modifier = modifier
            .widthIn(min = StoreMetrics.UNLOCK_MIN_W.dp, max = StoreMetrics.CARD_INNER_W.dp)
            .height(StoreMetrics.UNLOCK_H.dp)
            .semantics(mergeDescendants = true) {},
        shape = MishShapes.pill,
        container = if (c.buyable) MishColors.Primary else MishColors.Elevated,
        content = if (c.buyable) MishColors.OnPrimary else MishColors.Text,
        focusedContainer = if (c.buyable) MishColors.Primary else MishColors.Elevated,
        focusedContent = if (c.buyable) MishColors.OnPrimary else MishColors.Text,
    ) {
        Row(
            Modifier.align(Alignment.Center).padding(horizontal = StoreMetrics.UNLOCK_PAD_H.dp),
            verticalAlignment = Alignment.CenterVertically,
        ) {
            when {
                c.confirming -> {
                    Spinner(size = 18.dp)
                    Spacer(Modifier.width(MishSpace.s2))
                    Text(stringResource(R.string.store__confirming), style = type.titleS, maxLines = 1)
                }
                c.pending -> Text(
                    stringResource(R.string.store__pending),
                    style = type.caption,
                    color = MishColors.OnAccent,
                    maxLines = 1,
                    modifier = Modifier.background(MishColors.Accent, MishShapes.pill).padding(horizontal = 12.dp, vertical = 2.dp),
                )
                c.slow -> Text(stringResource(R.string.store__verify_failed), style = type.caption, color = MishColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                else -> Text(label, style = type.titleS, maxLines = 1, overflow = TextOverflow.Ellipsis)
            }
        }
    }
}

@Composable
private fun PacksRow(packs: List<PackCard>, showOther: Boolean, onBuy: (String) -> Unit, packFocus: MutableMap<String, FocusRequester>) {
    val firstOther = if (showOther) packs.indexOfFirst { it.otherLanguage } else -1
    val entry = packs.firstOrNull()?.let { packFocus.getOrPut(it.productId) { FocusRequester() } }
    LazyRow(
        modifier = Modifier.fillMaxWidth().then(if (entry != null) Modifier.focusRestorer(entry) else Modifier),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = StoreMetrics.PACK_ROW_PAD_V.dp),
        horizontalArrangement = Arrangement.spacedBy(MishSpace.s3),
    ) {
        items(packs.size + if (firstOther >= 0) 1 else 0, key = { i -> keyAt(packs, firstOther, i) }) { i ->
            val index = if (firstOther in 0..<i) i - 1 else i
            if (i == firstOther) {
                OtherLanguagesCard()
            } else {
                val p = packs[index]
                PackCardView(p, onBuy, Modifier.focusRequester(packFocus.getOrPut(p.productId) { FocusRequester() }))
            }
        }
    }
}

private fun keyAt(packs: List<PackCard>, firstOther: Int, i: Int): Any = when {
    i == firstOther -> "other-languages"
    firstOther in 0..<i -> packs[i - 1].productId
    else -> packs[i].productId
}

@Composable
private fun OtherLanguagesCard() {
    Box(Modifier.width(140.dp).height(StoreMetrics.packCardH(LocalIsArabic.current).dp), contentAlignment = Alignment.Center) {
        Text(stringResource(R.string.store__other_languages), style = MishTheme.type.caption, color = MishColors.TextMuted, textAlign = TextAlign.Center)
    }
}

/** A pack card: focusable in every state (it announces its state); OK buys only when a Buy button shows. */
@Composable
private fun PackCardView(p: PackCard, onBuy: (String) -> Unit, modifier: Modifier) {
    val type = MishTheme.type
    val title = localizedTitle(p.title)
    val trailing = when (val t = p.trailing) {
        PackTrailing.Owned -> stringResource(R.string.store__owned)
        PackTrailing.Included -> stringResource(R.string.store__included)
        PackTrailing.Pending -> stringResource(R.string.store__pending)
        PackTrailing.Confirming -> stringResource(R.string.store__confirming)
        PackTrailing.Slow -> stringResource(R.string.store__verify_failed)
        is PackTrailing.Buy -> stringResource(R.string.store__buy, isolate(t.price))
    }
    val pairs = pluralStringResource(R.plurals.store__pack_pairs, p.pairCount, p.pairCount)
    MishFocusSurface(
        onClick = { if (p.buyable) onBuy(p.productId) },
        modifier = modifier.width(StoreMetrics.PACK_CARD_W.dp).height(StoreMetrics.packCardH(LocalIsArabic.current).dp).semantics(mergeDescendants = true) { contentDescription = "$title, $pairs, $trailing" },
        shape = MishShapes.tile,
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = MishSpace.s3, vertical = StoreMetrics.PACK_CARD_PAD_V.dp)) {
            Text(title, style = type.titleS, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(pairs, style = type.caption, color = MishColors.TextMuted, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically) {
                when (p.trailing) {
                    PackTrailing.Owned -> Icon(MishIcons.Check, null, tint = MishColors.Success, modifier = Modifier.size(20.dp))
                    PackTrailing.Confirming -> Spinner(size = 18.dp)
                    else -> Unit
                }
                if (p.trailing == PackTrailing.Owned || p.trailing == PackTrailing.Confirming) Spacer(Modifier.width(6.dp))
                Text(
                    trailing,
                    style = type.label,
                    color = when (p.trailing) {
                        is PackTrailing.Buy -> MishColors.Primary
                        PackTrailing.Owned -> MishColors.Success
                        PackTrailing.Pending -> MishColors.Accent
                        else -> MishColors.TextSecondary
                    },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** The Debug fake store's purchase dialog (§4.8; debug builds only reach it). English only: never shipped. */
@Composable
fun FakePurchaseDialog(productId: String, onChoose: (FakeChoice) -> Unit) {
    val approve = remember { FocusRequester() }
    OverlayCard(onBack = { onChoose(FakeChoice.CANCEL) }, width = 620.dp, default = approve) {
        Text("Fake purchase: $productId", style = MishTheme.type.headline, color = MishColors.Text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            MishButton("Approve", { onChoose(FakeChoice.APPROVE) }, Modifier.focusRequester(approve), kind = ButtonKind.Primary)
            MishButton("Pending", { onChoose(FakeChoice.PENDING) })
            MishButton("Cancel", { onChoose(FakeChoice.CANCEL) })
            MishButton("Error", { onChoose(FakeChoice.ERROR) }, kind = ButtonKind.Danger)
        }
    }
    InitialFocus(approve)
}
