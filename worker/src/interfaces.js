/**
 * SendAFun — Planned Feature Pre-wired Slots (Doc §12.5, §12.7, §13.5)
 * =================================================================
 *
 * Rationale (Doc §12.5):
 *   For all NEXT-priority items below, reserve empty function shells +
 *   typed JSDoc + call-site stubs in the Worker + front-end now.  Zero
 *   behaviour change in Q3 2026 launch; only empty placeholders wired in
 *   so future engineers can fill logic WITHOUT touching the call-site
 *   surface area (no route reshuffles, no schema changes mid-quarter).
 *
 * Exports (all return null/placeholder TODAY, safe to call):
 *   — Phase2UserClipUpload       (Doc §12.7  Phase 2)
 *   — Phase3AnimateFace          (Doc §12.7  Phase 3)
 *   — GeoCompliancePopup         (Doc §13.5.1 GDPR / US / Brazil regional)
 *   — PrintfulFulfillmentGateway (Doc §12.7  Phase 3 physical cards)
 *   — GeoMarketingBanner         (Doc §13.5.2 country promo discount banners)
 *   — B2BPriceTier               (Doc §13.5.3 B2B corp pricing overrides)
 *   — GeoFestivalTargetingSort   (Doc §13.5.4, ties to KV.geoCountryTarget field)
 *
 * This file is imported by worker/src/index.js and attached to
 *   globalThis.SAF_SLOTS  —  callers reference it there.
 * When a phase actually ships, replace the body of the matching function
 * with real logic.  Do NOT add new top-level exports without a matching
 * JSDoc entry and a doc-reference line number.
 */

/* ------------------------------------------------------------------ */
/*  DOC REFERENCE  (kept here intentionally so diffs are easy to audit) */
/* ------------------------------------------------------------------
 *  §12.5  Pre-wired reserved interfaces for Q3 2026 roadmap.
 *  §12.7  3-phase phased launch plan.
 *  §13.5  Geo-optimisation functional stubs (compliance, marketing,
 *         B2B pricing, local festival card sorting).
 * ---------------------------------------------------------------- */

/**
 * Phase 2 (v1.2, ~Q3 2026).  User uploads 15s/5MB portrait MP4 clip
 * from his phone; Worker stores blob IN locally scoped IndexedDB-backed
 * ephemeral cache (NOT durable storage at launch — Phase2 will add a
 * dedicated R2 + KV tuple).  Today the function returns a fake local
 * key string so callers can be wired today without any durable write.
 *
 * @param  {Blob|ArrayBuffer}   videoBlob   User video clip (application/octet-stream or video/mp4 today).
 * @param  {{userId?:string, sessionId?:string}} meta  Optional identity hints for later durable tie-in.
 * @returns {Promise<{localKey:string|null, phase:2, status:"reserved"}>}
 */
export async function Phase2UploadClip(videoBlob, meta = {}) {
  // RESERVED.  Q3 2026 implementation:
  //   1. Validate size ≤ 5 MB, length ≤ 15 s, mp4 only.
  //   2. Write to private "sendafun-clips" R2 bucket (ttl 30 d).
  //   3. Write KV card ↔ clip mapping; record session usage cap.
  void videoBlob; void meta;
  return { localKey: null, phase: 2, status: "reserved" };
}

/**
 * Phase 3 (v1.3+, > Q3 2026).  AI-driven face animation pipeline:
 * takes a user photo (PNG/JPG of a face) + a motion preset
 * ("blink-smile" | "wave" | "heart-kiss") and returns an array of
 * offscreen-canvas frames ready to be composed into final HEVC MP4.
 *
 * @param   {HTMLImageElement|ImageBitmap|Blob} photo      Single face photo source.
 * @param   {"blink-smile"|"wave"|"heart-kiss"} motionType Preset motion id.
 * @returns {Promise<{frames:any[]|null, fps:number, phase:3, status:"reserved"}>}
 */
export async function Phase3AnimateFace(photo, motionType = "blink-smile") {
  // RESERVED.  Phase 3 will pull Stable-Video model CF AI worker;
  // today we simply signal "not yet available" with null frames.
  void photo; void motionType;
  return { frames: null, fps: 12, phase: 3, status: "reserved" };
}

/**
 * Doc §13.5.1 — Regional compliance popup generator.
 * Today returns an empty payload + "reserved"; Phase2 will plug real
 * regional templates (GDPR explicit opt-in, US opt-out, Brazil LGPD).
 *
 * @param   {string} countryCode   CF-IPCountry / cf.country two-letter code, uppercase.
 * @param   {{lang?:string}} opts  Optional locale override (en/es/fr/pt).
 * @returns {{enabled:boolean, html:string|null, region:"GDPR"|"US"|"LGPD"|"ROW", status:"reserved", phase:1.5}}
 */
