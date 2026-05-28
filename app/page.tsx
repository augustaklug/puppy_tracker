'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Profile = { puppy_name: string; birth_date: string | null; avatar_data_url: string | null };
type WeightEntry = { id: number; measured_at: string; weight_kg: number; notes: string };
type ChartTooltip = { x: number; y: number; entry: WeightEntry } | null;

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

function calculateAge(measuredAt: string, birthDate?: string | null) {
  if (!birthDate || !measuredAt) return '—';
  const start = new Date(`${birthDate}T00:00:00`);
  const end = new Date(`${measuredAt}T00:00:00`);
  const days = Math.max(0, Math.round((end.getTime() - start.getTime()) / 86400000));
  const weeks = Math.floor(days / 7);
  const rest = days % 7;
  if (weeks === 0) return `${days} dia${days === 1 ? '' : 's'}`;
  return `${weeks} sem${weeks === 1 ? '' : 's'}${rest ? ` + ${rest}d` : ''}`;
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
  const [tooltip, setTooltip] = useState<ChartTooltip>(null);

  return (
    <section className="card chart-card">
      <div className="section-title">Gráfico de crescimento</div>
      <div className="chart-wrap">
        {entries.length === 0 ? (
          <div className="empty-chart">Cadastre a primeira pesagem para visualizar o gráfico.</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de crescimento do filhote" onMouseLeave={() => setTooltip(null)}>
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
              return (
                <g key={entry.id} onMouseEnter={() => setTooltip({ x, y, entry })} onFocus={() => setTooltip({ x, y, entry })} tabIndex={0} className="point-hitbox">
                  <circle cx={x} cy={y} r="14" className="point-target" />
                  <circle cx={x} cy={y} r="5" className="point" />
                </g>
              );
            })}
            {tooltip && (
              <g className="tooltip-layer" pointerEvents="none">
                <line x1={tooltip.x} y1={tooltip.y} x2={tooltip.x} y2={axisBottom} className="tooltip-guide" />
                <rect x={Math.min(Math.max(tooltip.x - 75, scale.left), axisRight - 150)} y={Math.max(tooltip.y - 74, scale.top)} width="150" height="54" rx="14" className="tooltip-box" />
                <text x={Math.min(Math.max(tooltip.x, scale.left + 75), axisRight - 75)} y={Math.max(tooltip.y - 51, scale.top + 23)} textAnchor="middle" className="tooltip-title">
                  {formatKg(Number(tooltip.entry.weight_kg))} kg
                </text>
                <text x={Math.min(Math.max(tooltip.x, scale.left + 75), axisRight - 75)} y={Math.max(tooltip.y - 30, scale.top + 44)} textAnchor="middle" className="tooltip-date">
                  {formatDate(tooltip.entry.measured_at)}
                </text>
              </g>
            )}
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
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem.'));
    reader.readAsDataURL(file);
  });
}

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [isProfileModalOpen, setIsProfileModalOpen] = useState(false);
  const [profile, setProfile] = useState<Profile>({ puppy_name: '', birth_date: null, avatar_data_url: null });
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [message, setMessage] = useState('');
  const [profileDraft, setProfileDraft] = useState<Profile>({ puppy_name: '', birth_date: null, avatar_data_url: null });
  const [entryDraft, setEntryDraft] = useState({ measured_at: new Date().toISOString().slice(0, 10), weight_kg: '', notes: '' });

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

  async function loadAll() {
    const [profileData, weightsData] = await Promise.all([api('/api/profile'), api('/api/weights')]);
    setProfile(profileData);
    setProfileDraft(profileData);
    setEntries(weightsData);
  }

  useEffect(() => {
    const savedToken = window.localStorage.getItem('puppy-token') || '';
    if (savedToken) setToken(savedToken);
  }, []);

  function openProfileModal() {
    setProfileDraft(profile);
    setIsProfileModalOpen(true);
  }

  function closeProfileModal() {
    setProfileDraft(profile);
    setIsProfileModalOpen(false);
  }

  async function handleLogin(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      window.localStorage.setItem('puppy-token', token);
      await api('/api/init', { method: 'POST', body: '{}' });
      await loadAll();
      setIsAuthed(true);
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Não foi possível acessar.');
    }
  }

  async function saveProfile(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      const saved = await api('/api/profile', { method: 'PUT', body: JSON.stringify(profileDraft) });
      setProfile(saved);
      setProfileDraft(saved);
      setIsProfileModalOpen(false);
      setMessage('Perfil salvo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
    }
  }

  async function handleAvatarChange(file?: File) {
    if (!file) return;
    setMessage('');
    try {
      if (!file.type.startsWith('image/')) {
        setMessage('Selecione um arquivo de imagem.');
        return;
      }
      if (file.size > 700000) {
        setMessage('A foto é muito grande. Use uma imagem menor que 700 KB.');
        return;
      }
      const dataUrl = await readImageAsDataUrl(file);
      setProfileDraft((current) => ({ ...current, avatar_data_url: dataUrl }));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao carregar foto.');
    }
  }

  async function addEntry(event: FormEvent) {
    event.preventDefault();
    setMessage('');
    try {
      await api('/api/weights', {
        method: 'POST',
        body: JSON.stringify({ ...entryDraft, weight_kg: Number(String(entryDraft.weight_kg).replace(',', '.')) }),
      });
      setEntryDraft({ measured_at: new Date().toISOString().slice(0, 10), weight_kg: '', notes: '' });
      await loadAll();
      setMessage('Pesagem cadastrada.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao cadastrar pesagem.');
    }
  }

  async function deleteEntry(id: number) {
    setMessage('');
    try {
      await api(`/api/weights?id=${id}`, { method: 'DELETE' });
      setEntries((current) => current.filter((entry) => entry.id !== id));
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao excluir pesagem.');
    }
  }

  const lastEntry = entries.at(-1);
  const firstEntry = entries[0];
  const gain = firstEntry && lastEntry ? Number(lastEntry.weight_kg) - Number(firstEntry.weight_kg) : 0;

  if (!isAuthed) {
    return (
      <main className="login-page">
        <div className="login-card">
          <div className="script-title">Crescimento do filhote</div>
          <h1>Acompanhamento de peso</h1>
          <p>Informe o token configurado no Vercel para acessar os registros.</p>
          <form onSubmit={handleLogin} className="login-form">
            <label>
              Token de acesso
              <input type="password" value={token} onChange={(event) => setToken(event.target.value)} placeholder="Digite o token" />
            </label>
            <button type="submit">Entrar</button>
          </form>
          {message && <div className="message error">{message}</div>}
        </div>
      </main>
    );
  }

  return (
    <main className="page">
      <header className="hero">
        <button className="edit-profile-button" type="button" onClick={openProfileModal} aria-label="Editar dados do filhote">
          <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true">
            <path d="M4 20h4.2L19.4 8.8a2.1 2.1 0 0 0 0-3L18.2 4.6a2.1 2.1 0 0 0-3 0L4 15.8V20Z" />
            <path d="m13.8 6 4.2 4.2" />
          </svg>
          <span>Editar</span>
        </button>
        <div className="hero-copy">
          <div className="script-title">{profile.puppy_name ? `${profile.puppy_name}: crescimento` : 'Crescimento do filhote'}</div>
          <h1>Acompanhamento de peso</h1>
          <p>Registre as pesagens em kg e acompanhe a evolução com gráfico automático.</p>
        </div>
        <div className="hero-avatar-wrap">
          <div className="pet-avatar large" aria-label="Foto do pet">
            {profile.avatar_data_url ? <img src={profile.avatar_data_url} alt="Foto do pet" /> : <span>🐾</span>}
          </div>
        </div>
      </header>

      <div className="stats">
        <div><span>Peso atual</span><strong>{lastEntry ? `${Number(lastEntry.weight_kg).toLocaleString('pt-BR')} kg` : '—'}</strong></div>
        <div><span>Pesagens</span><strong>{entries.length}</strong></div>
        <div><span>Ganho total</span><strong>{entries.length > 1 ? `${gain.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : '—'}</strong></div>
      </div>

      {message && <div className="message">{message}</div>}

      {isProfileModalOpen && (
        <div className="modal-backdrop" role="dialog" aria-modal="true" aria-labelledby="profile-modal-title">
          <section className="modal-card">
            <div className="modal-header">
              <div>
                <div id="profile-modal-title" className="section-title">Dados do filhote</div>
                <p>Atualize o nome, a data de nascimento e a foto exibida no cabeçalho.</p>
              </div>
              <button className="close-modal" type="button" onClick={closeProfileModal} aria-label="Fechar modal">×</button>
            </div>
            <form onSubmit={saveProfile} className="form-grid">
              <div className="avatar-editor wide">
                <div className="pet-avatar">
                  {profileDraft.avatar_data_url ? <img src={profileDraft.avatar_data_url} alt="Foto do pet" /> : <span>🐾</span>}
                </div>
                <div className="avatar-actions">
                  <label className="file-label">
                    Foto do pet
                    <input type="file" accept="image/*" onChange={(e) => handleAvatarChange(e.target.files?.[0])} />
                  </label>
                  {profileDraft.avatar_data_url && <button type="button" className="ghost" onClick={() => setProfileDraft({ ...profileDraft, avatar_data_url: null })}>Remover foto</button>}
                </div>
              </div>
              <label>Nome do filhote<input value={profileDraft.puppy_name} onChange={(e) => setProfileDraft({ ...profileDraft, puppy_name: e.target.value })} placeholder="Ex.: Jujuba" /></label>
              <label>Data de nascimento<input type="date" value={profileDraft.birth_date || ''} onChange={(e) => setProfileDraft({ ...profileDraft, birth_date: e.target.value || null })} /></label>
              <div className="modal-actions wide">
                <button type="button" className="ghost" onClick={closeProfileModal}>Cancelar</button>
                <button type="submit">Salvar dados</button>
              </div>
            </form>
          </section>
        </div>
      )}

      <section className="card weight-card">
        <div className="section-title">Nova pesagem</div>
        <form onSubmit={addEntry} className="form-grid weight-form">
          <label>Data<input type="date" value={entryDraft.measured_at} onChange={(e) => setEntryDraft({ ...entryDraft, measured_at: e.target.value })} required /></label>
          <label>Peso (kg)<input inputMode="decimal" value={entryDraft.weight_kg} onChange={(e) => setEntryDraft({ ...entryDraft, weight_kg: e.target.value })} placeholder="Ex.: 2,450" required /></label>
          <label className="wide">Observações<textarea value={entryDraft.notes} onChange={(e) => setEntryDraft({ ...entryDraft, notes: e.target.value })} placeholder="Ex.: pesagem após consulta veterinária" /></label>
          <button type="submit">Adicionar pesagem</button>
        </form>
      </section>

      <GrowthChart entries={entries} />

      <section className="card table-card">
        <div className="section-title">Histórico de pesagens</div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr><th>Idade</th><th>Data</th><th>Peso (kg)</th><th>Observações</th><th></th></tr>
            </thead>
            <tbody>
              {entries.length === 0 ? (
                <tr><td colSpan={5} className="empty-row">Nenhuma pesagem cadastrada.</td></tr>
              ) : entries.map((entry) => (
                <tr key={entry.id}>
                  <td>{calculateAge(entry.measured_at, profile.birth_date)}</td>
                  <td>{formatDate(entry.measured_at)}</td>
                  <td>{Number(entry.weight_kg).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 3 })}</td>
                  <td>{entry.notes || '—'}</td>
                  <td><button className="ghost" onClick={() => deleteEntry(entry.id)}>Excluir</button></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
