import { NextRequest } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';
import { buildCareSchedule, type CareApplication, type DewormingSettings } from '@/lib/care';

type ProfileRow = { puppy_name: string; birth_date: string | null };
type SettingsRow = DewormingSettings;

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const [profileRows, settingsRows, applications] = await Promise.all([
      query<ProfileRow>`
        SELECT puppy_name, birth_date::text AS birth_date
        FROM puppy_profile
        WHERE id = 1
      `,
      query<SettingsRow>`
        SELECT
          medication_name,
          dosage,
          maintenance_interval_days,
          maintenance_end_age_months
        FROM deworming_settings
        WHERE id = 1
      `,
      query<CareApplication>`
        SELECT event_key, care_type, applied_at::text AS applied_at, product_name, dosage, notes
        FROM care_applications
      `,
    ]);

    const profile = profileRows[0] || { puppy_name: '', birth_date: null };
    const settings = settingsRows[0] || {
      medication_name: '',
      dosage: '',
      maintenance_interval_days: 30,
      maintenance_end_age_months: 6,
    };
    const events = buildCareSchedule(profile, settings, applications);

    return Response.json({ settings, events });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar cronograma.' }, { status: 500 });
  }
}
