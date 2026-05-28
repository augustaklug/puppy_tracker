# Acompanhamento de Peso do Filhote

Aplicação simples em Next.js para acompanhar o crescimento de um filhote em kg, com gráfico e persistência em Neon Postgres.

## Variáveis de ambiente

Configure no Vercel:

- `DATABASE_URL`: string de conexão da NeonDB.
- `APP_TOKEN`: token simples usado para acessar o app.

## Rodar localmente

```bash
npm install
cp .env.example .env.local
npm run dev
```

Acesse `http://localhost:3000`, informe o token e comece a cadastrar pesagens.

## Banco de dados

As tabelas são criadas automaticamente no primeiro acesso autenticado à API.
