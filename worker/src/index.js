/**
 * SendAFun.com - Cloudflare Worker
 * POST /api/create-session  Creem checkout session (v2: /v1/checkouts + product_id)
 * POST /api/webhook         Creem webhook
 * GET  /api/check-member    Check user permission (user_token cookie)
 * POST /api/lookup-user     Email lookup (no registration)
 * POST /api/send-card       Send card via Resend
 * GET  /api/view-card       View card HTML page
 * POST /api/gift-free-card  Gift a free card
 * GET  /api/redeem-gift     Redeem gifted free card
 * POST /api/set-reminder    Birthday reminder (KV + Cron)
 * GET  /view/:token         Card view page
 * Pricing: $1.99/single | $6.99/monthly | $69/yearly (annual)
 * Creem API: test-api.creem.io (test) | api.creem.io (prod), endpoint: /v1/checkouts
 * Cron: check reminders every 6h
 */class RateLimiter {
  constructor(kv){this.kv=kv}
  async check(k){
    const n=Date.now(),ws=Math.floor(n/6e4)*6e4;
    const wk="rl:"+k+":"+ws;
    const r=await this.kv.get(wk,"text");
    let c=r?parseInt(r,10):0;
    if(c>=5)return{allowed:false,retryAfter:ws+6e4-n};
    const t=Math.ceil((ws+6e4-n)/1e3)+10;
    await this.kv.put(wk,String(++c),{expirationTtl:t});
    return{allowed:true,retryAfter:0}
  }
}

// Creem API: test mode uses test-api.creem.io, prod uses api.creem.io
// Endpoint: POST /v1/checkouts (NOT /v1/checkout/sessions)
// Auth: x-api-key header
// Uses product_id directly (no separate price_id concept)
var CREEM_API_KEY,CREEM_WEBHOOK_SECRET,SITE_URL,RESEND_API_KEY,RESEND_FROM_EMAIL;
var CREEM_BASE; // set in fetch() based on env

// Product IDs from Creem dashboard (products-config.json)
const CREEM_PRODUCTS = {
  single:   "prod_7GGx4Gh5yvKLOb0OCzYFoq",  // $1.99 按次发送 (one-time)
  monthly:  "prod_3xVdtK0wdzqLlaCz4H7lzQ",  // $6.99 月订阅 (monthly recurring)
  annual:   "prod_73aCoww3uhNMevKi8NVwNv"   // $69 年付 (yearly recurring)
};

// Plan → TTL seconds for permission grant
const PLAN_TTL = { single: 86400, monthly: 2592000, annual: 31536000 };

async function createCreemSession(productId,email,succUrl,meta){
  const body={
    product_id: productId,
    success_url: succUrl,
    customer: { email: email },
    metadata: meta||{}
  };
  const r=await fetch(CREEM_BASE+"/v1/checkouts",{
    method:"POST",
    headers:{"Content-Type":"application/json","x-api-key":CREEM_API_KEY},
    body:JSON.stringify(body)
  });
  if(!r.ok){
    const errText=await r.text();
    console.error("Creem API error:",r.status,errText);
    throw new Error("Creem "+r.status+": "+errText);
  }
  const data=await r.json();
  // Creem returns: { id, checkout_url, product_id, status, mode }
  return{ id:data.id, url:data.checkout_url, status:data.status };
}

async function verifyWebhookSignature(body,sigHdr){
  if(!CREEM_WEBHOOK_SECRET||!sigHdr)return false;
  try{
    const enc=new TextEncoder(),k=await crypto.subtle.importKey("raw",enc.encode(CREEM_WEBHOOK_SECRET),{name:"HMAC",hash:"SHA-256"},false,["verify"]);
    const p=sigHdr.split(",").reduce((a,x)=>{const[k,...v]=x.trim().split("=");a[k]=v.join("=");return a},{});
    const v=await crypto.subtle.verify("HMAC",k,hexToBytes(p.v1||""),enc.encode(p.t+"."+body));
    return v&&Math.abs(Math.floor(Date.now()/1e3)-parseInt(p.t,10))<=300;
  }catch(e){return false}
}
function hexToBytes(h){
  const b=new Uint8Array(h.length/2);
  for(let i=0;i<h.length;i+=2)b[i/2]=parseInt(h.substring(i,i+2),16);
  return b;
}

