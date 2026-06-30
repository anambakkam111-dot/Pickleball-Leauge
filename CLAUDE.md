# Pickleball League App

## Overview
A responsive single-page web app for running a family/friends pickleball doubles league. Deployed on Vercel. Public pages need no login. Admin page is protected by a server-side password via Vercel API routes.

## Tech Stack
- **React 19** + **TypeScript** — `verbatimModuleSyntax` ON — use `import type` for all type-only imports
- **Vite** — dev server + build
- **Tailwind CSS 3** — mobile-first, wood/vintage theme using `stone-*` + `amber-*` palette
- **Vercel serverless functions** (`api/admin/*.js`) — server-side admin auth (Node.js, CommonJS)

## localStorage Keys
| Key | Contents |
|-----|----------|
| `pickleball-league-v1` | `League { teams, matches }` |
| `pickleball-ratings-v1` | `PlayerRating[]` (private, never shown on public pages) |

Admin authentication is fully server-side (see Admin Auth Flow below) — no admin-related key is ever written to localStorage.

## Data Model

```typescript
// Public league data
interface Team { id, name, player1, player2 }
interface Match { id, team1Id, team2Id, team1Score, team2Score, playedAt }
interface League { teams: Team[], matches: Match[] }
interface StandingRow { team, rank, wins, losses, played, pf, pa, pd }

// Private player ratings (hidden from all public pages)
type PlayerTier = 'high1' | 'mid1' | 'low1' | 'upper2' | 'mid2' | 'lower2'
interface PlayerRating { id, name, rating (0-100), tier, notes?, updatedAt }
```

## Admin Auth Flow
1. User visits Admin tab → browser calls `GET /api/admin/session`
2. If valid HttpOnly cookie → auto-unlock (no password re-entry needed for 24 h)
3. If no valid cookie → show password form → `POST /api/admin/login` → server checks env var → sets HttpOnly cookie on success
4. Logout calls `POST /api/admin/logout` → cookie is cleared

The admin password is set via Vercel environment variable, never stored in the browser.

## Scoring Rules
- Games to **11 points**, win by **2**
- Valid: 11-0 through 11-9, then 12-10, 13-11, 14-12, ...
- Invalid: tied, winner < 11, win by 1 when above 11

