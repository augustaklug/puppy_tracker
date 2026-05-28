import { neon } from '@neondatabase/serverless';

let initialized = false;

function getSql() {
  const url = process.env.DATABASE_URL;
  if (!url) {
    throw new Error('DATABASE_URL não configurada.');
  }
  return neon(url);
}

export async function ensureSchema() {
  if (initialized) return;
  const sql = getSql();

  await sql`
    CREATE TABLE IF NOT EXISTS puppy_profile (
      id INTEGER PRIMARY KEY DEFAULT 1,
      puppy_name TEXT NOT NULL DEFAULT '',
      birth_date DATE,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT only_one_profile CHECK (id = 1)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS puppy_weights (
      id SERIAL PRIMARY KEY,
      measured_at DATE NOT NULL,
      weight_kg NUMERIC(7,3) NOT NULL,
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    INSERT INTO puppy_profile (id, puppy_name, birth_date)
    VALUES (1, '', NULL)
    ON CONFLICT (id) DO NOTHING;
  `;

  initialized = true;
}

export async function query<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) {
  await ensureSchema();
  const sql = getSql();
  return sql(strings, ...values) as Promise<T[]>;
}
