'use client';

import { FormEvent, useEffect, useMemo, useState } from 'react';

type Profile = { puppy_name: string; birth_date: string | null };
type WeightEntry = { id: number; measured_at: string; weight_kg: number; notes: string };

function formatDate(value: string) {
  if (!value) return '';
  const [year, month, day] = value.split('-');
  return `${day}/${month}/${year}`;
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

function makePath(entries: WeightEntry[], width: number, height: number) {
  if (!entries.length) return '';
  const weights = entries.map((entry) => Number(entry.weight_kg));
  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const paddingX = 34;
  const paddingY = 24;
  const plotW = width - paddingX * 2;
  const plotH = height - paddingY * 2;
  const span = Math.max(0.5, maxWeight - minWeight);

  return entries
    .map((entry, index) => {
      const x = entries.length === 1 ? width / 2 : paddingX + (index / (entries.length - 1)) * plotW;
      const y = paddingY + (1 - (Number(entry.weight_kg) - minWeight) / span) * plotH;
      return `${index === 0 ? 'M' : 'L'} ${x.toFixed(2)} ${y.toFixed(2)}`;
    })
    .join(' ');
}

function GrowthChart({ entries }: { entries: WeightEntry[] }) {
  const width = 720;
  const height = 320;
  const path = makePath(entries, width, height);
  const weights = entries.map((entry) => Number(entry.weight_kg));
  const minWeight = weights.length ? Math.min(...weights) : 0;
  const maxWeight = weights.length ? Math.max(...weights) : 10;
  const range = Math.max(0.5, maxWeight - minWeight);

  return (
    <section className="card chart-card">
      <div className="section-title">Gráfico de crescimento</div>
      <div className="chart-wrap">
        {entries.length === 0 ? (
          <div className="empty-chart">Cadastre a primeira pesagem para visualizar o gráfico.</div>
        ) : (
          <svg viewBox={`0 0 ${width} ${height}`} role="img" aria-label="Gráfico de crescimento do filhote">
            <line x1="34" y1="24" x2="34" y2="288" className="axis" />
            <line x1="34" y1="288" x2="686" y2="288" className="axis" />
            {[0, 0.25, 0.5, 0.75, 1].map((step) => {
              const y = 24 + step * 264;
              const label = (maxWeight - step * range).toFixed(1).replace('.', ',');
              return (
                <g key={step}>
                  <line x1="34" y1={y} x2="686" y2={y} className="grid" />
                  <text x="5" y={y + 4} className="tick">{label}</text>
                </g>
              );
            })}
            <path d={path} className="growth-line" />
            {entries.map((entry, index) => {
              const x = entries.length === 1 ? width / 2 : 34 + (index / (entries.length - 1)) * 652;
              const y = 24 + (1 - (Number(entry.weight_kg) - minWeight) / range) * 264;
              return <circle key={entry.id} cx={x} cy={y} r="5" className="point" />;
            })}
            {entries.map((entry, index) => {
              if (index !== 0 && index !== entries.length - 1 && entries.length > 6) return null;
              const x = entries.length === 1 ? width / 2 : 34 + (index / (entries.length - 1)) * 652;
              return <text key={`${entry.id}-date`} x={x - 24} y="310" className="date-label">{formatDate(entry.measured_at).slice(0, 5)}</text>;
            })}
          </svg>
        )}
      </div>
    </section>
  );
}

export default function Home() {
  const [token, setToken] = useState('');
  const [isAuthed, setIsAuthed] = useState(false);
  const [profile, setProfile] = useState<Profile>({ puppy_name: '', birth_date: null });
  const [entries, setEntries] = useState<WeightEntry[]>([]);
  const [message, setMessage] = useState('');
  const [profileDraft, setProfileDraft] = useState<Profile>({ puppy_name: '', birth_date: null });
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
      setMessage('Perfil salvo.');
    } catch (error) {
      setMessage(error instanceof Error ? error.message : 'Erro ao salvar perfil.');
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
        <div>
          <div className="script-title">{profile.puppy_name ? `${profile.puppy_name}: crescimento` : 'Crescimento do filhote'}</div>
          <h1>Acompanhamento de peso</h1>
          <p>Registre as pesagens em kg e acompanhe a evolução com gráfico automático.</p>
        </div>
        <div className="paw" aria-hidden="true">♡</div>
      </header>

      <div className="stats">
        <div><span>Peso atual</span><strong>{lastEntry ? `${Number(lastEntry.weight_kg).toLocaleString('pt-BR')} kg` : '—'}</strong></div>
        <div><span>Pesagens</span><strong>{entries.length}</strong></div>
        <div><span>Ganho total</span><strong>{entries.length > 1 ? `${gain.toLocaleString('pt-BR', { maximumFractionDigits: 3 })} kg` : '—'}</strong></div>
      </div>

      {message && <div className="message">{message}</div>}

      <div className="grid-layout">
        <section className="card">
          <div className="section-title">Dados do filhote</div>
          <form onSubmit={saveProfile} className="form-grid">
            <label>Nome do filhote<input value={profileDraft.puppy_name} onChange={(e) => setProfileDraft({ ...profileDraft, puppy_name: e.target.value })} placeholder="Ex.: Jujuba" /></label>
            <label>Data de nascimento<input type="date" value={profileDraft.birth_date || ''} onChange={(e) => setProfileDraft({ ...profileDraft, birth_date: e.target.value || null })} /></label>
            <button type="submit">Salvar dados</button>
          </form>
        </section>

        <section className="card">
          <div className="section-title">Nova pesagem</div>
          <form onSubmit={addEntry} className="form-grid">
            <label>Data<input type="date" value={entryDraft.measured_at} onChange={(e) => setEntryDraft({ ...entryDraft, measured_at: e.target.value })} required /></label>
            <label>Peso (kg)<input inputMode="decimal" value={entryDraft.weight_kg} onChange={(e) => setEntryDraft({ ...entryDraft, weight_kg: e.target.value })} placeholder="Ex.: 2,450" required /></label>
            <label className="wide">Observações<textarea value={entryDraft.notes} onChange={(e) => setEntryDraft({ ...entryDraft, notes: e.target.value })} placeholder="Ex.: pesagem após consulta veterinária" /></label>
            <button type="submit">Adicionar pesagem</button>
          </form>
        </section>
      </div>

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
