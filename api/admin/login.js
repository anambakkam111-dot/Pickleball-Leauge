// Vercel serverless function: POST /api/admin/login
//
// Verifies the admin password against a server-side environment variable and
// issues an HttpOnly session cookie on success. The password never touches
// the browser — this is substantially more secure than the previous
// localStorage/Web Crypto approach where the hash was visible in DevTools.
//
// Required env var (set one):
//   ADMIN_PASSWORD       — plain-text password (simpler, fine for private deploys)
//   ADMIN_PASSWORD_HASH  — SHA-256 hex hash of the password (slightly more secure)
//
// Optional:
//   SESSION_SECRET       — separate HMAC key for session tokens (defaults to password)
//
// LIMITATION: Ratings and notes are still stored in localStorage on each
// visitor's browser. Anyone who opens DevTools can read their own browser's
// localStorage. For true data privacy, ratings should be moved to a backend
// database in a future iteration.

const crypto = require('crypto');

module.exports = function handler(req, res) {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const password = typeof req.body?.password === 'string' ? req.body.password : '';
  if (!password) {
    return res.status(400).json({ error: 'Password required' });
  }

  const envHash = process.env.ADMIN_PASSWORD_HASH ?? '';
  const envPlain = process.env.ADMIN_PASSWORD ?? '';

  if (!envHash && !envPlain) {
    return res.status(503).json({
      error: 'Admin not configured. Set ADMIN_PASSWORD or ADMIN_PASSWORD_HASH on the server.',
    });
  }

  let valid = false;
  if (envHash) {
    const hash = crypto.createHash('sha256').update(password).digest('hex');
    valid = safeEqual(hash, envHash);
  } else {
    valid = safeEqual(password, envPlain);
  }

  if (!valid) {
    return res.status(401).json({ error: 'Incorrect password' });
  }

  // Stateless session token: HMAC of a fixed string keyed by the server secret.
  // Any request that presents this token is treated as authenticated.
  const secret = process.env.SESSION_SECRET || envHash || envPlain;
  const token = crypto.createHmac('sha256', secret).update('admin_session_v1').digest('hex');

  const isProduction = process.env.VERCEL_ENV === 'production';
  const cookieParts = [
    `admin_session=${token}`,
    'HttpOnly',
    'Path=/',
    'SameSite=Strict',
    'Max-Age=86400', // 24 hours
  ];
  if (isProduction) cookieParts.push('Secure');

  res.setHeader('Set-Cookie', cookieParts.join('; '));
  return res.status(200).json({ ok: true });
};

// Constant-time string comparison to prevent timing attacks.
function safeEqual(a, b) {
  if (a.length !== b.length) return false;
  return crypto.timingSafeEqual(Buffer.from(a, 'utf8'), Buffer.from(b, 'utf8'));
}
