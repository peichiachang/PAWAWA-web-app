/**
 * Auth 工具：密碼雜湊、JWT 簽發／驗證
 * 使用 Node 內建 crypto（scrypt + HMAC），無額外依賴
 */
const crypto = require('crypto');

const SALT_LEN = 16;
const KEY_LEN = 64;
const SCRYPT_OPTIONS = { N: 16384, r: 8, p: 1 };
const TOKEN_TTL_SEC = 7 * 24 * 60 * 60; // 7 days
const AUTH_SECRET = process.env.AUTH_JWT_SECRET || process.env.GEMINI_API_KEY || 'pawawa-auth-dev-secret';

function hashPassword(plain) {
  const salt = crypto.randomBytes(SALT_LEN);
  const key = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS);
  return salt.toString('base64') + ':' + key.toString('base64');
}

function verifyPassword(plain, stored) {
  if (!stored || !plain) return false;
  const [saltB64, keyB64] = stored.split(':');
  if (!saltB64 || !keyB64) return false;
  const salt = Buffer.from(saltB64, 'base64');
  const key = crypto.scryptSync(plain, salt, KEY_LEN, SCRYPT_OPTIONS);
  return key.toString('base64') === keyB64;
}

function base64urlEncode(buf) {
  return buf.toString('base64').replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64urlDecode(str) {
  const padded = str.replace(/-/g, '+').replace(/_/g, '/') + '=='.slice(0, (3 - (str.length % 4)) % 4);
  return Buffer.from(padded, 'base64');
}

function createToken(userId) {
  const payload = { sub: userId, exp: Math.floor(Date.now() / 1000) + TOKEN_TTL_SEC, iat: Math.floor(Date.now() / 1000) };
  const payloadB64 = base64urlEncode(Buffer.from(JSON.stringify(payload)));
  const headerB64 = base64urlEncode(Buffer.from(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(headerB64 + '.' + payloadB64).digest();
  return headerB64 + '.' + payloadB64 + '.' + base64urlEncode(signature);
}

function verifyToken(token) {
  if (!token || typeof token !== 'string') return null;
  const parts = token.trim().split('.');
  if (parts.length !== 3) return null;
  const [headerB64, payloadB64, sigB64] = parts;
  const signature = crypto.createHmac('sha256', AUTH_SECRET).update(headerB64 + '.' + payloadB64).digest();
  if (base64urlEncode(signature) !== sigB64) return null;
  let payload;
  try {
    payload = JSON.parse(base64urlDecode(payloadB64).toString('utf8'));
  } catch (_e) {
    return null;
  }
  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) return null;
  return payload.sub || null;
}

function normalizeEmail(email) {
  if (!email || typeof email !== 'string') return null;
  return email.trim().toLowerCase();
}

function normalizePhone(phone) {
  if (!phone || typeof phone !== 'string') return null;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 8 ? digits : null;
}

module.exports = {
  hashPassword,
  verifyPassword,
  createToken,
  verifyToken,
  normalizeEmail,
  normalizePhone,
};
