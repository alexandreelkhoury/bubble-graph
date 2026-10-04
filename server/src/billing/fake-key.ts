// PAYMENTS-SPEC §2.3 / §3.10: the fixed, PUBLIC dev key that signs fake-mode entitlement tokens (kid "fake").
// It is public on purpose: a token signed with it is accepted only when fake mode is active (mode.ts, §3.10).
// Kept in its own module (re-exported by fake.ts) so token.ts can use it without importing the fake routes.
export const FAKE_ENTITLEMENT_KEY = {
  kid: "fake",
  x: "F9N7ohjokv4Zf2d_Lb7Q5VxBLLpQf5GlaV7Ck5ERzFE",
  d: "Hnl0A18hE32WBw7-LP9hB0Bg9KtV_VRMTDQfXmgG8BI",
} as const;
