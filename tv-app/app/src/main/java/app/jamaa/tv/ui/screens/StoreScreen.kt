package app.jamaa.tv.ui.screens

import android.content.ActivityNotFoundException
import android.content.Context
import android.content.Intent
import android.net.Uri
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
import androidx.compose.foundation.layout.offset
import androidx.compose.foundation.lazy.LazyRow
import androidx.compose.runtime.Composable
import androidx.compose.runtime.CompositionLocalProvider
import androidx.compose.runtime.getValue
import androidx.compose.runtime.mutableStateOf
import androidx.compose.runtime.remember
import androidx.compose.runtime.setValue
import androidx.compose.ui.Alignment
import androidx.compose.ui.Modifier
import androidx.compose.ui.focus.FocusRequester
import androidx.compose.ui.focus.focusRequester
import androidx.compose.ui.focus.focusRestorer
import androidx.compose.ui.focus.onFocusChanged
import androidx.compose.ui.platform.LocalContext
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
import app.jamaa.tv.R
import app.jamaa.tv.billing.BillingPeriod
import app.jamaa.tv.billing.Disclosure
import app.jamaa.tv.billing.OfferSelection
import app.jamaa.tv.billing.FakeChoice
import app.jamaa.tv.billing.PackCard
import app.jamaa.tv.billing.PackTrailing
import app.jamaa.tv.billing.PlanOffer
import app.jamaa.tv.billing.PremiumCard
import app.jamaa.tv.billing.Products
import app.jamaa.tv.billing.StoreEntry
import app.jamaa.tv.billing.StoreFocusTarget
import app.jamaa.tv.billing.StoreModel
import app.jamaa.tv.billing.StorePhase
import app.jamaa.tv.billing.StoreScreenModel
import app.jamaa.tv.billing.StoreUiState
import app.jamaa.tv.billing.UnavailableReason
import app.jamaa.tv.i18n.isolate
import app.jamaa.tv.protocol.LockedPackInfo
import app.jamaa.tv.ui.components.ButtonKind
import app.jamaa.tv.ui.components.FocusTrap
import app.jamaa.tv.ui.components.InitialFocus
import app.jamaa.tv.ui.components.LocalFocusBlocked
import app.jamaa.tv.ui.components.JamaaButton
import app.jamaa.tv.ui.components.JamaaFocusSurface
import app.jamaa.tv.ui.components.JamaaIcons
import app.jamaa.tv.ui.components.OverlayCard
import app.jamaa.tv.ui.components.Spinner
import app.jamaa.tv.ui.components.blockPointer
import app.jamaa.tv.ui.components.fullBleed
import app.jamaa.tv.ui.components.inertWhen
import app.jamaa.tv.ui.theme.LocalIsArabic
import app.jamaa.tv.ui.theme.JamaaColors
import app.jamaa.tv.ui.theme.JamaaShapes
import app.jamaa.tv.ui.theme.JamaaSpace
import app.jamaa.tv.ui.theme.JamaaTheme
import java.text.DateFormat
import java.util.Date
import java.util.Locale

/**
 * PAYMENTS-SPEC §4.4 Store overlay (LOBBY only), remote-only: Up/Down between the Premium card, the packs row and the
 * footer, Left/Right within a row (RTL mirrors), OK activates, Back closes and returns focus to the opener (AppRoot).
 * No element needs Menu or long-press. Layout at 960×540 dp inside the safe area: header (title + room code), the
 * full-width Premium card with the disclosure for the focused plan (§4.5), the packs row, the footer.
 */
