# Pickleball League

A responsive web app for running a family/friends pickleball doubles league. Built with React + Vite, deployed on Vercel.

## Features

- **Teams** — manually add teams or auto-generate balanced doubles pairings from a player ratings pool
- **Schedule** — custom or full round-robin schedule, displayed in simultaneous play rounds
- **Scores** — inline scorecard entry with validation (games to 11, win by 2)
- **Standings** — live rankings with tiebreaker logic
- **History** — completed match log with CSV export
- **Admin** — password-protected player ratings manager (search, add, edit, delete, tier + notes)

## Local Development

**Public app only** (no admin):
```bash
npm install
npm run dev
```

**Full stack including admin login:**
```bash
npm install
npm install -g vercel        # one-time
cp .env.local.example .env.local
# Edit .env.local — set ADMIN_PASSWORD to whatever you want
vercel dev
```

## Deployment (Vercel)

1. Push to GitHub and import the repo in the [Vercel dashboard](https://vercel.com/new)
2. Framework preset: **Vite** (auto-detected)
3. Add environment variables in **Project → Settings → Environment Variables**:

| Variable | Required | Description |
|----------|----------|-------------|
| `ADMIN_PASSWORD` | One of these two | Plain-text admin password |
| `ADMIN_PASSWORD_HASH` | One of these two | SHA-256 hex hash of the password |
| `SESSION_SECRET` | Optional | Separate HMAC key for session tokens |

Generate a hash:
```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
```

4. Deploy. The admin password is the same for everyone — change it by updating the env var and redeploying.

## Tech Stack

- React 19 + TypeScript
- Vite 8
- Tailwind CSS 3 (wood/vintage theme)
- Vercel serverless functions (admin auth)
- localStorage (league data + player ratings)
