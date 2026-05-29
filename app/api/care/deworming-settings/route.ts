import { NextRequest } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';

type SettingsRow = {
  medication_name: string;
  dosage: string;
  maintenance_interval_days: number;
  maintenance_end_age_months: number;
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const rows = await query<SettingsRow>`
      SELECT medication_name, dosage, maintenance_interval_days, maintenance_end_age_months
      FROM deworming_settings
      WHERE id = 1
    `;
    return Response.json(rows[0] || {
      medication_name: '',
      dosage: '',
      maintenance_interval_days: 30,
      maintenance_end_age_months: 6,
    });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar configuracao.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const medicationName = String(body.medication_name || '').trim();
    const dosage = String(body.dosage || '').trim();
    const maintenanceIntervalDays = Number(body.maintenance_interval_days || 30);
    const maintenanceEndAgeMonths = Number(body.maintenance_end_age_months || 6);

    if (!Number.isFinite(maintenanceIntervalDays) || maintenanceIntervalDays < 1 || maintenanceIntervalDays > 180) {
      return Response.json({ error: 'Intervalo de manutencao invalido.' }, { status: 400 });
    }
    if (!Number.isFinite(maintenanceEndAgeMonths) || maintenanceEndAgeMonths < 1 || maintenanceEndAgeMonths > 24) {
      return Response.json({ error: 'Idade final invalida.' }, { status: 400 });
    }

    const rows = await query<SettingsRow>`
      UPDATE deworming_settings
      SET
        medication_name = ${medicationName},
        dosage = ${dosage},
        maintenance_interval_days = ${maintenanceIntervalDays},
        maintenance_end_age_months = ${maintenanceEndAgeMonths},
        updated_at = NOW()
      WHERE id = 1
      RETURNING medication_name, dosage, maintenance_interval_days, maintenance_end_age_months
    `;
    return Response.json(rows[0]);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao salvar configuracao.' }, { status: 500 });
  }
}
