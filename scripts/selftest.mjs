// Zero network, zero secrets. Must pass before wrangler is touched.
import fs from 'node:fs';
import { validatePool, QUARANTINE_IDS, AIRABLE_RATING, AIRABLE_VERIFICATION } from '../src/pool-schema.js';
import { selectForDate } from '../src/selection.js';
import { toAscii, isAscii } from '../src/ascii.js';
import { forSpeech } from '../src/pronounce.js';
import { buildNarration, estimateSeconds, splitBlocks, VOICE_SETTINGS } from '../src/tts.js';
import { buildRss } from '../src/rss.js';
import { numericTripwire, quoteTripwire, wordCount, WORD_CEILING, buildUserPrompt } from '../src/script.js';
import { coldOpen, SIGN_OFF, assemble, spokenDate, spokenWhen } from '../src/bookends.js';

let pass = 0, fail = 0;
const t = (name, fn) => { try { fn(); console.log('  PASS  ' + name); pass++; }
  catch (e) { console.log('  FAIL  ' + name + ' :: ' + e.message); fail++; } };
const eq = (a, b, m) => { if (a !== b) throw new Error(`${m}: got ${a}, want ${b}`); };
const ok = (c, m) => { if (!c) throw new Error(m); };

const pool = JSON.parse(fs.readFileSync(new URL('../data/items.json', import.meta.url)));
const quar = JSON.parse(fs.readFileSync(new URL('../data/quarantine.json', import.meta.url)));

console.log('\nSCHEMA');
t('pool validates', () => ok(validatePool(pool.items) > 0, 'validate failed'));
t('no quarantined id in pool', () => {
  const ids = new Set(pool.items.map(i => i.id));
  for (const q of QUARANTINE_IDS) ok(!ids.has(q), `LEAK: ${q}`);
});
t('quarantine.json matches schema constant', () =>
  eq(JSON.stringify(quar.blockedIds.slice().sort()), JSON.stringify(QUARANTINE_IDS.slice().sort()), 'blocked ids'));
t('every item ascii', () => { for (const i of pool.items)
  ok(isAscii(i.title + i.storyFacts + (i.hook||'')), `non-ascii in ${i.id}`); });
t('every item has a source', () => { for (const i of pool.items) ok(i.source, `no source: ${i.id}`); });
t('rejects a bad ageRating', () => {
  let threw = false;
  try { validatePool([{ ...pool.items[0], ageRating: 'FINE' }]); } catch { threw = true; }
  ok(threw, 'schema accepted an invalid ageRating');
});
t('rejects a quarantined id injected into the pool', () => {
  let threw = false;
  try { validatePool([{ ...pool.items[0], id: QUARANTINE_IDS[0] }]); } catch { threw = true; }
  ok(threw, 'schema accepted a quarantined id');
});

console.log('\nSELECTION');
const used = { events: [], feats: [] };
t('deterministic for a given date', () => {
  if (pool.items.every(i => i.verification !== AIRABLE_VERIFICATION)) return;
  const a = selectForDate(pool.items, '2026-09-01', { events: [], feats: [] });
  const b = selectForDate(pool.items, '2026-09-01', { events: [], feats: [] });
  eq(a.event.id, b.event.id, 'event'); eq(a.feat.id, b.feat.id, 'feat');
});
t('unverified items can never be selected', () => {
  const allUnverified = pool.items.every(i => i.verification !== AIRABLE_VERIFICATION);
  if (allUnverified) {
    let threw = false;
    try { selectForDate(pool.items, '2026-09-01', { events: [], feats: [] }); } catch { threw = true; }
    ok(threw, 'selection ran with zero verified items - the gate is not enforcing');
  } else {
    const s2 = selectForDate(pool.items, '2026-09-01', { events: [], feats: [] });
    eq(s2.event.verification, AIRABLE_VERIFICATION, 'unverified event selected');
    eq(s2.feat.verification, AIRABLE_VERIFICATION, 'unverified feat selected');
  }
});
t('VERIFIED demands two sources and a pairing check', () => {
  const base = { ...pool.items[0], verification: 'VERIFIED', verifiedOn: '2026-08-30' };
  let a = false, b = false;
  try { validatePool([{ ...base, sources: ['one'], pairingChecked: true }]); } catch { a = true; }
  try { validatePool([{ ...base, sources: ['one', 'two'], pairingChecked: false }]); } catch { b = true; }
  ok(a, 'accepted VERIFIED with a single source');
  ok(b, 'accepted VERIFIED without a pairing check');
});
t('only ALL_AGES selected across 400 dates', () => {
  const u = { events: [], feats: [] };
  if (pool.items.every(i => i.verification !== AIRABLE_VERIFICATION)) return;  // nothing verified yet
  for (let i = 0; i < 400; i++) {
    const d = new Date(2026, 0, 1 + i).toISOString().slice(0, 10);
    const s = selectForDate(pool.items, d, u);
    eq(s.event.ageRating, AIRABLE_RATING, `date ${d} event`);
    ok(!QUARANTINE_IDS.includes(s.event.id), `quarantined selected on ${d}`);
    u.events.push(s.event.id); u.feats.push(s.feat.id);
  }
});
t('resets rather than errors when exhausted', () => {
  if (pool.items.every(i => i.verification !== AIRABLE_VERIFICATION)) return;
  const u = { events: pool.items.map(i => i.id), feats: pool.items.map(i => i.id) };
  ok(selectForDate(pool.items, '2027-01-01', u).event, 'did not reset');
});

