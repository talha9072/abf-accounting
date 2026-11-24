# ABF New Companies — handover and go-live guide

For ABF Accounting and whoever hosts the app. Staff who only use the app should read
[USER-GUIDE.md](USER-GUIDE.md) instead.

---

## 1. What you are getting

**ABF New Companies** is a private, login-only web app for ABF's own team. Every morning it
collects the companies incorporated in the UK the day before (from Companies House). It
checks which ones should get a letter, and lets the team print personalised letters and
address labels on the office printer. It keeps a record of everything that was sent.

| Item | Where |
| --- | --- |
| Source code | GitHub repository `abf-accounting` (Next.js app, this folder) |
| Database structure | [docs/install.sql](install.sql) — one file that creates every table (the same SQL as [`/drizzle`](../drizzle)) |
| Staff guide | [docs/USER-GUIDE.md](USER-GUIDE.md) |
| Technical notes | [README.md](../README.md) (stack, security, rules, printing) |
| Settings template | [`.env.example`](../.env.example) — every setting, with notes |

What it does **not** do: it takes no payments, sends no letters by itself (you print and post
them), and has no public website. Everything runs on free / open-source software, so there
are no licence fees. The only outside services are Companies House (free API key) and your
own email provider.

---

## 2. Decisions already made with ABF

| Question | Decision (date) | How it works in the app |
| --- | --- | --- |
| Which companies get a letter? | Ltd, LLP and companies limited by guarantee. **No CICs, no PLCs.** (Ashley, 20 Nov 2026) | Rule "Company type". CICs are recognised by Companies House's CIC marker or a name ending in "CIC". |
| Companies at a "c/o" address (agent / accountant) | **Do not skip** them (Ashley, 20 Nov 2026) | The letter goes to that address. |
| One director with several new companies | **One letter per company** (Ashley, 20 Nov 2026) | Each company is its own letter. |
| Agent / virtual-office addresses | Skipped automatically | 5 or more new companies at one address, or 8 or more at one postcode, in 14 days. |
| When the pull runs | 06:00 South Africa time (Africa/Johannesburg), every day | Retries every 30 minutes if it fails; emails an alert after the 3rd failure. |
| How long records are kept | 12 months | Older letters, companies and activity are deleted daily. **The Excluded (do-not-contact) list is never deleted.** |
| Settings screens (printing, users) | Not needed for now (meeting 3 Nov 2026) | Set up once on the server, see section 5. **Business settings** (including the Companies House key) and **My account** are in the app. |
| Where the Companies House key goes | **In the app**, not the server file (24 Nov 2026) | An admin pastes it in **Business settings → Companies House**. It is checked with Companies House, then stored encrypted. |

---

## 3. Still needed from ABF before the first real letters go out

These are content decisions only ABF can make. The app is built and works without them, but
letters would carry the current wording.

1. **Offer and prices on the letter.** The default template still says "Business Starter from
   £65" and "Full Compliance Pack £300". Update it in **Letter Templates** (no developer
   needed).
2. **QR code link.** Currently `https://abfaccounting.com/business-starter`. Change it in
   **Business settings → QR code link** to the page the QR code should open.
3. **Letterhead address and phone.** Check **Business settings**. The phone is already
   +44 20 3968 9444, and the office address is 18 Thricknells Close, Luton, LU3 3RP.
4. **Who signs the letter.** Name and job title, set in **Letter Templates → Settings → Signed by**.
5. **Legal check** of the letter wording before the first run, including the opt-out line in
   the footer.

---

## 4. What the host needs to provide

| Need | Notes |
| --- | --- |
| A server that runs **Node.js 22 LTS** (20.9+ works) | Any Linux VPS or a Node host. About 1 GB RAM is plenty. |
| **PostgreSQL 15 or newer** (built and tested on 17) | A dedicated database and a login role for the app — not the superuser. |
| A **domain or subdomain** with **HTTPS** | For example `newcompanies.abfaccounting.com`. Sign-in cookies need HTTPS. |
| **Companies House API key** | Free. Create a "Live" application at developer.company-information.service.gov.uk and copy the **REST** key. It is **pasted into the app** after the first sign-in (section 7), not into the server settings. |
| An **email (SMTP) account** | For password-reset emails and "morning pull failed" alerts. Microsoft 365, Google Workspace, the host's mailbox, or Postmark / Brevo all work. |
| **Daily backups** of the database | For example a nightly `pg_dump`, kept for at least 30 days. |

---

## 5. Installing it (first time)