const PP="perm:";
async function grantPermission(kv,email,plan){
  const k=PP+email.toLowerCase();
  const ttlSec=PLAN_TTL[plan]||86400;
  const exp=Date.now()+ttlSec*1000;
  const userToken=crypto.randomUUID();
  const v=JSON.stringify({email:email.toLowerCase(),plan,grantedAt:Date.now(),expiresAt:exp,active:true,userToken:userToken});
  await kv.put(k,v,{expirationTtl:ttlSec});
  // Also store reverse lookup: token → email
  await kv.put("usertoken:"+userToken,email.toLowerCase(),{expirationTtl:ttlSec});
  return{expiresAt:exp,userToken};
}

async function getPermission(kv,email){
  const r=await kv.get(PP+email.toLowerCase(),"text");
  if(!r)return null;
  const d=JSON.parse(r);
  if(d.expiresAt&&Date.now()>d.expiresAt){await kv.delete(PP+email.toLowerCase());return null}
  return d;
}

async function sendResend(o){
  const r=await fetch("https://api.resend.com/emails",{
    method:"POST",
    headers:{"Authorization":"Bearer "+RESEND_API_KEY,"Content-Type":"application/json"},
    body:JSON.stringify({
      from:RESEND_FROM_EMAIL||"onboard@resend.dev",
      to:[o.to],
      subject:o.subject,
      html:o.html,
      reply_to:o.fromEmail||undefined
    })});
  if(!r.ok)throw new Error("Resend "+r.status+": "+(await r.text()));
  return await r.json();
}

function esc(s){return String(s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;").replace(/"/g,"&quot;")}
function renderCardHtml(card){
  const bg=card.backgroundColor||"#fdf6e3",ac=card.accentColor||"#e17055";
  const em=esc(card.message||"Sending you a little smile today!"),ef=esc(card.fromName||"Someone"),et=esc(card.toName||"You");
  const img=card.imageUrl?'<img class="ci" src="'+esc(card.imageUrl)+'" alt="" loading="lazy">':"";
  const stk=card.sticker?'<div class="sk">'+esc(card.sticker)+"</div>":"";
  const ru=SITE_URL+"/send?replyTo="+encodeURIComponent(card.fromEmail||"");
  return [
    '<!DOCTYPE html><html lang="en"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width,initial-scale=1">',
    '<title>Card from '+ef+' &mdash; SendAFun</title>',
    '<style>*{box-sizing:border-box;margin:0;padding:0}body{font-family:\'Inter\',sans-serif;background:#1a1a2e;min-height:100vh;display:flex;align-items:center;justify-content:center;padding:20px}.w{max-width:520px;width:100%}.e{background:linear-gradient(145deg,#232342,#1a1a2e);border-radius:24px;padding:40px 32px;box-shadow:0 20px 60px #00000080,0 0 0 1px #ffffff0f;position:relative;overflow:hidden}.e::before{content:\'\';position:absolute;top:-50%;left:-50%;width:200%;height:200%;background:radial-gradient(circle at 50% 0%,'+ac+'15 0%,transparent 50%);pointer-events:none}.hd{text-align:center;margin-bottom:32px}.lb{font-family:\'DM Serif Display\',serif;font-size:14px;color:#ffffff66;letter-spacing:3px;text-transform:uppercase;margin-bottom:8px}.tn{font-family:\'DM Serif Display\',serif;font-size:32px;color:#fff;line-height:1.2}.sk{display:block;margin:16px auto 0;font-size:48px;text-align:center}.bd{background:'+bg+';border-radius:16px;padding:32px 28px;margin-bottom:28px}.msg{font-family:\'DM Serif Display\',serif;font-size:18px;line-height:1.7;color:#2d3436;white-space:pre-wrap}.ci{width:100%;border-radius:12px;margin-bottom:20px;max-height:300px;object-fit:cover}.fr{font-family:\'DM Serif Display\',serif;font-style:italic;font-size:16px;color:#636e72;text-align:right;margin-top:24px}.ac{display:flex;flex-direction:column;gap:12px}.btn{display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:14px 24px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;transition:all .2s;cursor:pointer;border:none;font-family:\'Inter\',sans-serif}.pr{background:'+ac+';color:#fff}.pr:hover{background:'+ac+'dd;transform:translateY(-1px);box-shadow:0 4px 12px '+ac+'40}.se{background:#ffffff14;color:#ffffffcc;border:1px solid #ffffff1f}.se:hover{background:#ffffff1f;color:#fff}.fw{width:100%}.ft{text-align:center;margin-top:20px;font-size:12px;color:#ffffff40}.ft a{color:#ffffff66;text-decoration:none}@media(max-width:480px){.e{padding:24px 16px}.tn{font-size:26px}.bd{padding:24px 16px}.msg{font-size:16px}}</style></head><body>',
    '<div class="w"><div class="e"><div class="hd"><div class="lb">To</div><div class="tn">'+et+'</div>'+stk+'</div>',
    '<div class="bd">'+img+'<div class="msg">'+em+'</div><div class="fr">&mdash; '+ef+'</div></div>',
    '<div class="ac"><a href="'+esc(ru)+'" class="btn pr fw">&#x1F4AC; Reply with a Card</a>',
    '<a href="'+esc(SITE_URL)+'" class="btn se fw">&#x2728; Send Your Own Card</a></div>',
    '<div class="ft">Made with &#x2764; by <a href="'+esc(SITE_URL)+'">SendAFun</a></div></div></div></body></html>',
  ].join("");
}

