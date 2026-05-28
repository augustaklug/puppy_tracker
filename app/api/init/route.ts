import { NextRequest } from 'next/server';
import { ensureSchema } from '@/lib/db';
import { isAuthorized, unauthorized } from '@/lib/auth';

export async function POST(request: NextRequest) {
  if (!isAuthorized(request)) return unauthorized();
  try {
    await ensureSchema();
    return Response.json({ ok: true });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro ao inicializar.' }, { status: 500 });
  }
}
