import { query } from '@/lib/db';
import { buildCareSchedule, remindersForToday, type CareApplication, type DewormingSettings } from '@/lib/care';

type ProfileRow = { puppy_name: string; birth_date: string | null };
type Recipient = { id: number; name: string; phone: string; api_key: string; is_active: boolean };

function callMeBotUrl(phone: string, apiKey: string, text: string) {
  const params = new URLSearchParams({ phone, apikey: apiKey, text });
  return `https://api.callmebot.com/whatsapp.php?${params.toString()}`;
}

function todayStr() {
  return new Date().toISOString().slice(0, 10);
}

export async function GET(request: Request) {
  const authHeader = request.headers.get('authorization');
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return Response.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const [profileRows, settingsRows, applicationRows, recipients] = await Promise.all([
      query<ProfileRow>`
        SELECT puppy_name, birth_date::text AS birth_date
        FROM puppy_profile
        WHERE id = 1
      `,
      query<DewormingSettings>`
        SELECT medication_name, dosage, maintenance_interval_days, maintenance_end_age_months
        FROM deworming_settings
        WHERE id = 1
      `,
      query<CareApplication>`
        SELECT event_key, care_type, applied_at::text AS applied_at, product_name, dosage, notes
        FROM care_applications
      `,
      query<Recipient>`
        SELECT id, name, phone, api_key, is_active
        FROM notification_recipients
        WHERE is_active = TRUE
      `,
    ]);

    const profile = profileRows[0] || { puppy_name: '', birth_date: null };
    const settings = settingsRows[0] || {
      medication_name: '',
      dosage: '',
      maintenance_interval_days: 30,
      maintenance_end_age_months: 6,
    };
    const allEvents = buildCareSchedule(profile, settings, applicationRows);
    const reminders = remindersForToday(allEvents);
    const today = todayStr();

    let sent = 0;
    for (const recipient of recipients) {
      for (const event of reminders) {
        const dedupe = await query<{ id: number }>`
          SELECT id
          FROM notification_logs
          WHERE recipient_id = ${recipient.id}
            AND event_key = ${event.event_key}
            AND sent_on = ${today}
          LIMIT 1
        `;
        if (dedupe[0]) continue;

        const dogName = profile.puppy_name ? `${profile.puppy_name}` : 'Seu pet';
        const text = `${dogName}: lembrete ${event.care_type === 'vaccine' ? 'de vacina' : 'de vermifugo'} - ${event.label} (${event.dose_label}) com data ${event.due_date}.`;
        try {
          const response = await fetch(callMeBotUrl(recipient.phone, recipient.api_key, text), { method: 'GET' });
          const responseText = await response.text();
          await query`
            INSERT INTO notification_logs (recipient_id, event_key, due_date, sent_on, status, response_text)
            VALUES (${recipient.id}, ${event.event_key}, ${event.due_date}, ${today}, ${response.ok ? 'sent' : 'failed'}, ${responseText.slice(0, 1800)})
          `;
          if (response.ok) sent += 1;
        } catch (error) {
          await query`
            INSERT INTO notification_logs (recipient_id, event_key, due_date, sent_on, status, response_text)
            VALUES (${recipient.id}, ${event.event_key}, ${event.due_date}, ${today}, 'failed', ${error instanceof Error ? error.message : 'Erro desconhecido'})
          `;
        }
      }
    }

    return Response.json({ ok: true, reminders: reminders.length, recipients: recipients.length, sent });
  } catch (error) {
    return Response.json({ error: error instanceof Error ? error.message : 'Erro no cron.' }, { status: 500 });
  }
}
