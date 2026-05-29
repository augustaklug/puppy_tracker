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
      avatar_data_url TEXT,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT only_one_profile CHECK (id = 1)
    );
  `;

  await sql`
    ALTER TABLE puppy_profile
    ADD COLUMN IF NOT EXISTS avatar_data_url TEXT;
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
    CREATE TABLE IF NOT EXISTS deworming_settings (
      id INTEGER PRIMARY KEY DEFAULT 1,
      medication_name TEXT NOT NULL DEFAULT '',
      dosage TEXT NOT NULL DEFAULT '',
      maintenance_interval_days INTEGER NOT NULL DEFAULT 30,
      maintenance_end_age_months INTEGER NOT NULL DEFAULT 6,
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      CONSTRAINT only_one_deworming_settings CHECK (id = 1)
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS care_applications (
      id SERIAL PRIMARY KEY,
      event_key TEXT NOT NULL,
      care_type TEXT NOT NULL,
      applied_at DATE NOT NULL,
      product_name TEXT NOT NULL DEFAULT '',
      dosage TEXT NOT NULL DEFAULT '',
      notes TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notification_recipients (
      id SERIAL PRIMARY KEY,
      name TEXT NOT NULL DEFAULT '',
      phone TEXT NOT NULL,
      api_key TEXT NOT NULL,
      is_active BOOLEAN NOT NULL DEFAULT TRUE,
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
    );
  `;

  await sql`
    CREATE TABLE IF NOT EXISTS notification_logs (
      id SERIAL PRIMARY KEY,
      recipient_id INTEGER NOT NULL REFERENCES notification_recipients(id) ON DELETE CASCADE,
      event_key TEXT NOT NULL,
      due_date DATE NOT NULL,
      sent_on DATE NOT NULL,
      status TEXT NOT NULL,
      response_text TEXT NOT NULL DEFAULT '',
      created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      UNIQUE (recipient_id, event_key, sent_on)
    );
  `;

  await sql`
    INSERT INTO puppy_profile (id, puppy_name, birth_date, avatar_data_url)
    VALUES (1, '', NULL, NULL)
    ON CONFLICT (id) DO NOTHING;
  `;

  await sql`
    INSERT INTO deworming_settings (id, medication_name, dosage, maintenance_interval_days, maintenance_end_age_months)
    VALUES (1, '', '', 30, 6)
    ON CONFLICT (id) DO NOTHING;
  `;

  initialized = true;
}

export async function query<T = Record<string, unknown>>(strings: TemplateStringsArray, ...values: unknown[]) {
  await ensureSchema();
  const sql = getSql();
  return sql(strings, ...values) as Promise<T[]>;
}
