'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Profile = { puppy_name: string; birth_date: string | null; avatar_data_url: string | null };
type WeightEntry = { id: number; measured_at: string; weight_kg: number; notes: string };
type CareEvent = {
  event_key: string;
  care_type: 'vaccine' | 'deworming';
  label: string;
  dose_label: string;
  due_date: string;
  window_start: string | null;
  window_end: string | null;
  is_applied: boolean;
  applied_at: string | null;
  notes: string;
  product_name: string;
  dosage: string;
  is_overdue: boolean;
  is_due_soon: boolean;
};
type DewormingSettings = {
  medication_name: string;
  dosage: string;
  maintenance_interval_days: number;
  maintenance_end_age_months: number;
};
type Recipient = { id: number; name: string; phone: string; api_key: string; is_active: boolean };

type ChartScale = {
  left: number;
  right: number;
  top: number;
  bottom: number;
  plotW: number;
  plotH: number;
  yMin: number;
  yMax: number;
  ticks: number[];
};

function formatDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
}

function formatKg(value: number) {
  return value.toLocaleString('pt-BR', {
    minimumFractionDigits: value % 1 === 0 ? 0 : 1,
    maximumFractionDigits: 3,
  });
}

function niceStep(rawStep: number) {
  if (rawStep <= 0) return 1;
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = 10 ** exponent;
  const fraction = rawStep / magnitude;
  if (fraction <= 1) return 1 * magnitude;
  if (fraction <= 2) return 2 * magnitude;
  if (fraction <= 2.5) return 2.5 * magnitude;
  if (fraction <= 5) return 5 * magnitude;
  return 10 * magnitude;
}

function getChartScale(entries: WeightEntry[], width: number, height: number): ChartScale {
  const weights = entries.map((entry) => Number(entry.weight_kg));
  const maxWeight = weights.length ? Math.max(...weights) : 1;
  const tickCount = 4;
  const step = niceStep((maxWeight * 1.05) / tickCount);
  const yMax = Math.max(step * tickCount, step);
  const yMin = 0;
  const left = 62;
  const right = 34;
  const top = 24;
  const bottom = 34;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const ticks = Array.from({ length: tickCount + 1 }, (_, index) => yMax - index * step);
  return { left, right, top, bottom, plotW, plotH, yMin, yMax, ticks };
}

function pointFor(entry: WeightEntry, index: number, total: number, scale: ChartScale) {
  const x = total === 1 ? scale.left + scale.plotW / 2 : scale.left + (index / (total - 1)) * scale.plotW;
  const ratio = (Number(entry.weight_kg) - scale.yMin) / (scale.yMax - scale.yMin);
  const y = scale.top + (1 - ratio) * scale.plotH;
  return { x, y };
}

