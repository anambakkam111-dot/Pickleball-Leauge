// Vercel serverless function: GET /api/admin/session
// Returns { authenticated: true } if the request carries a valid session cookie.
// The browser never learns the cookie value — it is HttpOnly.

const crypto = require('crypto');

module.exports = function handler(req, res) {
  const token = parseCookie(req.headers.cookie ?? '', 'admin_session');
  if (!token) {
    return res.status(200).json({ authenticated: false });
  }

  const envHash = process.env.ADMIN_PASSWORD_HASH ?? '';
  const envPlain = process.env.ADMIN_PASSWORD ?? '';
  const secret = process.env.SESSION_SECRET || envHash || envPlain;

  if (!secret) {
    return res.status(200).json({ authenticated: false });
  }

  const expected = crypto
    .createHmac('sha256', secret)
    .update('admin_session_v1')
    .digest('hex');

  const authenticated = safeEqual(token, expected);
  return res.status(200).json({ authenticated });
};

function parseCookie(header, name) {
  for (const part of header.split(';')) {
    const [k, ...v] = part.trim().split('=');
    if (k.trim() === name) return v.join('=').trim();
  }
  return '';
}

function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
