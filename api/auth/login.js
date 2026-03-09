/**
 * POST /api/auth/login
 * Body: { email?: string, phone?: string, password: string }
 * 至少提供 email 或 phone 其一；回傳 { user: { id, email?, phone? }, token }
 */
const userStore = require('../_lib/userStore');
const { verifyPassword, createToken, normalizeEmail, normalizePhone } = require('../_lib/auth');

async function readBody(req) {
  if (req.body && typeof req.body === 'object') return req.body;
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString('utf8');
  if (!raw) return {};
  return JSON.parse(raw);
}

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
  res.end(JSON.stringify(data));
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    res.setHeader('Access-Control-Allow-Methods', 'POST,OPTIONS');
    return res.end();
  }
  if (req.method !== 'POST') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const body = await readBody(req);
    const email = normalizeEmail(body.email);
    const phone = normalizePhone(body.phone);
    const password = String(body.password || '').trim();

    if (!email && !phone) {
      sendJson(res, 400, { error: '請提供 email 或手機號碼' });
      return;
    }
    if (!password) {
      sendJson(res, 400, { error: '請輸入密碼' });
      return;
    }

    const user = (email ? userStore.findByEmail(email) : null) || (phone ? userStore.findByPhone(phone) : null);
    if (!user || !verifyPassword(password, user.passwordHash)) {
      sendJson(res, 401, { error: '帳號或密碼錯誤' });
      return;
    }

    const token = createToken(user.id);
    sendJson(res, 200, {
      user: { id: user.id, email: user.email || undefined, phone: user.phone || undefined },
      token,
    });
  } catch (err) {
    console.error('[auth/login]', err);
    sendJson(res, 500, { error: '登入失敗，請稍後再試' });
  }
};
