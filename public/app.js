const R2_BASE_ORIGIN = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev";
const R2_BASE = (typeof location !== "undefined" && ["localhost","127.0.0.1","::1","0.0.0.0"].includes(location.hostname))
  ? "/r2-proxy"
  : R2_BASE_ORIGIN;
function _imgUrl(u) {
  if (!u || typeof u !== "string") return u || "";
  if (u.startsWith("data:") || u.startsWith("blob:") || u.startsWith("//")) return u;
  if (u.startsWith(R2_BASE_ORIGIN + "/")) {
    return R2_BASE + u.slice(R2_BASE_ORIGIN.length);
  }
  if (/^\/[a-z0-9\-_]/.test(u) && !u.startsWith("/r2-proxy")) {
    return R2_BASE + "/" + u.replace(/^\/+/, "");
  }
  return u;
}
const PRODUCTION_ORIGIN = "https://sendafun.com";
const IS_LOCALHOST = typeof location !== "undefined" && ["localhost","127.0.0.1","::1","0.0.0.0"].includes(location.hostname);
const MAX_REAL_TEMPLATES = 250;
function _safeTotal(n) { return Math.min(parseInt(n, 10) || 0, MAX_REAL_TEMPLATES); }
function _safePages(total, size) { const t = _safeTotal(total); const s = parseInt(size, 10) || 24; if (t <= 0) return 1; return Math.max(1, Math.ceil(t / s)); }
function _isRealTemplate(c) { return !!(c && c.slug && typeof c.slug === "string" && c.slug.indexOf("-v2-") > -1); }
function _getAllCardsForStats() { return Array.isArray(window.ALL_CARDS) && window.ALL_CARDS.length ? window.ALL_CARDS : (window.CARDS || []); }
function _realCatCount(cards, slug) {
  const src = (cards === window.CARDS || cards === window.ALL_CARDS || !Array.isArray(cards)) ? _getAllCardsForStats() : (cards || []);
  return src.filter(function(c) { return _isRealTemplate(c) && c.category === slug; }).length;
}
function _realTotalCount(cards) {
  const src = (cards === window.CARDS || cards === window.ALL_CARDS || !Array.isArray(cards)) ? _getAllCardsForStats() : (cards || []);
  return src.filter(_isRealTemplate).length;
}
const API_ORIGIN = (typeof location !== "undefined" && location.origin === PRODUCTION_ORIGIN) ? location.origin : PRODUCTION_ORIGIN;
const API_BASE = API_ORIGIN + "/api";
// #region debug-point bootstrap:reporter
(() => {
  const _DBG = {
    url: "http://127.0.0.1:7777/event",
    session: "discover-card-images-black",
    pending: 0
  };
  window.__dbgevt = function ({ h = "?", r = "pre", m = "[DEBUG]", d = {} }) {
    try {
      const payload = {
        sessionId: _DBG.session,
        runId: r,
        hypothesisId: String(h).toUpperCase(),
        ts: Date.now(),
        location: "public/app.js",
        msg: m,
        data: d
      };
      const body = JSON.stringify(payload);
      if (navigator.sendBeacon) {
        try { navigator.sendBeacon(_DBG.url, new Blob([body], {type:"application/json"})); return; } catch(_) {}
      }
      fetch(_DBG.url, { method: "POST", mode: "no-cors", cache: "no-store",
        headers: { "Content-Type": "application/json" }, body }).catch(() => {});
    } catch (_) {}
  };
  // Probe on boot: try direct fetch to a known r2.dev URL (distinguish hypo C anti-hotlink from hypo A ORB-img-only)
  const _PROBE = R2_BASE + "/birthday/birthday-pexels-8014697-v2-vertical.webp";
  try {
    fetch(_PROBE, { method: "HEAD", mode: "cors" }).then(r => {
      window.__dbgevt({ h: "C", r: "pre", m: "[DEBUG] r2.dev HEAD probe result", d: { probe: _PROBE, status: r.status, ok: r.ok, type: r.type, loc: location.origin } });
    }).catch(e => {
      window.__dbgevt({ h: "C", r: "pre", m: "[DEBUG] r2.dev HEAD probe failed (CORS/network)", d: { probe: _PROBE, err: String(e && e.message || e), loc: location.origin } });
    });
  } catch(e) { /* noop */ }
})();
// #endregion
const PRODUCT_IDS = {
  pay_per_send: "prod_7GGx4Gh5yvKLOb0OCzYFoq",
  monthly: "prod_3xVdtK0wdzqLlaCz4H7lzQ",
  annual: "prod_73aCoww3uhNMevKi8NVwNv",
  group_pass: "prod_6FsQQfkCT71L7GaLMYANiA"
};

/* ============================================================
 * C: Pre-wired Roadmap Slots (Doc §12.5, §12.7, §13.5)
 * ------------------------------------------------------------
 * Twin copy of worker/src/interfaces.js canonical JSDoc source.
 * All return placeholder/null TODAY; front-end call-sites stubbed
 * in-place so Phase 2/3/4 engineers fill BODIES ONLY (no route
 * reshuffles, no call-site rewrites).  Zero behaviour change for
 * v1.1 launch — every stub is a no-op / passthrough.
 * ============================================================ */
window.SAF_SLOTS = Object.freeze({
  async Phase2UploadClip(videoBlob, meta = {}) {
    void videoBlob; void meta;
    return { localKey: null, phase: 2, status: "reserved" };
  },
  async Phase3AnimateFace(photo, motionType = "blink-smile") {
    void photo; void motionType;
    return { frames: null, fps: 12, phase: 3, status: "reserved" };
  },
  GeoCompliancePopup(countryCode, opts = {}) {
    void countryCode; void opts;
    return { enabled: false, html: null, region: "ROW", status: "reserved", phase: 1.5 };
  },
  async PrintfulFulfillmentGateway(order) {
    void order;
    return { trackingId: null, carrier: null, phase: 3, status: "reserved" };
  },
  GeoMarketingBanner(countryCode) {
    void countryCode;
    return {
      enabled: false, messageI18nKey: null, discountCode: null, linkUrl: null,
      status: "reserved", phase: 1.5
    };
  },
  B2BPriceTier(countryCode, planId) {
    void countryCode; void planId;
    return {
      overridesApplied: false, priceCentsUSD: null, taxRate: null, currency: null,
      status: "reserved", phase: 4
    };
  },
  GeoFestivalTargetingSort(cards, countryCode, topN = 6) {
    // Doc §13.2.3 — Geo-aware homepage sorting.
    // Pass-through safety: never throw, never mutate input.
    if (!Array.isArray(cards) || cards.length === 0) return [];
    const arr = cards.slice(); // stable copy
    const now = new Date();
    const m = now.getMonth() + 1;   // 1..12
    const d = now.getDate();        // 1..31

    // 1) Category → (month, day) proximity scoring.
    //    Scores are integers 0..90. 90 = day-before holiday (highest).
    const CAT_PROXIMITY = [
      { cat: "christmas",   m: 12, d: 25 },
      { cat: "new-year",    m: 1,  d: 1  },
      { cat: "valentine",   m: 2,  d: 14 },
      { cat: "easter",      m: 4,  d: 9  }, /* floating; mid-April anchor */
      { cat: "halloween",   m: 10, d: 31 },
      { cat: "thanksgiving",m: 11, d: 23 }, /* US/CA last Thu approx */
      { cat: "mothers-day", m: 5,  d: 12 }, /* 2nd Sun approx */
      { cat: "fathers-day", m: 6,  d: 16 }, /* 3rd Sun approx */
      { cat: "wedding",     m: 6,  d: 15 }, /* wedding season peak */
      { cat: "graduation",  m: 5,  d: 25 }, /* graduation season */
    ];

    function daysUntil(targetM, targetD) {
      // Cyclic distance from today, 0..364, 0 = today.
      const y = now.getFullYear();
      const a = new Date(y, targetM - 1, targetD);
      let diff = Math.round((a.getTime() - now.getTime()) / 86400000);
      if (diff < 0) diff += 365;
      return diff;
    }

    const cc = countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
    const MAX_TOP = Math.max(1, Math.min(24, topN | 0));

    for (let i = 0; i < arr.length; i++) {
      const c = arr[i] || {};
      let score = 0;
      const origIdx = i;

      // Tier A: geo-country-target match → user country is in the card's geo list.
      if (cc && Array.isArray(c.geoCountryTarget) && c.geoCountryTarget.indexOf(cc) !== -1) {
        score += 200;
      }

      // Tier B: proximity to ANY of the 10 canonical category festivals (0..90).
      for (let j = 0; j < CAT_PROXIMITY.length; j++) {
        if (CAT_PROXIMITY[j].cat === c.category) {
          const dd = daysUntil(CAT_PROXIMITY[j].m, CAT_PROXIMITY[j].d);
          if (dd <= 90) {
            score += Math.max(0, 90 - dd);
            break;
          }
        }
      }

      // Tier C: 4 flagship country-specific unique holidays (no dedicated category
      // → promote general / celebration / congratulations / new-year when close):
      if (cc) {
        if (cc === "FR") {
          const bastille = daysUntil(7, 14);
          if (bastille <= 21) score += Math.max(0, 80 - bastille);
        } else if (cc === "MX") {
          const muertos = daysUntil(11, 1);
          if (muertos <= 14) score += Math.max(0, 85 - muertos);
        } else if (cc === "BR") {
          const carnaval = daysUntil(2, 17);
          if (carnaval <= 14) score += Math.max(0, 85 - carnaval);
        } else if (cc === "IE" || cc === "GB") {
          const xmasBoxing = daysUntil(12, 26);
          if (xmasBoxing <= 21) score += Math.max(0, 80 - xmasBoxing);
        }
      }

      arr[i] = { card: c, score, origIdx };
    }

    // Descending score → stable ascending original-index fallback.
    arr.sort((a, b) => (b.score - a.score) || (a.origIdx - b.origIdx));
    return arr.map(it => it.card);
  }
});

/* =========================================================================
 * B-1 I18N: 4-language UI dictionary + runtime translator.
 * Worker injects window.__SAF_EFFECTIVE_LANG__ inline (after cookie/path/geo
 * resolution).  curLang() re-evaluates on every t() call so manual overrides
 * via picker (which sets cookie + hard-reloads) take effect without redeclare.
 * Missing keys → return the en fallback.  Fallback string form: t("k", "Fallback")
 * ========================================================================= */
const SAF_I18N_DICT = {
  en: {
    nav_home: "Home", nav_discover: "Discover", nav_pricing: "Pricing",
    nav_about: "About", nav_contact: "Contact", nav_member: "💎 Member",
    common_send_free: "Send a Free Card →",
    common_start: "Start Now →", common_see_pricing: "See Pricing",
    common_customise: "Customise This Card →",
    common_see_all_cards: "cards →", common_count_suffix: " cards",
    common_browse_all_prefix: "Browse all ", common_browse_all_suffix: " cards",
    common_previous: "Previous slide", common_next: "Next slide", common_slide: "Go to slide ",
    hero_title_a: "Design a card ", hero_title_b: "they'll actually remember",
    hero_tagline: "Design, invite friends to co-sign, send beautiful animated cards in 60 seconds. No sign-up.",
    hero_stat_templates: " Templates", hero_stat_sigs: " Signatures per Card", hero_stat_cats: " Categories",
    intent_step1: "👥 Who's this card for?",
    intent_step2: "🎉 What's the occasion?",
    intent_step3: "💬 What vibe?",
    intent_cta_perfect: "✨ Perfect match — show me 12 cards!",
    browse_title: "📚 Browse by occasion",
    browse_subtitle: "Know exactly what you need? Jump straight to a category — or answer 3 quick questions for a personalised top 12 above.",
    browse_see_all_prefix: "See all ",
    pricing_title: "Simple pricing, generous value",
    pricing_tagline: "Design unlimited cards for free. Only pay when you send or unlock group features.",
    pricing_compare_title: "Compare plans side by side",
    pricing_plan_name_free: "Free",
    pricing_plan_name_pps: "Pay Per Send",
    pricing_plan_name_monthly: "Monthly Unlimited",
    pricing_plan_name_annual: "Annual Unlimited",
    pricing_plan_name_group: "Group Card Pass",
    pricing_plan_period_free: "Start designing immediately",
    pricing_plan_period_annual: "Billed annually — best value",
    pricing_plan_period_other: "Cancel anytime",
    pricing_plan_cta_start_free: "Start Free",
    pricing_plan_cta_choose: "Choose Plan",
    pricing_plan_label_free: "Free", pricing_plan_label_pps: "Pay Per Send",
    pricing_plan_label_monthly: "Monthly", pricing_plan_label_annual: "Annual",
    pricing_plan_label_group: "GroupPass",
    pricing_feature_unlimited_design: "Unlimited design & preview",
    pricing_feature_watermark_free: "Watermark-free sends",
    pricing_feature_scheduling_window: "Scheduling window",
    pricing_feature_group_signatures: "Group signatures per card",
    pricing_feature_gift_subscription: "Gift subscription feature",
    pricing_feature_priority_support: "Priority support",
    pricing_feature_pdf_export: "PDF export",
    pricing_feature_history_retention: "Card history retention",
    pricing_feature_feat_label: "Feature",
    pricing_feature_0days: "0 days", pricing_feature_7days: "7 days",
    pricing_feature_30days: "30 days", pricing_feature_90days: "90 days",
    pricing_feature_feat_none: "—",
    free_feat_1: "Unlimited card design & preview",
    free_feat_2: "All 250+ templates available",
    free_feat_3: "Save drafts locally in browser",
    free_feat_4: "Watermarked previews",
    pps_feat_1: "One single e-card scheduled & delivered",
    pps_feat_2: "7-day scheduling window",
    pps_feat_3: "Standard email template",
    pps_feat_4: "Watermark-free",
    monthly_feat_1: "Unlimited scheduled sends",
    monthly_feat_2: "Watermark-free HD",
    monthly_feat_3: "30-day scheduling",
    monthly_feat_4: "Custom email templates",
    monthly_feat_5: "30-day send history",
    monthly_feat_6: "Priority 24h support",
    annual_feat_1: "Everything in Monthly",
    annual_feat_2: "Best value — ~$5.75/month",
    annual_feat_3: "Dedicated support line",
    annual_feat_4: "90-day history",
    annual_feat_5: "Early access to new templates",
    group_feat_1: "Invite 50 friends to sign one card",
    group_feat_2: "Signature wall with photos",
    group_feat_3: "Single merged reveal email",
    group_feat_4: "High-res PDF export",
    period_month: " / month", period_year: " / year",
    period_one_time: " one-time",
    footer_privacy: "Privacy", footer_terms: "Terms",
    footer_cookies: "Cookies", footer_pricing: "Pricing",
    footer_about: "About", footer_contact: "Contact",
    footer_copy_prefix: "© ", footer_copy_suffix: " SendAFun. All rights reserved.",
    footer_about_line: "SendAFun — the warm, human way to celebrate life's big moments together, online.",
    footer_support_prefix: "Support: ",
    cookie_title: "🍪 Cookie time — quick, promise.",
    cookie_body: "We use the tiniest cookies for language settings, scheduling, and knowing what plan you chose. No creepy trackers — ever.",
    cookie_accept: "Got it — accept 🍪",
    toast_load_meta: "Loading metadata…",
    toast_ready: "✅ Ready · D1 card API online",
    toast_network_err: "Network error: ",
    toast_intent_hint_prefix: "Selected ",
    toast_intent_hint_suffix: " — click the blue button below to see matching cards 🎯",
    intent_recipient: "Recipient: ",
    intent_occasion: "Occasion: ",
    intent_tone: "Tone: ",
    intent_reset: "Reset",
    intent_search_ph: "Search titles, tags…",
    intent_cta_good: "✨ Great — show me the 12 best cards",
    intent_cta_default: "✨ Show me 12 perfect cards",
    intent_cta_pick: "Pick at least one to continue",
    intent_match_prefix: "matches '",
    intent_match_suffix: "'",
    cookie_privacy_title: "🍪 We value your privacy",
    cookie_privacy_body_1: " We use necessary cookies to make our site work. We may also use analytics cookies to understand how visitors interact with our site, in compliance with GDPR. Read more in our ",
    cookie_privacy_body_2: " and ",
    cookie_privacy_body_3: ".",
    cookie_reject: "Reject non-necessary",
    cookie_accept_all: "Accept all & continue",
    cookie_privacy_policy: "Privacy Policy",
    cookie_policy: "Cookie Policy",
    footer_support_label: "Support: ",
    footer_contact_prefix: "Contact: ",
    recipient_partner: "❤️ My Partner", recipient_mom: "👩 My Mom",
    recipient_dad: "👨 My Dad", recipient_best_friend: "🤝 Best Friend",
    recipient_kids: "👶 My Kid", recipient_boss: "💼 My Boss",
    recipient_teacher: "✏️ Teacher", recipient_colleague: "💻 Coworker",
    recipient_grandma: "👵 Grandma", recipient_grandpa: "👴 Grandpa",
    recipient_sibling: "🧑 Brother or Sister", recipient_me: "🧍 Myself",
    tone_funny: "😂 Funny", tone_sincere: "💗 Sincere",
    tone_romantic: "💕 Romantic", tone_playful: "🎈 Playful",
    tone_formal: "🤝 Formal", tone_warm: "☀️ Warm",
    cat_anniversary: "Anniversary", cat_birthday: "Birthday",
    cat_christmas: "Christmas", cat_congratulations: "Congratulations",
    cat_easter: "Easter", cat_encouragement: "Encouragement",
    cat_fathers_day: "Father's Day", cat_friendship: "Friendship",
    cat_get_well: "Get Well", cat_good_luck: "Good Luck",
    cat_graduation: "Graduation", cat_halloween: "Halloween",
    cat_love: "Love & Romance", cat_missing_you: "Missing You",
    cat_mothers_day: "Mother's Day", cat_new_baby: "New Baby",
    cat_new_year: "New Year", cat_retirement: "Retirement",
    cat_sorry: "Apology", cat_sympathy: "Sympathy",
    cat_thank_you: "Thank You", cat_thanksgiving: "Thanksgiving",
    cat_thinking_of_you: "Thinking of You", cat_valentine: "Valentine",
    cat_wedding: "Wedding",
    about_title: "About SendAFun — Warm, human, effortless e-cards",
    about_hero_a: "We believe the best celebrations feel ",
    about_hero_b: "personal, not automated.",
    about_hero_sub: "SendAFun was built for everyone who's ever stared at a generic e-card, sighed, and wished it didn't have to feel this transactional.",
    about_team_title: "Why we exist",
    about_team_body_1: "Traditional ecards are either embarrassingly templated or locked behind clunky software. SendAFun takes the opposite approach — ",
    about_team_body_2: "richly personalised, collaborative cards you'll actually want to send.",
    about_values_title: "Our values",
    about_v1_title: "Always human",
    about_v1_body: "No creepy personalisation. No creepy tracking. Every card is crafted by you — and only you.",
    about_v2_title: "Co-signing = together",
    about_v2_body: "Cards are social. Invite 50 friends to add messages, photos, and personality before sending.",
    about_v3_title: "No friction",
    about_v3_body: "No account, no credit card required until you click Send. Literally one click from idea to preview.",
    contact_title: "Contact SendAFun support — here for you",
    contact_hero: "Hey there. Got a question, a feature idea, or want to share a card you love?",
    contact_hero_sub: "We read every message personally, usually within 24 hours on business days.",
    contact_name: "Your name", contact_email: "Your email",
    contact_topic: "What's this about?", contact_topic_select: "Select a topic",
    contact_ref: "Card or order reference (optional)",
    contact_msg: "Your message", contact_msg_placeholder: "Tell us what's on your mind…",
    contact_send: "📨 Send message",
    topic_general: "General question", topic_billing: "Billing issue",
    topic_tech: "Technical issue", topic_feature: "Feature request",
    topic_bug: "Bug report", topic_media: "Press / media",
    topic_bulk: "Bulk / business", topic_other: "Something else",
    payment_success_title: "🎉 Your payment went through!",
    payment_success_body_1: "Thanks for choosing SendAFun. A receipt is on its way to ",
    payment_success_body_2: " — if you don't see it, check spam first before reaching out.",
    payment_delivery_title: "📦 Delivery summary",
    payment_delivery_sub: "Scheduling will kick in at the exact timezone you picked.",
    payment_check_order: "📑 Check Order Status",
    payment_cancel_title: "Payment cancelled — no charge",
    payment_cancel_body_1: "Nothing was charged, nothing was scheduled. You're welcome back any time.",
    payment_cancel_body_2: "Browse cards",
    terms_title: "Terms of Service · SendAFun",
    privacy_title: "Privacy Policy · SendAFun",
    cookies_title: "Cookie Policy · SendAFun",
    about_tag_brand: "ABOUT SENDAFUN",
    about_hero_title: "Digital greetings that actually feel human ✉️",
    about_hero_body: "SendAFun is a tiny, independent studio on a mission. We believe birthday wishes, thank-you notes and \"I miss you\"s deserve more than a group chat. Not another \"cute AI\" product — real typography, real photos, and a frictionless way to tell someone you thought of them.",
    about_stat_templates: "Card templates",
    about_stat_templates_sub: "Hand-crafted, updated weekly",
    about_stat_sent: "Cards sent",
    about_stat_sent_sub: "Across 58 countries",
    about_stat_support: "Support reply",
    about_stat_support_sub: "Friendly humans on the hook",
    about_stat_open: "Open rate",
    about_stat_open_sub: "Warm mail beats cold inboxes",
    about_tag_mission: "OUR MISSION",
    about_mission_body: "Give every occasion the card it deserves — not the \"I searched for 15 minutes and settled\" card.",
    about_mission_origin: "SendAFun started in 2024 when we got tired of generic ecards that felt like clip-art. We built the tool we wanted: beautiful templates, zero friction, your handwriting, your photos.",
    about_story_title: "The SendAFun story",
    about_story_p1: "The way we connect changed fast — video calls, group chats, DMs. But the greeting card got stuck in the 2000s: awkward wiggling GIFs, mandatory sign-ups, designs you wouldn't show to your mom.",
    about_story_p2: "So we started over. Real Playfair typography. Real photos of people, not 3D AI mockups. An intent engine that asks the right questions — \"Who's it for? What's the occasion? Tone?\" — then narrows 250 cards to the 12 that fit. You design, you preview, you pick a way to send.",
    about_story_p3: "No account. No credit card to see the good stuff. Just a card the recipient actually wants to open.",
    about_browse_cards: "🎴 Browse all cards",
    about_see_pricing: "💳 See pricing",
    about_diff_title: "What makes us different",
    about_diff_sub: "Four small choices that make a big difference when you need to tell someone you care.",
    about_diff1_t: "Intent-first, not scroll-first",
    about_diff1_d: "You pick recipient / occasion / tone. We do the filtering. No page 17 of 40.",
    about_diff2_t: "Designers, not engines",
    about_diff2_d: "Every card is touched by a real human. No clip-art. No wiggling GIFs from 2005.",
    about_diff3_t: "Send how you like",
    about_diff3_d: "SMS, email, QR at a party, social DM. We don't force your recipient into a portal.",
    about_diff4_t: "Guest first, always",
    about_diff4_d: "No account to preview, no credit card trap. Save things locally if you want — or don't.",
    about_cta_title: "See what 250 cards look like",
    about_cta_sub: "Birthday, love, sympathy, congratulations, \"I'm proud of you\" — we built the library you actually need.",
    about_cta_browse: "🎴 Start browsing",
    about_cta_talk: "📧 Talk to us",
    contact_tag_brand: "CONTACT US",
    contact_hero_title: "Friendly humans, typically replying in under 4 hours 💬",
    contact_hero_body: "Stuck on a design? Need corporate templates for your team? Found a bug? Write to us — we actually read every message, and you'll get a real person on the other end, not a robot.",
    contact_block_email_t: "Email",
    contact_block_email_l2: "We read every one",
    contact_block_time_t: "Response time",
    contact_block_time_l1: "Under 4 hours on weekdays",
    contact_block_time_l2: "Weekends within 12 hours",
    contact_block_biz_t: "Business & Press",
    contact_block_biz_l1: "hello@sendafun.com",
    contact_block_biz_l2: "Brand licensing, press kits",
    contact_form_title: "Send us a message",
    contact_field_email_lbl: "Email",
    contact_field_name_ph: "Jane Doe",
    contact_field_email_ph: "jane@company.com",
    contact_field_ref_lbl: "Card or order reference (optional)",
    contact_field_ref_ph: "#SAF-12345 (if you have one)",
    contact_field_msg_lbl: "Your message",
    contact_field_msg_ph: "Tell us what's going on — the more detail the better!",
    contact_send_btn: "📨 Send message",
    contact_sending: "⏳ Sending…",
    contact_err_name: "Please add your name",
    contact_err_email: "That email doesn't look right",
    contact_err_msg: "A bit more message please (~10 chars)",
    contact_save_local: "⚠️ Saved locally — will retry on next page visit (",
    contact_thanks_prefix: "Thanks ",
    contact_thanks_suffix: " — we'll reply at ",
    contact_thanks_close: " usually within 4 hours 💌",
    common_browse_cards: "Browse cards",
    notfound_title: "Page not found",
    notfound_body: "The page you were looking for doesn't exist — or may have moved.",
    notfound_btn_home: "Go Home",
    notfound_btn_browse: "Browse Cards →",
    notfound_btn_pricing: "See Pricing",
    notfound_quicklinks_title: "🔗 Quick links you might be looking for:",
    notfound_ql_discover: "🎴 Discover all cards",
    notfound_ql_pricing: "💳 Pricing plans",
    notfound_ql_about: "ℹ️ About SendAFun",
    notfound_ql_contact: "📧 Contact support",
    contact_field_topic_lbl: "Topic",
    contact_topic_support: "Support / help with a card",
    contact_topic_feature: "Feature request",
    contact_topic_bug: "Bug report",
    contact_topic_press: "Press / media",
    contact_topic_business: "Business / corporate templates",
    contact_topic_other: "Other / just saying hi",
    contact_privacy_note: "We never share your email or message. Stored locally in your browser until your next refresh so we don't lose it.",
    contact_online_title: "🕰️ When we're online",
    contact_online_weekday: "Mon–Fri · 9:00 – 22:00 UTC",
    contact_online_weekend: "Sat–Sun · 11:00 – 19:00 UTC",
    contact_online_sla: "Target SLA: first reply < 4h weekdays",
    contact_social_title: "Find us around the web",
    contact_social_instagram: "Instagram",
    contact_social_twitter: "X / Twitter",
    contact_social_facebook: "Facebook",
    contact_social_pinterest: "Pinterest",
    contact_faq_title: "Frequently asked questions",
    contact_faq_sub: "Chances are, someone already asked. Didn't see yours? Use the form above.",
    contact_faq_q1: "Do I need to make an account to send a card?",
    contact_faq_a1: "No. You can design, preview, personalize, add a message and send — everything except the final payment — as a guest. We save drafts in your browser's localStorage, not on some server that wants to email you weekly.",
    contact_faq_q2: "How much does it cost to send a card?",
    contact_faq_a2: "Single sends are $1.99. Unlimited monthly is $6.99 (best value). Annual unlimited is $69, which works out to ~$5.75/month. Group signature walls have a separate $4.99 pass if you only need that feature.",
    contact_faq_q3: "Can I send to a group of people?",
    contact_faq_a3: "Yes. Build one card, add up to 200 recipients, send it to everyone in one click. Recipients get a personalized link. If you want a single card that 50+ friends sign together, use our Group Card feature instead.",
    contact_faq_q4: "Do you have corporate / branded templates?",
    contact_faq_a4: "Absolutely. 50+ employees? Send a note to hello@sendafun.com with your logo, brand colors, and how many sends a month you need — we'll spin up a private library on a custom plan.",
    contact_faq_q5: "Can I add my own photos and handwriting?",
    contact_faq_a5: "Photos: yes, upload unlimited from any device. Handwriting: upload a scan or photo, we'll auto-isolate it, you can drop it anywhere on the card as a sticker / signature.",
    contact_faq_q6: "What if my recipient never opens it?",
    contact_faq_a6: "We track delivery (email bounces, SMS failures) and show you open stats. You can resend the same card via a different channel any time from the Order page — free of charge.",
    contact_final_title: "Not sure yet? Just look at the cards.",
    contact_final_sub: "The fastest way to see if SendAFun is for you is to spend 2 minutes browsing. No sign-up, no funnel, just cards.",
    contact_final_explore: "🎴 Explore all 250 cards",
    contact_final_about: "ℹ️ About SendAFun"
  },
  es: {
    nav_home: "Inicio", nav_discover: "Explorar", nav_pricing: "Precios",
    nav_about: "Acerca", nav_contact: "Contacto", nav_member: "💎 Miembro",
    common_send_free: "Enviar una tarjeta gratis →",
    common_start: "Empezar ahora →", common_see_pricing: "Ver precios",
    common_customise: "Personalizar esta tarjeta →",
    common_see_all_cards: "tarjetas →", common_count_suffix: " tarjetas",
    common_browse_all_prefix: "Explorar todas las ", common_browse_all_suffix: " tarjetas",
    common_previous: "Diapositiva anterior", common_next: "Diapositiva siguiente", common_slide: "Ir a la diapositiva ",
    hero_title_a: "Diseña una tarjeta ", hero_title_b: "que de verdad recordarán",
    hero_tagline: "Diseña, invita amigos a cofirmar, envía hermosas tarjetas animadas en 60 segundos. Sin registro.",
    hero_stat_templates: " Plantillas", hero_stat_sigs: " Firmas por tarjeta", hero_stat_cats: " Categorías",
    intent_step1: "👥 ¿Para quién es esta tarjeta?",
    intent_step2: "🎉 ¿Cuál es la ocasión?",
    intent_step3: "💬 ¿Qué tono prefieres?",
    intent_cta_perfect: "✨ Coincidencia perfecta — ¡muéstrame 12 tarjetas!",
    browse_title: "📚 Explorar por ocasión",
    browse_subtitle: "¿Sabes exactamente qué necesitas? Ve directo a una categoría, o responde 3 preguntas rápidas para un top 12 personalizado arriba.",
    browse_see_all_prefix: "Ver ",
    pricing_title: "Precios sencillos, gran valor",
    pricing_tagline: "Diseña tarjetas ilimitadas gratis. Solo pagas cuando envías o desbloqueas funciones grupales.",
    pricing_compare_title: "Comparar planes uno al lado del otro",
    pricing_plan_name_free: "Gratis",
    pricing_plan_name_pps: "Pago por envío",
    pricing_plan_name_monthly: "Ilimitado mensual",
    pricing_plan_name_annual: "Ilimitado anual",
    pricing_plan_name_group: "Pase Tarjeta Grupal",
    pricing_plan_period_free: "Empieza a diseñar ya",
    pricing_plan_period_annual: "Facturado anualmente — mejor precio",
    pricing_plan_period_other: "Cancela cuando quieras",
    pricing_plan_cta_start_free: "Empezar gratis",
    pricing_plan_cta_choose: "Elegir plan",
    pricing_plan_label_free: "Gratis", pricing_plan_label_pps: "Pago/envi.",
    pricing_plan_label_monthly: "Mensual", pricing_plan_label_annual: "Anual",
    pricing_plan_label_group: "Grupal",
    pricing_feature_unlimited_design: "Diseño y vista previa ilimitados",
    pricing_feature_watermark_free: "Envíos sin marca de agua",
    pricing_feature_scheduling_window: "Ventana de programación",
    pricing_feature_group_signatures: "Firmas grupales por tarjeta",
    pricing_feature_gift_subscription: "Función de suscripción regalo",
    pricing_feature_priority_support: "Soporte prioritario",
    pricing_feature_pdf_export: "Exportación a PDF",
    pricing_feature_history_retention: "Retención historial",
    pricing_feature_feat_label: "Característica",
    pricing_feature_0days: "0 días", pricing_feature_7days: "7 días",
    pricing_feature_30days: "30 días", pricing_feature_90days: "90 días",
    pricing_feature_feat_none: "—",
    free_feat_1: "Diseño y vista previa ilimitados",
    free_feat_2: "Todas las 250+ plantillas",
    free_feat_3: "Guardar borradores en el navegador",
    free_feat_4: "Vistas previas con marca de agua",
    pps_feat_1: "Una sola tarjeta programada y enviada",
    pps_feat_2: "Ventana de programación de 7 días",
    pps_feat_3: "Plantilla de email estándar",
    pps_feat_4: "Sin marca de agua",
    monthly_feat_1: "Envíos programados ilimitados",
    monthly_feat_2: "HD sin marca de agua",
    monthly_feat_3: "Programación de 30 días",
    monthly_feat_4: "Plantillas de email personalizadas",
    monthly_feat_5: "Historial de 30 días",
    monthly_feat_6: "Soporte prioritario 24h",
    annual_feat_1: "Todo lo de Mensual",
    annual_feat_2: "Mejor precio — ~$5,75/mes",
    annual_feat_3: "Línea de soporte dedicada",
    annual_feat_4: "Historial de 90 días",
    annual_feat_5: "Acceso anticipado a plantillas",
    group_feat_1: "Invita 50 amigos a firmar una tarjeta",
    group_feat_2: "Muro de firmas con fotos",
    group_feat_3: "Email de revelación fusionado",
    group_feat_4: "Exportación PDF alta resolución",
    period_month: " / mes", period_year: " / año",
    period_one_time: " único pago",
    footer_privacy: "Privacidad", footer_terms: "Términos",
    footer_cookies: "Cookies", footer_pricing: "Precios",
    footer_about: "Acerca", footer_contact: "Contacto",
    footer_copy_prefix: "© ", footer_copy_suffix: " SendAFun. Todos los derechos reservados.",
    footer_about_line: "SendAFun — la forma cálida y humana de celebrar juntos los grandes momentos de la vida, en línea.",
    footer_support_prefix: "Soporte: ",
    cookie_title: "🍪 Hora de las cookies — rápido, prometo.",
    cookie_body: "Usamos las cookies más pequeñas para idioma, programación y saber qué plan elegiste. Sin rastreadores raros — nunca.",
    cookie_accept: "Entendido — aceptar 🍪",
    toast_load_meta: "Cargando metadatos…",
    toast_ready: "✅ Listo · API de tarjetas D1 conectada",
    toast_network_err: "Error de red: ",
    toast_intent_hint_prefix: "Seleccionado ",
    toast_intent_hint_suffix: " — pulsa el botón azul para ver tarjetas coincidentes 🎯",
    intent_recipient: "Destinatario: ",
    intent_occasion: "Ocasión: ",
    intent_tone: "Tono: ",
    intent_reset: "Restablecer",
    intent_search_ph: "Buscar títulos, etiquetas…",
    intent_cta_good: "✨ Genial — muestra las 12 mejores tarjetas",
    intent_cta_default: "✨ Muéstrame 12 tarjetas perfectas",
    intent_cta_pick: "Elige al menos uno para continuar",
    intent_match_prefix: "coincide con '",
    intent_match_suffix: "'",
    cookie_privacy_title: "🍪 Valoramos tu privacidad",
    cookie_privacy_body_1: " Usamos cookies necesarias para que el sitio funcione. También podemos usar cookies analíticas para entender cómo interactúan los visitantes, conforme al RGPD. Más info en nuestra ",
    cookie_privacy_body_2: " y en la ",
    cookie_privacy_body_3: ".",
    cookie_reject: "Rechazar no necesarias",
    cookie_accept_all: "Aceptar todas y continuar",
    cookie_privacy_policy: "Política de privacidad",
    cookie_policy: "Política de cookies",
    footer_support_label: "Soporte: ",
    footer_contact_prefix: "Contacto: ",
    recipient_partner: "❤️ Mi pareja", recipient_mom: "👩 Mi mamá",
    recipient_dad: "👨 Mi papá", recipient_best_friend: "🤝 Mejor amigo",
    recipient_kids: "👶 Mi hijo", recipient_boss: "💼 Mi jefe",
    recipient_teacher: "✏️ Profesor", recipient_colleague: "💻 Compañero",
    recipient_grandma: "👵 Abuela", recipient_grandpa: "👴 Abuelo",
    recipient_sibling: "🧑 Hermano o hermana", recipient_me: "🧍 Yo mismo",
    tone_funny: "😂 Divertido", tone_sincere: "💗 Sincero",
    tone_romantic: "💕 Romántico", tone_playful: "🎈 Juguetón",
    tone_formal: "🤝 Formal", tone_warm: "☀️ Cálido",
    cat_anniversary: "Aniversario", cat_birthday: "Cumpleaños",
    cat_christmas: "Navidad", cat_congratulations: "Felicidades",
    cat_easter: "Pascua", cat_encouragement: "Ánimo",
    cat_fathers_day: "Día del Padre", cat_friendship: "Amistad",
    cat_get_well: "Mejorarte pronto", cat_good_luck: "Buena suerte",
    cat_graduation: "Graduación", cat_halloween: "Halloween",
    cat_love: "Amor y romance", cat_missing_you: "Te extraño",
    cat_mothers_day: "Día de la Madre", cat_new_baby: "Bebé",
    cat_new_year: "Año Nuevo", cat_retirement: "Jubilación",
    cat_sorry: "Disculpas", cat_sympathy: "Pésame",
    cat_thank_you: "Gracias", cat_thanksgiving: "Acción Gracias",
    cat_thinking_of_you: "Pensando en ti", cat_valentine: "San Valentín",
    cat_wedding: "Boda",
    about_title: "Acerca de SendAFun — Tarjetas cálidas, humanas y sin esfuerzo",
    about_hero_a: "Creemos que las mejores celebraciones se sienten ",
    about_hero_b: "personales, no automáticas.",
    about_hero_sub: "SendAFun se creó para todos los que alguna vez han visto una tarjeta genérica y han pensado «no tiene por qué ser así».",
    about_team_title: "Por qué existimos",
    about_team_body_1: "Las tarjetas digitales tradicionales son vergonzosamente plantilladas o encerradas en software torpe. SendAFun sigue el camino opuesto — ",
    about_team_body_2: "tarjetas ricas en personalización y colaborativas que querrás enviar de verdad.",
    about_values_title: "Nuestros valores",
    about_v1_title: "Siempre humano",
    about_v1_body: "Sin personalización intrusiva. Sin rastreo raro. Cada tarjeta la creas tú — y solo tú.",
    about_v2_title: "Cofirmar = juntos",
    about_v2_body: "Las tarjetas son sociales. Invita 50 amigos a sumar mensajes, fotos y personalidad antes de enviar.",
    about_v3_title: "Sin fricción",
    about_v3_body: "Sin cuenta, sin tarjeta de crédito hasta que pulses Enviar. Literalmente un clic desde la idea a la vista previa.",
    about_story_p2: "Así que lo empezamos de cero. Tipografía Playfair real. Fotos reales de personas, no mockups 3D con IA. Un motor de intenciones que hace las preguntas correctas — «¿Para quién? ¿Qué ocasión? ¿Qué tono?» — y luego reduce 250 tarjetas a las 12 que encajan. Tú diseñas, tú prevés, tú eliges cómo enviarla.",
    about_cta_title: "Mira cómo son 250 tarjetas",
    contact_final_explore: "🎴 Explora las 250 tarjetas",
    contact_title: "Contacto soporte SendAFun — aquí para ti",
    contact_hero: "Hola. ¿Una pregunta, una idea de función o quieres compartir una tarjeta que te encantó?",
    contact_hero_sub: "Leemos cada mensaje personalmente, normalmente en 24 horas hábiles.",
    contact_name: "Tu nombre", contact_email: "Tu email",
    contact_topic: "¿De qué se trata?", contact_topic_select: "Selecciona un tema",
    contact_ref: "Referencia de tarjeta o pedido (opcional)",
    contact_msg: "Tu mensaje", contact_msg_placeholder: "Cuéntanos qué tienes en mente…",
    contact_send: "📨 Enviar mensaje",
    topic_general: "Pregunta general", topic_billing: "Facturación",
    topic_tech: "Técnico", topic_feature: "Solicitar función",
    topic_bug: "Informar error", topic_media: "Prensa / medios",
    topic_bulk: "Volumen / empresa", topic_other: "Otro asunto",
    payment_success_title: "🎉 ¡Tu pago se completó!",
    payment_success_body_1: "Gracias por elegir SendAFun. Un recibo está en camino a ",
    payment_success_body_2: " — si no lo ves, revisa el spam antes de escribirnos.",
    payment_delivery_title: "📦 Resumen de entrega",
    payment_delivery_sub: "La programación se activa en la zona horaria exacta que elegiste.",
    payment_check_order: "📑 Ver estado del pedido",
    payment_cancel_title: "Pago cancelado — sin cargos",
    payment_cancel_body_1: "No se cobró nada, no se programó nada. Siempre eres bienvenido.",
    payment_cancel_body_2: "Explorar tarjetas",
    terms_title: "Términos del servicio · SendAFun",
    privacy_title: "Política de privacidad · SendAFun",
    cookies_title: "Política de cookies · SendAFun"
  },
  fr: {
    nav_home: "Accueil", nav_discover: "Découvrir", nav_pricing: "Tarifs",
    nav_about: "À propos", nav_contact: "Contact", nav_member: "💎 Membre",
    common_send_free: "Envoyer une carte gratuite →",
    common_start: "Commencer maintenant →", common_see_pricing: "Voir les tarifs",
    common_customise: "Personnaliser cette carte →",
    common_see_all_cards: "cartes →", common_count_suffix: " cartes",
    common_browse_all_prefix: "Voir toutes les ", common_browse_all_suffix: " cartes",
    common_previous: "Diapositive précédente", common_next: "Diapositive suivante", common_slide: "Aller à la diapositive ",
    hero_title_a: "Créez une carte ", hero_title_b: "qu'ils se souviendront vraiment",
    hero_tagline: "Concevez, invitez des amis à cosigner, envoyez de belles cartes animées en 60 secondes. Sans inscription.",
    hero_stat_templates: " Modèles", hero_stat_sigs: " Signatures par carte", hero_stat_cats: " Catégories",
    intent_step1: "👥 Pour qui est cette carte ?",
    intent_step2: "🎉 Quelle est l'occasion ?",
    intent_step3: "💬 Quelle ambiance ?",
    intent_cta_perfect: "✨ Parfait — montrez-moi 12 cartes !",
    browse_title: "📚 Parcourir par occasion",
    browse_subtitle: "Vous savez exactement ce qu'il vous faut ? Allez directement à une catégorie — ou répondez à 3 questions pour un top 12 personnalisé ci-dessus.",
    browse_see_all_prefix: "Voir ",
    pricing_title: "Tarifs simples, valeur généreuse",
    pricing_tagline: "Créez des cartes illimitées gratuitement. Ne payez que quand vous envoyez ou déverrouillez les fonctions de groupe.",
    pricing_compare_title: "Comparer les plans côte à côte",
    pricing_plan_name_free: "Gratuit",
    pricing_plan_name_pps: "Paiement à l'envoi",
    pricing_plan_name_monthly: "Illimité mensuel",
    pricing_plan_name_annual: "Illimité annuel",
    pricing_plan_name_group: "Pass carte collective",
    pricing_plan_period_free: "Commencez à concevoir tout de suite",
    pricing_plan_period_annual: "Facturé annuellement — meilleur prix",
    pricing_plan_period_other: "Annulez à tout moment",
    pricing_plan_cta_start_free: "Commencer gratuitement",
    pricing_plan_cta_choose: "Choisir le plan",
    pricing_plan_label_free: "Gratuit", pricing_plan_label_pps: "Par envoi",
    pricing_plan_label_monthly: "Mensuel", pricing_plan_label_annual: "Annuel",
    pricing_plan_label_group: "Collectif",
    pricing_feature_unlimited_design: "Conception et aperçu illimités",
    pricing_feature_watermark_free: "Envois sans filigrane",
    pricing_feature_scheduling_window: "Fenêtre de planification",
    pricing_feature_group_signatures: "Signatures collectives par carte",
    pricing_feature_gift_subscription: "Abonnement-cadeau",
    pricing_feature_priority_support: "Support prioritaire",
    pricing_feature_pdf_export: "Export PDF",
    pricing_feature_history_retention: "Rétention de l'historique",
    pricing_feature_feat_label: "Fonctionnalité",
    pricing_feature_0days: "0 jour", pricing_feature_7days: "7 jours",
    pricing_feature_30days: "30 jours", pricing_feature_90days: "90 jours",
    pricing_feature_feat_none: "—",
    free_feat_1: "Conception et aperçu illimités",
    free_feat_2: "Tous les 250+ modèles disponibles",
    free_feat_3: "Brouillons enregistrés localement",
    free_feat_4: "Aperçus avec filigrane",
    pps_feat_1: "Une seule carte programmée et envoyée",
    pps_feat_2: "Fenêtre de 7 jours",
    pps_feat_3: "Modèle d'email standard",
    pps_feat_4: "Sans filigrane",
    monthly_feat_1: "Envois programmés illimités",
    monthly_feat_2: "HD sans filigrane",
    monthly_feat_3: "Planification 30 jours",
    monthly_feat_4: "Modèles d'email personnalisés",
    monthly_feat_5: "Historique 30 jours",
    monthly_feat_6: "Support prioritaire 24h",
    annual_feat_1: "Tout le plan Mensuel",
    annual_feat_2: "Meilleur prix — ~5,75 €/mois",
    annual_feat_3: "Ligne support dédiée",
    annual_feat_4: "Historique 90 jours",
    annual_feat_5: "Accès anticipé aux modèles",
    group_feat_1: "Invitez 50 amis à signer une carte",
    group_feat_2: "Mur de signatures avec photos",
    group_feat_3: "Email de révélation fusionné",
    group_feat_4: "Export PDF haute résolution",
    period_month: " / mois", period_year: " / an",
    period_one_time: " paiement unique",
    footer_privacy: "Confidentialité", footer_terms: "Conditions",
    footer_cookies: "Cookies", footer_pricing: "Tarifs",
    footer_about: "À propos", footer_contact: "Contact",
    footer_copy_prefix: "© ", footer_copy_suffix: " SendAFun. Tous droits réservés.",
    footer_about_line: "SendAFun — la façon chaleureuse et humaine de célébrer ensemble les grands moments, en ligne.",
    footer_support_prefix: "Support : ",
    cookie_title: "🍪 Cookies — rapide, promis.",
    cookie_body: "Nous utilisons les plus petits cookies pour la langue, la planification et votre plan choisi. Aucun traqueur bizarre — jamais.",
    cookie_accept: "J'ai compris — accepter 🍪",
    toast_load_meta: "Chargement des métadonnées…",
    toast_ready: "✅ Prêt · API cartes D1 connectée",
    toast_network_err: "Erreur réseau : ",
    toast_intent_hint_prefix: "Sélectionné ",
    toast_intent_hint_suffix: " — cliquez sur le bouton bleu pour voir les cartes correspondantes 🎯",
    intent_recipient: "Destinataire : ",
    intent_occasion: "Occasion : ",
    intent_tone: "Ambiance : ",
    intent_reset: "Réinitialiser",
    intent_search_ph: "Rechercher titres, étiquettes…",
    intent_cta_good: "✨ Super — montrez-moi les 12 meilleures cartes",
    intent_cta_default: "✨ Montrez-moi 12 cartes parfaites",
    intent_cta_pick: "Choisissez au moins un critère pour continuer",
    intent_match_prefix: "correspond à « ",
    intent_match_suffix: " »",
    cookie_privacy_title: "🍪 Nous respectons votre vie privée",
    cookie_privacy_body_1: " Nous utilisons des cookies nécessaires au fonctionnement. Nous pouvons aussi utiliser des cookies analytiques pour comprendre l'interaction des visiteurs, conformément au RGPD. Plus d'infos dans notre ",
    cookie_privacy_body_2: " et notre ",
    cookie_privacy_body_3: ".",
    cookie_reject: "Refuser non nécessaires",
    cookie_accept_all: "Tout accepter et continuer",
    cookie_privacy_policy: "Politique de confidentialité",
    cookie_policy: "Politique des cookies",
    footer_support_label: "Support : ",
    footer_contact_prefix: "Contact : ",
    recipient_partner: "❤️ Mon partenaire", recipient_mom: "👩 Ma maman",
    recipient_dad: "👨 Mon papa", recipient_best_friend: "🤝 Meilleur ami",
    recipient_kids: "👶 Mon enfant", recipient_boss: "💼 Mon patron",
    recipient_teacher: "✏️ Professeur", recipient_colleague: "💻 Collègue",
    recipient_grandma: "👵 Grand-mère", recipient_grandpa: "👴 Grand-père",
    recipient_sibling: "🧑 Frère ou sœur", recipient_me: "🧍 Moi-même",
    tone_funny: "😂 Drôle", tone_sincere: "💗 Sincère",
    tone_romantic: "💕 Romantique", tone_playful: "🎈 Enjoué",
    tone_formal: "🤝 Formel", tone_warm: "☀️ Chaleureux",
    cat_anniversary: "Anniversaire", cat_birthday: "Anniversaire",
    cat_christmas: "Noël", cat_congratulations: "Félicitations",
    cat_easter: "Pâques", cat_encouragement: "Encouragement",
    cat_fathers_day: "Fête des pères", cat_friendship: "Amitié",
    cat_get_well: "Rétablissement", cat_good_luck: "Bonne chance",
    cat_graduation: "Diplôme", cat_halloween: "Halloween",
    cat_love: "Amour & romance", cat_missing_you: "Tu me manques",
    cat_mothers_day: "Fête des mères", cat_new_baby: "Nouveau-né",
    cat_new_year: "Nouvel An", cat_retirement: "Retraite",
    cat_sorry: "Excuse", cat_sympathy: "Condoléances",
    cat_thank_you: "Merci", cat_thanksgiving: "Action de grâce",
    cat_thinking_of_you: "Pensée à toi", cat_valentine: "Saint-Valentin",
    cat_wedding: "Mariage",
    about_title: "À propos de SendAFun — Cartes chaleureuses, humaines et sans effort",
    about_hero_a: "Nous croyons que les meilleures célébrations se sentent ",
    about_hero_b: "personnelles, pas automatisées.",
    about_hero_sub: "SendAFun a été construit pour tous ceux qui ont déjà regardé une carte générique en soupirant.",
    about_team_title: "Pourquoi nous existons",
    about_team_body_1: "Les cartes numériques traditionnelles sont soit gênamment template, soit enfermées dans des logiciels lourds. SendAFun choisit l'opposé — ",
    about_team_body_2: "des cartes riches, personnalisables et collaboratives que vous aurez vraiment envie d'envoyer.",
    about_values_title: "Nos valeurs",
    about_v1_title: "Toujours humain",
    about_v1_body: "Pas de personnalisation douteuse. Pas de pistage bizarre. Chaque carte est créée par vous — et vous seul.",
    about_v2_title: "Cosigner = ensemble",
    about_v2_body: "Les cartes sont sociales. Invitez 50 amis à ajouter messages, photos et personnalité avant envoi.",
    about_v3_title: "Zéro friction",
    about_v3_body: "Pas de compte, pas de CB avant de cliquer Envoyer. Littéralement un clic entre l'idée et l'aperçu.",
    about_story_p2: "Alors on a tout repris à zéro. Vraie typographie Playfair. De vraies photos de gens, pas de mockups IA 3D. Un moteur d'intention qui pose les bonnes questions — « C'est pour qui ? Quelle occasion ? Ton ? » — puis réduit 250 cartes aux 12 qui correspondent. Vous concevez, vous prévisualisez, vous choisissez un moyen d'envoyer.",
    about_cta_title: "Voyez à quoi ressemblent 250 cartes",
    contact_final_explore: "🎴 Explorer les 250 cartes",
    contact_title: "Contacter le support SendAFun — là pour vous",
    contact_hero: "Bonjour. Une question, une idée de fonction ou envie de partager une carte coup de cœur ?",
    contact_hero_sub: "Nous lisons chaque message personnellement, en général sous 24h ouvrées.",
    contact_name: "Votre nom", contact_email: "Votre email",
    contact_topic: "À propos de quoi ?", contact_topic_select: "Choisissez un sujet",
    contact_ref: "Référence carte ou commande (facultatif)",
    contact_msg: "Votre message", contact_msg_placeholder: "Dites-nous ce qui vous passe par la tête…",
    contact_send: "📨 Envoyer le message",
    topic_general: "Question générale", topic_billing: "Facturation",
    topic_tech: "Technique", topic_feature: "Demande de fonction",
    topic_bug: "Signaler un bug", topic_media: "Presse / médias",
    topic_bulk: "Volume / entreprise", topic_other: "Autre sujet",
    payment_success_title: "🎉 Votre paiement est accepté !",
    payment_success_body_1: "Merci d'avoir choisi SendAFun. Un reçu est en route vers ",
    payment_success_body_2: " — sinon, vérifiez les spams avant de nous écrire.",
    payment_delivery_title: "📦 Résumé de l'envoi",
    payment_delivery_sub: "La planification s'active dans le fuseau horaire exact choisi.",
    payment_check_order: "📑 Voir la commande",
    payment_cancel_title: "Paiement annulé — aucun débit",
    payment_cancel_body_1: "Rien n'a été débité, rien n'a été programmé. Revenez quand vous voulez.",
    payment_cancel_body_2: "Parcourir les cartes",
    terms_title: "Conditions d'utilisation · SendAFun",
    privacy_title: "Politique de confidentialité · SendAFun",
    cookies_title: "Politique des cookies · SendAFun"
  },
  pt: {
    nav_home: "Início", nav_discover: "Descobrir", nav_pricing: "Preços",
    nav_about: "Sobre", nav_contact: "Contato", nav_member: "💎 Membro",
    common_send_free: "Enviar cartão grátis →",
    common_start: "Começar agora →", common_see_pricing: "Ver preços",
    common_customise: "Personalizar este cartão →",
    common_see_all_cards: "cartões →", common_count_suffix: " cartões",
    common_browse_all_prefix: "Ver todos os ", common_browse_all_suffix: " cartões",
    common_previous: "Slide anterior", common_next: "Próximo slide", common_slide: "Ir ao slide ",
    hero_title_a: "Crie um cartão ", hero_title_b: "que eles vão lembrar de verdade",
    hero_tagline: "Crie, convide amigos a coassinar, envie belos cartões animados em 60 segundos. Sem cadastro.",
    hero_stat_templates: " Modelos", hero_stat_sigs: " Assinaturas por cartão", hero_stat_cats: " Categorias",
    intent_step1: "👥 Para quem é este cartão?",
    intent_step2: "🎉 Qual é a ocasião?",
    intent_step3: "💬 Qual o clima?",
    intent_cta_perfect: "✨ Combina perfeito — mostre 12 cartões!",
    browse_title: "📚 Procurar por ocasião",
    browse_subtitle: "Sabe exatamente o que quer? Vá direto a uma categoria — ou responda 3 perguntas rápidas para um top 12 personalizado acima.",
    browse_see_all_prefix: "Ver ",
    pricing_title: "Preços simples, valor generoso",
    pricing_tagline: "Crie cartões ilimitados grátis. Só paga quando enviar ou desbloquear recursos coletivos.",
    pricing_compare_title: "Comparar planos lado a lado",
    pricing_plan_name_free: "Grátis",
    pricing_plan_name_pps: "Pagamento por envio",
    pricing_plan_name_monthly: "Ilimitado mensal",
    pricing_plan_name_annual: "Ilimitado anual",
    pricing_plan_name_group: "Passe Cartão Coletivo",
    pricing_plan_period_free: "Comece a criar já",
    pricing_plan_period_annual: "Cobrado anualmente — melhor valor",
    pricing_plan_period_other: "Cancele quando quiser",
    pricing_plan_cta_start_free: "Começar grátis",
    pricing_plan_cta_choose: "Escolher plano",
    pricing_plan_label_free: "Grátis", pricing_plan_label_pps: "Por envio",
    pricing_plan_label_monthly: "Mensal", pricing_plan_label_annual: "Anual",
    pricing_plan_label_group: "Coletivo",
    pricing_feature_unlimited_design: "Criação e prévia ilimitadas",
    pricing_feature_watermark_free: "Envios sem marca d'água",
    pricing_feature_scheduling_window: "Janela de agendamento",
    pricing_feature_group_signatures: "Assinaturas coletivas por cartão",
    pricing_feature_gift_subscription: "Assinatura-presente",
    pricing_feature_priority_support: "Suporte prioritário",
    pricing_feature_pdf_export: "Exportar PDF",
    pricing_feature_history_retention: "Retenção do histórico",
    pricing_feature_feat_label: "Recurso",
    pricing_feature_0days: "0 dias", pricing_feature_7days: "7 dias",
    pricing_feature_30days: "30 dias", pricing_feature_90days: "90 dias",
    pricing_feature_feat_none: "—",
    free_feat_1: "Criação e prévia ilimitadas",
    free_feat_2: "Todos os 250+ modelos",
    free_feat_3: "Rascunhos salvos localmente",
    free_feat_4: "Prévias com marca d'água",
    pps_feat_1: "Um único cartão agendado e enviado",
    pps_feat_2: "Janela de 7 dias",
    pps_feat_3: "Modelo de email padrão",
    pps_feat_4: "Sem marca d'água",
    monthly_feat_1: "Envios agendados ilimitados",
    monthly_feat_2: "HD sem marca d'água",
    monthly_feat_3: "Agendamento 30 dias",
    monthly_feat_4: "Modelos de email personalizados",
    monthly_feat_5: "Histórico de 30 dias",
    monthly_feat_6: "Suporte prioritário 24h",
    annual_feat_1: "Tudo do plano Mensal",
    annual_feat_2: "Melhor valor — ~R$29,50/mês",
    annual_feat_3: "Linha de suporte dedicada",
    annual_feat_4: "Histórico de 90 dias",
    annual_feat_5: "Acesso antecipado a modelos",
    group_feat_1: "Convite 50 amigos para assinar um cartão",
    group_feat_2: "Mural de assinaturas com fotos",
    group_feat_3: "Email único de revelação",
    group_feat_4: "Exportação PDF alta resolução",
    period_month: " / mês", period_year: " / ano",
    period_one_time: " pagamento único",
    footer_privacy: "Privacidade", footer_terms: "Termos",
    footer_cookies: "Cookies", footer_pricing: "Preços",
    footer_about: "Sobre", footer_contact: "Contato",
    footer_copy_prefix: "© ", footer_copy_suffix: " SendAFun. Todos os direitos reservados.",
    footer_about_line: "SendAFun — a forma calorosa e humana de celebrar juntos os grandes momentos, online.",
    footer_support_prefix: "Suporte: ",
    cookie_title: "🍪 Hora dos cookies — rápido, prometo.",
    cookie_body: "Usamos os menores cookies para idioma, agendamento e saber qual plano você escolheu. Sem rastreadores estranhos — nunca.",
    cookie_accept: "Entendi — aceitar 🍪",
    toast_load_meta: "Carregando metadados…",
    toast_ready: "✅ Pronto · API de cartões D1 conectada",
    toast_network_err: "Erro de rede: ",
    toast_intent_hint_prefix: "Selecionado ",
    toast_intent_hint_suffix: " — clique no botão azul para ver cartões correspondentes 🎯",
    intent_recipient: "Destinatário: ",
    intent_occasion: "Ocasião: ",
    intent_tone: "Clima: ",
    intent_reset: "Redefinir",
    intent_search_ph: "Buscar títulos, etiquetas…",
    intent_cta_good: "✨ Ótimo — mostre os 12 melhores cartões",
    intent_cta_default: "✨ Mostre 12 cartões perfeitos",
    intent_cta_pick: "Escolha pelo menos um para continuar",
    intent_match_prefix: "combina com '",
    intent_match_suffix: "'",
    cookie_privacy_title: "🍪 Valorizamos sua privacidade",
    cookie_privacy_body_1: " Usamos cookies necessários para o funcionamento. Também podemos usar cookies analíticos para entender a interação dos visitantes, em conformidade com a LGPD. Mais info na nossa ",
    cookie_privacy_body_2: " e na ",
    cookie_privacy_body_3: ".",
    cookie_reject: "Rejeitar não necessárias",
    cookie_accept_all: "Aceitar todas e continuar",
    cookie_privacy_policy: "Política de privacidade",
    cookie_policy: "Política de cookies",
    footer_support_label: "Suporte: ",
    footer_contact_prefix: "Contato: ",
    recipient_partner: "❤️ Meu parceiro", recipient_mom: "👩 Minha mãe",
    recipient_dad: "👨 Meu pai", recipient_best_friend: "🤝 Melhor amigo",
    recipient_kids: "👶 Meu filho", recipient_boss: "💼 Meu chefe",
    recipient_teacher: "✏️ Professor", recipient_colleague: "💻 Colega",
    recipient_grandma: "👵 Vovó", recipient_grandpa: "👴 Vovô",
    recipient_sibling: "🧑 Irmão ou irmã", recipient_me: "🧍 Eu mesmo",
    tone_funny: "😂 Engraçado", tone_sincere: "💗 Sincero",
    tone_romantic: "💕 Romântico", tone_playful: "🎈 Brincalhão",
    tone_formal: "🤝 Formal", tone_warm: "☀️ Acolhedor",
    cat_anniversary: "Aniversário", cat_birthday: "Aniversário",
    cat_christmas: "Natal", cat_congratulations: "Parabéns",
    cat_easter: "Páscoa", cat_encouragement: "Incentivo",
    cat_fathers_day: "Dia dos pais", cat_friendship: "Amizade",
    cat_get_well: "Melhoras", cat_good_luck: "Boa sorte",
    cat_graduation: "Formatura", cat_halloween: "Halloween",
    cat_love: "Amor e romance", cat_missing_you: "Saudades",
    cat_mothers_day: "Dia das mães", cat_new_baby: "Bebê",
    cat_new_year: "Ano novo", cat_retirement: "Aposentadoria",
    cat_sorry: "Desculpa", cat_sympathy: "Pêsames",
    cat_thank_you: "Obrigado", cat_thanksgiving: "Ação de graças",
    cat_thinking_of_you: "Com saudade", cat_valentine: "Dia dos namorados",
    cat_wedding: "Casamento",
    about_title: "Sobre a SendAFun — Cartões calorosos, humanos e sem esforço",
    about_hero_a: "Acreditamos que as melhores celebrações parecem ",
    about_hero_b: "pessoais, não automáticas.",
    about_hero_sub: "A SendAFun foi feita para quem já olhou um cartão genérico e suspirou.",
    about_team_title: "Por que existimos",
    about_team_body_1: "Os cartões digitais tradicionais são vergonhosamente template ou presos em softwares pesados. A SendAFun escolhe o oposto — ",
    about_team_body_2: "cartões ricos, personalizáveis e colaborativos que você realmente vai querer enviar.",
    about_values_title: "Nossos valores",
    about_v1_title: "Sempre humano",
    about_v1_body: "Sem personalização invasiva. Sem rastreio estranho. Cada cartão é criado por você — e só você.",
    about_v2_title: "Coassinar = juntos",
    about_v2_body: "Cartões são sociais. Convite 50 amigos para adicionar mensagens, fotos e personalidade antes do envio.",
    about_v3_title: "Zero fricção",
    about_v3_body: "Sem conta, sem cartão até clicar em Enviar. Literalmente um clique da ideia à prévia.",
    about_story_p2: "Então recomeçamos do zero. Tipografia Playfair real. Fotos reais de pessoas, não mockups 3D de IA. Um motor de intenção que faz as perguntas certas — \"É para quem? Qual a ocasião? Tom?\" — e então reduz 250 cartões aos 12 que encaixam. Você cria, você pré-visualiza, você escolhe um jeito de enviar.",
    about_cta_title: "Veja como são 250 cartões",
    contact_final_explore: "🎴 Explorar todos os 250 cartões",
    contact_title: "Contatar suporte SendAFun — aqui para você",
    contact_hero: "Olá. Uma dúvida, uma ideia de recurso ou quer compartilhar um cartão que amou?",
    contact_hero_sub: "Lemos cada mensagem pessoalmente, geralmente em até 24h úteis.",
    contact_name: "Seu nome", contact_email: "Seu email",
    contact_topic: "Sobre o que é?", contact_topic_select: "Selecione um assunto",
    contact_ref: "Referência do cartão ou pedido (opcional)",
    contact_msg: "Sua mensagem", contact_msg_placeholder: "Conte-nos o que está pensando…",
    contact_send: "📨 Enviar mensagem",
    topic_general: "Dúvida geral", topic_billing: "Cobrança",
    topic_tech: "Técnico", topic_feature: "Solicitar recurso",
    topic_bug: "Relatar bug", topic_media: "Imprensa / mídia",
    topic_bulk: "Volume / empresa", topic_other: "Outro assunto",
    payment_success_title: "🎉 Pagamento aprovado!",
    payment_success_body_1: "Obrigado por escolher a SendAFun. Um recibo está a caminho de ",
    payment_success_body_2: " — se não chegar, verifique o spam antes de nos contatar.",
    payment_delivery_title: "📦 Resumo da entrega",
    payment_delivery_sub: "O agendamento ativa no fuso horário exato escolhido.",
    payment_check_order: "📑 Ver status do pedido",
    payment_cancel_title: "Pagamento cancelado — sem cobrança",
    payment_cancel_body_1: "Nada foi cobrado, nada foi agendado. Volte quando quiser.",
    payment_cancel_body_2: "Ver cartões",
    terms_title: "Termos de serviço · SendAFun",
    privacy_title: "Política de privacidade · SendAFun",
    cookies_title: "Política de cookies · SendAFun"
  }
};
function _curLang() {
  const win = typeof window !== "undefined" ? window : null;
  const injected = win?.__SAF_EFFECTIVE_LANG__;
  if (injected && /^(en|es|fr|pt)$/i.test(injected)) return String(injected).toLowerCase();
  if (typeof _detectCurrentLang === "function") return _detectCurrentLang();
  return "en";
}
function t(key, fallbackEn) {
  const lang = _curLang();
  const dict = SAF_I18N_DICT[lang] || SAF_I18N_DICT.en;
  const val = dict[key];
  if (typeof val === "string" && val.length > 0) return val;
  const enFb = SAF_I18N_DICT.en[key];
  if (typeof enFb === "string" && enFb.length > 0) return enFb;
  return typeof fallbackEn === "string" ? fallbackEn : String(key);
}
function _catLabelFromSlug(slug, fallback) {
  const key = "cat_" + String(slug || "").replace(/[^a-z0-9]/gi, "_").replace(/^_+|_+$/g, "");
  const d = SAF_I18N_DICT[_curLang()] || SAF_I18N_DICT.en;
  if (typeof d[key] === "string" && d[key].length) return d[key];
  return typeof fallback === "string" ? fallback : (SAF_I18N_DICT.en[key] || String(slug || ""));
}
function _recipientLabelFromSlug(slug, fallback) {
  const key = "recipient_" + String(slug || "").replace(/[^a-z0-9]/gi, "_").replace(/^_+|_+$/g, "");
  const d = SAF_I18N_DICT[_curLang()] || SAF_I18N_DICT.en;
  if (typeof d[key] === "string" && d[key].length) return d[key];
  return typeof fallback === "string" ? fallback : (SAF_I18N_DICT.en[key] || String(slug || ""));
}
function _toneLabelFromSlug(slug, fallback) {
  const key = "tone_" + String(slug || "").replace(/[^a-z0-9]/gi, "_").replace(/^_+|_+$/g, "");
  const d = SAF_I18N_DICT[_curLang()] || SAF_I18N_DICT.en;
  if (typeof d[key] === "string" && d[key].length) return d[key];
  return typeof fallback === "string" ? fallback : (SAF_I18N_DICT.en[key] || String(slug || ""));
}

/* Resolve country from CF response headers / Worker echo.
 * TODAY returns null (no-op); Phase2 will surface the 2-letter
 * uppercase code via a tiny `/api/geo` echo so every Geo slot
 * receives real input without a call-site change. */
function _saferCountryCode() {
  const cc = (typeof window !== "undefined" && window.__SAF_COUNTRY) || null;
  return cc && /^[A-Z]{2}$/.test(cc) ? cc : null;
}
const CATEGORY_LABELS = {
  anniversary:   () => _catLabelFromSlug("anniversary", "Anniversary"),
  birthday:      () => _catLabelFromSlug("birthday", "Birthday"),
  christmas:     () => _catLabelFromSlug("christmas", "Christmas"),
  congratulations: () => _catLabelFromSlug("congratulations", "Congratulations"),
  easter:        () => _catLabelFromSlug("easter", "Easter"),
  encouragement: () => _catLabelFromSlug("encouragement", "Encouragement"),
  "fathers-day": () => _catLabelFromSlug("fathers-day", "Father's Day"),
  friendship:    () => _catLabelFromSlug("friendship", "Friendship"),
  "get-well":    () => _catLabelFromSlug("get-well", "Get Well"),
  "good-luck":   () => _catLabelFromSlug("good-luck", "Good Luck"),
  graduation:    () => _catLabelFromSlug("graduation", "Graduation"),
  halloween:     () => _catLabelFromSlug("halloween", "Halloween"),
  love:          () => _catLabelFromSlug("love", "Love & Romance"),
  "missing-you": () => _catLabelFromSlug("missing-you", "Missing You"),
  "mothers-day": () => _catLabelFromSlug("mothers-day", "Mother's Day"),
  "new-baby":    () => _catLabelFromSlug("new-baby", "New Baby"),
  "new-year":    () => _catLabelFromSlug("new-year", "New Year"),
  retirement:    () => _catLabelFromSlug("retirement", "Retirement"),
  sorry:         () => _catLabelFromSlug("sorry", "Apology"),
  sympathy:      () => _catLabelFromSlug("sympathy", "Sympathy"),
  "thank-you":   () => _catLabelFromSlug("thank-you", "Thank You"),
  thanksgiving:  () => _catLabelFromSlug("thanksgiving", "Thanksgiving"),
  "thinking-of-you": () => _catLabelFromSlug("thinking-of-you", "Thinking of You"),
  valentine:     () => _catLabelFromSlug("valentine", "Valentine"),
  wedding:       () => _catLabelFromSlug("wedding", "Wedding")
};
const RECIPIENT_OPTIONS = [
  { slug: "partner",      label: () => _recipientLabelFromSlug("partner", "❤️ My Partner"),     match: "Love" },
  { slug: "mom",          label: () => _recipientLabelFromSlug("mom", "👩 My Mom"),             match: "Mother" },
  { slug: "dad",          label: () => _recipientLabelFromSlug("dad", "👨 My Dad"),             match: "Father" },
  { slug: "best-friend",  label: () => _recipientLabelFromSlug("best-friend", "🤝 Best Friend"),match: "Friend" },
  { slug: "kids",         label: () => _recipientLabelFromSlug("kids", "👶 My Kid"),            match: "Baby" },
  { slug: "boss",         label: () => _recipientLabelFromSlug("boss", "💼 My Boss"),           match: "Retirement" },
  { slug: "teacher",      label: () => _recipientLabelFromSlug("teacher", "✏️ Teacher"),        match: "Thank" },
  { slug: "colleague",    label: () => _recipientLabelFromSlug("colleague", "💻 Coworker"),     match: "Farewell" },
  { slug: "grandma",      label: () => _recipientLabelFromSlug("grandma", "👵 Grandma"),        match: "Mother" },
  { slug: "grandpa",      label: () => _recipientLabelFromSlug("grandpa", "👴 Grandpa"),        match: "Father" },
  { slug: "sibling",      label: () => _recipientLabelFromSlug("sibling", "🧑 Brother or Sister"), match: "Birthday" },
  { slug: "me",           label: () => _recipientLabelFromSlug("me", "🧍 Myself"),              match: "Just Because" }
];
const OCCASION_OPTIONS = Object.keys(CATEGORY_LABELS).map(k => ({
  slug: k,
  label: CATEGORY_LABELS[k],
  match: CATEGORY_LABELS[k]
}));
const TONE_OPTIONS = [
  { slug: "funny",   label: () => _toneLabelFromSlug("funny", "😂 Funny"),    words: ["roast", "joke", "pun"] },
  { slug: "sincere", label: () => _toneLabelFromSlug("sincere", "💗 Sincere"), words: ["heartfelt", "sincere", "thank"] },
  { slug: "romantic",label: () => _toneLabelFromSlug("romantic", "💕 Romantic"),words: ["love", "romantic", "soulmate"] },
  { slug: "playful", label: () => _toneLabelFromSlug("playful", "🎈 Playful"), words: ["cheerful", "bright", "playful"] },
  { slug: "formal",  label: () => _toneLabelFromSlug("formal", "🤝 Formal"),  words: ["classic", "elegant", "formal"] },
  { slug: "warm",    label: () => _toneLabelFromSlug("warm", "☀️ Warm"),      words: ["warm", "cozy", "family"] }
];
const FONT_FAMILIES = [
  "'Inter', sans-serif",
  "'Playfair Display', serif",
  "'Dancing Script', cursive"
];
const FONT_COLOR_PRESETS = [
  "#1a1a1a", "#c53030", "#2b6cb0", "#2f855a",
  "#d69e2e", "#805ad5", "#e53e3e", "#2d3748"
];
const AI_WORDBANK = {
  en: {
    openings: ["Hey {to},", "Dear {to},", "Hi {to},", "To my dearest {to},", "Sweet {to},"],
    bodies: {
      birthday: [
        "Wishing you the happiest of birthdays filled with laughter, sunshine, and every little thing that makes you smile. May this year bring you closer to every dream you hold in your heart.",
        "Another trip around the sun, and you make it look more radiant than ever. Sending you oceans of love, mountains of joy, and a year full of wonderful surprises just for you.",
        "On your special day, I want you to know how deeply you are loved and how brightly you light up every room you walk into. May every candle on your cake bring a wish that comes true."
      ],
      love: [
        "Every moment with you feels like a page from my favorite story. You are my quiet morning, my favorite song, and the warmth I carry wherever I go. I love you more than words can ever say.",
        "In a world of endless goodbyes, I would choose you a thousand times over. Thank you for being my home, my hope, and the most beautiful person in my universe.",
        "You are the reason I believe in forever. With you, ordinary days become adventures, and quiet nights become the safest place I've ever known."
      ],
      thanks: [
        "There are not enough words in any language to say how grateful I am for you. Thank you for staying, for caring, and for loving me even on the days I find it hard to love myself.",
        "You showed up when I least expected it and stayed when I needed it most. Thank you for being a friend, a safe place, and a blessing I never thought I deserved.",
        "My heart is full because you are in my life. Thank you for every kind word, every gentle act, and every moment you chose to stand beside me."
      ],
      congrats: [
        "Congratulations! You worked so hard, dreamed so big, and earned every bit of this beautiful moment. The world is lucky to witness everything you are about to become.",
        "Cheers to you! This win isn't luck — it's every early morning, every late night, and every moment you refused to give up. So incredibly proud of you.",
        "Today is proof that brave hearts and steady hands keep writing the best stories. Massive congratulations — you deserve every sparkle of this moment."
      ],
      getwell: [
        "Sending you the softest blankets, the warmest soup, and a whole heart full of healing wishes. Take your time, rest deeply, and know I'm right here cheering you back to brighter days.",
        "I know today feels heavy, but I also know how strong you are. Every small step forward is a victory. Rest, recover, and come back when you're ready — we'll be waiting with open arms.",
        "Healing isn't linear, but neither is love. Sending you patience for the hard days, hope for the mornings ahead, and the coziest thoughts to wrap yourself in."
      ],
      default: [
        "Thinking of you today and sending a little sunshine your way. You deserve every kind thing that comes your way.",
        "Some days just call for telling the people we love that they matter. Today is one of those days. You matter — more than you'll ever know.",
        "Just a little note to say: I see you, I appreciate you, and I'm so glad you exist in this world."
      ]
    },
    closings: ["With all my love,", "Forever yours,", "Warmly,", "With a big hug,", "Sincerely,"],
    signoffs: ["{from}", "Yours — {from}", "Love always, {from}", "Hugs, {from}"]
  },
  es: {
    openings: ["Hola {to},", "Querido {to},", "Querida {to},", "Mi amado {to},", "Cariño {to},"],
    bodies: {
      birthday: [
        "Te deseo el cumpleaños más feliz del mundo, lleno de risas, sol y todas esas pequeñas cosas que te hacen sonreír. Que este año te acerque a cada sueño que guardas en tu corazón.",
        "Otra vuelta al sol, y tú la haces ver más brillante que nunca. Te envío océanos de amor, montañas de alegría y un año lleno de sorpresas hermosas solo para ti.",
        "En tu día especial, quiero que sepas lo mucho que te quieren y lo mucho que iluminas cada lugar al que llegas. Que cada vela de tu pastel sea un deseo que se cumple."
      ],
      love: [
        "Cada momento contigo se siente como una página de mi cuento favorito. Eres mi mañana tranquila, mi canción favorita y la calidez que llevo conmigo donde quiera que vaya. Te amo más de lo que las palabras podrían decir jamás.",
        "En un mundo de despedidas sin fin, te elegiría mil veces más. Gracias por ser mi hogar, mi esperanza y la persona más hermosa de mi universo.",
        "Eres la razón por la que creo en el siempre. Contigo, los días ordinarios se vuelven aventuras y las noches tranquilas se convierten en el lugar más seguro que he conocido."
      ],
      thanks: [
        "No existen palabras suficientes en ningún idioma para decir lo agradecido/a que estoy contigo. Gracias por quedarte, por cuidarme y por amarme incluso en los días en que me cuesta amarme a mí mismo/a.",
        "Apareciste cuando menos lo esperaba y te quedaste cuando más lo necesitaba. Gracias por ser amistad, refugio y una bendición que nunca pensé merecer.",
        "Mi corazón está lleno porque estás en mi vida. Gracias por cada palabra amable, por cada gesto tierno y por cada momento en que elegiste estar a mi lado."
      ],
      congrats: [
        "¡Felicidades! Trabajaste muchísimo, soñaste a lo grande y te ganaste cada parte de este momento hermoso. El mundo tiene suerte de ver todo lo que estás por convertirte.",
        "¡Brindo por ti! Este triunfo no es suerte — es cada madrugada, cada noche sin dormir y cada momento en que te negaste a rendirte. Estoy increíblemente orgulloso/a de ti.",
        "Hoy es prueba de que los corazones valientes y las manos constantes siguen escribiendo las mejores historias. Enhorabuena — te mereces cada brillo de este momento."
      ],
      getwell: [
        "Te envío las mantas más suaves, la sopa más calientita y un corazón lleno de deseos de sanación. Tómate tu tiempo, descansa profundamente y sabe que estoy aquí animándote hasta días más brillantes.",
        "Sé que hoy se siente pesado, pero también sé lo fuerte que eres. Cada pequeño paso hacia adelante es una victoria. Descansa, recupérate y vuelve cuando estés listo/a — te esperamos con los brazos abiertos.",
        "Sanar no es lineal, pero el amor tampoco. Te envío paciencia para los días difíciles, esperanza para las mañanas que vienen y los pensamientos más acogedores para envolverte."
      ],
      default: [
        "Hoy pensaba en ti y te envío un poco de sol. Te mereces todo lo bueno que se cruce en tu camino.",
        "Hay días que simplemente piden decirle a la gente que queremos que nos importan. Hoy es uno de esos días. Tú importas — más de lo que jamás sabrás.",
        "Solo una pequeña nota para decirte: te veo, te agradezco y me alegro muchísimo de que existas en este mundo."
      ]
    },
    closings: ["Con todo mi cariño,", "Siempre tuyo/a,", "Con amor,", "Un abrazo enorme,", "Atentamente,"],
    signoffs: ["{from}", "Tuyo/a — {from}", "Amor siempre, {from}", "Abrazos, {from}"]
  },
  fr: {
    openings: ["Salut {to},", "Cher {to},", "Chère {to},", "Mon très cher {to},", "Mon amour {to},"],
    bodies: {
      birthday: [
        "Je te souhaite l'anniversaire le plus heureux du monde, rempli de rires, de soleil et de toutes les petites choses qui te font sourire. Que cette année t'approche de chaque rêve que tu portes au fond de ton cœur.",
        "Un nouveau tour autour du soleil, et tu le rendes plus radieux que jamais. Je t'envoie des océans d'amour, des montagnes de joie et une année pleine de belles surprises rien que pour toi.",
        "En ce jour spécial, je veux que tu saches à quel point tu es aimé/e et à quel point tu illumines chaque pièce dans laquelle tu entres. Que chaque bougie sur ton gâteau soit un vœu qui se réalise."
      ],
      love: [
        "Chaque instant avec toi ressemble à une page de mon histoire préférée. Tu es mon matin calme, ma chanson préférée et la chaleur que je porte partout avec moi. Je t'aime plus que les mots ne pourront jamais le dire.",
        "Dans un monde d'adieux sans fin, je te choisirais mille fois encore. Merci d'être ma maison, mon espoir et la plus belle personne de mon univers.",
        "Tu es la raison pour laquelle je crois en l'éternité. Avec toi, les jours ordinaires deviennent des aventures et les nuits calmes le lieu le plus sûr que j'aie jamais connu."
      ],
      thanks: [
        "Il n'y a pas assez de mots dans aucune langue pour dire à quel point je te suis reconnaissant/e. Merci de rester, de prendre soin de moi et de m'aimer même les jours où j'ai du mal à m'aimer moi-même.",
        "Tu es apparu/e quand je m'y attendais le moins et tu es resté/e quand j'en avais le plus besoin. Merci d'être une amitié, un refuge et une bénédiction que je ne pensais pas mériter.",
        "Mon cœur est plein parce que tu es dans ma vie. Merci pour chaque mot gentil, chaque geste tendre et chaque instant où tu as choisi d'être à mes côtés."
      ],
      congrats: [
        "Félicitations ! Tu as travaillé si dur, rêvé si grand et tu as mérité chaque parcelle de ce beau moment. Le monde est chanceux de voir tout ce que tu vas devenir.",
        "Trinque à toi ! Cette victoire n'est pas de la chance — c'est chaque matin tôt, chaque nuit tardive et chaque instant où tu as refusé d'abandonner. Je suis incroyablement fier/fière de toi.",
        "Aujourd'hui est la preuve que les cœurs courageux et les mains persévérantes continuent d'écrire les plus belles histoires. Mes félicitations — tu mérites chaque éclat de ce moment."
      ],
      getwell: [
        "Je t'envoie les couvertures les plus douces, la soupe la plus chaude et un cœur plein de vœux de guérison. Prends ton temps, repose-toi profondément et sache que je suis juste là pour t'encourager vers des jours plus lumineux.",
        "Je sais qu'aujourd'hui semble lourd, mais je sais aussi à quel point tu es fort/e. Chaque petit pas en avant est une victoire. Repose-toi, guéris et reviens quand tu seras prêt/e — nous t'attendons les bras ouverts.",
        "Guérir n'est pas linéaire, mais l'amour non plus. Je t'envoie de la patience pour les jours difficiles, de l'espoir pour les matins à venir et les pensées les plus douces pour t'envelopper."
      ],
      default: [
        "Je pensais à toi aujourd'hui et je t'envoie un peu de soleil. Tu mérites tout ce qui de bon peut arriver sur ton chemin.",
        "Certains jours appellent simplement à dire aux personnes qu'on aime qu'elles comptent. Aujourd'hui est l'un de ces jours. Tu comptes — plus que tu ne le sauras jamais.",
        "Juste un petit mot pour dire : je te vois, je te remercie et je suis tellement content/e que tu existes dans ce monde."
      ]
    },
    closings: ["Avec tout mon amour,", "Toujours à toi,", "Tendrement,", "Un gros câlin,", "Bien à toi,"],
    signoffs: ["{from}", "À toi — {from}", "Amour toujours, {from}", "Câlins, {from}"]
  },
  pt: {
    openings: ["Oi {to},", "Querido {to},", "Querida {to},", "Meu amado {to},", "Minha querida {to},"],
    bodies: {
      birthday: [
        "Te desejo o aniversário mais feliz do mundo, cheio de risadas, sol e todas as pequenas coisas que te fazem sorrir. Que este ano te aproxime de cada sonho que guarda no fundo do coração.",
        "Mais uma volta ao redor do sol, e você deixa tudo mais radiante do que nunca. Te envio oceanos de amor, montanhas de alegria e um ano cheio de surpresas lindas só para você.",
        "No seu dia especial, quero que saiba o quanto você é amado/a e o quanto ilumina cada lugar onde entra. Que cada vela no seu bolo seja um desejo que se realiza."
      ],
      love: [
        "Cada momento com você parece uma página da minha história favorita. Você é a minha manhã tranquila, a minha canção preferida e o calor que levo comigo onde quer que eu vá. Te amo mais do que as palavras jamais poderão dizer.",
        "Num mundo de despedidas sem fim, eu te escolheria mil vezes novamente. Obrigado/a por ser meu lar, minha esperança e a pessoa mais linda do meu universo.",
        "Você é o motivo pelo qual eu acredito no sempre. Com você, dias comuns viram aventuras e noites calmas se tornam o lugar mais seguro que já conheci."
      ],
      thanks: [
        "Não existem palavras suficientes em nenhum idioma para dizer o quanto sou grato/a por você. Obrigado/a por ficar, por cuidar e por me amar mesmo nos dias em que é difícil amar a mim mesmo/a.",
        "Você apareceu quando eu menos esperava e ficou quando eu mais precisava. Obrigado/a por ser amizade, refúgio e uma bênção que eu nunca pensei merecer.",
        "Meu coração está cheio porque você está na minha vida. Obrigado/a por cada palavra gentil, por cada gesto carinhoso e por cada momento em que escolheu ficar ao meu lado."
      ],
      congrats: [
        "Parabéns! Você trabalhou muito, sonhou alto e ganhou cada pedacinho desse momento lindo. O mundo tem sorte de ver tudo o que você vai se tornar.",
        "Um brinde a você! Essa vitória não é sorte — é cada manhã cedo, cada noite tarde e cada momento em que você se recusou a desistir. Estou incrivelmente orgulhoso/a de você.",
        "Hoje é a prova de que corações corajosos e mãos persistentes continuam escrevendo as melhores histórias. Meus parabéns — você merece cada brilho desse momento."
      ],
      getwell: [
        "Te envio os cobertores mais macios, a sopa mais quentinha e um coração cheio de desejos de cura. Leve o seu tempo, descanse profundamente e saiba que estou aqui torcendo por dias mais brilhantes.",
        "Sei que hoje parece pesado, mas também sei o quanto você é forte. Cada pequeno passo em frente é uma vitória. Descanse, recupere-se e volte quando estiver pronto/a — estaremos esperando de braços abertos.",
        "Curar não é linear, mas o amor também não. Te envio paciência para os dias difíceis, esperança para as manhãs que virão e os pensamentos mais aconchegantes para te envolver."
      ],
      default: [
        "Estava pensando em você hoje e envio um pouco de sol. Você merece tudo de bom que cruzar o seu caminho.",
        "Tem dias que só pedem para dizer às pessoas que amamos o quanto elas importam. Hoje é um desses dias. Você importa — mais do que jamais saberá.",
        "Só uma pequena nota para dizer: eu vejo você, agradeço por você e fico muito feliz que exista nesse mundo."
      ]
    },
    closings: ["Com todo o meu carinho,", "Sempre seu/sua,", "Com amor,", "Um abraço enorme,", "Atenciosamente,"],
    signoffs: ["{from}", "Seu/Sua — {from}", "Amor sempre, {from}", "Abraços, {from}"]
  }
};
const AI_TIER_LABELS = Object.freeze({
  blocked:  { daily: 0,   label: "Rate limited" },
  anon:     { daily: 3,   label: "Free (guest)" },
  free:     { daily: 5,   label: "Free account" },
  paid:     { daily: 15,  label: "Paid tier" },
  unlimited:{ daily: 9999,label: "Unlimited" }
});

const TIER_RANK = Object.freeze({ anon: 0, free: 1, paid: 2, unlimited: 3 });
const TIER_LABEL = Object.freeze({
  anon: "Guest", free: "Free Account", paid: "Pro Plan", unlimited: "Unlimited Pro+"
});

const FEATURE_TIER_MATRIX = Object.freeze({
  ai_message_basic:   { min: "anon",     name: "AI Message (basic)" },
  ai_message_paid:    { min: "paid",     name: "AI Message (premium)" },
  advanced_fonts:     { min: "free",     name: "All 3 Commercial Fonts" },
  letter_line_ctrl:   { min: "free",     name: "Letter / Line spacing" },
  text_mask:          { min: "free",     name: "Dark Text Mask" },
  decorative_border:  { min: "paid",     name: "Decorative Borders" },
  stickers_over_6:    { min: "free",     name: "More than 6 stickers" },
  sticker_categories: { min: "free",     name: "All sticker categories" },
  layer_order:        { min: "free",     name: "Layer reorder" },
  gif_overlay:        { min: "paid",     name: "GIF animations" },
  gif_export:         { min: "paid",     name: "GIF export (HD)" },
  video_export_sd:    { min: "paid",     name: "Video export SD + watermark" },
  video_export_hd:    { min: "paid",     name: "Video export HD" },
  video_export_4k:    { min: "unlimited",name: "Video export 4K + dual audio" },
  bgm_library:        { min: "paid",     name: "Royalty-free BGM" },
  voice_recording:    { min: "paid",     name: "Voice recording" },
  dual_audio_mix:     { min: "unlimited",name: "Dual-audio mixdown" },
  envelope_skin_2:    { min: "free",     name: "2 envelope skins" },
  envelope_skin_6:    { min: "paid",     name: "6 premium envelope themes" },
  envelope_particles: { min: "unlimited",name: "Envelope particle FX" },
  schedule_7d:        { min: "paid",     name: "Schedule up to 7 days" },
  schedule_30d:       { min: "paid",     name: "Schedule up to 30 days" },
  schedule_365d:      { min: "unlimited",name: "Schedule 1 year ahead" },
  group_collab_2:     { min: "paid",     name: "Co-sign up to 2" },
  group_collab_10:    { min: "paid",     name: "Co-sign up to 10" },
  group_collab_50:    { min: "unlimited",name: "Co-sign up to 50" },
  admin_lock:         { min: "paid",     name: "Admin deadline / manual lock" },
  pdf_export:         { min: "paid",     name: "Download PDF" },
  watermark_free:     { min: "paid",     name: "Watermark-free export" },
  geo_local_pick:     { min: "anon",     name: "Local picks" }
});

const ENVELOPE_SKINS = Object.freeze([
  { id: "none",         name: "Plain (free)",              tier: "anon"      },
  { id: "white_pearl",  name: "White Pearl",               tier: "free"      },
  { id: "rose_gold",    name: "Rose Gold",                 tier: "paid"      },
  { id: "midnight_blue",name: "Midnight Blue",             tier: "paid"      },
  { id: "emerald",      name: "Emerald",                   tier: "paid"      },
  { id: "royal_plum",   name: "Royal Plum",                tier: "paid"      },
  { id: "aurora",       name: "Aurora + Particles",        tier: "unlimited" }
]);

const ENVELOPE_SKIN_STYLES = Object.freeze({
  none: {
    body: "#f8fafc", bodyShadow: "#e2e8f0",
    flap: "#f1f5f9", flapShadow: "#cbd5e1",
    paper: "#ffffff", text: "#0f172a",
    seal: null
  },
  white_pearl: {
    body: "#fdfcfb", bodyShadow: "#e7e4e0",
    flap: "#f8f6f3", flapShadow: "#d6d2cc",
    paper: "#ffffff", text: "#1e293b",
    seal: { color: "#e0d4c0", icon: "✨" }
  },
  rose_gold: {
    body: "#fff5f3", bodyShadow: "#f0c4b8",
    flap: "#fce4dc", flapShadow: "#e8a592",
    paper: "#fffaf9", text: "#7c2d12",
    seal: { color: "#e8a592", icon: "💗" }
  },
  midnight_blue: {
    body: "#0f1e3d", bodyShadow: "#050a18",
    flap: "#1e293b", flapShadow: "#020617",
    paper: "#f8fafc", text: "#0f172a",
    seal: { color: "#60a5fa", icon: "🌙" }
  },
  emerald: {
    body: "#064e3b", bodyShadow: "#022c22",
    flap: "#065f46", flapShadow: "#014737",
    paper: "#ecfdf5", text: "#064e3b",
    seal: { color: "#10b981", icon: "🍀" }
  },
  royal_plum: {
    body: "#3b0764", bodyShadow: "#1e0538",
    flap: "#4c1d95", flapShadow: "#2e0854",
    paper: "#faf5ff", text: "#3b0764",
    seal: { color: "#a855f7", icon: "👑" }
  },
  aurora: {
    body: "#0c1445", bodyShadow: "#050828",
    flap: "#1e1b4b", flapShadow: "#0a0720",
    paper: "#f5f3ff", text: "#1e1b4b",
    seal: { color: "linear-gradient(135deg,#8b5cf6,#ec4899,#06b6d4)", icon: "✨" },
    gradient: "linear-gradient(135deg,#0c1445 0%,#1e1b4b 40%,#4c1d95 70%,#0c1445 100%)",
    particles: true
  }
});

const STICKER_CATEGORIES = {
  hearts: {
    label: "❤️ Hearts",
    items: ["❤️", "💕", "💖", "💗", "💓", "💞", "💝", "🩷", "💘", "💝", "❤️‍🔥", "❤️‍🩹"]
  },
  sparkle: {
    label: "✨ Sparkle",
    items: ["✨", "🌟", "⭐", "💫", "🌠", "🪐", "⚡", "💥", "🌟", "✨"]
  },
  flower: {
    label: "🌸 Flowers",
    items: ["🌹", "🌸", "🌺", "🌷", "💐", "🌻", "🌼", "🪻", "🏵️", "💮"]
  },
  garland: {
    label: "🎀 Garlands",
    items: ["🎊", "🎉", "🎈", "🎁", "🎀", "🪅", "🧧", "🏮", "🎐", "✉️"]
  },
  lace: {
    label: "🪡 Lace",
    items: ["🪡", "🧵", "🪢", "📿", "💎", "📎", "🖇️", "✂️", "🎗️", "🎭"]
  },
  festive: {
    label: "🎄 Festive",
    items: ["🎂", "🍰", "🧁", "🥂", "🍾", "🎇", "🎆", "🪔", "🎃", "🎄"]
  }
};
const STICKER_EMOJIS = STICKER_CATEGORIES.hearts.items.concat(STICKER_CATEGORIES.sparkle.items);

const BORDER_PRESETS = [
  { id: "none",       name: "None", css: "" },
  { id: "gold_thin",  name: "Gold Thin", css: "8px", grad: "linear-gradient(135deg,#fde68a,#d97706,#fbbf24,#b45309)", radius: 1, inset: 1 },
  { id: "rose_gold",  name: "Rose Gold", css: "10px", grad: "linear-gradient(135deg,#fecdd3,#be123c,#fb7185,#9f1239)", radius: 1, inset: 1 },
  { id: "silver",   name: "Silver",    css: "8px",  grad: "linear-gradient(135deg,#f1f5f9,#94a3b8,#cbd5e1,#64748b)", radius: 1, inset: 1 },
  { id: "soft_rainbow", name: "Pastel Rainbow", css: "10px", grad: "conic-gradient(from 90deg,#fca5a5,#fcd34d,#86efac,#93c5fd,#c4b5fd,#f0abfc,#fca5a5)", radius: 1, inset: 1 },
  { id: "lace_white", name: "White Lace",  css: "14px", grad: "repeating-linear-gradient(45deg,#fff 0 6px,#f1f5f9 6px 12px)", radius: 1, inset: 0 },
  { id: "double_gold", name: "Double Gold", css: "4px", grad: "linear-gradient(135deg,#fde68a,#b45309)", radius: 2, inset: 2 }
];
const SIGNER_AVATAR_EMOJIS = [
  "🎂", "💖", "🎉", "🤝", "🌷", "👶",
  "🎓", "🐰", "🎄", "🏖️", "☕", "🌸"
];
const FOOTER_LINKS = [
  { label: () => t("footer_privacy"), href: "/privacy.html" },
  { label: () => t("footer_terms"), href: "/terms.html" },
  { label: () => t("footer_cookies"), href: "/cookies.html" },
  { label: () => t("footer_pricing"), href: "/pricing" },
  { label: () => t("footer_about"), href: "/about.html" },
  { label: () => t("footer_contact"), href: "/contact.html" }
];
const COMPARE_FEATURES = [
  { key: "unlimited_design", label: () => t("pricing_feature_unlimited_design") },
  { key: "watermark_free", label: () => t("pricing_feature_watermark_free") },
  { key: "scheduling_window", label: () => t("pricing_feature_scheduling_window"), type: "text" },
  { key: "group_signatures", label: () => t("pricing_feature_group_signatures"), type: "text" },
  { key: "gift_subscription", label: () => t("pricing_feature_gift_subscription") },
  { key: "priority_support", label: () => t("pricing_feature_priority_support") },
  { key: "pdf_export", label: () => t("pricing_feature_pdf_export") },
  { key: "history_retention", label: () => t("pricing_feature_history_retention"), type: "text" }
];
const PLAN_FEATURE_MATRIX = {
  free: {
    unlimited_design: true, watermark_free: false,
    scheduling_window: () => t("pricing_feature_0days"), group_signatures: "0",
    gift_subscription: false, priority_support: false,
    pdf_export: false, history_retention: () => t("pricing_feature_0days")
  },
  pay_per_send: {
    unlimited_design: true, watermark_free: true,
    scheduling_window: () => t("pricing_feature_7days"), group_signatures: "2",
    gift_subscription: false, priority_support: false,
    pdf_export: false, history_retention: () => t("pricing_feature_7days")
  },
  monthly: {
    unlimited_design: true, watermark_free: true,
    scheduling_window: () => t("pricing_feature_30days"), group_signatures: "10",
    gift_subscription: true, priority_support: true,
    pdf_export: true, history_retention: () => t("pricing_feature_30days")
  },
  annual: {
    unlimited_design: true, watermark_free: true,
    scheduling_window: () => t("pricing_feature_30days"), group_signatures: "50",
    gift_subscription: true, priority_support: true,
    pdf_export: true, history_retention: () => t("pricing_feature_90days")
  },
  group_pass: {
    unlimited_design: true, watermark_free: true,
    scheduling_window: () => t("pricing_feature_7days"), group_signatures: "50",
    gift_subscription: false, priority_support: false,
    pdf_export: true, history_retention: () => t("pricing_feature_30days")
  }
};

const state = {
  intent: {
    recipient: null,
    occasion: null,
    tone: null
  },
  editor: {
    fromName: "",
    toName: "",
    fromEmail: "",
    toEmail: "",
    defaultText: "",
    sendDate: "",
    sendTime: "10:00",
    fontFamily: FONT_FAMILIES[0],
    fontColor: FONT_COLOR_PRESETS[0],
    backgroundColor: "#ffffff",
    accentColor: "#6366f1",
    fontSize: 24,
    letterSpacing: 0,
    lineHeight: 1.55,
    textMask: true,
    borderType: "none",
    activeStickerCat: "hearts",
    stickers: [],
    stickerZ: 10,
    envelopeSkin: "none"
  },
  flipped: false,
  activeTab: "message",
  groupToken: null,
  isMember: false,
  currentSlug: null
};

function _L(val, fallback) {
  if (typeof val === "function") {
    try { val = val(); } catch (_) { val = undefined; }
  }
  if (typeof val === "string" && val.length > 0) return val;
  return typeof fallback === "string" ? fallback : "";
}

function h(tag, attrs = {}, children = []) {
  const el = document.createElement(tag);
  Object.entries(attrs).forEach(([k, v]) => {
    if (k === "class") el.className = v;
    else if (k === "style" && typeof v === "object") Object.assign(el.style, v);
    else if (k === "dataset") Object.assign(el.dataset, v);
    else if (k.startsWith("on") && typeof v === "function") el.addEventListener(k.slice(2).toLowerCase(), v);
    else if (v !== undefined && v !== null) el.setAttribute(k, v);
  });
  (Array.isArray(children) ? children : [children]).forEach(c => {
    if (c == null || c === false) return;
    let val = c;
    if (typeof val === "function") { try { val = val(); } catch (_) { val = ""; } }
    if (typeof val === "string" || typeof val === "number" || typeof val === "bigint" || typeof val === "boolean") {
      if (val !== true) el.appendChild(document.createTextNode(String(val)));
    } else if (val instanceof Node) {
      el.appendChild(val);
    } else if (Array.isArray(val)) {
      val.forEach(x => el.appendChild(typeof x === "string" || typeof x === "number" ? document.createTextNode(String(x)) : x));
    }
  });
  return el;
}

function clearApp() {
  const app = document.getElementById("app");
  if (app) app.innerHTML = "";
}

function mountApp(node) {
  const app = document.getElementById("app");
  if (!app) return;
  app.innerHTML = "";
  if (node) app.appendChild(node);
}

function scrollToId(id) {
  const el = document.getElementById(id);
  if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
}

function updateCanonical(href) {
  const link = document.getElementById("canonicalLink");
  const full = href ? "https://sendafun.com" + href : location.href;
  if (!link) {
    const l = document.createElement("link");
    l.rel = "canonical"; l.id = "canonicalLink";
    document.head.appendChild(l);
  }
  const el = document.getElementById("canonicalLink");
  if (el) el.setAttribute("href", full);
}

function updateMetaDescription(desc) {
  if (!desc) return;
  let meta = document.querySelector('meta[name="description"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "description");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", desc);
}

function setMetaKeywords(keywords) {
  if (!keywords || !keywords.length) return;
  let meta = document.querySelector('meta[name="keywords"]');
  if (!meta) {
    meta = document.createElement("meta");
    meta.setAttribute("name", "keywords");
    document.head.appendChild(meta);
  }
  meta.setAttribute("content", keywords.join(", "));
}

function setPageTitle(title) {
  if (title) document.title = title;
}

function setOrCreateMeta(attrs) {
  const selector = Object.keys(attrs).map(k => `[${k}="${attrs[k]}"]`).join("");
  let el = document.head.querySelector(`meta${selector}`);
  if (!el) {
    el = document.createElement("meta");
    for (const k in attrs) el.setAttribute(k, attrs[k]);
    document.head.appendChild(el);
  } else {
    for (const k in attrs) if (attrs[k]) el.setAttribute(k, attrs[k]);
  }
  return el;
}

function updateOGTags({ title, description, type = "website", image, url, siteName = "SendAFun", twitterCard = "summary_large_image" }) {
  const fullUrl = url || location.href;
  const ogTitle = title || document.title;
  const ogDesc = description || (document.querySelector('meta[name="description"]') || {}).content || "";
  const ogImage = image || "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp";
  setOrCreateMeta({ property: "og:title", content: ogTitle });
  setOrCreateMeta({ property: "og:description", content: ogDesc });
  setOrCreateMeta({ property: "og:type", content: type });
  setOrCreateMeta({ property: "og:url", content: fullUrl });
  setOrCreateMeta({ property: "og:image", content: ogImage });
  setOrCreateMeta({ property: "og:site_name", content: siteName });
  setOrCreateMeta({ name: "twitter:card", content: twitterCard });
  setOrCreateMeta({ name: "twitter:title", content: ogTitle });
  setOrCreateMeta({ name: "twitter:description", content: ogDesc });
  setOrCreateMeta({ name: "twitter:image", content: ogImage });
}

function injectJSONLD(scriptId, data) {
  let tag = document.getElementById(scriptId);
  if (!tag) {
    tag = document.createElement("script");
    tag.type = "application/ld+json";
    tag.id = scriptId;
    document.head.appendChild(tag);
  }
  tag.textContent = JSON.stringify(data, null, 2);
}

function getOrgJSONLD() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SendAFun",
    "url": "https://sendafun.com",
    "logo": "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp",
    "email": "support@sendafun.com",
    "sameAs": ["https://sendafun.com"],
    // Doc §192: 7 core target countries = US/GB/CA/FR/ES/MX/BR — areaServed
    "areaServed": [
      { "@type": "Country", "name": "US" },
      { "@type": "Country", "name": "GB" },
      { "@type": "Country", "name": "CA" },
      { "@type": "Country", "name": "FR" },
      { "@type": "Country", "name": "ES" },
      { "@type": "Country", "name": "MX" },
      { "@type": "Country", "name": "BR" }
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "support@sendafun.com",
      "areaServed": ["US","GB","CA","FR","ES","MX","BR"],
      "availableLanguage": ["English","Spanish","French","Portuguese"]
    }
  };
}

function getWebSiteJSONLD() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "name": "SendAFun",
    "url": "https://sendafun.com",
    "inLanguage": ["en","es","fr","pt"],
    "areaServed": [
      { "@type": "Country", "name": "US" },
      { "@type": "Country", "name": "GB" },
      { "@type": "Country", "name": "CA" },
      { "@type": "Country", "name": "FR" },
      { "@type": "Country", "name": "ES" },
      { "@type": "Country", "name": "MX" },
      { "@type": "Country", "name": "BR" }
    ],
    "potentialAction": {
      "@type": "SearchAction",
      "target": "https://sendafun.com/discover?q={search_term_string}",
      "query-input": "required name=search_term_string"
    }
  };
}

function getBreadcrumbList(items) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    "itemListElement": items.map((it, i) => ({
      "@type": "ListItem",
      "position": i + 1,
      "name": it.name,
      "item": it.item || undefined
    }))
  };
}

function getPricingJSONLD() {
  const AREA_SERVED = [
    { "@type": "Country", "name": "US" },
    { "@type": "Country", "name": "GB" },
    { "@type": "Country", "name": "CA" },
    { "@type": "Country", "name": "FR" },
    { "@type": "Country", "name": "ES" },
    { "@type": "Country", "name": "MX" },
    { "@type": "Country", "name": "BR" }
  ];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": "SendAFun · Group E-Cards & Subscriptions",
    "description": "Intent-driven social e-cards. Design in 30 seconds, invite friends to co-sign, send beautifully animated cards.",
    "brand": { "@type": "Brand", "name": "SendAFun" },
    "areaServed": AREA_SERVED,
    "inLanguage": ["en","es","fr","pt"],
    "url": "https://sendafun.com/pricing",
    "offers": [
      {
        "@type": "Offer",
        "name": "Pay per Send",
        "price": "1.99",
        "priceCurrency": "USD",
        "description": "Send a single, beautifully designed e-card.",
        "url": "https://sendafun.com/pricing",
        "areaServed": ["US","GB","CA","FR","ES","MX","BR"]
      },
      {
        "@type": "Offer",
        "name": "Monthly Unlimited",
        "price": "6.99",
        "priceCurrency": "USD",
        "description": "Unlimited sends every month, cancel anytime.",
        "url": "https://sendafun.com/pricing",
        "areaServed": ["US","GB","CA","FR","ES","MX","BR"]
      },
      {
        "@type": "Offer",
        "name": "Annual Unlimited",
        "price": "69.00",
        "priceCurrency": "USD",
        "description": "Best value — 12 months for the price of 10.",
        "url": "https://sendafun.com/pricing",
        "areaServed": ["US","GB","CA","FR","ES","MX","BR"]
      },
      {
        "@type": "Offer",
        "name": "Group Card Pass",
        "price": "4.99",
        "priceCurrency": "USD",
        "description": "50 co-signers, single-use group signature card.",
        "url": "https://sendafun.com/pricing",
        "areaServed": ["US","GB","CA","FR","ES","MX","BR"]
      }
    ],
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.9",
      "bestRating": "5",
      "reviewCount": "1200"
    }
  };
}

function getCardProductJSONLD(card) {
  if (!card || !card.slug) return null;
  const seo = card.seo || {};
  const AREA_SERVED = [
    { "@type": "Country", "name": "US" },
    { "@type": "Country", "name": "GB" },
    { "@type": "Country", "name": "CA" },
    { "@type": "Country", "name": "FR" },
    { "@type": "Country", "name": "ES" },
    { "@type": "Country", "name": "MX" },
    { "@type": "Country", "name": "BR" }
  ];
  return {
    "@context": "https://schema.org",
    "@type": "Product",
    "name": seo.title || card.title,
    "description": seo.description || card.defaultText,
    "image": card.ogImage || card.bgImage,
    "url": "https://sendafun.com/card/" + card.slug,
    "brand": { "@type": "Brand", "name": "SendAFun" },
    "areaServed": AREA_SERVED,
    "inLanguage": ["en","es","fr","pt"],
    "category": card.category,
    "keywords": (seo.keywords || card.tags || []).join(", "),
    "offers": {
      "@type": "Offer",
      "price": "1.99",
      "priceCurrency": "USD",
      "url": "https://sendafun.com/card/" + card.slug,
      "areaServed": ["US","GB","CA","FR","ES","MX","BR"],
      "availability": "https://schema.org/InStock"
    },
    "aggregateRating": {
      "@type": "AggregateRating",
      "ratingValue": "4.8",
      "bestRating": "5",
      "reviewCount": "100"
    }
  };
}

function formatDateNowPlus(offsetDays) {
  const d = new Date();
  d.setDate(d.getDate() + offsetDays);
  return d.toISOString().split("T")[0];
}

function getCategoryEmoji(slug) {
  const map = {
    anniversary: "💍", birthday: "🎂", christmas: "🎄",
    congratulations: "🎉", easter: "🐰", encouragement: "💪",
    "fathers-day": "👨", friendship: "🤝", "get-well": "💐",
    "good-luck": "🍀", graduation: "🎓", halloween: "🎃",
    love: "💕", "missing-you": "💭", "mothers-day": "👩",
    "new-baby": "👶", "new-year": "🎆", retirement: "🌴",
    sorry: "🥺", sympathy: "🕯️", "thank-you": "🙏",
    thanksgiving: "🦃", "thinking-of-you": "💗", valentine: "💘",
    wedding: "💐"
  };
  return map[slug] || "✉️";
}

// Doc §193 P0-7b: 25 categories clustered into semantic neighbourhood groups so
// a category page can show 6 relevant related category anchors. Returns a list
// of category slugs excluding the current one. Deterministic, never empty.
function getRelatedCategorySlugs(slug) {
  const GROUPS = [
    ["birthday", "anniversary", "wedding", "congratulations", "love", "valentine", "new-baby", "retirement"],
    ["christmas", "new-year", "easter", "halloween", "thanksgiving", "mothers-day", "fathers-day", "valentine"],
    ["thank-you", "friendship", "encouragement", "get-well", "good-luck", "thinking-of-you", "missing-you"],
    ["sorry", "sympathy", "get-well", "thinking-of-you", "thank-you", "encouragement"],
    ["graduation", "new-baby", "retirement", "congratulations", "thank-you", "wedding"]
  ];
  const bucket = GROUPS.find(g => g.indexOf(String(slug || "")) >= 0) || GROUPS[0];
  const out = bucket.filter(s => s !== slug);
  if (out.length >= 6) return out.slice(0, 6);
  const filler = ["birthday", "thank-you", "christmas", "anniversary", "love", "wedding", "graduation", "friendship"].filter(s => s !== slug && out.indexOf(s) < 0);
  return out.concat(filler).slice(0, 6);
}
const CATEGORY_GRADIENTS = {
  anniversary: ["#fbc2eb", "#a6c1ee"],
  birthday: ["#ffecd2", "#fcb69f"],
  christmas: ["#a1c4fd", "#c2e9fb", "#2e8b57"],
  congratulations: ["#f6d365", "#fda085"],
  easter: ["#fddb92", "#d1fdff"],
  encouragement: ["#84fab0", "#8fd3f4"],
  "fathers-day": ["#667eea", "#764ba2"],
  friendship: ["#f093fb", "#f5576c"],
  "get-well": ["#96e6a1", "#d4fc79"],
  "good-luck": ["#a8edea", "#fed6e3"],
  graduation: ["#89f7fe", "#66a6ff"],
  halloween: ["#f78ca0", "#f9748f", "#f35c3d"],
  love: ["#ff9a9e", "#fecfef"],
  "missing-you": ["#cfd9df", "#e2ebf0"],
  "mothers-day": ["#fccb90", "#d57eeb"],
  "new-baby": ["#a1c4fd", "#c2e9fb"],
  "new-year": ["#f6d365", "#fda085", "#ff6a88"],
  retirement: ["#d4fc79", "#96e6a1"],
  sorry: ["#ffecd2", "#fcb69f"],
  sympathy: ["#e0eafc", "#cfdef3"],
  "thank-you": ["#fddb92", "#d1fdff"],
  thanksgiving: ["#fcdf9e", "#f78ca0", "#c06c84"],
  "thinking-of-you": ["#fbc2eb", "#a6c1ee"],
  valentine: ["#ff758c", "#ff7eb3"],
  wedding: ["#fdfbfb", "#ebedee"]
};
function getCategoryGradient(cat) {
  const key = cat && typeof cat === "string" ? cat.trim().toLowerCase() : "";
  const colors = (key && CATEGORY_GRADIENTS[key]) ? CATEGORY_GRADIENTS[key] : ["#c3cfe2","#f5f7fa"];
  return "linear-gradient(135deg, " + colors.join(", ") + ")";
}
function layeredBackground(imageUrl, cat) {
  const grad = getCategoryGradient(cat);
  const safeUrl = typeof imageUrl === "string" && imageUrl ? imageUrl : "";
  if (safeUrl) {
    const quoted = '"' + safeUrl.replace(/(["\\])/g, '\\$1') + '"';
    return {
      backgroundImage: "url(" + quoted + "), " + grad,
      backgroundPosition: "center center, center center",
      backgroundSize: "cover, cover",
      backgroundRepeat: "no-repeat, no-repeat"
    };
  }
  return {
    backgroundImage: grad,
    backgroundPosition: "center center",
    backgroundSize: "cover",
    backgroundRepeat: "no-repeat"
  };
}

function escapeHtml(str) {
  if (str == null) return "";
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function splitTextToLines(text, maxPerLine = 50) {
  if (!text) return [];
  const hardLines = text.split("\n");
  const out = [];
  hardLines.forEach(line => {
    if (line.length <= maxPerLine) {
      out.push(line);
      return;
    }
    const words = line.split(" ");
    let cur = "";
    words.forEach(w => {
      const test = cur ? cur + " " + w : w;
      if (test.length <= maxPerLine) cur = test;
      else {
        if (cur) out.push(cur);
        cur = w;
      }
    });
    if (cur) out.push(cur);
  });
  return out;
}

function loadIntentFromStorage() {
  try {
    const raw = localStorage.getItem("saf_intent_state");
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") Object.assign(state.intent, saved);
  } catch (_) {
  }
}

function persistIntentState() {
  try {
    localStorage.setItem("saf_intent_state", JSON.stringify(state.intent));
  } catch (_) {
  }
}

function restoreIntentStateFromStorage() {
  try {
    const raw = localStorage.getItem("saf_intent_state");
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed && typeof parsed === "object") {
      if (typeof parsed.recipient === "string") state.intent.recipient = parsed.recipient;
      if (typeof parsed.occasion === "string") state.intent.occasion = parsed.occasion;
      if (typeof parsed.tone === "string") state.intent.tone = parsed.tone;
    }
  } catch (_) {
  }
}

function loadEditorFromStorage(slug) {
  try {
    const raw = localStorage.getItem("saf_editor_" + slug);
    if (!raw) return;
    const saved = JSON.parse(raw);
    if (saved && typeof saved === "object") Object.assign(state.editor, saved);
  } catch (_) {
  }
}

function persistEditorState(slug) {
  try {
    localStorage.setItem("saf_editor_" + slug, JSON.stringify(state.editor));
  } catch (_) {
  }
}

function resetEditorState(card) {
  state.editor = {
    fromName: "",
    toName: "",
    fromEmail: "",
    toEmail: "",
    defaultText: card && card.defaultText ? card.defaultText : "",
    sendDate: formatDateNowPlus(1),
    sendTime: "10:00",
    fontFamily: card && card.defaultFont ? card.defaultFont : FONT_FAMILIES[0],
    fontColor: card && card.defaultColor ? card.defaultColor : FONT_COLOR_PRESETS[0],
    backgroundColor: "#ffffff",
    accentColor: "#6366f1",
    fontSize: 24,
    letterSpacing: 0,
    lineHeight: 1.55,
    textMask: true,
    borderType: "none",
    activeStickerCat: "hearts",
    stickers: [],
    stickerZ: 10,
    envelopeSkin: "none"
  };
  state.flipped = false;
  state.activeTab = "message";
}

function installToast() {
  if (window.__safToastInstalled) return;
  window.__safToastInstalled = true;
  const stack = h("div", { class: "toast-stack", id: "toastStack" });
  document.body.appendChild(stack);

  window.toast = function (msg, type = "info") {
    if (!msg) return;
    const toastEl = h("div", { class: "toast glass " + type }, [String(msg)]);
    stack.appendChild(toastEl);
    setTimeout(() => {
      toastEl.style.transition = "opacity .25s, transform .25s";
      toastEl.style.opacity = "0";
      toastEl.style.transform = "translateX(20px)";
      setTimeout(() => toastEl.remove(), 260);
    }, 3500);
  };
}

function injectFooter() {
  const ph = document.getElementById("footerPlaceholder");
  if (!ph) return;
  if (ph.getAttribute("role") !== "contentinfo") ph.setAttribute("role", "contentinfo");
  if (ph.getAttribute("aria-label") !== "Site footer") ph.setAttribute("aria-label", "Site footer");
  const year = new Date().getFullYear();
  const parts = [t("footer_copy_prefix") + year + t("footer_copy_suffix")];
  FOOTER_LINKS.forEach(link => {
    const a = document.createElement("a");
    a.href = link.href;
    a.textContent = typeof link.label === "function" ? link.label() : String(link.label);
    if (link.ariaLabel) a.setAttribute("aria-label", link.ariaLabel);
    if (link.href.startsWith("/pricing") || link.href.startsWith("/group") || link.href.startsWith("/redeem")) {
      a.dataset.spa = "1";
    }
    parts.push(a.outerHTML);
  });
  const supportMail = document.createElement("a");
  supportMail.href = "mailto:support@sendafun.com?subject=Support%20for%20sendafun.com";
  supportMail.textContent = "support@sendafun.com";
  supportMail.setAttribute("aria-label", "Email sendafun support at support@sendafun.com");
  parts.push(t("footer_contact_prefix") + supportMail.outerHTML);
  ph.innerHTML = parts.join(" | ");
  ph.querySelectorAll("a[data-spa='1']").forEach(a => {
    a.addEventListener("click", e => {
      e.preventDefault();
      const url = a.getAttribute("href");
      history.pushState({}, "", url);
      renderRoute();
    });
  });
}

function injectCookieBanner() {
  const ph = document.getElementById("cookieBannerPlaceholder");
  if (!ph) return;
  try {
    if (localStorage.getItem("saf_cookie_consent")) return;
  } catch (_) {
  }
  ph.innerHTML = "";
  ph.setAttribute("aria-live", "polite");
  ph.setAttribute("role", "dialog");
  ph.setAttribute("aria-label", "Cookie consent GDPR banner");
  const banner = h("div", { class: "cookie-banner glass", id: "saf-cookie-banner" }, [
    h("div", { class: "cookie-text", style: { flex: 1 } }, [
      h("b", { style: { display: "inline-block", marginRight: "4px" } }, t("cookie_privacy_title")),
      t("cookie_privacy_body_1"),
      (() => {
        const p = document.createElement("a");
        p.href = "/privacy"; p.target = "_blank"; p.rel = "noopener noreferrer";
        p.textContent = t("cookie_privacy_policy"); p.dataset.spa = "0";
        return p;
      })(),
      t("cookie_privacy_body_2"),
      (() => {
        const c = document.createElement("a");
        c.href = "/cookies"; c.target = "_blank"; c.rel = "noopener noreferrer";
        c.textContent = t("cookie_policy");
        return c;
      })(),
      t("cookie_privacy_body_3")
    ]),
    h("div", { class: "cookie-row", style: { flexShrink: 0 } }, [
      h("button", {
        class: "btn btn-ghost",
        id: "rejectCookiesBtn",
        "aria-label": "Reject non-necessary cookies",
        onclick: () => handleCookieChoice("rejected")
      }, t("cookie_reject")),
      h("button", {
        class: "btn btn-primary",
        id: "acceptCookiesBtn",
        "aria-label": "Accept cookies and continue",
        style: { background: "linear-gradient(135deg,#10b981,#059669)" },
        onclick: () => handleCookieChoice("accepted")
      }, t("cookie_accept_all"))
    ])
  ]);
  ph.appendChild(banner);
}

function installCookieBanner() { injectCookieBanner(); }
function acceptCookies() { handleCookieChoice("accepted"); }

function handleCookieChoice(choice) {
  try {
    localStorage.setItem("saf_cookie_consent", choice);
  } catch (_) {
  }
  const banner = document.getElementById("saf-cookie-banner");
  if (!banner) return;
  banner.style.transition = "opacity .35s";
  banner.style.opacity = "0";
  setTimeout(() => banner.remove(), 360);
}

function attachGlobalNavLinks() {
  const nav = document.getElementById("topNav");
  if (!nav) return;
  nav.querySelectorAll("a").forEach(a => {
    const href = a.getAttribute("href") || "";
    if (href.startsWith("http")) return;
    if (href.startsWith("#/")) {
      a.setAttribute("href", href.replace(/^#\//, "/"));
    }
    const finalHref = a.getAttribute("href") || "";
    if (finalHref.startsWith("/") && !finalHref.includes(".html")) {
      a.addEventListener("click", e => {
        e.preventDefault();
        history.pushState({}, "", finalHref);
        renderRoute();
      });
    } else if (finalHref.startsWith("/about") || finalHref.startsWith("/contact") ||
               finalHref.startsWith("/privacy") || finalHref.startsWith("/terms") ||
               finalHref.startsWith("/cookies")) {
      a.addEventListener("click", e => {
        e.preventDefault();
        window.location.href = finalHref;
      });
    }
  });
  const setTextIfFound = (selector, textKey, fallback, addArrow) => {
    const el = nav.querySelector(selector);
    if (!el) return;
    try {
      let val = t(textKey, fallback || "");
      if (!val) return;
      val = val.replace(/→$/, "").trim();
      el.textContent = addArrow ? val + " →" : val;
    } catch (_) {}
  };
  setTextIfFound('a[href="/discover"].nav-link', "nav_discover", "Discover", false);
  setTextIfFound('a[href="/pricing"].nav-link', "nav_pricing", "Pricing", false);
  setTextIfFound('a[href="/about"].nav-link', "nav_about", "About", false);
  setTextIfFound('a[href="/contact"].nav-link', "nav_contact", "Contact", false);
  const memberA = nav.querySelectorAll('a[href="/pricing"].nav-link');
  if (memberA && memberA[1]) {
    try { memberA[1].textContent = t("nav_member", "💎 Member"); } catch (_) {}
  }
  const ctaBtn = nav.querySelector('a[href="/create"].nav-cta');
  if (ctaBtn) {
    try { ctaBtn.textContent = t("common_send_free", "Send a Free Card →"); } catch (_) {}
  }
  const skip = document.querySelector('a.skip-link');
  if (skip && skip.childNodes.length <= 1) {
    try { skip.textContent = t("nav_skip", "Skip to main content"); } catch (_) {}
  }
  const langLabel = document.querySelector('label[for="safLangPicker"]');
  if (langLabel) {
    const hasText = Array.prototype.some.call(langLabel.childNodes, n => n.nodeType === 3 && n.nodeValue && n.nodeValue.trim().length > 0);
    if (!hasText) {
      const txt = document.createTextNode(t("nav_lang_label", "Language") + " ");
      const firstChild = langLabel.firstChild;
      if (firstChild) langLabel.insertBefore(txt, firstChild);
      else langLabel.appendChild(txt);
    }
  }
}

function loadMetaAndBoot() {
  if (!window.toast) installToast();
  window.CARDS = window.CARDS || [];
  window.ALL_CARDS = window.ALL_CARDS || null;
  window.__D1 = window.__D1 || {
    listCache: {},
    detailCache: {},
    searchCache: {},
    pageSize: 24,
  };
  window.toast(t("toast_load_meta"), "info");
  const p1 = Promise.resolve({ ok: true });
  const p2 = fetch("/products.json").then(r => {
    if (!r.ok) throw new Error("products.json fetch failed");
    return r.json();
  });
  Promise.all([p1, p2]).then(([_, productsData]) => {
    window.PRODUCTS = Array.isArray(productsData) ? productsData : (productsData.products || []);
    // Fetch ALL cards once for accurate real-template category counts (capped)
    try {
      const statsUrl = new URL("/api/cards", API_ORIGIN);
      statsUrl.searchParams.set("page", "1");
      statsUrl.searchParams.set("size", "5000");
      fetch(statsUrl.toString()).then(r => r.ok ? r.json() : null).then(function(j){
        if (j && Array.isArray(j.cards)) {
          window.ALL_CARDS = j.cards.slice(0, 5000);
          try {
            // Re-render current route so category counts refresh (home / intent)
            renderRoute();
            renderOccasionChips();
          } catch (_) {}
        }
      }).catch(function(){});
    } catch (_) {}
    if (!window.toast) installToast();
    window.toast(t("toast_ready"), "success");
    if (!window.CARDS_LOADED) {
      window.CARDS_LOADED = true;
      try { renderRoute(); } catch (_) {}
    }
  }).catch(e => {
    if (!window.toast) installToast();
    window.toast(t("toast_network_err") + e.message, "error");
  });
}

async function d1FetchCards(params) {
  const { category, style, sort, q, page, size, append, targetGrid } = params;
  const pageSize = size || window.__D1.pageSize;
  const p = Math.max(1, page || 1);
  const cacheKey = JSON.stringify({ category, style, sort, q, p, pageSize });
  const cache = q ? window.__D1.searchCache : window.__D1.listCache;
  if (!append && cache[cacheKey]) return cache[cacheKey];

  const url = new URL(q ? "/api/cards/search" : "/api/cards", API_ORIGIN);
  if (q) url.searchParams.set("q", q);
  if (category) url.searchParams.set("category", category);
  if (style) url.searchParams.set("style", style);
  if (sort) url.searchParams.set("sort", sort);
  url.searchParams.set("page", String(p));
  url.searchParams.set("size", String(pageSize));

  const r = await fetch(url.toString());
  if (!r.ok) throw new Error(`D1 API HTTP ${r.status}`);
  const j = await r.json();

  /* --------------------------------------------------------
   * Doc §12.5 call-site stubs — filled bodies ship in v1.2.
   * TODAY:  GeoFestivalTargetingSort is identity passthrough
   *         GeoMarketingBanner   returns {enabled:false}
   * Both are pure no-ops for v1.1 launch (zero visible change).
   * -------------------------------------------------------- */
  const cc = _saferCountryCode();
  if (Array.isArray(j?.cards)) {
    try {
      j.cards = window.SAF_SLOTS.GeoFestivalTargetingSort(j.cards, cc, 6);
    } catch (_) { /* reserved slot must never break render */ }
  }
  try {
    const banner = window.SAF_SLOTS.GeoMarketingBanner(cc);
    if (banner?.enabled && !window.__SAF_BANNER_INJECTED) {
      /* Phase 2: mount banner into the slot div with id="saf-marketing-slot";
       * today enabled=false  →  never mounts, idempotent. */
      window.__SAF_BANNER_INJECTED = banner;
    }
  } catch (_) { /* reserved slot must never break render */ }

  cache[cacheKey] = j;
  return j;
}

function cacheCardInWindow(card) {
  if (!card || !card.slug) return;
  if (card.bgImage) card.bgImage = _imgUrl(card.bgImage);
  if (card.bgImageWatermark) card.bgImageWatermark = _imgUrl(card.bgImageWatermark);
  if (card.ogImage) card.ogImage = _imgUrl(card.ogImage);
  if (card.coverImage) card.coverImage = _imgUrl(card.coverImage);
  if (card.thumbnail) card.thumbnail = _imgUrl(card.thumbnail);
  if (card.image) card.image = _imgUrl(card.image);
  window.__D1.detailCache[card.slug] = card;
  if (!window.CARDS.find(c => c.slug === card.slug)) window.CARDS.push(card);
}

function parseRouteParams() {
  let path = location.pathname || "/";
  const search = location.search || "";
  const params = new URLSearchParams(search);
  return { path, params };
}

function _stripLangPrefix(path) {
  const p = String(path || "/");
  const m = p.match(/^\/(en|es|fr|pt)(\/.*|\/?)$/i);
  return m ? (m[2] || "/") : p;
}

function renderEnvelopeSharePage({ token, skinId, fromName, toName }) {
  envelopeStylesInject();
  if (!window.toast) installToast();
  const skin = ENVELOPE_SKINS.find(s => s.id === skinId) || ENVELOPE_SKINS[0];
  const safeSkin = skin.id;
  let fetchedCard = null;
  let loaded = false;
  const titleText = (toName ? (toName + "，") : "") + "你有一封新的信件 ✉️";
  const subText = fromName ? ("来自 " + fromName + " 的专属祝福，点击下方按钮拆封 👇") : "点击下方按钮拆封信件 👇";
  const page = h("div", { class: "envelope-share-page" }, [
    h("div", {
      style: {
        width: "100%",
        maxWidth: "560px",
        display: "flex",
        flexDirection: "column",
        alignItems: "center"
      }
    }, [
      h("div", { class: "envelope-share-title" }, titleText),
      h("div", { class: "envelope-share-sub" }, subText),
      h("div", { id: "shareEnvelopeWrap", style: { width: "100%" } }),
      h("div", {
        id: "shareCardReveal",
        style: {
          display: "none",
          width: "100%",
          marginTop: "2rem",
          padding: "1.25rem",
          background: "#fff",
          borderRadius: "1.25rem",
          boxShadow: "0 20px 60px rgba(15,23,42,0.15)",
          animation: "envContentFade 0.8s ease-out forwards"
        }
      }, [
        h("div", {
          style: {
            fontFamily: "'Playfair Display', serif",
            fontSize: "1.25rem",
            fontWeight: 700,
            color: "#1e1b4b",
            marginBottom: "0.75rem"
          }
        }, "💌 你的专属卡片"),
        h("div", { id: "shareCardContent", style: { color: "#374151", lineHeight: 1.7 } }, "加载中…")
      ]),
      h("div", { style: { marginTop: "1.5rem", textAlign: "center" } }, [
        h("a", {
          href: "/",
          style: {
            color: "#6b7280",
            fontSize: "0.85rem",
            textDecoration: "none"
          },
          onclick: function (e) {
            e.preventDefault();
            history.pushState({}, "", "/");
            renderRoute();
          }
        }, "← 返回 SendAFun 首页")
      ])
    ])
  ]);
  clearApp();
  const app = document.getElementById("app");
  if (app) app.appendChild(page);
  const dummyCard = {
    title: token ? "Link #" + token : "A Special Card For You",
    bgImage: "",
    defaultText: (state.editor?.defaultText && state.editor.defaultText.length > 0)
      ? state.editor.defaultText
      : "这是一封精心准备的祝福卡片 ✨\n\n（由于外链分享页面为静态演示，真实发送时需通过 Schedule & Send 生成）"
  };
  const envAnim = renderEnvelopeAnimation(dummyCard, { skin: safeSkin, playOnce: false, previewMode: false });
  const envHost = document.getElementById("shareEnvelopeWrap");
  if (envHost && envAnim) {
    envHost.innerHTML = "";
    envHost.appendChild(envAnim);
    const openBtn = envHost.querySelector(".envelope-open-btn");
    if (openBtn) {
      const origListener = openBtn.onclick || openBtn.getAttribute("onclick");
      openBtn.addEventListener("click", function () {
        setTimeout(() => {
          const reveal = document.getElementById("shareCardReveal");
          const content = document.getElementById("shareCardContent");
          if (reveal) reveal.style.display = "block";
          if (content) {
            const e = state.editor || {};
            const msgHtml = (e.defaultText || dummyCard.defaultText)
              .replace(/\n/g, "<br>");
            content.innerHTML = [
              e.toName ? '<div style="margin-bottom:0.5rem;color:#6d28d9;font-weight:700;">致 ' + escapeHtml(e.toName) + '：</div>' : "",
              '<div style="margin-bottom:1rem;">' + msgHtml + '</div>',
              e.fromName ? '<div style="text-align:right;color:#6b7280;font-style:italic;">—— ' + escapeHtml(e.fromName) + '</div>' : ""
            ].join("");
          }
          try { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); } catch (_) {}
        }, 1400);
      });
    }
  }
  if (token) {
    fetch(API_BASE + "/share/e/" + encodeURIComponent(token), { method: "GET" })
      .then(r => r.ok ? r.json() : null)
      .then(data => {
        if (!data || !data.card) return;
        fetchedCard = data.card;
        loaded = true;
        if (data.envelope_skin && ENVELOPE_SKINS.find(s => s.id === data.envelope_skin)) {
          const wrap = document.getElementById("shareEnvelopeWrap");
          if (wrap) {
            wrap.innerHTML = "";
            const newAnim = renderEnvelopeAnimation(fetchedCard, { skin: data.envelope_skin, playOnce: false, previewMode: false });
            if (newAnim) wrap.appendChild(newAnim);
            const openBtn2 = wrap.querySelector(".envelope-open-btn");
            if (openBtn2) {
              openBtn2.addEventListener("click", function () {
                setTimeout(() => {
                  const reveal = document.getElementById("shareCardReveal");
                  const content = document.getElementById("shareCardContent");
                  if (reveal) reveal.style.display = "block";
                  if (content) {
                    const msgHtml = (fetchedCard.default_text || fetchedCard.message || "✨ ✨ ✨")
                      .replace(/\n/g, "<br>");
                    content.innerHTML = [
                      fetchedCard.to_name ? '<div style="margin-bottom:0.5rem;color:#6d28d9;font-weight:700;">致 ' + escapeHtml(fetchedCard.to_name) + '：</div>' : "",
                      '<div style="margin-bottom:1rem;">' + msgHtml + '</div>',
                      fetchedCard.from_name ? '<div style="text-align:right;color:#6b7280;font-style:italic;">—— ' + escapeHtml(fetchedCard.from_name) + '</div>' : ""
                    ].join("");
                  }
                  try { window.scrollTo({ top: document.body.scrollHeight, behavior: "smooth" }); } catch (_) {}
                }, 1400);
              });
            }
          }
        }
        if (fetchedCard.to_name) document.querySelector(".envelope-share-title").textContent = fetchedCard.to_name + "，你有一封新的信件 ✉️";
        if (fetchedCard.from_name) document.querySelector(".envelope-share-sub").textContent = "来自 " + fetchedCard.from_name + " 的专属祝福，点击下方按钮拆封 👇";
      })
      .catch(() => {});
  }
}

function escapeHtml(str) {
  return String(str || "").replace(/[&<>"']/g, function (c) {
    return ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c] || c;
  });
}

function renderRoute() {
  const raw = parseRouteParams();
  const path = _stripLangPrefix(raw.path);
  const params = raw.params;
  loadIntentFromStorage();

  const hashEnvelopeMatch = (typeof location !== "undefined" && location.hash)
    ? location.hash.match(/envelope=([a-z0-9_\-]+)/i)
    : null;
  if (hashEnvelopeMatch) {
    const skin = hashEnvelopeMatch[1] || "none";
    const qsFrom = params.get("from");
    const qsTo = params.get("to");
    renderEnvelopeSharePage({ token: null, skinId: skin, fromName: qsFrom, toName: qsTo });
    return;
  }

  const envelopeMatch = path.match(/^\/e\/([a-zA-Z0-9\-_]+)$/);
  if (envelopeMatch) {
    const token = envelopeMatch[1];
    const qSkin = params.get("skin") || "rose_gold";
    const qsFrom = params.get("from");
    const qsTo = params.get("to");
    setPageTitle("✉️ 你有一封来自 SendAFun 的信");
    updateMetaDescription("点击拆封这张专属电子贺卡，来自朋友的温暖祝福。");
    updateCanonical(path);
    updateOGTags({
      title: "✉️ You've Got a Card · SendAFun",
      description: "Open your personalised animated greeting card.",
      type: "article",
      url: location.href
    });
    renderEnvelopeSharePage({ token: token, skinId: qSkin, fromName: qsFrom, toName: qsTo });
    installGlobalUtilities();
    return;
  }

  const cardMatch = path.match(/^\/card\/([a-z0-9\-_]+)$/i);
  const groupMatch = path.match(/^\/group\/([a-zA-Z0-9]+)$/);
  const redeemMatch = path.match(/^\/redeem\/([a-zA-Z0-9]+)$/);

  const simplePath = path.replace(/\/+$/, "") || "/";
  const catSlug = simplePath.startsWith("/") ? simplePath.slice(1) : simplePath;
  const isCategoryPage = Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, catSlug);

  injectJSONLD("ld-org", getOrgJSONLD());
  injectJSONLD("ld-site", getWebSiteJSONLD());

  if (simplePath === "/" || simplePath === "/index.html" || simplePath === "") {
    setPageTitle("SendAFun 2.0 · Intent-Driven Social E-Cards");
    updateMetaDescription("Design personalised group e-cards in 30 seconds. Invite friends to co-sign, gift subscriptions, send beautifully animated cards. Free preview, no signup.");
    setMetaKeywords(["send ecard online", "group e-card", "birthday card", "animated greeting card", "personalized ecards", "SendAFun"]);
    updateCanonical("/");
    updateOGTags({
      title: "SendAFun 2.0 · Intent-Driven Social E-Cards",
      description: "Design personalised group e-cards in 30 seconds. Invite friends to co-sign, gift subscriptions, send beautifully animated cards. Free preview, no signup.",
      type: "website",
      url: "https://sendafun.com/",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" }
    ]));
    renderHome();
    attachPostRenderHooks();
  } else if (simplePath.startsWith("/discover")) {
    setPageTitle("Discover 250+ E-Card Templates · SendAFun");
    updateMetaDescription("Browse 250+ personalised e-card templates filtered by recipient, occasion, and tone. Free instant preview, $1.99 per send or unlimited from $6.99/month.");
    setMetaKeywords(["ecard templates", "greeting card designs", "birthday ecards", "christmas ecards", "wedding cards", "thank you cards online"]);
    updateCanonical("/discover");
    updateOGTags({
      title: "Discover 250+ E-Card Templates · SendAFun",
      description: "Browse 250+ personalised e-card templates filtered by recipient, occasion, and tone. Free instant preview.",
      url: "https://sendafun.com/discover",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "Discover All Cards", item: "https://sendafun.com/discover" }
    ]));
    renderDiscover(params);
    installGlobalUtilities();
    setTimeout(() => renderDiscoverExtraToolbar(params), 50);
  } else if (simplePath === "/trending" || simplePath === "/latest" || simplePath === "/holidays" || simplePath === "/message-generator") {
    const routeConfig = {
      "/trending": {
        title: "Trending E-Cards · Most Popular This Week · SendAFun",
        desc: "Browse the most popular e-cards trending this week. Birthday, love, thank-you and more — see what other people are sending today.",
        extra: { sort: "trending" }
      },
      "/latest": {
        title: "New & Latest E-Card Templates · SendAFun",
        desc: "Fresh from our designers — the latest e-card templates added this week. Perfect for upcoming birthdays, holidays, and just-because wishes.",
        extra: { sort: "latest" }
      },
      "/holidays": {
        title: "Holiday E-Cards · Christmas, Valentine, Easter + More · SendAFun",
        desc: "Holiday e-cards for every celebration: Christmas, Valentine's Day, Mother's Day, Father's Day, Easter, Halloween, Thanksgiving and New Year.",
        extra: { cat: "holidays" }
      },
      "/message-generator": {
        title: "E-Card Message Generator · Free AI Writing Ideas · SendAFun",
        desc: "Stuck on what to write? Get heartfelt, funny, and warm message ideas for any card — birthday, love, sympathy, thank-you, and more.",
        extra: {}
      }
    };
    const cfg = routeConfig[simplePath] || routeConfig["/trending"];
    setPageTitle(cfg.title);
    updateMetaDescription(cfg.desc);
    updateCanonical(simplePath);
    setMetaKeywords(["greeting card messages", "what to write in a card", "card sayings", "message generator", "ecard messages"]);
    updateOGTags({ title: cfg.title, description: cfg.desc, url: "https://sendafun.com" + simplePath });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: simplePath === "/message-generator" ? "Message Generator" : cfg.title.split(" · ")[0], item: "https://sendafun.com" + simplePath }
    ]));
    const mergedParams = new URLSearchParams(params.toString());
    Object.entries(cfg.extra || {}).forEach(([k, v]) => { if (!mergedParams.has(k)) mergedParams.set(k, v); });
    renderDiscover(mergedParams);
    installGlobalUtilities();
    setTimeout(() => renderDiscoverExtraToolbar(mergedParams), 50);
  } else if (isCategoryPage) {
    const catKey = catSlug;
    const catLabel = CATEGORY_LABELS[catKey];
    const allCards = window.CARDS || [];
    const count = allCards.filter(c => c.category === catKey).length;
    const catEmoji = getCategoryEmoji(catKey);
    const title = `${catEmoji} ${catLabel} E-Cards · ${count} Personalized Templates · SendAFun`;
    const desc = `Browse ${count} beautiful ${catLabel.toLowerCase()} e-card templates. Personalize with your own message, pick fonts & colors, preview for free — send instantly from $1.99.`;
    setPageTitle(title);
    updateMetaDescription(desc);
    setMetaKeywords([
      `${catLabel.toLowerCase()} card`, `${catLabel.toLowerCase()} ecard`,
      `personalized ${catLabel.toLowerCase()} greeting`, `send ${catLabel.toLowerCase()} card online`
    ]);
    updateCanonical(simplePath);
    updateOGTags({
      title, description: desc, type: "website",
      url: "https://sendafun.com" + simplePath,
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: catLabel + " E-Cards", item: "https://sendafun.com/" + catKey }
    ]));
    const mergedParams = new URLSearchParams(params.toString());
    if (!mergedParams.has("cat")) mergedParams.set("cat", catKey);
    renderDiscover(mergedParams);
    installGlobalUtilities();
    setTimeout(() => renderDiscoverExtraToolbar(mergedParams), 50);
  } else if (cardMatch) {
    renderEditor(cardMatch[1]);
    attachPostRenderHooks();
  } else if (groupMatch) {
    const groupUrl = "https://sendafun.com" + simplePath;
    setPageTitle("Group Card · Add Your Signature · SendAFun");
    updateMetaDescription("Join this group card — add your personal signature and message for the recipient. Share the link with friends to collect 50+ co-signers.");
    updateCanonical(simplePath);
    updateOGTags({
      title: "Group Card · Sign & Send Together · SendAFun",
      description: "Join this group card — add your signature for the recipient. 50+ co-signers supported.",
      type: "article",
      url: groupUrl,
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "Group Signature Card" }
    ]));
    renderGroupSign(groupMatch[1]);
    installGlobalUtilities();
  } else if (redeemMatch) {
    const giftUrl = "https://sendafun.com" + simplePath;
    setPageTitle("Redeem Your SendAFun Gift · Activate Subscription");
    updateMetaDescription("Redeem your gift subscription from a friend. Monthly or annual all-access pass to every SendAFun e-card template — activation takes 10 seconds.");
    updateCanonical(simplePath);
    updateOGTags({
      title: "🎁 Redeem Your SendAFun Gift Subscription",
      description: "Activate your gifted monthly or annual pass — unlimited access to every e-card design.",
      type: "article",
      url: giftUrl,
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    renderGiftRedeem(redeemMatch[1]);
    installGlobalUtilities();
  } else if (simplePath === "/pricing") {
    setPageTitle("Pricing · Free Preview, $1.99/Send, $6.99/Mo Unlimited · SendAFun");
    updateMetaDescription("Simple pricing: free unlimited design & preview, $1.99 per send, $6.99/month unlimited sends, $69/year best value, plus $4.99 group card pass. Cancel anytime.");
    setMetaKeywords(["SendAFun pricing", "ecard subscription", "send cards online cost", "best greeting card subscription", "cheap ecards"]);
    updateCanonical("/pricing");
    updateOGTags({
      title: "Pricing · $1.99 Send or $6.99/Month Unlimited · SendAFun",
      description: "Simple pricing: free design & preview, $1.99 per send, $6.99/month unlimited, $69/year best value.",
      type: "product",
      url: "https://sendafun.com/pricing",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-product", getPricingJSONLD());
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "Pricing", item: "https://sendafun.com/pricing" }
    ]));
    renderPricing();
    installGlobalUtilities();
  } else if (["/signin", "/signup", "/login", "/account"].includes(simplePath)) {
    if (!window.toast) installToast();
    window.toast(
      "🛡️ Guest-first product — no account needed. Your designs, drafts and gift codes are saved locally in your browser. View member plans below →",
      "success"
    );
    history.replaceState({}, "", "/pricing");
    setPageTitle("Pricing & Plans · SendAFun 2.0");
    updateMetaDescription("SendAFun pricing: free forever, or upgrade for group signature walls, beautiful fonts, HD stickers, unlimited sends and gift subscriptions.");
    updateCanonical("/pricing");
    updateOGTags({
      title: "Pricing & Plans · SendAFun 2.0",
      description: "Free forever design, preview and send — or upgrade for group signatures, premium fonts, HD stickers, unlimited sends and gift plans.",
      type: "product",
      url: "https://sendafun.com/pricing",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-product", getPricingJSONLD());
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "Pricing", item: "https://sendafun.com/pricing" }
    ]));
    renderPricing();
    installGlobalUtilities();
  } else if (simplePath === "/about") {
    setPageTitle("About · SendAFun — E-Cards Made Warm, Human & Effortless");
    updateMetaDescription("SendAFun is a small studio on a mission to make digital greetings feel human again. 250+ beautiful e-cards, instant personalization, no account required.");
    setMetaKeywords(["about SendAFun", "who we are greeting cards", "human-centric ecard startup", "SendAFun story"]);
    updateCanonical("/about");
    updateOGTags({
      title: "About SendAFun — Warm, human, effortless e-cards",
      description: "Small studio on a mission to make digital greetings feel human again. 250+ designs, free instant preview.",
      type: "profile",
      url: "https://sendafun.com/about",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "About", item: "https://sendafun.com/about" }
    ]));
    injectJSONLD("ld-org", getOrganizationJSONLD());
    renderAbout();
    installGlobalUtilities();
  } else if (simplePath === "/contact") {
    setPageTitle("Contact · SendAFun Support & Press — We Reply in 4 Hours");
    updateMetaDescription("Need help with a card? Want custom templates for your brand? Email support@sendafun.com or use the live form below. Friendly humans reply in under 4 hours every day.");
    setMetaKeywords(["SendAFun support", "contact SendAFun", "custom corporate ecards", "press inquiry greeting cards"]);
    updateCanonical("/contact");
    updateOGTags({
      title: "Contact SendAFun — We reply in under 4 hours",
      description: "Friendly human support. Email support@sendafun.com or fill the form.",
      type: "website",
      url: "https://sendafun.com/contact",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "Contact", item: "https://sendafun.com/contact" }
    ]));
    renderContact();
    installGlobalUtilities();
  } else if (simplePath === "/create") {
    setPageTitle("Create Your Own Card · Blank Custom Greeting From Scratch · SendAFun");
    updateMetaDescription("Start from a blank canvas and create your own fully custom greeting card online in 60 seconds. Pick any background, font, color, add stickers, invite co-signers — free preview, no signup.");
    setMetaKeywords(["create your own card", "custom greeting card maker", "blank ecard template", "design own card online", "personalized card from scratch"]);
    updateCanonical("/create");
    updateOGTags({
      title: "Create Your Own Custom Card · Blank Canvas Start · SendAFun",
      description: "Design a 100% custom card from scratch. Any background, font, color, stickers, group signatures. Free preview, send instantly from $1.99.",
      type: "website",
      url: "https://sendafun.com/create",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: "Create Your Own Card", item: "https://sendafun.com/create" }
    ]));
    renderCreate();
    attachPostRenderHooks();
  } else {
    setPageTitle("404 · Page not found · SendAFun");
    updateMetaDescription("Sorry, the page you're looking for doesn't exist. Browse our 250+ e-card templates or go back home.");
    updateCanonical("/404");
    updateOGTags({
      title: "404 · Page not found · SendAFun",
      description: "Page not found. Browse 250+ e-card templates or go back home.",
      image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    if (!window.statusCodeSet) {
      const meta = document.createElement("meta");
      meta.name = "prerender-status-code"; meta.content = "404";
      document.head.appendChild(meta);
      window.statusCodeSet = true;
    }
    renderNotFound();
  }
}

const DEFAULT_BLANK_CARD = {
  slug: "create-your-own-blank-card-from-scratch-sendafun-default-v1",
  title: "Create Your Own Card · Blank Custom Greeting From Scratch",
  category: "birthday",
  tags: ["create your own", "blank canvas", "custom card"],
  style: "warm",
  bgImage: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp",
  bgImageWatermark: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp",
  defaultText: "",
  defaultFont: "'Inter', sans-serif",
  defaultColor: "#1a1a1a",
  defaultFilter: "classic",
  aspectRatio: "3/4",
  ogImage: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp",
  seo: {
    title: "Create Your Own Card · Blank Custom Greeting From Scratch · SendAFun",
    description: "Start from a blank canvas and create your own fully custom greeting card online in 60 seconds. Pick any background, font, color, add stickers, invite co-signers — free preview, no signup.",
    h1: "Create Your Own Fully Custom Card From Scratch",
    keywords: ["create your own card", "custom greeting card maker", "blank ecard template", "design own card online", "personalized card from scratch", "online card designer"],
    intro_text: "Want to design something 100% unique? Our blank card creator gives you complete creative control. Start with a clean canvas, swap in any background from our 250+ template library, pick your favorite fonts and colors, drop stickers and emojis, write your own heartfelt message, and even invite friends to add their signatures in our group mode. Preview everything for free — only pay when you're ready to send, starting at $1.99 per card or $6.99/month for unlimited sends and full access to every template and feature.\n\nHow it works: 1. Choose a starter background or upload your own image. 2. Type your custom message — switch between 6 beautiful fonts and unlimited colors anytime. 3. Decorate with premium stickers, emoji and animations. 4. Optional: switch on group mode to collect signatures from 50+ friends and family. 5. Preview the final animated card, schedule delivery, and send instantly to any email inbox. No account, no watermarks, no hidden fees — just beautiful digital cards delivered with love.\n\nPricing: Blank card creation and unlimited previews are 100% free forever. Send a single custom card for just $1.99, or unlock unlimited sends, all premium templates, group signature walls, HD stickers and gift subscriptions with our all-access pass at $6.99/month (best for people who send 2+ cards a month) or $69/year (save 2 months free). Cancel anytime with one click.",
    og_image: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
  }
};

function renderCreate() {
  const BLANK_SLUG = DEFAULT_BLANK_CARD.slug;
  if (!Array.isArray(window.CARDS)) window.CARDS = [];
  const alreadyInjected = window.CARDS.some(function(c) { return c && c.slug === BLANK_SLUG; });
  if (!alreadyInjected) window.CARDS.unshift(DEFAULT_BLANK_CARD);
  renderEditor(BLANK_SLUG);
}

const HOME_CAROUSEL_SLIDES = [
  { cat: "Birthday",            title: "Happy Birthday Card for Dad",             desc: "Dad, thank you for everything. Happy birthday! 🎉",                              img: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp",            action: { cat: "birthday" } },
  { cat: "Congratulations",     title: "Congratulations Graduation Card",          desc: "Your hard work paid off. Congratulations graduate! 🎓🎉",                        img: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/congratulations/congratulations-pexels-4439442-v2-vertical.webp", action: { cat: "congratulations" } },
  { cat: "Encouragement",       title: "Cheer Up Card for Best Friend",            desc: "Tough day? You've got this! Always here for you. 💪✨",                          img: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/encouragement/encouragement-pexels-4466104-v2-vertical.webp",   action: { cat: "encouragement" } },
  { cat: "Love & Romance",      title: "Romantic Love Card for Partner",           desc: "Every love story is beautiful, but ours is my favorite. 💕",                      img: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/love/love-pexels-7679697-v2-vertical.webp",                 action: { cat: "love" } },
  { cat: "Thank You",           title: "Thank You Card for a Friend",              desc: "Just wanted to say thank you for being you! 🌟",                                  img: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/thank-you/thank-you-pexels-4386503-v2-vertical.webp",          action: { cat: "thank-you" } },
  { cat: "Get Well",            title: "Get Well Soon Card",                       desc: "Sending healing thoughts your way. Get well soon! 🌸",                            img: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/get-well/get-well-pexels-5706031-v2-vertical.webp",             action: { cat: "get-well" } }
];

function renderHome() {
  clearApp();
  const container = h("div", { class: "home-page fade-in" }, [
    renderHeroSection(),
    renderIntentEngine(),
    renderBrowseCategories()
  ]);
  mountApp(container);
  attachHomeEventListeners();
}

function renderHeroSection() {
  const slidesEl = HOME_CAROUSEL_SLIDES.map((s, i) => h("div", {
    class: "hero-carousel-slide" + (i === 0 ? " active" : ""),
    "data-slide": i
  }, [
    h("div", { class: "hero-carousel-bg", style: { backgroundImage: "url(" + _imgUrl(s.img) + ")" } }),
    h("div", { class: "hero-carousel-overlay" }),
    h("div", { class: "hero-carousel-content" }, [
      h("div", { class: "hero-carousel-cat" }, s.cat),
      h("h2",  { class: "hero-carousel-title" }, s.title),
      h("p",   { class: "hero-carousel-desc" }, s.desc),
      h("button", {
        class: "hero-carousel-cta",
        "data-cat": s.action.cat,
        "data-slide-cta": i
      }, [t("common_customise")])
    ])
  ]));
  const dotsEl = HOME_CAROUSEL_SLIDES.map((_, i) => h("button", {
    class: "hero-carousel-dot" + (i === 0 ? " active" : ""),
    "data-dot": i,
    "aria-label": t("common_slide") + (i + 1)
  }));
  const arrowsEl = h("div", { class: "hero-carousel-arrows" }, [
    h("button", { class: "hero-carousel-arrow", "data-dir": "prev", "aria-label": t("common_previous") }, ["‹"]),
    h("button", { class: "hero-carousel-arrow", "data-dir": "next", "aria-label": t("common_next") },     ["›"])
  ]);

  return h("section", { class: "hero" }, [
    h("div", { class: "hero-intro" }, [
      h("h1", {}, [
        t("hero_title_a"),
        h("em", { style: { fontStyle: "normal", fontFamily: "'Dancing Script', cursive", color: "var(--saf-accent)" } }, t("hero_title_b"))
      ]),
      h("p", { class: "hero-tagline" }, t("hero_tagline")),
      h("div", { class: "hero-stats" }, [
        h("div", { class: "hero-stat glass" }, [h("b", {}, "250+"), t("hero_stat_templates")]),
        h("div", { class: "hero-stat glass" }, [h("b", {}, "50"), t("hero_stat_sigs")]),
        h("div", { class: "hero-stat glass" }, [h("b", {}, "25"), t("hero_stat_cats")])
      ]),
      h("div", { class: "hero-cta-row mt-3" }, [
        h("button", { class: "btn btn-primary", id: "heroStartBtn" }, [t("common_start")]),
        h("button", { class: "btn btn-ghost",   id: "heroPricingBtn" }, [t("common_see_pricing")])
      ])
    ]),
    h("div", { class: "hero-mock" }, [
      h("div", { class: "hero-carousel", id: "heroCarousel" }, [
        ...slidesEl,
        arrowsEl,
        h("div", { class: "hero-carousel-dots" }, dotsEl)
      ])
    ])
  ]);
}

function renderBrowseCategories() {
  const cards = window.CARDS || [];
  const catCards = OCCASION_OPTIONS.map(opt => {
    const count = _realCatCount(cards, opt.slug);
    const labelStr = typeof opt.label === "function" ? opt.label() : String(opt.label);
    return h("div", {
      class: "browse-card",
      "data-browse-cat": opt.slug,
      title: t("common_browse_all_prefix") + labelStr + t("common_browse_all_suffix")
    }, [
      h("div", { class: "browse-icon" }, getCategoryEmoji(opt.slug)),
      h("div", { class: "browse-label" }, labelStr),
      h("div", { class: "browse-count" }, (count || 0) + t("common_count_suffix"))
    ]);
  });
  const realCount = _safeTotal(_realTotalCount(cards) || MAX_REAL_TEMPLATES);
  return h("section", { class: "browse-section" }, [
    h("div", { class: "browse-header" }, [
      h("div", {}, [
        h("h2", { class: "browse-title" }, t("browse_title")),
        h("div", { class: "browse-subtitle" }, t("browse_subtitle"))
      ]),
      h("a", { class: "browse-seeall", id: "browseSeeAll" }, [t("browse_see_all_prefix") + realCount + " " + t("common_see_all_cards")])
    ]),
    h("div", { class: "browse-grid", id: "browseGrid" }, catCards)
  ]);
}

let _carouselTimer = null;
function startHeroCarousel() {
  const root = document.getElementById("heroCarousel");
  if (!root) return;
  const total = HOME_CAROUSEL_SLIDES.length;
  let idx = 0;

  const show = function (next) {
    idx = ((next % total) + total) % total;
    const slides = root.querySelectorAll(".hero-carousel-slide");
    const dots   = root.querySelectorAll(".hero-carousel-dot");
    slides.forEach((s, i) => s.classList.toggle("active", i === idx));
    dots.forEach((d, i)   => d.classList.toggle("active", i === idx));
  };

  if (_carouselTimer) clearInterval(_carouselTimer);
  _carouselTimer = setInterval(() => show(idx + 1), 4800);

  root.addEventListener("click", function (ev) {
    const t = ev.target;
    if (!t || !t.closest) return;

    const dot = t.closest("[data-dot]");
    if (dot) {
      const i = parseInt(dot.getAttribute("data-dot"), 10) || 0;
      show(i);
      if (_carouselTimer) { clearInterval(_carouselTimer); _carouselTimer = setInterval(() => show(idx + 1), 4800); }
      return;
    }

    const dir = t.closest("[data-dir]");
    if (dir) {
      show(idx + (dir.getAttribute("data-dir") === "next" ? 1 : -1));
      if (_carouselTimer) { clearInterval(_carouselTimer); _carouselTimer = setInterval(() => show(idx + 1), 4800); }
      return;
    }

    const cta = t.closest("[data-slide-cta]");
    if (cta) {
      const cat = cta.getAttribute("data-cat");
      if (cat) {
        history.pushState({}, "", "/discover?cat=" + encodeURIComponent(cat));
        renderRoute();
      }
      return;
    }
  });
}

function renderIntentEngine() {
  return h("section", { class: "intent-section glass", id: "intent-section" }, [
    h("div", { class: "intent-step-title", id: "intentStep1Title" }, t("intent_step1")),
    h("div", { class: "intent-row", id: "intentRecipientChips" }),
    h("div", { class: "intent-step-title mt-3", id: "intentStep2Title" }, t("intent_step2")),
    h("div", {
      class: "intent-row",
      id: "intentOccasionChips",
      style: { gridTemplateColumns: "repeat(auto-fill, minmax(140px, 1fr))" }
    }),
    h("div", { class: "intent-step-title mt-3", id: "intentStep3Title" }, t("intent_step3")),
    h("div", {
      class: "intent-row",
      id: "intentToneChips",
      style: { gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))" }
    }),
    h("div", { class: "text-center mt-3" }, [
      h("button", {
        class: "btn btn-primary",
        id: "intentGoBtn",
        disabled: true
      }, [t("intent_cta_default")])
    ])
  ]);
}

function attachHomeEventListeners() {
  const startBtn = document.getElementById("heroStartBtn");
  if (startBtn) startBtn.addEventListener("click", () => scrollToId("intent-section"));
  const pricingBtn = document.getElementById("heroPricingBtn");
  if (pricingBtn) pricingBtn.addEventListener("click", () => {
    history.pushState({}, "", "/pricing");
    renderRoute();
  });
  renderRecipientChips();
  renderOccasionChips();
  renderToneChips();
  updateIntentGoBtn();
  const goBtn = document.getElementById("intentGoBtn");
  if (goBtn) goBtn.addEventListener("click", () => {
    const p = new URLSearchParams();
    if (state.intent.recipient) p.set("recipient", state.intent.recipient);
    if (state.intent.occasion) p.set("cat", state.intent.occasion);
    if (state.intent.tone) p.set("tone", state.intent.tone);
    const url = "/discover" + (p.toString() ? "?" + p.toString() : "");
    persistIntentState();
    history.pushState({}, "", url);
    renderRoute();
  });
  startHeroCarousel();
  const browseGrid = document.getElementById("browseGrid");
  if (browseGrid) {
    browseGrid.addEventListener("click", function (ev) {
      const card = ev.target && ev.target.closest ? ev.target.closest("[data-browse-cat]") : null;
      if (!card) return;
      const cat = card.getAttribute("data-browse-cat");
      if (cat) {
        state.intent.occasion = cat;
        persistIntentState();
        history.pushState({}, "", "/discover?cat=" + encodeURIComponent(cat));
        renderRoute();
      }
    });
  }
  const browseSeeAll = document.getElementById("browseSeeAll");
  if (browseSeeAll) browseSeeAll.addEventListener("click", function () {
    history.pushState({}, "", "/discover");
    renderRoute();
  });
}

function renderRecipientChips() {
  const row = document.getElementById("intentRecipientChips");
  if (!row) return;
  row.innerHTML = "";
  RECIPIENT_OPTIONS.forEach(opt => {
    const selected = state.intent.recipient === opt.slug;
    const labelStr = typeof opt.label === "function" ? opt.label() : String(opt.label);
    const card = h("div", {
      class: "intent-card" + (selected ? " selected" : ""),
      onclick: () => {
        state.intent.recipient = selected ? null : opt.slug;
        persistIntentState();
        renderRecipientChips();
        updateIntentGoBtn();
      }
    }, [
      h("div", { class: "intent-card-icon" }, labelStr.split(" ")[0]),
      h("div", { class: "intent-card-label" }, labelStr.slice(labelStr.indexOf(" ") + 1) || labelStr),
      h("div", { class: "intent-card-sub" }, t("intent_match_prefix") + opt.match + t("intent_match_suffix"))
    ]);
    row.appendChild(card);
  });
}

function renderOccasionChips() {
  const row = document.getElementById("intentOccasionChips");
  if (!row) return;
  row.innerHTML = "";
  OCCASION_OPTIONS.forEach(opt => {
    const selected = state.intent.occasion === opt.slug;
    const count = _realCatCount(window.CARDS, opt.slug);
    const labelStr = typeof opt.label === "function" ? opt.label() : String(opt.label);
    const card = h("div", {
      class: "intent-card" + (selected ? " selected" : ""),
      onclick: () => {
        state.intent.occasion = selected ? null : opt.slug;
        persistIntentState();
        renderOccasionChips();
        updateIntentGoBtn();
      }
    }, [
      h("div", { class: "intent-card-icon" }, getCategoryEmoji(opt.slug)),
      h("div", { class: "intent-card-label" }, labelStr),
      h("div", { class: "intent-card-sub" }, (count || 0) + t("common_count_suffix"))
    ]);
    row.appendChild(card);
  });
}

function renderToneChips() {
  const row = document.getElementById("intentToneChips");
  if (!row) return;
  row.innerHTML = "";
  TONE_OPTIONS.forEach(opt => {
    const selected = state.intent.tone === opt.slug;
    const labelStr = typeof opt.label === "function" ? opt.label() : String(opt.label);
    const card = h("div", {
      class: "intent-card" + (selected ? " selected" : ""),
      onclick: () => {
        state.intent.tone = selected ? null : opt.slug;
        persistIntentState();
        renderToneChips();
        updateIntentGoBtn();
      }
    }, [
      h("div", { class: "intent-card-icon" }, labelStr.split(" ")[0]),
      h("div", { class: "intent-card-label" }, labelStr.slice(labelStr.indexOf(" ") + 1) || labelStr),
      h("div", { class: "intent-card-sub" }, opt.words.join(", "))
    ]);
    row.appendChild(card);
  });
}

let _intentReadyTriggeredFor = null;
function updateIntentGoBtn() {
  const btn = document.getElementById("intentGoBtn");
  if (!btn) return;
  const s = state.intent;
  const ready = !!(s.recipient || s.occasion || s.tone);
  btn.disabled = !ready;
  if (ready) {
    const count = (s.recipient?1:0) + (s.occasion?1:0) + (s.tone?1:0);
    btn.textContent = count >= 3
      ? t("intent_cta_perfect")
      : count === 2
        ? t("intent_cta_good")
        : t("intent_cta_default");
    const key = [s.recipient||"", s.occasion||"", s.tone||""].join("|");
    if (_intentReadyTriggeredFor !== key) {
      _intentReadyTriggeredFor = key;
      btn.classList.add("btn-pulse");
      setTimeout(() => btn.classList.remove("btn-pulse"), 3200);
      try {
        btn.scrollIntoView({ behavior: "smooth", block: "center", inline: "nearest" });
      } catch (_) {}
      if (!window.__intentHintShown || count > (window.__intentHintCount || 0)) {
        window.__intentHintShown = true;
        window.__intentHintCount = count;
        if (window.toast) {
          const parts = [];
          if (s.recipient) parts.push("recipient");
          if (s.occasion) parts.push("occasion");
          if (s.tone) parts.push("tone");
          window.toast(
            t("toast_intent_hint_prefix") + parts.join(" + ") + t("toast_intent_hint_suffix"),
            "success"
          );
        }
      }
    }
  } else {
    btn.textContent = t("intent_cta_pick");
    _intentReadyTriggeredFor = null;
  }
}

function renderDiscover(params) {
  clearApp();
  const recipient = params.get("recipient") || null;
  const occasion = params.get("cat") || params.get("occasion") || null;
  const tone = params.get("tone") || null;
  const query = (params.get("q") || "").trim().toLowerCase();

  state.intent.recipient = recipient;
  state.intent.occasion = occasion;
  state.intent.tone = tone;

  const top = h("div", { class: "discover-page fade-in" }, [
    renderFilterBar(recipient, occasion, tone, query),
    h("div", { class: "discover-grid", id: "discoverGrid" })
  ]);
  mountApp(top);

  if (recipient) document.getElementById("filterRecipient")?.setAttribute("data-value", recipient);
  if (occasion) document.getElementById("filterOccasion")?.setAttribute("data-value", occasion);
  if (tone) document.getElementById("filterTone")?.setAttribute("data-value", tone);
  if (query) {
    const inp = document.getElementById("discoverSearchInput");
    if (inp) inp.value = query;
  }

  attachDiscoverListeners(recipient, occasion, tone, query);
  applyDiscoverFilter(recipient, occasion, tone, query);
}

function renderFilterBar(recipient, occasion, tone, query) {
  const chips = [];
  if (recipient) {
    const opt = RECIPIENT_OPTIONS.find(o => o.slug === recipient);
    if (opt) {
      const labelStr = typeof opt.label === "function" ? opt.label() : String(opt.label);
      chips.push(renderFilterChip("filterRecipient", t("intent_recipient") + labelStr, recipient, "recipient"));
    }
  }
  if (occasion) {
    const labelFn = CATEGORY_LABELS[occasion];
    const labelStr = typeof labelFn === "function" ? labelFn() : (labelFn || occasion);
    chips.push(renderFilterChip("filterOccasion", t("intent_occasion") + labelStr, occasion, "cat"));
  }
  if (tone) {
    const opt = TONE_OPTIONS.find(o => o.slug === tone);
    if (opt) {
      const labelStr = typeof opt.label === "function" ? opt.label() : String(opt.label);
      chips.push(renderFilterChip("filterTone", t("intent_tone") + labelStr, tone, "tone"));
    }
  }
  const row = [h("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap", alignItems: "center" } }, chips)];
  if (chips.length) {
    row[0].appendChild(h("button", {
      class: "btn btn-ghost",
      style: { padding: "0.3rem 0.8rem", fontSize: "0.8rem" },
      id: "resetFilterBtn"
    }, t("intent_reset")));
  }
  const wrap = h("div", { class: "filter-bar glass" }, [
    row[0],
    h("div", { style: { marginLeft: "auto", minWidth: "240px" } }, [
      h("input", {
        type: "search",
        id: "discoverSearchInput",
        placeholder: t("intent_search_ph"),
        value: query || ""
      })
    ])
  ]);
  return wrap;
}

function renderFilterChip(id, label, value, paramKey) {
  return h("span", {
    class: "btn btn-ghost",
    id,
    style: { padding: "0.3rem 0.8rem", fontSize: "0.8rem", gap: "0.35rem" },
    "data-param": paramKey,
    onclick: () => {
      const p = new URLSearchParams(location.search);
      p.delete(paramKey);
      const url = "/discover" + (p.toString() ? "?" + p.toString() : "");
      history.pushState({}, "", url);
      renderRoute();
    }
  }, [label, " ×"]);
}

function attachDiscoverListeners(initR, initO, initT, initQ) {
  const resetBtn = document.getElementById("resetFilterBtn");
  if (resetBtn) resetBtn.addEventListener("click", () => {
    history.pushState({}, "", "/discover");
    renderRoute();
  });
  const searchInput = document.getElementById("discoverSearchInput");
  if (!searchInput) return;
  let debounce = null;
  searchInput.addEventListener("input", () => {
    const val = searchInput.value.trim().toLowerCase();
    clearTimeout(debounce);
    debounce = setTimeout(() => {
      const p = new URLSearchParams(location.search);
      if (val) p.set("q", val); else p.delete("q");
      const qStr = p.toString();
      history.replaceState({}, "", "/discover" + (qStr ? "?" + qStr : ""));
      applyDiscoverFilter(
        p.get("recipient"), p.get("cat") || p.get("occasion"), p.get("tone"), val
      );
    }, 260);
  });
}

function applyDiscoverFilter(recipient, occasion, tone, query) {
  const grid = document.getElementById("discoverGrid");
  if (!grid) return;
  grid.innerHTML = "";
  const pageSize = window.__D1.pageSize;

  const recipientOpt = RECIPIENT_OPTIONS.find(o => o.slug === recipient);
  const toneOpt = TONE_OPTIONS.find(o => o.slug === tone);

  let combinedQ = [];
  if (query) combinedQ.push(query);
  if (recipientOpt) combinedQ.push(recipientOpt.match);
  if (toneOpt) combinedQ.push(toneOpt.slug, ...(toneOpt.words || []));
  const ftsQ = combinedQ.join(" ").trim() || null;

  grid.appendChild(h("div", {
    id: "discoverStatus",
    style: { gridColumn: "1 / -1", padding: "2.2rem 1rem", display: "flex", alignItems: "center", justifyContent: "center", gap: "0.8rem" }
  }, [
    h("div", { class: "loading-spinner" }),
    h("p", { style: { margin: 0, color: "var(--saf-text-soft)" } }, "Loading cards from D1…")
  ]));

  const toneSlug = toneOpt ? toneOpt.slug : null;
  const recipientMatch = recipientOpt ? recipientOpt.match.toLowerCase() : null;
  const toneWords = toneOpt ? (toneOpt.words || []).map(w => w.toLowerCase()) : [];

  function localRescore(list) {
    if (!recipientOpt && !toneOpt) return list;
    return list.map(card => {
      let score = 0;
      if (toneSlug && (card.style || "").toLowerCase().includes(toneSlug)) score += 3;
      if (recipientMatch) {
        const hay = ((card.title || "") + " " + (card.defaultText || "")).toLowerCase();
        if (hay.includes(recipientMatch)) score += 4;
      }
      if (toneWords.length) {
        const hay = ((card.title || "") + " " + (card.defaultText || "")).toLowerCase();
        if (toneWords.some(w => hay.includes(w))) score += 2;
      }
      card.__score = (card.__score || 0) + score;
      return card;
    }).sort((a, b) => (b.__score || 0) - (a.__score || 0));
  }

  function renderStatusRow(totalCards, totalCount, page, totalPages, nextPage) {
    totalCount = _safeTotal(totalCount);
    totalPages = _safePages(totalCount, pageSize);
    nextPage = nextPage && nextPage <= totalPages ? nextPage : null;
    const statusEl = document.getElementById("discoverStatus");
    if (statusEl) statusEl.remove();
    const showHint = h("div", {
      id: "discoverMeta",
      style: { gridColumn: "1 / -1", padding: "0.4rem 0.2rem 0.8rem", color: "var(--saf-text-soft)", fontSize: "0.88rem" }
    }, [
      "🎴 ",
      totalCount.toLocaleString() + " templates",
      occasion ? ` · in ${_L(CATEGORY_LABELS[occasion], occasion)}` : "",
      ftsQ ? ` · matching "${ftsQ.slice(0,40)}${ftsQ.length > 40 ? "…" : ""}` : "",
      recipientOpt ? ` · for ${_L(recipientOpt.label, "")}` : "",
      toneOpt ? ` · tone: ${_L(toneOpt.label, "")}` : ""
    ]);
    grid.appendChild(showHint);
    localRescore(totalCards).forEach(card => {
      cacheCardInWindow(card);
      grid.appendChild(renderCardTile(card));
    });
    const existingMore = document.getElementById("discoverLoadMore");
    if (existingMore) existingMore.remove();
    if (nextPage && nextPage <= totalPages) {
      const btn = h("button", {
        id: "discoverLoadMore",
        class: "btn btn-outline",
        style: { gridColumn: "1 / -1", justifySelf: "center", margin: "0.5rem 0 2rem" }
      }, `⬇ Load more (page ${nextPage} / ${totalPages})`);
      btn.addEventListener("click", async () => {
        btn.disabled = true;
        btn.textContent = "Loading…";
        try {
          const j = await d1FetchCards({
            category: occasion,
            q: ftsQ,
            page: nextPage,
            size: pageSize,
            append: true
          });
          const cards = j.cards || [];
          cards.forEach(card => { cacheCardInWindow(card); grid.appendChild(renderCardTile(card)); });
          btn.remove();
          if (j.page < _safePages(j.total, pageSize)) {
            renderStatusRow([], j.total, j.page, j.totalPages, j.page + 1);
            const meta = document.getElementById("discoverMeta");
            if (meta) meta.remove();
            const moreBtn = document.getElementById("discoverLoadMore");
            if (moreBtn) grid.appendChild(moreBtn);
          }
        } catch (e) {
          btn.disabled = false;
          btn.textContent = "Retry load more";
          if (!window.toast) installToast();
          window.toast("Load more failed: " + e.message, "error");
        }
      });
      grid.appendChild(btn);
    } else if (totalCount === 0) {
      grid.appendChild(h("div", {
        class: "text-center",
        style: { gridColumn: "1 / -1", padding: "3rem 1rem", color: "var(--saf-text-soft)" }
      }, "💔 No perfect matches yet — try removing a filter."));
    }
  }

  d1FetchCards({ category: occasion, q: ftsQ, page: 1, size: pageSize }).then(j => {
    const cards = j.cards || [];
    renderStatusRow(cards, j.total || 0, j.page || 1, j.totalPages || 1, (j.page || 1) < (j.totalPages || 1) ? (j.page || 1) + 1 : null);
  }).catch(e => {
    const statusEl = document.getElementById("discoverStatus");
    if (statusEl) statusEl.remove();
    grid.appendChild(h("div", {
      class: "text-center",
      style: { gridColumn: "1 / -1", padding: "3rem 1rem" }
    }, [
      h("p", { style: { color: "var(--saf-error)", marginBottom: "0.8rem" } }, "❌ Failed to load cards from D1: " + e.message),
      h("button", { class: "btn btn-primary", onclick: () => applyDiscoverFilter(recipient, occasion, tone, query) }, "🔄 Retry")
    ]));
    if (!window.toast) installToast();
    window.toast("D1 API error: " + e.message, "error");
  });
}

// ==========================================================================
// Doc §178 Geo-localization helpers (tier-3 rendering on top of edge DB sort).
// Worker backend already sorts by geo_country_target first; the front-end
// layer here *decorates* the result with visible badges and (optionally)
// boosts local-favourite categories further if SAF_GEO says so.
// ==========================================================================
function _detectVisitorCountryCode() {
  try {
    if (window.SAF_GEO && window.SAF_GEO.country) {
      const c = String(window.SAF_GEO.country).toUpperCase();
      if (c && c !== "XX") return c;
    }
  } catch (e) {}
  try {
    const h = document.querySelector('meta[name="x-geo-country"]') || document.querySelector('meta[http-equiv="X-Geo-Country"]');
    if (h && h.content && String(h.content).toUpperCase() !== "XX") return String(h.content).toUpperCase();
  } catch (e) {}
  return null;
}

// Fallback category → country mapping used only when a card has no explicit
// geo_country_target column.  Worker-side writes are the source of truth;
// this is client-side grace only.
const _CATEGORY_TO_COUNTRIES_FALLBACK = Object.freeze({
  "carnival":      ["BR"],
  "cinco-de-mayo": ["MX","US"],
  "thanksgiving":  ["US","CA"],
  "independence-day": ["US","MX","BR","CA"],
  "4th-of-july":   ["US"],
  "revolution-day":["MX"],
  "dia-de-muertos":["MX"],
  "july-fourth":   ["US"],
  "canada-day":    ["CA"],
  "lunar-new-year":["CN","SG","HK","TW","KR"],
  "diwali":        ["IN"],
  "eid-al-fitr":   ["SA","AE","EG","NG","ID","MY"],
  "st-patricks-day":["IE","GB","US"],
  "valentines-day":["US","GB","CA","FR","ES","MX","BR"],
  "fathers-day":   ["US","GB","CA","FR","ES","MX","BR"],
  "mothers-day":   ["US","GB","CA","FR","ES","MX","BR"],
  "christmas":     ["US","GB","CA","FR","ES","MX","BR","DE","IT"],
  "new-year":      ["US","GB","CA","FR","ES","MX","BR"],
  "easter":        ["US","GB","CA","FR","ES","MX","BR"],
  "halloween":     ["US","CA","GB","IE","MX"],
  "wedding":       ["US","GB","CA","FR","ES","MX","BR"],
  "anniversary":   ["US","GB","CA","FR","ES","MX","BR"],
  "birthday":      ["US","GB","CA","FR","ES","MX","BR"],
  "thank-you":     ["US","GB","CA","FR","ES","MX","BR"],
  "congratulations":["US","GB","CA","FR","ES","MX","BR"],
  "get-well":      ["US","GB","CA","FR","ES","MX","BR"],
  "sorry":         ["US","GB","CA","FR","ES","MX","BR"],
  "miss-you":      ["US","GB","CA","FR","ES","MX","BR"],
  "love":          ["US","GB","CA","FR","ES","MX","BR"],
  "friendship":    ["US","GB","CA","FR","ES","MX","BR"],
  "farewell":      ["US","GB","CA","FR","ES","MX","BR"],
  "housewarming":  ["US","GB","CA","FR","ES","MX","BR"],
  "graduation":    ["US","GB","CA","FR","ES","MX","BR"],
  "newborn":       ["US","GB","CA","FR","ES","MX","BR"],
});

function _cardGeoTargetsArray(card) {
  const raw = card && (card.geo_country_target || card.geoCountryTarget);
  if (!raw) return null;
  if (Array.isArray(raw)) return raw.map(s => String(s).toUpperCase());
  if (typeof raw === "string") {
    if (raw.charAt(0) === "[" || raw.charAt(0) === "{") {
      try {
        const arr = JSON.parse(raw);
        if (Array.isArray(arr)) return arr.map(s => String(s).toUpperCase());
      } catch (e) { /* fall through */ }
    }
    return raw.split(/[,;|\s]+/).map(s => s.toUpperCase()).filter(Boolean);
  }
  return null;
}

function _isCardLocalFavorite(card) {
  const cc = _detectVisitorCountryCode();
  if (!cc) return false;
  if (!card) return false;
  // 1. Trust geo_country_target column (source of truth).
  const explicit = _cardGeoTargetsArray(card);
  if (explicit && explicit.length) {
    if (explicit.includes(cc)) return true;
  }
  // 2. Fallback: category-to-countries heuristic.
  const cat = typeof card.category === "string" ? card.category.toLowerCase() : "";
  if (cat && _CATEGORY_TO_COUNTRIES_FALLBACK[cat]) {
    return _CATEGORY_TO_COUNTRIES_FALLBACK[cat].includes(cc);
  }
  return false;
}

function _buildLocalFavoriteBadge(card) {
  if (!_isCardLocalFavorite(card)) return null;
  const cc = _detectVisitorCountryCode() || "HERE";
  return h("div", {
    class: "card-tile-local-badge",
    title: `Local favourite in ${cc} — hand-picked for visitors from your country`,
    style: {
      position: "absolute",
      top: "10px",
      left: "10px",
      zIndex: "5",
      padding: "0.3rem 0.7rem",
      borderRadius: "999px",
      background: "linear-gradient(135deg, rgba(16,185,129,0.95), rgba(6,182,212,0.95))",
      color: "#fff",
      fontSize: "0.74rem",
      fontWeight: "700",
      letterSpacing: "0.01em",
      boxShadow: "0 4px 14px rgba(16,185,129,0.35)",
      backdropFilter: "blur(4px)",
      WebkitBackdropFilter: "blur(4px)",
      border: "1px solid rgba(255,255,255,0.4)",
      display: "inline-flex",
      alignItems: "center",
      gap: "0.3rem",
      userSelect: "none",
    }
  }, [
    h("span", { ariaHidden: "true" }, "📍"),
    h("span", {}, _L({
      en: "Local pick · " + cc,
      es: "Favorito local · " + cc,
      fr: "Choix local · " + cc,
      pt: "Escolha local · " + cc,
    }, "Local pick · " + cc))
  ]);
}

// Front-end local re-ranking helper: Worker already sorts geo_country_target =
// country first; this function optionally boosts cards *in the current page
// slice* whose category matches the visitor's country (after explicit targets).
// Keeps the relative order of non-local cards untouched. Safe & predictable.
function localRescore(cards) {
  const cc = _detectVisitorCountryCode();
  if (!cc || !Array.isArray(cards) || cards.length <= 1) return cards;
  const localBuck = [];
  const otherBuck = [];
  for (let i = 0; i < cards.length; i++) {
    const c = cards[i];
    if (_isCardLocalFavorite(c)) localBuck.push(c); else otherBuck.push(c);
  }
  // Only return re-sorted bucket if we actually found >=1 local card AND the
  // reorder doesn't change more than 40% of results (preserve API intent).
  if (localBuck.length && (localBuck.length / cards.length) <= 0.45) {
    return localBuck.concat(otherBuck);
  }
  return cards;
}

function renderCardTile(card) {
  const cat = typeof card.category === "string" ? card.category : "";
  const fallbackGrad = getCategoryGradient(cat);
  const emoji = getCategoryEmoji(cat);
  const titleText = (card.title || "Untitled Card");
  const displayTitle = titleText.length > 40 ? titleText.slice(0, 37) + "…" : titleText;
  const localBadge = _buildLocalFavoriteBadge(card);
  const el = h("a", {
    class: "card-tile",
    href: "/card/" + card.slug,
    style: { background: fallbackGrad },
    onclick: e => {
      e.preventDefault();
      history.pushState({}, "", "/card/" + card.slug);
      renderRoute();
    }
  }, [
    h("div", {
      class: "card-tile-img-fallback",
      style: {
        position: "absolute",
        inset: "0",
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        padding: "0 14px",
        textAlign: "center",
        zIndex: "1",
        color: "#fff",
        textShadow: "0 1px 3px rgba(0,0,0,.45)",
        pointerEvents: "none"
      }
    }, [
      h("div", {
        style: {
          fontSize: "2.8rem",
          marginBottom: "10px",
          filter: "drop-shadow(0 1px 2px rgba(0,0,0,.2))"
        }
      }, emoji),
      h("div", {
        style: {
          fontSize: "0.95rem",
          fontWeight: "700",
          lineHeight: "1.25",
          maxHeight: "3.75em",
          overflow: "hidden"
        }
      }, displayTitle)
    ]),
    localBadge,
    h("img", {
      class: "card-tile-img",
      src: card.bgImage || card.bgImageWatermark || R2_BASE + "/birthday/birthday-pexels-8014697-v2-vertical.webp",
      alt: card.title || "Card preview",
      loading: "lazy",
      style: { position: "relative", zIndex: "2" },
      onload: (e) => { try {
        const t = e.currentTarget;
        (typeof __dbgevt === "function") && __dbgevt({ h:"A", r:"pre", m:"[DEBUG] card-tile-img onload",
          d: { src: t && t.src, w: t && t.naturalWidth, h_: t && t.naturalHeight, slug: card.slug, cat: card.category, loc: location.origin, hostname: (() => { try { return new URL(t.src).hostname; } catch(_) { return ""; } })() } });
      } catch(_) {} },
      onerror: (e) => {
        try {
          const t = e.currentTarget;
          (typeof __dbgevt === "function") && __dbgevt({ h:"B", r:"pre", m:"[DEBUG] card-tile-img onerror",
            d: { src: t && t.src, slug: card.slug, cat: card.category, loc: location.origin, hostname: (() => { try { return new URL(t.src).hostname; } catch(_) { return ""; } })() } });
        } catch(_) {}
        try {
          const imgEl = e.currentTarget;
          imgEl.style.display = "none";
          imgEl.style.visibility = "hidden";
          imgEl.removeAttribute("src");
        } catch(_) {}
      }
    }),
    h("div", { class: "card-tile-overlay", style: { zIndex: "3" } }),
    h("div", { class: "card-tile-info", style: { zIndex: "4" } }, [
      h("div", { class: "card-tile-title" },
        (card.title || "Untitled Card").length > 62
          ? (card.title || "Untitled Card").slice(0, 59) + "…"
          : (card.title || "Untitled Card")
      ),
      h("div", { class: "card-tile-tags" }, [
        h("span", { class: "card-tile-tag" }, getCategoryEmoji(card.category) + " " + _L(CATEGORY_LABELS[card.category], card.category)),
        (card.style ? h("span", { class: "card-tile-tag" }, card.style) : null)
      ].filter(Boolean))
    ])
  ]);
  return el;
}

function renderEditor(slug) {
  clearApp();
  state.currentSlug = slug;
  const cached = window.__D1?.detailCache?.[slug] || (window.CARDS || []).find(c => c.slug === slug);

  function doRender(card) {
    if (!card) { renderNotFound(); return; }
    cacheCardInWindow(card);
    resetEditorState(card);
    loadEditorFromStorage(slug);
    const seo = card.seo || {};
    const cardUrl = "https://sendafun.com/card/" + slug;
    const pageTitle = seo.title || ("Personalize · " + (card.title || "E-Card") + " · SendAFun");
    const pageDesc = seo.description || ("Personalize and send " + (card.title || "this beautiful e-card") + ". Custom fonts, colors, group signatures, preview free, send instantly for $1.99.");
    setPageTitle(pageTitle);
    updateMetaDescription(pageDesc);
    if (seo.keywords && seo.keywords.length) setMetaKeywords(seo.keywords);
    updateCanonical("/card/" + slug);
    updateOGTags({
      title: pageTitle,
      description: pageDesc,
      type: "product",
      url: cardUrl,
      image: card.ogImage || card.bgImage || "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp"
    });
    const cardProductLD = getCardProductJSONLD(card);
    if (cardProductLD) injectJSONLD("ld-card-product", cardProductLD);
    const catLabel = _L(CATEGORY_LABELS[card.category], "E-Card");
    injectJSONLD("ld-breadcrumb", getBreadcrumbList([
      { name: "Home", item: "https://sendafun.com/" },
      { name: catLabel + " E-Cards", item: "https://sendafun.com/" + (card.category || "discover") },
      { name: card.title || "Card" }
    ]));

    const page = h("div", { class: "editor-page fade-in", id: "editorPage" }, [
      renderEditorLeft(card),
      renderEditorRight(card)
    ]);
    mountApp(page);
    attachEditorListeners(card);
    updateCardBackPreview(card);
  }

  if (cached) {
    doRender(cached);
    return;
  }

  mountApp(h("div", {
    style: { minHeight: "60vh", display: "flex", alignItems: "center", justifyContent: "center", flexDirection: "column", gap: "1rem" }
  }, [
    h("div", { class: "loading-spinner", style: { width: "42px", height: "42px" } }),
    h("p", { style: { color: "var(--saf-text-soft)" } }, "Loading card from D1…")
  ]));

  fetch(API_BASE + "/cards/" + encodeURIComponent(slug)).then(async r => {
    if (!r.ok) throw new Error(`HTTP ${r.status}`);
    const j = await r.json();

    /* --------------------------------------------------------
     * Doc §13.5.1 call-site stubs + detail payload shape.
     * Detail protocol (Doc §fix-2):
     *   j.card          = base canvas fields only
     *   j.[7 keys   = extended meta at response toplevel
     * Merge toplevel meta back into j.card so every existing
     * doRender / cacheCardInWindow consumer reads {slug, title,
     * emotionalTags, envelopeStyleId, geoCountryTarget, pexelsId,
     * seo} from a single card object — same shape as LIST cards[].
     * -------------------------------------------------------- */
    const top = j && typeof j === "object" ? j : {};
    const baseCard = top.card || null;
    const mergedCard = baseCard ? Object.assign({}, baseCard, {
      slug:            top.slug            ?? baseCard.slug            ?? "",
      title:           top.title           ?? baseCard.title           ?? "",
      pexelsId:        top.pexelsId        ?? baseCard.pexelsId        ?? "",
      emotionalTags:   ("emotionalTags" in top)   ? top.emotionalTags   : (baseCard.emotionalTags   || []),
      envelopeStyleId: ("envelopeStyleId" in top) ? top.envelopeStyleId : (baseCard.envelopeStyleId ?? null),
      geoCountryTarget: ("geoCountryTarget" in top) ? top.geoCountryTarget : (baseCard.geoCountryTarget || []),
      seo:             top.seo             ?? baseCard.seo             ?? {}
    }) : null;

    /* Doc §13.5.1 — Geo compliance popup stub.
     * Today: enabled=false → never rendered, zero visual change.
     * Phase 1.5 fills the body; call-site stays exactly here. */
    try {
      const cc = _saferCountryCode();
      const popup = window.SAF_SLOTS.GeoCompliancePopup(cc, {});
      if (popup?.enabled && !window.__SAF_COMPLIANCE_SHOWN) {
        /* Phase 1.5: mount popup element into #saf-compliance-slot */
        window.__SAF_COMPLIANCE_SHOWN = popup;
      }
    } catch (_) { /* reserved slot must never break render */ }

    cacheCardInWindow(mergedCard);
    doRender(mergedCard);
  }).catch(e => {
    if (!window.toast) installToast();
    window.toast("Failed to load card: " + e.message, "error");
    renderNotFound();
  });
}

function renderEditorLeft(card) {
  const bg = card.bgImageWatermark || card.bgImage || R2_BASE + "/birthday/birthday-pexels-8014697-v2-vertical.webp";
  const cat = typeof card.category === "string" ? card.category : "";
  const layered = layeredBackground(bg, cat);
  const layeredBack = Object.assign({}, layered, { backgroundSize: layered.backgroundImage && layered.backgroundImage.includes(",") ? "cover, cover" : "cover" });
  const fallbackEmoji = getCategoryEmoji(cat);
  const fallbackGrad = getCategoryGradient(cat);
  const fallbackTitle = (card.title || "Untitled Card");
  const fallbackDisplayTitle = fallbackTitle.length > 28 ? fallbackTitle.slice(0, 25) + "…" : fallbackTitle;
  return h("div", { style: { position: "relative" } }, [
    h("button", {
      class: "btn btn-ghost",
      id: "flipBtn",
      style: {
        position: "absolute", top: "12px", right: "12px", zIndex: 10,
        padding: "0.5rem 0.9rem", fontSize: "0.85rem"
      }
    }, "🔄 Open Card"),
    h("div", {
      class: "card-flip-wrapper",
      id: "cardFlipWrapper"
    }, [
      h("div", { class: "card-flip-inner" }, [
        h("div", Object.assign({
          class: "card-face card-face-front"
        }, {
          style: Object.assign({}, layered, {
            backgroundSize: layered.backgroundImage && layered.backgroundImage.includes(",") ? "cover, cover" : "cover",
            backgroundColor: "transparent"
          })
        }), [
          h("div", {
            style: {
              position: "absolute",
              inset: "0",
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              justifyContent: "center",
              textAlign: "center",
              padding: "0 22px",
              color: "#fff",
              zIndex: "0",
              pointerEvents: "none"
            }
          }, [
            h("div", {
              style: {
                fontSize: "3.4rem",
                marginBottom: "14px",
                filter: "drop-shadow(0 2px 6px rgba(0,0,0,.25))"
              }
            }, fallbackEmoji),
            h("div", {
              style: {
                fontSize: "1.1rem",
                fontWeight: "700",
                fontFamily: "'Playfair Display', serif",
                textShadow: "0 1px 4px rgba(0,0,0,.5)",
                lineHeight: "1.35",
                maxWidth: "100%"
              }
            }, fallbackDisplayTitle)
          ]),
          h("div", {
            style: {
              position: "absolute", inset: 0, zIndex: "1",
              background: "linear-gradient(180deg, rgba(0,0,0,0.1) 0%, rgba(0,0,0,0.55) 100%)"
            }
          }),
          h("div", {
            style: {
              position: "absolute",
              left: "22px", right: "22px", bottom: "26px",
              color: "#fff", zIndex: "2",
              fontFamily: "'Playfair Display', serif",
              fontSize: "1.4rem", fontWeight: 700,
              lineHeight: 1.25, textShadow: "0 2px 10px rgba(0,0,0,0.5)"
            }
          }, [card.title || ""])
        ]),
        h("div", {
          class: "card-face card-face-back",
          id: "cardBackFace",
          style: Object.assign({}, layeredBack, {
            backgroundPosition: layered.backgroundPosition || "center center, center center",
            backgroundColor: "transparent"
          })
        }, [
          h("div", {
            style: {
              position: "absolute",
              inset: "0",
              zIndex: "0",
              background: fallbackGrad,
              opacity: "0.9"
            }
          }),
          h("div", {
            id: "cardBackBlur",
            style: {
              position: "absolute", inset: 0, zIndex: "1",
              backdropFilter: "blur(18px) saturate(140%)",
              background: "rgba(255,255,255,0.35)"
            }
          }),
          h("div", {
            id: "cardBackAccent",
            style: {
              position: "absolute", left: 0, right: 0, top: 0, height: "6px", zIndex: "2",
              background: state.editor.accentColor
            }
          }),
          h("div", {
            id: "cardBackContent",
            style: {
              position: "absolute", inset: "28px 22px 22px", zIndex: "3",
              display: "flex", flexDirection: "column", alignItems: "center",
              justifyContent: "center", textAlign: "center", padding: "10px",
              overflow: "hidden"
            }
          })
        ])
      ])
    ])
  ]);
}

function renderMessageTab(card) {
  const e = state.editor;
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "0.9rem" } }, [
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" } }, [
      h("div", {}, [
        h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "To (Name)"),
        h("input", {
          id: "f_toName",
          type: "text",
          placeholder: "Recipient name",
          value: e.toName || "",
          style: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit" }
        })
      ]),
      h("div", {}, [
        h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "To (Email)"),
        h("input", {
          id: "f_toEmail",
          type: "email",
          placeholder: "friend@example.com",
          value: e.toEmail || "",
          style: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit" }
        })
      ]),
      h("div", {}, [
        h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "From (Your Name)"),
        h("input", {
          id: "f_fromName",
          type: "text",
          placeholder: "Your name",
          value: e.fromName || "",
          style: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit" }
        })
      ]),
      h("div", {}, [
        h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "From (Your Email)"),
        h("input", {
          id: "f_fromEmail",
          type: "email",
          placeholder: "you@example.com",
          value: e.fromEmail || "",
          style: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit" }
        })
      ])
    ]),
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: "0.25rem" } }, [
      h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "Your message"),
      h("div", { id: "aiQuotaLabel", style: { fontSize: "0.72rem", color: "var(--saf-text-soft)" } }, "")
    ]),
    h("div", { style: { display: "flex", gap: "0.5rem", marginBottom: "0.4rem" } }, [
      h("button", {
        id: "genAIMsgBtn",
        class: "btn btn-ghost",
        type: "button",
        style: {
          flex: 1,
          padding: "0.55rem 0.8rem",
          borderRadius: "0.55rem",
          background: "linear-gradient(135deg,rgba(167,139,250,0.12),rgba(236,72,153,0.12))",
          border: "1.5px solid rgba(167,139,250,0.35)",
          color: "#6d28d9",
          fontWeight: 700,
          fontSize: "0.85rem"
        }
      }, "✨ Generate AI Message"),
      h("button", {
        id: "regenAIMsgBtn",
        class: "btn btn-ghost",
        type: "button",
        style: {
          padding: "0.55rem 0.75rem",
          borderRadius: "0.55rem",
          fontSize: "0.85rem"
        }
      }, "🔁")
    ]),
    h("div", {}, [
      h("textarea", {
        id: "f_defaultText",
        rows: 6,
        placeholder: "Write your heartfelt message here… or tap ✨ Generate above.",
        style: {
          width: "100%", padding: "0.7rem", borderRadius: "0.5rem",
          border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit", resize: "vertical", minHeight: "120px"
        }
      }, e.defaultText || (card && typeof card.defaultText === "string" ? card.defaultText : ""))
    ]),
    h("div", { style: { display: "grid", gridTemplateColumns: "1.5fr 1fr", gap: "0.6rem" } }, [
      h("div", {}, [
        h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "Send on (date)"),
        h("input", {
          id: "f_sendDate",
          type: "date",
          value: e.sendDate || "",
          style: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit" }
        })
      ]),
      h("div", {}, [
        h("label", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "At (time)"),
        h("input", {
          id: "f_sendTime",
          type: "time",
          value: e.sendTime || "10:00",
          style: { width: "100%", padding: "0.55rem 0.7rem", borderRadius: "0.5rem", border: "1px solid rgba(15,23,42,0.12)", fontFamily: "inherit" }
        })
      ])
    ]),
    h("button", {
      class: "btn btn-primary",
      id: "schedulePayBtn",
      style: {
        width: "100%", padding: "0.85rem 1rem", fontSize: "1rem",
        fontWeight: 700, borderRadius: "0.75rem",
        background: "var(--saf-primary)", color: "#fff", boxShadow: "var(--shadow-md)"
      }
    }, "🎁 Schedule & Send — $2.99")
  ]);
}

function renderStyleTab(card) {
  const labels = ["Modern Sans", "Playfair Serif", "Handwritten"];
  const e = state.editor;
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "0.9rem" } }, [
    h("div", {}, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)", marginBottom: "0.4rem", display: "block" } }, "Card Font"),
      h("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" } },
        FONT_FAMILIES.map((f, i) => h("button", {
          class: "btn btn-ghost",
          id: "ff_" + i,
          "data-font": f,
          style: {
            flex: "1 1 calc(33% - 0.4rem)",
            padding: "0.7rem 0.5rem",
            fontFamily: f,
            fontSize: "1.05rem",
            minWidth: "120px",
            borderRadius: "0.6rem",
            border: state.editor.fontFamily === f ? "2px solid var(--saf-primary)" : "1px solid rgba(15,23,42,0.1)"
          }
        }, labels[i] || ("Font " + (i + 1))))
      )
    ]),
    h("div", {}, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)", marginBottom: "0.3rem", display: "block" } },
        "Letter Spacing: " + (e.letterSpacing > 0 ? "+" : "") + e.letterSpacing + "px"),
      h("input", {
        id: "f_letterSpacing",
        type: "range",
        min: -2, max: 8, step: 0.5, value: e.letterSpacing,
        style: { width: "100%" }
      })
    ]),
    h("div", {}, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)", marginBottom: "0.3rem", display: "block" } },
        "Line Height: " + e.lineHeight.toFixed(2)),
      h("input", {
        id: "f_lineHeight",
        type: "range",
        min: 1.0, max: 2.4, step: 0.05, value: e.lineHeight,
        style: { width: "100%" }
      })
    ]),
    h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", padding: "0.4rem 0" } }, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)" } }, "Dark Text Mask (Readability)"),
      h("button", {
        id: "f_textMask",
        class: "btn " + (e.textMask ? "btn-primary" : "btn-ghost"),
        style: { padding: "0.4rem 0.8rem", fontSize: "0.8rem", borderRadius: "0.5rem" }
      }, e.textMask ? "ON" : "OFF")
    ]),
    h("div", {}, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)", marginBottom: "0.4rem", display: "block" } }, "Layer Order"),
      h("div", { style: { display: "flex", gap: "0.5rem" } }, [
        h("button", {
          id: "f_layerTextUp",
          class: "btn btn-ghost",
          style: { flex: 1, padding: "0.55rem 0.4rem", fontSize: "0.82rem", borderRadius: "0.55rem" }
        }, "🔤 Text ↑ Front"),
        h("button", {
          id: "f_layerStickerUp",
          class: "btn btn-ghost",
          style: { flex: 1, padding: "0.55rem 0.4rem", fontSize: "0.82rem", borderRadius: "0.55rem" }
        }, "✨ Stickers ↑ Front")
      ])
    ]),
    h("div", {}, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)", marginBottom: "0.4rem", display: "block" } }, "Decorative Border"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.4rem" }, id: "borderRow" },
        BORDER_PRESETS.map((b) => h("button", {
          id: "bdr_" + b.id,
          "data-border": b.id,
          class: "btn " + (state.editor.borderType === b.id ? "btn-primary" : "btn-ghost"),
          style: {
            padding: "0.5rem 0.4rem",
            fontSize: "0.78rem",
            borderRadius: "0.55rem",
            border: state.editor.borderType === b.id
              ? "2px solid var(--saf-primary)"
              : "1px solid rgba(15,23,42,0.12)"
          }
        }, b.name))
      )
    ])
  ]);
}

function _auroraParticleSystem(canvas) {
  if (!canvas) return null;
  const ctx = canvas.getContext("2d");
  let W = 0, H = 0;
  let rafId = 0;
  const particles = [];
  const COLORS = ["#8b5cf6", "#ec4899", "#06b6d4", "#a855f7", "#f472b6", "#22d3ee"];
  function resize() {
    const r = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;
    W = r.width; H = r.height;
    canvas.width = W * dpr;
    canvas.height = H * dpr;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }
  function spawn() {
    const onSide = Math.random() < 0.5;
    particles.push({
      x: onSide ? (Math.random() < 0.5 ? -10 : W + 10) : Math.random() * W,
      y: onSide ? Math.random() * H : (Math.random() < 0.5 ? -10 : H + 10),
      vx: (Math.random() - 0.5) * 1.6,
      vy: (Math.random() - 0.5) * 1.6,
      r: 0.8 + Math.random() * 2.6,
      life: 0,
      maxLife: 120 + Math.random() * 180,
      color: COLORS[Math.floor(Math.random() * COLORS.length)]
    });
  }
  function step() {
    ctx.clearRect(0, 0, W, H);
    for (let i = 0; i < 2; i++) if (particles.length < 120) spawn();
    for (let i = particles.length - 1; i >= 0; i--) {
      const p = particles[i];
      p.life++;
      p.x += p.vx;
      p.y += p.vy;
      p.vx += (Math.random() - 0.5) * 0.04;
      p.vy += (Math.random() - 0.5) * 0.04;
      const t = p.life / p.maxLife;
      const alpha = t < 0.15 ? t / 0.15 : (t > 0.85 ? (1 - t) / 0.15 : 1);
      if (t >= 1 || p.x < -30 || p.x > W + 30 || p.y < -30 || p.y > H + 30) {
        particles.splice(i, 1);
        continue;
      }
      const grad = ctx.createRadialGradient(p.x, p.y, 0, p.x, p.y, p.r * 4);
      grad.addColorStop(0, p.color);
      grad.addColorStop(1, "rgba(0,0,0,0)");
      ctx.globalAlpha = alpha * 0.85;
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 4, 0, Math.PI * 2);
      ctx.fill();
      ctx.globalAlpha = alpha;
      ctx.fillStyle = "#fff";
      ctx.beginPath();
      ctx.arc(p.x, p.y, p.r * 0.5, 0, Math.PI * 2);
      ctx.fill();
    }
    ctx.globalAlpha = 1;
    rafId = requestAnimationFrame(step);
  }
  resize();
  try { step(); } catch(_) {}
  window.addEventListener("resize", resize);
  return {
    stop() {
      try { cancelAnimationFrame(rafId); } catch(_) {}
      window.removeEventListener("resize", resize);
    }
  };
}

function renderEnvelopeAnimation(card, opts) {
  envelopeStylesInject();
  const options = Object.assign({ skin: "none", playOnce: true, previewMode: false }, opts || {});
  const skin = ENVELOPE_SKINS.find(s => s.id === options.skin) || ENVELOPE_SKINS[0];
  const st = ENVELOPE_SKIN_STYLES[skin.id] || ENVELOPE_SKIN_STYLES.none;
  const stageClass = "envelope-stage" + (options.previewMode ? " envelope-preview-stage" : "");
  const wrapClass = "envelope-wrap" + (options.previewMode ? " is-preview" : "");
  const stage = h("div", { class: stageClass, style: { padding: options.previewMode ? "0" : "1rem 0", minHeight: options.previewMode ? "180px" : "260px" } });
  const wrap = h("div", {
    class: wrapClass,
    id: "envWrap_" + (skin.id) + "_" + Math.random().toString(36).slice(2, 7),
    style: {
      "--env-body": st.body,
      "--env-body-shadow": st.bodyShadow,
      "--env-flap": st.flap,
      "--env-flap-shadow": st.flapShadow,
      "--env-paper": st.paper,
      "--env-text": st.text
    }
  });
  if (st.gradient) wrap.style.background = "";
  const body = h("div", { class: "envelope-body" });
  if (st.gradient) body.style.background = st.gradient;
  body.appendChild(h("div", { class: "envelope-back-face", style: st.gradient ? { background: st.gradient } : {} }));
  const paper = h("div", { class: "envelope-paper" });
  const paperInner = h("div", { class: "envelope-paper-inner" });
  const cardTitle = (card && (card.title || card.name)) ? String(card.title || card.name) : "Your Surprise Card";
  const previewText = state.editor?.defaultText || (card && card.defaultText) || "";
  if (card && card.bgImage) {
    const img = h("img", {
      class: "envelope-card-preview",
      src: _imgUrl(card.bgImage),
      alt: "",
      onerror: function () { this.style.display = "none"; }
    });
    paperInner.appendChild(img);
  }
  const title = h("div", { class: "paper-title" });
  title.textContent = cardTitle.length > 40 ? cardTitle.slice(0, 38) + "…" : cardTitle;
  paperInner.appendChild(title);
  const bodyEl = h("div", { class: "paper-body" });
  bodyEl.textContent = previewText.length > 120 ? previewText.slice(0, 118) + "…" : (previewText || "A heartfelt message is waiting inside ✨");
  paperInner.appendChild(bodyEl);
  paper.appendChild(paperInner);
  body.appendChild(paper);
  body.appendChild(h("div", { class: "envelope-pocket-bottom" }));
  body.appendChild(h("div", { class: "envelope-pocket-l" }));
  body.appendChild(h("div", { class: "envelope-pocket-r" }));
  const flap = h("div", {
    class: "envelope-flap",
    style: st.gradient ? { background: st.gradient } : {}
  });
  body.appendChild(flap);
  if (st.seal) {
    const seal = h("div", { class: "envelope-seal", style: { background: st.seal.color } });
    seal.textContent = st.seal.icon || "✉️";
    body.appendChild(seal);
  }
  wrap.appendChild(body);
  if (st.particles && !options.previewMode) {
    const cvs = h("canvas", { class: "envelope-aurora-canvas" });
    wrap.appendChild(cvs);
    setTimeout(() => _auroraParticleSystem(cvs), 0);
  }
  stage.appendChild(wrap);
  if (!options.previewMode && options.playOnce) {
    setTimeout(() => {
      wrap.classList.add("is-opening");
    }, 250);
  } else if (!options.playOnce && !options.previewMode) {
    const btn = h("button", { class: "envelope-open-btn", style: { marginTop: "1rem" } });
    btn.textContent = "✉️ 拆封信件";
    btn.addEventListener("click", function () {
      if (btn) btn.disabled = true;
      wrap.classList.add("is-opening");
    });
    const btnWrap = h("div", { style: { display: "flex", justifyContent: "center", marginTop: "0.5rem" } });
    btnWrap.appendChild(btn);
    stage.appendChild(btnWrap);
  }
  return stage;
}

function renderEnvelopeTab(card) {
  const e = state.editor;
  const currentSkin = ENVELOPE_SKINS.find(s => s.id === e.envelopeSkin) || ENVELOPE_SKINS[0];
  return h("div", { style: { display: "flex", flexDirection: "column", gap: "0.9rem" } }, [
    h("div", { style: { display: "flex", flexDirection: "column", gap: "0.5rem" } }, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)" } }, "✉️ Envelope Skin"),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(2, 1fr)", gap: "0.5rem" } },
        ENVELOPE_SKINS.map((skin, i) => {
          const st = ENVELOPE_SKIN_STYLES[skin.id] || ENVELOPE_SKIN_STYLES.none;
          const isSelected = e.envelopeSkin === skin.id;
          const tierBadge = {
            anon: "Guest",
            free: "Free",
            paid: "Pro",
            unlimited: "Pro+"
          }[skin.tier] || "";
          const tierColor = {
            anon: "#6b7280",
            free: "#10b981",
            paid: "#8b5cf6",
            unlimited: "#f59e0b"
          }[skin.tier] || "#6b7280";
          return h("button", {
            id: "env_" + skin.id,
            "data-skin": skin.id,
            class: "btn btn-ghost",
            style: {
              display: "flex",
              flexDirection: "column",
              alignItems: "center",
              gap: "0.35rem",
              padding: "0.75rem 0.5rem",
              borderRadius: "0.75rem",
              border: isSelected ? "2px solid var(--saf-primary)" : "1px solid rgba(15,23,42,0.1)",
              background: isSelected ? "rgba(99,102,241,0.06)" : "#fff",
              position: "relative"
            }
          }, [
            h("div", {
              style: {
                width: "100%",
                height: "56px",
                borderRadius: "0.5rem",
                background: st.gradient || st.body,
                boxShadow: "0 2px 8px " + st.bodyShadow,
                position: "relative",
                overflow: "hidden"
              }
            }, [
              h("div", {
                style: {
                  position: "absolute",
                  top: 0, left: 0, right: 0,
                  height: "28px",
                  background: st.flap,
                  clipPath: "polygon(0 0, 100% 0, 50% 100%)",
                  transformOrigin: "top center"
                }
              }),
              st.seal ? h("div", {
                style: {
                  position: "absolute",
                  left: "50%", top: "50%",
                  transform: "translate(-50%, -50%)",
                  width: "22px", height: "22px",
                  borderRadius: "50%",
                  background: st.seal.color.startsWith("linear") ? st.seal.color : st.seal.color,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: "0.7rem",
                  boxShadow: "0 1px 3px rgba(0,0,0,0.2)"
                }
              }, st.seal.icon) : null
            ]),
            h("div", { style: { fontSize: "0.78rem", fontWeight: isSelected ? 700 : 500, color: "#0f172a" } }, skin.name),
            h("div", {
              style: {
                fontSize: "0.65rem",
                padding: "0.1rem 0.45rem",
                borderRadius: "999px",
                color: "#fff",
                background: tierColor,
                fontWeight: 600
              }
            }, tierBadge)
          ]);
        })
      )
    ]),
    h("div", {
      style: {
        marginTop: "0.3rem",
        padding: "0.75rem",
        borderRadius: "0.75rem",
        background: "linear-gradient(135deg,rgba(167,139,250,0.08),rgba(236,72,153,0.08))",
        border: "1px solid rgba(139,92,246,0.15)",
        fontSize: "0.8rem",
        color: "var(--saf-text-soft)"
      }
    }, [
      h("div", { style: { fontWeight: 700, color: "#1e1b4b", marginBottom: "0.25rem" } },
        "Preview: " + currentSkin.name),
      h("div", { id: "envelopeTabPreview", style: { marginTop: "0.5rem" } },
        renderEnvelopeAnimation(card, { skin: currentSkin.id, playOnce: false, previewMode: true })
      )
    ])
  ]);
}

function renderEditorRight(card) {
  return h("div", { class: "editor-controls glass" }, [
    h("div", {
      style: {
        fontFamily: "'Playfair Display', serif",
        fontSize: "1.3rem", fontWeight: 700, marginBottom: "0.2rem"
      }
    }, "✍️ Personalise this card"),
    h("div", { style: { color: "var(--saf-text-soft)", fontSize: "0.85rem", marginBottom: "0.5rem" } },
      getCategoryEmoji(card.category) + " " + _L(CATEGORY_LABELS[card.category], card.category)),
    h("div", { class: "tabs-bar", id: "editorTabs" }, [
      h("div", { class: "tab active", id: "tabMessage", dataset: { tab: "message" } }, "✍️ Message"),
      h("div", { class: "tab", id: "tabStyle", dataset: { tab: "style" } }, "🎨 Style"),
      h("div", { class: "tab", id: "tabEnvelope", dataset: { tab: "envelope" } }, "✉️ Envelope")
    ]),
    h("div", { id: "tabMessagePane" }, renderMessageTab(card)),
    h("div", { id: "tabStylePane", style: { display: "none" } }, renderStyleTab(card)),
    h("div", { id: "tabEnvelopePane", style: { display: "none" } }, renderEnvelopeTab(card)),
    h("div", {
      style: {
        marginTop: "auto", display: "flex", flexDirection: "column", gap: "0.6rem",
        borderTop: "1px solid rgba(15,23,42,0.08)", paddingTop: "1rem"
      }
    }, [
      h("div", { style: { display: "flex", gap: "0.5rem", flexWrap: "wrap" } }, [
        h("button", { class: "btn btn-ghost", id: "inviteGroupBtn" }, [
          "Invite Friends to Co-Sign 🤝"
        ]),
        h("button", { class: "btn btn-ghost", id: "downloadPdfBtn" }, [
          "Download PDF"
        ])
      ])
    ]),
    h("div", {}, [
      h("label", {}, "Font Color"),
      h("div", { style: { display: "flex", gap: "0.4rem", flexWrap: "wrap" }, id: "fontColorRow" },
        FONT_COLOR_PRESETS.map((c, i) => h("button", {
          class: "btn",
          id: "fc_" + i,
          "data-color": c,
          style: {
            width: "32px", height: "32px", padding: 0,
            background: c, borderRadius: "50%",
            border: state.editor.fontColor === c ? "3px solid var(--saf-primary)" : "2px solid #fff",
            boxShadow: "var(--shadow-sm)"
          }
        }, ""))
      )
    ]),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.8rem" } }, [
      renderColorField("backgroundColor", "Background", state.editor.backgroundColor),
      renderColorField("accentColor", "Accent / Trim", state.editor.accentColor)
    ]),
    h("div", {}, [
      h("label", {}, "Font Size: " + state.editor.fontSize + "px"),
      h("input", {
        id: "f_fontSize",
        type: "range",
        min: 16, max: 48, step: 1, value: state.editor.fontSize,
        style: { width: "100%" }
      })
    ]),
    h("div", { id: "stickerSectionWrap", style: { display: "flex", flexDirection: "column", gap: "0.45rem" } }, [
      h("label", { style: { fontSize: "0.85rem", color: "var(--saf-text-soft)" } }, "Stickers (tap to add)"),
      h("div", { style: { display: "flex", gap: "0.3rem", flexWrap: "wrap" }, id: "stickerCatTabs" },
        Object.entries(STICKER_CATEGORIES).map(([key, cat]) => h("button", {
          class: "btn " + (state.editor.activeStickerCat === key ? "btn-primary" : "btn-ghost"),
          id: "stcat_" + key,
          "data-cat": key,
          style: { padding: "0.28rem 0.55rem", fontSize: "0.78rem", borderRadius: "999px" }
        }, cat.label))
      ),
      h("div", { style: { display: "flex", gap: "0.3rem", flexWrap: "wrap", maxHeight: "120px", overflowY: "auto" }, id: "stickerRow" },
        (STICKER_CATEGORIES[state.editor.activeStickerCat]?.items || []).map((s, i) => h("button", {
          class: "btn btn-ghost",
          id: "stk_" + state.editor.activeStickerCat + "_" + i,
          "data-sticker": s,
          "data-cat": state.editor.activeStickerCat,
          style: { fontSize: "1.35rem", padding: "0.3rem 0.5rem", borderRadius: "0.55rem" }
        }, s))
      )
    ])
  ]);
  return wrap;
}

function renderColorField(key, label, value) {
  return h("div", {}, [
    h("label", {}, label),
    h("div", { style: { display: "flex", gap: "0.5rem", alignItems: "center" } }, [
      h("input", {
        id: "f_" + key,
        type: "color",
        value: value,
        style: { width: "46px", height: "40px", padding: 0, border: "none", background: "transparent" }
      }),
      h("input", {
        id: "f_" + key + "_hex",
        type: "text",
        value: value,
        style: { flex: 1, fontFamily: "monospace" }
      })
    ])
  ]);
}

function renderField(id, label, type = "text", value = "", placeholder = "") {
  return h("div", {}, [
    h("label", {
      style: {
        display: "block",
        fontSize: "0.8rem",
        color: "var(--saf-text-soft)",
        marginBottom: "0.25rem"
      }
    }, label),
    h("input", {
      id: "f_" + id,
      name: id,
      type: type,
      value: value,
      placeholder: placeholder,
      autocomplete: id.includes("email") ? "email" : id.includes("name") ? "name" : "off",
      style: {
        width: "100%",
        padding: "0.55rem 0.7rem",
        borderRadius: "0.5rem",
        border: "1px solid rgba(15,23,42,0.12)",
        fontFamily: "inherit",
        boxSizing: "border-box"
      }
    })
  ]);
}

function attachEditorListeners(card) {
  document.getElementById("flipBtn").addEventListener("click", () => {
    state.flipped = !state.flipped;
    const wrap = document.getElementById("cardFlipWrapper");
    if (wrap) wrap.classList.toggle("card-flipped", state.flipped);
    const btn = document.getElementById("flipBtn");
    if (btn) btn.textContent = "🔄 " + (state.flipped ? "Show Cover" : "Open Card");
  });
  document.getElementById("tabMessage").addEventListener("click", () => switchEditorTab("message"));
  document.getElementById("tabStyle").addEventListener("click", () => switchEditorTab("style"));
  const envTabEl = document.getElementById("tabEnvelope");
  if (envTabEl) envTabEl.addEventListener("click", () => switchEditorTab("envelope"));

  ENVELOPE_SKINS.forEach((skin) => {
    const btn = document.getElementById("env_" + skin.id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (skin.id === "aurora") {
        if (!_requireTier("envelope_skin_6")) return;
        if (!_requireTier("envelope_particles")) return;
      } else if (skin.tier === "paid" || skin.tier === "unlimited") {
        if (!_requireTier("envelope_skin_6")) return;
      } else if (skin.tier === "free") {
        if (!_requireTier("envelope_skin_2")) return;
      }
      state.editor.envelopeSkin = skin.id;
      persistEditorState(state.currentSlug);
      ENVELOPE_SKINS.forEach(s2 => {
        const b2 = document.getElementById("env_" + s2.id);
        if (!b2) return;
        const isSel = s2.id === skin.id;
        b2.style.border = isSel ? "2px solid var(--saf-primary)" : "1px solid rgba(15,23,42,0.1)";
        b2.style.background = isSel ? "rgba(99,102,241,0.06)" : "#fff";
        const nameEl = b2.querySelector("div:nth-of-type(2)");
        if (nameEl) nameEl.style.fontWeight = isSel ? "700" : "500";
      });
      const prevWrap = document.getElementById("envelopeTabPreview");
      if (prevWrap) {
        prevWrap.innerHTML = "";
        const newAnim = renderEnvelopeAnimation(card, { skin: skin.id, playOnce: false, previewMode: true });
        if (newAnim) prevWrap.appendChild(newAnim);
      }
    });
  });

  ["fromName", "toName", "fromEmail", "toEmail"].forEach(k => {
    const el = document.getElementById("f_" + k);
    if (!el) return;
    el.addEventListener("input", () => {
      state.editor[k] = el.value;
      persistEditorState(state.currentSlug);
      updateCardBackPreview(card);
    });
  });
  const ta = document.getElementById("f_defaultText");
  let tDebounce = null;
  if (ta) ta.addEventListener("input", () => {
    clearTimeout(tDebounce);
    tDebounce = setTimeout(() => {
      state.editor.defaultText = ta.value;
      persistEditorState(state.currentSlug);
      updateCardBackPreview(card);
    }, 120);
  });
  ["sendDate", "sendTime"].forEach(k => {
    const el = document.getElementById("f_" + k);
    if (el) el.addEventListener("change", () => {
      state.editor[k] = el.value;
      persistEditorState(state.currentSlug);
    });
  });

  FONT_FAMILIES.forEach((f, i) => {
    const btn = document.getElementById("ff_" + i);
    if (!btn) return;
    applySelectedOutline(btn, state.editor.fontFamily === f);
    btn.addEventListener("click", () => {
      if (i >= 1 && !_requireTier("advanced_fonts")) return;
      state.editor.fontFamily = f;
      persistEditorState(state.currentSlug);
      FONT_FAMILIES.forEach((_, j) => {
        const b2 = document.getElementById("ff_" + j);
        if (b2) applySelectedOutline(b2, j === i);
      });
      updateCardBackPreview(card);
    });
  });

  FONT_COLOR_PRESETS.forEach((c, i) => {
    const btn = document.getElementById("fc_" + i);
    if (!btn) return;
    btn.style.border = state.editor.fontColor === c ? "3px solid var(--saf-primary)" : "2px solid #fff";
    btn.addEventListener("click", () => {
      state.editor.fontColor = c;
      persistEditorState(state.currentSlug);
      FONT_COLOR_PRESETS.forEach((_, j) => {
        const b2 = document.getElementById("fc_" + j);
        if (b2) b2.style.border = j === i ? "3px solid var(--saf-primary)" : "2px solid #fff";
      });
      updateCardBackPreview(card);
    });
  });

  ["backgroundColor", "accentColor"].forEach(k => {
    const picker = document.getElementById("f_" + k);
    const hex = document.getElementById("f_" + k + "_hex");
    if (picker) picker.addEventListener("input", () => {
      state.editor[k] = picker.value;
      if (hex) hex.value = picker.value;
      persistEditorState(state.currentSlug);
      updateCardBackPreview(card);
    });
    if (hex) hex.addEventListener("change", () => {
      const v = /^#[0-9a-fA-F]{6}$/.test(hex.value) ? hex.value : state.editor[k];
      state.editor[k] = v;
      if (picker) picker.value = v;
      persistEditorState(state.currentSlug);
      updateCardBackPreview(card);
    });
  });

  const fs = document.getElementById("f_fontSize");
  if (fs) fs.addEventListener("input", () => {
    state.editor.fontSize = parseInt(fs.value, 10) || 24;
    fs.previousElementSibling && (fs.previousElementSibling.textContent = "Font Size: " + state.editor.fontSize + "px");
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  });

  const ls = document.getElementById("f_letterSpacing");
  if (ls) ls.addEventListener("input", () => {
    if (parseFloat(ls.value) !== 0 && !_requireTier("letter_line_ctrl")) { ls.value = "0"; return; }
    state.editor.letterSpacing = parseFloat(ls.value) || 0;
    const v = state.editor.letterSpacing;
    ls.previousElementSibling && (ls.previousElementSibling.textContent = "Letter Spacing: " + (v > 0 ? "+" : "") + v + "px");
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  });

  const lh = document.getElementById("f_lineHeight");
  if (lh) lh.addEventListener("input", () => {
    const n = parseFloat(lh.value) || 1.55;
    if (Math.abs(n - 1.55) > 0.001 && !_requireTier("letter_line_ctrl")) { lh.value = "1.55"; return; }
    state.editor.lineHeight = n;
    lh.previousElementSibling && (lh.previousElementSibling.textContent = "Line Height: " + state.editor.lineHeight.toFixed(2));
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  });

  const tm = document.getElementById("f_textMask");
  if (tm) tm.addEventListener("click", () => {
    if (!state.editor.textMask && !_requireTier("text_mask")) return;
    state.editor.textMask = !state.editor.textMask;
    tm.className = "btn " + (state.editor.textMask ? "btn-primary" : "btn-ghost");
    tm.textContent = state.editor.textMask ? "ON" : "OFF";
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  });

  const ltUp = document.getElementById("f_layerTextUp");
  if (ltUp) ltUp.addEventListener("click", () => {
    if (!_requireTier("layer_order")) return;
    state.editor.stickerZ = 1;
    window.toast("Text layer moved to front", "success");
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  });
  const lsUp = document.getElementById("f_layerStickerUp");
  if (lsUp) lsUp.addEventListener("click", () => {
    if (!_requireTier("layer_order")) return;
    state.editor.stickerZ = 10;
    window.toast("Stickers moved to front", "success");
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  });

  Object.keys(STICKER_CATEGORIES).forEach(catKey => {
    const tabBtn = document.getElementById("stcat_" + catKey);
    if (!tabBtn) return;
    tabBtn.addEventListener("click", () => {
      if (catKey !== "hearts" && !_requireTier("sticker_categories")) return;
      state.editor.activeStickerCat = catKey;
      Object.keys(STICKER_CATEGORIES).forEach(k => {
        const b = document.getElementById("stcat_" + k);
        if (!b) return;
        b.className = "btn " + (k === catKey ? "btn-primary" : "btn-ghost");
      });
      const row = document.getElementById("stickerRow");
      if (row) {
        row.innerHTML = "";
        const items = STICKER_CATEGORIES[catKey]?.items || [];
        items.forEach((s, i) => {
          const b2 = document.createElement("button");
          b2.className = "btn btn-ghost";
          b2.id = "stk_" + catKey + "_" + i;
          b2.dataset.sticker = s;
          b2.dataset.cat = catKey;
          Object.assign(b2.style, { fontSize: "1.35rem", padding: "0.3rem 0.5rem", borderRadius: "0.55rem" });
          b2.textContent = s;
          b2.addEventListener("click", () => _bindStickerClick(s));
          row.appendChild(b2);
        });
      }
      persistEditorState(state.currentSlug);
    });
  });
  function _bindStickerClick(s) {
    if (state.editor.stickers.length >= 6 && !_requireTier("stickers_over_6")) return;
    state.editor.stickers.push({
      emoji: s,
      x: 0.15 + 0.7 * Math.random(),
      y: 0.15 + 0.7 * Math.random()
    });
    if (state.editor.stickers.length > 12) state.editor.stickers.shift();
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
  }
  (STICKER_CATEGORIES[state.editor.activeStickerCat]?.items || []).forEach((s, i) => {
    const btn = document.getElementById("stk_" + state.editor.activeStickerCat + "_" + i);
    if (!btn) return;
    btn.addEventListener("click", () => _bindStickerClick(s));
  });

  BORDER_PRESETS.forEach(b => {
    const btn = document.getElementById("bdr_" + b.id);
    if (!btn) return;
    btn.addEventListener("click", () => {
      if (b.id !== "none" && !_requireTier("decorative_border")) return;
      state.editor.borderType = b.id;
      BORDER_PRESETS.forEach(b2 => {
        const b2el = document.getElementById("bdr_" + b2.id);
        if (!b2el) return;
        b2el.className = "btn " + (b2.id === b.id ? "btn-primary" : "btn-ghost");
        b2el.style.border = b2.id === b.id
          ? "2px solid var(--saf-primary)"
          : "1px solid rgba(15,23,42,0.1)";
      });
      persistEditorState(state.currentSlug);
      updateCardBackPreview(card);
    });
  });

  document.getElementById("inviteGroupBtn").addEventListener("click", () => {
    if (!_requireTier("group_collab_2")) return;
    handleInviteGroup(card);
  });
  document.getElementById("downloadPdfBtn").addEventListener("click", () => {
    if (!_requireTier("pdf_export")) return;
    handleDownloadPdf(card);
  });
  document.getElementById("schedulePayBtn").addEventListener("click", () => handleScheduleAndPay(card));

  const sDateEl = document.getElementById("f_sendDate");
  if (sDateEl) sDateEl.addEventListener("change", () => {
    const v = sDateEl.value;
    if (!v) return;
    const now = new Date(); now.setHours(0,0,0,0);
    const pick = new Date(v);
    const diffDays = Math.ceil((pick - now) / 86400000);
    if (diffDays > 7 && diffDays <= 30 && !_requireTier("schedule_30d", { silent: true })) {
      const ok = _requireTier("schedule_7d");
      if (!ok) { const fallback = new Date(now.getTime() + 7*86400000); sDateEl.value = fallback.toISOString().slice(0,10); }
    } else if (diffDays > 30 && !_requireTier("schedule_365d")) {
      const fallback = new Date(now.getTime() + 7*86400000);
      sDateEl.value = fallback.toISOString().slice(0,10);
    }
  });

  const aiBtn = document.getElementById("genAIMsgBtn");
  const aiRegen = document.getElementById("regenAIMsgBtn");
  const quotaLabel = document.getElementById("aiQuotaLabel");
  const aiHandler = () => runAIGenerate(card, false);
  if (aiBtn) aiBtn.addEventListener("click", aiHandler);
  if (aiRegen) aiRegen.addEventListener("click", () => runAIGenerate(card, true));
  if (quotaLabel) quotaLabel.textContent = detectTierLabel();
}

function detectTierLabel() {
  const email = state.editor?.fromEmail || "";
  const paidCookies = /saf_paid=1|saf_plan=monthly|saf_plan=annual|saf_plan=group/.test(document.cookie || "");
  if (paidCookies) return `✨ ${AI_TIER_LABELS.paid.daily}/day — paid`;
  if (email && /.+@.+\..+/.test(email)) return `${AI_TIER_LABELS.free.daily}/day — free account`;
  return `${AI_TIER_LABELS.anon.daily}/day — guest`;
}

function _aiPick(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function _categoryToOccasion(cat) {
  if (!cat) return "default";
  const c = String(cat).toLowerCase();
  if (/birthday|birth|anniversary/.test(c)) return "birthday";
  if (/love|valentine|romantic|wedding|engagement/.test(c)) return "love";
  if (/thank|thanks|gratitude|appreciation/.test(c)) return "thanks";
  if (/congrat|congrats|graduation|promotion|new.*job|newbaby|baby/.test(c)) return "congrats";
  if (/getwell|get-well|sympathy|recovery|healing|illness/.test(c)) return "getwell";
  return "default";
}

function generateAIMessageLocal(card, toName, fromName) {
  const lang = (window.SAF_LOCALE || document.documentElement?.lang || "en").slice(0, 2).toLowerCase();
  const bank = AI_WORDBANK[lang] || AI_WORDBANK.en;
  const occasion = _categoryToOccasion(card?.category);
  const bodyPool = bank.bodies[occasion] || bank.bodies.default;
  const toLabel = toName && String(toName).trim() ? String(toName).trim() : "there";
  const fromLabel = fromName && String(fromName).trim() ? String(fromName).trim() : "";
  const opening = _aiPick(bank.openings).replaceAll("{to}", toLabel);
  const body = _aiPick(bodyPool);
  const closing = _aiPick(bank.closings);
  const signoff = _aiPick(bank.signoffs).replaceAll("{from}", fromLabel || "me");
  if (fromLabel) {
    return `${opening}\n\n${body}\n\n${closing}\n${signoff}`;
  }
  return `${opening}\n\n${body}\n\n${closing}`;
}

function _resolveCurrentTier() {
  const ck = document.cookie || "";
  if (/(^|;\s*)saf_plan=annual(;|$)/.test(ck)) return "unlimited";
  if (/(^|;\s*)saf_plan=(monthly|group_pass)(;|$)/.test(ck)) return "paid";
  if (/(^|;\s*)saf_paid=1(;|$)/.test(ck)) return "paid";
  const email = (state.editor?.fromEmail || "").trim();
  if (email && /.+@.+\..+/.test(email)) return "free";
  return "anon";
}

function _requireTier(featureKey, opts) {
  const ft = FEATURE_TIER_MATRIX[featureKey];
  if (!ft) return true;
  const current = _resolveCurrentTier();
  const need = TIER_RANK[ft.min] ?? 0;
  const have = TIER_RANK[current] ?? 0;
  if (have >= need) return true;
  if (!(opts && opts.silent)) openUpgradeModal(featureKey);
  return false;
}

function openUpgradeModal(featureKey) {
  const ft = FEATURE_TIER_MATRIX[featureKey] || { name: "This feature", min: "paid" };
  const current = _resolveCurrentTier();
  const id = "saf_upgrade_modal";
  const old = document.getElementById(id);
  if (old) old.remove();
  const root = document.documentElement;
  const locale = (window.SAF_LOCALE || root.lang || "en").slice(0, 2).toLowerCase();
  const T = {
    en: {
      title: "Unlock ✨ Premium Feature",
      need: " needs a paid plan",
      current: "Current plan",
      why: "Why upgrade?",
      perks: ["Watermark-free HD cards", "Unlimited AI messages", "Premium fonts, borders & GIF effects", "Schedule 365 days in advance", "Dual-audio MP4 & 4K export"],
      monthly: "Monthly",
      monthlySub: "Billed monthly, cancel anytime",
      annual: "Annual · Save 40%",
      annualSub: "Best value for heavy users",
      perSend: "Pay-per-send",
      perSendSub: "Just $2.99 per card, unlocks all",
      startMonthly: "Go Monthly — $9.99",
      startAnnual: "Go Annual — $79/yr",
      startSend: "Send this card — $2.99",
      close: "Maybe later",
      required: "Required"
    },
    es: { title:"✨ Función Premium", need:" requiere un plan de pago", current:"Plan actual", why:"¿Por qué actualizar?",
      perks:["Tarjetas HD sin marca de agua","Mensajes con IA ilimitados","Fuentes, bordes y efectos GIF premium","Programar con 365 días de antelación","MP4 con audio doble y exportación 4K"],
      monthly:"Mensual", monthlySub:"Facturado mensualmente, cancela cuando quieras",
      annual:"Anual · Ahorra 40%", annualSub:"La mejor relación calidad-precio",
      perSend:"Por envío", perSendSub:"Solo $2.99 por tarjeta, desbloquea todo",
      startMonthly:"Pasar a Mensual — $9.99", startAnnual:"Pasar a Anual — $79/año",
      startSend:"Enviar esta tarjeta — $2.99", close:"Quizás más tarde", required:"Requerido"},
    fr: { title:"✨ Fonction Premium", need:" nécessite un plan payant", current:"Plan actuel", why:"Pourquoi passer à la version supérieure ?",
      perks:["Cartes HD sans filigrane","Messages IA illimités","Polices, bordures et effets GIF premium","Programmation 365 jours à l'avance","Export MP4 double audio et 4K"],
      monthly:"Mensuel", monthlySub:"Facturé mensuellement, résiliation à tout moment",
      annual:"Annuel · Économisez 40%", annualSub:"Le meilleur rapport qualité-prix",
      perSend:"À l'envoi", perSendSub:"2.99 $ par carte, tout débloquer",
      startMonthly:"Passer au forfait mensuel — 9,99 $", startAnnual:"Passer au forfait annuel — 79 $/an",
      startSend:"Envoyer cette carte — 2,99 $", close:"Plus tard", required:"Requis"},
    pt: { title:"✨ Recurso Premium", need:" requer um plano pago", current:"Plano atual", why:"Por que atualizar?",
      perks:["Cartões HD sem marca d'água","Mensagens de IA ilimitadas","Fontes, bordas e efeitos GIF premium","Agendar com 365 dias de antecedência","Exportação MP4 com áudio duplo e 4K"],
      monthly:"Mensal", monthlySub:"Cobrado mensalmente, cancele quando quiser",
      annual:"Anual · Economize 40%", annualSub:"Melhor custo-benefício",
      perSend:"Por envio", perSendSub:"Apenas $2.99 por cartão, libera tudo",
      startMonthly:"Assinar Mensal — $9.99", startAnnual:"Assinar Anual — $79/ano",
      startSend:"Enviar este cartão — $2.99", close:"Talvez depois", required:"Necessário"}
  };
  const t = T[locale] || T.en;

  const overlay = h("div", { id, onclick(ev) { if (ev.target.id === id) close(); },
    style: { position:"fixed", inset:0, background:"rgba(15,23,42,0.55)", zIndex:9998,
      display:"flex", alignItems:"center", justifyContent:"center", padding:"1rem", backdropFilter:"blur(4px)" } }, [
    h("div", { style: { width:"100%", maxWidth:"560px", background:"#fff", borderRadius:"20px", boxShadow:"0 30px 80px rgba(15,23,42,0.35)", overflow:"hidden", border:"1px solid rgba(139,92,246,0.2)" } }, [
      h("div", { style: { padding:"1.4rem 1.5rem 0.6rem", background:"linear-gradient(135deg,#8b5cf6 0%,#ec4899 100%)", color:"#fff" } }, [
        h("div", { style: { display:"flex", alignItems:"center", justifyContent:"space-between" } }, [
          h("div", { style: { fontFamily:"'Playfair Display',serif", fontSize:"1.5rem", fontWeight:800, letterSpacing:"-0.01em" } }, t.title),
          h("button", { onclick: close, "aria-label":"Close", style: { background:"rgba(255,255,255,0.18)", border:"none", color:"#fff", width:"34px", height:"34px", borderRadius:"999px", cursor:"pointer", fontWeight:700 } }, "×")
        ]),
        h("div", { style: { marginTop:"0.3rem", opacity:0.95, fontSize:"0.95rem" } }, [
          h("strong", {}, ft.name), t.need, h("span", { style: { marginLeft:"0.6rem", fontSize:"0.8rem", opacity:0.85 } }, "(" + t.required + ": " + TIER_LABEL[ft.min] + "+)")
        ])
      ]),
      h("div", { style: { padding:"1.2rem 1.5rem" } }, [
        h("div", { style: { fontSize:"0.82rem", color:"#6b7280", marginBottom:"0.5rem" } }, t.current + ": " + TIER_LABEL[current]),
        h("div", { style: { fontSize:"0.92rem", fontWeight:700, color:"#1e1b4b", marginBottom:"0.55rem" } }, t.why),
        h("ul", { style: { listStyle:"none", padding:0, margin:"0 0 1rem", display:"grid", gap:"0.3rem", fontSize:"0.88rem", color:"#374151" } },
          t.perks.map(p => h("li", { style: { display:"flex", gap:"0.45rem", alignItems:"flex-start" } }, [
            h("span", { style: { color:"#10b981", fontWeight:800 } }, "✓"), h("span", {}, p)
          ]))
        ),
        h("div", { style: { display:"grid", gap:"0.6rem" } }, [
          h("button", { onclick() { close(); window.location.href = "/pricing?pick=annual"; },
            style: { width:"100%", padding:"0.9rem 1rem", borderRadius:"12px", border:"none", background:"linear-gradient(135deg,#8b5cf6,#ec4899)", color:"#fff", fontWeight:800, fontSize:"0.95rem", cursor:"pointer", boxShadow:"0 10px 25px rgba(139,92,246,0.35)" } },
            [ h("div", { style: { fontSize:"1rem" } }, t.startAnnual), h("div", { style: { fontSize:"0.75rem", fontWeight:500, opacity:0.95, marginTop:"2px" } }, t.annualSub) ]
          ),
          h("div", { style: { display:"grid", gridTemplateColumns:"1fr 1fr", gap:"0.5rem" } }, [
            h("button", { onclick() { close(); window.location.href = "/pricing?pick=monthly"; },
              style: { padding:"0.7rem 0.9rem", borderRadius:"12px", border:"1.5px solid rgba(139,92,246,0.55)", background:"#fff", color:"#6d28d9", fontWeight:700, fontSize:"0.88rem", cursor:"pointer" } },
              [ h("div", { style: { fontWeight:800 } }, t.startMonthly), h("div", { style: { fontSize:"0.72rem", color:"#6b7280", marginTop:"2px" } }, t.monthlySub) ]
            ),
            h("button", { onclick() { close(); const sb = document.getElementById("schedulePayBtn"); if (sb) sb.click(); },
              style: { padding:"0.7rem 0.9rem", borderRadius:"12px", border:"1.5px solid rgba(16,185,129,0.55)", background:"#ecfdf5", color:"#047857", fontWeight:700, fontSize:"0.88rem", cursor:"pointer" } },
              [ h("div", { style: { fontWeight:800 } }, t.startSend), h("div", { style: { fontSize:"0.72rem", color:"#6b7280", marginTop:"2px" } }, t.perSendSub) ]
            )
          ])
        ])
      ]),
      h("div", { style: { textAlign:"center", padding:"0 1.5rem 1.2rem" } }, [
        h("button", { onclick: close, style: { background:"transparent", border:"none", color:"#6b7280", fontSize:"0.84rem", cursor:"pointer", textDecoration:"underline" } }, t.close)
      ])
    ])
  ]);

  function close() { const el = document.getElementById(id); if (el) el.remove(); }
  document.body.appendChild(overlay);
}

async function runAIGenerate(card, forceRegen) {
  const btn = document.getElementById("genAIMsgBtn");
  const quotaLabel = document.getElementById("aiQuotaLabel");
  const ta = document.getElementById("f_defaultText");
  if (btn) { btn.disabled = true; btn.style.opacity = "0.65"; btn.textContent = "Generating…"; }
  try {
    let msg = "";
    let quota = null;
    try {
      const resp = await fetch(API_BASE + "/ai/message", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          occasion: _categoryToOccasion(card?.category),
          category: card?.category || "",
          to_name: state.editor.toName || "",
          from_name: state.editor.fromName || "",
          from_email: state.editor.fromEmail || "",
          locale: (window.SAF_LOCALE || document.documentElement?.lang || "en").slice(0, 2),
          force_regen: !!forceRegen,
          slug: state.currentSlug || card?.slug || ""
        })
      });
      if (resp.ok) {
        const json = await resp.json();
        msg = json.message || "";
        quota = json.quota || null;
      }
    } catch (_err) {
    }
    if (!msg) msg = generateAIMessageLocal(card, state.editor.toName, state.editor.fromName);
    if (ta) ta.value = msg;
    state.editor.defaultText = msg;
    persistEditorState(state.currentSlug);
    updateCardBackPreview(card);
    if (quota && quotaLabel) {
      quotaLabel.textContent = `${quota.used}/${quota.daily} used · ${quota.tier}`;
    }
    window.toast(forceRegen ? "Regenerated ✨" : "AI message generated ✨", "success");
  } catch (err) {
    window.toast("AI generation failed. Wrote a local draft instead.", "error");
  } finally {
    if (btn) { btn.disabled = false; btn.style.opacity = "1"; btn.textContent = "✨ Generate AI Message"; }
  }
}

function applySelectedOutline(btn, selected) {
  if (!btn) return;
  if (selected) {
    btn.style.outline = "3px solid var(--saf-primary)";
    btn.style.outlineOffset = "2px";
  } else {
    btn.style.outline = "none";
  }
}

function switchEditorTab(name) {
  state.activeTab = name;
  const msgTab = document.getElementById("tabMessage");
  const styTab = document.getElementById("tabStyle");
  const envTab = document.getElementById("tabEnvelope");
  const msgPane = document.getElementById("tabMessagePane");
  const styPane = document.getElementById("tabStylePane");
  const envPane = document.getElementById("tabEnvelopePane");
  const tabs = [[msgTab, msgPane, "message"], [styTab, styPane, "style"], [envTab, envPane, "envelope"]];
  tabs.forEach(([tab, pane, key]) => {
    if (!tab || !pane) return;
    if (name === key) {
      tab.classList.add("active");
      pane.style.display = "";
    } else {
      tab.classList.remove("active");
      pane.style.display = "none";
    }
  });
}

function updateCardBackPreview(card) {
  const e = state.editor;
  const accent = document.getElementById("cardBackAccent");
  if (accent) accent.style.background = e.accentColor;
  const blur = document.getElementById("cardBackBlur");
  if (blur) blur.style.background = e.backgroundColor.startsWith("#ffffff")
    ? "rgba(255,255,255,0.35)"
    : hexToRgba(e.backgroundColor, 0.45);
  const content = document.getElementById("cardBackContent");
  if (!content) return;
  const parent = content.parentElement;

  const existingStickers = parent.querySelectorAll("[data-sticker-mark]");
  existingStickers.forEach(n => n.remove());
  const existingMask = parent.querySelector("[data-textmask-mark]");
  if (existingMask) existingMask.remove();
  const existingBorder = parent.querySelector("[data-border-mark]");
  if (existingBorder) existingBorder.remove();
  const existingBorderInner = parent.querySelectorAll("[data-border-inner-mark]");
  existingBorderInner.forEach(n => n.remove());

  content.innerHTML = "";
  content.style.fontFamily = e.fontFamily;
  content.style.color = e.fontColor;
  content.style.letterSpacing = e.letterSpacing + "px";
  content.style.position = "relative";
  content.style.zIndex = String(e.stickerZ >= 5 ? 6 : 2);

  if (e.textMask) {
    const mask = h("div", {
      "data-textmask-mark": "1",
      style: {
        position: "absolute",
        inset: "6% 6%",
        borderRadius: "14px",
        background: "linear-gradient(135deg, rgba(0,0,0,0.42) 0%, rgba(0,0,0,0.58) 100%)",
        backdropFilter: "blur(2px)",
        boxShadow: "inset 0 0 0 1px rgba(255,255,255,0.08), 0 8px 30px rgba(0,0,0,0.28)",
        zIndex: 1,
        pointerEvents: "none"
      }
    });
    parent.appendChild(mask);
  }

  const to = e.toName ? h("div", {
    style: {
      fontFamily: "'Playfair Display', serif",
      fontSize: Math.min(e.fontSize + 6, 40) + "px",
      fontWeight: 700, marginBottom: "10px",
      letterSpacing: (e.letterSpacing * 0.5) + "px",
      lineHeight: e.lineHeight,
      textShadow: e.textMask ? "0 1px 8px rgba(0,0,0,0.55)" : "none",
      position: "relative",
      zIndex: 3
    }
  }, "Dear " + escapeHtml(e.toName) + ",") : null;
  const fromHead = e.fromName
    ? h("div", { style: {
        marginTop: "12px", opacity: 0.85,
        fontSize: Math.min(e.fontSize - 2, 22) + "px",
        textShadow: e.textMask ? "0 1px 6px rgba(0,0,0,0.5)" : "none",
        position: "relative", zIndex: 3
      } },
        "From " + escapeHtml(e.fromName))
    : null;
  const lines = splitTextToLines(e.defaultText || "", 44);
  const lineNodes = lines.map(line => h("div", {
    style: {
      fontSize: e.fontSize + "px",
      lineHeight: e.lineHeight,
      letterSpacing: e.letterSpacing + "px",
      margin: "3px 0",
      textShadow: e.textMask ? "0 1px 6px rgba(0,0,0,0.5)" : "none",
      position: "relative",
      zIndex: 3
    }
  }, escapeHtml(line)));

  if (to) content.appendChild(to);
  const msgWrap = h("div", {
    style: {
      flex: 1,
      display: "flex",
      flexDirection: "column",
      justifyContent: "center",
      alignItems: "center",
      width: "100%",
      position: "relative",
      zIndex: 3
    }
  }, lineNodes);
  content.appendChild(msgWrap);
  if (fromHead) content.appendChild(fromHead);

  const stickerZIndex = e.stickerZ >= 5 ? 10 : 1;
  e.stickers.forEach((st, i) => {
    const s = h("div", {
      "data-sticker-mark": String(i),
      style: {
        position: "absolute",
        left: (st.x * 100) + "%",
        top: (st.y * 100) + "%",
        transform: "translate(-50%, -50%)",
        fontSize: "34px",
        pointerEvents: "none",
        filter: "drop-shadow(0 2px 6px rgba(0,0,0,0.2))",
        zIndex: stickerZIndex
      }
    }, st.emoji);
    parent.appendChild(s);
  });

  const bp = BORDER_PRESETS.find(b => b.id === e.borderType);
  if (bp && bp.id !== "none" && bp.css) {
    const borderWidth = parseInt(bp.css, 10) || 8;
    const outer = h("div", {
      "data-border-mark": "1",
      style: {
        position: "absolute",
        inset: "0",
        borderRadius: bp.radius ? "18px" : "0",
        padding: borderWidth + "px",
        background: bp.grad,
        boxShadow: "0 10px 40px rgba(0,0,0,0.18)",
        zIndex: 20,
        pointerEvents: "none",
        boxSizing: "border-box"
      }
    }, [
      h("div", {
        "data-border-inner-mark": "1",
        style: {
          width: "100%",
          height: "100%",
          borderRadius: bp.radius > 1 ? "12px" : "10px",
          border: bp.id === "double_gold" ? (borderWidth + "px solid transparent") : "none",
          background: bp.id === "double_gold"
            ? "linear-gradient(#fff,#fff) padding-box, " + bp.grad + " border-box"
            : "transparent",
          boxShadow: bp.inset ? "inset 0 0 0 1px rgba(255,255,255,0.25)" : "none"
        }
      })
    ]);
    parent.appendChild(outer);
    if (bp.id === "double_gold") {
      const inner = h("div", {
        "data-border-inner-mark": "2",
        style: {
          position: "absolute",
          inset: (borderWidth * 2 + 6) + "px",
          borderRadius: "6px",
          border: "2px solid rgba(217,119,6,0.45)",
          zIndex: 21,
          pointerEvents: "none"
        }
      });
      parent.appendChild(inner);
    }
  }
}

function hexToRgba(hex, alpha) {
  if (!hex || hex[0] !== "#" || hex.length < 7) return "rgba(255,255,255,0.35)";
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return "rgba(" + r + "," + g + "," + b + "," + alpha + ")";
}

function validateEditorBasics(showToastFlag) {
  const e = state.editor;
  if (!e.toEmail || !/.+@.+\..+/.test(e.toEmail)) {
    if (showToastFlag) window.toast("Please enter a valid recipient email", "error");
    return false;
  }
  if (!e.fromEmail || !/.+@.+\..+/.test(e.fromEmail)) {
    if (showToastFlag) window.toast("Please enter your email", "error");
    return false;
  }
  if (!e.defaultText || !e.defaultText.trim()) {
    if (showToastFlag) window.toast("Please write a short message", "error");
    return false;
  }
  return true;
}

function handleInviteGroup(card) {
  if (!validateEditorBasics(true)) return;
  window.toast("🔗 Creating your group card link…", "info");
  const body = {
    cardSlug: card.slug,
    ownerEmail: state.editor.fromEmail,
    ownerName: state.editor.fromName,
    recipientName: state.editor.toName,
    recipientEmail: state.editor.toEmail,
    defaultText: state.editor.defaultText,
    bgImage: card.bgImageWatermark || card.bgImage
  };
  fetch(API_BASE + "/group/create", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => {
    if (!r.ok) throw new Error("Group creation failed");
    return r.json();
  }).then(data => {
    const token = data.token || data.groupToken;
    if (!token) throw new Error("No token received");
    const url = location.origin + "/group/" + token;
    return navigator.clipboard.writeText(url).then(() => {
      window.toast("✅ Shareable group link copied!", "success");
    }).catch(() => {
      window.prompt("Copy this group link:", url);
      window.toast("✅ Group link ready (paste it!)", "success");
    });
  }).catch(e => {
    window.toast("Network error: " + e.message, "error");
  });
}

function handleDownloadPdf(card) {
  window.toast("🖨️ Opening print dialog — save as PDF", "info");
  setTimeout(() => window.print(), 200);
}

function handleScheduleAndPay(card) {
  if (!validateEditorBasics(true)) return;
  window.toast("🔍 Checking your plan…", "info");
  fetch(API_BASE + "/check-member", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ email: state.editor.fromEmail })
  }).then(r => {
    if (!r.ok) throw new Error("Membership check failed");
    return r.json();
  }).then(data => {
    state.isMember = !!data.isMember;
    if (state.isMember || data.plan === "free_trial") {
      window.toast("✨ Member detected — sending right now!", "success");
      sendCardDirectly(card);
    } else {
      showPricingCheckoutModal(card);
    }
  }).catch(e => {
    window.toast("Network error: " + e.message, "error");
  });
}

function sendCardDirectly(card) {
  const e = state.editor;
  const payload = {
    fromEmail: e.fromEmail,
    toEmail: e.toEmail,
    fromName: e.fromName,
    toName: e.toName,
    imageUrl: card.bgImage || card.bgImageWatermark,
    backgroundColor: e.backgroundColor,
    accentColor: e.accentColor,
    cardSlug: card.slug,
    message: e.defaultText,
    fontFamily: e.fontFamily,
    fontColor: e.fontColor,
    fontSize: e.fontSize,
    scheduleDate: e.sendDate,
    scheduleTime: e.sendTime,
    stickers: e.stickers
  };
  fetch(API_BASE + "/send-card", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(payload)
  }).then(r => {
    if (!r.ok) throw new Error("Send failed");
    return r.json();
  }).then(data => {
    window.toast("🎉 Card scheduled for delivery!", "success");
    setTimeout(() => {
      history.pushState({}, "", "/");
      renderRoute();
    }, 1400);
  }).catch(e => {
    window.toast("Network error: " + e.message, "error");
  });
}

function showPricingCheckoutModal(card) {
  const products = window.PRODUCTS || [];
  const payPerSend = products.find(p => p.creem_product_id === PRODUCT_IDS.pay_per_send);
  const monthly = products.find(p => p.creem_product_id === PRODUCT_IDS.monthly);
  const annual = products.find(p => p.creem_product_id === PRODUCT_IDS.annual);
  const group = products.find(p => p.creem_product_id === PRODUCT_IDS.group_pass);

  const plans = [
    { name: "Pay Per Send", price: payPerSend ? payPerSend.price : 1.99, period: "/ send", id: PRODUCT_IDS.pay_per_send, product: payPerSend, tag: "" },
    { name: "Monthly Unlimited", price: monthly ? monthly.price : 6.99, period: "/ month", id: PRODUCT_IDS.monthly, product: monthly, tag: "⭐ Popular", featured: true },
    { name: "Annual Unlimited", price: annual ? annual.price : 69, period: "/ year", id: PRODUCT_IDS.annual, product: annual, tag: "Best value" },
    { name: "Group Card Pass", price: group ? group.price : 4.99, period: " one-time", id: PRODUCT_IDS.group_pass, product: group, tag: "Invite 50 friends" }
  ];

  const modalWrap = document.createElement("div");
  modalWrap.style.cssText = "position:fixed;inset:0;z-index:200;background:rgba(15,23,42,0.45);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;";
  const modal = document.createElement("div");
  modal.className = "glass";
  modal.style.cssText = "max-width:820px;width:100%;padding:1.8rem;max-height:92vh;overflow:auto;";
  const head = h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1rem" } }, [
    h("div", {}, [
      h("h2", { style: { fontFamily: "'Playfair Display', serif", margin: 0, fontSize: "1.6rem" } }, "Choose a plan to send"),
      h("p", { style: { color: "var(--saf-text-soft)", fontSize: "0.88rem", margin: "0.3rem 0 0" } },
        "Or go unlimited and never think about per-card fees again.")
    ]),
    h("button", {
      class: "btn btn-ghost",
      style: { padding: "0.35rem 0.7rem" },
      onclick: () => modalWrap.remove()
    }, "Close")
  ]);
  const grid = h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(190px,1fr))", gap: "0.9rem" } },
    plans.map(p => h("div", {
      class: "plan-card" + (p.featured ? " featured" : ""),
      style: { padding: "1.2rem 1rem", border: "1px solid rgba(15,23,42,0.08)", position: "relative" }
    }, [
      p.tag ? h("div", {
        style: {
          fontSize: "0.7rem", fontWeight: 700, color: p.featured ? "#fff" : "var(--saf-primary-dark)",
          background: p.featured ? "linear-gradient(135deg,var(--saf-primary),var(--saf-accent))" : "rgba(99,102,241,0.1)",
          padding: "0.15rem 0.6rem", borderRadius: "999px", display: "inline-block",
          marginBottom: "0.5rem"
        }
      }, p.tag) : null,
      h("div", { class: "plan-name" }, p.name),
      h("div", { class: "plan-price" }, ["$" + p.price, h("small", {}, p.period)]),
      h("ul", { class: "plan-features", style: { fontSize: "0.78rem" } },
        (p.product && p.product.features ? p.product.features.slice(0, 3) : [
          "Beautiful animated delivery",
          "Scheduling to the minute",
          "Email confirmation & tracking"
        ]).map(f => h("li", {}, f))
      ),
      h("button", {
        class: "btn " + (p.featured ? "btn-primary" : "btn-ghost"),
        style: { width: "100%", justifyContent: "center", marginTop: "0.8rem" },
        onclick: () => {
          modalWrap.remove();
          startCheckoutSession(p.id, card);
        }
      }, "Choose Plan")
    ].filter(Boolean)))
  );
  modal.appendChild(head);
  modal.appendChild(grid);
  modalWrap.appendChild(modal);
  document.body.appendChild(modalWrap);
}

function startCheckoutSession(planId, card) {
  window.toast("🔒 Redirecting to secure checkout…", "info");
  const e = state.editor;
  const body = {
    planId: planId,
    successUrl: location.origin + "/payment-success.html",
    cancelUrl: location.origin + "/payment-cancel.html",
    customerEmail: e.fromEmail,
    customerName: e.fromName,
    cardSlug: card ? card.slug : null,
    metadata: card ? {
      fromEmail: e.fromEmail,
      toEmail: e.toEmail,
      fromName: e.fromName,
      toName: e.toName,
      imageUrl: card.bgImage || card.bgImageWatermark,
      backgroundColor: e.backgroundColor,
      accentColor: e.accentColor,
      message: e.defaultText,
      fontFamily: e.fontFamily,
      fontColor: e.fontColor,
      fontSize: e.fontSize,
      scheduleDate: e.sendDate,
      scheduleTime: e.sendTime
    } : {}
  };
  fetch(API_BASE + "/create-session", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body)
  }).then(r => {
    if (!r.ok) throw new Error("Session creation failed");
    return r.json();
  }).then(data => {
    const url = data.url || data.redirectUrl || data.checkoutUrl;
    if (!url) throw new Error("No checkout URL received");
    location.href = url;
  }).catch(e => {
    window.toast("Network error: " + e.message, "error");
  });
}

function renderGroupSign(token) {
  clearApp();
  state.groupToken = token;
  setPageTitle("Group Card · Add Your Signature · SendAFun");
  updateCanonical("/group/" + token);

  const wrap = h("div", { class: "group-page fade-in" }, [
    h("div", { class: "group-hero glass", id: "groupHero" }, [
      h("div", { class: "loading-spinner" }),
      h("p", { style: { marginTop: "0.8rem", color: "var(--saf-text-soft)" } }, "Loading group card…")
    ])
  ]);
  mountApp(wrap);

  fetch(API_BASE + "/group/" + token, { method: "GET" })
    .then(r => { if (!r.ok) throw new Error("Group card not found"); return r.json(); })
    .then(data => {
      renderGroupSignLoaded(token, data);
    })
    .catch(e => {
      window.toast("Network error: " + e.message, "error");
      const hero = document.getElementById("groupHero");
      if (hero) {
        hero.innerHTML = "";
        hero.appendChild(h("div", { style: { textAlign: "center", padding: "1.5rem" } }, [
          h("div", { style: { fontSize: "3rem", marginBottom: "0.5rem" } }, "😵"),
          h("p", { style: { margin: "0 0 0.8rem" } }, "This group link may be expired or invalid."),
          h("button", {
            class: "btn btn-primary",
            onclick: () => { history.pushState({}, "", "/"); renderRoute(); }
          }, "Go Home")
        ]));
      }
    });
}

function renderGroupSignLoaded(token, data) {
  clearApp();
  const { cardSlug, owner, signatures = [], recipientName, expiresAt } = data;
  const wrap = h("div", { class: "group-page fade-in" }, [
    h("section", { class: "group-hero glass" }, [
      h("div", { style: { fontSize: "2.4rem" } }, "🎉"),
      h("h1", {
        style: { fontFamily: "'Playfair Display', serif", margin: "0.4rem 0 0.6rem", fontSize: "1.8rem" }
      }, [
        "This is a GROUP CARD for ",
        h("span", { style: { color: "var(--saf-accent)" } },
          escapeHtml(recipientName || "the recipient")
        ),
        "!"
      ]),
      h("p", { style: { margin: "0 0 0.4rem", color: "var(--saf-text-soft)" } },
        "Add your signature below, then the organiser sends the big reveal 🎁"),
      h("div", { style: { color: "var(--saf-text-soft)", fontSize: "0.85rem" } }, [
        "💌 " + signatures.length + " signature(s) so far · ",
        "👤 Organised by " + escapeHtml(owner || "someone"),
        expiresAt ? h("span", {}, " · Expires " + new Date(expiresAt).toLocaleDateString()) : null
      ])
    ]),
    h("section", {
      class: "glass",
      style: { padding: "1.5rem", marginTop: "1.5rem", display: "grid", gridTemplateColumns: "1.2fr 1fr", gap: "1.5rem" }
    }, [
      h("div", {}, [
        h("h3", { style: { fontFamily: "'Playfair Display', serif", marginTop: 0 } },
          "💖 Signatures so far (" + signatures.length + ")"),
        h("div", { class: "signature-grid", id: "signatureGrid" },
          signatures.map(sig => renderSignatureCard(sig))
        )
      ]),
      renderSignatureForm(token)
    ]),
    h("div", { class: "group-cta-row" }, [
      h("button", {
        class: "btn btn-ghost",
        id: "copyGroupLinkBtn"
      }, "📋 Copy Share Link"),
      h("button", {
        class: "btn btn-primary",
        id: "sendGroupCardBtn",
        disabled: true
      }, "🎁 Send the Group Card")
    ])
  ]);
  mountApp(wrap);
  attachGroupSignListeners(token, data);
}

function renderSignatureCard(sig) {
  return h("div", { class: "signature-card glass" }, [
    h("div", { class: "signature-avatar" }, sig.avatarEmoji || "💖"),
    h("div", { class: "signature-body" }, [
      h("div", { class: "signature-name" }, escapeHtml(sig.name || sig.signerName || "Anonymous")),
      h("div", { class: "signature-text" }, escapeHtml(sig.message || sig.text || "")),
      sig.photo ? h("img", {
        class: "signature-photo",
        src: sig.photo,
        alt: "Signature photo",
        loading: "lazy",
        onerror: (e) => { e.currentTarget.remove(); }
      }) : null
    ])
  ]);
}

function renderSignatureForm(token) {
  return h("div", {
    style: {
      padding: "1.3rem 1.2rem",
      borderRadius: "var(--radius-md)",
      background: "rgba(99,102,241,0.06)",
      border: "1px solid rgba(99,102,241,0.15)"
    }
  }, [
    h("h3", { style: { fontFamily: "'Playfair Display', serif", marginTop: 0 } }, "✍️ Add your signature"),
    h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.7rem" } }, [
      renderField("signerName", "Your Name", "text", "", "e.g. Grandma Li"),
      h("div", {}, [
        h("label", {}, "Avatar Emoji"),
        h("div", {
          id: "avatarRow",
          style: { display: "flex", gap: "0.3rem", flexWrap: "wrap" }
        }, SIGNER_AVATAR_EMOJIS.map((e, i) => h("button", {
          class: "btn btn-ghost",
          id: "av_" + i,
          "data-emoji": e,
          style: { padding: "0.35rem 0.55rem", fontSize: "1.2rem" }
        }, e)))
      ])
    ]),
    h("div", { class: "mt-2" }, [
      h("label", {}, "Message"),
      h("textarea", {
        id: "signerMessage",
        rows: 4,
        placeholder: "Write a short warm message to the recipient…"
      }, "")
    ]),
    h("div", { class: "mt-2" }, [
      renderField("signerPhoto", "Photo URL (optional)", "text", "", "https://… or leave blank"),
      h("button", {
        class: "btn btn-ghost mt-1",
        style: { fontSize: "0.82rem", padding: "0.3rem 0.8rem" },
        onclick: () => {
          const input = document.getElementById("f_signerPhoto");
          if (input) {
            const pool = [
              R2_BASE + "/birthday/birthday-pexels-8014697-v2-vertical.webp",
              R2_BASE + "/love/love-pexels-11368673-vertical.webp"
            ];
            input.value = pool[Math.floor(Math.random() * pool.length)];
            window.toast("🖼️ Sticker URL filled (demo)", "info");
          }
        }
      }, "🖼️ Use a demo R2 sticker")
    ]),
    h("button", {
      class: "btn btn-primary mt-2",
      id: "submitSignatureBtn",
      style: { width: "100%", justifyContent: "center" }
    }, ["💖 Add my signature"])
  ]);
}

function attachGroupSignListeners(token, data) {
  let selectedAvatar = SIGNER_AVATAR_EMOJIS[0];
  SIGNER_AVATAR_EMOJIS.forEach((e, i) => {
    const b = document.getElementById("av_" + i);
    if (!b) return;
    if (e === selectedAvatar) applySelectedOutline(b, true);
    b.addEventListener("click", () => {
      selectedAvatar = e;
      SIGNER_AVATAR_EMOJIS.forEach((_, j) => {
        const b2 = document.getElementById("av_" + j);
        if (b2) applySelectedOutline(b2, j === i);
      });
    });
  });

  document.getElementById("submitSignatureBtn").addEventListener("click", () => {
    const name = (document.getElementById("f_signerName") || {}).value || "";
    const message = (document.getElementById("signerMessage") || {}).value || "";
    const photo = (document.getElementById("f_signerPhoto") || {}).value || "";
    if (!name.trim()) { window.toast("Please enter your name", "error"); return; }
    if (!message.trim()) { window.toast("Please write a short message", "error"); return; }
    window.toast("💌 Posting your signature…", "info");
    fetch(API_BASE + "/group/" + token + "/sign", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name, message, avatarEmoji: selectedAvatar, photo })
    }).then(r => {
      if (!r.ok) throw new Error("Signature failed");
      return r.json();
    }).then(saved => {
      const grid = document.getElementById("signatureGrid");
      if (grid) {
        const newNode = renderSignatureCard(saved.signature || saved || {
          name, message, avatarEmoji: selectedAvatar, photo
        });
        grid.insertBefore(newNode, grid.firstChild);
      }
      window.toast("💖 Your signature added!", "success");
      const n = document.getElementById("f_signerName"); if (n) n.value = "";
      const m = document.getElementById("signerMessage"); if (m) m.value = "";
      const p = document.getElementById("f_signerPhoto"); if (p) p.value = "";
    }).catch(e => window.toast("Network error: " + e.message, "error"));
  });

  document.getElementById("copyGroupLinkBtn").addEventListener("click", () => {
    const url = location.href;
    navigator.clipboard.writeText(url).then(() => {
      window.toast("📋 Share link copied!", "success");
    }).catch(() => {
      window.prompt("Copy this link:", url);
      window.toast("📋 Link ready to paste", "info");
    });
  });

  const sendBtn = document.getElementById("sendGroupCardBtn");
  if (!sendBtn) return;
  fetch(API_BASE + "/group/" + token + "/status", { method: "GET" })
    .then(r => r.ok ? r.json() : Promise.resolve({}))
    .then(d => {
      const isOwner = !!d.isOwner || !!data.isOwner;
      sendBtn.disabled = !isOwner;
      sendBtn.title = isOwner ? "Send this card to the recipient" : "Only the card organiser can send";
      sendBtn.style.cursor = isOwner ? "pointer" : "not-allowed";
    }).catch(() => { sendBtn.disabled = true; });

  sendBtn.addEventListener("click", () => {
    if (sendBtn.disabled) {
      window.toast("🔒 Only the organiser can send the group card", "error");
      return;
    }
    window.toast("🎁 Sending group card reveal…", "info");
    fetch(API_BASE + "/group/" + token + "/send", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ senderEmail: state.editor.fromEmail || "" })
    }).then(r => {
      if (!r.ok) throw new Error("Not the organiser or send failed");
      return r.json();
    }).then(() => {
      window.toast("🎉 Group card scheduled for delivery!", "success");
      setTimeout(() => {
        history.pushState({}, "", "/");
        renderRoute();
      }, 1500);
    }).catch(e => window.toast("Network error: " + e.message, "error"));
  });
}

function renderGiftRedeem(token) {
  clearApp();
  setPageTitle("Redeem Your Gift · SendAFun");
  updateCanonical("/redeem/" + token);

  const wrap = h("div", { class: "fade-in" }, [
    h("section", {
      class: "glass",
      style: {
        maxWidth: "560px", margin: "2rem auto", padding: "2.5rem 2rem",
        textAlign: "center"
      }
    }, [
      h("div", { id: "giftHeader" }, [
        h("div", { style: { fontSize: "4.5rem" } }, "🎁"),
        h("h1", {
          style: { fontFamily: "'Playfair Display', serif", margin: "0.6rem 0 0.3rem", fontSize: "2rem" }
        }, "You've been gifted SendAFun!"),
        h("div", { class: "loading-spinner", style: { marginTop: "1rem" } }),
        h("p", { style: { color: "var(--saf-text-soft)", marginTop: "0.8rem" } }, "Loading gift details…")
      ])
    ])
  ]);
  mountApp(wrap);

  fetch(API_BASE + "/gift/" + token, { method: "GET" })
    .then(r => { if (!r.ok) throw new Error("Gift not found"); return r.json(); })
    .then(data => renderGiftRedeemLoaded(token, data))
    .catch(e => {
      window.toast("Network error: " + e.message, "error");
      const head = document.getElementById("giftHeader");
      if (head) {
        head.innerHTML = "";
        head.appendChild(h("div", {}, [
          h("div", { style: { fontSize: "4rem" } }, "😵"),
          h("p", { style: { margin: "1rem 0 0.8rem" } }, "This gift link is invalid or has been redeemed."),
          h("button", {
            class: "btn btn-primary",
            onclick: () => { history.pushState({}, "", "/"); renderRoute(); }
          }, "Go Home")
        ]));
      }
    });
}

function renderGiftRedeemLoaded(token, gift) {
  clearApp();
  const wrap = h("div", { class: "fade-in" }, [
    h("section", {
      class: "glass",
      style: {
        maxWidth: "560px", margin: "2rem auto", padding: "2.5rem 2rem"
      }
    }, [
      h("div", { style: { textAlign: "center" } }, [
        h("div", { style: { fontSize: "4.5rem" } }, "🎁"),
        h("h1", {
          style: { fontFamily: "'Playfair Display', serif", margin: "0.5rem 0 0.3rem", fontSize: "1.9rem" }
        }, "You've been gifted SendAFun!"),
        h("div", {
          style: {
            display: "inline-block",
            background: "linear-gradient(135deg, rgba(99,102,241,0.1), rgba(236,72,153,0.1))",
            padding: "0.5rem 1rem", borderRadius: "999px",
            fontWeight: 700, fontSize: "1rem", marginTop: "0.4rem"
          }
        }, escapeHtml(gift.planName || "SendAFun Premium Plan")),
        gift.validDays ? h("p", {
          style: { color: "var(--saf-text-soft)", margin: "0.8rem 0 0", fontSize: "0.9rem" }
        }, "Valid for " + gift.validDays + " days after redemption.") : null
      ]),
      h("div", {
        style: {
          marginTop: "1.6rem", padding: "1rem 1.2rem",
          borderRadius: "var(--radius-md)",
          background: "rgba(255,255,255,0.7)",
          borderLeft: "4px solid var(--saf-accent)"
        }
      }, [
        h("p", { style: { margin: 0, fontWeight: 600 } },
          "A note from " + escapeHtml(gift.senderName || "a friend") + ":"),
        h("p", {
          style: {
            margin: "0.6rem 0 0", color: "var(--saf-text-soft)",
            fontFamily: "'Dancing Script', cursive",
            fontSize: "1.25rem", lineHeight: 1.5, color: "var(--saf-text)"
          }
        }, escapeHtml(gift.message || "Enjoy sending heartfelt cards to the people you love."))
      ]),
      h("form", {
        id: "redeemForm",
        style: { marginTop: "1.8rem", display: "flex", flexDirection: "column", gap: "0.9rem" }
      }, [
        h("div", {}, [
          h("label", { for: "redeem_email" }, "Your Email Address"),
          h("input", {
            id: "redeem_email",
            type: "email",
            required: true,
            placeholder: "you@example.com"
          })
        ]),
        h("div", {}, [
          h("label", { for: "redeem_name" }, "Your Name (optional)"),
          h("input", {
            id: "redeem_name",
            type: "text",
            placeholder: "How should cards be signed?"
          })
        ]),
        h("label", {
          style: {
            display: "flex", alignItems: "flex-start", gap: "0.5rem",
            fontWeight: 500, fontSize: "0.88rem", color: "var(--saf-text)",
            cursor: "pointer"
          }
        }, [
          h("input", {
            id: "redeem_agree",
            type: "checkbox",
            required: true,
            style: { marginTop: "4px" }
          }),
          h("span", {}, "✅ I agree to receive this gift subscription at the email above")
        ]),
        h("button", {
          type: "submit",
          class: "btn btn-primary",
          style: { justifyContent: "center", fontSize: "1rem", padding: "0.9rem 1.5rem" }
        }, ["🎊 Redeem My Gift"])
      ])
    ])
  ]);
  mountApp(wrap);

  const form = document.getElementById("redeemForm");
  form.addEventListener("submit", ev => {
    ev.preventDefault();
    const email = document.getElementById("redeem_email").value.trim();
    const name = document.getElementById("redeem_name").value.trim();
    const agree = document.getElementById("redeem_agree").checked;
    if (!/.+@.+\..+/.test(email)) { window.toast("Please enter a valid email", "error"); return; }
    if (!agree) { window.toast("Please check the agreement box", "error"); return; }
    window.toast("🎟️ Activating your gift…", "info");
    fetch(API_BASE + "/gift/redeem", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ token, email, name })
    }).then(r => {
      if (!r.ok) throw new Error("Redemption failed");
      return r.json();
    }).then(() => {
      window.toast("🎊 You're in! Enjoy your gift subscription!", "success");
      setTimeout(() => {
        history.pushState({}, "", "/");
        renderRoute();
      }, 1300);
    }).catch(e => window.toast("Network error: " + e.message, "error"));
  });
}

function renderPricing() {
  clearApp();
  const products = window.PRODUCTS || [];
  const freePlan = {
    id: "free",
    name: () => t("pricing_plan_name_free"),
    price: 0,
    billing_cycle: "free",
    features: [
      () => t("free_feat_1"),
      () => t("free_feat_2"),
      () => t("free_feat_3"),
      () => t("free_feat_4")
    ]
  };
  const pps = products.find(p => p.creem_product_id === PRODUCT_IDS.pay_per_send) || {
    name: () => t("pricing_plan_name_pps"), price: 1.99, billing_cycle: "one_time",
    features: [() => t("pps_feat_1"), () => t("pps_feat_2"), () => t("pps_feat_3"), () => t("pps_feat_4")]
  };
  const monthly = products.find(p => p.creem_product_id === PRODUCT_IDS.monthly) || {
    name: () => t("pricing_plan_name_monthly"), price: 6.99, billing_cycle: "monthly",
    features: [() => t("monthly_feat_1"), () => t("monthly_feat_2"), () => t("monthly_feat_3"), () => t("monthly_feat_4"), () => t("monthly_feat_5"), () => t("monthly_feat_6")]
  };
  const annual = products.find(p => p.creem_product_id === PRODUCT_IDS.annual) || {
    name: () => t("pricing_plan_name_annual"), price: 69, billing_cycle: "yearly",
    features: [() => t("annual_feat_1"), () => t("annual_feat_2"), () => t("annual_feat_3"), () => t("annual_feat_4"), () => t("annual_feat_5")]
  };
  const group = products.find(p => p.creem_product_id === PRODUCT_IDS.group_pass) || {
    name: () => t("pricing_plan_name_group"), price: 4.99, billing_cycle: "one_time",
    features: [() => t("group_feat_1"), () => t("group_feat_2"), () => t("group_feat_3"), () => t("group_feat_4")]
  };
  const displayPlans = [freePlan, pps, monthly, annual, group];
  const planKeys = ["free", "pay_per_send", "monthly", "annual", "group_pass"];
  const planLabels = [
    () => t("pricing_plan_label_free"), () => t("pricing_plan_label_pps"),
    () => t("pricing_plan_label_monthly"), () => t("pricing_plan_label_annual"),
    () => t("pricing_plan_label_group")
  ];

  const wrap = h("div", { class: "pricing-page fade-in" }, [
    h("section", { class: "pricing-hero" }, [
      h("h1", {
        style: {
          fontFamily: "'Playfair Display', serif", margin: 0,
          fontSize: "clamp(1.9rem, 4vw, 2.8rem)"
        }
      }, t("pricing_title")),
      h("p", {
        style: {
          color: "var(--saf-text-soft)",
          maxWidth: "620px", margin: "0.8rem auto 0",
          fontSize: "1.05rem"
        }
      }, t("pricing_tagline"))
    ]),
    h("div", { class: "pricing-grid" },
      displayPlans.map((p, i) => renderPlanCard(p, planKeys[i], i === 2))
    ),
    h("section", { class: "compare-section glass" }, [
      h("h2", {
        style: { fontFamily: "'Playfair Display', serif", marginTop: 0, marginBottom: "1.2rem" }
      }, t("pricing_compare_title")),
      renderCompareTable(planKeys, planLabels)
    ])
  ]);
  mountApp(wrap);
}

function renderPlanCard(plan, planKey, featured) {
  const isFree = planKey === "free";
  const periodLabel = plan.billing_cycle === "monthly" ? t("period_month")
    : plan.billing_cycle === "yearly" ? t("period_year")
    : plan.billing_cycle === "one_time" ? t("period_one_time")
    : "";
  const planName = typeof plan.name === "function" ? plan.name() : String(plan.name);
  return h("div", {
    class: "plan-card" + (featured ? " featured" : "")
  }, [
    h("div", { class: "plan-name" }, planName),
    h("div", { class: "plan-price" }, [
      plan.price === 0 ? t("pricing_plan_name_free") : "$" + plan.price,
      plan.price > 0 ? h("small", {}, periodLabel) : null
    ]),
    h("div", { class: "plan-period" }, isFree ? t("pricing_plan_period_free") : (planKey === "annual" ? t("pricing_plan_period_annual") : t("pricing_plan_period_other"))),
    h("ul", { class: "plan-features" },
      (plan.features || []).map(f => h("li", {}, typeof f === "function" ? f() : String(f)))
    ),
    h("div", { class: "plan-cta" },
      isFree ? h("button", {
        class: "btn btn-ghost",
        style: { width: "100%", justifyContent: "center" },
        onclick: () => { history.pushState({}, "", "/"); renderRoute(); }
      }, t("pricing_plan_cta_start_free"))
      : h("button", {
        class: "btn " + (featured ? "btn-primary" : "btn-ghost"),
        style: { width: "100%", justifyContent: "center" },
        onclick: () => handlePlanChoose(plan, planKey)
      }, t("pricing_plan_cta_choose"))
    )
  ]);
}

function handlePlanChoose(plan, planKey) {
  const products = window.PRODUCTS || [];
  const match = products.find(p => {
    if (planKey === "pay_per_send") return p.creem_product_id === PRODUCT_IDS.pay_per_send;
    if (planKey === "monthly") return p.creem_product_id === PRODUCT_IDS.monthly;
    if (planKey === "annual") return p.creem_product_id === PRODUCT_IDS.annual;
    if (planKey === "group_pass") return p.creem_product_id === PRODUCT_IDS.group_pass;
    return false;
  });
  const pid = (match && match.creem_product_id) || PRODUCT_IDS[planKey];
  startCheckoutSession(pid, null);
}

function renderCompareTable(planKeys, planLabels) {
  const thead = h("thead", {}, h("tr", {}, [
    h("th", {}, t("pricing_feature_feat_label")),
    ...planLabels.map(l => h("th", {}, typeof l === "function" ? l() : String(l)))
  ]));
  const tbody = h("tbody", {}, COMPARE_FEATURES.map(feat => {
    const featLabel = typeof feat.label === "function" ? feat.label() : String(feat.label);
    return h("tr", {}, [
      h("td", {}, featLabel),
      ...planKeys.map(pk => {
        let val = (PLAN_FEATURE_MATRIX[pk] || {})[feat.key];
        if (typeof val === "function") val = val();
        if (feat.type === "text") {
          return h("td", {}, val === false ? h("span", { class: "feat-nomark" }, t("pricing_feature_feat_none")) : String(val));
        }
        if (val === true) return h("td", {}, h("span", { class: "feat-mark" }, "✅"));
        if (val === false) return h("td", {}, h("span", { class: "feat-nomark" }, "⛔"));
        return h("td", {}, h("span", { class: "feat-nomark" }, t("pricing_feature_feat_none")));
      })
    ]);
  }));
  return h("table", {}, [thead, tbody]);
}

const MESSAGE_TEMPLATES = {
  birthday: [
    "Happy Birthday! 🎉 Wishing you all the cake, laughter, and love today — and the year ahead even better than the last.",
    "To one of my favorite people on their special day: may this year bring you every adventure you've been daydreaming about.",
    "Another trip around the sun, and you're still shining brighter than ever. Happy Birthday! 🎂✨"
  ],
  anniversary: [
    "Happy anniversary to the love of my life. Another year with you, another hundred I can't wait for. 💖🌹",
    "I'd marry you all over again, a thousand times, in every lifetime. Happy anniversary, forever person. 💍💕",
    "Through every high and every low, through calm days and stormy ones — loving you has been my greatest adventure. 🌊💍"
  ],
  thank_you: [
    "I can't thank you enough for everything you've done. You have no idea how much it meant to me. 🙏💗",
    "Small acts of kindness, huge impact. Thank you from the bottom of my heart. You're one in a million.",
    "Grateful doesn't cover it. Thank you for being the kind of person everyone hopes to have in their corner. ✨"
  ],
  general: [
    "Just thinking of you today and hoping it's a good one. You deserve every bit of happiness. 💗",
    "Wishing you calm days, warm moments, and all the little wins you've been hoping for lately. ✨",
    "You're doing better than you think. Be gentle with yourself today — you deserve it. 🫶"
  ]
};

const EDITOR_HISTORY_LIMIT = 25;

function pushEditorHistory(slug) {
  try {
    const key = "saf_history_list";
    const raw = localStorage.getItem(key);
    const list = raw ? JSON.parse(raw) : [];
    const entry = { slug: slug, at: Date.now() };
    const filtered = list.filter(i => i.slug !== slug).slice(0, EDITOR_HISTORY_LIMIT - 1);
    filtered.unshift(entry);
    localStorage.setItem(key, JSON.stringify(filtered));
  } catch (_) {
  }
}

function getEditorHistory() {
  try {
    const raw = localStorage.getItem("saf_history_list");
    return raw ? JSON.parse(raw) : [];
  } catch (_) {
    return [];
  }
}

function clearEditorHistory() {
  try {
    localStorage.removeItem("saf_history_list");
  } catch (_) {
  }
}

function findCardBySlug(slug) {
  return (window.CARDS || []).find(c => c.slug === slug);
}

function getRandomCardsByCategory(cat, limit = 6) {
  const cards = (window.CARDS || []).filter(c => !cat || c.category === cat);
  const out = [];
  const used = new Set();
  const maxTry = Math.min(limit * 3, cards.length);
  for (let i = 0; i < maxTry && out.length < limit; i++) {
    const idx = Math.floor(Math.random() * cards.length);
    if (used.has(idx)) continue;
    used.add(idx);
    out.push(cards[idx]);
  }
  return out;
}

function formatCount(n) {
  if (n >= 1000) return (n / 1000).toFixed(1).replace(/\.0$/, "") + "k";
  return String(n);
}

function countCardsByCategory() {
  const out = {};
  const all = _getAllCardsForStats();
  all.forEach(c => {
    if (!_isRealTemplate(c)) return;
    if (!c || !c.category) return;
    out[c.category] = (out[c.category] || 0) + 1;
  });
  return out;
}

function getSimilarCards(card, limit = 6) {
  const same = (window.CARDS || []).filter(c => c.slug !== card.slug && c.category === card.category);
  const scored = same.map(c => {
    let s = 0;
    if (c.style === card.style) s += 3;
    const t1 = (card.tags || []).map(x => x.toLowerCase());
    const t2 = (c.tags || []).map(x => x.toLowerCase());
    const shared = t1.filter(t => t2.includes(t)).length;
    s += shared;
    return { c, s };
  });
  scored.sort((a, b) => b.s - a.s || Math.random() - 0.5);
  return scored.slice(0, limit).map(x => x.c);
}

function renderCardBackStickerManager(card) {
  if (!state.editor.stickers || !state.editor.stickers.length) return null;
  return h("div", {
    style: {
      marginTop: "0.6rem",
      padding: "0.7rem 0.9rem",
      borderRadius: "var(--radius-sm)",
      background: "rgba(236,72,153,0.08)",
      border: "1px solid rgba(236,72,153,0.15)",
      fontSize: "0.8rem"
    }
  }, [
    h("div", { style: { fontWeight: 600, marginBottom: "0.35rem" } },
      "Stickers on card (" + state.editor.stickers.length + "/6) — click a sticker to remove:"),
    h("div", { style: { display: "flex", gap: "0.3rem", flexWrap: "wrap" } },
      state.editor.stickers.map((st, i) => h("button", {
        class: "btn btn-ghost",
        style: { padding: "0.25rem 0.5rem", fontSize: "1.1rem" },
        title: "Click to remove this sticker",
        onclick: () => {
          state.editor.stickers.splice(i, 1);
          persistEditorState(state.currentSlug);
          updateCardBackPreview(card);
          const parent = document.getElementById("stickerManagerWrap");
          if (parent) {
            const rebuilt = renderCardBackStickerManager(card);
            parent.innerHTML = "";
            if (rebuilt) parent.appendChild(rebuilt);
          }
        }
      }, st.emoji))
    )
  ]);
}

function renderMessageTemplatesSelector(card) {
  const catKey = (card && card.category && MESSAGE_TEMPLATES[card.category.replace(/\-/g, "_")])
    ? card.category.replace(/\-/g, "_")
    : "general";
  const templates = MESSAGE_TEMPLATES[catKey] || MESSAGE_TEMPLATES.general;
  return h("div", {
    style: {
      padding: "0.8rem 0.9rem",
      marginTop: "0.6rem",
      borderRadius: "var(--radius-sm)",
      background: "rgba(99,102,241,0.07)",
      border: "1px solid rgba(99,102,241,0.13)",
      fontSize: "0.82rem"
    }
  }, [
    h("div", { style: { fontWeight: 600, marginBottom: "0.4rem" } },
      "💡 Quick message templates — click to use:"),
    h("div", { style: { display: "flex", flexDirection: "column", gap: "0.4rem" } },
      templates.map((tpl, i) => h("button", {
        class: "btn btn-ghost",
        style: {
          padding: "0.5rem 0.75rem",
          textAlign: "left",
          fontFamily: "inherit",
          fontSize: "0.82rem",
          lineHeight: 1.4,
          whiteSpace: "normal",
          height: "auto"
        },
        onclick: () => {
          state.editor.defaultText = tpl;
          persistEditorState(state.currentSlug);
          const ta = document.getElementById("f_defaultText");
          if (ta) ta.value = tpl;
          updateCardBackPreview(card);
          window.toast("✍️ Template applied", "success");
        }
      }, "Template " + (i + 1) + " · " + (tpl.length > 58 ? tpl.slice(0, 55) + "…" : tpl)))
    )
  ]);
}

function renderEditorRelatedCards(card) {
  const related = getSimilarCards(card, 5);
  if (!related.length) return null;
  return h("div", {
    style: {
      marginTop: "1.2rem",
      padding: "1rem 1.1rem",
      borderRadius: "var(--radius-md)",
      background: "rgba(255,255,255,0.55)",
      border: "1px solid rgba(15,23,42,0.07)"
    }
  }, [
    h("div", {
      style: {
        fontFamily: "'Playfair Display', serif",
        fontWeight: 700, marginBottom: "0.6rem", fontSize: "1rem"
      }
    }, "✨ More in this category (" + _L(CATEGORY_LABELS[card.category], card.category) + ")"),
    h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(100px, 1fr))",
        gap: "0.6rem"
      }
    }, related.map(rc => {
      const rbg = rc.bgImage || rc.bgImageWatermark || "";
      const rcat = typeof rc.category === "string" ? rc.category : (typeof card.category === "string" ? card.category : "");
      const rLayer = layeredBackground(rbg, rcat);
      return h("a", {
        href: "/card/" + rc.slug,
        style: Object.assign({
          aspectRatio: "3/4",
          borderRadius: "var(--radius-sm)",
          display: "block",
          cursor: "pointer",
          boxShadow: "var(--shadow-sm)",
          transition: "transform .2s"
        }, rLayer),
        title: rc.title || "",
        onclick: e => {
          e.preventDefault();
          history.pushState({}, "", "/card/" + rc.slug);
          renderRoute();
        }
      });
    }))
  ]);
}

function injectEditorEnhancements(card) {
  const stylePane = document.getElementById("tabStylePane");
  if (!stylePane) return;
  const managerWrap = h("div", { id: "stickerManagerWrap" });
  const sm = renderCardBackStickerManager(card);
  if (sm) managerWrap.appendChild(sm);
  stylePane.appendChild(managerWrap);

  const msgPane = document.getElementById("tabMessagePane");
  if (msgPane) {
    const tplEl = renderMessageTemplatesSelector(card);
    if (tplEl) msgPane.appendChild(tplEl);
  }

  const controls = document.querySelector(".editor-controls");
  if (controls) {
    const related = renderEditorRelatedCards(card);
    if (related) controls.appendChild(related);
  }
}

const KEYBOARD_HINTS = [
  { key: "?", action: "Show keyboard shortcuts" },
  { key: "g", action: "Flip card front/back (editor)" },
  { key: "Esc", action: "Close modals" },
  { key: "/", action: "Focus search (discover page)" },
  { key: "h", action: "Go home" },
  { key: "d", action: "Jump to Discover page" }
];

function buildKeyboardShortcutsHelpModal() {
  const wrap = document.createElement("div");
  wrap.style.cssText = "position:fixed;inset:0;z-index:200;background:rgba(15,23,42,0.45);backdrop-filter:blur(6px);display:flex;align-items:center;justify-content:center;padding:1rem;";
  const modal = h("div", {
    class: "glass",
    style: { maxWidth: "480px", width: "100%", padding: "1.8rem", maxHeight: "90vh", overflow: "auto" }
  }, [
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: "1rem" } }, [
      h("h2", { style: { fontFamily: "'Playfair Display', serif", margin: 0, fontSize: "1.4rem" } }, "⌨️ Keyboard Shortcuts"),
      h("button", {
        class: "btn btn-ghost",
        style: { padding: "0.35rem 0.7rem" },
        onclick: () => wrap.remove()
      }, "Close")
    ]),
    h("table", { style: { width: "100%", fontSize: "0.9rem", borderCollapse: "collapse" } },
      KEYBOARD_HINTS.map(hint => h("tr", {
        style: { borderBottom: "1px solid rgba(15,23,42,0.06)" }
      }, [
        h("td", {
          style: {
            padding: "0.6rem 0.4rem",
            fontFamily: "monospace",
            fontWeight: 700,
            width: "30%"
          }
        }, hint.key),
        h("td", {
          style: { padding: "0.6rem 0.4rem", color: "var(--saf-text-soft)" }
        }, hint.action)
      ]))
    )
  ]);
  wrap.appendChild(modal);
  document.body.appendChild(wrap);
  return wrap;
}

function installGlobalKeyboardShortcuts() {
  if (window.__safKeyboardInstalled) return;
  window.__safKeyboardInstalled = true;
  document.addEventListener("keydown", ev => {
    try {
      if (!ev) return;
      const activeTag = (document.activeElement && document.activeElement.tagName || "").toLowerCase();
      const inField = activeTag === "input" || activeTag === "textarea" || activeTag === "select";
      const key = ev.key || "";
      if (key === "Escape") {
        const openModals = document.querySelectorAll('div[style*="z-index:200"]');
        if (openModals.length) openModals[openModals.length - 1].remove();
        return;
      }
      if (key === "?" && !inField) {
        ev.preventDefault();
        buildKeyboardShortcutsHelpModal();
        return;
      }
      if (inField) return;
      if (key.toLowerCase() === "h") {
        history.pushState({}, "", "/");
        renderRoute();
      } else if (key.toLowerCase() === "d") {
        history.pushState({}, "", "/discover");
        renderRoute();
      } else if (key.toLowerCase() === "g" && state.currentSlug) {
        const flipBtn = document.getElementById("flipBtn");
        if (flipBtn) flipBtn.click();
      } else if (key === "/" && location.pathname.startsWith("/discover")) {
        ev.preventDefault();
        const searchInput = document.getElementById("discoverSearchInput");
        if (searchInput) searchInput.focus();
      }
    } catch (_) {
    }
  });
}

function getCategoryStatSummary() {
  const counts = countCardsByCategory();
  let total = 0, biggest = 0, biggestCat = null;
  Object.keys(counts).forEach(c => {
    total += counts[c];
    if (counts[c] > biggest) { biggest = counts[c]; biggestCat = c; }
  });
  return { total, biggest, biggestCat, categoryCount: Object.keys(counts).length };
}

function renderHomeExtraStats() {
  const stats = getCategoryStatSummary();
  if (!stats.total) return null;
  return h("div", {
    style: {
      marginTop: "2.5rem",
      padding: "1.3rem 1.5rem",
      borderRadius: "var(--radius-md)",
      background: "linear-gradient(135deg, rgba(99,102,241,0.09), rgba(236,72,153,0.08))",
      border: "1px solid rgba(99,102,241,0.15)",
      display: "grid",
      gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))",
      gap: "0.8rem"
    }
  }, [
    h("div", { style: { textAlign: "center" } }, [
      h("div", { style: { fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--saf-primary-dark)" } },
        formatCount(stats.total)),
      h("div", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "cards live now")
    ]),
    h("div", { style: { textAlign: "center" } }, [
      h("div", { style: { fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "var(--saf-accent)" } },
        String(stats.categoryCount)),
      h("div", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } }, "occasions supported")
    ]),
    h("div", { style: { textAlign: "center" } }, [
      h("div", { style: { fontFamily: "'Playfair Display', serif", fontSize: "1.6rem", fontWeight: 700, color: "#d97706" } },
        stats.biggestCat ? getCategoryEmoji(stats.biggestCat) + " " + _L(CATEGORY_LABELS[stats.biggestCat], "") : "—"),
      h("div", { style: { fontSize: "0.8rem", color: "var(--saf-text-soft)" } },
        "top category · " + formatCount(stats.biggest) + " cards")
    ])
  ]);
}

function renderHomeFeaturedCategories() {
  const cats = Object.keys(CATEGORY_LABELS);
  const counts = countCardsByCategory();
  const featured = cats.slice(0, 9);
  return h("section", {
    class: "glass",
    style: { padding: "1.8rem 1.6rem", marginTop: "2rem" }
  }, [
    h("div", { style: { display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "1.2rem" } }, [
      h("h2", {
        style: { fontFamily: "'Playfair Display', serif", margin: 0, fontSize: "1.5rem" }
      }, t("browse_title")),
      h("button", {
        class: "btn btn-ghost",
        style: { fontSize: "0.85rem", padding: "0.35rem 0.8rem" },
        onclick: () => { history.pushState({}, "", "/discover"); renderRoute(); }
      }, t("browse_see_all_prefix") + " →")
    ]),
    h("div", {
      style: {
        display: "grid",
        gridTemplateColumns: "repeat(auto-fill, minmax(160px, 1fr))",
        gap: "0.9rem"
      }
    }, featured.map(cat => {
      const firstCard = (window.CARDS || []).find(c => c.category === cat);
      const bg = firstCard ? (firstCard.bgImage || firstCard.bgImageWatermark || "") : "";
      return h("a", {
        href: "/discover?cat=" + cat,
        style: {
          position: "relative",
          aspectRatio: "3/4",
          borderRadius: "var(--radius-lg)",
          overflow: "hidden",
          background: bg ? "url(" + bg + ") center/cover no-repeat" : "linear-gradient(135deg, #a5b4fc, #f9a8d4)",
          color: "inherit",
          textDecoration: "none",
          cursor: "pointer",
          boxShadow: "var(--shadow-md)",
          transition: "transform .25s, box-shadow .25s"
        },
        onmouseenter: e => { e.currentTarget.style.transform = "translateY(-3px) rotate(0.4deg)"; e.currentTarget.style.boxShadow = "var(--shadow-lg)"; },
        onmouseleave: e => { e.currentTarget.style.transform = ""; e.currentTarget.style.boxShadow = "var(--shadow-md)"; },
        onclick: e => {
          e.preventDefault();
          history.pushState({}, "", "/discover?cat=" + cat);
          renderRoute();
        }
      }, [
        h("div", {
          style: {
            position: "absolute", inset: 0,
            background: "linear-gradient(180deg, transparent 25%, rgba(15,23,42,0.72) 100%)"
          }
        }),
        h("div", {
          style: {
            position: "absolute",
            top: "12px", right: "12px",
            fontSize: "1.4rem",
            background: "rgba(255,255,255,0.85)",
            backdropFilter: "blur(6px)",
            width: "38px", height: "38px",
            borderRadius: "50%",
            display: "flex", alignItems: "center", justifyContent: "center"
          }
        }, getCategoryEmoji(cat)),
        h("div", {
          style: {
            position: "absolute",
            left: "16px", right: "16px", bottom: "16px",
            color: "#fff"
          }
        }, [
          h("div", { style: { fontWeight: 700, fontSize: "1.05rem", marginBottom: "2px" } },
            CATEGORY_LABELS[cat] || cat),
          h("div", { style: { fontSize: "0.76rem", opacity: 0.9 } },
            (counts[cat] || 0) + " templates")
        ])
      ]);
    }))
  ]);
}

function injectHomeExtraSections() {
  const homePage = document.querySelector(".home-page");
  if (!homePage) return;
  const stats = renderHomeExtraStats();
  const cats = renderHomeFeaturedCategories();
  if (stats) homePage.appendChild(stats);
  if (cats) homePage.appendChild(cats);
}

function installAutoSaveIndicator() {
  if (window.__safAutoSaveInstalled) return;
  window.__safAutoSaveInstalled = true;
  let lastToast = 0;
  window.addEventListener("editor-state-saved", () => {
    const now = Date.now();
    if (now - lastToast < 3000) return;
    lastToast = now;
  });
}

function validateEmailList(str) {
  if (!str) return false;
  const emails = String(str).split(/[;,]/).map(s => s.trim()).filter(Boolean);
  if (!emails.length) return false;
  return emails.every(e => /.+@.+\..+/.test(e));
}

function truncateForPreview(str, max) {
  if (!str) return "";
  if (str.length <= max) return str;
  return str.slice(0, max - 1) + "…";
}

function printStylesInject() {
  if (document.getElementById("saf-print-styles")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "saf-print-styles";
  styleEl.textContent = [
    "@media print {",
    "  nav#topNav, footer, .cookie-banner, .toast-stack,",
    "  .editor-controls, #flipBtn, .glass-nav, .glass-footer, .intent-section, .hero-cta-row { display: none !important; }",
    "  #app { max-width: 100%; margin: 0; padding: 0; }",
    "  .editor-page { grid-template-columns: 1fr !important; }",
    "  .card-flip-wrapper { max-width: 480px; margin: 0 auto; box-shadow: none; }",
    "  body { background: #fff; }",
    "}"
  ].join("\n");
  document.head.appendChild(styleEl);
}

function envelopeStylesInject() {
  if (document.getElementById("saf-envelope-styles")) return;
  const styleEl = document.createElement("style");
  styleEl.id = "saf-envelope-styles";
  styleEl.textContent = [
    ".envelope-stage {",
    "  position: relative;",
    "  width: 100%;",
    "  perspective: 1200px;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "}",
    ".envelope-wrap {",
    "  position: relative;",
    "  width: 100%;",
    "  max-width: 360px;",
    "  transform-style: preserve-3d;",
    "}",
    ".envelope-body {",
    "  position: relative;",
    "  width: 100%;",
    "  aspect-ratio: 3/2;",
    "  border-radius: 8px;",
    "  box-shadow: 0 12px 36px rgba(15,23,42,0.18);",
    "  transform-style: preserve-3d;",
    "  overflow: visible;",
    "}",
    ".envelope-back-face {",
    "  position: absolute;",
    "  inset: 0;",
    "  border-radius: 8px;",
    "  background: var(--env-body, #f8fafc);",
    "  box-shadow: inset 0 -6px 18px var(--env-body-shadow, rgba(0,0,0,0.08));",
    "}",
    ".envelope-pocket-l, .envelope-pocket-r {",
    "  position: absolute;",
    "  bottom: 0;",
    "  width: 52%;",
    "  height: 62%;",
    "  background: var(--env-body, #f8fafc);",
    "  z-index: 3;",
    "}",
    ".envelope-pocket-l {",
    "  left: 0;",
    "  clip-path: polygon(0 0, 100% 100%, 0 100%);",
    "  border-bottom-left-radius: 8px;",
    "}",
    ".envelope-pocket-r {",
    "  right: 0;",
    "  clip-path: polygon(100% 0, 100% 100%, 0 100%);",
    "  border-bottom-right-radius: 8px;",
    "}",
    ".envelope-pocket-bottom {",
    "  position: absolute;",
    "  left: 0; right: 0; bottom: 0;",
    "  height: 62%;",
    "  background: var(--env-body, #f8fafc);",
    "  border-bottom-left-radius: 8px;",
    "  border-bottom-right-radius: 8px;",
    "  z-index: 2;",
    "}",
    ".envelope-flap {",
    "  position: absolute;",
    "  top: 0; left: 0; right: 0;",
    "  height: 58%;",
    "  background: var(--env-flap, #f1f5f9);",
    "  clip-path: polygon(0 0, 100% 0, 50% 100%);",
    "  transform-origin: top center;",
    "  z-index: 10;",
    "  backface-visibility: hidden;",
    "  border-top-left-radius: 8px;",
    "  border-top-right-radius: 8px;",
    "  box-shadow: 0 2px 4px var(--env-flap-shadow, rgba(0,0,0,0.06));",
    "}",
    ".envelope-seal {",
    "  position: absolute;",
    "  left: 50%;",
    "  top: 42%;",
    "  transform: translate(-50%, -50%);",
    "  width: 44px;",
    "  height: 44px;",
    "  border-radius: 50%;",
    "  display: flex;",
    "  align-items: center;",
    "  justify-content: center;",
    "  z-index: 11;",
    "  font-size: 1.1rem;",
    "  box-shadow: 0 3px 10px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.35);",
    "}",
    ".envelope-paper {",
    "  position: absolute;",
    "  left: 6%;",
    "  right: 6%;",
    "  top: 12%;",
    "  height: 90%;",
    "  background: var(--env-paper, #fff);",
    "  border-radius: 4px;",
    "  box-shadow: 0 2px 10px rgba(0,0,0,0.12);",
    "  z-index: 1;",
    "  padding: 12px 14px;",
    "  overflow: hidden;",
    "  color: var(--env-text, #0f172a);",
    "}",
    ".envelope-paper-inner {",
    "  width: 100%;",
    "  height: 100%;",
    "  opacity: 0;",
    "  display: flex;",
    "  flex-direction: column;",
    "  gap: 4px;",
    "  font-size: 0.7rem;",
    "  line-height: 1.3;",
    "}",
    ".envelope-paper-inner .paper-title {",
    "  font-family: 'Playfair Display', serif;",
    "  font-weight: 700;",
    "  font-size: 0.85rem;",
    "}",
    ".envelope-paper-inner .paper-body {",
    "  flex: 1;",
    "  overflow: hidden;",
    "  font-size: 0.65rem;",
    "  color: rgba(15,23,42,0.75);",
    "  display: -webkit-box;",
    "  -webkit-line-clamp: 4;",
    "  -webkit-box-orient: vertical;",
    "}",
    ".envelope-card-preview {",
    "  width: 100%;",
    "  max-height: 55%;",
    "  object-fit: cover;",
    "  border-radius: 3px;",
    "}",
    ".envelope-aurora-canvas {",
    "  position: absolute;",
    "  inset: -12%;",
    "  pointer-events: none;",
    "  z-index: 20;",
    "  opacity: 0.85;",
    "  mix-blend-mode: screen;",
    "}",
    "@keyframes envFlapOpen {",
    "  0% { transform: rotateX(0deg); z-index: 10; }",
    "  50% { z-index: 10; }",
    "  100% { transform: rotateX(-180deg); z-index: 0; }",
    "}",
    "@keyframes envPaperSlide {",
    "  0% { transform: translateY(0); z-index: 1; }",
    "  40% { transform: translateY(0); z-index: 1; }",
    "  75% { transform: translateY(-55%); z-index: 15; }",
    "  100% { transform: translateY(-30%); z-index: 15; }",
    "}",
    "@keyframes envContentFade {",
    "  0% { opacity: 0; transform: translateY(4px); }",
    "  75% { opacity: 0; transform: translateY(4px); }",
    "  100% { opacity: 1; transform: translateY(0); }",
    "}",
    "@keyframes envSealPop {",
    "  0% { transform: translate(-50%, -50%) scale(1); opacity: 1; }",
    "  30% { transform: translate(-50%, -50%) scale(1.25); opacity: 0.6; }",
    "  100% { transform: translate(-50%, -180%) scale(0.4); opacity: 0; }",
    "}",
    ".envelope-wrap.is-opening .envelope-flap {",
    "  animation: envFlapOpen 0.9s cubic-bezier(.4,.0,.2,1) forwards;",
    "}",
    ".envelope-wrap.is-opening .envelope-seal {",
    "  animation: envSealPop 0.55s ease-out forwards;",
    "}",
    ".envelope-wrap.is-opening .envelope-paper {",
    "  animation: envPaperSlide 1.5s cubic-bezier(.4,.0,.2,1) 0.2s forwards;",
    "}",
    ".envelope-wrap.is-opening .envelope-paper-inner {",
    "  animation: envContentFade 1.8s ease-out 0.9s forwards;",
    "}",
    ".envelope-open-btn {",
    "  display: inline-flex;",
    "  align-items: center;",
    "  gap: 6px;",
    "  padding: 10px 22px;",
    "  border-radius: 999px;",
    "  border: none;",
    "  font-weight: 700;",
    "  font-size: 0.95rem;",
    "  cursor: pointer;",
    "  background: linear-gradient(135deg,#8b5cf6,#ec4899);",
    "  color: #fff;",
    "  box-shadow: 0 8px 24px rgba(139,92,246,0.35);",
    "  transition: transform .2s ease;",
    "}",
    ".envelope-open-btn:hover { transform: translateY(-1px) scale(1.02); }",
    ".envelope-preview-stage .envelope-wrap.is-preview { transform: scale(0.82); }",
    ".envelope-share-page {",
    "  min-height: 100vh;",
    "  display: flex;",
    "  flex-direction: column;",
    "  align-items: center;",
    "  justify-content: center;",
    "  padding: 2rem 1rem;",
    "  background: linear-gradient(135deg,#faf5ff 0%,#fdf2f8 50%,#eff6ff 100%);",
    "}",
    ".envelope-share-title {",
    "  font-family: 'Playfair Display', serif;",
    "  font-size: clamp(1.5rem, 4vw, 2.2rem);",
    "  font-weight: 700;",
    "  color: #1e1b4b;",
    "  margin-bottom: 0.5rem;",
    "  text-align: center;",
    "}",
    ".envelope-share-sub {",
    "  color: #6b7280;",
    "  margin-bottom: 1.5rem;",
    "  text-align: center;",
    "  font-size: 0.95rem;",
    "}"
  ].join("\n");
  document.head.appendChild(styleEl);
}

function installGlobalUtilities() {
  installGlobalKeyboardShortcuts();
  installAutoSaveIndicator();
  printStylesInject();
  envelopeStylesInject();
  renderConsentOverlay();
  const origPersist = persistEditorState;
  window.__patchedPersist = function (slug) {
    origPersist(slug);
    try {
      const ev = new CustomEvent("editor-state-saved", { detail: { slug } });
      window.dispatchEvent(ev);
    } catch (_) {
    }
  };
}

// ============================================================================
// P1-8a §13.4: Regional consent overlay — GDPR-EU / CCPA-US / LGPD-BR / PIPEDA-CA
// Region source: window.SAF_GEO.complianceRegion (Worker injects from cf.country)
// Persistence: cookie `saf_consent:<REGION>` = version:timestamp:choices
// Always shows the FIRST visit per region; accept → store 6 months.
// ============================================================================

function _consentCookieName(region) { return "saf_consent_" + String(region || "GLOBAL"); }

function _consentVersion() { return 1; }

function _consentRead(region) {
  try {
    const re = new RegExp("(^| )" + _consentCookieName(region) + "=([^;]+)");
    const m = document.cookie.match(re);
    if (!m || !m[2]) return null;
    const parts = decodeURIComponent(m[2]).split("|");
    return { version: +parts[0] || 0, ts: +parts[1] || 0, choices: parts.slice(2).join("|") || "none" };
  } catch (_) { return null; }
}

function _consentWrite(region, choices) {
  try {
    const value = [_consentVersion(), Date.now(), String(choices || "accepted")].join("|");
    const expires = new Date(Date.now() + 180 * 86400e3).toUTCString(); // 6 months
    document.cookie = _consentCookieName(region) + "=" + encodeURIComponent(value)
      + "; Path=/; Expires=" + expires + "; SameSite=Lax; Secure";
    return true;
  } catch (_) { return false; }
}

function _detectComplianceRegion() {
  try { if (window.SAF_GEO && window.SAF_GEO.complianceRegion) return window.SAF_GEO.complianceRegion; } catch (_) {}
  try {
    const m = document.querySelector('meta[name="x-compliance-region"]');
    if (m && m.content) return m.content;
  } catch (_) {}
  return "GLOBAL";
}

const CONSENT_COPY = {
  "GDPR-EU": {
    en: {
      flag: "🇪🇺", title: "We respect your privacy (GDPR)",
      body: "We use essential cookies so the site works. Optional analytics cookies help us improve. You can change or withdraw consent at any time.",
      acceptAll: "Accept all", acceptEssential: "Essential only", manage: "Privacy policy",
      href: "/privacy.html"
    },
    es: {
      flag: "🇪🇺", title: "Respetamos tu privacidad (RGPD)",
      body: "Usamos cookies esenciales para que el sitio funcione. Cookies analíticas opcionales nos ayudan a mejorar. Puedes cambiar o retirar tu consentimiento en cualquier momento.",
      acceptAll: "Aceptar todas", acceptEssential: "Solo esenciales", manage: "Política de privacidad",
      href: "/privacy.html"
    },
    fr: {
      flag: "🇪🇺", title: "Nous respectons votre vie privée (RGPD)",
      body: "Nous utilisons des cookies essentiels au fonctionnement. Les cookies analytiques optionnels nous aident à améliorer. Vous pouvez modifier ou retirer votre consentement à tout moment.",
      acceptAll: "Tout accepter", acceptEssential: "Essentiels seulement", manage: "Politique de confidentialité",
      href: "/privacy.html"
    },
    pt: {
      flag: "🇪🇺", title: "Respeitamos sua privacidade (RGPD)",
      body: "Usamos cookies essenciais para o site funcionar. Cookies analíticos opcionais nos ajudam a melhorar. Você pode alterar ou retirar seu consentimento a qualquer momento.",
      acceptAll: "Aceitar todos", acceptEssential: "Apenas essenciais", manage: "Política de privacidade",
      href: "/privacy.html"
    }
  },
  "CCPA-US": {
    en: {
      flag: "🇺🇸", title: "Your California privacy rights (CCPA)",
      body: "California residents can opt out of the 'sale' of personal information. We do not sell your data; we use essential and optional analytics cookies.",
      acceptAll: "Accept", optOut: "Opt out of analytics", manage: "Privacy rights",
      href: "/privacy.html#california"
    },
    es: {
      flag: "🇺🇸", title: "Tus derechos de privacidad en California (CCPA)",
      body: "Los residentes de California pueden excluirse de la 'venta' de información personal. No vendemos tus datos; usamos cookies esenciales y analíticas opcionales.",
      acceptAll: "Aceptar", optOut: "Excluir análisis", manage: "Derechos de privacidad",
      href: "/privacy.html#california"
    },
    fr: {
      flag: "🇺🇸", title: "Vos droits de confidentialité en Californie (CCPA)",
      body: "Les résidents californiens peuvent refuser la 'vente' d'informations personnelles. Nous ne vendons pas vos données ; nous utilisons des cookies essentiels et analytiques optionnels.",
      acceptAll: "Accepter", optOut: "Refuser l'analyse", manage: "Droits de confidentialité",
      href: "/privacy.html#california"
    },
    pt: {
      flag: "🇺🇸", title: "Seus direitos de privacidade da Califórnia (CCPA)",
      body: "Residentes da Califórnia podem optar por não participar da 'venda' de informações pessoais. Não vendemos seus dados; usamos cookies essenciais e analíticos opcionais.",
      acceptAll: "Aceitar", optOut: "Recusar análises", manage: "Direitos de privacidade",
      href: "/privacy.html#california"
    }
  },
  "LGPD-BR": {
    pt: {
      flag: "🇧🇷", title: "Sua privacidade (LGPD — Brasil)",
      body: "De acordo com a LGPD, usamos cookies essenciais para o funcionamento. Você pode autorizar ou bloquear cookies analíticos e exercer seus direitos de acesso, correção e exclusão.",
      acceptAll: "Autorizar todos", acceptEssential: "Apenas essenciais", manage: "Política de privacidade",
      href: "/privacy.html#brasil-lgpd"
    },
    en: {
      flag: "🇧🇷", title: "Your privacy (LGPD — Brazil)",
      body: "Under the LGPD, we use essential cookies for the site to work. You may authorise or block analytics cookies and exercise access, correction, and deletion rights.",
      acceptAll: "Authorise all", acceptEssential: "Essential only", manage: "Privacy policy",
      href: "/privacy.html#brasil-lgpd"
    },
    es: {
      flag: "🇧🇷", title: "Tu privacidad (LGPD — Brasil)",
      body: "Bajo la LGPD, usamos cookies esenciales para que funcione el sitio. Puedes autorizar o bloquear cookies analíticas y ejercer tus derechos de acceso, corrección y supresión.",
      acceptAll: "Autorizar todas", acceptEssential: "Solo esenciales", manage: "Política de privacidad",
      href: "/privacy.html#brasil-lgpd"
    },
    fr: {
      flag: "🇧🇷", title: "Votre vie privée (LGPD — Brésil)",
      body: "Conformément à la LGPD, nous utilisons des cookies essentiels. Vous pouvez autoriser ou bloquer les cookies analytiques et exercer vos droits d'accès, de rectification et de suppression.",
      acceptAll: "Tout autoriser", acceptEssential: "Essentiels seulement", manage: "Politique de confidentialité",
      href: "/privacy.html#brasil-lgpd"
    }
  },
  "PIPEDA-CA": {
    en: {
      flag: "🇨🇦", title: "Your privacy rights (PIPEDA — Canada)",
      body: "We comply with PIPEDA. Essential cookies are required; optional analytics cookies help us improve. You may request access to or correction of your personal information.",
      acceptAll: "Accept all", acceptEssential: "Essential only", manage: "Privacy policy",
      href: "/privacy.html#canada-pipeda"
    },
    fr: {
      flag: "🇨🇦", title: "Vos droits à la vie privée (LPRPDE — Canada)",
      body: "Nous respectons la LPRPDE. Les cookies essentiels sont nécessaires ; les cookies analytiques optionnels nous aident à améliorer. Vous pouvez demander l'accès ou la correction de vos informations personnelles.",
      acceptAll: "Tout accepter", acceptEssential: "Essentiels seulement", manage: "Politique de confidentialité",
      href: "/privacy.html#canada-pipeda"
    },
    es: {
      flag: "🇨🇦", title: "Tus derechos de privacidad (PIPEDA — Canadá)",
      body: "Cumplimos con la PIPEDA. Las cookies esenciales son obligatorias; las cookies analíticas opcionales nos ayudan a mejorar. Puedes solicitar acceso o corrección de tu información personal.",
      acceptAll: "Aceptar todas", acceptEssential: "Solo esenciales", manage: "Política de privacidad",
      href: "/privacy.html#canada-pipeda"
    },
    pt: {
      flag: "🇨🇦", title: "Seus direitos de privacidade (PIPEDA — Canadá)",
      body: "Cumprimos a PIPEDA. Cookies essenciais são obrigatórios; cookies analíticos opcionais nos ajudam a melhorar. Você pode solicitar acesso ou correção de suas informações pessoais.",
      acceptAll: "Aceitar todos", acceptEssential: "Apenas essenciais", manage: "Política de privacidade",
      href: "/privacy.html#canada-pipeda"
    }
  }
};

function _consentCopyFor(region, lang) {
  const regionTab = CONSENT_COPY[region] || null;
  if (!regionTab) return null;
  const lg = GEO_4_LANGS.includes(lang) ? lang : "en";
  if (regionTab[lg]) return regionTab[lg];
  // Fallback order for the region: lg → en → first available
  if (regionTab.en) return regionTab.en;
  const firstK = Object.keys(regionTab)[0];
  return regionTab[firstK] || null;
}

function _consentInjectStyles() {
  if (document.getElementById("saf-consent-styles")) return;
  const s = document.createElement("style");
  s.id = "saf-consent-styles";
  s.textContent = [
    ".saf-consent-backdrop{position:fixed;inset:0;z-index:2147483646;background:rgba(15,23,42,0.35);backdrop-filter:blur(4px);-webkit-backdrop-filter:blur(4px);display:flex;align-items:flex-end;justify-content:center;padding:1rem}",
    "@media(min-width:768px){.saf-consent-backdrop{align-items:center}}",
    ".saf-consent-panel{width:100%;max-width:640px;background:rgba(255,255,255,0.97);border:1px solid rgba(139,92,246,0.25);border-radius:18px;padding:1.25rem 1.3rem;box-shadow:0 20px 50px rgba(15,23,42,0.3);backdrop-filter:blur(12px);animation:safConsentSlide .25s ease-out}",
    "@keyframes safConsentSlide{from{transform:translateY(16px);opacity:0}to{transform:translateY(0);opacity:1}}",
    ".saf-consent-head{display:flex;align-items:flex-start;gap:0.7rem;margin-bottom:0.65rem}",
    ".saf-consent-title{margin:0;font-size:1.02rem;font-weight:800;color:#1e1b4b;line-height:1.25}",
    ".saf-consent-body{margin:0 0 1rem;font-size:0.88rem;color:#374151;line-height:1.55}",
    ".saf-consent-actions{display:flex;gap:0.5rem;flex-wrap:wrap;justify-content:flex-end}",
    ".saf-consent-btn{padding:0.5rem 0.95rem;border-radius:10px;border:1.5px solid #a78bfa;background:transparent;color:#6d28d9;font-weight:700;font-size:0.84rem;cursor:pointer;line-height:1.1}",
    ".saf-consent-btn:hover{background:rgba(167,139,250,0.1)}",
    ".saf-consent-btn.saf-consent-primary{background:linear-gradient(135deg,#8b5cf6,#ec4899);border-color:transparent;color:#fff}",
    ".saf-consent-btn.saf-consent-primary:hover{opacity:0.93}",
    ".saf-consent-link{margin-right:auto;align-self:center;color:#6d28d9;font-weight:600;font-size:0.84rem;text-decoration:none}",
    ".saf-consent-link:hover{text-decoration:underline}"
  ].join("\n");
  document.head.appendChild(s);
}

function renderConsentOverlay() {
  if (typeof document === "undefined") return;
  if (document.getElementById("saf-consent-panel")) return;

  const region = _detectComplianceRegion();
  if (region === "GLOBAL") return; // No strict regulation → no banner

  const stored = _consentRead(region);
  if (stored && stored.version >= _consentVersion() && stored.ts > Date.now() - 180 * 86400e3) return; // Still valid

  const lg = _detectCurrentLang();
  const copy = _consentCopyFor(region, lg);
  if (!copy) return;

  _consentInjectStyles();

  const bd = document.createElement("div");
  bd.className = "saf-consent-backdrop";
  bd.setAttribute("role", "dialog");
  bd.setAttribute("aria-modal", "true");
  bd.setAttribute("aria-labelledby", "saf-consent-title");
  bd.setAttribute("data-region", region);

  const accept = (choices) => {
    _consentWrite(region, choices);
    bd.remove();
    try {
      window.dispatchEvent(new CustomEvent("saf:consent-changed", { detail: { region, choices } }));
    } catch (_) {}
  };

  const actions = [];
  actions.push(h("a", { class: "saf-consent-link", href: copy.href, target: "_blank", rel: "noopener" }, copy.manage));

  if (copy.acceptEssential) {
    actions.push(h("button", {
      class: "saf-consent-btn", type: "button",
      onclick: () => accept("essential")
    }, copy.acceptEssential));
  }
  if (copy.optOut) {
    actions.push(h("button", {
      class: "saf-consent-btn", type: "button",
      onclick: () => accept("essential-optout")
    }, copy.optOut));
  }
  actions.push(h("button", {
    class: "saf-consent-btn saf-consent-primary", type: "button",
    onclick: () => accept("accepted")
  }, copy.acceptAll));

  const panel = h("div", { class: "saf-consent-panel", id: "saf-consent-panel" }, [
    h("div", { class: "saf-consent-head" }, [
      h("div", { ariaHidden: "true", style: { fontSize: "1.4rem", lineHeight: 1 } }, copy.flag || "ℹ️"),
      h("h3", { id: "saf-consent-title", class: "saf-consent-title" }, copy.title)
    ]),
    h("p", { class: "saf-consent-body" }, copy.body),
    h("div", { class: "saf-consent-actions" }, actions)
  ]);

  bd.appendChild(panel);
  const firstRender = () => {
    if (!document.body) { setTimeout(firstRender, 50); return; }
    document.body.appendChild(bd);
  };
  firstRender();
}

function attachPostRenderHooks() {
  installGlobalUtilities();
  setTimeout(() => {
    if (location.pathname === "/" || location.pathname === "" || location.pathname === "/index.html") {
      injectHomeExtraSections();
    }
    if (state.currentSlug) {
      pushEditorHistory(state.currentSlug);
      const card = findCardBySlug(state.currentSlug);
      if (card) injectEditorEnhancements(card);
    }
  }, 40);
}

function renderDiscoverExtraToolbar(initParams) {
  const wrap = document.getElementById("discoverGrid");
  if (!wrap) return;
  const counts = countCardsByCategory();
  const summary = getCategoryStatSummary();
  const header = h("div", {
    style: {
      gridColumn: "1 / -1",
      padding: "0.9rem 1rem",
      borderRadius: "var(--radius-md)",
      background: "rgba(255,255,255,0.6)",
      border: "1px solid rgba(15,23,42,0.06)",
      display: "flex",
      justifyContent: "space-between",
      alignItems: "center",
      flexWrap: "wrap",
      gap: "0.6rem",
      fontSize: "0.85rem"
    }
  }, [
    h("div", {}, [
      h("span", { style: { fontWeight: 700 } }, "Showing " + (wrap.children.length || 0) + " cards"),
      h("span", { style: { color: "var(--saf-text-soft)", marginLeft: "0.6rem" } },
        "of " + formatCount(summary.total) + " total")
    ]),
    h("div", { style: { display: "flex", gap: "0.4rem", flexWrap: "wrap" } }, [
      h("button", {
        class: "btn btn-ghost",
        style: { padding: "0.3rem 0.75rem", fontSize: "0.8rem" },
        onclick: () => {
          const grid = document.getElementById("discoverGrid");
          if (!grid) return;
          const items = Array.from(grid.querySelectorAll(".card-tile"));
          items.sort(() => Math.random() - 0.5);
          items.forEach(it => grid.appendChild(it));
          window.toast("🔀 Shuffled cards", "info");
        }
      }, "🔀 Shuffle"),
      h("button", {
        class: "btn btn-ghost",
        style: { padding: "0.3rem 0.75rem", fontSize: "0.8rem" },
        onclick: () => {
          if (!counts || !Object.keys(counts).length) return;
          const keys = Object.keys(counts);
          const pick = keys[Math.floor(Math.random() * keys.length)];
          const p = new URLSearchParams(location.search);
          p.set("cat", pick);
          history.pushState({}, "", "/discover?" + p.toString());
          renderRoute();
        }
      }, "🎲 Random category")
    ])
  ]);
  wrap.parentNode.insertBefore(header, wrap);

  /* Doc §193 P0-7b: Category ↔ Pricing ↔ Feature interlink hub — anchor text grid at bottom of every discover/category page. */
  try {
    const raw = parseRouteParams();
    const path = _stripLangPrefix(raw.path);
    const simplePath = path.replace(/\/+$/, "") || "/";
    const currentCatSlug = Object.prototype.hasOwnProperty.call(CATEGORY_LABELS, simplePath.startsWith("/") ? simplePath.slice(1) : simplePath)
      ? (simplePath.startsWith("/") ? simplePath.slice(1) : simplePath)
      : (initParams && initParams.get && initParams.get("cat") || null);
    const currentCatLabel = currentCatSlug && CATEGORY_LABELS[currentCatSlug]
      ? CATEGORY_LABELS[currentCatSlug]()
      : null;

    const relatedCats = (currentCatSlug ? getRelatedCategorySlugs(currentCatSlug) : ["birthday","thank-you","christmas","anniversary","love","wedding"]).slice(0,6);
    const RELATED_LINKS = relatedCats.map(c => ({
      href: "/" + c,
      label: getCategoryEmoji(c) + " " + (CATEGORY_LABELS[c] ? CATEGORY_LABELS[c]() : c) + " eCards",
      anchorText: CATEGORY_LABELS[c] ? CATEGORY_LABELS[c]() : c
    }));

    const FEATURES = [
      { href: "/features/envelope-animation", label: "✉️ Envelope Reveal Animation", anchor: "Animated envelope unboxing" },
      { href: "/features/group-collaboration", label: "👥 Group Card Co-Signers", anchor: "Invite 50+ friends to sign group card" },
      { href: "/features/ai-message-generator", label: "🤖 AI Message Writer 4 Languages", anchor: "AI greeting card message ideas" },
      { href: "/features/gif-video", label: "🎞️ GIF & MP4 Video Export", anchor: "Export greeting card as GIF or MP4" },
      { href: "/features/send-later", label: "⏰ Schedule up to 365 Days", anchor: "Schedule birthday cards months in advance" },
      { href: "/features/b2b-bulk", label: "🏢 B2B Bulk 50-1000 Recipients", anchor: "Bulk corporate holiday cards for employees" }
    ];

    const hub = h("section", {
      style: {
        gridColumn: "1 / -1",
        marginTop: "2.2rem",
        padding: "1.4rem 1.2rem",
        borderRadius: "var(--radius-md)",
        background: "linear-gradient(135deg, rgba(167,139,250,0.08), rgba(236,72,153,0.07))",
        border: "1px solid rgba(167,139,250,0.18)"
      }
    }, [
      h("h3", { style: {
        fontSize: "0.78rem", fontWeight: 800, letterSpacing: "0.08em",
        textTransform: "uppercase", color: "var(--saf-primary-dark)", marginBottom: "0.9rem"
      } }, "Explore more — " + (currentCatLabel ? currentCatLabel + " related" : "All templates & features")),
      h("div", { style: {
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "0.55rem", marginBottom: "1.2rem"
      } }, RELATED_LINKS.map(l =>
        h("a", { href: l.href, title: l.anchorText, style: {
          display: "block", padding: "0.6rem 0.8rem", borderRadius: "12px",
          background: "rgba(255,255,255,0.65)", color: "var(--saf-primary-dark)",
          textDecoration: "none", fontWeight: 600, fontSize: "0.88rem",
          border: "1px solid rgba(148,163,184,0.25)"
        } }, l.label)
      )),
      h("div", { style: {
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(220px, 1fr))",
        gap: "0.55rem", marginBottom: "1rem"
      } }, FEATURES.map(l =>
        h("a", { href: l.href, title: l.anchor, style: {
          display: "block", padding: "0.6rem 0.8rem", borderRadius: "12px",
          background: "rgba(255,255,255,0.5)", color: "#4c1d95",
          textDecoration: "none", fontWeight: 600, fontSize: "0.85rem",
          border: "1px solid rgba(167,139,250,0.22)"
        } }, l.label)
      )),
      h("div", { style: {
        display: "flex", justifyContent: "center", marginTop: "0.2rem"
      } }, [
        h("a", { href: "/pricing", title: "SendAFun pricing plans", style: {
          padding: "0.65rem 1.3rem", borderRadius: "12px",
          background: "linear-gradient(135deg, #8b5cf6, #ec4899)", color: "#fff",
          textDecoration: "none", fontWeight: 700, fontSize: "0.92rem",
          boxShadow: "0 6px 18px rgba(139,92,246,0.25)"
        } }, "💲 See pricing — $1.99/send or Unlimited $6.99/mo")
      ])
    ]);
    wrap.parentNode.insertBefore(hub, wrap.nextSibling);
  } catch (_) { /* no-op */ }
}

function getOrganizationJSONLD() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    name: "SendAFun",
    url: "https://sendafun.com",
    logo: "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/birthday/birthday-pexels-8014697-v2-vertical.webp",
    email: "support@sendafun.com",
    description: "Warm, beautiful e-cards sent in under 60 seconds.",
    sameAs: [
      "https://instagram.com/sendafun",
      "https://x.com/sendafun",
      "https://facebook.com/sendafunapp"
    ],
    address: { "@type": "PostalAddress", addressCountry: "US" },
    founder: { "@type": "Person", name: "SendAFun Team" }
  };
}

function renderAbout() {
  clearApp();
  const totalCards = _safeTotal(_realTotalCount() || MAX_REAL_TEMPLATES);
  const wrap = h("div", { style: { maxWidth: "1080px", margin: "0 auto", padding: "3.5rem 1.25rem 6rem" } }, [
    h("section", { style: { textAlign: "center", padding: "1rem 0 3rem" } }, [
      h("p", { style: { color: "var(--saf-primary-dark)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.8rem" } },
        t("about_tag_brand")),
      h("h1", { style: {
        fontSize: "clamp(2.2rem, 4.2vw, 3.3rem)",
        fontFamily: "var(--saf-font-serif)",
        fontWeight: 800,
        letterSpacing: "-0.02em",
        lineHeight: 1.08,
        color: "var(--saf-text-main)",
        margin: "0.9rem auto 1.2rem",
        maxWidth: "760px"
      } }, t("about_hero_title")),
      h("p", { style: { fontSize: "1.1rem", color: "var(--saf-text-soft)", maxWidth: "640px", margin: "0 auto", lineHeight: 1.7 } },
        t("about_hero_body"))
    ]),

    h("section", {
      style: {
        background: "var(--saf-surface-white)",
        borderRadius: "1.5rem",
        padding: "2.5rem 1.5rem",
        border: "1px solid var(--saf-border)",
        boxShadow: "0 10px 30px rgba(31,41,55,0.05)",
        display: "grid",
        gridTemplateColumns: "repeat(auto-fit, minmax(200px, 1fr))",
        gap: "2rem"
      }
    }, [
      (() => {
        const stats = [
          { n: totalCards, l: () => t("about_stat_templates"), s: () => t("about_stat_templates_sub") },
          { n: 240000,    l: () => t("about_stat_sent"),     s: () => t("about_stat_sent_sub") },
          { n: "4h",      l: () => t("about_stat_support"),  s: () => t("about_stat_support_sub") },
          { n: "94%",     l: () => t("about_stat_open"),      s: () => t("about_stat_open_sub") }
        ];
        return stats.map(s => h("div", { style: { textAlign: "center", padding: "0.5rem" } }, [
          h("div", { style: {
            fontSize: "clamp(2rem, 4vw, 2.7rem)",
            fontWeight: 800,
            color: "var(--saf-primary-dark)",
            fontFamily: "var(--saf-font-serif)",
            letterSpacing: "-0.02em"
          } }, (typeof s.n === "number") ? formatCount(s.n) + "+" : s.n),
          h("div", { style: { marginTop: "0.3rem", fontWeight: 600, color: "var(--saf-text-main)" } }, typeof s.l === "function" ? s.l() : String(s.l)),
          h("div", { style: { marginTop: "0.2rem", fontSize: "0.85rem", color: "var(--saf-text-soft)" } }, typeof s.s === "function" ? s.s() : String(s.s))
        ]));
      })()
    ].flat()),

    h("section", { style: { padding: "4rem 0 2rem", display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(280px, 1fr))", gap: "2.5rem", alignItems: "center" } }, [
      h("div", { style: {
        background: "linear-gradient(135deg, #ede9fe 0%, #fce7f3 55%, #fef3c7 100%)",
        borderRadius: "1.5rem",
        aspectRatio: "4 / 5",
        position: "relative",
        overflow: "hidden",
        border: "1px solid var(--saf-border)"
      } }, [
        h("div", { style: {
          position: "absolute",
          inset: "1.5rem",
          borderRadius: "1rem",
          background: "var(--saf-surface-white)",
          padding: "2rem 1.5rem",
          boxShadow: "0 20px 50px rgba(99,102,241,0.18)",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between"
        } }, [
          h("div", { style: { alignSelf: "flex-start", padding: "0.4rem 0.8rem", borderRadius: "999px", background: "var(--saf-primary-purple-soft)", color: "var(--saf-primary-dark)", fontSize: "0.75rem", fontWeight: 700 } },
            t("about_tag_mission")),
          h("p", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "1.45rem", lineHeight: 1.3, color: "var(--saf-text-main)", fontWeight: 700 } },
            t("about_mission_body")),
          h("p", { style: { color: "var(--saf-text-soft)", fontSize: "0.9rem", lineHeight: 1.6 } },
            t("about_mission_origin"))
        ])
      ]),
      h("div", {}, [
        h("h2", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "clamp(1.6rem, 2.6vw, 2.1rem)", margin: "0 0 1rem", color: "var(--saf-text-main)" } },
          t("about_story_title")),
        h("p", { style: { color: "var(--saf-text-soft)", lineHeight: 1.75, marginBottom: "1rem" } },
          t("about_story_p1")),
        h("p", { style: { color: "var(--saf-text-soft)", lineHeight: 1.75, marginBottom: "1rem" } },
          t("about_story_p2")),
        h("p", { style: { color: "var(--saf-text-soft)", lineHeight: 1.75, marginBottom: "1rem" } },
          t("about_story_p3")),
        h("div", { style: { display: "flex", gap: "0.75rem", flexWrap: "wrap", marginTop: "1.5rem" } }, [
          h("a", {
            href: "/discover", class: "btn btn-primary",
            onclick: (e) => { e.preventDefault(); history.pushState({}, "", "/discover"); renderRoute(); }
          }, t("about_browse_cards")),
          h("a", {
            href: "/pricing", class: "btn btn-outline",
            onclick: (e) => { e.preventDefault(); history.pushState({}, "", "/pricing"); renderRoute(); }
          }, t("about_see_pricing"))
        ])
      ])
    ]),

    h("section", { style: { padding: "2rem 0 0" } }, [
      h("h2", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "clamp(1.5rem, 2.4vw, 2rem)", textAlign: "center", margin: "0 0 0.5rem" } },
        t("about_diff_title")),
      h("p", { style: { textAlign: "center", color: "var(--saf-text-soft)", maxWidth: "560px", margin: "0 auto 2rem" } },
        t("about_diff_sub")),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))", gap: "1.25rem" } }, [
        (() => {
          const rows = [
            { i: "🧭", t: () => t("about_diff1_t"), d: () => t("about_diff1_d") },
            { i: "🖋️", t: () => t("about_diff2_t"), d: () => t("about_diff2_d") },
            { i: "📮", t: () => t("about_diff3_t"), d: () => t("about_diff3_d") },
            { i: "🛡️", t: () => t("about_diff4_t"), d: () => t("about_diff4_d") }
          ];
          return rows.map(r => h("div", { style: {
            background: "var(--saf-surface-white)",
            border: "1px solid var(--saf-border)",
            borderRadius: "1rem",
            padding: "1.5rem",
            transition: "transform 0.2s ease, box-shadow 0.2s ease",
          }, onmouseover: (ev) => { ev.currentTarget.style.transform = "translateY(-4px)"; ev.currentTarget.style.boxShadow = "0 14px 32px rgba(31,41,55,0.08)"; },
             onmouseout:  (ev) => { ev.currentTarget.style.transform = "translateY(0)";    ev.currentTarget.style.boxShadow = "none"; }
          }, [
            h("div", { style: { fontSize: "1.8rem" } }, r.i),
            h("h3", { style: { margin: "0.6rem 0 0.3rem", fontWeight: 700, color: "var(--saf-text-main)" } }, typeof r.t === "function" ? r.t() : String(r.t)),
            h("p", { style: { margin: 0, fontSize: "0.92rem", lineHeight: 1.6, color: "var(--saf-text-soft)" } }, typeof r.d === "function" ? r.d() : String(r.d))
          ]));
        })()
      ].flat())
    ]),

    h("section", { style: {
      marginTop: "4rem",
      background: "linear-gradient(135deg, rgba(99,102,241,0.06), rgba(236,72,153,0.06))",
      border: "1px solid var(--saf-border)",
      borderRadius: "1.5rem",
      padding: "2.5rem 1.5rem",
      textAlign: "center"
    } }, [
      h("h2", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "clamp(1.6rem, 2.6vw, 2.2rem)", margin: "0 0 0.6rem", letterSpacing: "-0.01em" } },
        t("about_cta_title")),
      h("p", { style: { color: "var(--saf-text-soft)", maxWidth: "520px", margin: "0 auto 1.5rem", lineHeight: 1.6 } },
        t("about_cta_sub")),
      h("div", { style: { display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" } }, [
        h("a", {
          href: "/discover", class: "btn btn-primary btn-pulse",
          onclick: (e) => { e.preventDefault(); history.pushState({}, "", "/discover"); renderRoute(); }
        }, t("about_cta_browse")),
        h("a", {
          href: "/contact", class: "btn btn-outline",
          onclick: (e) => { e.preventDefault(); history.pushState({}, "", "/contact"); renderRoute(); }
        }, t("about_cta_talk"))
      ])
    ])
  ]);
  mountApp(wrap);
  attachPostRenderHooks();
}

function renderContact() {
  clearApp();
  const wrap = h("div", { style: { maxWidth: "1080px", margin: "0 auto", padding: "3.5rem 1.25rem 6rem" } }, [
    h("section", { style: { textAlign: "center", padding: "1rem 0 2.5rem" } }, [
      h("p", { style: { color: "var(--saf-primary-dark)", fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", fontSize: "0.8rem" } },
        t("contact_tag_brand")),
      h("h1", { style: {
        fontSize: "clamp(2.2rem, 4.2vw, 3.3rem)",
        fontFamily: "var(--saf-font-serif)",
        fontWeight: 800,
        letterSpacing: "-0.02em",
        lineHeight: 1.08,
        color: "var(--saf-text-main)",
        margin: "0.9rem auto 1.2rem",
        maxWidth: "760px"
      } }, t("contact_hero_title")),
      h("p", { style: { fontSize: "1.1rem", color: "var(--saf-text-soft)", maxWidth: "640px", margin: "0 auto", lineHeight: 1.7 } },
        t("contact_hero_body"))
    ]),

    h("section", {
      style: {
        display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(230px, 1fr))",
        gap: "1.25rem", marginBottom: "2.5rem"
      }
    }, [
      (() => {
        const blocks = [
          { i: "📧", t: () => t("contact_block_email_t"), l1: "support@sendafun.com", l2: () => t("contact_block_email_l2"), url: "mailto:support@sendafun.com" },
          { i: "⏱️", t: () => t("contact_block_time_t"), l1: () => t("contact_block_time_l1"), l2: () => t("contact_block_time_l2"), url: null },
          { i: "🏢", t: () => t("contact_block_biz_t"), l1: () => t("contact_block_biz_l1"), l2: () => t("contact_block_biz_l2"), url: "mailto:hello@sendafun.com" }
        ];
        return blocks.map(b => h("a", {
          href: b.url || "javascript:void(0)",
          style: {
            display: "block",
            background: "var(--saf-surface-white)",
            border: "1px solid var(--saf-border)",
            borderRadius: "1rem",
            padding: "1.5rem",
            color: "inherit",
            textDecoration: "none",
            transition: "transform 0.2s ease, box-shadow 0.2s ease"
          },
          onmouseover: (ev) => { ev.currentTarget.style.transform = "translateY(-4px)"; ev.currentTarget.style.boxShadow = "0 14px 32px rgba(31,41,55,0.08)"; },
          onmouseout:  (ev) => { ev.currentTarget.style.transform = "translateY(0)";    ev.currentTarget.style.boxShadow = "none"; }
        }, [
          h("div", { style: { fontSize: "1.8rem" } }, b.i),
          h("div", { style: { marginTop: "0.7rem", fontWeight: 700, color: "var(--saf-text-main)" } }, typeof b.t === "function" ? b.t() : String(b.t)),
          h("div", { style: { marginTop: "0.4rem", color: "var(--saf-primary-dark)", fontWeight: 600 } }, typeof b.l1 === "function" ? b.l1() : String(b.l1)),
          h("div", { style: { marginTop: "0.15rem", fontSize: "0.85rem", color: "var(--saf-text-soft)" } }, typeof b.l2 === "function" ? b.l2() : String(b.l2))
        ]));
      })()
    ].flat()),

    h("section", { class: "contact-main-grid", style: { display: "grid", gridTemplateColumns: "1.3fr 1fr", gap: "2rem", alignItems: "start" } }, [
      h("form", {
        id: "contactForm",
        style: {
          background: "var(--saf-surface-white)",
          border: "1px solid var(--saf-border)",
          borderRadius: "1.25rem",
          padding: "2rem 1.5rem",
          boxShadow: "0 10px 30px rgba(31,41,55,0.05)"
        },
        onsubmit: async (e) => {
          e.preventDefault();
          const name = (document.getElementById("cf-name") || {}).value || "";
          const email = (document.getElementById("cf-email") || {}).value || "";
          const topic = (document.getElementById("cf-topic") || {}).value || "";
          const msg = (document.getElementById("cf-message") || {}).value || "";
          if (name.length < 2) { window.toast(t("contact_err_name"), "error"); return; }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { window.toast(t("contact_err_email"), "error"); return; }
          if (msg.length < 10) { window.toast(t("contact_err_msg"), "error"); return; }
          const submitBtn = e.currentTarget.querySelector('button[type="submit"]');
          const originalBtnText = submitBtn ? submitBtn.textContent : "";
          if (submitBtn) { submitBtn.disabled = true; submitBtn.textContent = t("contact_sending"); }
          const payload = JSON.stringify({ name, email, topic, message: msg, sentAt: new Date().toISOString() });
          try { localStorage.setItem("saf_contact_" + Date.now(), payload); } catch (_) {}
          try {
            const r = await fetch(API_BASE + "/contact", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: payload
            });
            const data = r.ok ? await r.json().catch(() => ({})) : {};
            if (!r.ok && !(data && data.ok)) {
              throw new Error("Server " + r.status);
            }
          } catch (err) {
            if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
            window.toast(t("contact_save_local") + err.message + ")", "error", 8000);
            return;
          }
          try { e.currentTarget.reset(); } catch (_) {}
          if (submitBtn) { submitBtn.disabled = false; submitBtn.textContent = originalBtnText; }
          window.toast(t("contact_thanks_prefix") + name.split(" ")[0] + t("contact_thanks_suffix") + email + t("contact_thanks_close"), "success", 7000);
        }
      }, [
        h("h2", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "1.5rem", margin: "0 0 1.5rem" } }, t("contact_form_title")),
        h("div", { class: "contact-form-dual", style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.9rem" } }, [
          h("label", { for: "cf-name", style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--saf-text-main)" } }, [
            t("contact_name"),
            h("input", { id: "cf-name", name: "name", type: "text", autocomplete: "name", placeholder: t("contact_field_name_ph"), style: {
              padding: "0.7rem 0.9rem",
              borderRadius: "0.7rem",
              border: "1px solid var(--saf-border)",
              background: "var(--saf-bg-input)",
              color: "var(--saf-text-main)",
              fontSize: "0.95rem",
              outline: "none"
            }, onfocus: (ev) => { ev.currentTarget.style.borderColor = "var(--saf-primary-dark)"; ev.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; },
               onblur:  (ev) => { ev.currentTarget.style.borderColor = "var(--saf-border)";   ev.currentTarget.style.boxShadow = "none"; } })
          ]),
          h("label", { for: "cf-email", style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--saf-text-main)" } }, [
            t("contact_field_email_lbl"),
            h("input", { id: "cf-email", name: "email", type: "email", autocomplete: "email", placeholder: t("contact_field_email_ph"), style: {
              padding: "0.7rem 0.9rem",
              borderRadius: "0.7rem",
              border: "1px solid var(--saf-border)",
              background: "var(--saf-bg-input)",
              color: "var(--saf-text-main)",
              fontSize: "0.95rem",
              outline: "none"
            }, onfocus: (ev) => { ev.currentTarget.style.borderColor = "var(--saf-primary-dark)"; ev.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; },
               onblur:  (ev) => { ev.currentTarget.style.borderColor = "var(--saf-border)";   ev.currentTarget.style.boxShadow = "none"; } })
          ])
        ]),
        h("label", { for: "cf-topic", style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--saf-text-main)", marginTop: "0.9rem" } }, [
          t("contact_field_topic_lbl"),
          h("select", { id: "cf-topic", name: "topic", style: {
            padding: "0.7rem 0.9rem",
            borderRadius: "0.7rem",
            border: "1px solid var(--saf-border)",
            background: "var(--saf-bg-input)",
            color: "var(--saf-text-main)",
            fontSize: "0.95rem"
          } }, [
            h("option", { value: "support" }, t("contact_topic_support")),
            h("option", { value: "feature" }, t("contact_topic_feature")),
            h("option", { value: "bug" }, t("contact_topic_bug")),
            h("option", { value: "press" }, t("contact_topic_press")),
            h("option", { value: "business" }, t("contact_topic_business")),
            h("option", { value: "other" }, t("contact_topic_other"))
          ])
        ]),
        h("label", { for: "cf-message", style: { display: "flex", flexDirection: "column", gap: "0.35rem", fontWeight: 600, fontSize: "0.9rem", color: "var(--saf-text-main)", marginTop: "0.9rem" } }, [
          t("contact_field_msg_lbl"),
          h("textarea", { id: "cf-message", name: "message", rows: 5, placeholder: t("contact_field_msg_ph"), style: {
            padding: "0.7rem 0.9rem",
            borderRadius: "0.7rem",
            border: "1px solid var(--saf-border)",
            background: "var(--saf-bg-input)",
            color: "var(--saf-text-main)",
            fontSize: "0.95rem",
            resize: "vertical",
            minHeight: "130px",
            outline: "none"
          }, onfocus: (ev) => { ev.currentTarget.style.borderColor = "var(--saf-primary-dark)"; ev.currentTarget.style.boxShadow = "0 0 0 3px rgba(99,102,241,0.15)"; },
             onblur:  (ev) => { ev.currentTarget.style.borderColor = "var(--saf-border)";   ev.currentTarget.style.boxShadow = "none"; } })
        ]),
        h("div", { style: { display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: "1.5rem", gap: "1rem", flexWrap: "wrap" } }, [
          h("p", { style: { margin: 0, fontSize: "0.8rem", color: "var(--saf-text-soft)", maxWidth: "320px", lineHeight: 1.5 } },
            t("contact_privacy_note")),
          h("button", { type: "submit", class: "btn btn-primary btn-pulse" }, t("contact_send_btn"))
        ])
      ]),

      h("aside", { style: { display: "flex", flexDirection: "column", gap: "1.25rem" } }, [
        h("div", { style: {
          background: "linear-gradient(135deg, #fef3c7 0%, #fce7f3 55%, #ede9fe 100%)",
          borderRadius: "1.25rem",
          padding: "1.5rem",
          border: "1px solid var(--saf-border)"
        } }, [
          h("h3", { style: { margin: "0 0 0.5rem", fontFamily: "var(--saf-font-serif)", fontSize: "1.2rem" } }, t("contact_online_title")),
          h("ul", { style: { listStyle: "none", padding: 0, margin: 0, fontSize: "0.92rem", color: "var(--saf-text-main)", lineHeight: 1.8 } }, [
            h("li", {}, t("contact_online_weekday")),
            h("li", {}, t("contact_online_weekend")),
            h("li", { style: { fontWeight: 700, marginTop: "0.4rem", color: "var(--saf-primary-dark)" } }, t("contact_online_sla"))
          ])
        ]),

        h("div", { style: { background: "var(--saf-surface-white)", border: "1px solid var(--saf-border)", borderRadius: "1.25rem", padding: "1.5rem" } }, [
          h("h3", { style: { margin: "0 0 0.8rem", fontFamily: "var(--saf-font-serif)", fontSize: "1.2rem" } }, t("contact_social_title")),
          h("div", { style: { display: "grid", gridTemplateColumns: "1fr 1fr", gap: "0.6rem" } }, [
            (() => {
              const socials = [
                { i: "📷", l: () => t("contact_social_instagram"), h: "https://instagram.com/sendafun" },
                { i: "🐦", l: () => t("contact_social_twitter"), h: "https://x.com/sendafun" },
                { i: "📘", l: () => t("contact_social_facebook"),  h: "https://facebook.com/sendafunapp" },
                { i: "🎴", l: () => t("contact_social_pinterest"), h: "https://pinterest.com/sendafun" }
              ];
              return socials.map(s => h("a", {
                href: s.h, target: "_blank", rel: "noopener noreferrer",
                style: {
                  display: "flex", alignItems: "center", gap: "0.5rem",
                  padding: "0.7rem 0.9rem",
                  border: "1px solid var(--saf-border)",
                  borderRadius: "0.7rem",
                  color: "var(--saf-text-main)",
                  textDecoration: "none",
                  fontWeight: 600,
                  fontSize: "0.88rem",
                  transition: "border-color 0.15s ease, background 0.15s ease",
                  background: "var(--saf-surface-white)"
                },
                onmouseover: (ev) => { ev.currentTarget.style.background = "var(--saf-primary-purple-soft)"; ev.currentTarget.style.borderColor = "var(--saf-primary-dark)"; },
                onmouseout:  (ev) => { ev.currentTarget.style.background = "var(--saf-surface-white)"; ev.currentTarget.style.borderColor = "var(--saf-border)"; }
              }, [
                h("span", {}, s.i), h("span", {}, typeof s.l === "function" ? s.l() : String(s.l))
              ]));
            })()
          ].flat())
        ])
      ])
    ]),

    h("section", { id: "contactFAQ", style: { marginTop: "3.5rem" } }, [
      h("h2", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "clamp(1.5rem, 2.4vw, 2rem)", textAlign: "center", margin: "0 0 0.5rem" } },
        t("contact_faq_title")),
      h("p", { style: { textAlign: "center", color: "var(--saf-text-soft)", maxWidth: "560px", margin: "0 auto 2rem" } },
        t("contact_faq_sub")),
      h("div", { style: { maxWidth: "780px", margin: "0 auto", display: "flex", flexDirection: "column", gap: "0.8rem" } }, [
        (() => {
          const faqs = [
            { q: () => t("contact_faq_q1"), a: () => t("contact_faq_a1") },
            { q: () => t("contact_faq_q2"), a: () => t("contact_faq_a2") },
            { q: () => t("contact_faq_q3"), a: () => t("contact_faq_a3") },
            { q: () => t("contact_faq_q4"), a: () => t("contact_faq_a4") },
            { q: () => t("contact_faq_q5"), a: () => t("contact_faq_a5") },
            { q: () => t("contact_faq_q6"), a: () => t("contact_faq_a6") }
          ];
          return faqs.map((f, idx) => {
            const id = "faq-item-" + idx;
            return h("div", {
              class: "faq-item",
              style: {
                background: "var(--saf-surface-white)",
                border: "1px solid var(--saf-border)",
                borderRadius: "0.9rem",
                overflow: "hidden"
              }
            }, [
              h("button", {
                type: "button",
                "aria-controls": id, "aria-expanded": "false",
                onclick: (e) => {
                  const btn = e.currentTarget;
                  const body = document.getElementById(id);
                  if (!body) return;
                  const expanded = btn.getAttribute("aria-expanded") === "true";
                  btn.setAttribute("aria-expanded", String(!expanded));
                  const icon = btn.querySelector(".faq-chevron");
                  if (icon) icon.style.transform = expanded ? "rotate(0deg)" : "rotate(180deg)";
                  if (expanded) {
                    body.style.maxHeight = body.scrollHeight + "px";
                    requestAnimationFrame(() => { body.style.maxHeight = "0px"; });
                  } else {
                    body.style.maxHeight = "0px";
                    requestAnimationFrame(() => { body.style.maxHeight = body.scrollHeight + "px"; });
                  }
                },
                style: {
                  width: "100%",
                  background: "transparent",
                  border: "none",
                  padding: "1rem 1.15rem",
                  textAlign: "left",
                  cursor: "pointer",
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  gap: "1rem",
                  fontSize: "0.98rem",
                  fontWeight: 600,
                  color: "var(--saf-text-main)"
                }
              }, [
                h("span", {}, typeof f.q === "function" ? f.q() : String(f.q)),
                h("span", {
                  class: "faq-chevron",
                  style: {
                    transition: "transform 0.25s ease",
                    color: "var(--saf-text-soft)",
                    fontSize: "1.1rem",
                    flexShrink: 0
                  }
                }, "▾")
              ]),
              h("div", {
                id: id,
                style: {
                  maxHeight: "0px",
                  overflow: "hidden",
                  transition: "max-height 0.3s ease",
                  padding: "0 1.15rem"
                }
              }, [
                h("p", { style: {
                  margin: "0 0 1.15rem",
                  lineHeight: 1.7,
                  color: "var(--saf-text-soft)",
                  fontSize: "0.92rem"
                } }, typeof f.a === "function" ? f.a() : String(f.a))
              ])
            ]);
          });
        })()
      ].flat())
    ]),

    h("section", { style: {
      marginTop: "3.5rem",
      textAlign: "center",
      background: "var(--saf-surface-white)",
      border: "1px solid var(--saf-border)",
      borderRadius: "1.5rem",
      padding: "2.5rem 1.5rem"
    } }, [
      h("h2", { style: { fontFamily: "var(--saf-font-serif)", fontSize: "clamp(1.5rem, 2.4vw, 2rem)", margin: "0 0 0.5rem" } },
        t("contact_final_title")),
      h("p", { style: { color: "var(--saf-text-soft)", maxWidth: "520px", margin: "0 auto 1.5rem", lineHeight: 1.6 } },
        t("contact_final_sub")),
      h("div", { style: { display: "flex", gap: "0.75rem", justifyContent: "center", flexWrap: "wrap" } }, [
        h("a", {
          href: "/discover", class: "btn btn-primary btn-pulse",
          onclick: (e) => { e.preventDefault(); history.pushState({}, "", "/discover"); renderRoute(); }
        }, t("contact_final_explore")),
        h("a", {
          href: "/about", class: "btn btn-outline",
          onclick: (e) => { e.preventDefault(); history.pushState({}, "", "/about"); renderRoute(); }
        }, t("contact_final_about"))
      ])
    ])
  ]);
  mountApp(wrap);
  attachPostRenderHooks();
}

function renderNotFound() {
  clearApp();
  const wrap = h("div", {
    class: "fade-in",
    style: {
      textAlign: "center", padding: "5rem 1rem",
      maxWidth: "500px", margin: "0 auto"
    }
  }, [
    h("div", { style: { fontSize: "5rem" } }, "😵"),
    h("h1", {
      style: {
        fontFamily: "'Playfair Display', serif",
        margin: "0.8rem 0 0.3rem", fontSize: "2.2rem"
      }
    }, t("notfound_title")),
    h("p", {
      style: { color: "var(--saf-text-soft)", margin: "0 0 1.8rem" }
    }, t("notfound_body")),
    h("div", { style: { display: "flex", gap: "0.6rem", justifyContent: "center", flexWrap: "wrap" } }, [
      h("button", {
        class: "btn btn-primary",
        onclick: () => {
          history.pushState({}, "", "/");
          renderRoute();
        }
      }, t("notfound_btn_home")),
      h("button", {
        class: "btn btn-ghost",
        onclick: () => {
          history.pushState({}, "", "/discover");
          renderRoute();
        }
      }, t("notfound_btn_browse")),
      h("button", {
        class: "btn btn-ghost",
        onclick: () => {
          history.pushState({}, "", "/pricing");
          renderRoute();
        }
      }, t("notfound_btn_pricing"))
    ]),
    h("div", {
      style: {
        marginTop: "2.5rem",
        padding: "1.2rem",
        borderRadius: "var(--radius-md)",
        background: "rgba(99,102,241,0.06)",
        border: "1px solid rgba(99,102,241,0.12)",
        fontSize: "0.85rem",
        textAlign: "left"
      }
    }, [
      h("div", { style: { fontWeight: 700, marginBottom: "0.5rem" } }, t("notfound_quicklinks_title")),
      h("div", { style: { display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px,1fr))", gap: "0.4rem" } }, [
        h("a", { href: "/discover", onclick: e => { e.preventDefault(); history.pushState({}, "", "/discover"); renderRoute(); }, style: { color: "var(--saf-primary-dark)", textDecoration: "underline" } }, t("notfound_ql_discover")),
        h("a", { href: "/pricing", onclick: e => { e.preventDefault(); history.pushState({}, "", "/pricing"); renderRoute(); }, style: { color: "var(--saf-primary-dark)", textDecoration: "underline" } }, t("notfound_ql_pricing")),
        h("a", { href: "/about.html", style: { color: "var(--saf-primary-dark)", textDecoration: "underline" } }, t("notfound_ql_about")),
        h("a", { href: "/contact.html", style: { color: "var(--saf-primary-dark)", textDecoration: "underline" } }, t("notfound_ql_contact"))
      ])
    ])
  ]);
  mountApp(wrap);
  attachPostRenderHooks();
}

document.addEventListener("DOMContentLoaded", main);

function main() {
  window.CARDS = [];
  window.PRODUCTS = [];
  restoreIntentStateFromStorage();
  installToast();
  injectFooter();
  injectCookieBanner();
  try { initLangPickerHighlight(); } catch (_) {}
  attachGlobalNavLinks();
  loadMetaAndBoot();
  window.addEventListener("popstate", () => renderRoute());
  renderRoute();
}

function _detectCurrentLang() {
  // 1) Priority A: manual override cookie (set by /api/lang/set)
  try {
    const m = /(?:^|;\s*)saf_lang_override=([a-z]{2})/i.exec(document.cookie || "");
    if (m && /^(en|es|fr|pt)$/i.test(m[1])) return m[1].toLowerCase();
  } catch (_) {}
  // 2) Priority B: URL path prefix /en|/es|/fr|/pt/ (SPA hash or raw route)
  const path = String(location.pathname || "/") + String(location.hash || "");
  const u = /\/(en|es|fr|pt)(?:\/|$|[#?])/i.exec(path);
  if (u) return u[1].toLowerCase();
  // 3) Priority C: default EN (matches Worker GEO_DEFAULT_LANG fallback)
  return "en";
}

function initLangPickerHighlight() {
  // Doc §169 top-bar permanent language selector. Keep <select> current value
  // in sync with manual override cookie / URL prefix so users don't get confused
  // and keep re-selecting the same option. Idempotent — safe to call multiple
  // times on hash / popstate changes (no flicker — only updates if different).
  const sel = document.getElementById("safLangPicker");
  if (!sel) return;
  const next = _detectCurrentLang();
  if (sel.value && String(sel.value).toLowerCase() === next) return;
  // Avoid triggering unwanted re-renders: set attribute + value without change event
  const opts = sel.options || [];
  for (let i = 0; i < opts.length; i++) {
    const v = String(opts[i].value || "").toLowerCase();
    opts[i].selected = (v === next);
  }
  sel.value = next;
}
