// Merge VERIFIED worksheet rows into the pool. Refuses anything the schema rejects.
// Usage: node scripts/promote.mjs <worksheet.xlsx>  (requires: npm i xlsx)
import fs from 'node:fs';
import { validatePool, validateItem } from '../src/pool-schema.js';

const path = process.argv[2];
if (!path) { console.error('usage: node scripts/promote.mjs <worksheet.xlsx>'); process.exit(1); }

let XLSX;
try { XLSX = await import('xlsx'); }
catch { console.error('missing dependency: npm i xlsx'); process.exit(1); }

const wb = XLSX.readFile(path);
const pool = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url)));
const existing = new Set(pool.items.map(i => i.id));

const MON = { Jan:1,Feb:2,Mar:3,Apr:4,May:5,Jun:6,Jul:7,Aug:8,Sep:9,Oct:10,Nov:11,Dec:12 };
function parseDate(v) {
  if (!v) return null;
  const d = new Date(v);
  if (!isNaN(d)) return { month: d.getUTCMonth() + 1, day: d.getUTCDate(), year: d.getUTCFullYear() };
  const m = String(v).match(/(\d{1,2})\s+([A-Za-z]{3})\w*\s+(\d{4})/);
  if (m) return { month: MON[m[2].slice(0,3)], day: +m[1], year: +m[3] };
  const y = String(v).match(/\b(1[6-9]\d{2}|20\d{2})\b/);
  return y ? { month: null, day: null, year: +y[1] } : null;
}

let added = 0, skipped = 0, rejected = 0;
const problems = [];

for (const name of ['PATENTS', 'PEOPLE']) {
  const ws = wb.Sheets[name];
  if (!ws) continue;
  for (const r of XLSX.utils.sheet_to_json(ws)) {
    const status = String(r.STATUS || '').toUpperCase();
    if (status !== 'VERIFIED') { skipped++; continue; }

    const isPatent = name === 'PATENTS';
    const dateCell = isPatent ? r['GRANT DATE (fill)'] : r['BIRTH DATE (fill)'];
    const parsed = parseDate(dateCell);
    const s1 = r['SOURCE 1 (fill)'], s2 = r['SOURCE 2 (fill)'];
    const pairing = String(r['PAIRING OK? (y/n)'] || '').toLowerCase().startsWith('y');
    const subject = r.Subject || r.Person;

    const id = (isPatent ? 'PT' : 'PP') + String(r['#']).padStart(4, '0');
    if (existing.has(id)) { skipped++; continue; }

    const item = {
      id, type: 'event',
      month: parsed?.month ?? null, day: parsed?.day ?? null, year: parsed?.year ?? null,
      anniversary: parsed?.month ? `${parsed.month}/${parsed.day}` : null,
      title: subject, region: 'US', category: isPatent ? 'Technology' : 'People',
      storyFacts: (isPatent
        ? `Patent ${r['PATENT NO (fill)']}, granted ${dateCell}, to ${r['INVENTOR AS ON PATENT (fill)']}.`
        : `Born ${dateCell}${r['BIRTHPLACE (fill)'] ? ' in ' + r['BIRTHPLACE (fill)'] : ''}.`).slice(0, 400),
      hook: r['Known for'] || r.Theme || '',
      source: s1 || '', sources: [s1, s2].filter(Boolean),
      confidence: 'A',
      precision: String(r['PRECISION (fill)'] || (parsed?.day ? 'DAY' : 'YEAR')).toUpperCase(),
      ageRating: 'ALL_AGES', contentFlags: [], riskClasses: [], failureModes: [],
      scaleAnchor: null, displayName: subject,
      verification: 'VERIFIED', pairingChecked: pairing,
      verifiedOn: new Date().toISOString().slice(0, 10),
    };

    try { validateItem(item); pool.items.push(item); existing.add(id); added++; }
    catch (e) { rejected++; problems.push(`${id} ${subject}: ${e.message}`); }
  }
}

if (problems.length) {
  console.log('\nREJECTED - fix the worksheet row, not the schema:\n');
  for (const p of problems) console.log('  ' + p);
}
validatePool(pool.items);
fs.writeFileSync(new URL('../data/items.json', import.meta.url), JSON.stringify(pool, null, 1));
const verified = pool.items.filter(i => i.verification === 'VERIFIED').length;
console.log(`\nadded ${added}  skipped ${skipped}  rejected ${rejected}`);
console.log(`pool now ${pool.items.length} items, ${verified} VERIFIED`);
console.log(`runway at 3x/week: ${(pool.items.filter(i => i.verification === 'VERIFIED' && i.type === 'event').length / 3).toFixed(1)} weeks`);