console.log('\nTEXT + TTS');
t('ascii normalizer strips em dash and curly quotes', () =>
  eq(toAscii('a \u2014 b \u2019c\u2019'), "a - b 'c'", 'normalize'));
t('pronunciation layer fires', () => ok(forSpeech('Desjardins').includes('zhar'), 'not applied'));
t('ampersand never read literally', () => ok(!forSpeech('B&O').includes('&'), 'raw ampersand'));
t('clean and speech strings stay separate', () => {
  const n = buildNarration('One para.\n\nTwo para.\n\nThree para.');
  ok(!n.clean.includes('<break'), 'markup leaked into transcript');
  ok(n.speech.includes('<break'), 'no markup in speech');
  ok(n.pauseTotal > 0, 'no pauses counted');
});
t('duration includes pause time', () => {
  const words = new Array(625).fill('word').join(' ');
  eq(estimateSeconds(words, 125, 3.7), Math.round(300 + 3.7), 'duration math');
});
t('block splitter respects cap', () => {
  const big = new Array(60).fill(new Array(60).fill('word').join(' ')).join('\n\n');
  for (const b of splitBlocks(big)) ok(b.length <= 4000, 'block over cap');
});

console.log('\nTRIPWIRES');
t('flags a number absent from source', () => {
  const r = numericTripwire('It cost 999 pounds.', { storyFacts: 'a', hook: '', year: 1830, anniversary: 'May 1' }, { storyFacts: 'b', hook: '', year: 2016 });
  ok(r.flags.includes('999'), 'missed invented number');
});
t('passes a number present in source', () => {
  const r = numericTripwire('It reached 5072 metres.', { storyFacts: '5072 m', hook: '', year: 2006, anniversary: 'Jul 1' }, { storyFacts: '', hook: '', year: 2006 });
  eq(r.flags.length, 0, 'false positive');
});
t('bookends are byte-identical across dates except the date', () => {
  const a = coldOpen('2026-08-30'), b = coldOpen('2027-01-01');
  eq(a.replace('August thirtieth',''), b.replace('January first',''), 'cold open drifted');
  ok(SIGN_OFF.length > 40, 'sign off missing');
  eq(spokenDate('2026-05-10'), 'May tenth', 'spoken date');
});
t('assembled episode contains open, body and close in order', () => {
  const full = assemble(coldOpen('2026-08-30'), 'BODY TEXT', SIGN_OFF);
  ok(full.indexOf('Rails Beneath Us') < full.indexOf('BODY TEXT'), 'open not first');
  ok(full.indexOf('BODY TEXT') < full.indexOf('see you next time'), 'close not last');
});
t('single-word scare quotes are not flagged as invented speech', () => {
  const f = quoteTripwire('The brakes were never really "off" waiting.');
  ok(!f.some(x => x.includes('invented')), 'false positive on emphasis');
});
t('a long quoted passage IS flagged', () => {
  const f = quoteTripwire('He said "we shall build it across the whole continent" loudly.');
  ok(f.some(x => x.includes('invented')), 'missed probable fabricated quote');
});
t('bare quote marks still surface a note', () => ok(quoteTripwire('He said "hello".').length >= 1, 'no note'));
t('word ceiling constant is sane', () => ok(WORD_CEILING > 600 && WORD_CEILING <= 900, `ceiling ${WORD_CEILING}`));