export function GeoCompliancePopup(countryCode, opts = {}) {
  void countryCode; void opts;
  return { enabled: false, html: null, region: "ROW", status: "reserved", phase: 1.5 };
}

/**
 * Doc §12.7 Phase 3 — Physical greeting card drop-ship via Printful
 * (or equivalent).  Today we accept an order shape and return a
 * placeholder tracking ID so the order service can pre-wire the
 * physical-goods code path end-to-end.
 *
 * @param   {object} order                   Printful-order-shaped payload (stub today).
 * @param   {string} order.card_slug         Card slug on SendAFun side.
 * @param   {string} order.recipient_name    Physical mail recipient.
 * @param   {string} order.address_1
 * @param   {string} [order.address_2]
 * @param   {string} order.city
 * @param   {string} order.state
 * @param   {string} order.postcode
 * @param   {string} order.country_code      ISO 3166-1 alpha-2
 * @param   {string} order.print_style       "matte" | "glossy" | "foil" later
 * @returns {Promise<{trackingId:string|null, carrier:string|null, phase:3, status:"reserved"}>}
 */
export async function PrintfulFulfillmentGateway(order) {
  // RESERVED — real impl later: POST to https://api.printful.com/orders,
  // sign with CREEM_B2B_TOKEN, handle SKU mapping + address verification.
  void order;
  return { trackingId: null, carrier: null, phase: 3, status: "reserved" };
}

/**
 * Doc §13.5.2 — Country-aware marketing banner payload.
 * Shows promo / holiday discount banners keyed off visitor country.
 * Today returns an empty disabled payload so the front-end call site
 * can ship right now with a clean conditional.
 *
 * @param   {string} countryCode   Uppercase two-letter CF country code.
 * @returns {{enabled:boolean, messageI18nKey:string|null, discountCode:string|null, linkUrl:string|null, status:"reserved", phase:1.5}}
 */
export function GeoMarketingBanner(countryCode) {
  void countryCode;
  return {
    enabled: false,
    messageI18nKey: null,
    discountCode: null,
    linkUrl: null,
    status: "reserved",
    phase: 1.5
  };
}

/**
 * Doc §13.5.3 — B2B corporate tier pricing overrides keyed by country.
 * Today returns NO overrides; the normal Creem product prices apply.
 * In Phase 4 B2B launch this function will consult a KV namespace
 * (B2B_PRICING_TIERS) for per-country negotiated corporate plans.
 *
 * @param   {string} countryCode   Visitor country for FX / locale tax.
 * @param   {string} planId        Creem product id or internal plan slug ("member-monthly" | "member-yearly" | "sme-bulk-100").
 * @returns {{overridesApplied:boolean, priceCentsUSD:number|null, taxRate:number|null, currency:string|null, status:"reserved", phase:4}}
 */
export function B2BPriceTier(countryCode, planId) {
  void countryCode; void planId;
  return {
    overridesApplied: false,
    priceCentsUSD: null,
    taxRate: null,
    currency: null,
    status: "reserved",
    phase: 4
  };
}

/**
 * Doc §13.5.4 — Geo festival targeted card sorting.
 * The KV card table has had `geoCountryTarget` field injected since
 * Step 4 of the v1.1 launch.  When we actually turn on dynamic sorting,
 * this function will re-order a list of card slugs to bump cards whose
 * geoCountryTarget matches the visitor's country to the TOP N positions
 * (for example: 推巴西情人节到 BR, 推排灯节到 IN).
 *
 * Today it passes the list through UNCHANGED, so the default sort
 * (category + created_at desc) keeps working for the launch.
 *
 * @template T
 * @param   {T[]}    cards          Array of card rows (must have a slug / geoCountryTarget shape, min. {slug:string}).
 * @param   {string} countryCode    Uppercase two-letter CF country code.
 * @param   {number} [topN=6]       How many geo-matched cards to pin to the front.
 * @returns {T[]}                   Same list, re-ordered (launch passthrough, order preserved).
 */
export function GeoFestivalTargetingSort(cards, countryCode, topN = 6) {
  // RESERVED v1.2 implementation sketch:
  //   const pins = cards.filter(c => Array.isArray(c.geoCountryTarget) && c.geoCountryTarget.includes(countryCode)).slice(0, topN);
  //   const rest = cards.filter(c => !pins.includes(c));
  //   return [...pins, ...rest];
  void countryCode; void topN;
  // Launch behaviour: passthrough identity sort.
  return Array.isArray(cards) ? cards.slice() : [];
}

/** Helper used at attach-time to validate public surface.  Internal only. */
export function SAF_SLOT_SURFACE() {
  return Object.freeze({
    Phase2UploadClip,
    Phase3AnimateFace,
    GeoCompliancePopup,
    PrintfulFulfillmentGateway,
    GeoMarketingBanner,
    B2BPriceTier,
    GeoFestivalTargetingSort
  });
}
