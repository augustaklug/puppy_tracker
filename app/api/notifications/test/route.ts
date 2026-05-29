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

function callMeBotUrl(phone: string, apiKey: string, text: string) {
  const params = new URLSearchParams({
    phone,
    apikey: apiKey,
    text,
  });
  return `https://api.callmebot.com/whatsapp.php?${params.toString()}`;
}

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    const body = await request.json();
    const recipientId = Number(body.recipient_id);
    if (!recipientId) return Response.json({ error: 'recipient_id obrigatorio.' }, { status: 400 });

    const rows = await query<Recipient>`
      SELECT id, name, phone, api_key, is_active
      FROM notification_recipients
      WHERE id = ${recipientId}
      LIMIT 1
    `;
    const recipient = rows[0];
    if (!recipient) return Response.json({ error: 'Destinatario nao encontrado.' }, { status: 404 });
    if (!recipient.is_active) return Response.json({ error: 'Destinatario inativo.' }, { status: 400 });

    const text = 'Teste do Puppy Tracker: notificacoes de vacinas e vermifugos ativas.';
    const response = await fetch(callMeBotUrl(recipient.phone, recipient.api_key, text), { method: 'GET' });
    const responseText = await response.text();
    if (!response.ok) {
      return Response.json({ error: responseText || 'Falha no envio CallMeBot.' }, { status: 502 });
    }

    return Response.json({ ok: true, response: responseText });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao enviar teste.' }, { status: 500 });
  }
}
