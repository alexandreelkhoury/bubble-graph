// PAYMENTS-SPEC §3.7: hand-written subsets of the Google Play Developer API v3 schemas (discovery revision 20261001).
// Field names are verbatim; only the fields the server reads are declared. Every field is optional on the wire.

export type AcknowledgementState = "ACKNOWLEDGEMENT_STATE_UNSPECIFIED" | "ACKNOWLEDGEMENT_STATE_PENDING" | "ACKNOWLEDGEMENT_STATE_ACKNOWLEDGED";

export interface ExternalAccountIdentifiers { obfuscatedExternalAccountId?: string }

export interface SubscriptionPurchaseLineItem {
  productId?: string;
  expiryTime?: string; // RFC 3339
  autoRenewingPlan?: { autoRenewEnabled?: boolean };
  offerDetails?: { basePlanId?: string; offerId?: string };
  offerPhase?: { freeTrial?: Record<string, unknown> };
}

export interface SubscriptionPurchaseV2 {
  subscriptionState?: string;
  acknowledgementState?: AcknowledgementState;
  linkedPurchaseToken?: string;
  startTime?: string;
  lineItems?: SubscriptionPurchaseLineItem[];
  externalAccountIdentifiers?: ExternalAccountIdentifiers;
  outOfAppPurchaseContext?: { expiredPurchaseToken?: string; expiredExternalAccountIdentifiers?: ExternalAccountIdentifiers };
  testPurchase?: Record<string, unknown>;
}

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
