import { NextRequest } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const rows = await query`
      SELECT id, measured_at::text AS measured_at, weight_kg::float AS weight_kg, notes
      FROM puppy_weights
      ORDER BY measured_at ASC, id ASC;
    `;
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao carregar pesagens.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const measuredAt = String(body.measured_at || '').trim();
    const weightKg = Number(body.weight_kg);
    const notes = String(body.notes || '').trim();

    if (!measuredAt || Number.isNaN(weightKg) || weightKg <= 0) {
      return Response.json({ error: 'Informe uma data e um peso em kg maior que zero.' }, { status: 400 });
    }

    const rows = await query`
      INSERT INTO puppy_weights (measured_at, weight_kg, notes)
      VALUES (${measuredAt}, ${weightKg}, ${notes})
      RETURNING id, measured_at::text AS measured_at, weight_kg::float AS weight_kg, notes;
    `;
    return Response.json(rows[0], { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao salvar pesagem.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const id = Number(body.id);
    const measuredAt = String(body.measured_at || '').trim();
    const weightKg = Number(body.weight_kg);
    const notes = String(body.notes || '').trim();

    if (!id || !measuredAt || Number.isNaN(weightKg) || weightKg <= 0) {
      return Response.json({ error: 'Informe um ID, data e peso válidos.' }, { status: 400 });
    }

    const rows = await query`
      UPDATE puppy_weights
      SET measured_at = ${measuredAt}, weight_kg = ${weightKg}, notes = ${notes}
      WHERE id = ${id}
      RETURNING id, measured_at::text AS measured_at, weight_kg::float AS weight_kg, notes;
    `;
    return Response.json(rows[0]);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao editar pesagem.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return Response.json({ error: 'ID inválido.' }, { status: 400 });

    await query`DELETE FROM puppy_weights WHERE id = ${id};`;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao excluir pesagem.' }, { status: 500 });
  }
}
