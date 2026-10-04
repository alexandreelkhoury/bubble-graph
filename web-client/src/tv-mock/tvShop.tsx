// PAYMENTS-SPEC §4.4 / §5.2: the TV mock Store (fake billing). A full-screen overlay over the lobby, driven by the
// D-pad (arrows, Enter = OK, Escape = Back). Header: title + room code; the Premium card with the plans and the
// required disclosure (§4.5); the packs row (room language first); footer: restore, help, pending note, test controls.
import { useEffect, useRef, useState } from "preact/hooks";
import { PREMIUM_PRODUCT_ID, SUPPORT_EMAIL } from "@mishana/shared/billing/products";
import type { BasePlanId } from "@mishana/shared/billing/products";
import type { CatalogPackBody } from "@mishana/shared/billing";
import type { Locale } from "@mishana/shared/constants";
import type { TvView } from "@mishana/shared/protocol";
import { isolate, locale, LOCALE_NATIVE_NAME, t } from "../i18n/t";
import { Icon } from "../components/Icon";
import { billing } from "./billing";
import {
  afterPackPurchase, FAKE_PRICES, FAKE_TRIAL_DAYS, inflightKey, initialFocus, packState, PLAN_DISPLAY_ORDER, pitchParams,
  premiumCard, splitPacks,
} from "./billing/model";
import type { FocusId, PackState, StoreEntry, StorePhase } from "./billing/model";
import { closeShop, loadStoreCatalog } from "./shopState";
import { openDialog } from "./tvDialogs";
import { RoomCode } from "./tvParts";
import { tvAct, tvView } from "./tvStore";
import { toasts } from "../state/store";

/** §4.7 `{date}`: medium date, Western digits in every locale. */
export function fmtDate(ms: number, l: Locale): string {
  return new Intl.DateTimeFormat(l, { dateStyle: "medium", numberingSystem: "latn" }).format(new Date(ms));
}

function storePhase(): StorePhase {
  switch (billing.mode.value) {
    case "fake": return { kind: "ready" };
    case "google": return { kind: "google" };
    case "error": return { kind: "unavailable" };
    default: return { kind: "loading" };
  }
}

const planPrice = (p: BasePlanId): string => FAKE_PRICES[p];
const planLabel = (p: BasePlanId): string => t(p === "yearly" ? "store.planYearly" : "store.planMonthly");
const planPriceText = (p: BasePlanId): string => t(p === "yearly" ? "store.pricePerYear" : "store.pricePerMonth", { price: isolate(planPrice(p)) });
const planPeriod = (p: BasePlanId): string => t(p === "yearly" ? "store.periodYear" : "store.periodMonth");

/** §4.5: one paragraph for the focused plan, always visible under the plan buttons; the trial wording only with a trial offer. */
function Disclosure({ plan, trial }: { plan: BasePlanId; trial: boolean }) {
  const params = { count: FAKE_TRIAL_DAYS, price: isolate(planPrice(plan)), period: isolate(planPeriod(plan)) };
  return (
    <p class="tvshop__legal">
      {trial
        ? <>{t("store.legalTrialRenew", params)} {t("store.legalCancelTrial")}</>
        : <>{t("store.legalPriceRenew", params)} {t("store.legalCancel")}</>}
    </p>
  );
}

/**
 * §4.4: the button the user started from shows a spinner and `store.confirming`, after 15 s `store.verifyFailed`. It
 * replaces that button's trailing part and stays on one line (ellipsis): the full sentence is also the toast, and the
 * accessible name, so the card never grows and the footer never leaves the canvas.
 */
function Busy() {
  const text = t(billing.confirmSlow.value ? "store.verifyFailed" : "store.confirming");
  return <span class="tvshop__busy" title={text}><Icon name="refresh" size={20} class="spin" /><span class="tvshop__busytext">{text}</span></span>;
}
const isInflight = (productId: string, plan?: BasePlanId): boolean => billing.inflight.value === inflightKey(productId, plan);

