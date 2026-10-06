import { AIRABLE_RATING, AIRABLE_VERIFICATION, QUARANTINE_IDS } from './pool-schema.js';

function hash(s) { let h = 2166136261; for (let i=0;i<s.length;i++){ h ^= s.charCodeAt(i); h = Math.imul(h, 16777619);} return Math.abs(h); }

// Deterministic per date. Category-diverse. Resets rather than errors when exhausted.
export function selectForDate(items, dateStr, used) {
  // TWO hard gates now: age-appropriate AND verified. Unverified items are
  // invisible to the show no matter how good they look.
  const pool = items.filter(i =>
    i.ageRating === AIRABLE_RATING &&
    i.verification === AIRABLE_VERIFICATION &&
    !QUARANTINE_IDS.includes(i.id));
  const events = pool.filter(i => i.type === 'event');
  const feats  = pool.filter(i => i.type === 'feat');
  if (!events.length || !feats.length)
    throw new Error(`selection: no VERIFIED items available (events ${events.length}, feats ${feats.length}). ` +
      'Verify more of the hopper before the show can run.');

  const [ , mm, dd ] = dateStr.split('-');
  const m = Number(mm), d = Number(dd);

  const pick = (list, key, usedList) => {
    let avail = list.filter(i => !usedList.includes(i.id));
    if (!avail.length) { usedList.length = 0; avail = list.slice(); }   // reset, never error
    return avail[hash(dateStr + key) % avail.length];
  };

  // Precision-aware matching. A MONTH item has no meaningful day, so it is eligible
  // on any date in its month - which INCREASES the pool available on a given date.
  const unused = e => !used.events.includes(e.id);
  const exact = events.filter(e => e.precision === 'DAY' && e.month === m && e.day === d && unused(e));
  const inMonth = events.filter(e => e.precision === 'MONTH' && e.month === m && unused(e));
  const seasonal = events.filter(e => e.precision === 'SEASON' && Math.abs(e.month - m) <= 1 && unused(e));

  const tier = exact.length ? exact : (inMonth.length ? inMonth : (seasonal.length ? seasonal : null));
  const event = tier ? tier[hash(dateStr + 'e') % tier.length] : pick(events, 'e', used.events);
  const matchKind = exact.length ? 'exact_day' : (inMonth.length ? 'same_month'
                  : (seasonal.length ? 'same_season' : 'archive'));

  let featList = feats.filter(f => f.category !== event.category);
  if (!featList.length) featList = feats;
  const feat = pick(featList, 'f', used.feats);

  return { event, feat, matchKind, exactDateMatch: matchKind === 'exact_day' };
}
