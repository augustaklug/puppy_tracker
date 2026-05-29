type Profile = {
  puppy_name: string;
  birth_date: string | null;
};

export type DewormingSettings = {
  medication_name: string;
  dosage: string;
  maintenance_interval_days: number;
  maintenance_end_age_months: number;
};

export type CareApplication = {
  event_key: string;
  care_type: 'vaccine' | 'deworming';
  applied_at: string;
  product_name: string;
  dosage: string;
  notes: string;
};

export type CareEvent = {
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

const DAY_MS = 86400000;
const DUE_SOON_DAYS = 3;
const MIN_VACCINE_INTERVAL_DAYS = 21;

type VaccineStep = {
  key: string;
  group: 'poly' | 'giardia' | 'flu' | 'rabies';
  label: string;
  dose_label: string;
  start_days: number;
  end_days: number;
};

const VACCINE_STEPS: VaccineStep[] = [
  { key: 'poly-1', group: 'poly', label: 'Polivalente (V8 ou V10)', dose_label: '1a dose', start_days: 42, end_days: 56 },
  { key: 'giardia-1', group: 'giardia', label: 'Giardia', dose_label: '1a dose', start_days: 56, end_days: 70 },
  { key: 'flu-1', group: 'flu', label: 'Gripe Canina', dose_label: '1a dose', start_days: 56, end_days: 70 },
  { key: 'poly-2', group: 'poly', label: 'Polivalente (V8 ou V10)', dose_label: '2a dose', start_days: 63, end_days: 84 },
  { key: 'giardia-2', group: 'giardia', label: 'Giardia', dose_label: 'Reforco', start_days: 63, end_days: 84 },
  { key: 'flu-2', group: 'flu', label: 'Gripe Canina', dose_label: 'Reforco', start_days: 63, end_days: 84 },
  { key: 'poly-3', group: 'poly', label: 'Polivalente (V8 ou V10)', dose_label: '3a dose', start_days: 84, end_days: 112 },
  { key: 'rabies-1', group: 'rabies', label: 'Antirrabica', dose_label: 'Dose obrigatoria', start_days: 84, end_days: 112 },
];

function atUtcMidnight(value: string | Date) {
  const d = typeof value === 'string' ? new Date(`${value}T00:00:00Z`) : value;
  return new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
}

function formatDate(date: Date) {
  return date.toISOString().slice(0, 10);
}

function addDays(base: Date, days: number) {
  return new Date(base.getTime() + days * DAY_MS);
}

function addMonths(base: Date, months: number) {
  const d = new Date(base.getTime());
  d.setUTCMonth(d.getUTCMonth() + months);
  return d;
}

function daysDiff(from: Date, to: Date) {
  return Math.floor((to.getTime() - from.getTime()) / DAY_MS);
}

function todayUtc() {
  return atUtcMidnight(new Date());
}

function statusFor(dueDate: Date, now = todayUtc()) {
  const delta = daysDiff(now, dueDate);
  return {
    is_overdue: delta < 0,
    is_due_soon: delta >= 0 && delta <= DUE_SOON_DAYS,
  };
}

function applicationMap(applications: CareApplication[]) {
  const map = new Map<string, CareApplication>();
  for (const app of applications) map.set(app.event_key, app);
  return map;
}

function buildVaccineEvents(birth: Date, appMap: Map<string, CareApplication>, now: Date) {
  const events: CareEvent[] = [];
  const lastByGroup: Record<string, string | null> = {
    poly: null,
    giardia: null,
    flu: null,
    rabies: null,
  };

  for (const step of VACCINE_STEPS) {
    const windowStart = addDays(birth, step.start_days);
    const windowEnd = addDays(birth, step.end_days);
    let dueDate = windowEnd;
    const lastFromGroup = lastByGroup[step.group];
    if (lastFromGroup) {
      const minDate = addDays(atUtcMidnight(lastFromGroup), MIN_VACCINE_INTERVAL_DAYS);
      if (minDate > dueDate) dueDate = minDate;
    }

    const applied = appMap.get(step.key);
    if (applied) lastByGroup[step.group] = applied.applied_at;
    const s = statusFor(dueDate, now);
    events.push({
      event_key: step.key,
      care_type: 'vaccine',
      label: step.label,
      dose_label: step.dose_label,
      due_date: formatDate(dueDate),
      window_start: formatDate(windowStart),
      window_end: formatDate(windowEnd),
      is_applied: Boolean(applied),
      applied_at: applied?.applied_at ?? null,
      notes: applied?.notes ?? '',
      product_name: applied?.product_name ?? '',
      dosage: applied?.dosage ?? '',
      is_overdue: !applied && s.is_overdue,
      is_due_soon: !applied && s.is_due_soon,
    });
  }

  const annualEvents: CareEvent[] = [];
  const annualPlans: Array<{ key: string; label: string; group: keyof typeof lastByGroup }> = [
    { key: 'poly', label: 'Polivalente (V8 ou V10)', group: 'poly' },
    { key: 'giardia', label: 'Giardia', group: 'giardia' },
    { key: 'flu', label: 'Gripe Canina', group: 'flu' },
    { key: 'rabies', label: 'Antirrabica', group: 'rabies' },
  ];

  for (const plan of annualPlans) {
    const last = lastByGroup[plan.group];
    if (!last) continue;
    const dueDate = addDays(atUtcMidnight(last), 365);
    const eventKey = `${plan.key}-annual-${dueDate.getUTCFullYear()}`;
    const applied = appMap.get(eventKey);
    const s = statusFor(dueDate, now);
    annualEvents.push({
      event_key: eventKey,
      care_type: 'vaccine',
      label: plan.label,
      dose_label: 'Reforco anual',
      due_date: formatDate(dueDate),
      window_start: null,
      window_end: null,
      is_applied: Boolean(applied),
      applied_at: applied?.applied_at ?? null,
      notes: applied?.notes ?? '',
      product_name: applied?.product_name ?? '',
      dosage: applied?.dosage ?? '',
      is_overdue: !applied && s.is_overdue,
      is_due_soon: !applied && s.is_due_soon,
    });
  }

  return [...events, ...annualEvents];
}

function buildDewormingEvents(
  birth: Date,
  settings: DewormingSettings,
  appMap: Map<string, CareApplication>,
  now: Date
) {
  const events: CareEvent[] = [];
  const interval = Math.max(1, settings.maintenance_interval_days || 30);
  const endDate = addMonths(birth, Math.max(1, settings.maintenance_end_age_months || 6));

  const firstKey = 'deworm-1';
  const firstStart = addDays(birth, 15);
  const firstEnd = addDays(birth, 30);
  const firstApplied = appMap.get(firstKey);
  const firstDue = firstEnd;
  const firstStatus = statusFor(firstDue, now);
  events.push({
    event_key: firstKey,
    care_type: 'deworming',
    label: 'Vermifugacao',
    dose_label: '1a dose',
    due_date: formatDate(firstDue),
    window_start: formatDate(firstStart),
    window_end: formatDate(firstEnd),
    is_applied: Boolean(firstApplied),
    applied_at: firstApplied?.applied_at ?? null,
    notes: firstApplied?.notes ?? '',
    product_name: firstApplied?.product_name ?? '',
    dosage: firstApplied?.dosage ?? '',
    is_overdue: !firstApplied && firstStatus.is_overdue,
    is_due_soon: !firstApplied && firstStatus.is_due_soon,
  });

  const secondKey = 'deworm-2';
  const secondApplied = appMap.get(secondKey);
  const secondBase = firstApplied ? atUtcMidnight(firstApplied.applied_at) : firstDue;
  const secondDue = addDays(secondBase, 15);
  const secondStatus = statusFor(secondDue, now);
  events.push({
    event_key: secondKey,
    care_type: 'deworming',
    label: 'Vermifugacao',
    dose_label: '2a dose (reforco)',
    due_date: formatDate(secondDue),
    window_start: null,
    window_end: null,
    is_applied: Boolean(secondApplied),
    applied_at: secondApplied?.applied_at ?? null,
    notes: secondApplied?.notes ?? '',
    product_name: secondApplied?.product_name ?? '',
    dosage: secondApplied?.dosage ?? '',
    is_overdue: !secondApplied && secondStatus.is_overdue,
    is_due_soon: !secondApplied && secondStatus.is_due_soon,
  });

  let cycle = 1;
  let previousReference = secondApplied ? atUtcMidnight(secondApplied.applied_at) : secondDue;
  while (true) {
    const currentDue = addDays(previousReference, interval);
    if (currentDue > endDate) break;
    const eventKey = `deworm-maint-${cycle}`;
    const applied = appMap.get(eventKey);
    const s = statusFor(currentDue, now);
    events.push({
      event_key: eventKey,
      care_type: 'deworming',
      label: 'Vermifugacao',
      dose_label: `Manutencao ${cycle}`,
      due_date: formatDate(currentDue),
      window_start: null,
      window_end: null,
      is_applied: Boolean(applied),
      applied_at: applied?.applied_at ?? null,
      notes: applied?.notes ?? '',
      product_name: applied?.product_name ?? '',
      dosage: applied?.dosage ?? '',
      is_overdue: !applied && s.is_overdue,
      is_due_soon: !applied && s.is_due_soon,
    });

    previousReference = applied ? atUtcMidnight(applied.applied_at) : currentDue;
    cycle += 1;
  }

  return events;
}

export function buildCareSchedule(
  profile: Profile,
  settings: DewormingSettings,
  applications: CareApplication[]
) {
  if (!profile.birth_date) return [];

  const birth = atUtcMidnight(profile.birth_date);
  const now = todayUtc();
  const appMap = applicationMap(applications);

  const vaccineEvents = buildVaccineEvents(birth, appMap, now);
  const dewormingEvents = buildDewormingEvents(birth, settings, appMap, now);
  return [...vaccineEvents, ...dewormingEvents].sort((a, b) => a.due_date.localeCompare(b.due_date));
}

export function remindersForToday(events: CareEvent[]) {
  const now = todayUtc();
  return events.filter((event) => {
    if (event.is_applied) return false;
    const due = atUtcMidnight(event.due_date);
    const delta = daysDiff(now, due);
    return delta <= 0 || delta <= DUE_SOON_DAYS;
  });
}
