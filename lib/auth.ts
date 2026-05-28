import { NextRequest } from 'next/server';

export function isAuthorized(request: NextRequest): boolean {
  const configuredToken = process.env.APP_TOKEN;
  if (!configuredToken) return false;

  const authHeader = request.headers.get('authorization') || '';
  const token = authHeader.startsWith('Bearer ') ? authHeader.slice(7).trim() : authHeader.trim();

  return token.length > 0 && token === configuredToken;
}

export function unauthorized() {
  return Response.json(
    { error: 'Acesso não autorizado. Verifique o token informado.' },
    { status: 401 }
  );
}