console.log('\nRENDERERS');
const anyVerified = pool.items.some(i => i.verification === AIRABLE_VERIFICATION);
const s = anyVerified ? selectForDate(pool.items, '2026-09-01', { events: [], feats: [] })
                      : { event: pool.items[0], feat: pool.items.find(i => i.type === 'feat') };
t('rss has enclosure length and duration', () => {
  const x = buildRss([{ date: '2026-09-01', title: 'T', summary: 'S', bytes: 12345, duration: '5:01', publishedAt: new Date().toISOString() }], 'https://x.dev', 'https://x.dev/c.jpg');
  ok(x.includes('length="12345"'), 'no enclosure length');
  ok(x.includes('<itunes:duration>'), 'no duration');
  ok(x.includes('<itunes:explicit>false'), 'no explicit tag');
});
t('page duration comes from the audio file, not the stored estimate', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  ok(html.includes('loadedmetadata'), 'page trusts the stored duration');
  ok(html.includes('clock(audio.duration)'), 'real duration never read from the file');
});
t('internal fields are not shown to listeners', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  ok(!/WRITTEN ONLY/.test(html), 'writtenOnly config leaking to the page');
  ok(!/Confidence: event/.test(html), 'confidence grades leaking to the page');
  ok(/createElement\('details'\)|<details/.test(html), 'review notes not folded away');
});
t('mobile essentials present', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  ok(html.includes('viewport-fit=cover'), 'no viewport-fit for notched devices');
  ok(html.includes('safe-area-inset'), 'no safe area handling');
  ok(html.includes('prefers-color-scheme:dark'), 'no dark mode');
  ok(html.includes('width:56px;height:56px'), 'primary control under 44px touch target');
});
t('word budget matches measured delivery rate', () => {
  const wr2 = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
  const wpm = Number((wr2.match(/"WORDS_PER_MINUTE":\s*"(\d+)"/) || [])[1]);
  ok(wpm > 150, `WORDS_PER_MINUTE ${wpm} contradicts the two measured episodes (~189)`);
});
t('rss feed is not edge-cached stale', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const seg = src.slice(src.indexOf('rss.xml'), src.indexOf('rss.xml') + 400);
  ok(seg.includes('no-cache'), 'feed can serve a stale copy after publishing');
});
t('every episode carries the show cover as its image', () => {
  const x = buildRss([{ date: '2026-09-01', title: 'T', summary: '', bytes: 1, duration: '5:00', publishedAt: new Date().toISOString() }],
    'https://x.dev', 'https://x.dev/cover/show.jpg');
  eq((x.match(/itunes:image/g) || []).length, 2, 'cover missing on channel or item');
  ok(!/\/art\//.test(x), 'feed still points at removed per-episode art');
});
t('HEAD is answered without streaming the body', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  ok(/req\.method === 'HEAD'/.test(src), 'no HEAD branch - Apple probes artwork with HEAD');
  ok(/new Response\(null, \{ status: 200/.test(src), 'HEAD returns a body');
});
t('status reports the cover so a 404 is not silent', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  ok(/coverStatus/.test(src), 'no cover diagnostic in /status');
  ok(/512KB/.test(src), 'no file size check against the feed limit');
});
t('page uses the cover as its hero and degrades if it is missing', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  ok(html.includes('/cover/show.jpg'), 'cover not referenced');
  ok(html.includes('nocover'), 'no fallback when the cover fails to load');
  ok(html.includes('class="vh"'), 'no accessible h1 behind the image');
  ok(/alt="A green steam locomotive/.test(html), 'cover has no descriptive alt text');
});
t('cover square is renderer-independent, not dependent on CSS aspect-ratio support', () => {
  // 2026-08-30 bug: aspect-ratio:1/1 silently failed to apply in the field, a
  // square cover was forced into a tall box, and object-fit:cover cropped the
  // title off both edges. Fixed with the padding-top intrinsic-ratio box, which
  // every CSS renderer since the 1990s supports. This test locks that choice in -
  // reverting to bare aspect-ratio must fail this test.
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const box = (html.match(/\.coverBox\{[^}]+\}/) || [''])[0];
  const before = (html.match(/\.coverBox::before\{[^}]+\}/) || [''])[0];
  const img = (html.match(/\.cover\{[^}]+\}/) || [''])[0];
  ok(before.includes('padding-top:100%'), 'no padding-top square hack - regressed to aspect-ratio only');
  ok(!box.includes('aspect-ratio'), 'coverBox still depends on CSS aspect-ratio support');
  ok(img.includes('position:absolute'), 'cover image not filling the reserved square via absolute positioning');
});
t('hero does not push the episode below the fold', () => {
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  const m = html.match(/\.coverBox\{[\s\S]*?width:min\((\d+)px/);
  ok(m && Number(m[1]) <= 260, `cover hero width ${m ? m[1] : '?'}px is too tall for a mobile first screen`);
});
t('feed description matches the M/W/F cadence', () => {
  const x = buildRss([], 'https://x.dev', 'c');
  ok(!/every weekday/i.test(x), 'feed still promises every weekday - cadence is Mon/Wed/Fri');
});
t('rss escapes ampersand in title', () =>
  ok(buildRss([{ date: 'd', title: 'B&O', summary: '', bytes: 1, duration: '1:00', publishedAt: new Date().toISOString() }], 'o', 'c').includes('B&amp;O'), 'unescaped'));

console.log('\nAUDIO CONSISTENCY (2026-08-30 volume-drop incident)');
t('voice settings are pinned to the flat/consistent end, not expressive', () => {
  // Locks the fix in. If stability drifts back down, the same volume-drop
  // failure mode returns on the next reflective passage.
  ok(VOICE_SETTINGS.stability >= 0.75, `stability ${VOICE_SETTINGS.stability} is in ElevenLabs' expressive range`);
  eq(VOICE_SETTINGS.style, 0, 'style exaggeration must be 0 - it is the main driver of mid-take drift');
  eq(VOICE_SETTINGS.use_speaker_boost, true, 'speaker boost should normalize output level at the source');
});
t('every synthesis call uses the SAME pinned settings', () => {
  const src = fs.readFileSync(new URL('../src/tts.js', import.meta.url), 'utf8');
  ok(/\.\.\.VOICE_SETTINGS/.test(src), 'a call is not using the shared pinned settings object');
  ok(!/stability:\s*0\.55/.test(src), 'old expressive stability value still present somewhere');
});
t('persona forbids stage-direction phrasing that cues theatrical delivery', () => {
  const src = fs.readFileSync(new URL('../src/script.js', import.meta.url), 'utf8');
  ok(/DELIVERY DISCIPLINE/.test(src), 'no delivery discipline block');
  ok(/sit with that for a moment/i.test(src), 'the specific offending phrase is not named as an example');
});
t('review flags never reach the public manifest or the page', () => {
  const idx = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  ok(/flags: _flags, \.\.\.publicEpisode/.test(idx), 'flags not stripped before writing the public manifest');
  ok(idx.includes('episodes-admin.json'), 'no separate admin manifest - flags have nowhere safe to live');
  const html = fs.readFileSync(new URL('../public/index.html', import.meta.url), 'utf8');
  ok(!/e\.flags/.test(html), 'front end still reads e.flags - it can only ever be undefined now, but the code is a trap for the next edit');
});
t('status surfaces whether the show can publish, not just pool size', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  ok(/canPublish/.test(src), 'status does not report whether publishing is possible');
  ok(/verifiedEvents/.test(src) && /verifiedFeats/.test(src), 'status does not count verified items separately from pool size');
  ok(/publishBlockedReason/.test(src), 'status gives no reason when publishing is blocked');
});
t('/admin/episodes requires auth like /status', () => {
  const idx = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const seg = idx.slice(idx.indexOf('/admin/episodes'), idx.indexOf('/admin/episodes') + 150);
  ok(seg.includes('auth(req, env)'), 'admin episode data is not gated behind auth');
});

console.log('\nCONFIG');
const wr = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
t('exactly one r2 binding', () => eq((wr.match(/"binding":\s*"BUCKET"/g) || []).length, 1, 'binding count'));
t('run_worker_first is nested inside assets, not top level', () => {
  const assetsBlock = wr.slice(wr.indexOf('"assets"'), wr.indexOf('"workers_dev"'));
  ok(assetsBlock.includes('run_worker_first'), 'run_worker_first is not inside assets - wrangler will ignore it');
  ok(assetsBlock.includes('"/audio/*"') && assetsBlock.includes('"/rss.xml"'), 'paths missing');
});
t('empty script is refused, not published', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  ok(src.includes('script too short to ship'), 'no word floor guard');
  ok(src.includes('tts produced zero bytes'), 'no audio byte guard');
  ok(src.includes('anthropic returned no text'), 'no empty-completion guard');
});
t('thinking disabled and token budget covers it', () => {
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  ok(/thinking:\s*\{\s*type:\s*'disabled'/.test(src), 'thinking not disabled');
  const m = src.match(/maxTokens\s*=\s*(\d+)/);
  ok(m && Number(m[1]) >= 4000, `max_tokens ${m ? m[1] : '?'} too small to survive a thinking budget`);
  ok(src.includes('truncated'), 'no truncation flag');
});
t('cron is Mon/Wed/Fri', () => ok(wr.includes('0 11 * * MON,WED,FRI'), 'cron not M/W/F (use day names: Cloudflare 1 = Sunday)'));
t('cron and PUBLISH_DAYS agree', () => {
  const cron = wr.match(/"crons":\s*\["0 11 \* \* ([^"]+)"\]/);
  const days = wr.match(/"PUBLISH_DAYS":\s*"([^"]+)"/);
  ok(cron && days, 'cron or PUBLISH_DAYS missing');
  // The cron uses day NAMES (Cloudflare numbers weekdays 1-7 from Sunday) and
  // PUBLISH_DAYS uses JS getUTCDay() numbers, so compare the days they mean,
  // not the text. Comparing text is what kept "1,3,5" in the cron (= Sun/Tue/Thu).
  const JS_DAY = { SUN: 0, MON: 1, TUE: 2, WED: 3, THU: 4, FRI: 5, SAT: 6 };
  const cronDays = cron[1].split(',').map(n => JS_DAY[n.trim().toUpperCase()]);
  ok(cronDays.every(n => n !== undefined), `cron weekdays must be names, got ${cron[1]}`);
  eq(cronDays.sort().join(','), days[1].split(',').map(Number).sort().join(','), 'cron schedule and PUBLISH_DAYS have drifted apart');
});
t('month-precision items match anywhere in their month', () => {
  const m = pool.items.filter(i => i.precision === 'MONTH');
  ok(m.length > 0, 'no month-precision items - mitigation not applied');
});
t('no softened item still claims to be "the first"', () => {
  const bad = pool.items.filter(i => i.claimQualifier === 'softened' &&
    /\bthe first\b/i.test(i.title + i.storyFacts + (i.hook || '')));
  eq(bad.length, 0, `softened items still saying "the first": ${bad.map(x => x.id).join(',')}`);
});
t('every superlative is bounded in time', () => {
  const bad = pool.items.filter(i => (i.failureModes || []).includes('C') && !i.supersededNote);
  eq(bad.length, 0, `unbounded superlatives: ${bad.map(x => x.id).join(',')}`);
});
t('every contested figure is marked disputed', () => {
  const bad = pool.items.filter(i => (i.failureModes || []).includes('E') && !i.figureDisputed);
  eq(bad.length, 0, `unmarked contested figures: ${bad.map(x => x.id).join(',')}`);
});
t('prompt forbids sharpening a hedged claim', () => {
  const src = fs.readFileSync(new URL('../src/script.js', import.meta.url), 'utf8');
  ok(/CLAIM DISCIPLINE/.test(src), 'no claim discipline block');
  ok(/Sharpening a hedged claim is a factual error/.test(src), 'no anti-sharpening rule');
});
t('precision renders honestly and never over-claims', () => {
  const base = { month: 10, day: 7, year: 1826 };
  eq(spokenWhen({ ...base, precision: 'MONTH' }), 'in October of 1826', 'month form');
  eq(spokenWhen({ ...base, precision: 'SEASON' }), 'in the autumn of 1826', 'season form');
  eq(spokenWhen({ ...base, precision: 'YEAR' }), 'in 1826', 'year form');
  for (const p of ['MONTH', 'SEASON', 'YEAR', 'CIRCA'])
    ok(!/seventh/.test(spokenWhen({ ...base, precision: p })), `${p} leaked the day`);
});
t('unknown precision degrades to the safest form, not the loudest', () =>
  ok(!/October/.test(spokenWhen({ month: 10, day: 7, year: 1826, precision: 'NONSENSE' })), 'bad precision over-claimed'));