/** `data-default-focus` on the §4.4 initial target only (the focus keeper returns there if focus is lost). */
const defFocus = (id: FocusId, target: FocusId): true | undefined => (id === target ? true : undefined);

function PremiumCardView({ plan, target, onBuy, onFocusPlan }: { plan: BasePlanId; target: FocusId; onBuy(plan: BasePlanId): void; onFocusPlan(p: BasePlanId): void }) {
  const ent = billing.ent.value;
  const card = premiumCard(ent);
  const catalog = billing.catalog.value;
  const pitch = catalog ? pitchParams(catalog) : null;
  const l = locale.value;
  const manage = (): void => openDialog({ title: t("store.manage"), body: t("store.manageHint"), confirm: t("common.ok"), info: true, onConfirm: () => undefined });
  const sub = ent?.subscription ?? null;
  const pending = billing.pending.value.has(PREMIUM_PRODUCT_ID);
  const trial = billing.trialOffered;
  return (
    <section class="tvshop__card" aria-labelledby="tvshop-premium">
      <div class="tvshop__cardhead">
        <h2 id="tvshop-premium" class="tvshop__cardtitle"><Icon name="gem" />{t("store.premiumTitle")}</h2>
        {pitch && <p class="tvshop__pitch">{t("store.premiumPitch", { count: pitch.count, pairs: isolate(String(pitch.pairs)) })}</p>}
      </div>
      {card === "plans" && (
        <>
          <div class="tvshop__plans">
            {PLAN_DISPLAY_ORDER.map((p) => (
              <button key={p} type="button" class="tvbtn tvshop__plan" data-focus={`plan:${p}`} data-default-focus={defFocus(`plan:${p}`, target)} onFocus={() => onFocusPlan(p)} onClick={() => onBuy(p)}
                aria-disabled={billing.inflight.value !== null}>
                <span class="tvshop__planname"><span class="tvshop__planlabel">{planLabel(p)}</span>&nbsp;·&nbsp;<span class="tvshop__planprice">{planPriceText(p)}</span></span>
                {isInflight(PREMIUM_PRODUCT_ID, p) ? <Busy />
                  : pending ? <span class="tvshop__chip">{t("store.pending")}</span>
                  : trial && <span class="tvshop__badge">{t("store.trialDays", { count: FAKE_TRIAL_DAYS })}</span>}
              </button>
            ))}
          </div>
          <Disclosure plan={plan} trial={trial} />
        </>
      )}
      {card === "suspended" && (
        <div class="tvshop__state">
          <p>{t("store.fixPayment")}</p>
          <button type="button" class="tvbtn tvbtn--primary" data-focus="fix" data-default-focus={defFocus("fix", target)} onClick={manage}>{t("store.fixPaymentButton")}</button>
        </div>
      )}
      {(card === "grace" || card === "premium") && (
        <div class="tvshop__state">
          <p class="tvshop__active"><Icon name="check" />{t("store.premiumActive")}</p>
          {card === "grace" && <p>{t("store.fixPayment")}</p>}
          {card === "premium" && sub?.expiresAt != null && (
            <p class="tv-secondary">{t(sub.autoRenewing ? "store.renewsOn" : "store.endsOn", { date: isolate(fmtDate(sub.expiresAt, l)) })}</p>
          )}
          <button type="button" class="tvbtn" data-focus="manage" data-default-focus={defFocus("manage", target)} onClick={manage}>{t("store.manage")}</button>
        </div>
      )}
    </section>
  );
}

function packTrailing(state: PackState) {
  switch (state) {
    case "owned": return <span class="tvshop__chip tvshop__chip--ok"><Icon name="check" size={18} />{t("store.owned")}</span>;
    case "included": return <span class="tvshop__chip">{t("store.included")}</span>;
    case "pending": return <span class="tvshop__chip">{t("store.pending")}</span>;
    case "buy": return <span class="tvshop__buy">{t("store.buy", { price: isolate(FAKE_PRICES.pack) })}</span>;
  }
}

