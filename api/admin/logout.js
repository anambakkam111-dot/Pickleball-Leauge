// Vercel serverless function: POST /api/admin/logout
// Clears the admin session cookie.

module.exports = function handler(req, res) {
  res.setHeader(
    'Set-Cookie',
    'admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
  );
  return res.status(200).json({ ok: true });
};