t('DAY precision demands two sources', () => {
  const base = { ...pool.items[0], verification: 'VERIFIED', verifiedOn: '2026-08-30',
                 pairingChecked: true, precision: 'DAY', sources: ['only one'] };
  let threw = false;
  try { validatePool([base]); } catch { threw = true; }
  ok(threw, 'accepted DAY precision on a single source');
});
t('prompt carries the precision rule', () => {
  const p = buildUserPrompt({ title: 'T', region: 'R', storyFacts: 'F', hook: 'H', year: 1826 },
    { title: 'F', region: 'R', year: 1872, storyFacts: 'S', hook: 'H' }, '2026-09-01', 'in October of 1826');
  ok(p.includes('in October of 1826'), 'when phrase missing');
  ok(/PRECISION RULE/.test(p), 'no precision instruction to the model');
});
t('sign off makes no promise about tomorrow', () => {
  ok(!/tomorrow/i.test(SIGN_OFF), 'sign off says tomorrow but cadence is M/W/F');
  ok(/next time/i.test(SIGN_OFF), 'no cadence-agnostic closer');
});
t('custom domain is declared, not dashboard-only', () =>
  ok(wr.includes('rails.stluker.com') && wr.includes('"custom_domain": true'), 'route not declared'));
t('workers.dev disabled so deploy cannot re-enable it', () =>
  ok(wr.includes('"workers_dev": false'), 'workers_dev would default to true'));
