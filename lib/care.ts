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

type VaccinePlan = {
  key: string;
  label: string;
  dose_label: string;
  startDays: number;
  endDays: number;
};

const DAY_MS = 86400000;
const DUE_SOON_DAYS = 3;
const MIN_VACCINE_INTERVAL_DAYS = 21;

const VACCINE_PLANS: VaccinePlan[] = [
  { key: 'poly-1', label: 'Polivalente (V8 ou V10)', dose_label: '1a dose', startDays: 42, endDays: 56 },
  { key: 'giardia-1', label: 'Giardia', dose_label: '1a dose', startDays: 56, endDays: 70 },
  { key: 'flu-1', label: 'Gripe Canina', dose_label: '1a dose', startDays: 56, endDays: 70 },
  { key: 'poly-2', label: 'Polivalente (V8 ou V10)', dose_label: '2a dose', startDays: 63, endDays: 84 },
  { key: 'giardia-2', label: 'Giardia', dose_label: 'Reforco', startDays: 63, endDays: 84 },
  { key: 'flu-2', label: 'Gripe Canina', dose_label: 'Reforco', startDays: 63, endDays: 84 },
  { key: 'poly-3', label: 'Polivalente (V8 ou V10)', dose_label: '3a dose', startDays: 84, endDays: 112 },
  { key: 'rabies-1', label: 'Antirrabica', dose_label: 'Dose obrigatoria', startDays: 84, endDays: 112 },
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

function yearlyBoosterEvent(
  key: string,
  label: string,
  lastAppliedAt: string | null,
  applicationsByKey: Map<string, CareApplication>,
  now: Date
): CareEvent | null {
  if (!lastAppliedAt) return null;
  const dueDate = addDays(atUtcMidnight(lastAppliedAt), 365);
  const eventKey = `${key}-annual-${dueDate.getUTCFullYear()}`;
  const applied = applicationsByKey.get(eventKey);
  const s = statusFor(dueDate, now);
  return {
    event_key: eventKey,
    care_type: 'vaccine',
    label,
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
  };
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

  const events: CareEvent[] = [];
  let lastPolyApplied: string | null = null;
  let lastGiardiaApplied: string | null = null;
  let lastFluApplied: string | null = null;
  let lastRabiesApplied: string | null = null;

  for (const plan of VACCINE_PLANS) {
    const windowStart = addDays(birth, plan.startDays);
    const windowEnd = addDays(birth, plan.endDays);
    let dueDate = windowEnd;

    if (plan.key === 'poly-2' && lastPolyApplied) {
      const minDate = addDays(atUtcMidnight(lastPolyApplied), MIN_VACCINE_INTERVAL_DAYS);
      if (minDate > dueDate) dueDate = minDate;
    }
    if (plan.key === 'poly-3' && lastPolyApplied) {
      const minDate = addDays(atUtcMidnight(lastPolyApplied), MIN_VACCINE_INTERVAL_DAYS);
      if (minDate > dueDate) dueDate = minDate;
    }
    if (plan.key === 'giardia-2' && lastGiardiaApplied) {
      const minDate = addDays(atUtcMidnight(lastGiardiaApplied), MIN_VACCINE_INTERVAL_DAYS);
      if (minDate > dueDate) dueDate = minDate;
    }
    if (plan.key === 'flu-2' && lastFluApplied) {
      const minDate = addDays(atUtcMidnight(lastFluApplied), MIN_VACCINE_INTERVAL_DAYS);
      if (minDate > dueDate) dueDate = minDate;
    }

    const applied = appMap.get(plan.key);
    if (applied) {
      if (plan.key.startsWith('poly-')) lastPolyApplied = applied.applied_at;
      if (plan.key.startsWith('giardia-')) lastGiardiaApplied = applied.applied_at;
      if (plan.key.startsWith('flu-')) lastFluApplied = applied.applied_at;
      if (plan.key.startsWith('rabies-')) lastRabiesApplied = applied.applied_at;
    }
    const s = statusFor(dueDate, now);
    events.push({
      event_key: plan.key,
      care_type: 'vaccine',
      label: plan.label,
      dose_label: plan.dose_label,
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

  const annual = [
    yearlyBoosterEvent('poly', 'Polivalente (V8 ou V10)', lastPolyApplied, appMap, now),
    yearlyBoosterEvent('giardia', 'Giardia', lastGiardiaApplied, appMap, now),
    yearlyBoosterEvent('flu', 'Gripe Canina', lastFluApplied, appMap, now),
    yearlyBoosterEvent('rabies', 'Antirrabica', lastRabiesApplied, appMap, now),
  ].filter(Boolean) as CareEvent[];
  events.push(...annual);

  const firstStart = addDays(birth, 15);
  const firstEnd = addDays(birth, 30);
  const secondDue = addDays(firstStart, 15);

  const firstKey = 'deworm-1';
  const secondKey = 'deworm-2';
  const firstApplied = appMap.get(firstKey);
  const secondApplied = appMap.get(secondKey);
  const firstStatus = statusFor(firstEnd, now);
  const secondStatus = statusFor(secondDue, now);

  events.push({
    event_key: firstKey,
    care_type: 'deworming',
    label: 'Vermifugacao',
    dose_label: '1a dose',
    due_date: formatDate(firstEnd),
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

  const interval = Math.max(1, settings.maintenance_interval_days || 30);
  const endDate = addMonths(birth, Math.max(1, settings.maintenance_end_age_months || 6));
  let cycle = 1;
  let currentDue = addDays(secondDue, interval);
  while (currentDue <= endDate) {
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
    cycle += 1;
    currentDue = addDays(currentDue, interval);
  }

  return events.sort((a, b) => a.due_date.localeCompare(b.due_date));
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