function genToken(){const b=new Uint8Array(32);crypto.getRandomValues(b);return Array.from(b).map(x=>x.toString(36).padStart(2,"0")).join("")}
function json(d,s){s=s||200;return new Response(JSON.stringify(d),{status:s,headers:{"Content-Type":"application/json","Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-Signature,X-Webhook-Signature"}})}
function html(c,s){s=s||200;return new Response(c,{status:s,headers:{"Content-Type":"text/html; charset=utf-8","Access-Control-Allow-Origin":"*"}})}
function err(m,s){s=s||400;return json({error:m},s)}

// Environment variables set per-request in fetch()
var ORIGINALS_BUCKET; // R2 bucket binding for original images

export default{
  async fetch(request,env){
    CREEM_API_KEY=env.CREEM_API_KEY;CREEM_WEBHOOK_SECRET=env.CREEM_WEBHOOK_SECRET;SITE_URL=env.SITE_URL||"https://sendafun.com";RESEND_API_KEY=env.RESEND_API_KEY;RESEND_FROM_EMAIL=env.RESEND_FROM_EMAIL||"onboard@resend.dev";
    ORIGINALS_BUCKET=env.ORIGINALS_BUCKET||null;
    // Creem: test mode API host differs from production
    CREEM_BASE=(CREEM_API_KEY&&CREEM_API_KEY.startsWith("creem_test_"))?"https://test-api.creem.io":"https://api.creem.io";
    var kv=env.CARD_PERMISSIONS,rl=new RateLimiter(kv),url=new URL(request.url),path=url.pathname,m=request.method;
    if(m==="OPTIONS")return new Response(null,{headers:{"Access-Control-Allow-Origin":"*","Access-Control-Allow-Methods":"GET,POST,OPTIONS","Access-Control-Allow-Headers":"Content-Type,X-Signature,X-Webhook-Signature","Access-Control-Max-Age":"86400"}});
    if(path==="/__cron/check-reminders"&&m==="POST")return handleCronReminders(kv);
    var vm=path.match(/^\/view\/([a-zA-Z0-9_-]+)$/);
    if(vm&&m==="GET")return handleViewCard(kv,vm[1]);
    switch(path){
      case"/api/create-session":return handleCreateSession(request,kv,rl);
      case"/api/webhook":return handleWebhook(request,kv);
      case"/api/check-member":return handleCheckMember(request,kv);
      case"/api/lookup-user":return handleLookupUser(request,kv,rl);
      case"/api/send-card":return handleSendCard(request,kv,rl);
      case"/api/view-card":return handleViewCard(kv,url.searchParams.get("token"));
      case"/api/gift-free-card":return handleGiftFreeCard(request,kv,rl);
      case"/api/redeem-gift":return handleRedeemGift(request,kv);
      case"/api/set-reminder":return handleSetReminder(request,kv,rl);
      case"/api/download":return handleDownload(request,kv,rl);
      default:return err("Not found",404);
    }
  }
};