function makePath(entries: WeightEntry[], scale: ChartScale) {
  if (!entries.length) return '';
  return entries
    .map((entry, index) => {
      const { x, y } = pointFor(entry, index, entries.length, scale);
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function GrowthChart({ entries }: { entries: WeightEntry[] }) {
  const width = 720;
  const height = 320;
  const scale = getChartScale(entries, width, height);
  const path = makePath(entries, scale);
  const axisBottom = height - scale.bottom;
  const axisRight = width - scale.right;

  return (
    <section className="card chart-card">
      <div className="section-title">Grafico de crescimento</div>
      <div className="chart-wrap">
        {entries.length === 0 ? (
          <div className="empty-chart">Cadastre a primeira pesagem para visualizar o grafico.</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Grafico de crescimento do filhote">
            <text x="18" y="166" className="axis-label" transform="rotate(-90 18 166)">Peso (kg)</text>
            <line x1={scale.left} y1={scale.top} x2={scale.left} y2={axisBottom} className="axis" />
            <line x1={scale.left} y1={axisBottom} x2={axisRight} y2={axisBottom} className="axis" />
            {scale.ticks.map((tick) => {
              const ratio = (tick - scale.yMin) / (scale.yMax - scale.yMin);
              const y = scale.top + (1 - ratio) * scale.plotH;
              return (
                <g key={tick}>
                  <line x1={scale.left} y1={y} x2={axisRight} y2={y} className="grid" />
                  <text x={scale.left - 12} y={y + 4} textAnchor="end" className="tick">{formatKg(tick)}</text>
                </g>
              );
            })}
            <path d={path} className="growth-line" />
            {entries.map((entry, index) => {
              const { x, y } = pointFor(entry, index, entries.length, scale);
              return <circle key={entry.id} cx={x} cy={y} r="5" className="point" />;
            })}
            {entries.map((entry, index) => {
              if (index !== 0 && index !== entries.length - 1 && entries.length > 6) return null;
              const { x } = pointFor(entry, index, entries.length, scale);
              return <text key={`${entry.id}-date`} x={x} y="310" textAnchor="middle" className="date-label">{formatDate(entry.measured_at).slice(0, 5)}</text>;
            })}
          </svg>
        )}
      </div>
    </section>
  );
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Nao foi possivel ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [message, setMessage] = useState('');
  const [busyAction, setBusyAction] = useState('');
  const [profile, setProfile] = useState<Profile>({ puppy_name: '', birth_date: null, avatar_data_url: null });
  const [profileDraft, setProfileDraft] = useState<Profile>({ puppy_name: '', birth_date: null, avatar_data_url: null });
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [entryDraft, setEntryDraft] = useState({ measured_at: new Date().toISOString().slice(0, 10), weight_kg: '', notes: '' });
  const [schedule, setSchedule] = useState<CareEvent[]>([]);
  const [deworming, setDeworming] = useState<DewormingSettings>({ medication_name: '', dosage: '', maintenance_interval_days: 30, maintenance_end_age_months: 6 });
  const [recipients, setRecipients] = useState<Recipient[]>([]);
  const [applicationDraft, setApplicationDraft] = useState({
    event_key: '',
    care_type: 'vaccine' as 'vaccine' | 'deworming',
    applied_at: new Date().toISOString().slice(0, 10),
    product_name: '',
    dosage: '',
    notes: '',
  });
  const [recipientDraft, setRecipientDraft] = useState({ name: '', phone: '', api_key: '', is_active: true });

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: {
        ...authHeaders,
        'Content-Type': 'application/json',
        ...(options.headers || {}),
      },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erro inesperado.');
    return data;
  }

  async function runBusy(action: string, fn: () => Promise<void>) {
    setBusyAction(action);
    try {
      await fn();
    } finally {
      setBusyAction('');
    }
  }

  async function loadAll() {
    const [profileData, weightsData, scheduleData, recipientData] = await Promise.all([
      api('/api/profile'),
      api('/api/weights'),
      api('/api/care/schedule'),
      api('/api/notifications/recipients'),
    ]);
    setProfile(profileData);
    setProfileDraft(profileData);
    setEntries(weightsData);
    setSchedule(scheduleData.events || []);
    setDeworming(scheduleData.settings || deworming);
    setRecipients(recipientData || []);
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem('puppy-token') || '';
    if (savedToken) setToken(savedToken);
  }, []);

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('login', async () => {
      try {
        window.localStorage.setItem('puppy-token', token);
        await api('/api/init', { method: 'POST', body: '{}' });
        await loadAll();
        setIsAuthed(true);
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Nao foi possivel acessar.');
      }
    });
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-profile', async () => {
      try {
        const saved = await api('/api/profile', { method: 'PUT', body: JSON.stringify(profileDraft) });
        setProfile(saved);
        setProfileDraft(saved);
        setIsProfileModalOpen(false);
        await loadAll();
        setMessage('Perfil salvo.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
      }
    });
  }

  async function handleAvatarChange(file?: File) {
    if (!file) return;
    const dataUrl = await readImageAsDataUrl(file);
    setProfileDraft((current) => ({ ...current, avatar_data_url: dataUrl }));
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-weight', async () => {
      try {
        await api('/api/weights', { method: 'POST', body: JSON.stringify({ ...entryDraft, weight_kg: Number(String(entryDraft.weight_kg).replace(',', '.')) }) });
        setEntryDraft({ measured_at: new Date().toISOString().slice(0, 10), weight_kg: '', notes: '' });
        await loadAll();
        setMessage('Pesagem cadastrada.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao cadastrar pesagem.');
      }
    });
  }

  async function deleteEntry(id: number) {
    setMessage('');
    await api(`/api/weights?id=${id}`, { method: 'DELETE' });
    await loadAll();
  }

  async function saveDewormingSettings(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-deworm', async () => {
      try {
        await api('/api/care/deworming-settings', { method: 'PUT', body: JSON.stringify(deworming) });
        await loadAll();
        setMessage('Configuracao de vermifugacao salva.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao salvar configuracao.');
      }
    });
  }

  async function markApplied(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-application', async () => {
      try {
        await api('/api/care/applications', { method: 'POST', body: JSON.stringify(applicationDraft) });
        await loadAll();
        setMessage('Aplicacao registrada.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao registrar aplicacao.');
      }
    });
  }

  async function unmarkApplied(eventKey: string) {
    setMessage('');
    await api(`/api/care/applications?event_key=${encodeURIComponent(eventKey)}`, { method: 'DELETE' });
    await loadAll();
  }

  async function addRecipient(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-recipient', async () => {
      try {
        await api('/api/notifications/recipients', { method: 'POST', body: JSON.stringify(recipientDraft) });
        setRecipientDraft({ name: '', phone: '', api_key: '', is_active: true });
        await loadAll();
        setMessage('Destinatario adicionado.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao adicionar destinatario.');
      }
    });
  }

  async function toggleRecipient(recipient: Recipient) {
    await api('/api/notifications/recipients', { method: 'PUT', body: JSON.stringify({ ...recipient, is_active: !recipient.is_active }) });
    await loadAll();
  }
  async function removeRecipient(id: number) {
    await api(`/api/notifications/recipients?id=${id}`, { method: 'DELETE' });
    await loadAll();
  }
  async function testRecipient(id: number) {
    await runBusy(`test-${id}`, async () => {
      await api('/api/notifications/test', { method: 'POST', body: JSON.stringify({ recipient_id: id }) });
      setMessage('Teste enviado para o WhatsApp.');
    });
  }

  const pending = schedule.filter((item) => !item.is_applied).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const applied = schedule.filter((item) => item.is_applied).sort((a, b) => (b.applied_at || '').localeCompare(a.applied_at || ''));
  const overdue = pending.filter((event) => event.is_overdue);
  const soon = pending.filter((event) => event.is_due_soon && !event.is_overdue);
  const nextByTreatmentMap = new Map<string, CareEvent>();
  for (const item of pending) {
    if (!nextByTreatmentMap.has(item.label)) {
      nextByTreatmentMap.set(item.label, item);
    }
  }
  const scheduled = Array.from(nextByTreatmentMap.values()).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pendingForSelect = scheduled.filter((item) => !item.is_applied);

  if (!isAuthed) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="script-title">Crescimento do filhote</div>
          <h1>Acompanhamento</h1>
          <p>Informe o token configurado para acessar os registros.</p>
          <form onSubmit={handleLogin} className="login-form">
            <label>Token de acesso<input type="password" value={token} onChange={(event) => setToken(event.target.value)} /></label>
            <button disabled={busyAction === 'login'} type="submit">{busyAction === 'login' ? 'Entrando...' : 'Entrar'}</button>
          </form>
          {message && <div className="message error">{message}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <button className="edit-profile-button" type="button" onClick={() => setIsProfileModalOpen(true)}>Editar</button>
        <div className="hero-copy">
          <div className="script-title">{profile.puppy_name ? `${profile.puppy_name}: crescimento e cuidados` : 'Crescimento e cuidados'}</div>
          <h1>Painel do filhote</h1>
          <p>Pesagem, vacinas, vermifugacao e lembretes por WhatsApp.</p>
        </div>
        <div className="hero-avatar-wrap"><div className="pet-avatar large">{profile.avatar_data_url ? <img src={profile.avatar_data_url} alt="Foto do pet" /> : <span>PET</span>}</div></div>
      </header>

      <div className="stats">
        <div><span>Eventos pendentes</span><strong>{pending.length}</strong></div>
        <div><span>Vencidos</span><strong>{overdue.length}</strong></div>
        <div><span>Vencendo em 3 dias</span><strong>{soon.length}</strong></div>
      </div>

      {message && <div className="message">{message}</div>}

      {isProfileModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <form onSubmit={saveProfile} className="form-grid">
              <div className="avatar-editor wide">
                <div className="pet-avatar">{profileDraft.avatar_data_url ? <img src={profileDraft.avatar_data_url} alt="Foto do pet" /> : <span>PET</span>}</div>
                <div className="avatar-actions"><label className="file-label">Foto<input type="file" accept="image/*" onChange={(e) => handleAvatarChange(e.target.files?.[0])} /></label></div>
              </div>
              <label>Nome<input value={profileDraft.puppy_name} onChange={(e) => setProfileDraft({ ...profileDraft, puppy_name: e.target.value })} /></label>
              <label>Data de nascimento<input type="date" value={profileDraft.birth_date || ''} onChange={(e) => setProfileDraft({ ...profileDraft, birth_date: e.target.value || null })} /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={() => setIsProfileModalOpen(false)}>Cancelar</button>
                <button disabled={busyAction === 'save-profile'} type="submit">{busyAction === 'save-profile' ? 'Salvando...' : 'Salvar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="card">
        <div className="section-title">Nova pesagem</div>
        <form onSubmit={addEntry} className="form-grid">
          <label>Data<input type="date" value={entryDraft.measured_at} onChange={(e) => setEntryDraft({ ...entryDraft, measured_at: e.target.value })} required /></label>
          <label>Peso (kg)<input value={entryDraft.weight_kg} onChange={(e) => setEntryDraft({ ...entryDraft, weight_kg: e.target.value })} required /></label>
          <label className="wide">Observacoes<textarea value={entryDraft.notes} onChange={(e) => setEntryDraft({ ...entryDraft, notes: e.target.value })} /></label>
          <button disabled={busyAction === 'save-weight'} type="submit">{busyAction === 'save-weight' ? 'Salvando...' : 'Adicionar'}</button>
        </form>
      </section>

      <section className="card table-card">
        <div className="section-title">Historico de pesagens</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Data</th><th>Peso (kg)</th><th>Observacoes</th><th></th></tr></thead>
            <tbody>
              {entries.length === 0 ? <tr><td colSpan={4} className="empty-row">Nenhuma pesagem cadastrada.</td></tr> : entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{formatDate(entry.measured_at)}</td>
                  <td>{Number(entry.weight_kg).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                  <td>{entry.notes || '-'}</td>
                  <td><button type="button" className="ghost" onClick={() => deleteEntry(entry.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <GrowthChart entries={entries} />

      <section className="card table-card">
        <div className="section-title">Vacinas e vermifugos agendados</div>
        {!profile.birth_date ? <p>Cadastre a data de nascimento no perfil para gerar o cronograma.</p> : (
          <div className="table-wrap">
            <table>
              <thead><tr><th>Tipo</th><th>Dose</th><th>Janela</th><th>Prevista</th><th>Status</th></tr></thead>
              <tbody>
                {scheduled.length === 0 ? <tr><td colSpan={5} className="empty-row">Nenhum agendamento pendente.</td></tr> : scheduled.map((event) => (
                  <tr key={event.event_key}>
                    <td>{event.label}</td>
                    <td>{event.dose_label}</td>
                    <td>{event.window_start && event.window_end ? `${formatDate(event.window_start)} a ${formatDate(event.window_end)}` : '-'}</td>
                    <td>{formatDate(event.due_date)}</td>
                    <td>{event.is_overdue ? 'Vencida' : event.is_due_soon ? 'Vence em breve' : 'Pendente'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="card table-card">
        <div className="section-title">Vacinas e vermifugos aplicados</div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Tipo</th><th>Dose</th><th>Aplicada em</th><th>Produto</th><th></th></tr></thead>
            <tbody>
              {applied.length === 0 ? <tr><td colSpan={5} className="empty-row">Nenhuma dose aplicada.</td></tr> : applied.map((event) => (
                <tr key={event.event_key}>
                  <td>{event.label}</td>
                  <td>{event.dose_label}</td>
                  <td>{formatDate(event.applied_at || '')}</td>
                  <td>{event.product_name || '-'}</td>
                  <td><button type="button" className="ghost" onClick={() => unmarkApplied(event.event_key)}>Desfazer</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="card">
        <div className="section-title">Marcar aplicacao</div>
        <form onSubmit={markApplied} className="form-grid">
          <label>Evento
            <select value={applicationDraft.event_key} onChange={(e) => {
              const eventKey = e.target.value;
              const found = pendingForSelect.find((item) => item.event_key === eventKey);
              setApplicationDraft((old) => ({
                ...old,
                event_key: eventKey,
                care_type: found?.care_type || old.care_type,
                product_name: found?.care_type === 'deworming' ? deworming.medication_name : old.product_name,
                dosage: found?.care_type === 'deworming' ? deworming.dosage : old.dosage,
              }));
            }}>
              <option value="">Selecione</option>
              {pendingForSelect.map((event) => <option key={event.event_key} value={event.event_key}>{event.label} - {event.dose_label} ({formatDate(event.due_date)})</option>)}
            </select>
          </label>
          <label>Data aplicada<input type="date" value={applicationDraft.applied_at} onChange={(e) => setApplicationDraft({ ...applicationDraft, applied_at: e.target.value })} required /></label>
          <label>Produto<input value={applicationDraft.product_name} onChange={(e) => setApplicationDraft({ ...applicationDraft, product_name: e.target.value })} /></label>
          <label>Posologia<input value={applicationDraft.dosage} onChange={(e) => setApplicationDraft({ ...applicationDraft, dosage: e.target.value })} /></label>
          <label className="wide">Observacoes<textarea value={applicationDraft.notes} onChange={(e) => setApplicationDraft({ ...applicationDraft, notes: e.target.value })} /></label>
          <button disabled={busyAction === 'save-application'} type="submit">{busyAction === 'save-application' ? 'Salvando...' : 'Registrar aplicacao'}</button>
        </form>
      </section>

      <section className="card">
        <div className="section-title">Configuracao de vermifugacao</div>
        <form onSubmit={saveDewormingSettings} className="form-grid">
          <label>Medicamento<input value={deworming.medication_name} onChange={(e) => setDeworming({ ...deworming, medication_name: e.target.value })} /></label>
          <label>Posologia<input value={deworming.dosage} onChange={(e) => setDeworming({ ...deworming, dosage: e.target.value })} /></label>
          <label>Intervalo de manutencao (dias)<input type="number" min={1} value={deworming.maintenance_interval_days} onChange={(e) => setDeworming({ ...deworming, maintenance_interval_days: Number(e.target.value) || 30 })} /></label>
          <label>Idade final (meses)<input type="number" min={1} value={deworming.maintenance_end_age_months} onChange={(e) => setDeworming({ ...deworming, maintenance_end_age_months: Number(e.target.value) || 6 })} /></label>
          <button disabled={busyAction === 'save-deworm'} type="submit">{busyAction === 'save-deworm' ? 'Salvando...' : 'Salvar configuracao'}</button>
        </form>
      </section>

      <section className="card table-card">
        <div className="section-title">Destinatarios WhatsApp (CallMeBot)</div>
        <form onSubmit={addRecipient} className="form-grid">
          <label>Nome<input value={recipientDraft.name} onChange={(e) => setRecipientDraft({ ...recipientDraft, name: e.target.value })} /></label>
          <label>Telefone com DDI<input value={recipientDraft.phone} onChange={(e) => setRecipientDraft({ ...recipientDraft, phone: e.target.value })} required /></label>
          <label className="wide">API Key<input value={recipientDraft.api_key} onChange={(e) => setRecipientDraft({ ...recipientDraft, api_key: e.target.value })} required /></label>
          <button disabled={busyAction === 'save-recipient'} type="submit">{busyAction === 'save-recipient' ? 'Salvando...' : 'Adicionar numero'}</button>
        </form>
        <div className="table-wrap" style={{ marginTop: 12 }}>
          <table>
            <thead><tr><th>Nome</th><th>Telefone</th><th>Status</th><th>Acoes</th></tr></thead>
            <tbody>
              {recipients.length === 0 ? <tr><td colSpan={4} className="empty-row">Nenhum numero cadastrado.</td></tr> : recipients.map((recipient) => (
                <tr key={recipient.id}>
                  <td>{recipient.name || '-'}</td>
                  <td>{recipient.phone}</td>
                  <td>{recipient.is_active ? 'Ativo' : 'Inativo'}</td>
                  <td>
                    <button disabled={busyAction === `test-${recipient.id}`} type="button" className="ghost" onClick={() => testRecipient(recipient.id)}>{busyAction === `test-${recipient.id}` ? 'Enviando...' : 'Testar'}</button>{' '}
                    <button type="button" className="ghost" onClick={() => toggleRecipient(recipient)}>{recipient.is_active ? 'Desativar' : 'Ativar'}</button>{' '}
                    <button type="button" className="ghost" onClick={() => removeRecipient(recipient.id)}>Excluir</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
