import { NextRequest } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const eventKey = String(body.event_key || '').trim();
    const careType = String(body.care_type || '').trim();
    const appliedAt = String(body.applied_at || '').trim();
    const productName = String(body.product_name || '').trim();
    const dosage = String(body.dosage || '').trim();
    const notes = String(body.notes || '').trim();

    if (!eventKey || !careType || !appliedAt) {
      return Response.json({ error: 'Informe evento, tipo e data de aplicacao.' }, { status: 400 });
    }

    await query`
      INSERT INTO care_applications (event_key, care_type, applied_at, product_name, dosage, notes)
      VALUES (${eventKey}, ${careType}, ${appliedAt}, ${productName}, ${dosage}, ${notes})
      ON CONFLICT DO NOTHING
    `;

    await query`
      DELETE FROM care_applications
      WHERE id IN (
        SELECT id
        FROM care_applications
        WHERE event_key = ${eventKey}
        ORDER BY created_at DESC
        OFFSET 1
      )
    `;

    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao registrar aplicacao.' }, { status: 500 });
  }
}

export async function PATCH(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const eventKey = String(body.event_key || '').trim();
    const appliedAt = String(body.applied_at || '').trim();
    const productName = String(body.product_name || '').trim();
    const dosage = String(body.dosage || '').trim();
    const notes = String(body.notes || '').trim();

    if (!eventKey || !appliedAt) {
      return Response.json({ error: 'Informe evento e data de aplicação.' }, { status: 400 });
    }

    await query`
      UPDATE care_applications
      SET applied_at = ${appliedAt}, product_name = ${productName}, dosage = ${dosage}, notes = ${notes}
      WHERE event_key = ${eventKey}
    `;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao editar aplicação.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const eventKey = String(searchParams.get('event_key') || '').trim();
    if (!eventKey) return Response.json({ error: 'event_key obrigatorio.' }, { status: 400 });

    await query`DELETE FROM care_applications WHERE event_key = ${eventKey}`;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao remover aplicacao.' }, { status: 500 });
  }
}