async function handleCreateSession(request,kv,rl){
  var ip=request.headers.get("CF-Connecting-IP")||"unknown";
  try{
    var b=await request.json();
    if(!b.email||!b.plan)return err("email and plan required");
    if(!Object.keys(CREEM_PRODUCTS).includes(b.plan))return err("plan must be single, monthly, or annual");
    var ic=await rl.check("cs:"+ip);
    if(!ic.allowed)return json({error:"Too many requests",retryAfter:ic.retryAfter},429);
    var ec=await rl.check("cs:"+b.email);
    if(!ec.allowed)return json({error:"Too many requests",retryAfter:ec.retryAfter},429);
    var productId=CREEM_PRODUCTS[b.plan];
    // Store session in KV for webhook correlation + payment verification
    var sessId="sess_"+Date.now()+"_"+Math.random().toString(36).slice(2,8);
    await kv.put("session:"+sessId,JSON.stringify({email:b.email.toLowerCase(),plan:b.plan,cardSlug:b.cardSlug||null,delivery:b.delivery||"email",createdAt:Date.now()}),{expirationTtl:900});
    var s=await createCreemSession(productId,b.email,
      SITE_URL+"/payment-success?session_id="+sessId+"&checkout_id={CHECKOUT_SESSION_ID}",
      {plan:b.plan,email:b.email.toLowerCase(),cardSlug:b.cardSlug||"",sessionId:sessId}
    );
    return json({url:s.url,sessionId:sessId,status:s.status});
  }catch(e){console.error("cs:",e);return err(e.message||"Failed",500)}
}

async function handleWebhook(request,kv){
  var sig=request.headers.get("X-Webhook-Signature")||request.headers.get("x-webhook-signature");
  var body=await request.text();
  if(!sig||!CREEM_WEBHOOK_SECRET)return err("Missing signature",401);
  if(!(await verifyWebhookSignature(body,sig)))return err("Invalid signature",401);
  try{var ev=JSON.parse(body)}catch(e){return err("Invalid JSON",400)}
  console.log("webhook event:",ev.type||"unknown");
  // Creem sends checkout.completed after successful payment
  if(ev.type==="checkout.completed"||ev.type==="checkout.session.completed"){
    var s=ev.data||ev.object||{};
    // Extract email from: customer_email, customer.email, or metadata
    var email=s.customer_email||(s.customer&&s.customer.email)||(s.metadata&&s.metadata.email);
    var plan=(s.metadata&&s.metadata.plan)||"single";
    var productId=(s.product_id||(s.product&&s.product.id))||"";
    console.log("payment:",{email,plan,productId});
    if(email){
      var result=await grantPermission(kv,email,plan);
      console.log("permission granted:",{email,plan,expiresAt:result.expiresAt});
      // If session ID in metadata, mark it as completed
      var sessId=s.metadata&&(s.metadata.sessionId||s.metadata.request_id);
      if(sessId){
        var sessData=await kv.get("session:"+sessId,"text");
        if(sessData){
          var sd=JSON.parse(sessData);
          sd.completed=true;sd.completedAt=Date.now();sd.checkoutId=s.id;
          await kv.put("session:"+sessId,JSON.stringify(sd),{expirationTtl:900});
        }
      }
    }
  }
  // Always return 200 to prevent Creem retrying (never leak errors)
  return json({received:true});
}