@Composable
fun StoreScreen(
    entry: StoreEntry,
    state: StoreUiState,
    view: StoreRoomContext,
    onClose: () -> Unit,
    onRetry: () -> Unit,
    onBuy: (productId: String, basePlanId: String?) -> Unit,
    onRestore: () -> Unit,
) {
    val now = System.currentTimeMillis()
    val model = if (state.phase == StorePhase.Ready) StoreModel.build(state, view.contentLocale, view.lockedPacks, now) else null
    val target = StoreModel.initialFocus(entry, state.phase, model)
    var manageHint by remember { mutableStateOf(false) }
    val context = LocalContext.current

    val closeFocus = remember { FocusRequester() }
    val retryFocus = remember { FocusRequester() }
    val okFocus = remember { FocusRequester() }
    val fixFocus = remember { FocusRequester() }
    val manageFocus = remember { FocusRequester() }
    val restoreFocus = remember { FocusRequester() }
    val planFocus = remember { mutableMapOf<String, FocusRequester>() }
    val packFocus = remember { mutableMapOf<String, FocusRequester>() }
    val initial: FocusRequester = when (target) {
        StoreFocusTarget.Loading -> closeFocus
        StoreFocusTarget.Retry -> retryFocus
        StoreFocusTarget.Ok -> okFocus
        StoreFocusTarget.FixPayment -> fixFocus
        StoreFocusTarget.Manage -> manageFocus
        StoreFocusTarget.Restore -> restoreFocus
        is StoreFocusTarget.Plan -> planFocus.getOrPut(target.basePlanId) { FocusRequester() }
        is StoreFocusTarget.Pack -> packFocus.getOrPut(target.productId) { FocusRequester() }
    }
    val openManage = { if (!openManageLink(context)) manageHint = true }

    Box(
        Modifier
            .fillMaxSize()
            .fullBleed()
            .background(JamaaColors.Bg)
            .blockPointer(),
    ) {
        CompositionLocalProvider(LocalFocusBlocked provides (LocalFocusBlocked.current || manageHint)) {
            FocusTrap(onBack = onClose, modifier = Modifier.fillMaxSize().inertWhen(manageHint), default = initial) {
                Column(Modifier.fillMaxSize().padding(horizontal = JamaaSpace.SafeH, vertical = JamaaSpace.SafeV)) {
                    StoreHeader(view.roomCode, state.fake)
                    Spacer(Modifier.height(StoreMetrics.HEADER_GAP.dp))
                    when (val phase = state.phase) {
                        StorePhase.Loading -> CenterMessage(stringResource(R.string.store__loading), spinner = true) {
                            JamaaButton(stringResource(R.string.common__close), onClose, Modifier.focusRequester(closeFocus), icon = JamaaIcons.X)
                        }
                        is StorePhase.Unavailable -> if (phase.reason == UnavailableReason.NETWORK) {
                            CenterMessage(stringResource(R.string.store__unavailable)) {
                                JamaaButton(
                                    stringResource(R.string.common__retry), onRetry, Modifier.focusRequester(retryFocus),
                                    kind = ButtonKind.Primary, icon = JamaaIcons.Refresh, minWidth = 220.dp,
                                )
                            }
                        } else {
                            CenterMessage(stringResource(R.string.store__play_unavailable)) {
                                JamaaButton(stringResource(R.string.common__ok), onClose, Modifier.focusRequester(okFocus), kind = ButtonKind.Primary, minWidth = 220.dp)
                            }
                        }
                        StorePhase.Ready -> if (model != null) {
                            ReadyBody(
                                model = model,
                                onBuy = onBuy,
                                onManage = openManage,
                                onRestore = onRestore,
                                planFocus = planFocus,
                                packFocus = packFocus,
                                fixFocus = fixFocus,
                                manageFocus = manageFocus,
                                restoreFocus = restoreFocus,
                            )
                        }
                    }
                }
            }
            // Re-targets when the phase changes (Loading → Ready / Unavailable), so something is always focused.
            InitialFocus(initial, key = target)
        }
        if (manageHint) {
            val ok = remember { FocusRequester() }
            OverlayCard(onBack = { manageHint = false }, default = ok) {
                Text(stringResource(R.string.store__manage), style = JamaaTheme.type.headline, color = JamaaColors.Text, textAlign = TextAlign.Center)
                Spacer(Modifier.height(12.dp))
                Text(stringResource(R.string.store__manage_hint), style = JamaaTheme.type.body, color = JamaaColors.TextSecondary, textAlign = TextAlign.Center)
                Spacer(Modifier.height(24.dp))
                JamaaButton(stringResource(R.string.common__ok), { manageHint = false }, Modifier.focusRequester(ok), kind = ButtonKind.Primary, minWidth = 180.dp)
            }
            InitialFocus(ok)
        }
    }
}

