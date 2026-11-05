import "server-only";
import { drizzle } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error("DATABASE_URL is not set. Copy .env.example to .env.local and fill it in.");
}

// Re-use one pool across hot reloads in development.
const globalForDb = globalThis as unknown as { __abfPool?: Pool };

const pool =
  globalForDb.__abfPool ??
  new Pool({
    connectionString,
    max: 10,
    idleTimeoutMillis: 30_000,
    ssl: process.env.DATABASE_SSL === "true" ? { rejectUnauthorized: true } : undefined,
  });

if (process.env.NODE_ENV !== "production") globalForDb.__abfPool = pool;

export const db = drizzle(pool, { schema });
export { schema, pool };
