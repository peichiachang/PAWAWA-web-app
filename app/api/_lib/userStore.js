/**
 * 使用者儲存介面（開發用 in-memory 實作）
 * 正式環境請改為 Vercel KV / Postgres / Supabase 等持久化儲存
 */
const users = new Map(); // key: userId (UUID)
const byEmail = new Map(); // key: normalized email
const byPhone = new Map(); // key: normalized phone

function safeGet(map, key) {
  const val = map.get(key);
  return val ? { ...val } : null;
}

module.exports = {
  findByEmail(email) {
    if (!email || typeof email !== 'string') return null;
    return safeGet(byEmail, email.trim().toLowerCase());
  },

  findByPhone(phone) {
    if (!phone || typeof phone !== 'string') return null;
    const normalized = phone.replace(/\D/g, '');
    return normalized ? safeGet(byPhone, normalized) : null;
  },

  findById(id) {
    if (!id) return null;
    return safeGet(users, id);
  },

  create(user) {
    const { id, email, phone, passwordHash, createdAt } = user;
    if (!id) throw new Error('User id is required');
    const record = { id, email: email || null, phone: phone || null, passwordHash, createdAt };
    users.set(id, record);
    if (record.email) byEmail.set(record.email.trim().toLowerCase(), record);
    if (record.phone) byPhone.set(record.phone.replace(/\D/g, ''), record);
    return { ...record };
  },
};