## Tiebreaker Rules (in order)
1. Win percentage (wins / games played)
2. Head-to-head record within tied group — **only applied if every tied team has played every other** (otherwise skip to #3)
3. Head-to-head point differential (same condition)
4. Overall point differential (PF − PA)
5. Points for (PF)
6. Fewest points allowed (PA — lower is better)

## Team Generation Algorithm (`src/utils/teamGen.ts`)
- Sort players by tier order (high1 → lower2)
- Within each tier, shuffle randomly — same-tier players treated as interchangeable
- Snake-draft: pair top-half[i] with bottom-half[i] (reversed) → minimizes tier spread
- "Regenerate" rotates the bottom array by +1 AND re-shuffles within tiers → fresh pairings each time
- `pairsToTeams()` strips ratings before saving — ratings never touch public league state

## Schedule Generation (`src/utils/matchups.ts`)
- `generateRoundRobin(teams)` — every team plays every other team once
- `generateCustomSchedule(teams, gamesPerTeam)` — each team plays exactly N games; greedy random selection, 20-attempt best-pick
- Schedule displayed in rounds: `groupIntoRounds()` in ScheduleTab groups the flat match list so each round shows only games that can be played simultaneously

## File Structure
```
api/
  admin/
    login.js     — POST: verify password (env var), set HttpOnly cookie
    logout.js    — POST: clear session cookie
    session.js   — GET: check cookie validity
src/
  types.ts                   — All interfaces and types
  storage.ts                 — load/save for league and ratings (localStorage)
  data/
    seedRatings.ts           — 27-player initial seed (auto-loaded if ratings empty)
  utils/
    validation.ts            — validateScore(s1, s2): string | null
    matchups.ts              — generateRoundRobin, generateCustomSchedule
    standings.ts             — calculateStandings with proper group-tiebreak logic
    teamGen.ts               — generateBalancedPairs (tier+random), pairsToTeams
    csv.ts                   — matchesToCSV, standingsToCSV, downloadCSV
  components/
    Nav.tsx                  — 6-tab nav (exports Tab type): home|teams|schedule|standings|history|admin
    DashboardTab.tsx         — Overview: stats, leader, quick links, recent results
    TeamsTab.tsx             — Team list + embedded Team Builder + schedule options
    ScheduleTab.tsx          — Match list grouped by simultaneous round, inline score entry
    StandingsTab.tsx         — Ranked table with wood-theme header
    HistoryTab.tsx           — Completed matches + CSV export
    AdminPage.tsx            — Server-auth gate + full ratings CRUD (search, sort, add, edit, delete)
  App.tsx                    — Root: state, handlers, tab routing
  main.tsx                   — Entry point
  index.css                  — Tailwind directives + wood grain background CSS
vercel.json                  — Build config + SPA rewrite rule
.env.local.example           — Template for local dev env vars
```

## Design Theme (Wood / Vintage Court)
- **Body bg**: `#b8894f` warm pine with CSS wood-grain gradients
- **Header**: `bg-amber-950` dark mahogany
- **Nav**: `bg-amber-900` with `yellow-400` active indicator
- **Cards**: `bg-amber-50` with `border-amber-200`
- **Primary btn**: `bg-amber-800 text-amber-50`
- **Generate Teams btn**: `bg-yellow-500 text-amber-950`
- **Win/positive**: `text-green-700`
- **Table header**: `bg-amber-900 text-amber-100`
- **Headings**: `font-black uppercase tracking-wide`
- Body text / labels use `text-stone-*` for contrast on light backgrounds
- Mobile-first, scrollable nav bar for 6 tabs

## Admin Page
- Password controlled by server env var — one password for all users
- 24-hour session cookie (HttpOnly, not readable by JS)
- Auto-checks session on tab visit; re-prompts only if cookie is expired
- Features: view/add/edit/delete player ratings + notes, search, sort by rating/tier/name
- **Ratings are NEVER passed to or shown on any public tab**

## Deployment (Vercel)

### First deploy
1. Push repo to GitHub
2. Import project in Vercel dashboard
3. Framework preset: **Vite** (auto-detected, or set manually)
4. Build command: `npm run build` | Output directory: `dist`
5. Add environment variables (see below)
6. Deploy

### Required environment variables (set in Vercel → Project → Settings → Environment Variables)

| Variable | Description |
|----------|-------------|
| `ADMIN_PASSWORD` | Plain-text admin password **or** |
| `ADMIN_PASSWORD_HASH` | SHA-256 hex hash of the password (more secure) |
| `SESSION_SECRET` | *(optional)* Separate HMAC key for session tokens; defaults to the password value |

Set at least one of `ADMIN_PASSWORD` / `ADMIN_PASSWORD_HASH`. Both can be set; the hash takes precedence.

**Generate a SHA-256 hash:**
```bash
node -e "const c=require('crypto'); console.log(c.createHash('sha256').update('YOUR_PASSWORD').digest('hex'))"
```

### Local development

**For the public app only** (no admin login):
```bash
npm run dev
```
The `/api` routes are not served by Vite dev server, so the Admin tab will show an API unavailable error.

**For full-stack local dev including admin login:**
```bash
npm install -g vercel       # one-time
cp .env.local.example .env.local
# Edit .env.local and set ADMIN_PASSWORD
vercel dev
```
`vercel dev` serves the Vite app AND the serverless API routes on a single port.

### Changing the admin password
Update `ADMIN_PASSWORD` (or `ADMIN_PASSWORD_HASH`) in Vercel environment variables and redeploy. No code changes needed. Existing session cookies will be invalidated automatically because the HMAC key changes.

## Security Notes
- The admin password is never sent to the browser or stored in localStorage
- Session tokens are HMAC-SHA256 signed, stateless, 24-hour expiry
- Cookies are `HttpOnly; SameSite=Strict; Secure` (Secure flag set in production only)
- **Remaining limitation**: Player ratings/notes live in localStorage on each browser. Anyone with DevTools can read their own browser's storage. Move ratings to a backend database for true privacy.

## Feature Backlog
- [ ] Best-of-3 match format
- [ ] Player-level statistics
- [ ] Multiple seasons / season history
- [ ] Playoff bracket mode
- [ ] Court assignment + time slots
- [ ] Move player ratings to backend database (Vercel Postgres / Supabase)
- [ ] Real authentication (Google sign-in)
- [ ] QR code for score entry
- [ ] Export/import player ratings (CSV)
