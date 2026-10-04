package app.mishana.tv.billing

import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.LockedPackInfo
import app.mishana.tv.protocol.SubscriptionInfo
import org.junit.Assert.assertEquals
import org.junit.Assert.assertFalse
import org.junit.Assert.assertTrue
import org.junit.Test

/** PAYMENTS-SPEC §4.4 / §4.9 StoreFocusTest: the pure Store model (state machine, cards, initial focus). */
class StoreFocusTest {
    private val now = 1_790_000_000_000L
    private val catalog = FakeApi { now }.catalog
    private val lobby = StoreEntry(null, StoreOrigin.LOBBY_BUTTON)
    private val allProducts = PlayProducts.all("pack_en_food_01", "pack_en_things_01", "pack_fr_food_01", "pack_lb_food_01")

    private fun ready(entitlement: EntitlementBody? = null, products: ProductsSnapshot = allProducts, suspended: Boolean = false) =
        StoreUiState(phase = StorePhase.Ready, storeVisible = true, catalog = catalog, products = products, entitlement = entitlement, subscriptionSuspended = suspended)

    private fun ent(premium: Boolean, state: String? = null, packs: List<String> = emptyList()) = EntitlementBody(
        "t", premium, if (premium) now + 86_400_000L else null, packs, now + 8 * 3_600_000L,
        state?.let { SubscriptionInfo(it, "yearly", true, false, now + 86_400_000L) },
    )

    private fun focus(s: StoreUiState, entry: StoreEntry = lobby, word: String = "en", locked: List<LockedPackInfo> = emptyList()) =
        StoreModel.initialFocus(entry, s.phase, if (s.phase == StorePhase.Ready) StoreModel.build(s, word, locked, now) else null)

    @Test
    fun stateMachineTargets() {
        assertEquals(StoreFocusTarget.Loading, focus(StoreUiState(phase = StorePhase.Loading)))
        assertEquals(StoreFocusTarget.Retry, focus(StoreUiState(phase = StorePhase.Unavailable(UnavailableReason.NETWORK))))
        assertEquals(StoreFocusTarget.Ok, focus(StoreUiState(phase = StorePhase.Unavailable(UnavailableReason.BILLING_UNAVAILABLE))))
    }

