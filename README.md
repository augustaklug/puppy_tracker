# Acompanhamento de Peso e Cuidados do Filhote

Aplicacao em Next.js para acompanhar peso, protocolo vacinal, vermifugacao e lembretes por WhatsApp (CallMeBot).

## Variaveis de ambiente

Configure no Vercel:

- `DATABASE_URL`: string de conexao da NeonDB.
- `APP_TOKEN`: token simples para acessar o app.
- `CRON_SECRET`: token usado pela rota de cron `/api/cron/reminders`.

## Rodar localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`, informe o token e cadastre pesagens, vacinas, vermifugos e destinatarios de notificacao.

## Banco de dados

As tabelas sao criadas automaticamente no primeiro acesso autenticado:

- `puppy_profile`
- `puppy_weights`
- `deworming_settings`
- `care_applications`
- `notification_recipients`
- `notification_logs`

## WhatsApp com CallMeBot

1. Cadastre um ou mais numeros (com DDI) e `api_key` do CallMeBot.
2. Use o botao de teste para validar envio.
3. Em producao, o `vercel.json` agenda cron diario para chamar `/api/cron/reminders`.
