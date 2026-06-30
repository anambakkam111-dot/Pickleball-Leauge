// Vercel serverless function: POST /api/admin/logout
// Clears the admin session cookie.
//
// NOTE: package.json has "type": "module", so Vercel's Node.js runtime loads
// this file as ESM — it must use import/export, not require()/module.exports.

export default function handler(req, res) {
  res.setHeader(
    'Set-Cookie',
    'admin_session=; HttpOnly; Path=/; SameSite=Strict; Max-Age=0'
  );
  return res.status(200).json({ ok: true });
}
