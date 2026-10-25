// PAYMENTS-SPEC §3.7: hand-written subsets of the Google Play Developer API v3 schemas (discovery revision 20261001).
// Field names are verbatim; only the fields the server reads are declared. Every field is optional on the wire.

export type AcknowledgementState = "ACKNOWLEDGEMENT_STATE_UNSPECIFIED" | "ACKNOWLEDGEMENT_STATE_PENDING" | "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";

export interface ProductPurchaseV2 {
  purchaseStateContext?: { purchaseState?: string }; // PURCHASE_STATE_UNSPECIFIED | PURCHASED | CANCELLED | PENDING
  acknowledgementState?: AcknowledgementState;
  purchaseCompletionTime?: string;
  productLineItem?: { productId?: string }[];
  obfuscatedExternalAccountId?: string;
  testPurchaseContext?: Record<string, unknown>;
}

export interface VoidedPurchase { purchaseToken?: string; orderId?: string; voidedTimeMillis?: string }

export interface VoidedPurchasesListResponse { voidedPurchases?: VoidedPurchase[]; tokenPagination?: { nextPageToken?: string } }
