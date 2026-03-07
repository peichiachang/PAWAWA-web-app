/**
 * POST /api/auth/register
 * Body: { email?: string, phone?: string, password: string }
 * 至少提供 email 或 phone 其一；password 必填。回傳 { user: { id, email?, phone? }, token }
 */
const { randomUUID } = require('crypto');
const userStore = require('../_lib/userStore');
const { hashPassword, createToken, normalizeEmail, normalizePhone } = require('../_lib/auth');

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
    if (password.length < 6) {
      sendJson(res, 400, { error: '密碼至少 6 個字元' });
      return;
    }

    if (email && userStore.findByEmail(email)) {
      sendJson(res, 409, { error: '此 Email 已被註冊' });
      return;
    }
    if (phone && userStore.findByPhone(phone)) {
      sendJson(res, 409, { error: '此手機號碼已被註冊' });
      return;
    }

    const id = randomUUID();
    const passwordHash = hashPassword(password);
    const createdAt = new Date().toISOString();
    const user = userStore.create({
      id,
      email: email || null,
      phone: phone || null,
      passwordHash,
      createdAt,
    });

    const token = createToken(id);
    sendJson(res, 201, {
      user: { id: user.id, email: user.email || undefined, phone: user.phone || undefined },
      token,
    });
  } catch (err) {
    console.error('[auth/register]', err);
    sendJson(res, 500, { error: '註冊失敗，請稍後再試' });
  }
};