```bash
# 1. Get the code and install
git clone <repository-url> abf-new-companies
cd abf-new-companies
npm ci

# 2. Settings — copy the template and fill it in (section 6)
cp .env.example .env
nano .env

# 3. Create the database tables
npm run db:migrate
#    or, without Node on the database side, run docs/install.sql once on the empty database:
#    psql "postgresql://USER:PASSWORD@HOST:5432/DBNAME" -v ON_ERROR_STOP=1 -f docs/install.sql
#    (one or the other, not both — no data needs to be added)

# 4. Build and start
npm run build
npm run start               # listens on port 3000
```

Keep it running with a process manager, so it restarts after a reboot. For example:

```bash
npm install -g pm2
pm2 start npm --name abf-new-companies -- start
pm2 save && pm2 startup
```

Put a web server in front for HTTPS. Example for Nginx:

```nginx
server {
  server_name newcompanies.abfaccounting.com;
  location / {
    proxy_pass http://127.0.0.1:3000;
    proxy_set_header Host $host;
    proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    proxy_set_header X-Forwarded-Proto $scheme;
    proxy_set_header X-Forwarded-Host $host;
  }
}
```

Then add the HTTPS certificate, for example with `certbot --nginx`.

> Never run `npm run db:seed` on the live server. It only creates a local test login, and it
> refuses to run in production anyway.

---

## 6. Settings (`.env`)

| Setting | What to put | Notes |
| --- | --- | --- |
| `DATABASE_URL` | `postgresql://USER:PASSWORD@HOST:5432/DBNAME` | The app's own database login. |
| `DATABASE_SSL` | `true` if the database host requires TLS | Most managed databases do. |
| `APP_URL` | `https://newcompanies.abfaccounting.com` | Used in password-reset links. |
| `PULL_SCHEDULER` | `internal` | The app schedules the 06:00 pull itself; it needs an always-on server. For serverless hosting use `external` (see section 8). |
| `CRON_SECRET` | A long random string (32+ characters) | Only needed with `external`. |
| `PULL_LIMIT` | **leave empty** | Testing only (imports just a few companies). |
| `HISTORY_RETENTION_MONTHS` | `12` | `0` turns the clean-up off. |
| `SMTP_HOST` / `SMTP_PORT` / `SMTP_USER` / `SMTP_PASSWORD` | From your email provider | Port 587 = STARTTLS, 465 = TLS. |
| `MAIL_FROM` | `"ABF New Companies <no-reply@abfaccounting.com>"` | Must be an address the SMTP account may send as. |
| `AUTH_ENCRYPTION_KEY` | 32 random bytes, base64. Generate with `node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"` | **Required.** Encrypts the Companies House key and two-step sign-in. **Keep it secret and never change it** — if it changes, the Companies House key has to be pasted again and everyone has to set two-step sign-in up again. |
| `ALLOWED_SIGNUP_DOMAINS` | `abfaccounting.com` | Only these email domains can create an account. |
| `REGISTRATION_ENABLED` | `true` at first, then `false` | See section 7. |

Optional tuning (leave unset unless you have a reason): `ALLOWED_COMPANY_TYPES`,
`SHARED_ADDRESS_THRESHOLD` (5), `SHARED_POSTCODE_THRESHOLD` (8).

Check that email works:

```bash
npx tsx --conditions=react-server scripts/test-mail.ts someone@abfaccounting.com
```

---

## 7. First sign-in and setup

1. Open the site and choose **Create an account**. **The first account ever created becomes
   the admin.** Every later account is staff.
2. Create accounts for the rest of the team the same way (abfaccounting.com emails only).
3. Set `REGISTRATION_ENABLED=false` in `.env` and restart (`pm2 restart abf-new-companies`).
   Nobody else can register after that.
4. Sign in as the admin and open **Business settings**. Check the name, registration line,
   office address, phone, email, website, QR code link and reference prefix (`ABF-`). These
   print on every letter. The office address is also used to skip companies registered at
   ABF's own office.
5. On the same page, **Companies House**: paste the REST API key (section 4) and press
   **Check & save key**. The app asks Companies House whether the key works before saving it
   (encrypted; only the last 4 characters are ever shown). Until a key is saved, the menu card
   says **API key not set** and no pull runs. Then press **Run pull now** on the Companies House
   card at the bottom of the menu to load the first companies.
6. Open **Letter Templates** and update the default letter (section 3). Use **Print a test
   letter** to check it on paper.
7. Everyone: open **My account** and turn on **Two-step sign-in** (authenticator app). Keep
   the recovery codes somewhere safe.

**Admin vs staff.** Both can use everything; admins can also edit Business settings (including
the Companies House key) and other people's notes. To make another person admin (there is no screen for this yet), run on the
database:

```sql
UPDATE users SET role = 'admin' WHERE email = 'name@abfaccounting.com';
```

To remove someone's access, delete their account: `DELETE FROM users WHERE email = '…';`.
Their sessions end immediately.

