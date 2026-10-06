// Throws at module load on any violation. Shared by migration, /promote, and the self test.
export const AGE_RATINGS = ['ALL_AGES', 'GENTLE_REWRITE', 'ADULT_ONLY'];
export const CONFIDENCE = ['A', 'B'];
export const AIRABLE_RATING = 'ALL_AGES';

// Verification is now a HARD GATE, not a label. Nothing airs unless a human has
// confirmed it against two independent sources.
export const VERIFICATION = ['UNVERIFIED', 'IN_REVIEW', 'VERIFIED', 'DISPUTED'];
export const AIRABLE_VERIFICATION = 'VERIFIED';

// Claim classes that fail differently and need different checks.
export const RISK_CLASSES = ['first_claim', 'superlative', 'casualty', 'attribution', 'name_drift'];

// Superlatives expire. Gotthard took longest-tunnel in 2016; Chenab took
// highest-bridge in 2024. Re-check before airing, not just before filing.
export const SUPERLATIVE_MAX_AGE_DAYS = 365;

// Precision is a property of the EVIDENCE, not a formatting choice.
// Claiming a day you cannot source is the commonest error in rail chronology,
// and it is entirely self-inflicted.
export const PRECISION = ['DAY', 'MONTH', 'SEASON', 'YEAR', 'CIRCA'];

// DAY precision is a claim about evidence quality and needs two sources agreeing
// on the day - not merely two sources about the event.
export const DAY_PRECISION_NEEDS_TWO_SOURCES = true;

// Ids that must NEVER appear in the live pool. Enforced, not documented.
export const QUARANTINE_IDS = ['RE0046', 'RE0074', 'RE0104', 'RE0121'];

// Fabrication-prone fields (Part 2.4 Control 2). Never model-written without review.
export const FABRICATION_PRONE = ['month', 'day', 'year', 'storyFacts', 'source', 'scaleAnchor'];

function fail(id, msg) { throw new Error(`pool-schema: ${id}: ${msg}`); }

export function validateItem(it) {
  const id = it && it.id ? it.id : '(no id)';
  if (!it.id || typeof it.id !== 'string') fail(id, 'missing id');
  if (!['event', 'feat'].includes(it.type)) fail(id, 'type must be event or feat');
  if (!it.title) fail(id, 'missing title');
  if (!AGE_RATINGS.includes(it.ageRating)) fail(id, `ageRating must be one of ${AGE_RATINGS}`);
  if (!CONFIDENCE.includes(it.confidence)) fail(id, 'confidence must be A or B');
  if (QUARANTINE_IDS.includes(it.id)) fail(id, 'QUARANTINED id present in pool');
  if (!Array.isArray(it.contentFlags)) fail(id, 'contentFlags must be an array');
  if (typeof it.storyFacts !== 'string' || it.storyFacts.length > 400)
    fail(id, 'storyFacts missing or over 400 chars');
  if (!it.source) fail(id, 'no source, no field');

  if (!VERIFICATION.includes(it.verification)) fail(id, `verification must be one of ${VERIFICATION}`);
  if (it.type === 'event' && !PRECISION.includes(it.precision))
    fail(id, `precision must be one of ${PRECISION}`);
  if (it.precision === 'DAY' && it.verification === 'VERIFIED' && (it.sources || []).length < 2)
    fail(id, 'DAY precision claimed with fewer than two sources agreeing on the day');
  if (!Array.isArray(it.sources)) fail(id, 'sources must be an array');
  if (it.verification === 'VERIFIED') {
    // The Westinghouse failure: right date, wrong pairing, graded A anyway.
    // Two sources AND an explicit pairing check are both required.
    if (it.sources.length < 2) fail(id, 'VERIFIED requires two independent sources');
    if (it.pairingChecked !== true) fail(id, 'VERIFIED requires pairingChecked: did the date, the actor and the claim all come from the SAME event?');
    if (!it.verifiedOn) fail(id, 'VERIFIED requires verifiedOn date');
    if ((it.riskClasses || []).includes('superlative')) {
      const age = (Date.now() - Date.parse(it.verifiedOn)) / 86400000;
      if (age > SUPERLATIVE_MAX_AGE_DAYS) fail(id, `superlative verified ${Math.round(age)} days ago; re-check`);
    }
  }
  for (const r of (it.riskClasses || []))
    if (!RISK_CLASSES.includes(r)) fail(id, `unknown risk class ${r}`);

  if (it.type === 'event') {
    if (!(it.month >= 1 && it.month <= 12)) fail(id, 'month out of range');
    if (!(it.day >= 1 && it.day <= 31)) fail(id, 'day out of range');
    const y = Number(it.year);
    if (!(y >= 1600 && y <= new Date().getFullYear())) fail(id, 'year out of range');
  }

  const s = it.scaleAnchor;
  if (s !== null && s !== undefined) {
    if (typeof s.value !== 'number' || !s.unit) fail(id, 'scaleAnchor needs value and unit');
    const hasCmp = s.comparison != null, hasVal = s.comparisonValue != null;
    if (hasCmp !== hasVal) fail(id, 'scaleAnchor: both comparison fields or neither');
  }

  for (const k of ['title', 'storyFacts', 'hook']) {
    const v = it[k] || '';
    for (const ch of v) if (ch.charCodeAt(0) > 127) fail(id, `non-ASCII in ${k}`);
  }
  return true;
}

export function validatePool(items) {
  if (!Array.isArray(items) || items.length === 0) throw new Error('pool-schema: empty pool');
  const seen = new Set();
  for (const it of items) {
    validateItem(it);
    if (seen.has(it.id)) fail(it.id, 'duplicate id');
    seen.add(it.id);
  }
  for (const q of QUARANTINE_IDS)
    if (seen.has(q)) throw new Error(`pool-schema: QUARANTINE LEAK: ${q} is in the live pool`);
  return items.length;
}