t('PUBLIC_ORIGIN matches the custom domain', () => {
  const m = wr.match(/"PUBLIC_ORIGIN":\s*"https:\/\/([^"]+)"/);
  ok(m && m[1] === 'rails.stluker.com', `PUBLIC_ORIGIN is ${m ? m[1] : 'unset'}`);
});

console.log('\nRUN LOG');
{
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  const sched = src.slice(src.indexOf('async scheduled('), src.indexOf('async fetch('));
  t('scheduled() records every invocation, including off-day skips', () => {
    ok((sched.match(/recordRun\(/g) || []).length >= 3, 'scheduled() has an unrecorded path');
    ok(/skipped: 'off day'/.test(sched), 'off-day skip is not recorded');
  });
  t('scheduled() rethrows so Workers Logs still sees the failure', () =>
    ok(/catch \(e\)[\s\S]*throw e/.test(sched), 'cron errors swallowed'));
  t('/refresh records its runs', () => {
    const ref = src.slice(src.indexOf("p === '/refresh'"), src.indexOf("p === '/status'"));
    ok((ref.match(/recordRun\(/g) || []).length >= 2, '/refresh has an unrecorded path');
  });
  t('/status reports cron health and last publish', () => {
    const st = src.slice(src.indexOf("p === '/status'"), src.indexOf("p === '/diag'"));
    for (const k of ['lastCronRun', 'cronProblem', 'recentRuns', 'lastPublished']) ok(st.includes(k), 'missing ' + k);
  });
  t('recordRun cannot throw into a run', () =>
    ok(/async function recordRun[\s\S]*?try \{[\s\S]*?\} catch/.test(src), 'recordRun unguarded'));
}

console.log('\nFEED + MEDIA');
{
  const src = fs.readFileSync(new URL('../src/index.js', import.meta.url), 'utf8');
  t('/feed.xml serves the feed, not a 404', () =>
    ok(/p === '\/rss\.xml' \|\| p === '\/feed\.xml'/.test(src), '/feed.xml not routed'));
  t('/feed.xml runs worker-first so assets cannot shadow it', () => {
    const wr3 = fs.readFileSync(new URL('../wrangler.jsonc', import.meta.url), 'utf8');
    ok(wr3.includes('"/feed.xml"'), '/feed.xml missing from run_worker_first');
  });
  t('Range requests get a real 206 with content-range', () => {
    ok(/range: req\.headers/.test(src), 'Range header not passed to R2');
    ok(/status: 206/.test(src) && /content-range/.test(src), 'no 206 path');
  });
}

console.log(`\n${pass} passed, ${fail} failed\n`);
process.exit(fail ? 1 : 0);