async function handleCheckMember(request,kv){
  // Use user_token from HttpOnly cookie (not email query param - security)
  var cookieHdr=request.headers.get("cookie")||"";
  var tokenMatch=cookieHdr.match(/user_token=([^;]+)/);
  if(!tokenMatch){
    // Fallback: allow email param for initial check after payment
    var email=new URL(request.url).searchParams.get("email");
    if(!email)return json({isMember:false,plan:null,expiresAt:null});
    var p=await getPermission(kv,email);
    if(!p||!p.active)return json({isMember:false,plan:null,expiresAt:null});
    return json({isMember:true,plan:p.plan,expiresAt:p.expiresAt,daysLeft:Math.max(0,Math.ceil((p.expiresAt-Date.now())/864e5)),userToken:p.userToken||null});
  }
  // Primary path: look up by user_token
  var token=tokenMatch[1];
  var email=await kv.get("usertoken:"+token,"text");
  if(!email)return json({isMember:false,plan:null,expiresAt:null});
  var p=await getPermission(kv,email);
  if(!p||!p.active)return json({isMember:false,plan:null,expiresAt:null});
  return json({isMember:true,plan:p.plan,expiresAt:p.expiresAt,daysLeft:Math.max(0,Math.ceil((p.expiresAt-Date.now())/864e5))});
}

async function handleLookupUser(request,kv,rl){
  var ip=request.headers.get("CF-Connecting-IP")||"unknown";
  try{
    var b=await request.json();
    if(!b.email)return err("email required");
    var ic=await rl.check("lu:"+ip);
    if(!ic.allowed)return json({error:"Too many requests"},429);
    var ec=await rl.check("lu:"+b.email);
    if(!ec.allowed)return json({error:"Too many requests"},429);
    var p=await getPermission(kv,b.email);
    var em=b.email.toLowerCase();
    var gh=JSON.parse((await kv.get("gift:history:"+em,"text"))||"[]");
    var cs=parseInt((await kv.get("cards:sent:"+em,"text"))||"0",10);
    return json({email:em,isMember:!!(p&&p.active),memberPlan:p?p.plan:null,memberExpiresAt:p?p.expiresAt:null,cardsSent:cs,giftsSent:gh.length});
  }catch(e){console.error("lu:",e);return err("Failed",500)}
}

async function handleSendCard(request,kv,rl){
  var ip=request.headers.get("CF-Connecting-IP")||"unknown";
  try{
    var b=await request.json();
    if(!b.fromEmail||!b.toEmail)return err("fromEmail and toEmail required");
    var ic=await rl.check("sc:"+ip);
    if(!ic.allowed)return json({error:"Too many requests"},429);
    var ec=await rl.check("sc:"+b.fromEmail);
    if(!ec.allowed)return json({error:"Too many requests"},429);
    var p=await getPermission(kv,b.fromEmail);
    var fcr=await kv.get("freecard:"+b.fromEmail.toLowerCase(),"text");
    var fc=fcr?JSON.parse(fcr):null;
    if(!p&&(!fc||fc.remaining<=0))return err("No active membership or free card credits",402);
    var token=genToken();
    var cd={fromName:b.fromName||"Someone",fromEmail:b.fromEmail.toLowerCase(),toName:b.toName||"Friend",toEmail:b.toEmail.toLowerCase(),message:b.message||"",imageUrl:b.imageUrl||"",backgroundColor:b.backgroundColor||"#fdf6e3",accentColor:b.accentColor||"#e17055",sticker:b.sticker||"",sentAt:Date.now(),token:token};
    await kv.put("card:"+token,JSON.stringify(cd),{expirationTtl:864e4});
    if(fc&&fc.remaining>0){
      fc.remaining--;
      if(fc.remaining<=0)await kv.delete("freecard:"+b.fromEmail.toLowerCase());
      else await kv.put("freecard:"+b.fromEmail.toLowerCase(),JSON.stringify(fc),{expirationTtl:fc.ttl||864e5*365});
    }
    var ck="cards:sent:"+b.fromEmail.toLowerCase();
    var pv=await kv.get(ck,"text");
    await kv.put(ck,String((pv?parseInt(pv,10):0)+1),{expirationTtl:864e5*365});
    var vu=SITE_URL+"/view/"+token,ef=esc(b.fromName||"Someone"),em=b.message?"<p style=\"color:#2d3436;font-style:italic;padding:16px;background:#f8f9fa;border-radius:8px\">\u201C"+esc(b.message)+"\u201D</p>":"";
    var su="\u{1F48C} "+(b.fromName||"Someone")+" sent you a card!";
    var e=["<!DOCTYPE html>","<html><head><meta charset=\"utf-8\"><style>",
      "body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f5f5f5}",
      ".ct{max-width:560px;margin:0 auto;padding:32px 20px}",
      ".ic{background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 2px 8px #0000000f}",
      "h2{color:#1a1a2e;font-size:24px}p{color:#636e72;font-size:16px}",
      ".btn{display:inline-block;background:#e17055;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;margin-top:24px}",
      ".ft{font-size:12px;color:#b2bec3;text-align:center;margin-top:24px}",
      "</style></head><body>",
      "<div class=\"ct\"><div class=\"ic\">",
      "<p style=\"font-size:32px;margin:0\">&#x2728;</p>",
      "<h2>You&#x2019;ve got a card!</h2>",
      "<p><strong>"+ef+"</strong> sent you a card on SendAFun.</p>",
      em,
      "<a href=\""+esc(vu)+"\" class=\"btn\">&#x1F4AC; View Your Card</a>",
      "<p style=\"margin-top:12px;font-size:14px\">Click to see the full card and reply!</p>",
      "</div><div class=\"ft\">Powered by <a href=\""+esc(SITE_URL)+"\" style=\"color:#e17055;text-decoration:none\">SendAFun.com</a></div></div>",
      "</body></html>"].join("");
    await sendResend({to:b.toEmail,toName:b.toName,subject:su,html:e,fromName:"SendAFun Cards",fromEmail:"cards@sendafun.com"});
    return json({success:true,token:token,viewUrl:vu});
  }catch(e){console.error("sc:",e);return err(e.message||"Failed",500)}
}

