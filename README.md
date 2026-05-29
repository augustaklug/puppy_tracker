# Puppy Tracker

Aplicação Next.js para acompanhar o crescimento e os cuidados de saúde do seu filhote — pesagens, vacinação, vermifugação e lembretes automáticos via WhatsApp.

## Funcionalidades

- **Perfil do filhote** — nome, data de nascimento e foto
- **Curva de crescimento** — gráfico interativo com histórico de pesagens e métricas de variação (kg, %, g/dia)
- **Cronograma de cuidados** — agenda de vacinas e vermifugações gerada automaticamente a partir da data de nascimento, com janelas de aplicação e status (pendente, em breve, vencida)
- **Histórico de aplicações** — registro de vacinas e vermífugos aplicados com produto e posologia
- **Notificações WhatsApp** — lembretes diários enviados via [CallMeBot](https://www.callmebot.com/) para múltiplos destinatários, com cron configurado no Vercel

## Stack

- **Framework:** Next.js 15 (App Router)
- **Banco de dados:** PostgreSQL via [NeonDB](https://neon.tech)
- **Deploy:** Vercel
- **Notificações:** CallMeBot (WhatsApp)

## Variáveis de ambiente

Crie um arquivo `.env.local` (veja o modelo em [.env.example](.env.example)):

| Variável | Descrição |
|---|---|
| `DATABASE_URL` | String de conexão PostgreSQL da NeonDB |
| `APP_TOKEN` | Token de acesso ao app |
| `CRON_SECRET` | Token para autenticar a rota de cron (`/api/cron/reminders`) — configure também no painel da Vercel |

## Rodando localmente

```bash
npm install
npm run dev
```

Acesse `http://localhost:3000`, informe o token e comece a registrar dados do filhote.

## Banco de dados

As tabelas são criadas automaticamente no primeiro acesso autenticado (rota `POST /api/init`):

| Tabela | Conteúdo |
|---|---|
| `puppy_profile` | Nome, data de nascimento e avatar |
| `puppy_weights` | Histórico de pesagens |
| `care_applications` | Vacinas e vermífugos aplicados |
| `deworming_settings` | Medicamento e protocolo de manutenção |
| `notification_recipients` | Destinatários WhatsApp |
| `notification_logs` | Log de mensagens enviadas |

## Notificações WhatsApp

1. Obtenha uma `api_key` do CallMeBot para cada número (siga as instruções do site).
2. Cadastre os destinatários na aba **Notificações** do app (telefone com DDI, ex: `+5511999…`).
3. Use o botão **Testar** para validar o envio antes de ativar.
4. Em produção, o `vercel.json` agenda o cron diariamente às 11h UTC (`0 11 * * *`) para chamar `/api/cron/reminders`.

> A rota de cron exige o header `Authorization: Bearer <CRON_SECRET>` — o Vercel envia isso automaticamente quando configurado no painel.

## Deploy na Vercel

1. Crie um projeto na Vercel apontando para este repositório.
2. Configure as três variáveis de ambiente no painel.
3. O cron do `vercel.json` será registrado automaticamente no deploy.
