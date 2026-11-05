# ABF New Companies — Admin

Internal tool for ABF Accounting: pull new Companies House incorporations every
morning, choose who gets a letter, print letters + address labels, and keep a
history of what was sent.

Design source: Figma **ABF Accounting → 02 — New Companies Admin**.

> **Status:** design build. Every screen, modal and menu from Figma is built and
> interactive, using sample data from `src/lib/mock-data.ts`.
> **Auth is fully working** against PostgreSQL. Business features (Companies
> House pull, saving templates, real print runs) come next — the database
> tables for them already exist.

## Stack

| Area | Choice |
| --- | --- |
| Framework | Next.js 16 (App Router, Server Actions, `proxy.ts`) · React 19 · TypeScript |
| Styling | Tailwind CSS v4 — design tokens in `src/app/globals.css` (`@theme`) |
| Font / icons | Manrope (`next/font`) · Font Awesome 6/7 Solid, rendered as inline SVG |
| Database | PostgreSQL 17 + Drizzle ORM. SQL migrations in `/drizzle` |
| Auth | Custom, server-side sessions (see *Security* below) |

## Run it locally

```bash
npm install
cp .env.example .env.local     # then set DATABASE_URL
npm run db:migrate             # creates all tables
npm run db:seed                # creates admin@abfaccounting.com (password written to .env.local)
npm run dev                    # http://localhost:3000
```

Useful scripts: `npm run typecheck`, `npm run lint`, `npm run db:studio` (browse the DB),
`npm run db:generate` (after editing `src/lib/db/schema.ts` → writes a new SQL file).

In development, password-reset emails are printed to the terminal running `npm run dev`.

## Screens

| Route | Figma frame |
| --- | --- |
| `/sign-in`, `/register`, `/forgot-password`, `/reset-password` | Sign in / Error / Forgot password / Reset link sent (+ Register in the same style) |
| `/new-companies` | New Companies Feed · modals: Export, Fix posting address, Pulling new companies (`?modal=pull`), Today's pull didn't finish (`?modal=pull-failed`), row actions menu, filter dropdowns |
| `/new-companies/[number]` (+ `/activity`, `/letters`, `/notes`) | Company Detail — Overview / Activity / Letters / Notes |
| `/print` | Print Letters · modals: Did all letters print?, Print address labels (`?labels=1`), Reprint run |
| `/print/preview` | Print Preview (+ confirm modal, `?confirm=1`) |
| `/letter-templates/[id]` (+ `/replace-codes`, `/settings`, `/versions`) | Letter Templates — Content / Replace codes / Settings / Version history · New template, Leave without saving, Insert replace code menu, toasts |
| `/history?tab=sent\|excluded\|not-sent\|print-runs` | History · Print run details modal |
| `/account` | My account (reads the real signed-in user) · Change password modal |
| Top bar | ⌘K / Ctrl K search panel, notifications panel, account menu |

### Design fixes made while building
- Bulk/print toolbars: Figma had 44 px buttons inside a 44–48 px bar (they overflowed). Bar is now 52 px with 36 px buttons.
- "Fix posting address" and "Today's pull didn't finish" notes used dark text on solid orange/red (≈2–3:1 contrast). Switched to the subtle status fills.
- A few 8–9 px labels bumped by ~1 px for legibility; leftover Guru purple (`#36303c`) and blue glow replaced with ABF ink/green.
- "Keep me signed in" is a real checkbox; password fields have show/hide.

## Security (auth)

- **Passwords:** Argon2id (OWASP params m=19 MiB, t=2, p=1). Min 12 chars, common-password deny-list, can't contain the email name.
- **Sessions:** 256-bit random token in an `HttpOnly`, `SameSite=Lax`, `Secure` cookie (`__Host-` prefix in production). Only the SHA-256 of the token is stored, so a DB leak can't be replayed. 12 h sliding sessions, or 30 days with "keep me signed in". Sessions are checked against the DB on every request (`src/lib/auth/dal.ts`) and can be revoked.
- **Brute force:** 5 wrong passwords per email → 15-minute lock (counted per email string so unknown emails behave the same); per-IP limits on sign-in, register and reset.
- **No account enumeration:** same timing for unknown emails (dummy hash check); forgot-password always shows the same message.
- **Reset links:** single-use, 30-minute expiry, stored hashed; using one signs out every device. Changing your password signs out other devices.
- **Registration:** only `ALLOWED_SIGNUP_DOMAINS` emails; first account becomes admin; turn off with `REGISTRATION_ENABLED=false`.
- **Other:** Server Actions (built-in Origin/CSRF check), zod validation on every input, safe `next=` redirects only, strict security headers + CSP (`next.config.ts`), `Cache-Control: no-store` on signed-in pages, `proxy.ts` guard + DAL check in every layout/action.

## Companies House pull

Every day at **06:00 South Africa time** (`Africa/Johannesburg`) the app pulls every company incorporated since the last successful pull, using the read-only Companies House REST API (`COMPANIES_HOUSE_API_KEY`).

1. **Fetch** — advanced company search, day by day, 5,000 per page. One day of overlap catches late-indexed companies; up to 14 missed days are caught up automatically.
2. **Rules** — the 7 checks from the design (`src/lib/pull/eligibility.ts`): Ltd/LLP, complete UK address, not your own office, not a shared/agent address (≥ 5 companies at one address in 14 days), not the Companies House default address, not excluded, not printed before. Results: `not_reviewed` (ready), `address_issue`, `excluded`, `skipped` + `skip_reason`.
3. **Directors** — one officers call per ready company to get the first active director's name for the letter.
4. **Done** — counts saved on the `pulls` row, in-app notifications added.

Rate limit: 600 requests / 5 min per key — requests are spaced evenly (~1.9/s) and the `X-Ratelimit-*` headers are respected; 429s wait for the reset, 5xx/network errors retry with backoff. A typical day (~2,700 companies) takes ~15–20 min, mostly director names.

**Failures:** retried every 30 minutes (up to 12 times a day). After the 3rd failed attempt, everyone with "Email me if the morning pull fails" gets one email. A Postgres advisory lock guarantees only one pull runs at a time; a pull killed by a restart is marked *Interrupted* and redone.

**How it's triggered** (`PULL_SCHEDULER` in `.env`):
- `internal` (default) — the Next.js server checks every minute (`src/instrumentation.ts`). Use on a long-running Node server (`next start`, PM2, cPanel Node app).
- `external` — run `npm run pull` from cron (e.g. every 10 minutes; it only pulls when due), or call `GET /api/cron/pull` with `Authorization: Bearer $CRON_SECRET`.
- Anyone signed in can press **Run pull now** (sidebar → Companies House card); manual pulls include today.

`npm run pull -- --now` forces a manual pull from the terminal. `npx tsx scripts/test-eligibility.ts` checks the rules.

## Going live — database

All schema changes are plain SQL files in **`/drizzle`** (`0000_init.sql`, …). They are the source of truth for the live database.

1. Create a PostgreSQL database and a dedicated login role for the app (not the superuser).
2. Set `DATABASE_URL` (and `DATABASE_SSL=true` if your host requires TLS), `APP_URL=https://your-domain`, `ALLOWED_SIGNUP_DOMAINS`.
3. Run `npm run db:migrate` from the server/CI — or run the `.sql` files in `/drizzle` in order with `psql`.
4. Create the first admin by registering, then set `REGISTRATION_ENABLED=false`.
5. Before launch: plug an email provider into `src/lib/mail.ts`, serve over HTTPS, and make sure your proxy sets `X-Forwarded-For`.

Never run `npm run db:seed` in production (it refuses to).