function PackCard({ p, target, onBuy }: { p: CatalogPackBody; target: FocusId; onBuy(p: CatalogPackBody): void }) {
  const state = packState(p.packId, p.productId, billing.ent.value, billing.pending.value);
  const l = locale.value;
  return (
    <button type="button" class={`tvshop__pack is-${state}`} data-focus={`pack:${p.productId}`} data-default-focus={defFocus(`pack:${p.productId}`, target)} data-pack={p.packId}
      onClick={() => { if (state === "buy") onBuy(p); }}>
      <bdi class="tvshop__packtitle">{p.title[l]}</bdi>
      <span class="tvshop__packmeta">{t("store.packPairs", { count: p.pairCount })}</span>
      <span class="tvshop__packend">{isInflight(p.productId) ? <Busy /> : packTrailing(state)}</span>
    </button>
  );
}

export function TvShop({ view, entry }: { view: TvView; entry: StoreEntry }) {
  const phase = storePhase();
  const box = useRef<HTMLDivElement>(null);
  // §4.5: the disclosure follows the focused plan (yearly until a plan takes focus).
  const [plan, setPlan] = useState<BasePlanId>("yearly");
  const catalog = billing.catalog.value;
  const packs = catalog ? splitPacks(catalog.packs, view.settings.wordLocale) : { mine: [], other: [] };
  const card = premiumCard(billing.ent.value);
  const target: FocusId = initialFocus(entry, phase, card, [...packs.mine, ...packs.other].map((p) => p.productId));
  // Initial focus per §4.4, again whenever the state machine moves (loading → ready / unavailable).
  useEffect(() => {
    const id = setTimeout(() => box.current?.querySelector<HTMLElement>(`[data-focus="${target}"]`)?.focus(), 30);
    return () => clearTimeout(id);
  }, [phase.kind]);
  const buyPlan = (plan: BasePlanId): void => { void billing.purchase(PREMIUM_PRODUCT_ID, plan); };
  const buyPack = (p: CatalogPackBody): void => {
    void billing.purchase(p.productId).then((r) => {
      if (r !== "OK" || entry.origin !== "LOCKED_PACK" || entry.focusProductId !== p.productId) return;
      const v = tvView.value;
      if (!v) return;
      const after = afterPackPurchase(v.settings, v.phase === "LOBBY", p.packId, p.locale);
      if (after.kind === "add") {
        tvAct({ type: "UPDATE_SETTINGS", patch: { packIds: after.packIds } });
        billing.notify({ key: "store.addedToGame", tone: "success" });
      } else if (after.kind === "switch") {
        billing.notify({ key: "store.switchLanguage", params: { lang: isolate(LOCALE_NATIVE_NAME[after.lang]) }, tone: "info" });
      }
    });
  };
  const fake = phase.kind === "ready";
  // §4.4 footer: Left/Right walk Restore → the test controls in reading order and stop at either end; they never leave
  // the row by geometry (the last button sits below the packs row, which `nearest` would otherwise pick).
  const onFootKey = (e: KeyboardEvent): void => {
    if (e.key !== "ArrowLeft" && e.key !== "ArrowRight") return;
    const row = [...(e.currentTarget as HTMLElement).querySelectorAll<HTMLElement>("button")];
    const i = row.indexOf(e.target as HTMLElement);
    if (i < 0) return;
    const step = (e.key === "ArrowRight") !== (document.documentElement.dir === "rtl") ? 1 : -1;
    e.preventDefault();
    e.stopPropagation();
    row[i + step]?.focus();
  };
  // Down from any pack card enters the footer at Restore, its real action (geometry would pick whatever test control
  // sits under the focused card; on the TV app there are no test controls).
  const onRowKey = (e: KeyboardEvent): void => {
    if (e.key !== "ArrowDown") return;
    const restore = box.current?.querySelector<HTMLElement>('[data-focus="restore"]');
    if (!restore) return;
    e.preventDefault();
    e.stopPropagation();
    restore.focus();
  };
  const anyPending = billing.pending.value.size > 0;
  const toast = toasts.value.at(-1);
  return (
    <div class="tvoverlay tvoverlay--solid" role="dialog" aria-modal="true" aria-label={t("store.title")}>
      <div class="tvshop" ref={box}>
        <header class="tvshop__head">
          <h1 class="tvshop__title">{t("store.title")}</h1>
          {fake && <span class="tvshop__test">{t("store.testMode")}</span>}
          <RoomCode code={view.roomCode} />
        </header>
        {phase.kind === "loading" && (
          <div class="tvshop__center"><p class="tvt-body"><Icon name="refresh" size={24} class="spin" />{t("store.loading")}</p></div>
        )}
        {phase.kind === "unavailable" && (
          <div class="tvshop__center">
            <p class="tvt-body">{t("store.unavailable")}</p>
            <button type="button" class="tvbtn tvbtn--primary" data-focus="retry" data-default-focus onClick={() => void loadStoreCatalog()}>
              <Icon name="refresh" />{t("common.retry")}
            </button>
          </div>
        )}
        {phase.kind === "google" && (
          // §5.2: a google-mode server has no test store; purchases happen only in the Android TV app.
          <div class="tvshop__center">
            <p class="tvt-body">{t("store.tvAppOnly")}</p>
            <button type="button" class="tvbtn tvbtn--primary" data-focus="ok" data-default-focus onClick={closeShop}>{t("common.ok")}</button>
          </div>
        )}
        {fake && (
          <div class="tvshop__body">
            <PremiumCardView plan={plan} target={target} onBuy={buyPlan} onFocusPlan={setPlan} />
            <section class="tvshop__packs" aria-label={t("store.packsTitle")}>
              <h2 class="tvshop__packshead">{t("store.packsTitle")}</h2>
              <div class="tvshop__row" data-scroll onKeyDown={onRowKey}>
                {packs.mine.map((p) => <PackCard key={p.packId} p={p} target={target} onBuy={buyPack} />)}
                {packs.other.length > 0 && <div class="tvshop__divider" aria-hidden="true">{t("store.otherLanguages")}</div>}
                {packs.other.map((p) => <PackCard key={p.packId} p={p} target={target} onBuy={buyPack} />)}
              </div>
            </section>
            {/* Toast slot (DESIGN: never over the focused control): its own band between the packs row and the
                footer, two lines at most, so it covers neither the pack cards nor Restore / the test controls. */}
            <div class="tvshop__toastslot" aria-live="polite">
              {toast && <div key={toast.id} class={`tvtoast tvtoast--${toast.tone}`}>{toast.text}</div>}
            </div>
            <footer class="tvshop__foot" onKeyDown={onFootKey}>
              <button type="button" class="tvbtn" data-focus="restore" onClick={() => void billing.restore()}><Icon name="refresh" />{t("store.restore")}</button>
              {SUPPORT_EMAIL && <span class="tvshop__help">{t("store.help", { email: isolate(SUPPORT_EMAIL) })}</span>}
              {anyPending && <span class="tvshop__help">{t("store.pendingBody")}</span>}
              {/* §5.2 debug-only controls (fake mode only). Plain English: they never ship in a real store. */}
              <span class="tvshop__testctl" role="group" aria-label="Test controls">
                <span class="tvshop__testhead">Test controls</span>
                <button type="button" class="tvbtn tvbtn--small" data-test="expire" onClick={() => void billing.testExpirePremium()}>Expire Premium now</button>
                <button type="button" class="tvbtn tvbtn--small" data-test="refund" onClick={() => void billing.testRefundPack()}>Refund pack</button>
              </span>
              <span class="tvshop__back tv-muted">{t("common.back")}</span>
            </footer>
          </div>
        )}
      </div>
    </div>
  );
}