/**
 * §4.4: `Intent.ACTION_VIEW` on the Play subscriptions link. False when nothing handles it (the caller then shows
 * `store.manageHint`: no QR code, no URL to type). [VERIFY] on a real Google TV that the Play Store handles the link.
 */
private fun openManageLink(context: Context): Boolean = try {
    context.startActivity(Intent(Intent.ACTION_VIEW, Uri.parse(Products.MANAGE_SUBSCRIPTION_URL)))
    true
} catch (e: ActivityNotFoundException) {
    false
} catch (e: SecurityException) {
    false
}

@Composable
private fun StoreHeader(roomCode: String, testMode: Boolean) {
    val type = JamaaTheme.type
    Row(Modifier.fillMaxWidth().height(StoreMetrics.HEADER_H.dp), verticalAlignment = Alignment.CenterVertically) {
        Icon(JamaaIcons.Gem, contentDescription = null, tint = JamaaColors.Accent, modifier = Modifier.size(26.dp))
        Spacer(Modifier.width(JamaaSpace.s3))
        Text(stringResource(R.string.pass__store_title), style = type.title, color = JamaaColors.Text, maxLines = 1, overflow = TextOverflow.Ellipsis)
        if (testMode) {
            Spacer(Modifier.width(JamaaSpace.s4))
            Text(
                stringResource(R.string.store__test_mode),
                style = type.caption,
                color = JamaaColors.OnAccent,
                maxLines = 1,
                modifier = Modifier.background(JamaaColors.Accent, JamaaShapes.pill).padding(horizontal = 12.dp, vertical = 2.dp),
            )
        }
        Spacer(Modifier.weight(1f))
        // The room code stays readable for late arrivals (same style as the in-game top bar's mini code), LTR-isolated.
        CompositionLocalProvider(LocalLayoutDirection provides LayoutDirection.Ltr) {
            Text(
                roomCode,
                style = type.label.copy(letterSpacing = type.code.letterSpacing),
                color = JamaaColors.Accent,
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
            Spacer(Modifier.height(JamaaSpace.s4))
        }
        Text(text, style = JamaaTheme.type.title, color = JamaaColors.Text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(JamaaSpace.s6))
        action()
    }
}

@Composable
private fun ReadyBody(
    model: StoreScreenModel,
    onBuy: (String, String?) -> Unit,
    onManage: () -> Unit,
    onRestore: () -> Unit,
    planFocus: MutableMap<String, FocusRequester>,
    packFocus: MutableMap<String, FocusRequester>,
    fixFocus: FocusRequester,
    manageFocus: FocusRequester,
    restoreFocus: FocusRequester,
) {
    val type = JamaaTheme.type
    Column(Modifier.fillMaxSize()) {
        PremiumCardView(model, onBuy, onManage, planFocus, fixFocus, manageFocus)
        Spacer(Modifier.height(StoreMetrics.CARD_TO_PACKS.dp))
        Text(stringResource(R.string.store__packs_title), style = type.label, color = JamaaColors.TextSecondary, maxLines = 1)
        Spacer(Modifier.height(StoreMetrics.PACKS_TITLE_GAP.dp))
        PacksRow(model.packs, model.showOtherLanguages, onBuy, packFocus)
        Spacer(Modifier.weight(1f))
        Row(Modifier.fillMaxWidth().height(StoreMetrics.FOOTER_H.dp), verticalAlignment = Alignment.CenterVertically, horizontalArrangement = Arrangement.spacedBy(JamaaSpace.s4)) {
            JamaaButton(stringResource(R.string.store__restore), onRestore, Modifier.focusRequester(restoreFocus), icon = JamaaIcons.Refresh)
            // One caption line fits FOOTER_H (StoreMetrics.footerLine): pending notice, then the card tip, then help.
            Box(Modifier.weight(1f)) {
                when (StoreMetrics.footerLine(model.pendingFooter, Products.SUPPORT_EMAIL, model.ownsNothing)) {
                    StoreMetrics.FooterLine.PENDING ->
                        Text(stringResource(R.string.store__pending_body), style = type.caption, color = JamaaColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    StoreMetrics.FooterLine.CARD_TIP ->
                        Text(stringResource(R.string.store__card_tip, isolate(StoreMetrics.CARD_TIP_URL)), style = type.caption, color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    StoreMetrics.FooterLine.HELP ->
                        Text(stringResource(R.string.store__help, isolate(Products.SUPPORT_EMAIL)), style = type.caption, color = JamaaColors.TextMuted, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    StoreMetrics.FooterLine.NONE -> Unit
                }
            }
            Text(stringResource(R.string.common__back), style = type.caption, color = JamaaColors.TextMuted)
        }
    }
}

@Composable
private fun PremiumCardView(
    model: StoreScreenModel,
    onBuy: (String, String?) -> Unit,
    onManage: () -> Unit,
    planFocus: MutableMap<String, FocusRequester>,
    fixFocus: FocusRequester,
    manageFocus: FocusRequester,
) {
    val type = JamaaTheme.type
    Column(
        Modifier
            .fillMaxWidth()
            .background(JamaaColors.Surface, JamaaShapes.tile)
            .padding(horizontal = StoreMetrics.CARD_PAD_H.dp, vertical = StoreMetrics.CARD_PAD_V.dp),
    ) {
        Row(verticalAlignment = Alignment.CenterVertically) {
            Text(stringResource(R.string.pass__name), style = type.title, color = JamaaColors.Accent, maxLines = 1)
            Spacer(Modifier.width(StoreMetrics.TITLE_PITCH_GAP.dp))
            if (model.pitchCount > 0) {
                Text(
                    pluralStringResource(R.plurals.store__premium_pitch, model.pitchCount, model.pitchCount, isolate(model.pitchPairs.toString())),
                    style = type.caption,
                    color = JamaaColors.TextSecondary,
                    maxLines = 2,
                    modifier = Modifier.weight(1f),
                )
            }
        }
        Spacer(Modifier.height(StoreMetrics.CARD_GAP.dp))
        when (val c = model.premium) {
            is PremiumCard.Plans -> PlansBlock(c, onBuy, planFocus)
            PremiumCard.Suspended -> {
                Text(stringResource(R.string.store__fix_payment), style = type.body, color = JamaaColors.Danger)
                Spacer(Modifier.height(JamaaSpace.s2))
                JamaaButton(stringResource(R.string.store__fix_payment_button), onManage, Modifier.focusRequester(fixFocus), kind = ButtonKind.Primary)
            }
            PremiumCard.Grace -> {
                Text(stringResource(R.string.store__premium_active), style = type.titleS, color = JamaaColors.Success)
                Text(stringResource(R.string.store__fix_payment), style = type.body, color = JamaaColors.Danger)
                Spacer(Modifier.height(JamaaSpace.s2))
                JamaaButton(stringResource(R.string.store__manage), onManage, Modifier.focusRequester(manageFocus), kind = ButtonKind.Primary)
            }
            is PremiumCard.Active -> {
                Row(verticalAlignment = Alignment.CenterVertically) {
                    Icon(JamaaIcons.Check, contentDescription = null, tint = JamaaColors.Success, modifier = Modifier.size(24.dp))
                    Spacer(Modifier.width(JamaaSpace.s2))
                    Text(stringResource(R.string.store__premium_active), style = type.titleS, color = JamaaColors.Success)
                    val until = c.untilMs
                    if (until != null) {
                        Spacer(Modifier.width(JamaaSpace.s4))
                        val date = isolate(formatDate(until, uiLanguage()))
                        Text(
                            stringResource(if (c.autoRenewing) R.string.store__renews_on else R.string.store__ends_on, date),
                            style = type.body,
                            color = JamaaColors.TextSecondary,
                        )
                    }
                }
                Spacer(Modifier.height(JamaaSpace.s2))
                JamaaButton(stringResource(R.string.store__manage), onManage, Modifier.focusRequester(manageFocus))
            }
            PremiumCard.NoProduct -> Text(stringResource(R.string.store__unavailable), style = type.body, color = JamaaColors.TextSecondary)
        }
    }
}

/** What the Pass store needs from the room (JAMAA-PLATFORM §4.5): code, content language, the setup's locked packs. */
data class StoreRoomContext(val roomCode: String, val contentLocale: String, val lockedPacks: List<LockedPackInfo>)

/** §4.4/§4.5: yearly then monthly, side by side; one disclosure paragraph for the focused plan, always visible. */
@Composable
private fun PlansBlock(c: PremiumCard.Plans, onBuy: (String, String?) -> Unit, planFocus: MutableMap<String, FocusRequester>) {
    var focused by remember { mutableStateOf(c.plans.first().basePlanId) }
    val plan = c.plans.firstOrNull { it.basePlanId == focused } ?: c.plans.first()
    Spacer(Modifier.height(StoreMetrics.BADGE_OVERHANG.dp)) // room for the trial badge sticker
    // JAMAA-PLATFORM §4.5 "Save {n}%" on the Yearly card, from the two ProductDetails prices.
    val save = OfferSelection.savePercent(
        c.plans.firstOrNull { it.basePlanId == Products.BASE_PLAN_MONTHLY },
        c.plans.firstOrNull { it.basePlanId == Products.BASE_PLAN_YEARLY },
    )
    Row(horizontalArrangement = Arrangement.spacedBy(JamaaSpace.s4)) { // 2 × 400 + 16 ≤ 824 dp
        for (p in c.plans) {
            PlanButton(
                plan = p,
                savePercent = if (p.basePlanId == Products.BASE_PLAN_YEARLY) save else null,
                status = when {
                    c.confirming -> PlanStatus.Confirming
                    c.slow -> PlanStatus.Slow
                    c.pending -> PlanStatus.Pending
                    else -> PlanStatus.None
                },
                onClick = { if (!c.confirming && !c.pending) onBuy(Products.PREMIUM_PRODUCT_ID, p.basePlanId) },
                modifier = Modifier
                    .focusRequester(planFocus.getOrPut(p.basePlanId) { FocusRequester() })
                    .onFocusChanged { if (it.isFocused) focused = p.basePlanId },
            )
        }
    }
    Spacer(Modifier.height(StoreMetrics.CARD_GAP.dp))
    DisclosureText(Disclosure.of(plan), plan)
}

private enum class PlanStatus { None, Pending, Confirming, Slow }

@Composable
private fun PlanButton(plan: PlanOffer, status: PlanStatus, onClick: () -> Unit, modifier: Modifier, savePercent: Int? = null) {
    val type = JamaaTheme.type
    val yearly = plan.basePlanId == Products.BASE_PLAN_YEARLY
    val name = stringResource(if (yearly) R.string.store__plan_yearly else R.string.store__plan_monthly)
    val price = stringResource(
        if (periodOf(plan) == BillingPeriod.YEAR) R.string.store__price_per_year else R.string.store__price_per_month,
        isolate(plan.price),
    )
    // The trial badge is a sticker on the top-end corner (§4.4 "a separate badge sits on the button"), so the one-line
    // label keeps the full width; StoreMetrics.BADGE_OVERHANG reserves its overhang above the row.
    Box {
        JamaaFocusSurface(
            onClick = onClick,
            modifier = modifier.width(StoreMetrics.PLAN_W.dp).height(StoreMetrics.PLAN_H.dp).semantics(mergeDescendants = true) {},
            shape = JamaaShapes.row,
            container = if (yearly) JamaaColors.Elevated else JamaaColors.Surface,
        ) {
            // One line: "Yearly · $29.99 / year" (the plan name + price, §4.4), or the purchase status in place of the price.
            Row(Modifier.fillMaxSize().padding(horizontal = StoreMetrics.PLAN_PAD_H.dp), verticalAlignment = Alignment.CenterVertically) {
                Text(name, style = type.titleS, maxLines = 1)
                Text("  ·  ", style = type.titleS, color = JamaaColors.TextMuted, maxLines = 1)
                when (status) {
                    PlanStatus.None -> Text(price, style = type.titleS, color = JamaaColors.Accent, maxLines = 1, overflow = TextOverflow.Ellipsis)
                    PlanStatus.Pending -> Text(stringResource(R.string.store__pending), style = type.caption, color = JamaaColors.Accent, maxLines = 1)
                    PlanStatus.Confirming -> {
                        Spinner(size = 18.dp)
                        Spacer(Modifier.width(JamaaSpace.s2))
                        Text(stringResource(R.string.store__confirming), style = type.caption, maxLines = 1)
                    }
                    PlanStatus.Slow -> Text(stringResource(R.string.store__verify_failed), style = type.caption, color = JamaaColors.TextSecondary, maxLines = 1, overflow = TextOverflow.Ellipsis)
                }
            }
        }
        val days = plan.trialDays
        // §4.1: "7 days free" only when Play returned the eligible trial-7d offer for this user.
        if (days != null && plan.trialBadge && status == PlanStatus.None) {
            Text(
                pluralStringResource(R.plurals.pass__trial_badge, days, days),
                style = type.caption,
                color = JamaaColors.OnAccent,
                maxLines = 1,
                modifier = Modifier
                    .align(Alignment.TopEnd)
                    .offset(x = (-StoreMetrics.PLAN_PAD_H).dp, y = (-StoreMetrics.BADGE_OVERHANG).dp)
                    .background(JamaaColors.Accent, JamaaShapes.pill)
                    .padding(horizontal = 10.dp, vertical = 0.dp),
            )
        }
        if (savePercent != null && status == PlanStatus.None) {
            Text(
                stringResource(R.string.pass__save, "$savePercent%"),
                style = type.caption,
                color = JamaaColors.Ink,
                maxLines = 1,
                modifier = Modifier
                    .align(Alignment.TopStart)
                    .offset(x = StoreMetrics.PLAN_PAD_H.dp, y = (-StoreMetrics.BADGE_OVERHANG).dp)
                    .background(JamaaColors.Success, JamaaShapes.pill)
                    .padding(horizontal = 10.dp, vertical = 0.dp),
            )
        }
    }
}

/** §4.5: price, period, trial terms, auto-renewal and how to cancel, for the focused plan. Never truncated. */
@Composable
private fun DisclosureText(d: Disclosure, plan: PlanOffer) {
    val period = isolate(stringResource(if (periodOf(plan) == BillingPeriod.YEAR) R.string.store__period_year else R.string.store__period_month))
    val price = isolate(d.price)
    val days = d.trialDays
    val first = if (days != null) {
        pluralStringResource(R.plurals.store__legal_trial_renew, days, days, price, period)
    } else {
        stringResource(R.string.store__legal_price_renew, price, period)
    }
    val cancel = stringResource(if (days != null) R.string.store__legal_cancel_trial else R.string.store__legal_cancel)
    Text("$first $cancel", style = JamaaTheme.type.caption, color = JamaaColors.TextSecondary)
}

/** The plan's period from Play's billingPeriod, else from the base plan id. */
private fun periodOf(plan: PlanOffer): BillingPeriod =
    plan.period ?: if (plan.basePlanId == Products.BASE_PLAN_YEARLY) BillingPeriod.YEAR else BillingPeriod.MONTH

@Composable
private fun PacksRow(packs: List<PackCard>, showOther: Boolean, onBuy: (String, String?) -> Unit, packFocus: MutableMap<String, FocusRequester>) {
    val firstOther = if (showOther) packs.indexOfFirst { it.otherLanguage } else -1
    val entry = packs.firstOrNull()?.let { packFocus.getOrPut(it.productId) { FocusRequester() } }
    LazyRow(
        modifier = Modifier.fillMaxWidth().then(if (entry != null) Modifier.focusRestorer(entry) else Modifier),
        contentPadding = PaddingValues(horizontal = 6.dp, vertical = StoreMetrics.PACK_ROW_PAD_V.dp),
        horizontalArrangement = Arrangement.spacedBy(JamaaSpace.s3),
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
        Text(stringResource(R.string.store__other_languages), style = JamaaTheme.type.caption, color = JamaaColors.TextMuted, textAlign = TextAlign.Center)
    }
}

/** A pack card: focusable in every state (it announces its state); OK buys only when a Buy button shows. */
@Composable
private fun PackCardView(p: PackCard, onBuy: (String, String?) -> Unit, modifier: Modifier) {
    val type = JamaaTheme.type
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
    JamaaFocusSurface(
        onClick = { if (p.buyable) onBuy(p.productId, null) },
        modifier = modifier.width(StoreMetrics.PACK_CARD_W.dp).height(StoreMetrics.packCardH(LocalIsArabic.current).dp).semantics(mergeDescendants = true) { contentDescription = "$title, $pairs, $trailing" },
        shape = JamaaShapes.tile,
    ) {
        Column(Modifier.fillMaxSize().padding(horizontal = JamaaSpace.s3, vertical = StoreMetrics.PACK_CARD_PAD_V.dp)) {
            Text(title, style = type.titleS, maxLines = 1, overflow = TextOverflow.Ellipsis)
            Text(pairs, style = type.caption, color = JamaaColors.TextMuted, maxLines = 1)
            Row(verticalAlignment = Alignment.CenterVertically) {
                when (p.trailing) {
                    PackTrailing.Owned -> Icon(JamaaIcons.Check, null, tint = JamaaColors.Success, modifier = Modifier.size(20.dp))
                    PackTrailing.Confirming -> Spinner(size = 18.dp)
                    else -> Unit
                }
                if (p.trailing == PackTrailing.Owned || p.trailing == PackTrailing.Confirming) Spacer(Modifier.width(6.dp))
                Text(
                    trailing,
                    style = type.label,
                    color = when (p.trailing) {
                        is PackTrailing.Buy -> JamaaColors.Primary
                        PackTrailing.Owned -> JamaaColors.Success
                        PackTrailing.Pending -> JamaaColors.Accent
                        else -> JamaaColors.TextSecondary
                    },
                    maxLines = 1,
                    overflow = TextOverflow.Ellipsis,
                )
            }
        }
    }
}

/** §4.7: `DateFormat.MEDIUM`, Western digits in Arabic (`ar-LB-u-nu-latn`, DESIGN §3.5). */
fun formatDate(ms: Long, lang: String): String {
    val loc = if (lang == "ar") Locale.forLanguageTag("ar-LB-u-nu-latn") else Locale.forLanguageTag(lang)
    return DateFormat.getDateInstance(DateFormat.MEDIUM, loc).format(Date(ms))
}

/** The Debug fake store's purchase dialog (§4.8; debug builds only reach it). English only: never shipped. */
@Composable
fun FakePurchaseDialog(productId: String, onChoose: (FakeChoice) -> Unit) {
    val approve = remember { FocusRequester() }
    OverlayCard(onBack = { onChoose(FakeChoice.CANCEL) }, width = 620.dp, default = approve) {
        Text("Fake purchase: $productId", style = JamaaTheme.type.headline, color = JamaaColors.Text, textAlign = TextAlign.Center)
        Spacer(Modifier.height(24.dp))
        Row(horizontalArrangement = Arrangement.spacedBy(12.dp)) {
            JamaaButton("Approve", { onChoose(FakeChoice.APPROVE) }, Modifier.focusRequester(approve), kind = ButtonKind.Primary)
            JamaaButton("Pending", { onChoose(FakeChoice.PENDING) })
            JamaaButton("Cancel", { onChoose(FakeChoice.CANCEL) })
            JamaaButton("Error", { onChoose(FakeChoice.ERROR) }, kind = ButtonKind.Danger)
        }
    }
    InitialFocus(approve)
}
