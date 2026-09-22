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
    // Pages now fire their independent reads together, so the pool needs room
    // for a batch; too high and many warm instances would exhaust the pooler.
    max: 6,
    idleTimeoutMillis: 10_000,
    connectionTimeoutMillis: 10_000,
  });
}

/**
 * Created on first use, not on import, so a build (which collects page data
 * without database credentials) does not fail. Serverless invocations reuse the
 * module scope, so there is one pool per process.
 */
export function getPool(): Pool {
  if (!globalThis.__classroomPool) {
    globalThis.__classroomPool = createPool();
  }
  return globalThis.__classroomPool;
}

export async function query<T extends Record<string, unknown>>(
  text: string,
  params: unknown[] = [],
): Promise<T[]> {
  const result = await getPool().query(text, params);
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
  const client = await getPool().connect();
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
