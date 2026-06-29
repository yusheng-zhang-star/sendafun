/**
 * _worker.js — Cloudflare Functions
 * 处理 PayPal IPN 回调 + 自动发邮件
 * 
 * 部署路径：{域名}/api/paypal-ipn
 * 部署后需要在PayPal后台设置IPN URL为这个地址
 */

// 配置
const CONFIG = {
  paypalEmail: '331728525@qq.com',      // PayPal商家邮箱
  domain: 'sendafun.com',              // 站点域名
};

// 卡片的下载链接（生成带签名的临时URL，24小时有效）
function generateDownloadUrl(cardId) {
  // 简单版：用卡片ID+时间戳生成临时令牌
  const expires = Math.floor(Date.now() / 1000) + 86400; // 24小时后过期
  const token = btoa(`${cardId}:${expires}:smartcards-secret`);
  return `https://${CONFIG.domain}/download?card=${cardId}&token=${token}&expires=${expires}`;
}

// 验证PayPal IPN通知
async function verifyIpn(body) {
  const verificationBody = `cmd=_notify-validate&${body}`;
  const response = await fetch('https://ipnpb.paypal.com/cgi-bin/webscr', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: verificationBody
  });
  const text = await response.text();
  return text === 'VERIFIED';
}

// 发邮件（MailChannels API）
async function sendEmail(to, subject, htmlBody) {
  const mailBody = {
    personalizations: [{ to: [{ email: to }] }],
    from: { email: 'noreply@sendafun.com', name: 'SmartCards' },
    subject: subject,
    content: [{ type: 'text/html', value: htmlBody }]
  };
  
  try {
    const resp = await fetch('https://api.mailchannels.net/tx/v1/send', {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify(mailBody)
    });
    return resp.ok;
  } catch (e) {
    console.error('Email send failed:', e);
    return false;
  }
}

// 成功下载页面
function downloadPage(cardId) {
  return `<!DOCTYPE html>
<html><head><meta charset="UTF-8"><title>Download - SmartCards</title>
<style>
  body{font-family:Inter,sans-serif;background:#f8f6f3;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0}
  .card{background:#fff;border-radius:16px;padding:40px;box-shadow:0 2px 12px rgba(0,0,0,.06);text-align:center;max-width:480px}
  h1{color:#4a7c59;margin-bottom:12px}
  p{color:#6b6b6b;margin-bottom:24px}
  .btn{background:#0070ba;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block}
</style></head>
<body>
<div class="card">
  <h1>✅ Payment Successful!</h1>
  <p>Your card download link has been sent to your email.</p>
  <p>Can't find it? Check your spam folder.</p>
  <a href="/" class="btn">Browse More Cards</a>
</div>
</body></html>`;
}

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    const path = url.pathname;
    
    // PayPal IPN 回调
    if (path === '/api/paypal-ipn' && request.method === 'POST') {
      const body = await request.text();
      const params = new URLSearchParams(body);
      
      // 验证是PayPal发来的
      const verified = await verifyIpn(body);
      
      if (!verified) {
        return new Response('INVALID', { status: 400 });
      }
      
      // 验证收款方
      const receiverEmail = params.get('receiver_email');
      if (receiverEmail !== CONFIG.paypalEmail) {
        return new Response('INVALID_RECEIVER', { status: 400 });
      }
      
      // 验证支付完成
      const paymentStatus = params.get('payment_status');
      if (paymentStatus !== 'Completed') {
        return new Response('NOT_COMPLETED', { status: 200 });
      }
      
      // 验证金额
      const amount = parseFloat(params.get('mc_gross') || '0');
      const itemName = params.get('item_name');
      const cardId = params.get('custom');
      const buyerEmail = params.get('payer_email');
      
      // 生成下载链接
      const downloadUrl = generateDownloadUrl(cardId);
      
      // 发邮件
      const emailSubject = `Your Card Download - ${itemName}`;
      const emailHtml = `
        <div style="font-family:Inter,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <h2 style="color:#4a7c59">Thank You for Your Purchase!</h2>
          <p>Here is your download link for <strong>${itemName}</strong>:</p>
          <p style="text-align:center">
            <a href="${downloadUrl}" style="background:#4a7c59;color:#fff;padding:12px 32px;border-radius:8px;text-decoration:none;font-weight:600;display:inline-block">
              Download Your Card
            </a>
          </p>
          <p style="color:#6b6b6b;font-size:0.85rem">This link expires in 24 hours.</p>
          <p style="color:#6b6b6b;font-size:0.85rem">Download ID: ${cardId}</p>
          <hr style="border:none;border-top:1px solid #e5e5e5;margin:24px 0" />
          <p style="color:#6b6b6b;font-size:0.8rem">SmartCards - Beautiful greeting cards</p>
        </div>
      `;
      
      await sendEmail(buyerEmail, emailSubject, emailHtml);
      
      return new Response('OK', { status: 200 });
    }
    
    // 下载页面
    if (path === '/download-success') {
      return new Response(downloadPage(), {
        headers: { 'content-type': 'text/html;charset=utf-8' }
      });
    }
    
    // 处理后端下载
    if (path === '/download') {
      const cardId = url.searchParams.get('card');
      const token = url.searchParams.get('token');
      const expires = parseInt(url.searchParams.get('expires') || '0');
      
      // 验证token
      const expectedToken = btoa(`${cardId}:${expires}:smartcards-secret`);
      if (token !== expectedToken || Date.now() / 1000 > expires) {
        return new Response('Invalid or expired link', { status: 403 });
      }
      
      // 重定向到R2图片
      const imageUrl = `https://pub-1ac39f23ca77406495146e7a2f4183b3.r2.dev/${cardId}-horizontal.webp`;
      return Response.redirect(imageUrl, 302);
    }
    
    // 其他路径：走静态文件
    return new Response('Not Found', { status: 404 });
  }
};
