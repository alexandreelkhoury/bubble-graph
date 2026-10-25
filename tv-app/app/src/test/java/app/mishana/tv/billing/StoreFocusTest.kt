package app.mishana.tv.billing

import app.mishana.tv.protocol.EntitlementBody
import app.mishana.tv.protocol.LocalizedTitle
import app.mishana.tv.protocol.LockedPackInfo
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

    private fun ready(entitlement: EntitlementBody? = null, products: ProductsSnapshot = allProducts) =
        StoreUiState(phase = StorePhase.Ready, storeVisible = true, catalog = catalog, products = products, entitlement = entitlement)

    private fun ent(premium: Boolean, packs: List<String> = emptyList(), premiumUntil: Long = now + 8 * 3_600_000L) = EntitlementBody(
        "t", premium, if (premium) premiumUntil else null, packs, now + 8 * 3_600_000L,
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
        assertEquals(StoreFocusTarget.Unlock, focus(s))
        assertEquals(StoreFocusTarget.Unlock, focus(s, StoreEntry("premium", StoreOrigin.LOCKED_SETTING)))
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), focus(s, StoreEntry("pack_en_food_01", StoreOrigin.LOCKED_PACK)))
        // A product the Store does not list falls back to the Premium card.
        assertEquals(StoreFocusTarget.Unlock, focus(s, StoreEntry("pack_zz_01", StoreOrigin.LOCKED_PACK)))
    }

    @Test
    fun premiumCardStates() {
        // Not premium: one Unlock button with Play's one-time price.
        assertEquals(PremiumCard.Unlock("$7.99", pending = false), StoreModel.premiumCard(ready(), now))
        assertTrue((StoreModel.premiumCard(ready(), now) as PremiumCard.Unlock).buyable)
        // Pending: the button stays (focusable) as a pending chip and does not buy again.
        val pending = StoreModel.premiumCard(ready().copy(pending = setOf("premium")), now) as PremiumCard.Unlock
        assertTrue(pending.pending)
        assertFalse(pending.buyable)
        assertEquals(StoreFocusTarget.Unlock, focus(ready().copy(pending = setOf("premium"))))
        // Being confirmed / slow confirmation.
        assertTrue((StoreModel.premiumCard(ready().copy(purchaseInFlight = "premium"), now) as PremiumCard.Unlock).confirming)
        assertTrue((StoreModel.premiumCard(ready().copy(slowConfirm = "premium"), now) as PremiumCard.Unlock).slow)
        // Premium on (lifetime or grant): no button, focus goes to the first pack card.
        assertEquals(PremiumCard.Active, StoreModel.premiumCard(ready(ent(true)), now))
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), focus(ready(ent(true))))
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), focus(ready(ent(true)), StoreEntry("premium", StoreOrigin.LOCKED_SETTING)))
        // A grant that has ended (or a refund) is not premium: the Unlock button is back.
        assertEquals(PremiumCard.Unlock("$7.99", pending = false), StoreModel.premiumCard(ready(ent(true, premiumUntil = now - 1)), now))
        // Premium on and no pack listed: Restore.
        assertEquals(StoreFocusTarget.Restore, focus(ready(ent(true)).copy(catalog = catalog.copy(packs = emptyList()))))
    }

    @Test
    fun noPremiumProductFocusesTheFirstPackCard() {
        val noPremium = allProducts.copy(inapp = allProducts.inapp - "premium", unfetched = mapOf("premium" to 3))
        val s = ready(products = noPremium)
        assertEquals(PremiumCard.NoProduct, StoreModel.premiumCard(s, now))
        assertEquals(StoreFocusTarget.Pack("pack_en_food_01"), focus(s))
        // A premium product without a purchase option is not buyable either.
        val noOffer = allProducts.copy(inapp = allProducts.inapp + ("premium" to InappProductInfo("premium", "$7.99", null)))
        assertEquals(PremiumCard.NoProduct, StoreModel.premiumCard(ready(products = noOffer), now))
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
        val prem = StoreModel.build(ready(ent(true)), "en", emptyList(), now)
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
