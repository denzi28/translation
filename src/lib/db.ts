import { Pool } from "pg";

declare global {
  // eslint-disable-next-line no-var
  var __classroomPool: Pool | undefined;
}

function createPool(): Pool {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error("DATABASE_URL is not set");
  }
  // Hosted Postgres (Supabase's pooler) terminates TLS with a chain Node does
  // not ship a root for; a local development server speaks plain TCP.
  const sslDisabled = /[?&]sslmode=disable\b/.test(connectionString);

  return new Pool({
    connectionString,
    ssl: sslDisabled ? false : { rejectUnauthorized: false },
    max: 3,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

// Serverless invocations reuse the module scope, so keep one pool per process.
export const pool: Pool = globalThis.__classroomPool ?? createPool();
if (process.env.NODE_ENV !== "production") globalThis.__classroomPool = pool;

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await pool.query(text, params);
  return result.rows as T[];
}

export async function queryOne<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T | null> {
  const rows = await query<T>(text, params);
  return rows[0] ?? null;
}

/** Runs `fn` inside a transaction on a single dedicated connection. */
export async function transaction<T>(
  fn: (run: <R extends Record<string, unknown>>(text: string, params?: unknown[]) => Promise<R[]>) => Promise<T>,
): Promise<T> {
  const client = await pool.connect();
  try {
    await client.query("begin");
    const result = await fn(async (text, params = []) => {
      const r = await client.query(text, params);
      return r.rows as never[];
    });
    await client.query("commit");
    return result;
  } catch (error) {
    await client.query("rollback").catch(() => {});
    throw error;
  } finally {
    client.release();
  }
}
