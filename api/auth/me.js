/**
 * GET /api/auth/me
 * Header: Authorization: Bearer <token>
 * 驗證 token 並回傳當前使用者 { user: { id, email?, phone? } }
 */
const userStore = require('../_lib/userStore');
const { verifyToken } = require('../_lib/auth');

function sendJson(res, statusCode, data) {
  res.statusCode = statusCode;
  res.setHeader('Content-Type', 'application/json; charset=utf-8');
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
  res.end(JSON.stringify(data));
}

function getBearerToken(req) {
  const auth = req.headers && (req.headers.authorization || req.headers.Authorization);
  if (!auth || typeof auth !== 'string') return null;
  const m = auth.match(/^Bearer\s+(.+)$/i);
  return m ? m[1].trim() : null;
}

module.exports = async function handler(req, res) {
  if (req.method === 'OPTIONS') {
    res.statusCode = 204;
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
    res.setHeader('Access-Control-Allow-Methods', 'GET,OPTIONS');
    return res.end();
  }
  if (req.method !== 'GET') {
    sendJson(res, 405, { error: 'Method not allowed' });
    return;
  }
  try {
    const token = getBearerToken(req);
    const userId = token ? verifyToken(token) : null;
    if (!userId) {
      sendJson(res, 401, { error: '未登入或 token 已過期' });
      return;
    }
    const user = userStore.findById(userId);
    if (!user) {
      sendJson(res, 401, { error: '使用者不存在' });
      return;
    }
    sendJson(res, 200, {
      user: { id: user.id, email: user.email || undefined, phone: user.phone || undefined },
    });
  } catch (err) {
    console.error('[auth/me]', err);
    sendJson(res, 500, { error: '驗證失敗' });
  }
};
