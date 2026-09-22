#!/usr/bin/env node
/**
 * Applies db/0001_init.sql to the database in DATABASE_URL and reports the
 * seeded accounts. Safe to re-run: every statement is idempotent.
 *
 *   DATABASE_URL=postgresql://… npm run db:setup
 */
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import pg from "pg";

const here = dirname(fileURLToPath(import.meta.url));
const sql = readFileSync(join(here, "..", "db", "0001_init.sql"), "utf8");

const connectionString = process.env.DATABASE_URL;
if (!connectionString) {
  console.error("DATABASE_URL is not set.");
  process.exit(1);
}

const client = new pg.Client({
  connectionString,
  ssl: /[?&]sslmode=disable\b/.test(connectionString) ? false : { rejectUnauthorized: false },
});

await client.connect();
try {
  await client.query(sql);
  const { rows } = await client.query(
    "select role, username, full_name from app.users where role <> 'STUDENT' order by role",
  );
  console.log("Schema applied. Pre-seeded accounts:");
  for (const row of rows) console.log(`  ${row.role.padEnd(8)} ${row.username}  (${row.full_name})`);
  console.log("\n  TEACHER devrim.gunay   password: devrim.gunay.123");
  console.log("  ADMIN   admin323123    password: admin323321");
} finally {
  await client.end();
}