async function handleViewCard(kv,token){
  if(!token)return html("<h1>Missing token</h1>",400);
  var r=await kv.get("card:"+token,"text");
  if(!r){
    var n=["<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\">",
      "<title>Not Found &mdash; SendAFun</title>",
      "<style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;color:#fff;text-align:center;padding:20px}h1{font-size:28px}p{color:#ffffff99}a{color:#e17055}</style>",
      "</head><body><div><h1>Card Not Found &#x1F615;</h1><p>This card may have expired.</p><p><a href=\""+esc(SITE_URL)+"\">Send a card on SendAFun</a></p></div></body></html>"];
    return html(n.join(""),404);
  }
  return html(renderCardHtml(JSON.parse(r)));
}

async function handleGiftFreeCard(request,kv,rl){
  var ip=request.headers.get("CF-Connecting-IP")||"unknown";
  try{
    var b=await request.json();
    if(!b.fromEmail||!b.toEmail)return err("fromEmail and toEmail required");
    var ic=await rl.check("gfc:"+ip);
    if(!ic.allowed)return json({error:"Too many requests"},429);
    var ec=await rl.check("gfc:"+b.fromEmail);
    if(!ec.allowed)return json({error:"Too many requests"},429);
    if(!(await getPermission(kv,b.fromEmail)))return err("Only members can gift free cards",402);
    var gt="gift_"+genToken();
    await kv.put("gift:"+gt,JSON.stringify({fromEmail:b.fromEmail.toLowerCase(),toEmail:b.toEmail.toLowerCase(),toName:b.toName||"Friend",message:b.message||"",createdAt:Date.now(),redeemed:false,token:gt}),{expirationTtl:864e5*7});
    var hk="gift:history:"+b.fromEmail.toLowerCase();
    var h=JSON.parse((await kv.get(hk,"text"))||"[]");
    h.push({toEmail:b.toEmail.toLowerCase(),toName:b.toName,token:gt,sentAt:Date.now()});
    await kv.put(hk,JSON.stringify(h),{expirationTtl:864e5*365});
    var ru=SITE_URL+"/api/redeem-gift?token="+gt+"&email="+encodeURIComponent(b.toEmail);
    var gs=String.fromCodePoint(127873)+" "+(b.fromName||"Someone")+" sent you a free card!";
    var gh=["<!DOCTYPE html>","<html><head><meta charset=\"utf-8\"><style>",
      "body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f5f5f5}",
      ".ct{max-width:560px;margin:0 auto;padding:32px 20px}.ic{background:#fff;border-radius:16px;padding:32px;text-align:center}",
      "h2{color:#1a1a2e;font-size:24px}.btn{display:inline-block;background:#e17055;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;margin-top:24px}",
      "</style></head><body><div class=\"ct\"><div class=\"ic\"><h2>You received a free card! &#x1F381;</h2>",
      "<p>Redeem it and send a card to anyone you like.</p>",
      "<a href=\""+esc(ru)+"\" class=\"btn\">&#x1F3C0; Redeem Your Free Card</a></div></div></body></html>"].join("");
    await sendResend({to:b.toEmail,toName:b.toName,subject:gs,html:gh,fromName:"SendAFun Cards",fromEmail:"cards@sendafun.com"});
    return json({success:true,giftToken:gt,redeemUrl:ru});
  }catch(e){console.error("gfc:",e);return err(e.message||"Failed",500)}
}