    @Test
    fun entryPoints() {
        val s = ready()
        assertEquals(StoreFocusTarget.Plan("yearly"), focus(s))
        assertEquals(StoreFocusTarget.Plan("yearly"), focus(s, StoreEntry("premium", StoreOrigin.LOCKED_SETTING)))
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), focus(s, StoreEntry("pack_en_food_01", StoreOrigin.LOCKED_PACK)))
        // A product the Store does not list falls back to the Premium card.
        assertEquals(StoreFocusTarget.Plan("yearly"), focus(s, StoreEntry("pack_zz_01", StoreOrigin.LOCKED_PACK)))
    }

    @Test
    fun premiumCardStates() {
        assertEquals(StoreFocusTarget.FixPayment, focus(ready(suspended = true)))
        assertEquals(StoreFocusTarget.FixPayment, focus(ready(ent(false, "SUBSCRIPTION_STATE_ON_HOLD"))))
        assertEquals(StoreFocusTarget.FixPayment, focus(ready(ent(false, "SUBSCRIPTION_STATE_PAUSED"))))
        assertEquals(StoreFocusTarget.Manage, focus(ready(ent(true, "SUBSCRIPTION_STATE_IN_GRACE_PERIOD"))))
        assertEquals(StoreFocusTarget.Manage, focus(ready(ent(true, "SUBSCRIPTION_STATE_ACTIVE"))))
        assertEquals(PremiumCard.Grace, StoreModel.premiumCard(ready(ent(true, "SUBSCRIPTION_STATE_IN_GRACE_PERIOD")), now))
        val active = StoreModel.premiumCard(ready(ent(true, "SUBSCRIPTION_STATE_ACTIVE")), now) as PremiumCard.Active
        assertTrue(active.autoRenewing)
        // Suspended never shows plan buttons (buying again would bill twice).
        assertFalse(StoreModel.premiumCard(ready(suspended = true), now) is PremiumCard.Plans)
        // The manage link only for non-expired subscriptions.
        assertTrue(StoreModel.showsManage(PremiumCard.Grace))
        assertTrue(StoreModel.showsManage(PremiumCard.Suspended))
        assertFalse(StoreModel.showsManage(PremiumCard.NoProduct))
        assertFalse(StoreModel.showsManage(PremiumCard.Plans(emptyList(), false)))
    }

    @Test
    fun noPremiumProductFocusesTheFirstPackCard() {
        val noSub = allProducts.copy(subs = emptyMap(), unfetched = mapOf("premium" to 3))
        val s = ready(products = noSub)
        assertEquals(PremiumCard.NoProduct, StoreModel.premiumCard(s, now))
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), focus(s))
        // Nothing at all: Restore.
        val empty = s.copy(catalog = catalog.copy(packs = emptyList()))
        assertEquals(StoreFocusTarget.Restore, focus(empty))
    }

    @Test
    fun packCardsTrailingStates() {
        val notFetched = allProducts.copy(inapp = allProducts.inapp - "pack_en_things_01", unfetched = mapOf("pack_en_things_01" to 3))
        val s = ready(ent(false, packs = listOf("en-food-01")), notFetched).copy(pending = setOf("pack_fr_food_01"))
        val m = StoreModel.build(s, "en", emptyList(), now)
        val byId = m.packs.associateBy { it.productId }
        assertEquals(PackTrailing.Owned, byId.getValue("pack_en_food_01").trailing)
        assertEquals("not fetched from Play: Included, focusable, no Buy", PackTrailing.Included, byId.getValue("pack_en_things_01").trailing)
        assertFalse(byId.getValue("pack_en_things_01").buyable)
        assertEquals(PackTrailing.Pending, byId.getValue("pack_fr_food_01").trailing)
        assertEquals(PackTrailing.Buy("$1.99"), byId.getValue("pack_lb_food_01").trailing)
        // The room's word language first, then the other languages after the divider.
        assertEquals(listOf("pack_en_food_01", "pack_en_things_01"), m.packs.filter { !it.otherLanguage }.map { it.productId })
        assertTrue(m.showOtherLanguages)
        assertEquals("ar", byId.getValue("pack_lb_food_01").language) // ar-LB counts as ar
        // Premium: every pack reads Included.
        val prem = StoreModel.build(ready(ent(true, "SUBSCRIPTION_STATE_ACTIVE")), "en", emptyList(), now)
        assertTrue(prem.packs.all { it.trailing == PackTrailing.Included })
        // Pitch: 4 packs, 33 + 64 + 33 + 27 = 157 pairs → 150.
        assertEquals(4, m.pitchCount)
        assertEquals(150, m.pitchPairs)
    }

    @Test
    fun catalogFailureBuildsPacksFromLockedPacksWithoutOtherLanguages() {
        val locked = listOf(LockedPackInfo("en-food-01", "en", LocalizedTitle("Food", "À table", "أكل"), 33, "all", "pack_en_food_01"))
        val s = ready().copy(catalog = null)
        val m = StoreModel.build(s, "en", locked, now)
        assertEquals(listOf("pack_en_food_01"), m.packs.map { it.productId })
        assertFalse(m.showOtherLanguages)
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), StoreModel.initialFocus(StoreEntry("pack_en_food_01", StoreOrigin.LOCKED_PACK), s.phase, m))
    }

    @Test
    fun arabicRoomPutsLebanesePacksFirst() {
        val m = StoreModel.build(ready(), "ar", emptyList(), now)
        assertEquals(listOf("pack_lb_food_01"), m.packs.filter { !it.otherLanguage }.map { it.productId })
    }
}
