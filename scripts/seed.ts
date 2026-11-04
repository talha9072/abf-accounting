/**
 * Seeds a local admin account for development.
 *   npm run db:seed
 *
 * Reads SEED_ADMIN_EMAIL / SEED_ADMIN_PASSWORD from .env.local.
 * If no password is set, a strong random one is generated and written back
 * to .env.local (never printed), so you can sign in with it.
 */
import { randomBytes } from "node:crypto";
import { appendFileSync, readFileSync } from "node:fs";
import { hash } from "@node-rs/argon2";
import { Client } from "pg";

for (const f of [".env.local", ".env"]) {
  try {
    process.loadEnvFile(f);
  } catch {}
}

async function main() {
  if (process.env.NODE_ENV === "production") throw new Error("Refusing to seed in production.");
  const url = process.env.DATABASE_URL;
  if (!url) throw new Error("DATABASE_URL missing");

  const email = (process.env.SEED_ADMIN_EMAIL ?? "admin@abfaccounting.com").trim().toLowerCase();
  let password = process.env.SEED_ADMIN_PASSWORD;
  if (!password) {
    password = randomBytes(12).toString("base64url");
    const env = readFileSync(".env.local", "utf8");
    const nl = env.endsWith("\n") ? "" : "\n";
    appendFileSync(
      ".env.local",
      `${nl}\n# Local dev admin created by npm run db:seed\nSEED_ADMIN_EMAIL=${email}\nSEED_ADMIN_PASSWORD=${password}\n`,
    );
  }

  const passwordHash = await hash(password, { algorithm: 2, memoryCost: 19_456, timeCost: 2, parallelism: 1, outputLen: 32 });
  const client = new Client({ connectionString: url });
  await client.connect();
  try {
    await client.query(
      `INSERT INTO users (email, first_name, last_name, password_hash, role)
       VALUES ($1, 'Abi', 'Brown', $2, 'admin')
       ON CONFLICT (email) DO UPDATE SET password_hash = EXCLUDED.password_hash, updated_at = now()`,
      [email, passwordHash],
    );
    await client.query(
      `INSERT INTO business_settings (id, brand_name, address_line, support_telephone, support_email, website, reference_prefix, registration_line)
       VALUES (1, 'ABF Accounting Services Ltd', '18 Thricknells Close, Luton, LU3 3RP', '+44 7405 141694', 'support@abfaccounting.com',
               'abfaccounting.com', 'ABF-', 'Registered in England and Wales No. 15299101')
       ON CONFLICT (id) DO NOTHING`,
    );
    console.log(`Seeded admin ${email} (password is in .env.local → SEED_ADMIN_PASSWORD).`);
  } finally {
    await client.end();
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
