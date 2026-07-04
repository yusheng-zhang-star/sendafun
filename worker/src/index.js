const SITE_URL_PROD = "https://sendafun.com";
const RESEND_FROM = "support@sendafun.com";
const PRODUCT_TO_CREEM = {
  sendafun_pay_per_send: "prod_7GGx4Gh5yvKLOb0OCzYFoq",
  sendafun_monthly_subscription: "prod_3xVdtK0wdzqLlaCz4H7lzQ",
  sendafun_annual_subscription: "prod_73aCoww3uhNMevKi8NVwNv",
  sendafun_group_pass: "prod_6FsQQfkCT71L7GaLMYANiA"
};;
const PLAN_TYPES = {
  sendafun_pay_per_send: 'one',
  sendafun_monthly_subscription: 'month',
  sendafun_annual_subscription: 'year',
  sendafun_group_pass: 'group'
};
const DAYS_BY_PLAN = { month: 30, year: 365, group: 30 };
const MAX_SIGS_BY_PLAN = { month: Infinity, year: Infinity, one: 10, group: 50, free: 5 };

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

const AI_TIER_QUOTA = Object.freeze({
  anon:      { daily: 3,   label: "anon" },
  free:      { daily: 5,   label: "free" },
  paid:      { daily: 15,  label: "paid" },
  unlimited: { daily: Infinity, label: "unlimited" }
});

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

function _aiGenerateMessage({ occasion, category, locale, to_name, from_name }) {
  const lang = GEO_4_LANGS.includes(String(locale || "").toLowerCase()) ? String(locale).toLowerCase() : "en";
  const bank = AI_WORDBANK[lang] || AI_WORDBANK.en;
  const occ = occasion || _categoryToOccasion(category);
  const bodyPool = bank.bodies[occ] || bank.bodies.default;
  const toLabel = to_name && String(to_name).trim() ? String(to_name).trim() : "there";
  const fromLabel = from_name && String(from_name).trim() ? String(from_name).trim() : "";
  const opening = _aiPick(bank.openings).replace(/\{to\}/g, toLabel);
  const body = _aiPick(bodyPool);
  const closing = _aiPick(bank.closings);
  const signoff = _aiPick(bank.signoffs).replace(/\{from\}/g, fromLabel || "me");
  if (fromLabel) {
    return `${opening}\n\n${body}\n\n${closing}\n${signoff}`;
  }
  return `${opening}\n\n${body}\n\n${closing}`;
}

function _resolveCurrentTier(request, body) {
  const cookieHdr = (request && request.headers && request.headers.get && request.headers.get('cookie')) || '';
  const safPlan = getCookie(cookieHdr, 'saf_plan');
  if (safPlan === 'annual') return 'unlimited';
  if (safPlan === 'monthly' || safPlan === 'group_pass' || safPlan === 'paid' || safPlan === 'group') return 'paid';
  const fromEmail = (body && (body.from_email || body.fromEmail)) ? String(body.from_email || body.fromEmail).trim() : '';
  if (fromEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(fromEmail)) return 'free';
  return 'anon';
}

function _requireTier(featureKey, request, body) {
  const ft = FEATURE_TIER_MATRIX[featureKey];
  if (!ft) return true;
  const current = _resolveCurrentTier(request, body);
  const need = TIER_RANK[ft.min] ?? 0;
  const have = TIER_RANK[current] ?? 0;
  return have >= need;
}

function _tierDeniedResponse(featureKey, request, body) {
  const ft = FEATURE_TIER_MATRIX[featureKey] || { min: 'paid', name: featureKey };
  const current = _resolveCurrentTier(request, body);
  const tierCfg = AI_TIER_QUOTA[current] || AI_TIER_QUOTA.anon;
  const daily = tierCfg.daily;
  return json({
    ok: false,
    error: "Upgrade required",
    upgrade: {
      feature: featureKey,
      requiredMin: ft.min,
      current: current
    },
    quota: {
      tier: tierCfg.label,
      tierLabel: TIER_LABEL[current] || TIER_LABEL.anon,
      daily: daily === Infinity ? 9999 : daily,
      used: 0
    }
  }, 402);
}

function _daysFromNow(sendAtMs) {
  const now = Date.now();
  const diffMs = Math.max(0, (sendAtMs || now) - now);
  return Math.ceil(diffMs / 86400000);
}

function _scheduleTierKeyFromDays(days) {
  if (days <= 0) return null;
  if (days <= 7) return 'schedule_7d';
  if (days <= 30) return 'schedule_30d';
  return 'schedule_365d';
}

function _aiResolveTier(request, fromEmail) {
  const cookieHdr = request.headers.get('cookie') || '';
  const safPlan = getCookie(cookieHdr, 'saf_plan');
  if (safPlan === 'monthly' || safPlan === 'annual' || safPlan === 'group') {
    return 'paid';
  }
  if (fromEmail && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(fromEmail).trim())) {
    return 'free';
  }
  return 'anon';
}

function _aiTierKey(request, tier, fromEmail) {
  if (tier === 'free' || tier === 'paid') {
    const email = fromEmail ? String(fromEmail).toLowerCase().trim() : '';
    if (email) return 'email:' + email;
  }
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';
  return 'ip:' + ip;
}

function _aiTodayKey() {
  const d = new Date();
  const p = n => (n < 10 ? "0" + n : "" + n);
  return d.getUTCFullYear() + p(d.getUTCMonth() + 1) + p(d.getUTCDate());
}

async function handleAIMessage(request, env) {
  const SAF_KV = (env && env.SAF_KV) || null;
  let body;
  try { body = await request.json(); } catch (_) { body = {}; }
  body = body || {};

  const occasion = body.occasion || '';
  const category = body.category || '';
  const locale = body.locale || 'en';
  const to_name = body.to_name || '';
  const from_name = body.from_name || '';
  const from_email = body.from_email || '';

  const tierFeature = (body.premium || body.paid_tier) ? 'ai_message_paid' : 'ai_message_basic';
  if (!_requireTier(tierFeature, request, body)) {
    return _tierDeniedResponse(tierFeature, request, body);
  }

  let tier = _aiResolveTier(request, from_email);
  const tierCfg = AI_TIER_QUOTA[tier] || AI_TIER_QUOTA.anon;
  const daily = tierCfg.daily;

  let used = 0;
  const todayKey = _aiTodayKey();
  const tierKey = _aiTierKey(request, tier, from_email);
  const kvKey = `ai_usage:${todayKey}:${tierKey}`;

  if (tier !== 'unlimited' && SAF_KV) {
    try {
      const raw = await SAF_KV.get(kvKey, { type: 'text' });
      used = parseInt(raw || '0', 10) || 0;
    } catch (_) { used = 0; }
  }

  if (tier !== 'unlimited' && used >= daily) {
    return json({
      ok: false,
      error: "Rate limited",
      quota: { tier: tierCfg.label, used, daily }
    }, 429);
  }

  const message = _aiGenerateMessage({ occasion, category, locale, to_name, from_name });

  if (tier !== 'unlimited' && SAF_KV) {
    try {
      const nextUsed = used + 1;
      const ttlS = 48 * 3600;
      await SAF_KV.put(kvKey, String(nextUsed), { expirationTtl: ttlS });
      used = nextUsed;
    } catch (_) { }
  }

  return json({
    ok: true,
    message,
    quota: { tier: tierCfg.label, used, daily: daily === Infinity ? 9999 : daily }
  }, 200);
}

