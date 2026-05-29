import { NextRequest } from 'next/server';
import { isAuthorized, unauthorized } from '@/lib/auth';
import { query } from '@/lib/db';

type Recipient = {
  id: number;
  name: string;
  phone: string;
  api_key: string;
  is_active: boolean;
};

export async function GET(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const rows = await query<Recipient>`
      SELECT id, name, phone, api_key, is_active
      FROM notification_recipients
      ORDER BY id ASC
    `;
    return Response.json(rows);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao listar destinatarios.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const isActive = body.is_active !== false;

    if (!phone || !apiKey) {
      return Response.json({ error: 'Telefone e api_key sao obrigatorios.' }, { status: 400 });
    }

    const rows = await query<Recipient>`
      INSERT INTO notification_recipients (name, phone, api_key, is_active)
      VALUES (${name}, ${phone}, ${apiKey}, ${isActive})
      RETURNING id, name, phone, api_key, is_active
    `;
    return Response.json(rows[0], { status: 201 });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao criar destinatario.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const id = Number(body.id);
    const name = String(body.name || '').trim();
    const phone = String(body.phone || '').trim();
    const apiKey = String(body.api_key || '').trim();
    const isActive = Boolean(body.is_active);
    if (!id || !phone || !apiKey) {
      return Response.json({ error: 'ID, telefone e api_key sao obrigatorios.' }, { status: 400 });
    }

    const rows = await query<Recipient>`
      UPDATE notification_recipients
      SET
        name = ${name},
        phone = ${phone},
        api_key = ${apiKey},
        is_active = ${isActive},
        updated_at = NOW()
      WHERE id = ${id}
      RETURNING id, name, phone, api_key, is_active
    `;
    return Response.json(rows[0]);
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao atualizar destinatario.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const { searchParams } = new URL(request.url);
    const id = Number(searchParams.get('id'));
    if (!id) return Response.json({ error: 'ID invalido.' }, { status: 400 });

    await query`DELETE FROM notification_recipients WHERE id = ${id}`;
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao remover destinatario.' }, { status: 500 });
  }
}
