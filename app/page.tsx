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
  left: number; right: number; top: number; bottom: number;
  plotW: number; plotH: number; yMin: number; yMax: number; ticks: number[];
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

function formatAge(birthDate: string | null, measuredAt: string): string {
  if (!birthDate) return '';
  const birth = new Date(birthDate);
  const measured = new Date(measuredAt);
  const days = Math.floor((measured.getTime() - birth.getTime()) / 86_400_000);
  if (days < 0) return '';
  if (days < 112) {
    const weeks = Math.floor(days / 7);
    return weeks === 1 ? '1 sem' : `${weeks} sem`;
  }
  const totalMonths = Math.floor(days / 30.4375);
  if (totalMonths < 24) {
    return totalMonths === 1 ? '1 mês' : `${totalMonths} meses`;
  }
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (months === 0) return years === 1 ? '1 ano' : `${years} anos`;
  return `${years} a ${months} m`;
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
  const weights = entries.map((e) => Number(e.weight_kg));
  const maxWeight = weights.length ? Math.max(...weights) : 1;
  const tickCount = 4;
  const step = niceStep((maxWeight * 1.05) / tickCount);
  const yMax = Math.max(step * tickCount, step);
  const yMin = 0;
  const left = 62; const right = 34; const top = 24; const bottom = 34;
  const plotW = width - left - right;
  const plotH = height - top - bottom;
  const ticks = Array.from({ length: tickCount + 1 }, (_, i) => yMax - i * step);
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
  return entries.map((entry, i) => {
    const { x, y } = pointFor(entry, i, entries.length, scale);
    return `${i === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
  }).join(' ');
}

function GrowthChart({ entries }: { entries: WeightEntry[] }) {
  const [hovered, setHovered] = useState<{ entry: WeightEntry; x: number; y: number } | null>(null);
  const width = 720;
  const height = 320;
  const scale = getChartScale(entries, width, height);
  const path = makePath(entries, scale);
  const axisBottom = height - scale.bottom;
  const axisRight = width - scale.right;
  const fillPath = path ? `${path} L ${axisRight.toFixed(2)} ${axisBottom} L ${scale.left} ${axisBottom} Z` : '';
  const last = entries[entries.length - 1];

  return (
    <div className="chart-card">
      <div className="chart-header">
        <span className="chart-title">Curva de crescimento</span>
        {last && (
          <span className="chart-meta">
            Último: <strong>{formatKg(Number(last.weight_kg))} kg</strong> — {formatDate(last.measured_at)}
          </span>
        )}
      </div>
      <div className="chart-wrap">
        {entries.length === 0 ? (
          <div className="empty-chart">
            <svg width="40" height="40" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"><path d="M3 17l6-6 4 4 8-10" /></svg>
            <span>Registre a primeira pesagem para ver o gráfico</span>
          </div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de crescimento do filhote">
            <defs>
              <linearGradient id="areaGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stopColor="#b11f58" stopOpacity="0.14" />
                <stop offset="100%" stopColor="#b11f58" stopOpacity="0" />
              </linearGradient>
            </defs>
            <text x="18" y="166" className="axis-label" transform="rotate(-90 18 166)">kg</text>
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
            <line x1={scale.left} y1={scale.top} x2={scale.left} y2={axisBottom} className="axis" />
            <line x1={scale.left} y1={axisBottom} x2={axisRight} y2={axisBottom} className="axis" />
            <path d={fillPath} fill="url(#areaGrad)" />
            <path d={path} className="growth-line" />
            {hovered && (
              <line x1={hovered.x} y1={hovered.y} x2={hovered.x} y2={axisBottom} className="tooltip-guide" />
            )}
            {entries.map((entry, i) => {
              const { x, y } = pointFor(entry, i, entries.length, scale);
              const isHovered = hovered?.entry.id === entry.id;
              return (
                <g
                  key={entry.id}
                  className="point-hitbox"
                  onMouseEnter={() => setHovered({ entry, x, y })}
                  onMouseLeave={() => setHovered(null)}
                  onFocus={() => setHovered({ entry, x, y })}
                  onBlur={() => setHovered(null)}
                  tabIndex={0}
                  role="img"
                  aria-label={`${formatKg(Number(entry.weight_kg))} kg em ${formatDate(entry.measured_at)}`}
                >
                  <circle cx={x} cy={y} r={18} className="point-target" />
                  <circle cx={x} cy={y} r={isHovered ? 7 : 5} className="point" />
                </g>
              );
            })}
            {entries.map((entry, i) => {
              if (i !== 0 && i !== entries.length - 1 && entries.length > 6) return null;
              const { x } = pointFor(entry, i, entries.length, scale);
              return (
                <text key={`${entry.id}-d`} x={x} y={310} textAnchor="middle" className="date-label">
                  {formatDate(entry.measured_at).slice(0, 5)}
                </text>
              );
            })}
            {hovered && (() => {
              const tipW = 136; const tipH = 58;
              const tipX = hovered.x > width * 0.65 ? hovered.x - tipW - 14 : hovered.x + 14;
              const tipY = Math.max(scale.top, hovered.y - tipH / 2);
              return (
                <g>
                  <rect x={tipX} y={tipY} width={tipW} height={tipH} rx={10} ry={10} className="tooltip-box" />
                  <text x={tipX + 13} y={tipY + 23} className="tooltip-title">{formatKg(Number(hovered.entry.weight_kg))} kg</text>
                  <text x={tipX + 13} y={tipY + 42} className="tooltip-date">{formatDate(hovered.entry.measured_at)}</text>
                </g>
              );
            })()}
          </svg>
        )}
      </div>
    </div>
  );
}

function readImageAsDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

type WeightMetric = { deltaKg: number | null; deltaPct: number | null; gPerDay: number | null; daysDiff: number | null };

function WeightVariation({ m }: { m: WeightMetric | undefined }) {
  if (!m || m.deltaKg === null) return <span className="muted-cell">—</span>;
  const isGain = m.deltaKg >= 0;
  const sign = isGain ? '+' : '';
  const gPerDayStr = m.gPerDay !== null ? `${m.gPerDay >= 0 ? '+' : ''}${Math.round(m.gPerDay)} g/dia` : null;
  const daysStr = m.daysDiff !== null && m.daysDiff > 0 ? `${m.daysDiff} dia${m.daysDiff !== 1 ? 's' : ''}` : null;
  return (
    <div className="metric-cell">
      <span className={`delta-main ${isGain ? 'delta-gain' : 'delta-loss'}`}>
        {isGain ? '▲' : '▼'} {sign}{formatKg(m.deltaKg)} kg
      </span>
      <span className="delta-sub">
        {sign}{m.deltaPct!.toFixed(1).replace('.', ',')}%
        {gPerDayStr && ` · ${gPerDayStr}`}
        {daysStr && ` (${daysStr})`}
      </span>
    </div>
  );
}

function StatusBadge({ event }: { event: CareEvent }) {
  if (event.is_overdue) return <span className="badge badge-overdue">Vencida</span>;
  if (event.is_due_soon) return <span className="badge badge-soon">Em breve</span>;
  return <span className="badge badge-ok">Pendente</span>;
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

  const [activeTab, setActiveTab] = useState<'peso' | 'cuidados' | 'notificacoes'>('peso');
  const [careTab, setCareTab] = useState<'agendados' | 'historico'>('agendados');
  const [isWeightModalOpen, setIsWeightModalOpen] = useState(false);
  const [editingEntry, setEditingEntry] = useState<WeightEntry | null>(null);
  const [isApplicationModalOpen, setIsApplicationModalOpen] = useState(false);
  const [editingCareApplication, setEditingCareApplication] = useState<CareEvent | null>(null);
  const [isDewormingSettingsOpen, setIsDewormingSettingsOpen] = useState(false);
  const [isAddRecipientOpen, setIsAddRecipientOpen] = useState(false);

  const authHeaders = useMemo(() => ({ Authorization: `Bearer ${token}` }), [token]);

  async function api(path: string, options: RequestInit = {}) {
    const response = await fetch(path, {
      ...options,
      headers: { ...authHeaders, 'Content-Type': 'application/json', ...(options.headers || {}) },
    });
    const data = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(data.error || 'Erro inesperado.');
    return data;
  }

  async function runBusy(action: string, fn: () => Promise<void>) {
    setBusyAction(action);
    try { await fn(); } finally { setBusyAction(''); }
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
        setMessage(error instanceof Error ? error.message : 'Não foi possível acessar.');
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
    setProfileDraft((c) => ({ ...c, avatar_data_url: dataUrl }));
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-weight', async () => {
      try {
        const weightKg = Number(String(entryDraft.weight_kg).replace(',', '.'));
        if (editingEntry) {
          await api('/api/weights', { method: 'PATCH', body: JSON.stringify({ id: editingEntry.id, ...entryDraft, weight_kg: weightKg }) });
          setMessage('Pesagem atualizada.');
        } else {
          await api('/api/weights', { method: 'POST', body: JSON.stringify({ ...entryDraft, weight_kg: weightKg }) });
          setMessage('Pesagem registrada.');
        }
        setEntryDraft({ measured_at: new Date().toISOString().slice(0, 10), weight_kg: '', notes: '' });
        setEditingEntry(null);
        setIsWeightModalOpen(false);
        await loadAll();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao salvar pesagem.');
      }
    });
  }

  function openEditWeight(entry: WeightEntry) {
    setEditingEntry(entry);
    setEntryDraft({ measured_at: entry.measured_at, weight_kg: String(entry.weight_kg), notes: entry.notes });
    setIsWeightModalOpen(true);
  }

  function closeWeightModal() {
    setIsWeightModalOpen(false);
    setEditingEntry(null);
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
        setIsDewormingSettingsOpen(false);
        await loadAll();
        setMessage('Configuração salva.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao salvar configuração.');
      }
    });
  }

  async function markApplied(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    await runBusy('save-application', async () => {
      try {
        if (editingCareApplication) {
          await api('/api/care/applications', { method: 'PATCH', body: JSON.stringify(applicationDraft) });
          setMessage('Aplicação atualizada.');
        } else {
          await api('/api/care/applications', { method: 'POST', body: JSON.stringify(applicationDraft) });
          setMessage('Aplicação registrada.');
        }
        setEditingCareApplication(null);
        setIsApplicationModalOpen(false);
        await loadAll();
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao salvar aplicação.');
      }
    });
  }

  function openEditCareApplication(careEvent: CareEvent) {
    setEditingCareApplication(careEvent);
    setApplicationDraft({
      event_key: careEvent.event_key,
      care_type: careEvent.care_type,
      applied_at: careEvent.applied_at || new Date().toISOString().slice(0, 10),
      product_name: careEvent.product_name || '',
      dosage: careEvent.dosage || '',
      notes: careEvent.notes || '',
    });
    setIsApplicationModalOpen(true);
  }

  function closeApplicationModal() {
    setIsApplicationModalOpen(false);
    setEditingCareApplication(null);
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
        setIsAddRecipientOpen(false);
        await loadAll();
        setMessage('Destinatário adicionado.');
      } catch (error) {
        setMessage(error instanceof Error ? error.message : 'Erro ao adicionar destinatário.');
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
      setMessage('Mensagem de teste enviada.');
    });
  }

  function openApplicationModal(event: CareEvent) {
    setApplicationDraft({
      event_key: event.event_key,
      care_type: event.care_type,
      applied_at: new Date().toISOString().slice(0, 10),
      product_name: event.care_type === 'deworming' ? deworming.medication_name : '',
      dosage: event.care_type === 'deworming' ? deworming.dosage : '',
      notes: '',
    });
    setIsApplicationModalOpen(true);
  }

  const pending = schedule.filter((i) => !i.is_applied).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const applied = schedule.filter((i) => i.is_applied).sort((a, b) => (b.applied_at || '').localeCompare(a.applied_at || ''));
  const overdue = pending.filter((e) => e.is_overdue);
  const soon = pending.filter((e) => e.is_due_soon && !e.is_overdue);
  const nextByTreatmentMap = new Map<string, CareEvent>();
  for (const item of pending) {
    if (!nextByTreatmentMap.has(item.label)) nextByTreatmentMap.set(item.label, item);
  }
  const scheduled = Array.from(nextByTreatmentMap.values()).sort((a, b) => a.due_date.localeCompare(b.due_date));
  const pendingForSelect = scheduled.filter((i) => !i.is_applied);

  const weightMetrics = useMemo(() => {
    const sorted = [...entries].sort((a, b) => a.measured_at.localeCompare(b.measured_at));
    const map = new Map<number, WeightMetric>();
    sorted.forEach((entry, i) => {
      if (i === 0) {
        map.set(entry.id, { deltaKg: null, deltaPct: null, gPerDay: null, daysDiff: null });
      } else {
        const prev = sorted[i - 1];
        const deltaKg = Number(entry.weight_kg) - Number(prev.weight_kg);
        const deltaPct = (deltaKg / Number(prev.weight_kg)) * 100;
        const ms = new Date(entry.measured_at).getTime() - new Date(prev.measured_at).getTime();
        const daysDiff = Math.round(ms / 86_400_000);
        const gPerDay = daysDiff > 0 ? (deltaKg * 1000) / daysDiff : null;
        map.set(entry.id, { deltaKg, deltaPct, gPerDay, daysDiff });
      }
    });
    return map;
  }, [entries]);

  if (!isAuthed) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="login-paw">🐾</div>
          <div className="script-title">Acompanhamento</div>
          <p>Informe o token para acessar os registros do filhote.</p>
          <form onSubmit={handleLogin} className="login-form">
            <label>Token de acesso
              <input type="password" value={token} onChange={(e) => setToken(e.target.value)} placeholder="••••••••" />
            </label>
            <button disabled={busyAction === 'login'} type="submit">
              {busyAction === 'login' ? 'Entrando…' : 'Entrar'}
            </button>
          </form>
          {message && <div className="message error">{message}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="page">

      {/* ── Hero ── */}
      <header className="hero">
        <div className="hero-avatar-wrap">
          <div className="pet-avatar large">
            {profile.avatar_data_url ? <img src={profile.avatar_data_url} alt="Foto do pet" /> : <span>🐾</span>}
          </div>
        </div>
        <div className="hero-copy">
          <div className="script-title">{profile.puppy_name || 'Meu filhote'}</div>
          <p className="hero-sub">Crescimento e cuidados</p>
          <div className="hero-stats">
            <div className="stat-pill">
              <span className="stat-val">{pending.length}</span>
              <span className="stat-lbl">Pendentes</span>
            </div>
            <div
              className={`stat-pill${overdue.length > 0 ? ' stat-danger' : ''}`}
              onClick={() => { if (overdue.length > 0) { setActiveTab('cuidados'); setCareTab('agendados'); } }}
              style={{ cursor: overdue.length > 0 ? 'pointer' : 'default' }}
              title={overdue.length > 0 ? 'Ver eventos vencidos' : undefined}
            >
              <span className="stat-val">{overdue.length}</span>
              <span className="stat-lbl">Vencidos</span>
            </div>
            <div className="stat-pill">
              <span className="stat-val">{soon.length}</span>
              <span className="stat-lbl">Em breve</span>
            </div>
          </div>
        </div>
        <button className="edit-profile-btn" type="button" onClick={() => setIsProfileModalOpen(true)}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7" /><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z" /></svg>
          Editar perfil
        </button>
      </header>

      {/* ── Tab bar ── */}
      <nav className="tab-nav" role="tablist">
        <button role="tab" aria-selected={activeTab === 'peso'} className={`tab-btn${activeTab === 'peso' ? ' active' : ''}`} onClick={() => setActiveTab('peso')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M3 17l6-6 4 4 8-10" /></svg>
          Peso e crescimento
        </button>
        <button role="tab" aria-selected={activeTab === 'cuidados'} className={`tab-btn${activeTab === 'cuidados' ? ' active' : ''}`} onClick={() => setActiveTab('cuidados')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M9 12l2 2 4-4" /><circle cx="12" cy="12" r="9" /></svg>
          Cuidados
          {overdue.length > 0 && <span className="tab-badge">{overdue.length}</span>}
        </button>
        <button role="tab" aria-selected={activeTab === 'notificacoes'} className={`tab-btn${activeTab === 'notificacoes' ? ' active' : ''}`} onClick={() => setActiveTab('notificacoes')}>
          <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M22 16.92v3a2 2 0 0 1-2.18 2 19.79 19.79 0 0 1-8.63-3.07A19.5 19.5 0 0 1 4.64 13.5a19.79 19.79 0 0 1-3.07-8.67A2 2 0 0 1 3.55 3h3a2 2 0 0 1 2 1.72c.127.96.361 1.903.7 2.81a2 2 0 0 1-.45 2.11L7.91 10.6a16 16 0 0 0 6 6l.91-.91a2 2 0 0 1 2.11-.45c.907.339 1.85.573 2.81.7A2 2 0 0 1 21.5 18l.42-1.08z" /></svg>
          Notificações
        </button>
      </nav>

      {message && <div className="message">{message}</div>}

      {/* ── Peso tab ── */}
      {activeTab === 'peso' && (
        <div className="tab-panel">
          <GrowthChart entries={entries} />

          <section className="card">
            <div className="card-header">
              <div className="section-title">Histórico de pesagens</div>
              <button type="button" className="action-btn" onClick={() => { setEditingEntry(null); setEntryDraft({ measured_at: new Date().toISOString().slice(0, 10), weight_kg: '', notes: '' }); setIsWeightModalOpen(true); }}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Registrar pesagem
              </button>
            </div>
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Data</th>
                    <th>Idade</th>
                    <th>Peso</th>
                    <th>Variação</th>
                    <th>Observações</th>
                    <th></th>
                  </tr>
                </thead>
                <tbody>
                  {entries.length === 0
                    ? <tr><td colSpan={6} className="empty-row">Nenhuma pesagem registrada ainda.</td></tr>
                    : entries.map((entry) => {
                      const age = formatAge(profile.birth_date, entry.measured_at);
                      return (
                        <tr key={entry.id}>
                          <td>{formatDate(entry.measured_at)}</td>
                          <td className="muted-cell">{age || '—'}</td>
                          <td><strong>{Number(entry.weight_kg).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })} kg</strong></td>
                          <td><WeightVariation m={weightMetrics.get(entry.id)} /></td>
                          <td className="muted-cell">{entry.notes || '—'}</td>
                          <td className="row-actions">
                            <button type="button" className="ghost" onClick={() => openEditWeight(entry)}>Editar</button>
                            <button type="button" className="ghost ghost-danger" onClick={() => deleteEntry(entry.id)}>Excluir</button>
                          </td>
                        </tr>
                      );
                    })}
                </tbody>
              </table>
            </div>
          </section>
        </div>
      )}

      {/* ── Cuidados tab ── */}
      {activeTab === 'cuidados' && (
        <div className="tab-panel">
          <div className="inner-tab-bar">
            <div className="inner-tabs">
              <button className={`inner-tab${careTab === 'agendados' ? ' active' : ''}`} onClick={() => setCareTab('agendados')}>
                Agendados
                {scheduled.length > 0 && <span className="inner-count">{scheduled.length}</span>}
              </button>
              <button className={`inner-tab${careTab === 'historico' ? ' active' : ''}`} onClick={() => setCareTab('historico')}>
                Histórico aplicado
                {applied.length > 0 && <span className="inner-count">{applied.length}</span>}
              </button>
            </div>
            <button type="button" className="gear-btn" onClick={() => setIsDewormingSettingsOpen(true)}>
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" /></svg>
              Vermifugação
            </button>
          </div>

          {careTab === 'agendados' && (
            <section className="card">
              {!profile.birth_date
                ? <p className="info-msg">Cadastre a data de nascimento no perfil para gerar o cronograma.</p>
                : (
                  <div className="table-wrap">
                    <table>
                      <thead><tr><th>Tipo</th><th>Dose</th><th>Janela</th><th>Prevista</th><th>Status</th><th></th></tr></thead>
                      <tbody>
                        {scheduled.length === 0
                          ? <tr><td colSpan={6} className="empty-row">Nenhum agendamento pendente.</td></tr>
                          : scheduled.map((event) => (
                            <tr key={event.event_key}>
                              <td>
                                <span className={`type-chip ${event.care_type}`}>{event.care_type === 'vaccine' ? 'Vacina' : 'Vermífugo'}</span>
                                {event.label}
                              </td>
                              <td>{event.dose_label}</td>
                              <td className="muted-cell">
                                {event.window_start && event.window_end ? `${formatDate(event.window_start)} – ${formatDate(event.window_end)}` : '—'}
                              </td>
                              <td>{formatDate(event.due_date)}</td>
                              <td><StatusBadge event={event} /></td>
                              <td>
                                <button type="button" className="register-btn" onClick={() => openApplicationModal(event)}>
                                  Registrar
                                </button>
                              </td>
                            </tr>
                          ))}
                      </tbody>
                    </table>
                  </div>
                )}
            </section>
          )}

          {careTab === 'historico' && (
            <section className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Tipo</th><th>Dose</th><th>Aplicada em</th><th>Produto</th><th></th></tr></thead>
                  <tbody>
                    {applied.length === 0
                      ? <tr><td colSpan={5} className="empty-row">Nenhuma dose aplicada ainda.</td></tr>
                      : applied.map((event) => (
                        <tr key={event.event_key}>
                          <td>
                            <span className={`type-chip ${event.care_type}`}>{event.care_type === 'vaccine' ? 'Vacina' : 'Vermífugo'}</span>
                            {event.label}
                          </td>
                          <td>{event.dose_label}</td>
                          <td>{formatDate(event.applied_at || '')}</td>
                          <td className="muted-cell">{event.product_name || '—'}</td>
                          <td className="row-actions">
                            <button type="button" className="ghost" onClick={() => openEditCareApplication(event)}>Editar</button>
                            <button type="button" className="ghost" onClick={() => unmarkApplied(event.event_key)}>Desfazer</button>
                          </td>
                        </tr>
                      ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </div>
      )}

      {/* ── Notificações tab ── */}
      {activeTab === 'notificacoes' && (
        <div className="tab-panel">
          <section className="card">
            <div className="card-header">
              <div>
                <div className="section-title">Destinatários WhatsApp</div>
                <p className="section-sub">Lembretes automáticos via CallMeBot</p>
              </div>
              <button type="button" className="action-btn" onClick={() => setIsAddRecipientOpen(true)}>
                <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round"><line x1="12" y1="5" x2="12" y2="19" /><line x1="5" y1="12" x2="19" y2="12" /></svg>
                Adicionar número
              </button>
            </div>
            {recipients.length === 0
              ? <p className="info-msg">Nenhum destinatário cadastrado.</p>
              : (
                <div className="recipient-list">
                  {recipients.map((r) => (
                    <div key={r.id} className="recipient-row">
                      <div className="recipient-info">
                        <div className="recipient-avatar">{(r.name || '?')[0].toUpperCase()}</div>
                        <div>
                          <div className="recipient-name">{r.name || 'Sem nome'}</div>
                          <div className="recipient-phone">{r.phone}</div>
                        </div>
                        <span className={`status-pill ${r.is_active ? 'active' : 'inactive'}`}>
                          {r.is_active ? 'Ativo' : 'Inativo'}
                        </span>
                      </div>
                      <div className="recipient-actions">
                        <button disabled={busyAction === `test-${r.id}`} type="button" className="ghost" onClick={() => testRecipient(r.id)}>
                          {busyAction === `test-${r.id}` ? 'Enviando…' : 'Testar'}
                        </button>
                        <button type="button" className="ghost" onClick={() => toggleRecipient(r)}>
                          {r.is_active ? 'Desativar' : 'Ativar'}
                        </button>
                        <button type="button" className="ghost ghost-danger" onClick={() => removeRecipient(r.id)}>Excluir</button>
                      </div>
                    </div>
                  ))}
                </div>
              )}
          </section>
        </div>
      )}

      {/* ════ Modals ════ */}

      {isProfileModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <div><div className="section-title">Editar perfil</div><p>Dados do seu filhote</p></div>
              <button type="button" className="close-btn" onClick={() => setIsProfileModalOpen(false)}>✕</button>
            </div>
            <form onSubmit={saveProfile} className="form-grid">
              <div className="avatar-editor wide">
                <div className="pet-avatar">{profileDraft.avatar_data_url ? <img src={profileDraft.avatar_data_url} alt="Foto do pet" /> : <span>🐾</span>}</div>
                <div className="avatar-actions">
                  <label className="file-label">Alterar foto<input type="file" accept="image/*" onChange={(e) => handleAvatarChange(e.target.files?.[0])} /></label>
                </div>
              </div>
              <label>Nome<input value={profileDraft.puppy_name} onChange={(e) => setProfileDraft({ ...profileDraft, puppy_name: e.target.value })} /></label>
              <label>Data de nascimento<input type="date" value={profileDraft.birth_date || ''} onChange={(e) => setProfileDraft({ ...profileDraft, birth_date: e.target.value || null })} /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={() => setIsProfileModalOpen(false)}>Cancelar</button>
                <button disabled={busyAction === 'save-profile'} type="submit">{busyAction === 'save-profile' ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isWeightModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <div>
                <div className="section-title">{editingEntry ? 'Editar pesagem' : 'Registrar pesagem'}</div>
                <p>{editingEntry ? 'Altere os dados da pesagem' : 'Novo registro de peso'}</p>
              </div>
              <button type="button" className="close-btn" onClick={closeWeightModal}>✕</button>
            </div>
            <form onSubmit={addEntry} className="form-grid">
              <label>Data<input type="date" value={entryDraft.measured_at} onChange={(e) => setEntryDraft({ ...entryDraft, measured_at: e.target.value })} required /></label>
              <label>Peso (kg)<input value={entryDraft.weight_kg} onChange={(e) => setEntryDraft({ ...entryDraft, weight_kg: e.target.value })} placeholder="Ex: 3,5" required /></label>
              <label className="wide">Observações<textarea value={entryDraft.notes} onChange={(e) => setEntryDraft({ ...entryDraft, notes: e.target.value })} placeholder="Opcional" /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={closeWeightModal}>Cancelar</button>
                <button disabled={busyAction === 'save-weight'} type="submit">{busyAction === 'save-weight' ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isApplicationModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <div>
                <div className="section-title">{editingCareApplication ? 'Editar aplicação' : 'Registrar aplicação'}</div>
                <p>Confirme os dados da vacina ou vermífugo</p>
              </div>
              <button type="button" className="close-btn" onClick={closeApplicationModal}>✕</button>
            </div>
            <form onSubmit={markApplied} className="form-grid">
              {editingCareApplication ? (
                <div className="wide event-info">
                  <span className={`type-chip ${editingCareApplication.care_type}`}>
                    {editingCareApplication.care_type === 'vaccine' ? 'Vacina' : 'Vermífugo'}
                  </span>
                  {editingCareApplication.label} — {editingCareApplication.dose_label}
                </div>
              ) : (
                <label className="wide">Evento
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
                    {pendingForSelect.map((event) => (
                      <option key={event.event_key} value={event.event_key}>{event.label} — {event.dose_label} ({formatDate(event.due_date)})</option>
                    ))}
                  </select>
                </label>
              )}
              <label>Data aplicada<input type="date" value={applicationDraft.applied_at} onChange={(e) => setApplicationDraft({ ...applicationDraft, applied_at: e.target.value })} required /></label>
              <label>Produto<input value={applicationDraft.product_name} onChange={(e) => setApplicationDraft({ ...applicationDraft, product_name: e.target.value })} /></label>
              <label>Posologia<input value={applicationDraft.dosage} onChange={(e) => setApplicationDraft({ ...applicationDraft, dosage: e.target.value })} /></label>
              <label className="wide">Observações<textarea value={applicationDraft.notes} onChange={(e) => setApplicationDraft({ ...applicationDraft, notes: e.target.value })} /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={closeApplicationModal}>Cancelar</button>
                <button disabled={busyAction === 'save-application'} type="submit">{busyAction === 'save-application' ? 'Salvando…' : editingCareApplication ? 'Salvar' : 'Registrar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isDewormingSettingsOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <div><div className="section-title">Configurar vermifugação</div><p>Medicamento e protocolo de manutenção</p></div>
              <button type="button" className="close-btn" onClick={() => setIsDewormingSettingsOpen(false)}>✕</button>
            </div>
            <form onSubmit={saveDewormingSettings} className="form-grid">
              <label>Medicamento<input value={deworming.medication_name} onChange={(e) => setDeworming({ ...deworming, medication_name: e.target.value })} /></label>
              <label>Posologia<input value={deworming.dosage} onChange={(e) => setDeworming({ ...deworming, dosage: e.target.value })} /></label>
              <label>Intervalo de manutenção (dias)<input type="number" min={1} value={deworming.maintenance_interval_days} onChange={(e) => setDeworming({ ...deworming, maintenance_interval_days: Number(e.target.value) || 30 })} /></label>
              <label>Idade final (meses)<input type="number" min={1} value={deworming.maintenance_end_age_months} onChange={(e) => setDeworming({ ...deworming, maintenance_end_age_months: Number(e.target.value) || 6 })} /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={() => setIsDewormingSettingsOpen(false)}>Cancelar</button>
                <button disabled={busyAction === 'save-deworm'} type="submit">{busyAction === 'save-deworm' ? 'Salvando…' : 'Salvar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

      {isAddRecipientOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true">
          <section className="modal-card">
            <div className="modal-header">
              <div><div className="section-title">Adicionar destinatário</div><p>Configure o número para receber lembretes</p></div>
              <button type="button" className="close-btn" onClick={() => setIsAddRecipientOpen(false)}>✕</button>
            </div>
            <form onSubmit={addRecipient} className="form-grid">
              <label>Nome<input value={recipientDraft.name} onChange={(e) => setRecipientDraft({ ...recipientDraft, name: e.target.value })} /></label>
              <label>Telefone com DDI<input value={recipientDraft.phone} onChange={(e) => setRecipientDraft({ ...recipientDraft, phone: e.target.value })} required placeholder="+55119…" /></label>
              <label className="wide">API Key (CallMeBot)<input value={recipientDraft.api_key} onChange={(e) => setRecipientDraft({ ...recipientDraft, api_key: e.target.value })} required /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={() => setIsAddRecipientOpen(false)}>Cancelar</button>
                <button disabled={busyAction === 'save-recipient'} type="submit">{busyAction === 'save-recipient' ? 'Salvando…' : 'Adicionar'}</button>
              </div>
            </form>
          </section>
        </div>
      )}

    </main>
  );
}