async function handleRedeemGift(request,kv){
  var url=new URL(request.url),token=url.searchParams.get("token"),email=url.searchParams.get("email");
  if(!token||!email)return err("token and email required");
  var r=await kv.get("gift:"+token,"text");
  if(!r)return html("<!DOCTYPE html><html><head><title>Invalid Gift</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;color:#fff}h1{color:#fff}a{color:#e17055}</style></head><body><div><h1>Invalid or Expired Gift</h1><p><a href=\""+esc(SITE_URL)+"\">SendAFun</a></p></div></body></html>",404);
  var g=JSON.parse(r);
  if(g.redeemed)return html("<h1>Already Redeemed</h1><p>This gift has already been claimed.</p>",400);
  if(g.toEmail.toLowerCase()!==email.toLowerCase())return html("<h1>Not For You</h1>",403);
  g.redeemed=true;
  await kv.put("gift:"+token,JSON.stringify(g),{expirationTtl:864e5*7});
  await kv.put("freecard:"+email.toLowerCase(),JSON.stringify({email:email.toLowerCase(),remaining:1,ttl:864e5*365}),{expirationTtl:864e5*365});
  return html("<!DOCTYPE html><html><head><meta charset=\"utf-8\"><meta name=\"viewport\" content=\"width=device-width,initial-scale=1\"><title>Free Card Redeemed!</title><style>body{font-family:-apple-system,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;background:#1a1a2e;color:#fff;text-align:center;padding:20px}h1{font-size:32px;margin-bottom:8px}p{color:#ffffff99;font-size:18px}.btn{display:inline-block;background:#e17055;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;margin-top:24px}</style></head><body><div><h1>&#x1F3C0; Free Card Redeemed!</h1><p>You now have 1 free card to send!</p><a href=\""+esc(SITE_URL)+"\" class=\"btn\">Start Sending &rarr;</a></div></body></html>");
}

async function handleSetReminder(request,kv,rl){
  var ip=request.headers.get("CF-Connecting-IP")||"unknown";
  try{
    var b=await request.json();
    if(!b.email||!b.date)return err("email and date required");
    var ic=await rl.check("rem:"+ip);
    if(!ic.allowed)return json({error:"Too many requests"},429);
    var ec=await rl.check("rem:"+b.email);
    if(!ec.allowed)return json({error:"Too many requests"},429);
    await kv.put("rem:"+b.email+":"+b.date,JSON.stringify({email:b.email.toLowerCase(),date:b.date,name:b.name||"",message:b.message||"",createdAt:Date.now()}),{expirationTtl:864e5*365});
    return json({success:true,message:"Reminder set for "+b.date});
  }catch(e){console.error("rem:",e);return err(e.message||"Failed",500)}
}