---

## 8. The morning pull

- It runs **every day at 06:00 South Africa time** and collects every company incorporated
  since the last successful pull (it catches up to 14 days if the server was off).
- If it fails, it retries every 30 minutes (up to 12 times that day). After the 3rd failure,
  everyone with "Email me if the morning pull fails" switched on gets one email.
- Staff can see the result on **New Companies** ("Latest pull…"). They can start one by hand from the **Companies House** card at the bottom of the menu → **Run pull now**.
- A typical weekday brings 2,000–2,600 new companies, of which roughly 400–500 are skipped
  automatically. A full pull takes about 20 minutes.

**Hosts without an always-on server** (serverless): set `PULL_SCHEDULER=external` and call
the pull every 10–30 minutes. It only runs when one is due:

```bash
# cron on any server
*/10 * * * *  cd /var/www/abf-new-companies && npm run pull >> logs/pull.log 2>&1
# or from a cron service
curl -H "Authorization: Bearer $CRON_SECRET" https://newcompanies.abfaccounting.com/api/cron/pull
```

After changing a rule or threshold, re-check the companies nobody has touched yet (no
Companies House calls):

```bash
npm run pull -- --recheck 2026-11-01 2026-11-30
```

---

## 9. Printing equipment

| What | Spec |
| --- | --- |
| Letters | A4 plain paper, one letter per page, printed from the browser ("Save as PDF" also works). |
| Envelopes | **DL window envelopes**. The address sits in the window, so no label is needed on these. |
| Address labels (optional, for non-window envelopes) | **A4 sheets, 12 labels: 2 across × 6 down, each about 98 × 46 mm.** Check the size on the box before buying. Partly used sheets are fine ("start at label…"). |
| Browser print settings | Scale 100%, margins "None" / "Default", no headers or footers. Print one **test sheet** first. |

---

## 10. Data, privacy and backups

- **Kept for 12 months:** letters, print runs, companies, activity and notifications older than
  12 months are deleted automatically after each morning pull.
- **Never deleted:** the Excluded list, so someone who opted out is never written to again.
- **Backups:** back up the database every night, for example
  `pg_dump -Fc "$DATABASE_URL" > abf-$(date +%F).dump`, and test a restore once.
- Company data comes from the public Companies House register. Staff details (name, email,
  optional mobile) are only visible to the team.

---

## 11. Security (already built in)

- Passwords are hashed with Argon2id. Accounts lock for a while after repeated wrong
  passwords. Reset links expire.
- Sessions are stored server-side and can be ended from **My account → Sign out other devices**.
- Optional two-step sign-in (authenticator app plus recovery codes).
- Only abfaccounting.com emails can register, and registration can be closed.
- Letter templates are cleaned before saving and printing: only safe formatting, links and
  https images are kept.
- Strict security headers (Content-Security-Policy, no framing, HTTPS only in production).

---

## 12. Updating the app later

```bash
cd /var/www/abf-new-companies
git pull
npm ci
npm run db:migrate      # applies any new SQL files in /drizzle
npm run build
pm2 restart abf-new-companies
```

Checks before releasing a change: `npm run typecheck`, `npm run lint`, and the test scripts:

```bash
npx tsx --conditions=react-server scripts/test-eligibility.ts
npx tsx scripts/test-letters.ts
npx tsx --conditions=react-server scripts/test-totp.ts
npx tsx --conditions=react-server scripts/test-retention.ts   # local database only
```

---

## 13. Troubleshooting

| Problem | Check |
| --- | --- |
| No new companies in the morning | **New Companies → Pull details**. Does the Companies House card say "API key not set"? Then add it in **Business settings → Companies House**. Is the server running? With `external`, is the cron running? |
| "Pull failed" email | Usually a Companies House outage or a wrong key. It retries by itself; you can also use **Run pull now** (Companies House card, bottom of the menu). A wrong key: paste a new one in **Business settings → Companies House**. |
| Business settings says the key "can't be read" | `AUTH_ENCRYPTION_KEY` was changed. Paste the Companies House key again. |
| Password-reset emails don't arrive | SMTP settings; run `scripts/test-mail.ts`. Check spam. |
| Letters print too small or cut off | Browser print scale must be 100%, margins default or none. |
| Labels don't line up | Use 2 × 6, 98 × 46 mm sheets; print the test sheet; turn off "fit to page". |
| Someone is locked out | Wait 15 minutes, or use "Forgot password". An admin can delete and recreate the account. |
| Lost authenticator phone | Sign in with a recovery code, then set two-step up again in My account. |

---

## 14. Contact

Built by Web Hosting Guru. For changes or support, contact Web Hosting Guru (Talha Shahid).