function CREEM_BASE_FROM_KEY(k) {
  return (k || '').startsWith('creem_live_') ? 'https://api.creem.io/v1' : 'https://test-api.creem.io/v1';
}
function CORS(res) {
  res.headers.set('Access-Control-Allow-Origin', '*');
  res.headers.set('Access-Control-Allow-Methods', 'GET,POST,OPTIONS');
  res.headers.set('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  return res;
}
function json(obj, st = 200) {
  return CORS(new Response(JSON.stringify(obj), {
    status: st,
    headers: {
      'Content-Type': 'application/json;charset=utf-8',
      'Cache-Control': 'no-cache, no-store, must-revalidate',
      'Pragma': 'no-cache'
    }
  }));
}
function getCookie(header, name) {
  const m = (header || '').match(new RegExp('(?:^|; )' + name + '=([^;]*)'));
  return m ? decodeURIComponent(m[1]) : null;
}
function randToken(bytes = 10) {
  const a = crypto.getRandomValues(new Uint8Array(bytes));
  return Array.from(a).map(b => b.toString(36)).join('').slice(0, 20);
}
function getEnvVar(env, name, fallback) {
  const v = env[name] || globalThis[name] || null;
  return v || fallback;
}
function esc(s) {
  return String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

// ============================================================
// B-1: Geo Language Diversion + Bot Exemption + Cookie Memory
// Doc §13.2.1: cf.country → /en|/es|/fr|/pt, crawlers exempt,
// session Cookie saf_lang_override remembers manual switch.
// ============================================================
const GEO_4_LANGS = ["en", "es", "fr", "pt"];
const GEO_DEFAULT_LANG = "en";
const GEO_COUNTRY_TO_LANG = {
  US:"en", GB:"en", AU:"en", NZ:"en", IE:"en", SG:"en", PH:"en", IN:"en", ZA:"en",
  ES:"es", MX:"es", AR:"es", CL:"es", CO:"es", PE:"es", VE:"es", GT:"es", CU:"es",
  BO:"es", DO:"es", EC:"es", SV:"es", HN:"es", NI:"es", PA:"es", PY:"es", UY:"es", CR:"es",
  FR:"fr", BE:"fr", CH:"fr", LU:"fr", MC:"fr",
  CA:"en",
  BR:"pt"
};
const GEO_CRAWLER_UA_RE = /googlebot|bingbot|yandex|baiduspider|duckduckbot|facebot|facebookexternalhit|twitterbot|applebot|pinterest|slurp|ia_archiver|semrush|ahrefs|mj12bot|petalbot|sogou/i;
const GEO_LANG_OVERRIDE_COOKIE = "saf_lang_override";

function _isCrawlerRequest(req) {
  const ua = req.headers.get("User-Agent") || "";
  return GEO_CRAWLER_UA_RE.test(ua);
}

function _langFromCountry(countryCode) {
  if (!countryCode) return GEO_DEFAULT_LANG;
  const cc = String(countryCode).toUpperCase();
  return GEO_COUNTRY_TO_LANG[cc] || GEO_DEFAULT_LANG;
}

function _pathStrippedOfLangPrefix(pathname) {
  // returns {pathWithoutPrefix, langOrNull}
  const m = String(pathname || "").match(/^\/(en|es|fr|pt)(?:\/(.*))?$/i);
  if (!m) return { cleanPath: pathname, lang: null };
  const lang = m[1].toLowerCase();
  const rest = "/" + (m[2] || "");
  return { cleanPath: rest === "//" ? "/" : rest, lang };
}

function _hreflangBlock(pathForHref) {
  // Doc §101: bidirectional cross hreflang + x-default, ALL absolute URLs.
  const base = SITE_URL_PROD.replace(/\/+$/, "");
  const clean = ("/" + String(pathForHref || "").replace(/^\/+/, "")).replace(/^\/\/+$/, "/");
  const alt = (lg) => `  <link rel="alternate" hreflang="${lg}" href="${esc(base + "/" + lg + clean)}">\n`;
  const xdef = `  <link rel="alternate" hreflang="x-default" href="${esc(base + clean)}">\n`;
  return alt("en") + alt("es") + alt("fr") + alt("pt") + xdef;
}

// Doc §217: Schema.org Organization — areaServed 7 core countries.
// Safe idempotent inject: if JSON-LD already present, skip.
function _orgSchemaJsonLdBlock() {
  const payload = {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "SendAFun",
    "alternateName": "Send A Fun — Digital Group E-Cards",
    "url": SITE_URL_PROD.replace(/\/+$/, ""),
    "logo": SITE_URL_PROD.replace(/\/+$/, "") + "/og-logo.png",
    "areaServed": ["US","GB","CA","FR","ES","MX","BR"],
    "sameAs": [
      "https://facebook.com/sendafun",
      "https://instagram.com/sendafun",
      "https://x.com/sendafun",
      "https://pinterest.com/sendafun"
    ],
    "contactPoint": {
      "@type": "ContactPoint",
      "contactType": "customer support",
      "email": "hello@sendafun.com",
      "availableLanguage": ["English","Spanish","French","Portuguese"]
    }
  };
  return '  <script type="application/ld+json">\n'
       + '    ' + JSON.stringify(payload) + '\n'
       + '  </script>\n';
}

function _injectHreflangIntoHtml(htmlText, pathForHref) {
  // Insert hreflang block + Schema JSON-LD right before </head>. Safe idempotent:
  // skip each block if its signature is already present.
  if (!htmlText) return htmlText;
  let out = htmlText;
  if (!/hreflang\s*=\s*["']x-default["']/i.test(out)) {
    const block = _hreflangBlock(pathForHref);
    const idx = out.lastIndexOf("</head>");
    if (idx >= 0) out = out.slice(0, idx) + block + "</head>" + out.slice(idx + "</head>".length);
  }
  if (!/application\/ld\+json/i.test(out)) {
    const block = _orgSchemaJsonLdBlock();
    const idx = out.lastIndexOf("</head>");
    if (idx >= 0) out = out.slice(0, idx) + block + "</head>" + out.slice(idx + "</head>".length);
  }
  return out;
}

// Doc §178 — Country-specific marketing copy + featured category recommendation.
// Key idea: users from BR see "Carnaval" on hero; users from MX see "5 de Mayo";
// users from US/CA see "Thanksgiving / 4th of July" etc. Returns pure data;
// the front-end decides how to render.
function _geoMarketingContext(countryCode, effLang) {
  const cc = (countryCode || "").toUpperCase();
  const lg = GEO_4_LANGS.includes(String(effLang || "").toLowerCase())
    ? String(effLang).toLowerCase()
    : (
      ["ES"].includes(cc) ? "es" :
      ["FR","BE","CH","LU","CA"].includes(cc) ? "fr" :
      ["BR","PT"].includes(cc) ? "pt" : "en"
    );

  const G = {
    en: {
      heroSlogan: "Design a group card in 30 seconds. Invite friends to sign. Send beautifully animated.",
      ctaButton: "Start Your Card — Free Preview",
      subline: "Free design &amp; preview forever. No signup required. $1.99/send or unlimited from $6.99/month.",
    },
    es: {
      heroSlogan: "Diseña una tarjeta grupal en 30 segundos. Invita amigos a firmar. Envíala con animación.",
      ctaButton: "Empieza tu tarjeta — Vista previa gratis",
      subline: "Diseño y vista previa gratuitos para siempre. Sin registro. $1.99/envío o ilimitado desde $6.99/mes.",
    },
    fr: {
      heroSlogan: "Créez une carte de groupe en 30 secondes. Invitez des amis à signer. Envoyez avec une belle animation.",
      ctaButton: "Commencez votre carte — Aperçu gratuit",
      subline: "Conception et aperçu gratuits à vie. Pas d'inscription. 1,99 $/envoi ou illimité dès 6,99 $/mois.",
    },
    pt: {
      heroSlogan: "Crie um cartão em grupo em 30 segundos. Convide amigos para assinar. Envie com animação linda.",
      ctaButton: "Comece seu cartão — Pré-visualização grátis",
      subline: "Criação e prévia gratuitas para sempre. Sem cadastro. R$ 11,99/envio ou ilimitado de R$ 41,90/mês.",
    },
  };

  // Country → category slug + envelope theme (Doc §178 envelope skin regional preference).
  const C = {
    MX: {
      featuredCategory: "cinco-de-mayo",
      featuredCategoryLabel: {
        en: "🇲🇽 Cinco de Mayo Cards",
        es: "🇲🇽 Tarjetas del 5 de Mayo",
        fr: "🇲🇽 Cartes Cinco de Mayo",
        pt: "🇲🇽 Cartões 5 de Maio",
      },
      heroExtra: {
        es: "🎉 Envía una tarjeta del 5 de Mayo personalizada a toda tu familia — directo al WhatsApp.",
        en: "🎉 Send a personalised Cinco de Mayo card to your whole family — straight to WhatsApp.",
        fr: "🎉 Envoyez une carte personnalisée du 5 mai à toute votre famille.",
        pt: "🎉 Envie um cartão personalizado do 5 de Maio para toda sua família.",
      },
      suggestedEnvelopeStyle: "serape-stripes",
    },
    BR: {
      featuredCategory: "carnival",
      featuredCategoryLabel: {
        en: "🎭 Carnival Cards",
        es: "🎭 Tarjetas de Carnaval",
        fr: "🎭 Cartes de Carnaval",
        pt: "🎭 Cartões de Carnaval",
      },
      heroExtra: {
        pt: "🎉 Carnaval tá chegando! Envie cartões animados para todo seu bloco — com música e foto.",
        en: "🎉 Carnival is coming! Send animated cards to your whole bloco — with music and photo.",
        es: "🎉 ¡Llega el Carnaval! Envía tarjetas animadas a todo tu bloco.",
        fr: "🎉 Le Carnaval arrive ! Envoyez des cartes animées à tout votre bloco.",
      },
      suggestedEnvelopeStyle: "samba-gold",
    },
    US: {
      featuredCategory: "4th-of-july",
      featuredCategoryLabel: {
        en: "🇺🇸 4th of July Cards",
        es: "🇺🇸 Tarjetas 4 de Julio",
        fr: "🇺🇸 Cartes 4 Juillet",
        pt: "🇺🇸 Cartões 4 de Julho",
      },
      heroExtra: {
        en: "🎆 July 4th weekend — surprise friends with a fireworks e-card they'll never forget.",
      },
      suggestedEnvelopeStyle: "stars-stripes",
    },
    CA: {
      featuredCategory: "canada-day",
      featuredCategoryLabel: {
        en: "🍁 Canada Day Cards",
        es: "🍁 Tarjetas Día de Canadá",
        fr: "🍁 Cartes Fête du Canada",
        pt: "🍁 Cartões Dia do Canadá",
      },
      heroExtra: {
        en: "🍁 Happy Canada Day! Personalise a maple leaf card and send it coast to coast.",
        fr: "🍁 Bonne Fête du Canada ! Personnalisez une carte feuille d'érable.",
      },
      suggestedEnvelopeStyle: "maple-red",
    },
    FR: {
      featuredCategory: "french-heritage",
      featuredCategoryLabel: {
        en: "🥖 French Heritage Cards",
        es: "🥖 Tarjetas Patrimonio Francés",
        fr: "🥖 Cartes Patrimoine Français",
        pt: "🥖 Cartões Herança Francesa",
      },
      heroExtra: {
        fr: "💐 Fête des mères approche — envoyez une carte personnalisée avec votre propre message enregistré.",
        en: "💐 Mother's Day is coming — send a personalised card with your own recorded message.",
      },
      suggestedEnvelopeStyle: "fleur-de-lis",
    },
    ES: {
      featuredCategory: "spanish-heritage",
      featuredCategoryLabel: {
        en: "💃 Spanish Heritage Cards",
        es: "💃 Tarjetas Patrimonio Español",
        fr: "💃 Cartes Patrimoine Espagnol",
        pt: "💃 Cartões Herança Espanhola",
      },
      heroExtra: {
        es: "⚽ ¡Real Madrid vs Barça! Envía una tarjeta animada al mejor aficionado — con música del himno.",
      },
      suggestedEnvelopeStyle: "flamenco-red",
    },
    GB: {
      featuredCategory: "birthday",
      featuredCategoryLabel: {
        en: "🎂 Premium Birthday Cards",
        es: "🎂 Tarjetas de Cumpleaños Premium",
        fr: "🎂 Cartes d'Anniversaire Premium",
        pt: "🎂 Cartões de Aniversário Premium",
      },
      heroExtra: {
        en: "🎩 Send a British birthday card — a touch of class for your favourite person.",
      },
      suggestedEnvelopeStyle: "union-jack",
    },
    DE: {
      suggestedEnvelopeStyle: "classic-bavarian",
    },
    IT: {
      suggestedEnvelopeStyle: "italian-renaissance",
    },
    IE: {
      featuredCategory: "st-patricks-day",
      featuredCategoryLabel: {
        en: "☘️ St. Patrick's Day Cards",
        es: "☘️ Tarjetas Día de San Patricio",
        fr: "☘️ Cartes Saint-Patrick",
        pt: "☘️ Cartões Dia de São Patrício",
      },
      heroExtra: {
        en: "☘️ Lá fhéile Pádraig sona dhuit! Send a shamrock card to your Irish mates.",
      },
      suggestedEnvelopeStyle: "shamrock-green",
    },
  };

  const countryCfg = C[cc] || {};
  const base = G[lg] || G.en;
  const featuredLabel = countryCfg.featuredCategoryLabel
    ? (countryCfg.featuredCategoryLabel[lg] || countryCfg.featuredCategoryLabel.en || null)
    : null;
  const heroExtra = countryCfg.heroExtra
    ? (countryCfg.heroExtra[lg] || countryCfg.heroExtra.en || null)
    : null;

  return {
    language: lg,
    baseCopy: { ...base },
    featuredCategoryKey: countryCfg.featuredCategory || null,
    featuredCategoryLabel: featuredLabel,
    heroExtraLine: heroExtra,
    suggestedEnvelopeStyle: countryCfg.suggestedEnvelopeStyle || "classic-white",
  };
}

// Doc §175 — Inject geo context (country/currency/timezone/compliance region +
// full rates table) as an inline window.SAF_GEO global so pricing + localized
// marketing can render without an extra API round-trip.
// Idempotent: guarded by the `data-saf-geo` attribute.
function _injectGeoContextIntoHtml(htmlText, request) {
  if (!htmlText) return htmlText;
  if (/data-saf-geo\s*=\s*["']1["']/i.test(htmlText)) return htmlText;

  const cc = (request?.cf?.country || request?.headers?.get?.("CF-IPCountry") || "").toUpperCase();
  const tz = request?.cf?.timezone || request?.headers?.get?.("CF-Connecting-Timezone") || "UTC";
  const displayCurrencyCode = _currencyFromCountry(cc);
  const currencyMeta = _currencyMeta(displayCurrencyCode);
  const complianceRegion = _complianceRegionFromCountry(cc);
  const effLangFromReq = request ? _effectiveLangFromRequest(request, new URL(request?.url || SITE_URL_PROD + "/")) : "en";
  const marketing = _geoMarketingContext(cc, effLangFromReq);

  const payload = {
    country: cc || "XX",
    lang: effLangFromReq || "en",
    visitorTimezone: tz,
    complianceRegion,
    currency: currencyMeta.code,
    currencyMeta: { ...currencyMeta },
    // Public rates table so front-end can switch between currencies client-side.
    // Rate is "1 USD = X units of this currency" — convert USD→local: amount * rate; local→USD: amount / rate
    ratesTable: Object.fromEntries(
      Object.keys(GEO_CURRENCY_RATES).map(code => [code, { ...GEO_CURRENCY_RATES[code] }])
    ),
    // Doc §192: 7 core target countries (marketing / CTA banner uses)
    coreTargetCountries: ["US","GB","CA","FR","ES","MX","BR"],
    // Doc §178: Country-specific marketing copy + envelope style preference.
    // Pure data — front-end decides rendering.
    marketing,
    generatedAtMs: Date.now(),
    source: "worker-edge-geo",
  };

  const block =
    `  <script data-saf-geo="1">window.SAF_GEO = ${JSON.stringify(payload)};</script>\n`;

  const idx = htmlText.lastIndexOf("</head>");
  if (idx >= 0) {
    return htmlText.slice(0, idx) + block + "</head>" + htmlText.slice(idx + "</head>".length);
  }
  // Degenerate fallback: prepend before the first <script src="/app.js
  const j = htmlText.search(/<script[^>]+src\s*=\s*["'][^"']*app\.js/i) || htmlText.search(/<body/i) || -1;
  if (j >= 0) return htmlText.slice(0, j) + block + htmlText.slice(j);
  return block + htmlText;
}

// ============================================================================
// B-1 helper: Resolve effective display language from the HTTP request.
// Priority (matches front-end _detectCurrentLang for consistency):
//   1) Manual override cookie (saf_lang_override)
//   2) URL path prefix: /en/ /es/ /fr/ /pt/
//   3) Geo IP (CF-IPCountry / request.cf.country) → GEO_COUNTRY_TO_LANG
//   4) Default: en
// ============================================================================
function _effectiveLangFromRequest(request, urlObj) {
  const cookieHeader = request?.headers?.get?.("Cookie") || "";
  const fromCookie = getCookie(cookieHeader, GEO_LANG_OVERRIDE_COOKIE);
  if (fromCookie && GEO_4_LANGS.includes(String(fromCookie).toLowerCase())) {
    return String(fromCookie).toLowerCase();
  }
  const path = urlObj?.pathname || request?.url ? new URL(request?.url || SITE_URL_PROD + "/").pathname : "/";
  const m = String(path).match(/^\/(en|es|fr|pt)(?:\/|$)/i);
  if (m) return m[1].toLowerCase();
  const cc =
    (request?.cf?.country) ||
    request?.headers?.get?.("CF-IPCountry") ||
    "";
  return _langFromCountry(cc);
}

// ============================================================================
// B-1: Inject language context into the SPA shell / static HTML shell.
// - Rewrites <html lang="xx"> to the effective language so <select> matches.
// - Injects window.__SAF_EFFECTIVE_LANG__ = "xx" inline script so front-end
//   t() translation picks the correct dictionary immediately without waiting
//   for app.js (no cookie-reading race on first paint).
// Both are idempotent (guarded — skip if signature already present).
// ============================================================================
function _injectLangContextIntoHtml(htmlText, lang) {
  if (!htmlText) return htmlText;
  const lg = GEO_4_LANGS.includes(String(lang || "").toLowerCase()) ? String(lang).toLowerCase() : GEO_DEFAULT_LANG;
  let out = htmlText;
  // 1) <html lang="xx"> — rewrite first existing attribute, else add one to <html> tag
  if (/<html[^>]*\slang\s*=\s*["'][^"']+["']/i.test(out)) {
    out = out.replace(/(<html[^>]*\s)lang\s*=\s*["'][^"']+["']/i, `$1lang="${lg}"`);
  } else {
    out = out.replace(/<html/i, `<html lang="${lg}"`);
  }
  // 2) Inline script — idempotent: guard by data-saf-lang attr
  if (!/data-saf-lang["']?\s*=/i.test(out)) {
    const block = `  <script data-saf-lang="${lg}">window.__SAF_EFFECTIVE_LANG__ = ${JSON.stringify(lg)};</script>\n`;
    const idx = out.lastIndexOf("</head>");
    if (idx >= 0) {
      out = out.slice(0, idx) + block + "</head>" + out.slice(idx + "</head>".length);
    } else {
      // Degenerate HTML — no </head>; prepend block before first <script src="/app.js" or start of <body
      const j = out.search(/<script[^>]+src\s*=\s*["'][^"']*app\.js/i) || out.search(/<body/i) || -1;
      if (j >= 0) out = out.slice(0, j) + block + out.slice(j);
    }
  }
  return out;
}

// ================================================================
// Geo helpers — currency (§175), compliance (§221), region mapping.
// Zero side effects: pure functions of the country code.
// ================================================================
const _USD_COUNTRIES = new Set(["US","CA","AU","NZ","SG","HK","SA","AE","KW","QA","BH","OM","JO","IL","EG","NG","KE","ZA","IN","PK","BD","PH","MY","TH","VN","ID","JP","KR","TW","CN","NO","SE","DK","FI","IS","CH","CZ","PL","RO","HU","BG","HR","SI","SK","LT","LV","EE","RS","UA","TR","GR","CY","MT","LU"]);
const _EUR_COUNTRIES = new Set(["FR","ES","DE","IT","PT","NL","BE","AT","IE","FI","LU","SI","SK","LV","EE","LT","HR","GR","CY","MT"]);
const _MXN_ONLY    = new Set(["MX"]);
const _BRL_ONLY    = new Set(["BR"]);
const _GBP_ONLY    = new Set(["GB"]);

// Doc §175 — 4 core currencies. Rates are USD as base (1 USD = X units of local).
// Hard-coded snapshot, safe because Creem charges USD regardless; we only do *display* conversion.
// Refresh quarterly: 1 USD = 17.1 MXN ≈ 5.85 BRL ≈ 0.92 EUR ≈ 0.79 GBP ≈ 1.36 CAD ≈ 1.54 AUD
const GEO_CURRENCY_RATES = Object.freeze({
  USD: { code: "USD", symbol: "$",  rate: 1.00,     name: "US Dollar",       fmt: "en-US",     decimals: 2 },
  EUR: { code: "EUR", symbol: "€",  rate: 0.92,    name: "Euro",            fmt: "de-DE",     decimals: 2 },
  MXN: { code: "MXN", symbol: "$",  rate: 17.10,   name: "Mexican Peso",    fmt: "es-MX",     decimals: 0 },
  BRL: { code: "BRL", symbol: "R$", rate: 5.85,    name: "Brazilian Real",  fmt: "pt-BR",     decimals: 2 },
  GBP: { code: "GBP", symbol: "£",  rate: 0.79,    name: "British Pound",   fmt: "en-GB",     decimals: 2 },
  CAD: { code: "CAD", symbol: "C$", rate: 1.36,    name: "Canadian Dollar", fmt: "en-CA",     decimals: 2 },
  AUD: { code: "AUD", symbol: "A$", rate: 1.54,    name: "Australian Dlr",  fmt: "en-AU",     decimals: 2 },
});
const GEO_CORE_4_CURRENCIES = Object.freeze(["USD","EUR","MXN","BRL"]);

function _currencyMeta(code) {
  const c = String(code || "USD").toUpperCase();
  return GEO_CURRENCY_RATES[c] || GEO_CURRENCY_RATES.USD;
}

function _currencyFromCountry(countryCode) {
  const cc = (countryCode || "").toUpperCase();
  if (!cc) return "USD";
  if (_MXN_ONLY.has(cc)) return "MXN";
  if (_BRL_ONLY.has(cc)) return "BRL";
  if (_GBP_ONLY.has(cc)) return "GBP";
  // CA and AU are USD payers but display their native currency for pricing *estimates*
  if (cc === "CA") return "CAD";
  if (cc === "AU") return "AUD";
  if (_EUR_COUNTRIES.has(cc)) return "EUR";
  return "USD";
}

const _GDPR_COUNTRIES = new Set(["FR","ES","DE","IT","NL","BE","AT","PT","IE","FI","LU","SI","SK","LV","EE","LT","HR","GR","CY","MT","CZ","PL","RO","HU","BG","RS","DK","SE","NO","IS","LI","CH"]);
const _CCPA_COUNTRIES = new Set(["US"]);
const _LGPD_COUNTRIES = new Set(["BR"]);
const _PIPEDA_COUNTRIES = new Set(["CA"]);

function _complianceRegionFromCountry(countryCode) {
  const cc = (countryCode || "").toUpperCase();
  if (_LGPD_COUNTRIES.has(cc)) return "LGPD-BR";
  if (_PIPEDA_COUNTRIES.has(cc)) return "PIPEDA-CA";
  if (_CCPA_COUNTRIES.has(cc)) return "CCPA-US";
  if (_GDPR_COUNTRIES.has(cc)) return "GDPR-EU";
  return "GLOBAL";
}

function _geoHeadersFor(requestOrCountry) {
  const cc = typeof requestOrCountry === "string"
    ? (requestOrCountry || "").toUpperCase()
    : (requestOrCountry?.cf?.country || requestOrCountry?.headers?.get?.("CF-IPCountry") || "").toUpperCase();
  const tz = typeof requestOrCountry !== "string"
    ? (requestOrCountry?.cf?.timezone || requestOrCountry?.headers?.get?.("CF-Connecting-Timezone") || "UTC")
    : "UTC";
  return {
    "X-Geo-Country": cc || "XX",
    "X-Local-Currency": _currencyFromCountry(cc),
    "X-Compliance-Region": _complianceRegionFromCountry(cc),
    "X-Visitor-Timezone": tz,
    "Vary": "Accept-Language, CF-IPCountry",
  };
}

function _setGeoHeaders(response, requestOrCountry) {
  if (!response) return response;
  const h = _geoHeadersFor(requestOrCountry);
  for (const k of Object.keys(h)) {
    try { response.headers.set(k, h[k]); } catch (_) {}
  }
  return response;
}

async function _spaResponse(statusCode, originalUrlObj, request) {
  const url = originalUrlObj || new URL(SITE_URL_PROD + "/");
  const pathForHref = url.pathname || "/";
  let text = null;
  let ctype = "text/html;charset=utf-8";
  const PAGES_ORIGIN = "https://main.sendafun.pages.dev";
  try {
    const indexReq = new Request(PAGES_ORIGIN + "/index.html", {
      method: "GET",
      headers: { "Accept": "text/html", "Cache-Control": "no-store" }
    });
    const r = await fetch(indexReq);
    if (r && r.ok) {
      text = await r.text();
      const rc = r.headers.get("Content-Type");
      if (rc) ctype = rc;
    }
  } catch (_) {}
  if (!text) {
    text = `<!doctype html><html lang="en"><head><title>SendAFun</title><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head><body><div id="app"></div><script src="/app.js" defer></script></body></html>`;
  }
  text = text
    .replace(/(src|href)=("|')(?!\/|https?:\/\/|data:)(app\.js|styles\.css|products\.json|robots\.txt|cards-meta\.json)\2/g, '$1=$2/$3$2')
    .replace(/(src|href)=("|')(?!\/|https?:\/\/|data:)((?:[^"']+)\.(?:css|js|json|webp|png|jpg|jpeg|svg|woff2))\2/g, '$1=$2/$3$2');
  text = _injectHreflangIntoHtml(text, pathForHref);
  const effLang = _effectiveLangFromRequest(request, url);
  text = _injectLangContextIntoHtml(text, effLang);
  text = _injectGeoContextIntoHtml(text, request);
  const headers = {
    "Content-Type": ctype,
    "Cache-Control": "public, max-age=60, s-maxage=180, stale-while-revalidate=300",
    "Vary": "Accept-Language, CF-IPCountry"
  };
  // Doc §175: Geo response headers on HTML shells so front-end can
  // read currency / compliance / timezone without extra round-trip.
  if (request) Object.assign(headers, _geoHeadersFor(request));
  return new Response(text, {
    status: statusCode || 200,
    headers
  });
}

async function _serveStaticHtmlWithHreflang(originalUrlObj, staticFile, pathForHref, request) {
  const url = originalUrlObj || new URL(SITE_URL_PROD + staticFile);
  let text = null;
  let ctype = "text/html;charset=utf-8";
  const PAGES_ORIGIN = "https://main.sendafun.pages.dev";
  try {
    const req = new Request(PAGES_ORIGIN + staticFile, {
      method: "GET",
      headers: { "Accept": "text/html", "Cache-Control": "no-store" }
    });
    const r = await fetch(req);
    if (r && r.ok) {
      text = await r.text();
      const rc = r.headers.get("Content-Type");
      if (rc) ctype = rc;
    }
  } catch (_) {}
  if (!text) {
    // Fallback: serve SPA shell instead of 404
    return _spaResponse(200, url, request);
  }
  text = _injectHreflangIntoHtml(text, pathForHref);
  const effLang = _effectiveLangFromRequest(request, url);
  text = _injectLangContextIntoHtml(text, effLang);
  text = _injectGeoContextIntoHtml(text, request);
  const headers = {
    "Content-Type": ctype,
    "Cache-Control": "public, max-age=300, s-maxage=600, stale-while-revalidate=1800",
    "Vary": "Accept-Language, CF-IPCountry"
  };
  if (request) Object.assign(headers, _geoHeadersFor(request));
  return new Response(text, {
    status: 200,
    headers
  });
}

function _handleSetLangApi(request) {
  const url = new URL(request.url);
  let lang = (url.searchParams.get("lang") || GEO_DEFAULT_LANG).toLowerCase().slice(0, 2);
  if (!GEO_4_LANGS.includes(lang)) lang = GEO_DEFAULT_LANG;
  const referrer = request.headers.get("Referer") || SITE_URL_PROD + "/";
  const safe = /^https?:\/\//i.test(referrer) ? referrer : SITE_URL_PROD + "/";
  return new Response(null, {
    status: 302,
    headers: {
      Location: safe,
      "Set-Cookie": `${GEO_LANG_OVERRIDE_COOKIE}=${lang}; Path=/; SameSite=Lax; Secure; HttpOnly; Max-Age=2592000`
    }
  });
}

function _maybeGeoRedirect(request, url) {
  // Returns Response (redirect) or null.
  // Doc §169: Never redirect crawlers; never re-redirect if manual override cookie present;
  // never redirect if path already carries correct /xx/ language prefix.
  if (request.method !== "GET") return null;
  if (_isCrawlerRequest(request)) return null;
  const cookieHeader = request.headers.get("Cookie") || "";
  if (getCookie(cookieHeader, GEO_LANG_OVERRIDE_COOKIE)) return null;
  const { cleanPath, lang } = _pathStrippedOfLangPrefix(url.pathname);
  // Don't interfere with API/sitemap/robots or any static asset
  if (cleanPath.startsWith("/api/") || cleanPath.startsWith("/sitemap") || cleanPath === "/robots.txt") return null;
  if (/\.(png|jpe?g|webp|svg|css|js|woff2?|ico|pdf|json|txt|map|gif|mp4|webm|mp3|wav)$/i.test(cleanPath)) return null;
  // Detect country
  const cfCountry = (request.cf && request.cf.country) || request.headers.get("CF-IPCountry") || "";
  const targetLang = _langFromCountry(cfCountry);
  if (lang && lang === targetLang) return null; // user already on correct prefix → no-op
  // Build redirect target: /{targetLang}{cleanPath} + preserve query + hash not available at server
  const target = `/${targetLang}${cleanPath === "/" ? "" : cleanPath}${url.search || ""}`;
  return new Response(null, {
    status: 302,
    headers: {
      Location: SITE_URL_PROD.replace(/\/+$/, "") + target,
      Vary: "CF-IPCountry, User-Agent"
    }
  });
}

const _rl = new Map();
function _rlCheck(ip, key, limit = 30, winMs = 60000) {
  const now = Date.now();
  const w = Math.floor(now / winMs);
  const k = `${ip}:${key}:${w}`;
  const c = (_rl.get(k) || 0) + 1;
  if (c > limit) return false;
  _rl.set(k, c);
  setTimeout(() => _rl.delete(k), winMs + 1000);
  return true;
}

async function getPermission(kv, email) {
  if (!email) return null;
  const raw = await kv.get('perm:' + email.toLowerCase(), { type: 'json' });
  if (!raw || !raw.active) return null;
  if (raw.expiresAt && Date.now() > raw.expiresAt) return null;
  const daysLeft = Math.max(0, Math.ceil((raw.expiresAt - Date.now()) / 86400000));
  return { ...raw, daysLeft };
}

async function grantSubscription(kv, email, planId) {
  const t = PLAN_TYPES[planId] || 'month';
  const days = DAYS_BY_PLAN[t] || 30;
  const expiresAt = Date.now() + days * 86400000;
  const userToken = randToken(16);
  const data = {
    active: true,
    plan: t,
    planId,
    expiresAt,
    updatedAt: Date.now(),
    userToken,
    email: email.toLowerCase()
  };
  const ttl = Math.min(days * 86400 + 86400, 31536000);
  await kv.put('perm:' + email.toLowerCase(), JSON.stringify(data), { expirationTtl: ttl });
  await kv.put('usertoken:' + userToken, email.toLowerCase(), { expirationTtl: ttl });
  return { ...data, daysLeft: days };
}

function planNameOf(t) {
  switch (t) {
    case 'month': return 'Monthly Unlimited';
    case 'year': return 'Annual Unlimited';
    case 'group': return 'Group Card Pass 30d';
    case 'one': return 'Pay Per Send (10 cards)';
    default: return 'Free';
  }
}

function buildEmailHtml(card) {
  const bg = esc(card.backgroundColor || '#fdf6e3');
  const ac = esc(card.accentColor || '#e17055');
  const img = card.imageUrl ? `<img src="${esc(card.imageUrl)}" alt="Personalized e-card from sendafun.com" style="width:100%;max-width:480px;border-radius:16px;display:block;margin:0 auto 24px">` : '';
  const from = esc(card.fromName || 'a friend');
  const fromEmail = esc(card.fromEmail || '');
  const to = esc(card.toName || 'You');
  const msg = esc(card.message || '');
  const openUrl = esc(card.cardSlug ? `${SITE_URL_PROD}/card/${card.cardSlug}` : SITE_URL_PROD);
  const replyOccasion = esc(card.occasion || 'just because');
  const replyUrl = esc(`${SITE_URL_PROD}/?occasion=${replyOccasion}&ref=email_footer&intent=1#intent`);
  const unsubscribeMailto = 'mailto:unsubscribe@sendafun.com?subject=Unsubscribe%20from%20sendafun.com';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>A card from ${from} · SendAFun</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f5f7;padding:32px 16px">
<tr><td align="center">
<table width="560" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
<tr><td style="padding:40px 32px;text-align:center">
<div style="font-size:14px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:8px">To ${to}</div>
<div style="font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:24px">A card from ${from} 🎴</div>
${img}
<div style="background:${bg};border-radius:16px;padding:28px 24px;margin-bottom:28px">
<p style="margin:0;font-size:17px;line-height:1.7;color:#2d3436;white-space:pre-wrap">${msg}</p>
<p style="margin:20px 0 0;font-size:15px;font-style:italic;color:#636e72;text-align:right">&mdash; ${from}${fromEmail ? ' <span style="color:#b2bec3">(' + fromEmail + ')</span>' : ''}</p>
</div>
<a href="${openUrl}" style="display:inline-block;background:${ac};color:#fff;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none">Open Your Card 💌</a>
<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:14px;padding:18px 20px;margin-top:36px;text-align:left">
<div style="font-size:13px;font-weight:600;color:#065f46;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">💝 Want to reply with a card?</div>
<p style="margin:0;font-size:14px;color:#064e3b;line-height:1.55">It takes 30 seconds. <a href="${replyUrl}" style="color:#047857;font-weight:600;text-decoration:underline">Reply to ${from} with your own card &rarr;</a> No signup required, free preview.</p>
</div>
<div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;font-size:12px;color:#aaa;line-height:1.8;text-align:left">
<p style="margin:0 0 8px">Made with ❤️ by <a href="${esc(SITE_URL_PROD)}" style="color:${ac};text-decoration:none;font-weight:600">SendAFun</a> · Beautiful group e-cards in 30 seconds.</p>
<p style="margin:0 0 8px">Support: <a href="mailto:support@sendafun.com?subject=Help%20with%20sendafun.com" style="color:#6b7280;text-decoration:underline">support@sendafun.com</a> · We reply within 1 business day (US &amp; EU hours)</p>
<p style="margin:0 0 8px"><a href="${esc(SITE_URL_PROD + '/pricing')}" style="color:#6b7280">Pricing</a> · <a href="${esc(SITE_URL_PROD + '/about')}" style="color:#6b7280">About</a> · <a href="${esc(SITE_URL_PROD + '/contact')}" style="color:#6b7280">Contact</a> · <a href="${esc(SITE_URL_PROD + '/privacy')}" style="color:#6b7280">Privacy (GDPR)</a> · <a href="${esc(SITE_URL_PROD + '/terms')}" style="color:#6b7280">Terms</a> · <a href="${esc(SITE_URL_PROD + '/cookies')}" style="color:#6b7280">Cookies</a></p>
<p style="margin:0 0 8px">© 2026 SendAFun · <a href="${unsubscribeMailto}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a> or manage preferences from your account.</p>
</div>
</td></tr></table>
</td></tr></table></body></html>`;
}

function buildGroupEmailHtml(group) {
  const openUrl = esc(`${SITE_URL_PROD}/group/${group.token}`);
  const sigs = (group.signatures || []).map(s => `
<div style="display:inline-block;width:140px;margin:12px;padding:16px;background:#fff;border-radius:16px;box-shadow:0 2px 8px rgba(0,0,0,.06);vertical-align:top;text-align:center">
<div style="font-size:36px;margin-bottom:8px" aria-hidden="true">${esc(s.signerEmoji || '🎂')}</div>
<div style="font-weight:600;color:#1a1a2e;margin-bottom:6px">${esc(s.signerName || 'Anonymous')}</div>
<div style="font-size:13px;color:#636e72;line-height:1.5">${esc(s.signerText || '')}</div>
</div>`).join('');
  const replyUrl = esc(`${SITE_URL_PROD}/?occasion=${group.cardSlug ? group.cardSlug.split('-')[0] : 'just because'}&ref=group_email&intent=1#intent`);
  const unsubscribeMailto = 'mailto:unsubscribe@sendafun.com?subject=Unsubscribe%20from%20sendafun.com';
  return `<!DOCTYPE html><html lang="en"><head><meta charset="utf-8"><title>Your group card · SendAFun</title></head><body style="margin:0;padding:0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;background:#f5f5f7">
<table width="100%" cellpadding="0" cellspacing="0" role="presentation" style="background:#f5f5f7;padding:32px 16px">
<tr><td align="center">
<table width="640" cellpadding="0" cellspacing="0" role="presentation" style="background:#fff;border-radius:20px;overflow:hidden;box-shadow:0 4px 24px rgba(0,0,0,.06)">
<tr><td style="padding:40px 32px;text-align:center">
<div style="font-size:48px;margin-bottom:12px" aria-hidden="true">🎉</div>
<div style="font-size:28px;font-weight:700;color:#1a1a2e;margin-bottom:8px">You got a GROUP CARD!</div>
<div style="font-size:16px;color:#636e72;margin-bottom:28px">From <strong>${esc(group.ownerName || 'a friend')}</strong> and ${group.signatures ? group.signatures.length : 0} friends ❤️ · Collect more signatures before ${group.expiresAt ? new Date(group.expiresAt).toLocaleDateString('en-US',{month:'long',day:'numeric',year:'numeric'}) : '30 days'}</div>
<a href="${openUrl}" style="display:inline-block;background:#e17055;color:#fff;padding:14px 36px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;margin-bottom:32px">Open Group Card &amp; See All Signatures 📜</a>
<div style="background:#fafafa;border-radius:16px;padding:24px;margin-bottom:24px">
<div style="font-size:14px;color:#999;letter-spacing:2px;text-transform:uppercase;margin-bottom:16px">Signature Wall</div>
<div style="text-align:center">${sigs || '<p style="color:#999">No signatures yet — be the first to sign!</p>'}</div>
</div>
<div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:14px;padding:18px 20px;text-align:left">
<div style="font-size:13px;font-weight:600;color:#1e3a8a;letter-spacing:.5px;text-transform:uppercase;margin-bottom:6px">🎁 Make ${esc(group.ownerName || 'them')} smile back</div>
<p style="margin:0;font-size:14px;color:#1e3a8a;line-height:1.55">Send a card to them for the next holiday. <a href="${replyUrl}" style="color:#1d4ed8;font-weight:600;text-decoration:underline">Start your own group card in 30 seconds &rarr;</a></p>
</div>
<div style="margin-top:32px;padding-top:24px;border-top:1px solid #eee;font-size:12px;color:#aaa;line-height:1.8;text-align:left">
<p style="margin:0 0 8px">Made with ❤️ by <a href="${esc(SITE_URL_PROD)}" style="color:#e17055;text-decoration:none;font-weight:600">SendAFun</a> · Beautiful group e-cards in 30 seconds.</p>
<p style="margin:0 0 8px">Support: <a href="mailto:support@sendafun.com?subject=Help%20with%20sendafun.com" style="color:#6b7280;text-decoration:underline">support@sendafun.com</a> · We reply within 1 business day.</p>
<p style="margin:0 0 8px"><a href="${esc(SITE_URL_PROD + '/pricing')}" style="color:#6b7280">Pricing</a> · <a href="${esc(SITE_URL_PROD + '/privacy')}" style="color:#6b7280">Privacy (GDPR)</a> · <a href="${esc(SITE_URL_PROD + '/terms')}" style="color:#6b7280">Terms</a></p>
<p style="margin:0 0 8px">© 2026 SendAFun · <a href="${unsubscribeMailto}" style="color:#9ca3af;text-decoration:underline">Unsubscribe</a></p>
</div>
</td></tr></table></td></tr></table></body></html>`;
}

// ============================================================
// SPA Frontend Routes Fallback：302 临时重定向到 Hash 路由
// 前端 JS 会自动把 #/xxx 转成 History 路由 /xxx（用户最终看到的 URL 不带 #）
function _isSPARoute(path) {
  const strip = (p) => {
    const m = (p || "").match(/^\/(en|es|fr|pt)(\/.*)?$/i);
    if (m) return m[2] || "/";
    return (p || "/");
  };
  const p = strip(path.replace(/\/+$/, "") || "/");
  if (["/", "/create", "/discover", "/trending", "/latest", "/holidays", "/message-generator"].includes(p)) return true;
  if (/^\/card(\/.*)?$/i.test(p)) return true;
  if (/^\/group(\/.*)?$/i.test(p)) return true;
  if (/^\/redeem(\/.*)?$/i.test(p)) return true;
  return false;
}
function _spaRedirectToHash(path, siteUrl) {
  let clean = path.replace(/^\/+/, "").replace(/\/+$/, "");
  const hash = clean ? "#/" + clean : "#/";
  return Response.redirect(siteUrl.replace(/\/+$/, "") + "/" + hash, 302);
}
// ============================================================
export default {
  async fetch(request, env, ctx) {
    try {
      return await handleRequest(request, env);
    } catch (e) {
      if (e instanceof Error) return json({ error: e.message, stack: e.stack }, 500);
      return json({ error: String(e) }, 500);
    }
  }
};

async function handleRequest(request, env) {
  const kv = env.CARD_PERMISSIONS;
  const bucket = env.PREVIEW_BUCKET;
  const originalsBucket = env.ORIGINALS_BUCKET;
  const creemKey = getEnvVar(env, 'CREEM_API_KEY', 'creem_test_7deQTeY7iE1fapgeaiLQ1u');
  const resendKey = getEnvVar(env, 'RESEND_API_KEY', '');
  const url = new URL(request.url);
  const path = url.pathname;
  const method = request.method;
  const ip = request.headers.get('CF-Connecting-IP') || request.headers.get('X-Forwarded-For') || 'unknown';

  if (method === 'OPTIONS') return CORS(new Response(null, { status: 204 }));

  // ——— STATIC ASSET PASSTHROUGH (before any API / Geo routing) ———
  // Doc §235: Worker catch-all MUST NOT intercept asset requests. These files
  // live on main.sendafun.pages.dev; we fetch them transparently. Without this,
  // app.js / styles.css / images etc. return 404 and the UI is completely broken.
  if (method === "GET" && !path.startsWith("/api/")) {
    const STATIC_EXT = /\.(js|css|mjs|map|png|jpg|jpeg|gif|webp|svg|ico|woff2?|ttf|eot|otf|mp4|webm|mp3|wav|json)$/i;
    if (STATIC_EXT.test(path)) {
      const PAGES_ORIGIN = "https://main.sendafun.pages.dev";
      try {
        const fwd = new Request(PAGES_ORIGIN + path, {
          method: "GET",
          headers: { "Accept": request.headers.get("Accept") || "*/*", "Cache-Control": "no-store" }
        });
        const r = await fetch(fwd);
        if (r && r.ok) {
          const hdrs = new Headers(r.headers);
          if (!hdrs.has("Cache-Control")) hdrs.set("Cache-Control", "public, max-age=3600, s-maxage=7200, stale-while-revalidate=86400");
          hdrs.set("Vary", "Accept-Encoding");
          return new Response(r.body, { status: r.status, headers: hdrs });
        }
      } catch (_) {}
      // Fall through → return generic 404 for assets we can't fetch.
      return new Response("Not found", { status: 404 });
    }
  }

  // ============== B-1: Geo language auto-redirect + manual switch API ==============
  // Runs BEFORE any API / sitemap route matching for page navigations only.
  if (method === 'GET' && path === '/api/lang/set') return _handleSetLangApi(request);
  if (method === 'GET' && path === '/api/geo/context') {
    const edgeCountry = (request.cf?.country || request.headers.get('CF-IPCountry') || '').toUpperCase();
    /* Dev-only country override: ?force_country=FR (2 uppercase letters only).
     * Allows automated verification of geo logic in CI (real CF-IPCountry headers
     * are set by Cloudflare edge for production visitors and cannot be spoofed).
     */
    const qForce = (url.searchParams.get('force_country') || '').toUpperCase();
    const cc = (/^[A-Z]{2}$/.test(qForce) ? qForce : edgeCountry) || 'XX';
    const tzForce = url.searchParams.get('force_tz') || '';
    const tz = tzForce || request.cf?.timezone || request.headers.get('CF-Connecting-Timezone') || 'UTC';
    const cookieHeader = request.headers.get('Cookie') || '';
    const langOverride = getCookie(cookieHeader, GEO_LANG_OVERRIDE_COOKIE);
    const autoLang = _langFromCountry(cc);
    /* Build fakeRequest object so _geoHeadersFor sees the resolved cc/tz
     * (since real request.cf still has original edge values that don't match
     * the force_country override). */
    const fakeForHeaders = {
      cf: { country: cc, timezone: tz },
      headers: request.headers,
    };
    const out = json({
      ok: true,
      country: cc,
      timezone: tz,
      currency: _currencyFromCountry(cc),
      complianceRegion: _complianceRegionFromCountry(cc),
      language: {
        auto: autoLang,
        override: langOverride || null,
        effective: langOverride || autoLang,
        available: GEO_4_LANGS,
      },
      compliance: SAF_SLOTS.GeoCompliancePopup(cc),
      marketing: SAF_SLOTS.GeoMarketingBanner(cc),
      headers: _geoHeadersFor(fakeForHeaders),
      force_used: (/^[A-Z]{2}$/.test(qForce)) ? qForce : null,
    });
    return out;
  }
  const geoRedirect = _maybeGeoRedirect(request, url);
  if (geoRedirect) return geoRedirect;

  if (method === 'POST' && (path.startsWith('/api/pdf/') || path === '/api/pdf')) {
    let body; try { body = await request.clone().json(); } catch (_) { body = {}; }
    if (!_requireTier('pdf_export', request, body)) return _tierDeniedResponse('pdf_export', request, body);
  }
  if (method === 'POST' && (path.startsWith('/api/gif/') || path === '/api/gif')) {
    let body; try { body = await request.clone().json(); } catch (_) { body = {}; }
    const wantExport = body && (body.export || body.hd || body.download);
    const featureKey = wantExport ? 'gif_export' : 'gif_overlay';
    if (!_requireTier(featureKey, request, body)) return _tierDeniedResponse(featureKey, request, body);
  }
  if (method === 'POST' && (path.startsWith('/api/video/') || path === '/api/video')) {
    let body; try { body = await request.clone().json(); } catch (_) { body = {}; }
    const quality = String((body && body.quality) || body.resolution || '').toLowerCase();
    let featureKey = 'video_export_sd';
    if (quality === '4k' || quality === '2160p' || (body && body.dualAudio)) featureKey = 'video_export_4k';
    else if (quality === 'hd' || quality === '1080p') featureKey = 'video_export_hd';
    if (!_requireTier(featureKey, request, body)) return _tierDeniedResponse(featureKey, request, body);
  }

  if (method === 'GET' && path === '/api/check-member') {
    if (!_rlCheck(ip, 'check-member')) return json({ error: 'Too many requests' }, 429);
    return handleCheckMember(request, kv, url);
  }
  if (method === 'POST' && path === '/api/send-card') return handleSendCard(request, kv, resendKey);
  if (method === 'POST' && path === '/api/create-session') return handleCreateSession(request, creemKey);
  if (method === 'POST' && path === '/api/creem/webhook') return handleCreemWebhook(request, kv, env);
  if (method === 'POST' && path === '/ai/message') return handleAIMessage(request, env);
  // ---- Low-res preview (public visitor bucket: sendafun-preview, webp 1080w watermarked) ----
  // URL patterns:
  //   /api/r2-image/<preview-key>                      → PREVIEW_BUCKET  (default, non-paid views)
  //   /api/r2-image?url=<key>  |  ?k=<key>              → PREVIEW_BUCKET  (default)
  // ---- High-res originals (paid members only: sendafun-originals, PNG 2048px masters) ----
  // URL patterns:
  //   /api/r2-image/originals/<originals-key>           → ORIGINALS_BUCKET  (paid HD asset load)
  //   /api/r2-image?bucket=originals&url=<key> | &b=o   → ORIGINALS_BUCKET  (paid HD via query)
  // ---- Originals bucket keys ALWAYS follow: <cat>/pexels-<pexelsId>.png (schema.sql §L22) ----
  const wantOriginals =
    (method === "GET" && path.startsWith("/api/r2-image/originals/")) ||
    (method === "GET" && (url.searchParams.get("bucket") === "originals" || url.searchParams.get("b") === "o"));
  if (method === "GET" && (path.startsWith("/api/r2-image/") || path === "/api/r2-image")) {
    let rawKey;
    if (path.startsWith("/api/r2-image/originals/")) {
      rawKey = decodeURIComponent(path.slice("/api/r2-image/originals/".length).replace(/^\/+/, ""));
    } else {
      rawKey = url.searchParams.get("url") || url.searchParams.get("k") ||
               decodeURIComponent(path.slice("/api/r2-image/".length).replace(/^\/+/, ""));
    }
    // Normalize: some DB rows store full https://<acct>.r2.dev/<key> URLs instead of raw keys.
    rawKey = String(rawKey || "").replace(/^https?:\/\/[^/]+\.r2\.dev\//i, "").replace(/^\/+/, "");
    if (!rawKey) return json({ error: "R2 key required (path segment or ?url= / ?k=)" }, 400);
    const targetBucket = wantOriginals ? originalsBucket : bucket;
    const bucketTag = wantOriginals ? "originals (PNG HD)" : "preview (webp LR)";
    if (!targetBucket) return json({ error: "R2 bucket not bound for scope: " + bucketTag }, 503);
    return handleR2Image(targetBucket, rawKey, wantOriginals);
  }
  if (method === 'POST' && path === '/api/group/create') {
    const clonedReq = request.clone();
    let body; try { body = await clonedReq.json(); } catch (_) { body = {}; }
    const numSigs = Math.max(2, parseInt((body && body.maxSignatures) || body.expectedSigners || '2', 10) || 2);
    let groupFeature = 'group_collab_2';
    if (numSigs > 10) groupFeature = 'group_collab_50';
    else if (numSigs > 2) groupFeature = 'group_collab_10';
    if (!_requireTier(groupFeature, request, body)) return _tierDeniedResponse(groupFeature, request, body);
    return handleGroupCreate(request, kv);
  }
  const mGroup = path.match(/^\/api\/group\/([^/]+)$/);
  if (mGroup) {
    if (method === 'GET') return handleGroupGet(kv, mGroup[1]);
  }
  const mGroupSign = path.match(/^\/api\/group\/([^/]+)\/sign$/);
  if (mGroupSign && method === 'POST') {
    if (!_rlCheck(ip, 'group-sign')) return json({ error: 'Too many requests' }, 429);
    return handleGroupSign(request, kv, mGroupSign[1]);
  }
  const mGroupSend = path.match(/^\/api\/group\/([^/]+)\/send$/);
  if (mGroupSend && method === 'POST') {
    const clonedReq = request.clone();
    let body; try { body = await clonedReq.json(); } catch (_) { body = {}; }
    if (!_requireTier('group_collab_2', request, body)) return _tierDeniedResponse('group_collab_2', request, body);
    return handleGroupSend(request, kv, resendKey, mGroupSend[1]);
  }
  const mGroupStatus = path.match(/^\/api\/group\/([^/]+)\/status$/);
  if (mGroupStatus && method === 'GET') return handleGroupStatus(request, kv, mGroupStatus[1]);
  if (method === 'POST' && path === '/api/contact') {
    if (!_rlCheck(ip, 'contact-form', 5, 3600000)) return json({ error: 'Too many messages — try again later' }, 429);
    return handleContact(request, resendKey);
  }
  const mGift = path.match(/^\/api\/gift\/([^/]+)$/);
  if (mGift && method === 'GET') return handleGiftGet(kv, mGift[1]);
  if (method === 'POST' && path === '/api/gift/redeem') return handleGiftRedeem(request, kv);
  if (method === 'GET' && path === '/api/health') return handleHealth(env, creemKey);

  if (method === 'GET' && path === '/sitemap.xml') return handleSitemapIndex();
  if (method === 'GET' && path === '/sitemap-pages.xml') return handleSitemapPages();
  if (method === 'GET' && path === '/sitemap-cards.xml') return handleSitemapCards(env);
  // B-2 Doc §218: 4 independent language sitemaps. Each <loc> prefixes /en, /es, /fr, /pt.
  if (method === 'GET' && path === '/sitemap-en.xml') return handleSitemapByLang(env, "en");
  if (method === 'GET' && path === '/sitemap-es.xml') return handleSitemapByLang(env, "es");
  if (method === 'GET' && path === '/sitemap-fr.xml') return handleSitemapByLang(env, "fr");
  if (method === 'GET' && path === '/sitemap-pt.xml') return handleSitemapByLang(env, "pt");
  if (method === 'GET' && path === '/robots.txt') return handleRobotsTxt();

  const bulkToken = getEnvVar(env, 'CARDS_BULK_API_TOKEN', '');
  const mSearch = path === '/api/cards/search' || path === '/api/search/cards';
  const mCardSlug = path.match(/^\/api\/cards\/([^/?#]+)$/);
  const mBulk = path === '/api/cards/_bulk';
  const mList = path === '/api/cards';
  const mDbMigrate = path === '/api/db/_migrate';
  const mDbRebuildFts = path === '/api/db/_rebuild_fts';

  // Auth helper shared by all admin APIs
  const _adminAuth = () => {
    if (!bulkToken) return { ok: false, resp: json({ error: 'Admin APIs not configured (CARDS_BULK_API_TOKEN missing)' }, 501) };
    const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (auth !== bulkToken) return { ok: false, resp: json({ error: 'Invalid Authorization token' }, 401) };
    return { ok: true };
  };

  if (mDbMigrate && method === 'POST') {
    const a = _adminAuth();
    if (!a.ok) return a.resp;
    if (!_rlCheck(ip, 'admin-db-migrate', 10, 60000)) return json({ error: 'Too many requests' }, 429);
    return handleDbMigrate(env, request);
  }
  if (mDbRebuildFts && method === 'POST') {
    const a = _adminAuth();
    if (!a.ok) return a.resp;
    if (!_rlCheck(ip, 'admin-db-rebuild-fts', 5, 60000)) return json({ error: 'Too many requests' }, 429);
    return handleDbRebuildFts(env, request);
  }

  if (mSearch && method === 'GET') {
    if (!_rlCheck(ip, 'cards-search', 60, 60000)) return json({ error: 'Too many requests' }, 429);
    return handleSearchCards(env, url.searchParams);
  }
  if (mCardSlug && method === 'GET') {
    if (!_rlCheck(ip, 'cards-detail', 120, 60000)) return json({ error: 'Too many requests' }, 429);
    return handleGetCard(env, mCardSlug[1]);
  }
  if (mBulk && method === 'POST') {
    if (!bulkToken) return json({ error: 'Bulk API not configured' }, 501);
    const auth = (request.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
    if (auth !== bulkToken) return json({ error: 'Invalid Authorization token' }, 401);
    return handleBulkUpsert(request, env);
  }
  if (mList && method === 'GET') {
    if (!_rlCheck(ip, 'cards-list', 60, 60000)) return json({ error: 'Too many requests' }, 429);
    return handleListCards(env, url.searchParams, request);
  }

  // B-2 Doc §101 hreflang injector for STATIC PAGES that now route thru Worker:
  // pricing/about/contact/terms/privacy/cookies — fetch their real .html shell,
  // inject bidirectional hreflang <link> block before </head>.
  // Also accepts /en/pricing, /es/pricing etc. (lang prefix stripped).
  const STATIC_HTML_BY_PATH = {
    "/pricing":              "/pricing.html",
    "/about":                "/about.html",
    "/contact":              "/contact.html",
    "/terms":                "/terms.html",
    "/privacy":              "/privacy.html",
    "/cookies":              "/cookies.html",
    "/payment-success":      "/payment-success.html",
    "/payment-cancel":       "/payment-cancel.html",
    "/pricing.html":         "/pricing.html",
    "/about.html":           "/about.html",
    "/contact.html":         "/contact.html",
    "/terms.html":           "/terms.html",
    "/privacy.html":         "/privacy.html",
    "/cookies.html":         "/cookies.html",
    "/payment-success.html": "/payment-success.html",
    "/payment-cancel.html":  "/payment-cancel.html"
  };
  {
    const m = path.match(/^\/(en|es|fr|pt)(\/.*)$/i);
    const strippedPath = m ? m[2] : path;
    if (method === "GET" && STATIC_HTML_BY_PATH[strippedPath]) {
      // Preserve original path for hreflang calculation (use url.pathname = user-visible)
      return _serveStaticHtmlWithHreflang(url, STATIC_HTML_BY_PATH[strippedPath], path, request);
    }
  }

  // ============== SPA Frontend Route Fallback (after all API / sitemap routes) ==============
  // FIXED: previous code had a duplicate guard block, and _spaResponse was undefined.
  // Strategy: serve index.html SPA shell (with hreflang injected via _spaResponse helper)
  // so front-end router can parse the URL (hash or history) without 404s.
  if (method === 'GET' && _isSPARoute(path)) {
    return _spaResponse(200, url, request);
  }

  return json({ error: 'Not found' }, 404);
}

async function handleCheckMember(request, kv, url) {
  const cookieHdr = request.headers.get('cookie') || '';
  const userToken = getCookie(cookieHdr, 'user_token');
  let email = null;
  let tokenOut = null;

  if (userToken) {
    email = await kv.get('usertoken:' + userToken, 'text');
    tokenOut = userToken;
  } else {
    email = url.searchParams.get('email');
  }
  if (!email) return json({ isMember: false, plan: null, expiresAt: null, daysLeft: 0, userToken: null });

  const p = await getPermission(kv, email);
  if (!p) return json({ isMember: false, plan: null, expiresAt: null, daysLeft: 0, userToken: tokenOut });

  return json({
    isMember: true,
    plan: p.plan,
    expiresAt: p.expiresAt,
    daysLeft: p.daysLeft,
    userToken: p.userToken || tokenOut
  });
}

// Doc §13.2.6 helper: Convert a local "YYYY-MM-DD" + "HH:MM[:SS]" combo in a given
// IANA timezone (e.g. "America/Mexico_City") → UTC millis using Intl.DateTimeFormat.
// Robust on Workers/V8: time-zones are supported via Intl since ~2019.
function _localTimeInTZ(dateStr, timeStr, tzIana) {
  const d = String(dateStr || "").trim() || new Date().toISOString().slice(0, 10);
  const tRaw = String(timeStr || "").trim() || "10:00";
  const t = /^\d{1,2}:\d{2}$/.test(tRaw) ? tRaw + ":00" : tRaw;
  const tz = tzIana || "UTC";
  try {
    const [y, m, day] = d.split("-").map(n => parseInt(n, 10));
    const [hh, mm, ss] = t.split(":").map(n => parseInt(n, 10));
    // dtAsUTC: treat the local y/m/d/h/m/s as if they were UTC components.
    const dtAsUTC = Date.UTC(y, (m|0) - 1, day|0, hh|0, mm|0, ss|0);
    // Render that "UTC fake" date through Intl in the target TZ — we get the
    // *difference* between what was "rendered local" and the desired y/m/d/h/m/s.
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: tz,
      year: "numeric", month: "2-digit", day: "2-digit",
      hour: "2-digit", minute: "2-digit", second: "2-digit",
      hour12: false,
    }).formatToParts(new Date(dtAsUTC));
    const map = {};
    for (const p of parts) map[p.type] = p.value;
    const renderY = parseInt(map.year, 10);
    const renderM = parseInt(map.month, 10) - 1;
    const renderD = parseInt(map.day, 10);
    let renderH = parseInt(map.hour, 10);
    if (renderH === 24) renderH = 0; // Intl sometimes outputs "24" for midnight
    const renderMin = parseInt(map.minute, 10);
    const renderS = parseInt(map.second, 10);
    const renderedUTC = Date.UTC(renderY, renderM, renderD, renderH, renderMin, renderS);
    const diffMs = dtAsUTC - renderedUTC;
    const candidate = dtAsUTC + diffMs;
    if (!Number.isFinite(candidate)) throw new Error("nan");
    return candidate;
  } catch (_) {
    // Last-resort fallback: plain UTC parse.
    return Date.parse(d + "T" + t + "Z");
  }
}

async function handleSendCard(request, kv, resendKey) {
  const body = await request.json().catch(() => ({}));
  const fromEmail = String(body.fromEmail || '').toLowerCase().trim();
  const toEmail = String(body.toEmail || '').toLowerCase().trim();
  if (!fromEmail || !toEmail) return json({ error: 'fromEmail and toEmail required' }, 400);

  const cookieHdr = request.headers.get('cookie') || '';
  const userToken = getCookie(cookieHdr, 'user_token');
  let perm = null;
  if (userToken) {
    const email = await kv.get('usertoken:' + userToken, 'text');
    if (email) perm = await getPermission(kv, email);
  }
  if (!perm) perm = await getPermission(kv, fromEmail);
  if (!perm) {
    const order = await kv.get('order:active:' + fromEmail.toLowerCase(), { type: 'json' });
    if (!order) return json({ error: 'No active membership or order' }, 402);
  }

  if (!resendKey) return json({ error: 'RESEND_API_KEY secret not set' }, 500);

  /* =====================================================================
   * Doc §13.2.6 Timezone Calibration (cf.timezone-aware delivery scheduling).
   *
   * Priority of inputs -> canonical sendAt UTC millis:
   *   A) body.sendAt           (ISO ms timestamp, explicit API caller)
   *   B) body.sendDate+sendTime
   *        - If body.sendAtInterpretation === 'recipient'
   *             AND body.recipientTimezone (IANA) is set
   *             → interpret in RECIPIENT TZ
   *        - Else if body.creatorTimezone (IANA) is set → use that
   *        - Else → use CREATOR cf.timezone from edge
   *   C) Date.now()            (immediate delivery)
   *
   * Resend scheduled_at = ISO8601 UTC. Constraints: 1h ≤ scheduled ≤ 75d.
   * If outside window → force immediate + return warn flag.
   * Creator 24h reminder: stored as KV reminder_24h:<orderId> TTL = (sendAt
   *   - 24h - now)  →  Phase 2 cron / scheduled handler scans this
   *   namespace every 15 min, fires email to fromEmail, and deletes.
   * ===================================================================== */
  const creatorCFtz = (request.cf && request.cf.timezone) || 'UTC';
  const explicitCreatorTz = (body.creatorTimezone && /^[A-Za-z0-9_+.-]+\/[A-Za-z0-9_+.-]+$/.test(String(body.creatorTimezone)))
    ? String(body.creatorTimezone)
    : null;
  const explicitRecipientTz = (body.recipientTimezone && /^[A-Za-z0-9_+.-]+\/[A-Za-z0-9_+.-]+$/.test(String(body.recipientTimezone)))
    ? String(body.recipientTimezone)
    : null;
  const nowTs = Date.now();
  let sendAt = nowTs;
  let usedSchedule = false;
  let tzSource = "UTC/immediate";

  if (body.sendAt && Number.isFinite(+body.sendAt) && +body.sendAt > nowTs - 3600e3) {
    sendAt = Math.floor(+body.sendAt);
    tzSource = "body.sendAt (explicit ms)";
  } else if (body.sendDate || body.sendTime) {
    try {
      const dateStr = String(body.sendDate || '').trim() || new Date().toISOString().slice(0,10);
      const timeStr = String(body.sendTime || '').trim() || '10:00';

      let chosenTZ = creatorCFtz;
      let chosenTZlabel = `creator cf.timezone=${creatorCFtz}`;
      if (String(body.sendAtInterpretation || '').toLowerCase() === 'recipient' && explicitRecipientTz) {
        chosenTZ = explicitRecipientTz;
        chosenTZlabel = `recipient timezone=${chosenTZ}`;
      } else if (explicitCreatorTz) {
        chosenTZ = explicitCreatorTz;
        chosenTZlabel = `creator timezone=${chosenTZ}`;
      }

      const candidate = _localTimeInTZ(dateStr, timeStr, chosenTZ);
      if (Number.isFinite(candidate)) {
        sendAt = candidate > nowTs - 3600e3 ? candidate : nowTs;
        tzSource = `body.sendDate+sendTime in ${chosenTZlabel}`;
      } else {
        sendAt = nowTs;
        tzSource = `fallback-immediate (invalid sendDate/sendTime, tz=${chosenTZ})`;
      }
    } catch (_) { sendAt = nowTs; }
  }

  const SEND_WINDOW_MIN_MS = 60 * 60 * 1000;         //  1h minimum (Resend rule)
  const SEND_WINDOW_MAX_MS = 75 * 24 * 60 * 60 * 1000; // 75d maximum (Resend rule)
  const scheduledAtISO = (sendAt - nowTs >= SEND_WINDOW_MIN_MS && sendAt - nowTs <= SEND_WINDOW_MAX_MS)
    ? new Date(sendAt).toISOString()
    : null;

  if (scheduledAtISO) {
    const daysAhead = _daysFromNow(sendAt);
    const scheduleFeatureKey = _scheduleTierKeyFromDays(daysAhead);
    if (scheduleFeatureKey && !_requireTier(scheduleFeatureKey, request, body)) {
      return _tierDeniedResponse(scheduleFeatureKey, request, body);
    }
  }
  const wantNoWatermark = body && (body.noWatermark || body.watermark === false || body.premiumExport);
  if (wantNoWatermark && !_requireTier('watermark_free', request, body)) {
    return _tierDeniedResponse('watermark_free', request, body);
  }

  const payload = {
    from: RESEND_FROM,
    to: [toEmail],
    reply_to: fromEmail,
    subject: `A card from ${body.fromName || 'a friend'} 🎴`,
    html: buildEmailHtml(body)
  };
  let warnSchedule = null;
  if (scheduledAtISO) {
    payload.scheduled_at = scheduledAtISO;
    usedSchedule = true;
  } else if (sendAt !== nowTs) {
    warnSchedule = `sendAt=${sendAt} (${new Date(sendAt).toISOString()}) outside Resend 1h..75d window → delivered immediately.`;
    sendAt = nowTs;
  }

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'Resend ' + res.status + ': ' + err }, 502);
  }
  const data = await res.json();
  const orderId = 'order_' + randToken(8);
  const effectiveCreatorTz = explicitCreatorTz || creatorCFtz;
  const orderRec = {
    status: usedSchedule ? 'scheduled' : 'queued',
    sendAt,
    tzSource,
    scheduledAtISO: scheduledAtISO || null,
    toEmail,
    fromEmail,
    resendId: data.id,
    creatorCFtz,
    creatorTz: effectiveCreatorTz,
    recipientTz: explicitRecipientTz || null,
    sendAtInterpretation: String(body.sendAtInterpretation || 'creator').toLowerCase() === 'recipient' ? 'recipient' : 'creator',
    sendDate: body.sendDate || null,
    sendTime: body.sendTime || null,
  };
  await kv.put('order:' + orderId, JSON.stringify(orderRec), { expirationTtl: Math.max(7 * 86400, Math.ceil((sendAt - nowTs + 2 * 86400e3) / 1000)) });

  /* Phase 2 cron reminder scaffold — never errors today (best-effort). */
  try {
    if (sendAt - nowTs >= 25 * 3600e3) {
      const remindAt = sendAt - 24 * 3600e3;
      const ttlS = Math.max(3600, Math.ceil((sendAt - nowTs) / 1000));
      await kv.put(`reminder_24h:${orderId}`, JSON.stringify({
        orderId, fromEmail, toEmail, remindAt, sendAt,
        creatorTz: effectiveCreatorTz,
        recipientTz: explicitRecipientTz || null,
        resendId: data.id
      }), { expirationTtl: ttlS });
    }
  } catch (_) { /* ignored — reminder infra optional / Phase 2 */ }

  const out = { ok: true, sent: !usedSchedule, scheduled: usedSchedule, resendId: data.id, orderId };
  if (scheduledAtISO) out.scheduledAtISO = scheduledAtISO;
  if (tzSource)          out.tzSource = tzSource;
  if (effectiveCreatorTz) out.creatorTz = effectiveCreatorTz;
  if (orderRec.recipientTz) out.recipientTz = orderRec.recipientTz;
  out.sendAtInterpretation = orderRec.sendAtInterpretation;
  if (warnSchedule) out.warn = warnSchedule;
  return json(out);
}

async function handleCreateSession(request, creemKey) {
  const body = await request.json();
  const { planId, successUrl, customerEmail, giftEmail, giftSenderName, giftMessage } = body;
  const priceId = PRODUCT_TO_CREEM[planId] || PRODUCT_TO_CREEM.sendafun_monthly_subscription;

  const payload = {
    currency: 'USD',
    line_items: [{ price_id: priceId, quantity: 1 }],
    success_url: successUrl || (SITE_URL_PROD + '/payment-success.html'),
    // cancel_url intentionally omitted — Creem /v1/checkouts rejects this field with 400
    metadata: {
      planId,
      giftEmail: giftEmail || '',
      giftSenderName: giftSenderName || '',
      giftMessage: giftMessage || ''
    }
  };
  if (customerEmail) payload.customer_email = customerEmail;

  const res = await fetch(CREEM_BASE_FROM_KEY(creemKey) + '/checkouts', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + creemKey,
      'Content-Type': 'application/json',
      'x-api-key': creemKey
    },
    body: JSON.stringify(payload)
  });
  if (!res.ok) {
    const err = await res.text();
    return json({ error: 'Creem ' + res.status + ': ' + err }, 502);
  }
  const data = await res.json();
  return json({ ok: true, url: data.url, sessionId: data.id });
}

async function handleCreemWebhook(request, kv, env) {
  const body = await request.text();
  const sig = request.headers.get('x-creem-signature') || request.headers.get('X-Webhook-Signature') || '';
  const secret = getEnvVar(env, 'CREEM_WEBHOOK_SECRET', '');

  if (secret && sig) {
    try {
      const enc = new TextEncoder();
      const k = await crypto.subtle.importKey('raw', enc.encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['verify']);
      const parts = sig.split(',').reduce((a, x) => { const [k2, ...v] = x.trim().split('='); a[k2] = v.join('='); return a; }, {});
      const expected = await crypto.subtle.digest('SHA-256', enc.encode((parts.t || '') + '.' + body));
      const ok = await crypto.subtle.verify('HMAC', k, hexToBytes(parts.v1 || ''), enc.encode((parts.t || '') + '.' + body));
      if (!ok && (parts.t && Math.abs(Date.now() / 1000 - parseInt(parts.t, 10)) > 300)) {
        return json({ error: 'Invalid signature' }, 401);
      }
    } catch (_) { }
  }

  let ev;
  try { ev = JSON.parse(body); } catch (e) { return json({ error: 'Invalid JSON' }, 400); }

  if (ev.type === 'checkout.completed' || ev.type === 'checkout.session.completed') {
    const o = ev.data || ev.object || {};
    const meta = o.metadata || {};
    const planId = meta.planId || 'sendafun_monthly_subscription';
    const email = o.customer_email || (o.customer && o.customer.email);

    if (meta.giftEmail) {
      const giftToken = randToken(16);
      const t = PLAN_TYPES[planId] || 'month';
      const validDays = DAYS_BY_PLAN[t] || 30;
      await kv.put('gift:' + giftToken, JSON.stringify({
        planId,
        senderName: meta.giftSenderName || '',
        message: meta.giftMessage || '',
        createdAt: Date.now(),
        redeemed: false,
        validDays
      }), { expirationTtl: 90 * 86400 });
    } else if (email) {
      await grantSubscription(kv, email, planId);
    }
  }
  return json({ received: true });
}
function hexToBytes(h) {
  const b = new Uint8Array((h || '').length / 2);
  for (let i = 0; i < h.length; i += 2) b[i / 2] = parseInt(h.substring(i, i + 2), 16) || 0;
  return b;
}

async function handleR2Image(bucket, key, wantOriginals) {
  if (!bucket) return json({ error: 'R2 bucket not bound' }, 503);
  const scope = wantOriginals ? 'originals (HD PNG master, paid only)' : 'preview (LR webp, public)';
  // Originals bucket rule: keys MUST be PNG masters → allow-list suffix to avoid leaking webp previews
  // copied here by mistake. Warn but do not block (old data may exist).
  if (wantOriginals && key && !/\.png$/i.test(key)) {
    console.warn('[R2-ORIGINALS] key not .png, may not be a valid HD master: ' + key);
  }
  const obj = await bucket.get(key);
  if (!obj) return json({ error: `R2 object not found (${scope}): ` + key }, 404);
  const headers = new Headers();
  obj.writeHttpMetadata(headers);
  headers.set('Cache-Control', 'public, max-age=31536000, immutable');
  headers.set('Access-Control-Allow-Origin', '*');
  if (obj.httpEtag) headers.set('ETag', obj.httpEtag);
  headers.set('X-R2-Scope', wantOriginals ? 'originals-hd-png' : 'preview-lr-webp');
  // For HD originals: force inline disposition, still prevent auto-download for security.
  if (wantOriginals && !headers.has('Content-Disposition')) {
    headers.set('Content-Disposition', 'inline');
  }
  return new Response(obj.body, { headers });
}

async function handleGroupCreate(request, kv) {
  const body = await request.json();
  const { cardSlug, fromName, fromEmail, toName, toEmail } = body;
  if (!fromEmail) return json({ error: 'fromEmail required' }, 400);

  let maxSignatures = MAX_SIGS_BY_PLAN.free;
  const p = await getPermission(kv, fromEmail);
  if (p) {
    if (p.plan === 'group') maxSignatures = MAX_SIGS_BY_PLAN.group;
    else if (p.plan === 'month' || p.plan === 'year') maxSignatures = MAX_SIGS_BY_PLAN[p.plan];
    else if (p.plan === 'one') maxSignatures = MAX_SIGS_BY_PLAN.one;
  }
  if (p && p.groupPassActive && p.groupPassExpiresAt > Date.now()) {
    maxSignatures = MAX_SIGS_BY_PLAN.group;
  }

  const token = randToken(12);
  const group = {
    token,
    cardSlug: cardSlug || '',
    ownerEmail: fromEmail.toLowerCase(),
    ownerName: fromName || '',
    recipientName: toName || '',
    recipientEmail: toEmail || '',
    signatures: [],
    createdAt: Date.now(),
    expiresAt: Date.now() + 31 * 86400000,
    maxSignatures
  };
  await kv.put('group:' + token, JSON.stringify(group), { expirationTtl: 31 * 86400 });
  return json({ token, shareUrl: SITE_URL_PROD + '/group/' + token, maxSignatures: group.maxSignatures });
}

async function handleGroupGet(kv, token) {
  if (!token) return json({ error: 'token required' }, 400);
  const g = await kv.get('group:' + token, { type: 'json' });
  if (!g) return json({ error: 'Group not found' }, 404);
  return json(g);
}

async function handleGroupSign(request, kv, token) {
  if (!token) return json({ error: 'token required' }, 400);
  const g = await kv.get('group:' + token, { type: 'json' });
  if (!g) return json({ error: 'Group not found' }, 404);
  if (!g.signatures) g.signatures = [];
  if (g.signatures.length >= g.maxSignatures) return json({ error: 'Max signatures reached' }, 409);

  const body = await request.json();
  const sig = {
    signerName: body.signerName || 'Anonymous',
    signerEmoji: body.signerEmoji || '🎂',
    signerText: body.signerText || '',
    photoUrl: body.photoUrl || '',
    at: Date.now(),
    id: randToken(4)
  };
  g.signatures.push(sig);
  await kv.put('group:' + token, JSON.stringify(g), { expirationTtl: Math.max(86400, Math.ceil(((g.expiresAt || (Date.now() + 86400000)) - Date.now()) / 1000)) });
  return json({ ok: true, signatures: g.signatures, length: g.signatures.length });
}

async function handleGroupSend(request, kv, resendKey, token) {
  if (!token) return json({ error: 'token required' }, 400);
  const body = await request.json();
  const g = await kv.get('group:' + token, { type: 'json' });
  if (!g) return json({ error: 'Group not found' }, 404);
  if ((body.ownerEmail || '').toLowerCase() !== (g.ownerEmail || '').toLowerCase()) {
    return json({ error: 'Only owner can send' }, 403);
  }
  if (!g.recipientEmail) return json({ error: 'No recipient email' }, 400);
  if (!resendKey) return json({ error: 'RESEND_API_KEY secret not set' }, 500);

  const res = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      from: RESEND_FROM,
      to: [g.recipientEmail],
      reply_to: g.ownerEmail,
      subject: `🎉 You got a GROUP CARD from ${g.ownerName || 'a friend'} and ${(g.signatures || []).length} friends!`,
      html: buildGroupEmailHtml(g)
    })
  });
  if (!res.ok) return json({ error: 'Resend ' + res.status + ': ' + await res.text() }, 502);
  const data = await res.json();
  g.sentAt = Date.now();
  g.resendId = data.id;
  await kv.put('group:' + token, JSON.stringify(g), { expirationTtl: 31 * 86400 });
  return json({ sent: true, resendId: data.id });
}

async function handleGroupStatus(request, kv, token) {
  if (!token) return json({ error: 'token required' }, 400);
  const g = await kv.get('group:' + token, { type: 'json' });
  if (!g) return json({ error: 'Group not found' }, 404);
  const cookieHdr = request.headers.get('cookie') || '';
  const userToken = getCookie(cookieHdr, 'user_token');
  let viewerEmail = '';
  if (userToken) viewerEmail = (await kv.get('usertoken:' + userToken, 'text')) || '';
  const qEmail = new URL(request.url).searchParams.get('email') || '';
  if (!viewerEmail && qEmail) viewerEmail = qEmail;
  const isOwner = (viewerEmail || '').toLowerCase() === (g.ownerEmail || '').toLowerCase();
  return json({
    token: g.token,
    isOwner,
    ownerEmail: g.ownerEmail || '',
    signatureCount: (g.signatures || []).length,
    maxSignatures: g.maxSignatures || 0,
    sentAt: g.sentAt || null,
    hasRecipient: !!g.recipientEmail,
    createdAt: g.createdAt || null,
    expiresAt: g.expiresAt || null
  });
}

async function handleContact(request, resendKey) {
  let body;
  try { body = await request.json(); } catch (_) { body = {}; }
  const name = String(body.name || '').trim();
  const email = String(body.email || '').trim();
  const topic = String(body.topic || 'other').trim();
  const message = String(body.message || '').trim();
  const sentAt = String(body.sentAt || new Date().toISOString());

  if (name.length < 2) return json({ error: 'Name too short' }, 400);
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) return json({ error: 'Invalid email' }, 400);
  if (message.length < 10) return json({ error: 'Message too short' }, 400);

  const topicLabel = {
    support: 'Support / Help with a card',
    feature: 'Feature Request',
    bug: 'Bug Report',
    press: 'Press / Media',
    business: 'Business / Corporate',
    other: 'Other'
  }[topic] || 'Other';

  if (!resendKey) {
    return json({ ok: true, queued: true, note: 'RESEND_API_KEY not configured — stored as best-effort.' });
  }

  const safeEsc = (s) => String(s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

  const htmlBody = `
<!doctype html><html><body style="font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;padding:24px;background:#f5f5f7;color:#111827">
<table cellpadding="0" cellspacing="0" style="max-width:560px;margin:0 auto;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 4px 20px rgba(0,0,0,0.06)">
  <tr><td style="padding:28px 32px;background:linear-gradient(135deg,#6366f1,#ec4899);color:#fff">
    <div style="font-size:20px;font-weight:700;margin:0 0 4px">📮 New Contact Form Message</div>
    <div style="font-size:13px;opacity:0.92;margin:0">Topic: ${safeEsc(topicLabel)} · ${safeEsc(sentAt)}</div>
  </td></tr>
  <tr><td style="padding:28px 32px">
    <div style="margin-bottom:16px">
      <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:6px">From</div>
      <div style="font-size:16px;font-weight:600;color:#111827">${safeEsc(name)} <span style="font-weight:400;color:#6366f1">· ${safeEsc(email)}</span></div>
    </div>
    <div style="border-top:1px solid #e5e7eb;padding-top:16px">
      <div style="font-size:11px;letter-spacing:0.06em;text-transform:uppercase;color:#6b7280;margin-bottom:10px">Message</div>
      <div style="font-size:15px;line-height:1.65;color:#1f2937;white-space:pre-wrap;word-wrap:break-word">${safeEsc(message)}</div>
    </div>
  </td></tr>
  <tr><td style="padding:16px 32px;background:#f9fafb;border-top:1px solid #e5e7eb;font-size:12px;color:#6b7280">
    Reply to the sender directly: <a href="mailto:${safeEsc(email)}" style="color:#6366f1">${safeEsc(email)}</a>
  </td></tr>
</table></body></html>`;

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: 'Bearer ' + resendKey, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        from: RESEND_FROM,
        to: [RESEND_FROM],
        reply_to: email,
        subject: `[Contact] ${topicLabel} — ${name} <${email}>`,
        html: htmlBody
      })
    });
    if (!res.ok) {
      const txt = await res.text();
      return json({ ok: true, queued: true, note: 'Resend upstream failed, stored on client as fallback.', upstreamStatus: res.status, upstreamError: txt.slice(0, 200) }, 202);
    }
    const data = await res.json();
    return json({ ok: true, sent: true, resendId: data.id });
  } catch (err) {
    return json({ ok: true, queued: true, note: 'Network error, stored on client as fallback.', error: String(err).slice(0, 200) }, 202);
  }
}

async function handleGiftGet(kv, token) {
  if (!token) return json({ error: 'token required' }, 400);
  const g = await kv.get('gift:' + token, { type: 'json' });
  if (!g) return json({ error: 'Gift not found' }, 404);
  if (g.redeemed) return json({ error: 'Gift already used' }, 410);
  const t = PLAN_TYPES[g.planId] || 'month';
  return json({
    planId: g.planId,
    senderName: g.senderName,
    message: g.message,
    validDays: g.validDays,
    planName: planNameOf(t)
  });
}

async function handleGiftRedeem(request, kv) {
  const body = await request.json();
  const { token, email, name } = body;
  if (!token || !email) return json({ error: 'token and email required' }, 400);

  const g = await kv.get('gift:' + token, { type: 'json' });
  if (!g) return json({ error: 'Gift not found' }, 404);
  if (g.redeemed) return json({ error: 'Gift already redeemed' }, 410);

  const t = PLAN_TYPES[g.planId] || 'month';
  const validDays = g.validDays || DAYS_BY_PLAN[t] || 30;
  const expiresAt = Date.now() + validDays * 86400000;
  const userToken = randToken(16);
  const perm = {
    active: true,
    plan: t,
    planId: g.planId,
    expiresAt,
    giftFrom: g.senderName || name || '',
    updatedAt: Date.now(),
    userToken,
    email: email.toLowerCase()
  };
  const ttl = Math.min(validDays * 86400 + 86400, 31536000);
  await kv.put('perm:' + email.toLowerCase(), JSON.stringify(perm), { expirationTtl: ttl });
  await kv.put('usertoken:' + userToken, email.toLowerCase(), { expirationTtl: ttl });

  g.redeemed = true;
  g.redeemedAt = Date.now();
  g.redeemedBy = email.toLowerCase();
  await kv.put('gift:' + token, JSON.stringify(g), { expirationTtl: 90 * 86400 });

  return json({ redeemed: true, plan: planNameOf(t), expiresAt, userToken });
}

async function handleHealth(env, creemKey) {
  return json({
    ok: true,
    time: Date.now(),
    kvBound: !!env.CARD_PERMISSIONS,
    r2Bound: !!env.PREVIEW_BUCKET,
    originalsR2Bound: !!env.ORIGINALS_BUCKET,
    d1Bound: !!env.DB,
    creemTest: CREEM_BASE_FROM_KEY(creemKey)
  });
}

// ============================================================
// SEO: Dynamic Sitemap + Robots.txt (live from D1 — no static files needed)
// ============================================================
const SITEMAP_STATIC_PAGES = [
  { loc: "/", priority: "1.0", changefreq: "weekly" },
  { loc: "/create", priority: "0.9", changefreq: "weekly" },
  { loc: "/pricing", priority: "0.95", changefreq: "weekly" },
  { loc: "/discover", priority: "0.9", changefreq: "daily" },
  { loc: "/trending", priority: "0.85", changefreq: "daily" },
  { loc: "/latest", priority: "0.85", changefreq: "daily" },
  { loc: "/holidays", priority: "0.85", changefreq: "weekly" },
  { loc: "/message-generator", priority: "0.8", changefreq: "weekly" },
  { loc: "/privacy", priority: "0.4", changefreq: "monthly" },
  { loc: "/terms", priority: "0.4", changefreq: "monthly" },
  { loc: "/contact", priority: "0.5", changefreq: "monthly" },
  { loc: "/about", priority: "0.5", changefreq: "monthly" },
  { loc: "/cookies", priority: "0.3", changefreq: "monthly" }
];
const SITEMAP_CATEGORIES = [
  "anniversary","birthday","christmas","congratulations","easter",
  "encouragement","fathers-day","friendship","get-well","good-luck",
  "graduation","halloween","love","missing-you","mothers-day",
  "new-baby","new-year","retirement","sorry","sympathy",
  "thank-you","thanksgiving","thinking-of-you","valentine","wedding"
];
const SITEMAP_HIGH_PRIORITY = new Set(["birthday", "christmas", "love", "wedding", "thank-you"]);
const SITEMAP_WEEKLY_CHANGE = new Set(["birthday", "christmas"]);
function _isoToday() {
  const d = new Date(); const p = n => (n < 10 ? "0"+n : ""+n);
  return d.getUTCFullYear() + "-" + p(d.getUTCMonth()+1) + "-" + p(d.getUTCDate());
}
function _xml(url, lastmod, changefreq, priority) {
  return "  <url>\n" +
    "    <loc>" + esc(SITE_URL_PROD + url) + "</loc>\n" +
    "    <lastmod>" + lastmod + "</lastmod>\n" +
    "    <changefreq>" + changefreq + "</changefreq>\n" +
    "    <priority>" + priority + "</priority>\n" +
    "  </url>\n";
}
function _sitemapWrapper(urlsXml) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    urlsXml + '</urlset>\n';
}
function _sitemapIndex(entries) {
  return '<?xml version="1.0" encoding="UTF-8"?>\n' +
    '<sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n' +
    entries.map(e =>
      "  <sitemap>\n" +
      "    <loc>" + esc(SITE_URL_PROD + e.loc) + "</loc>\n" +
      "    <lastmod>" + e.lastmod + "</lastmod>\n" +
      "  </sitemap>\n"
    ).join("") + '</sitemapindex>\n';
}
function _xmlResponse(content) {
  return new Response(content, {
    status: 200,
    headers: { "Content-Type": "application/xml;charset=utf-8", "Cache-Control": "public, max-age=600, s-maxage=1200" }
  });
}
function handleSitemapIndex() {
  const today = _isoToday();
  return _xmlResponse(_sitemapIndex([
    { loc: "/sitemap-pages.xml", lastmod: today },
    { loc: "/sitemap-cards.xml", lastmod: today },
    // B-2 Doc §218: 4 separate language sitemaps → each indexed independently in GSC.
    { loc: "/sitemap-en.xml", lastmod: today },
    { loc: "/sitemap-es.xml", lastmod: today },
    { loc: "/sitemap-fr.xml", lastmod: today },
    { loc: "/sitemap-pt.xml", lastmod: today }
  ]));
}

async function handleSitemapByLang(env, lang) {
  // B-2 Doc §218: Per-language sitemap. Same cards + static pages as the global one,
  // but every <loc> is prefixed with /{lang}/ so Google partitions the index by locale
  // and we don't dilute authority across a single monster sitemap.
  await loadCategoryIndexFromR2(env);
  const lg = (lang && GEO_4_LANGS.includes(lang.toLowerCase())) ? lang.toLowerCase() : GEO_DEFAULT_LANG;
  const today = _isoToday();
  const urls = [];
  for (const p of SITEMAP_STATIC_PAGES) {
    const locPath = "/" + lg + p.loc;
    urls.push(_xml(locPath, today, p.changefreq, p.priority));
  }
  const dynCats = Array.isArray(_KNOWN_CATEGORY_KEYS) && _KNOWN_CATEGORY_KEYS.length ? _KNOWN_CATEGORY_KEYS : SITEMAP_CATEGORIES;
  for (const c of dynCats) {
    const changefreq = SITEMAP_WEEKLY_CHANGE.has(c) ? "weekly" : "weekly";
    const priority = SITEMAP_HIGH_PRIORITY.has(c) ? "0.85" : "0.8";
    urls.push(_xml("/" + lg + "/" + c, today, changefreq, priority));
  }
  if (env.DB) {
    try {
      const rs = await env.DB.prepare("SELECT slug, category FROM cards ORDER BY slug").raw();
      let i = 0;
      for (const row of rs) {
        const slug = row[0]; if (!slug) continue;
        const cat = row[1] || "discover";
        const changefreq = SITEMAP_WEEKLY_CHANGE.has(cat) ? "weekly" : "monthly";
        const priority = SITEMAP_HIGH_PRIORITY.has(cat) ? "0.7" : "0.55";
        urls.push(_xml("/" + lg + "/card/" + slug, today, changefreq, priority));
        if (++i >= 50000) break;
      }
    } catch (_) {}
  }
  return _xmlResponse(_sitemapWrapper(urls.join("")));
}
function handleSitemapPages() {
  const today = _isoToday();
  const urls = [];
  for (const p of SITEMAP_STATIC_PAGES) urls.push(_xml(p.loc, today, p.changefreq, p.priority));
  const dynCats = Array.isArray(_KNOWN_CATEGORY_KEYS) && _KNOWN_CATEGORY_KEYS.length ? _KNOWN_CATEGORY_KEYS : SITEMAP_CATEGORIES;
  for (const c of dynCats) {
    const priority = SITEMAP_HIGH_PRIORITY.has(c) ? "0.85" : "0.8";
    urls.push(_xml("/"+c, today, "weekly", priority));
  }
  return _xmlResponse(_sitemapWrapper(urls.join("")));
}
async function handleSitemapCards(env) {
  const today = _isoToday();
  if (!env.DB) return _xmlResponse(_sitemapWrapper(""));
  await loadCategoryIndexFromR2(env);
  let all = [];
  try {
    const rs = await env.DB.prepare("SELECT slug, category FROM cards ORDER BY slug").raw();
    for (const row of rs) {
      const slug = row[0]; if (!slug) continue;
      const cat = row[1] || "discover";
      const changefreq = SITEMAP_WEEKLY_CHANGE.has(cat) ? "weekly" : "monthly";
      const priority = SITEMAP_HIGH_PRIORITY.has(cat) ? "0.7" : "0.55";
      all.push(_xml("/card/" + slug, today, changefreq, priority));
      if (all.length >= 50000) break;
    }
  } catch (e) {}
  return _xmlResponse(_sitemapWrapper(all.join("")));
}
function handleRobotsTxt() {
  const body =
    "User-agent: *\n" +
    "Allow: /\n" +
    "Disallow: /group/\n" +
    "Disallow: /preview\n" +
    "Disallow: /api/\n" +
    "\n" +
    "Sitemap: " + SITE_URL_PROD + "/sitemap.xml\n";
  return new Response(body, {
    status: 200,
    headers: { "Content-Type": "text/plain;charset=utf-8", "Cache-Control": "public, max-age=600" }
  });
}

// ============================================================
// D1 Cards API Handlers
// ============================================================

function parsePexelsIdFromSlug(slug) {
  if (!slug) return '';
  const s = String(slug);
  const last = s.split('-').pop();
  return /^\d{4,}$/.test(last) ? last : '';
}

// #region image-normalization (root cause fix for D1 R2 key integrity: ~79% bad IDs → 0%)
// ----------------------------------------------------------------
// Background: Preview R2 bucket contains EXACTLY 25 categories × 10
// confirmed pexels photo IDs = 250 unique key paths, but D1 has
// 11,067 card rows and ~79% of them point to pexels IDs that
// simply don't exist in any bucket → 404. This block provides a
// deterministic per-card mapping that guarantees every card URL
// points to a real existing object, while preserving:
//   (a) category bucket folder prefix (known to exist)
//   (b) valid file naming pattern {cat}-pexels-{ID}-v2-vertical.webp
//   (c) slug-determinism (same card → same image on every render)
//   (d) identity for the ~21% of rows that already use a valid ID
//
// DYNAMIC UPGRADE (schema_version 2): indexer script writes:
//   • python _scripts/_s3_category_indexer.py
//   → uploads sendafun-preview/_category_index.json  (S3目录=唯一真源)
// The Worker will load that JSON at the start of every D1-card request
// (list/slug-get) to override the FALLBACK constants below.
// Result:  if you ADD a new folder like  "teachers-day/pexels-<10 ids>.png"
//        to sendafun-originals  + rerun the indexer, the Worker
// immediately picks up the new category + IDs WITHOUT any code redeploy.
// ----------------------------------------------------------------
const PREVIEW_R2_BASE = "https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev";

const FALLBACK_KNOWN_GOOD_PER_CATEGORY = {
  "anniversary": [5705991,5706029,5725879,8014883,8014934,8014935,8015238,8015616,33629667,33629668],
  "birthday": [8014697,8014703,8014709,8014713,8014829,8014830,8014831,8014837,8014874,8014876],
  "christmas": [10226187,14543391,14545423,14681480,19208322,19551026,19551029,29666240,32795870,35217786],
  "congratulations": [4439442,5478209,5705959,5706039,7723812,7723816,7842828,8177957,28461106,37845926],
  "easter": [6990553,6990555,6990620,6990621,6990622,6990626,6990627,6990672,6990733,6990735],
  "encouragement": [4466104,5420988,5981366,5993294,6532589,8015243,8361432,8383666,12268292,19652318],
  "fathers-day": [4260097,8015532,17385395,18296227,28589300,33428408,33769345,35281486,37936229,38165283],
  "friendship": [4207550,5477588,5478209,5491834,5706029,5706039,5706056,5713665,7679771,14545423],
  "get-well": [5706031,8015505,8015517,8015529,8015532,8015576,8015637,18028975,18456265,37182441],
  "good-luck": [7661289,13817351,15104338,18684950,25949528,27259375,30125650,30125651,30191155,37513752],
  "graduation": [9829305,9829309,9829315,9829319,9829478,9829489,9829490,9829492,17778852,23490155],
  "halloween": [5689143,9966403,9966421,9966441,9966446,9966450,9966468,9966471,9966478,34880804],
  "love": [7679697,7679698,7679701,7679760,7679771,7680031,11133249,13786308,20122621,30269722],
  "missing-you": [5706039,5713665,6633082,8015505,8015521,8015616,8015637,13817351,19582311,32170901],
  "mothers-day": [7763899,7763933,7763964,7764024,7764074,7764415,7764419,7764510,7764526,8015521],
  "new-baby": [5420895,7701430,8015568,28925003,32341323,32838207,34291551,34625449,35245312,37182441],
  "new-year": [5473343,5485043,14543391,19287466,19287471,29878372,29997004,32718648,34539522,34654310],
  "retirement": [4207550,4464371,4466052,4668380,5478230,5705991,8015568,16598003,27196519,33428408],
  "sorry": [4207550,5478209,5706039,6633016,6633040,6633047,6633050,8015505,8015568,8015616],
  "sympathy": [8015513,8015516,8015522,8015574,8015626,8015627,8015629,8015633,8015637,8015642],
  "thank-you": [4386503,4386516,6432585,7661213,7661629,8014830,8015521,8058870,19582311,29494716],
  "thanksgiving": [14238943,18852526,18852529,18852537,18852539,18852541,18939831,18939833,29021636,31638765],
  "thinking-of-you": [4207550,5420902,5478209,5706029,7291601,8015505,8015568,8361431,10202989,19582311],
  "valentine": [7679697,7679698,7679701,7679771,7679911,7680024,7680031,13786308,20122621,30269722],
  "wedding": [8015507,8015516,8015568,8015574,8015616,8015629,8015632,8059957,14794078,30191213]
};

const FALLBACK_MANUAL_ALIASES = {
  apology: "sorry", apologies: "sorry", forgive: "sorry",
  dad: "fathers-day", dads: "fathers-day", daddy: "fathers-day", father: "fathers-day", papa: "fathers-day",
  "fathers": "fathers-day", "dad-day": "fathers-day",
  mom: "mothers-day", moms: "mothers-day", mum: "mothers-day", mothers: "mothers-day",
  mother: "mothers-day", "mum-day": "mothers-day", "mom-day": "mothers-day",
  valentines: "valentine", "valentines-day": "valentine", "saint-valentine": "valentine",
  "new-years": "new-year", "new-years-eve": "new-year", nye: "new-year",
  congratulations: "congratulations", congrats: "congratulations",
  thanks: "thank-you", appreciation: "thank-you", gratitude: "thank-you", "thankyou": "thank-you",
  encourage: "encouragement", motivational: "encouragement", support: "encouragement",
  recovery: "get-well", healing: "get-well", feelbetter: "get-well", wellness: "get-well",
  funeral: "sympathy", condolence: "sympathy", condolences: "sympathy", loss: "sympathy", grief: "sympathy",
  bereavement: "sympathy", rip: "sympathy",
  graduate: "graduation", grad: "graduation", diploma: "graduation",
  bday: "birthday", happybirthday: "birthday",
  marry: "wedding", marriage: "wedding", engagement: "love", bridal: "wedding",
  bestfriend: "friendship", bff: "friendship", squad: "friendship", friend: "friendship",
  romantic: "love", romance: "love", "i-love-you": "love", "for-her": "love", "for-him": "love",
  "miss-you": "missing-you", missyou: "missing-you",
  retire: "retirement", retired: "retirement",
  newborn: "new-baby", babyshower: "new-baby", "baby-shower": "new-baby", pregnancy: "new-baby",
  "welcome-baby": "new-baby", "its-a-boy": "new-baby", "its-a-girl": "new-baby",
  xmas: "christmas", noel: "christmas", yule: "christmas", "christmas-day": "christmas",
  thankful: "thanksgiving", turkey: "thanksgiving", "fall-holiday": "thanksgiving",
  spooky: "halloween", "trick-or-treat": "halloween",
  "happy-easter": "easter", spring: "easter",
  luck: "good-luck", "best-of-luck": "good-luck", fortune: "good-luck",
  thinkofyou: "thinking-of-you", thoughtofyou: "thinking-of-you",
  anniversary: "anniversary", "wedding-anniversary": "anniversary"
};

// Runtime-overridable references (starts as the fallback, replaced by index JSON)
let KNOWN_GOOD_PER_CATEGORY = FALLBACK_KNOWN_GOOD_PER_CATEGORY;
let _MANUAL_CATEGORY_ALIASES = FALLBACK_MANUAL_ALIASES;
let _KNOWN_CATEGORY_KEYS = Object.keys(KNOWN_GOOD_PER_CATEGORY);
let _CATEGORY_INDEX_LOAD_STATE = "unloaded";   // unloaded → loading → loaded|failed
let _CATEGORY_INDEX_LOAD_PROMISE = null;
let _CATEGORY_INDEX_LAST_TS = 0;
const CATEGORY_INDEX_CACHE_MS = 5 * 60 * 1000; // refresh allowed every 5 min (stale ≤ 5 min)

async function loadCategoryIndexFromR2(env, { force = false } = {}) {
  // Guard: no preview R2 bucket binding may not exist (unit tests, old wrangler.toml
  // — fall back silently to hardcoded 250 IDs we ship with.
  const bucket = env && (env.PREVIEW_BUCKET || env.bucket || env.previewBucket || env.preview);
  const now = Date.now();
  if (!force
      && _CATEGORY_INDEX_LOAD_STATE === "loaded"
      && (now - _CATEGORY_INDEX_LAST_TS) < CATEGORY_INDEX_CACHE_MS) {
    return;
  }
  if (_CATEGORY_INDEX_LOAD_STATE === "loading" && _CATEGORY_INDEX_LOAD_PROMISE) {
    return _CATEGORY_INDEX_LOAD_PROMISE;
  }
  if (!bucket) {
    _CATEGORY_INDEX_LOAD_STATE = "failed";
    KNOWN_GOOD_PER_CATEGORY = FALLBACK_KNOWN_GOOD_PER_CATEGORY;
    _MANUAL_CATEGORY_ALIASES = FALLBACK_MANUAL_ALIASES;
    _KNOWN_CATEGORY_KEYS = Object.keys(KNOWN_GOOD_PER_CATEGORY);
    return;
  }
  _CATEGORY_INDEX_LOAD_STATE = "loading";
  _CATEGORY_INDEX_LOAD_PROMISE = (async () => {
    try {
      const obj = await bucket.get("_category_index.json", {
        onlyIfModifiedSince: force ? undefined : (
          _CATEGORY_INDEX_LAST_TS ? new Date(_CATEGORY_INDEX_LAST_TS - 1000) : undefined
        ),
        cacheTtl: 60,
      });
      if (!obj) {
        throw new Error("R2 object missing _category_index.json (run `python _scripts/_s3_category_indexer.py`)");
      }
      const txt = await obj.text();
      const idx = JSON.parse(txt || "{}");
      const bc = idx && typeof idx.by_category === "object" ? idx.by_category : null;
      if (!bc || Object.keys(bc).length === 0 || !Array.isArray(idx.category_keys)) {
        throw new Error("_category_index.json missing by_category or category_keys");
      }
      const rebuilt = {};
      for (const k of Object.keys(bc)) {
        const entry = bc[k];
        if (entry && Array.isArray(entry.pexels_ids)) {
          rebuilt[k] = entry.pexels_ids.map(n => Number(n) || 0).filter(Boolean);
        }
      }
      const ali = idx && typeof idx.category_aliases === "object" ? idx.category_aliases : {};
      KNOWN_GOOD_PER_CATEGORY = rebuilt;
      _MANUAL_CATEGORY_ALIASES = Object.assign({}, FALLBACK_MANUAL_ALIASES, ali);
      _KNOWN_CATEGORY_KEYS = Array.isArray(idx.category_keys) && idx.category_keys.length
        ? idx.category_keys.slice()
        : Object.keys(KNOWN_GOOD_PER_CATEGORY);
      _CATEGORY_INDEX_LAST_TS = now;
      _CATEGORY_INDEX_LOAD_STATE = "loaded";
    } catch (err) {
      _CATEGORY_INDEX_LOAD_STATE = "failed";
      // Silent fallback to the bundled FALLBACK — the user never sees no 500s,
      // only slightly stale category list until indexer + re-upload run.
      KNOWN_GOOD_PER_CATEGORY = FALLBACK_KNOWN_GOOD_PER_CATEGORY;
      _MANUAL_CATEGORY_ALIASES = FALLBACK_MANUAL_ALIASES;
      _KNOWN_CATEGORY_KEYS = Object.keys(KNOWN_GOOD_PER_CATEGORY);
    } finally {
      _CATEGORY_INDEX_LOAD_PROMISE = null;
    }
  })();
  return _CATEGORY_INDEX_LOAD_PROMISE;
}
function _resolveKnownCategory(inputCat) {
  if (!inputCat) return "birthday";
  const raw = String(inputCat).trim().toLowerCase();
  if (!raw) return "birthday";
  if (KNOWN_GOOD_PER_CATEGORY[raw]) return raw;
  if (_MANUAL_CATEGORY_ALIASES[raw]) return _MANUAL_CATEGORY_ALIASES[raw];
  // fallback: token overlap similarity (strip apostrophe-s / -day suffixes)
  const tokens = new Set(raw.replace(/'s/g,"").replace(/-day$/g,"").split("-").filter(Boolean));
  let best = "birthday", bestScore = -1;
  for (const k of _KNOWN_CATEGORY_KEYS) {
    const kTokens = k.replace(/'s/g,"").replace(/-day$/g,"").split("-").filter(Boolean);
    let score = 0;
    for (const t of kTokens) if (tokens.has(t)) score++;
    // whole-string contains match
    if (raw.includes(k.substring(0,3))) score += 0.3;
    if (k.includes(raw.substring(0, Math.min(3,raw.length)))) score += 0.3;
    if (score > bestScore) { bestScore = score; best = k; }
  }
  return best;
}
function _fnv1a32(str) {
  let h = 0x811c9dc5;
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i);
    h = (h + ((h << 1) + (h << 4) + (h << 7) + (h << 8) + (h << 24)));
    h >>>= 0;
  }
  return h >>> 0;
}
const _R2_PEXELS_WM_RE = /-pexels-(\d+)-v2-vertical\.webp$/;
function normalizeCardImages(card) {
  if (!card) return card;
  const srcCat = (typeof card.category === "string" && card.category) ? card.category.trim().toLowerCase() : "birthday";
  const knownCat = _resolveKnownCategory(srcCat);
  const pool = KNOWN_GOOD_PER_CATEGORY[knownCat];
  if (!pool || !pool.length) return card;
  const slugSeed = (typeof card.slug === "string" ? card.slug : (card.title || "x")).toString();
  const existingWm = typeof card.bgImageWatermark === "string" ? card.bgImageWatermark : "";
  const existingBg = typeof card.bgImage === "string" ? card.bgImage : "";
  const wmM = _R2_PEXELS_WM_RE.exec(existingWm);
  // Preserve existing ID IF AND ONLY IF: folder matches knownCat AND id is in pool
  let keepExisting = false;
  if (wmM && existingWm.includes("/" + knownCat + "/")) {
    const id = parseInt(wmM[1], 10);
    if (Number.isFinite(id) && pool.includes(id)) keepExisting = true;
  }
  let chosenId;
  if (keepExisting) {
    chosenId = parseInt(wmM[1], 10);
  } else {
    const idx = _fnv1a32(slugSeed) % pool.length;
    chosenId = pool[idx];
  }
  const wmUrl = PREVIEW_R2_BASE + "/" + knownCat + "/" + knownCat + "-pexels-" + chosenId + "-v2-vertical.webp";
  card.bgImageWatermark = wmUrl;
  card.bgImage = wmUrl;
  if (typeof card.ogImage !== "string" || !card.ogImage) card.ogImage = wmUrl;
  card.category = knownCat;
  card.pexelsId = String(chosenId);
  return card;
}
// #endregion image-normalization

function _rowToCard(row) {
  const card = {
    slug: row.slug,
    title: row.title,
    category: row.category,
    tags: row.tags ? JSON.parse(row.tags) : [],
    style: row.style,
    bgImage: row.bg_image,
    bgImageWatermark: row.bg_image_watermark,
    defaultText: row.default_text,
    defaultFont: row.default_font,
    defaultColor: row.default_color,
    defaultFilter: row.default_filter,
    aspectRatio: row.aspect_ratio || '3/4',
    ogImage: row.og_image,
    seo: row.seo ? JSON.parse(row.seo) : {},
    pexelsId: row.pexels_id,
    emotionalTags: row.emotional_tags ? JSON.parse(row.emotional_tags) : [],
    envelopeStyleId: row.envelope_style_id || '',
    geoCountryTarget: row.geo_country_target ? JSON.parse(row.geo_country_target) : []
  };
  return normalizeCardImages(card);
}

async function handleListCards(env, q, request) {
  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 500);
  await loadCategoryIndexFromR2(env);

  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const size = Math.min(10000, Math.max(1, parseInt(q.get('size') || '24', 10)));
  const offset = (page - 1) * size;
  const category = q.get('category') || '';
  const style = q.get('style') || '';
  const sort = (q.get('sort') || 'newest').toLowerCase();
  /* Doc §179: geo_country_target card pinning to top of category list.
   * cc is the visitor country (via cf.country or CF-IPCountry).
   * If cc is in a card's geoCountryTarget array → that card gets a
   * 500-point boost + sorted before all non-pinned cards in the same
   * ORDER BY window. We still respect sort=random/oldest for the rest.
   */
  const cc = (request?.cf?.country || request?.headers?.get?.('CF-IPCountry') || '').toUpperCase();

  const where = [];
  const params = [];
  if (category) { where.push('category = ?'); params.push(category); }
  if (style) { where.push('style = ?'); params.push(style); }
  const whereSql = where.length ? 'WHERE ' + where.join(' AND ') : '';

  /* Doc §13.2.3: Geo-aware sort order.
   * CASE expression: geo_country_target JSON contains the cc → rank 0 (top).
   * We still layer the requested sort (newest/oldest/random) as the second tiebreaker.
   */
  let orderSql;
  if (sort === 'oldest') {
    orderSql = `ORDER BY (CASE WHEN json_extract(geo_country_target, '$') LIKE '%${esc(cc).replace(/'/g, "''")}%' THEN 0 ELSE 1 END) ASC, created_at ASC`;
  } else if (sort === 'random') {
    orderSql = `ORDER BY (CASE WHEN json_extract(geo_country_target, '$') LIKE '%${esc(cc).replace(/'/g, "''")}%' THEN 0 ELSE 1 END) ASC, RANDOM()`;
  } else {
    orderSql = `ORDER BY (CASE WHEN json_extract(geo_country_target, '$') LIKE '%${esc(cc).replace(/'/g, "''")}%' THEN 0 ELSE 1 END) ASC, created_at DESC`;
  }

  const totalPs = db.prepare(
    `SELECT COUNT(*) AS c FROM cards ${whereSql}`
  ).bind(...params);
  const listPs = db.prepare(
    `SELECT * FROM cards ${whereSql} ${orderSql} LIMIT ? OFFSET ?`
  ).bind(...params, size, offset);
  const [tRes, lRes] = await db.batch([totalPs, listPs]);

  const total = tRes.results[0]?.c || 0;
  const cards = lRes.results.map(_rowToCard);

  /* Doc §13.2.3 — Final pass with SAF_SLOTS GeoFestivalTargetingSort.
   * The DB-level CASE handles geo_country_target pins. The JS-level
   * function additionally handles:
   *   - holiday proximity (days-until-Christmas style scoring)
   *   - country-specific national holidays (FR 14juil, BR Carnaval, ...)
   * Since the DB window is size rows, we sort those size rows in JS
   * without touching DB performance.
   */
  const sortedCards = cc ? (SAF_SLOTS.GeoFestivalTargetingSort(cards, cc, size) || cards) : cards;

  const resp = json({
    ok: true,
    page, size, total,
    totalPages: Math.ceil(total / size),
    cards: sortedCards,
    geoCountry: cc || undefined,
    geoPinned: cc ? true : undefined
  });
  return resp;
}

async function handleGetCard(env, slug) {
  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 500);
  await loadCategoryIndexFromR2(env);
  const ps = db.prepare('SELECT * FROM cards WHERE slug = ? LIMIT 1').bind(decodeURIComponent(slug));
  const res = await ps.first();
  if (!res) return json({ error: 'Card not found' }, 404);
  const full = _rowToCard(res);
  const { pexelsId, emotionalTags, envelopeStyleId, geoCountryTarget, seo, slug: s, title, ...card } = full;
  card.slug = typeof s === 'string' ? s : '';
  card.title = typeof title === 'string' ? title : '';
  card.pexelsId = typeof pexelsId === 'string' ? pexelsId : '';
  card.emotionalTags = Array.isArray(emotionalTags) ? emotionalTags : [];
  card.envelopeStyleId = envelopeStyleId ?? null;
  card.geoCountryTarget = Array.isArray(geoCountryTarget) ? geoCountryTarget : [];
  card.seo = seo && typeof seo === 'object' && !Array.isArray(seo) ? seo : { title: '', description: '', keywords: [] };
  const seoSafe = card.seo;
  return json({
    ok: true,
    card,
    emotionalTags: Array.isArray(emotionalTags) ? emotionalTags : [],
    envelopeStyleId: envelopeStyleId ?? null,
    geoCountryTarget: Array.isArray(geoCountryTarget) ? geoCountryTarget : [],
    pexelsId: typeof pexelsId === 'string' ? pexelsId : '',
    seo: seoSafe,
    slug: typeof s === 'string' ? s : '',
    title: typeof title === 'string' ? title : '',
  });
}

async function handleSearchCards(env, q) {
  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 500);
  await loadCategoryIndexFromR2(env);
  const query = (q.get('q') || '').trim();
  const page = Math.max(1, parseInt(q.get('page') || '1', 10));
  const size = Math.min(60, Math.max(1, parseInt(q.get('size') || '24', 10)));
  const offset = (page - 1) * size;

  if (!query) return json({ ok: true, page, size, total: 0, totalPages: 0, cards: [] });

  /* ================================================================
   * Phase 1: FTS5 prefix match (primary path, bm25-ranked).
   * Doc §224: FTS query normalized — punctuation stripped, each token
   * wrapped as prefix "word"*, joined with implicit AND.
   * ================================================================ */
  const cleanQ = query.replace(/[(){}\[\]\\;,.:@#$%^&*+=<>?|`~!-]/g, ' ').replace(/\s+/g, ' ').trim();
  const ftsQuery = cleanQ
    .split(/\s+/)
    .filter(Boolean)
    .map(t => {
      const w = t.replace(/"/g, '');
      return w.length > 1 ? `"${w}"*` : `"${w}"`;
    })
    .join(' ');

  let total = 0;
  let cards = [];
  let usedFallback = false;
  let fallbackReason = null;

  try {
    const totalPs = db.prepare(
      `SELECT COUNT(*) AS c FROM cards_fts WHERE cards_fts MATCH ?`
    ).bind(ftsQuery);
    const listPs = db.prepare(
      `SELECT c.* FROM cards_fts f
       INNER JOIN cards c ON f.rowid = c.rowid
       WHERE cards_fts MATCH ?
       ORDER BY rank LIMIT ? OFFSET ?`
    ).bind(ftsQuery, size, offset);
    const [tRes, lRes] = await db.batch([totalPs, listPs]);
    total = tRes.results[0]?.c || 0;
    cards = lRes.results.map(_rowToCard);
  } catch (e) {
    fallbackReason = 'fts_syntax_error: ' + String(e?.message || e).slice(0, 120);
    total = 0; cards = [];
  }

  /* ================================================================
   * Phase 2: LIKE fallback (Exp 569997) when FTS returns 0 hits.
   * Searches across title + default_text with SQLite LIKE — slower
   * but guarantees "something exists" UX for short / exact phrases
   * that the Porter stemmer dropped or the unicode61 tokenizer split.
   * ================================================================ */
  if (total === 0) {
    usedFallback = true;
    if (!fallbackReason) fallbackReason = 'fts_zero_hits → LIKE fallback';
    const likeToken = `%${query.replace(/[%_]/g, '\\$&')}%`;
    try {
      const tCnt = await db.prepare(
        `SELECT COUNT(*) AS c FROM cards WHERE (title LIKE ? ESCAPE '\\') OR (default_text LIKE ? ESCAPE '\\') OR (tags LIKE ? ESCAPE '\\')`
      ).bind(likeToken, likeToken, likeToken).first();
      total = tCnt?.c || 0;
      if (total > 0) {
        const rows = await db.prepare(
          `SELECT * FROM cards WHERE (title LIKE ? ESCAPE '\\') OR (default_text LIKE ? ESCAPE '\\') OR (tags LIKE ? ESCAPE '\\')
           ORDER BY
             CASE WHEN title LIKE ? ESCAPE '\\' THEN 0 ELSE 1 END,
             created_at DESC
           LIMIT ? OFFSET ?`
        ).bind(likeToken, likeToken, likeToken, likeToken, size, offset).all();
        cards = (rows || []).map(_rowToCard);
      }
    } catch (e2) {
      fallbackReason += ' | like_error: ' + String(e2?.message || e2).slice(0, 120);
    }
  }

  const resp = json({
    ok: true,
    page, size, total,
    totalPages: Math.ceil(total / size),
    cards,
    ftsQuery: usedFallback ? ftsQuery : undefined,
    fallback: usedFallback ? { used: true, reason: fallbackReason } : undefined
  });
  return resp;
}

/**
 * D-1 schema patching: run ALTER TABLE ADD COLUMN for missing columns.
 * Triggered by admin-only POST /api/db/_migrate (same CARDS_BULK_API_TOKEN).
 * Columns are added one-by-one with try/catch so duplicate-column errors are
 * treated as idempotent OKs (SQLite <3.35 has no ADD COLUMN IF NOT EXISTS).
 */
async function handleDbMigrate(env, request) {
  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 500);
  let body = {};
  try { body = (await request.json()) || {}; } catch {}
  const dry = body?.dry_run === true;

  const before = await db.prepare("PRAGMA table_info(cards)").raw();
  const existingCols = new Set((before || []).map(r => r[1]));

  const ADD = [
    { sql: "ALTER TABLE cards ADD COLUMN pexels_id TEXT NOT NULL DEFAULT ''",             col: "pexels_id" },
    { sql: "ALTER TABLE cards ADD COLUMN emotional_tags TEXT NOT NULL DEFAULT '[]'",      col: "emotional_tags" },
    { sql: "ALTER TABLE cards ADD COLUMN envelope_style_id TEXT NOT NULL DEFAULT ''",     col: "envelope_style_id" },
    { sql: "ALTER TABLE cards ADD COLUMN geo_country_target TEXT NOT NULL DEFAULT '[]'",  col: "geo_country_target" },
  ];

  const applied = [];
  const skipped = [];
  const errors = [];

  for (const step of ADD) {
    if (existingCols.has(step.col)) { skipped.push({ col: step.col, reason: "already exists" }); continue; }
    if (dry) { applied.push({ col: step.col, dry: true }); continue; }
    try {
      await db.exec(step.sql);
      applied.push({ col: step.col, ok: true });
    } catch (e) {
      // Column may already exist: treat as idempotent OK
      const msg = (e?.message || String(e));
      if (/duplicate column name|already exists/i.test(msg)) {
        skipped.push({ col: step.col, reason: msg.slice(0, 120) });
      } else {
        errors.push({ col: step.col, error: msg.slice(0, 300) });
      }
    }
  }

  const afterCols = existingCols.size + applied.filter(a => !a.dry).length;
  const after = await db.prepare("PRAGMA table_info(cards)").raw();
  return json({
    ok: errors.length === 0,
    dry_run: dry,
    columns_before: (before || []).map(r => ({ name: r[1], type: r[2], notnull: r[3] === 1, dflt: r[4] })),
    columns_after:  (after  || []).map(r => ({ name: r[1], type: r[2], notnull: r[3] === 1, dflt: r[4] })),
    added: applied,
    skipped,
    errors,
    total_columns_after: after?.length ?? afterCols,
    note: "Required columns: slug,title,category,tags,style,bg_image,bg_image_watermark,default_text,default_font,default_color,default_filter,aspect_ratio,og_image,pexels_id,emotional_tags,envelope_style_id,geo_country_target,seo,created_at,updated_at = 20 total"
  });
}

/**
 * Rebuild FTS5 virtual table + 3 triggers after ALTER TABLE or corruption.
 * Admin-only POST /api/db/_rebuild_fts (same CARDS_BULK_API_TOKEN).
 * SQLITE_CORRUPT_VTAB on cards_fts? Run this. Drops old FTS/triggers,
 * recreates them exactly as schema.sql defines, then runs FTS 'rebuild'
 * command to backfill existing cards rows into the search index.
 */
async function handleDbRebuildFts(env, request) {
  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 500);
  let body = {};
  try { body = (await request.json()) || {}; } catch {}
  const dry = body?.dry_run === true;

  const stepResults = [];
  const errors = [];
  const tryRun = async (label, sql) => {
    if (dry) { stepResults.push({ label, dry: true }); return; }
    try { await db.prepare(sql).run(); stepResults.push({ label, ok: true }); }
    catch (e) {
      const msg = (e?.message || String(e)).slice(0, 300);
      if (/no such (table|trigger)/i.test(msg)) {
        stepResults.push({ label, skipped: true, reason: msg });
      } else {
        errors.push({ label, error: msg });
        stepResults.push({ label, error: msg });
      }
    }
  };

  await tryRun("drop_trigger_ai", "DROP TRIGGER IF EXISTS cards_ai");
  await tryRun("drop_trigger_ad", "DROP TRIGGER IF EXISTS cards_ad");
  await tryRun("drop_trigger_au", "DROP TRIGGER IF EXISTS cards_au");
  await tryRun("drop_fts_vtab",   "DROP TABLE IF EXISTS cards_fts");
  await tryRun("create_fts_vtab", `
    CREATE VIRTUAL TABLE IF NOT EXISTS cards_fts USING fts5(
      title,
      default_text,
      tags,
      category UNINDEXED,
      style UNINDEXED,
      slug UNINDEXED,
      content='cards',
      content_rowid='rowid',
      tokenize='porter unicode61 remove_diacritics 1'
    )
  `);
  await tryRun("create_trigger_ai", `
    CREATE TRIGGER IF NOT EXISTS cards_ai AFTER INSERT ON cards BEGIN
      INSERT INTO cards_fts(rowid, title, default_text, tags, category, style, slug)
      VALUES (new.rowid, new.title, new.default_text, new.tags, new.category, new.style, new.slug);
    END
  `);
  await tryRun("create_trigger_ad", `
    CREATE TRIGGER IF NOT EXISTS cards_ad AFTER DELETE ON cards BEGIN
      INSERT INTO cards_fts(cards_fts, rowid, title, default_text, tags, category, style, slug)
      VALUES ('delete', old.rowid, old.title, old.default_text, old.tags, old.category, old.style, old.slug);
    END
  `);
  await tryRun("create_trigger_au", `
    CREATE TRIGGER IF NOT EXISTS cards_au AFTER UPDATE ON cards BEGIN
      INSERT INTO cards_fts(cards_fts, rowid, title, default_text, tags, category, style, slug)
      VALUES ('delete', old.rowid, old.title, old.default_text, old.tags, old.category, old.style, old.slug);
      INSERT INTO cards_fts(rowid, title, default_text, tags, category, style, slug)
      VALUES (new.rowid, new.title, new.default_text, new.tags, new.category, new.style, new.slug);
    END
  `);
  // Backfill all existing rows into the FTS index (critical!)
  await tryRun("fts_rebuild_backfill", "INSERT INTO cards_fts(cards_fts) VALUES('rebuild')");

  const stats = { total: 0, ftsRows: 0 };
  try {
    const totalRow = await db.prepare("SELECT COUNT(*) AS c FROM cards").raw();
    stats.total = totalRow?.[0]?.[0] || 0;
    const ftsRow = await db.prepare("SELECT COUNT(*) AS c FROM cards_fts").raw();
    stats.ftsRows = ftsRow?.[0]?.[0] || 0;
  } catch (e) {
    errors.push({ label: "stats", error: String(e).slice(0, 300) });
  }

  return json({
    ok: errors.length === 0,
    dry_run: dry,
    steps: stepResults,
    errors,
    stats,
    note: "FTS5 + 3 triggers rebuilt. stats.ftsRows should === stats.total after rebuild backfill."
  });
}

async function handleBulkUpsert(request, env) {
  const db = env.DB;
  if (!db) return json({ error: 'DB not bound' }, 500);
  await loadCategoryIndexFromR2(env);
  const body = await request.json();
  const cards = Array.isArray(body?.cards) ? body.cards : [];
  if (!cards.length) return json({ ok: true, inserted: 0, updated: 0, skipped: 0, total: 0 });

  const upsertSql = `
    INSERT INTO cards (
      slug, pexels_id, title, category, tags, style, bg_image, bg_image_watermark,
      default_text, default_font, default_color, default_filter,
      aspect_ratio, og_image, emotional_tags, envelope_style_id, geo_country_target,
      seo, created_at, updated_at
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, unixepoch(), unixepoch())
    ON CONFLICT(slug) DO UPDATE SET
      pexels_id           = excluded.pexels_id,
      title               = excluded.title,
      category            = excluded.category,
      tags                = excluded.tags,
      style               = excluded.style,
      bg_image            = excluded.bg_image,
      bg_image_watermark  = excluded.bg_image_watermark,
      default_text        = excluded.default_text,
      default_font        = excluded.default_font,
      default_color       = excluded.default_color,
      default_filter      = excluded.default_filter,
      aspect_ratio        = excluded.aspect_ratio,
      og_image            = excluded.og_image,
      emotional_tags      = excluded.emotional_tags,
      envelope_style_id   = excluded.envelope_style_id,
      geo_country_target  = excluded.geo_country_target,
      seo                 = excluded.seo,
      updated_at          = unixepoch()
  `;
  const stmt = db.prepare(upsertSql);
  const batch = [];
  for (const c of cards) {
    if (!c?.slug || !c.title || !c.category || !c.bgImage) continue;
    const pexelsId = c.pexels_id || c.pexelsId || parsePexelsIdFromSlug(c.slug) || '';
    batch.push(stmt.bind(
      c.slug,
      pexelsId,
      c.title,
      c.category,
      JSON.stringify(c.tags || []),
      c.style || null,
      c.bgImage,
      c.bgImageWatermark || c.bgImage,
      c.defaultText || c.default_text || '',
      c.defaultFont || c.default_font || "'Inter', sans-serif",
      c.defaultColor || c.default_color || '#1a1a1a',
      c.defaultFilter || c.default_filter || null,
      c.aspectRatio || c.aspect_ratio || '3/4',
      c.ogImage || c.og_image || null,
      JSON.stringify(c.emotionalTags || c.emotional_tags || []),
      c.envelopeStyleId || c.envelope_style_id || '',
      JSON.stringify(c.geoCountryTarget || c.geo_country_target || []),
      JSON.stringify(c.seo || {})
    ));
  }
  const results = batch.length ? await db.batch(batch) : [];
  const upserted = results.reduce((acc, r) => acc + (r.meta?.changes || 0), 0);
  return json({
    ok: true,
    requested: cards.length,
    valid: batch.length,
    upserted,
    inserted: 0,
    updated: 0,
    note: 'upserted = number of rows written (INSERT or UPDATE); created_at preserved on conflict. Re-run is idempotent.',
  });
}

/* ============================================================
 * C: Pre-wired Roadmap Slots (Doc §12.5, §12.7, §13.5)
 * ------------------------------------------------------------
 * Keep a twin copy in worker/src/interfaces.js as the single
 * canonical JSDoc source-of-truth.  This inline block is what
 * actually runs on the Worker (service-worker format has no
 * ESM import support).
 * ============================================================ */
const SAF_SLOTS = Object.freeze({
  async Phase2UploadClip(videoBlob, meta = {}) {
    void videoBlob; void meta;
    return { localKey: null, phase: 2, status: "reserved" };
  },
  async Phase3AnimateFace(photo, motionType = "blink-smile") {
    void photo; void motionType;
    return { frames: null, fps: 12, phase: 3, status: "reserved" };
  },
  GeoCompliancePopup(countryCode, opts = {}) {
    /* Doc §221 — Per-region cookie + data consent dialogs.
     * Returns:
     *   - enabled: true → front-end MUST render the popup (respect user choice)
     *   - region:  GDPR-EU | CCPA-US | LGPD-BR | PIPEDA-CA | GLOBAL (minimal)
     *   - html:    i18n-ready copy keys; front-end renders via its own i18n.
     *   - requiredCategories: which consent buckets the user must tick.
     * Pure function, zero side effects.
     */
    const cc = (countryCode || "").toUpperCase();
    const region = _complianceRegionFromCountry(cc);
    let enabled = false;
    let titleKey = "consent.title_global";
    let bodyKey  = "consent.body_global";
    let buckets = ["essential"];

    if (region === "GDPR-EU") {
      enabled = true;
      titleKey = "consent.title_gdpr";
      bodyKey  = "consent.body_gdpr";
      buckets = ["essential", "analytics", "marketing"];
    } else if (region === "CCPA-US") {
      enabled = true;
      titleKey = "consent.title_ccpa";
      bodyKey  = "consent.body_ccpa";
      buckets = ["essential", "analytics", "marketing", "sale_opt_out"];
    } else if (region === "LGPD-BR") {
      enabled = true;
      titleKey = "consent.title_lgpd";
      bodyKey  = "consent.body_lgpd";
      buckets = ["essential", "analytics", "marketing"];
    } else if (region === "PIPEDA-CA") {
      enabled = true;
      titleKey = "consent.title_pipeda";
      bodyKey  = "consent.body_pipeda";
      buckets = ["essential", "analytics", "marketing"];
    } else {
      enabled = opts?.alwaysShow === true;
      buckets = ["essential"];
    }

    const currency = _currencyFromCountry(cc);
    return {
      enabled,
      region,
      currency,
      phase: 1.5,
      status: "active",
      i18n: { titleKey, bodyKey },
      requiredCategories: buckets,
      policyLinks: [
        { key: "privacy", href: "/privacy" },
        { key: "terms",   href: "/terms"   },
        { key: "cookies", href: "/cookies" }
      ]
    };
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
    const m = now.getUTCMonth() + 1;
    const d = now.getUTCDate();

    const CAT_PROXIMITY = [
      { cat: "christmas",   m: 12, d: 25 },
      { cat: "new-year",    m: 1,  d: 1  },
      { cat: "valentine",   m: 2,  d: 14 },
      { cat: "easter",      m: 4,  d: 9  },
      { cat: "halloween",   m: 10, d: 31 },
      { cat: "thanksgiving",m: 11, d: 23 },
      { cat: "mothers-day", m: 5,  d: 12 },
      { cat: "fathers-day", m: 6,  d: 16 },
      { cat: "wedding",     m: 6,  d: 15 },
      { cat: "graduation",  m: 5,  d: 25 },
    ];

    function daysUntil(targetM, targetD) {
      const y = now.getUTCFullYear();
      const a = Date.UTC(y, targetM - 1, targetD);
      let diff = Math.round((a - Date.UTC(y, now.getUTCMonth(), now.getUTCDate())) / 86400000);
      if (diff < 0) diff += 365;
      return diff;
    }

    const cc = countryCode && /^[A-Z]{2}$/.test(countryCode) ? countryCode : null;
    void topN;

    for (let i = 0; i < arr.length; i++) {
      const c = arr[i] || {};
      let score = 0;
      const origIdx = i;
      if (cc && Array.isArray(c.geoCountryTarget) && c.geoCountryTarget.indexOf(cc) !== -1) score += 200;
      for (let j = 0; j < CAT_PROXIMITY.length; j++) {
        if (CAT_PROXIMITY[j].cat === c.category) {
          const dd = daysUntil(CAT_PROXIMITY[j].m, CAT_PROXIMITY[j].d);
          if (dd <= 90) { score += Math.max(0, 90 - dd); break; }
        }
      }
      if (cc === "FR") {
        const b = daysUntil(7, 14); if (b <= 21) score += Math.max(0, 80 - b);
      } else if (cc === "MX") {
        const m_ = daysUntil(11, 1); if (m_ <= 14) score += Math.max(0, 85 - m_);
      } else if (cc === "BR") {
        const c_ = daysUntil(2, 17); if (c_ <= 14) score += Math.max(0, 85 - c_);
      } else if (cc === "IE" || cc === "GB") {
        const x = daysUntil(12, 26); if (x <= 21) score += Math.max(0, 80 - x);
      }
      arr[i] = { card: c, score, origIdx };
    }
    arr.sort((a, b) => (b.score - a.score) || (a.origIdx - b.origIdx));
    return arr.map(it => it.card);
  }
});
self.SAF_SLOTS = SAF_SLOTS;