async function handleCronReminders(kv){
  try{
    var n=new Date(),td=n.toISOString().slice(0,10);
    var t=new Date(n);t.setDate(t.getDate()+1);var tm=t.toISOString().slice(0,10);
    var d=new Date(n);d.setDate(d.getDate()+2);var da=d.toISOString().slice(0,10);
    var dates=[td,tm,da];
    var check=0,sent=0;
    for(var dt of dates){
      var ik="reminders:by-date:"+dt;
      var ir=await kv.get(ik,"text");
      if(ir){
        var ks=JSON.parse(ir);
        for(var k of ks){
          var raw=await kv.get(k,"text");
          if(raw){
            var rd=JSON.parse(raw);
            check++;
            var sub="Birthday Reminder from SendAFun!";
            var eml="<!DOCTYPE html><html><head><meta charset=\"utf-8\"><style>body{font-family:-apple-system,sans-serif;margin:0;padding:0;background:#f5f5f5}.ct{max-width:560px;margin:0 auto;padding:32px 20px}.ic{background:#fff;border-radius:16px;padding:32px;text-align:center;box-shadow:0 2px 8px #0000000f}h2{color:#1a1a2e;font-size:24px}p{color:#636e72;font-size:16px;line-height:1.6}.btn{display:inline-block;background:#e17055;color:#fff;padding:14px 32px;border-radius:12px;font-size:16px;font-weight:600;text-decoration:none;margin-top:24px}.ft{font-size:12px;color:#b2bec3;text-align:center;margin-top:24px}</style></head><body><div class=\"ct\"><div class=\"ic\"><p style=\"font-size:32px;margin:0\">&#x1F382;</p><h2>Birthday Reminder!</h2><p>Don't forget to send a card to <strong>"+esc(rd.name||"your loved one")+"</strong>!</p><a href=\""+esc(SITE_URL)+"\" class=\"btn\">&#x1F389; Send a Card Now</a></div><div class=\"ft\">Powered by <a href=\""+esc(SITE_URL)+"\" style=\"color:#e17055;text-decoration:none\">SendAFun.com</a></div></div></body></html>";
            try{await sendResend({to:rd.email,subject:sub,html:eml,fromName:"SendAFun",fromEmail:"reminders@sendafun.com"});sent++}catch(e){}
          }
        }
      }
    }
    return json({checked:check,sent:sent,cron:true,message:"Cron reminder check complete"});
  }catch(e){console.error("cron:",e);return json({error:e.message,cron:true},500)}
}

async function handleDownload(request,kv,rl){
  // R2 signed URL for high-res original image (5-min TTL)
  var ip=request.headers.get("CF-Connecting-IP")||"unknown";
  try{
    var ic=await rl.check("dl:"+ip);
    if(!ic.allowed)return json({error:"Too many requests"},429);
    // Auth via user_token cookie
    var cookieHdr=request.headers.get("cookie")||"";
    var tokenMatch=cookieHdr.match(/user_token=([^;]+)/);
    if(!tokenMatch)return err("Authentication required",401);
    var token=tokenMatch[1];
    var email=await kv.get("usertoken:"+token,"text");
    if(!email)return err("Invalid session",401);
    // Check permission
    var p=await getPermission(kv,email);
    if(!p||!p.active)return err("No active membership",402);
    // Annual subscribers can download any; single-purchase only their card
    var url=new URL(request.url);
    var cardSlug=url.searchParams.get("cardSlug");
    if(p.plan==="single"&&!cardSlug)return err("cardSlug required for single purchase");
    // Generate R2 signed URL (env.ORIGINALS_BUCKET = R2 bucket binding)
    if(!ORIGINALS_BUCKET){
      // Fallback: if no R2 binding configured yet, return placeholder
      return json({downloadUrl:null,error:"R2 not configured"},503);
    }
    var objectKey="originals/"+(cardSlug||"unknown")+"-original.png";
    var signedUrl=await ORIGINALS_BUCKET.createPresignedUrl({
      objectKey:objectKey,
      expiresIn:300 // 5 minutes
    });
    return json({downloadUrl:signedUrl,expiresIn:300});
  }catch(e){console.error("dl:",e);return err(e.message||"Failed",500)}
}
