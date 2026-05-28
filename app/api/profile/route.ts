import { NextRequest } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const rows = await query<{ puppy_name: string; birth_date: string | null }>`
      SELECT puppy_name, birth_date::text AS birth_date
      FROM puppy_profile
      WHERE id = 1;
    `;
    return Response.json(rows[0] || { puppy_name: '', birth_date: null });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar perfil.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const puppyName = String(body.puppy_name || '').trim();
    const birthDate = body.birth_date ? String(body.birth_date) : null;

    const rows = await query<{ puppy_name: string; birth_date: string | null }>`
      UPDATE puppy_profile
      SET puppy_name = ${puppyName}, birth_date = ${birthDate}, updated_at = NOW()
      WHERE id = 1
      RETURNING puppy_name, birth_date::text AS birth_date;
    `;
    return Response.json(rows[0]);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao salvar perfil.' }, { status: 500 });
  }
}
