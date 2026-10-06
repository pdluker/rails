import { validatePool, QUARANTINE_IDS } from './pool-schema.js';
import { selectForDate } from './selection.js';
import { toAscii } from './ascii.js';
import { PERSONA, buildUserPrompt, TIGHTEN_PROMPT, wordCount,
         WORD_CEILING, numericTripwire, quoteTripwire, WRITTEN_ONLY_ORDER } from './script.js';
import { buildNarration, narrate, estimateSeconds } from './tts.js';
import { coldOpen, SIGN_OFF, assemble, spokenWhen } from './bookends.js';
import { buildRss } from './rss.js';

const J = (o, s = 200) => new Response(JSON.stringify(o, null, 1),
  { status: s, headers: { 'content-type': 'application/json', 'cache-control': 'no-store' } });

function safeEq(a, b) {
  a = a || ''; b = b || '';
  if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
const auth = (req, env) =>
  safeEq((req.headers.get('authorization') || '').replace(/^Bearer\s+/i, ''), env.REFRESH_SECRET);

const rj = async (env, k, d = null) => { const o = await env.BUCKET.get(k); return o ? await o.json() : d; };
const wj = (env, k, v) => env.BUCKET.put(k, JSON.stringify(v), { httpMetadata: { contentType: 'application/json' } });

async function claude(env, system, messages, maxTokens = 8000) {
  // GOTCHA 21: reasoning-capable models can spend the ENTIRE max_tokens budget on
  // thinking and return zero text blocks. max_tokens must cover thinking AND output,
  // and thinking is disabled outright for this show - the task is a short scripted
  // narration against locked facts, which needs no reasoning budget.
  const model = env.SCRIPT_MODEL || 'claude-sonnet-5';
  const base = { model, max_tokens: maxTokens, system, messages };

  async function call(body) {
    const r = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
      body: JSON.stringify(body),
    });
    return { ok: r.ok, status: r.status, text: await r.text() };
  }

  // Try with thinking explicitly disabled; fall back if the model rejects the param.
  let res = await call({ ...base, thinking: { type: 'disabled' } });
  if (!res.ok && res.status === 400 && /thinking/i.test(res.text)) {
    res = await call(base);
  }
  if (!res.ok) throw new Error(`anthropic ${res.status}: ${res.text.slice(0, 300)}`);

  const d = JSON.parse(res.text);
  const text = (d.content || []).filter(c => c.type === 'text').map(c => c.text).join('\n');
  if (!text.trim()) {
    const kinds = (d.content || []).map(c => c.type);
    const th = d.usage && d.usage.output_tokens_details ? d.usage.output_tokens_details.thinking_tokens : 'n/a';
    throw new Error(`anthropic returned no text. model=${model} stop_reason=${d.stop_reason} ` +
      `blocks=${JSON.stringify(kinds)} thinking_tokens=${th} max_tokens=${maxTokens}. ` +
      (d.stop_reason === 'max_tokens'
        ? 'Budget exhausted before any text was emitted - raise max_tokens or disable thinking.'
        : 'No text block in a completed response.'));
  }
  if (d.stop_reason === 'max_tokens') {
    // truncated mid-sentence: usable but flawed, surface it rather than hide it
    return text + '\n[TRUNCATED]';
  }
  return text;
}

// Apple rejects a feed whose artwork 404s, is under 1400x1400, or whose host
// refuses HEAD. The page degrades quietly for listeners; /status must not.
async function coverStatus(env, origin) {
  const obj = await env.BUCKET.head('cover/show.jpg');
  if (!obj) return { present: false, url: `${origin}/cover/show.jpg`,
    problem: 'MISSING - upload cover/show.jpg to R2 or Apple will reject the feed' };
  const kb = Math.round(obj.size / 1024);
  const notes = [];
  if (kb > 512) notes.push(`${kb}KB exceeds the 512KB feed limit`);
  const ct = obj.httpMetadata && obj.httpMetadata.contentType;
  if (!/^image\/(jpeg|png)$/.test(ct || '')) notes.push(`content-type is ${ct || 'unset'}, must be image/jpeg or image/png`);
  return { present: true, sizeKB: kb, contentType: ct || null,
    url: `${origin}/cover/show.jpg`,
    reminder: 'Apple requires 1400x1400 to 3000x3000, RGB, and HEAD support. Dimensions are not readable here - check the file itself.',
    problem: notes.length ? notes.join('; ') : null };
}

// ---- run log ----
// The Sep 2026 outage ran 11+ slots with nothing anywhere to say whether the cron
// had fired and failed, or never fired at all. scheduled() wrote nothing, and its
// errors went only to Workers Logs. Every invocation - including off-day skips,
// which double as a heartbeat proving the trigger is registered - now leaves a
// record in R2 that /status reports.
const RUN_LOG_KEY = 'runs/log.json', RUN_LOG_MAX = 40;
export async function recordRun(env, entry) {
  try {
    const log = (await rj(env, RUN_LOG_KEY)) || [];
    log.unshift({ at: new Date().toISOString(), ...entry });
    await wj(env, RUN_LOG_KEY, log.slice(0, RUN_LOG_MAX));
  } catch { /* the log must never be the thing that breaks a run */ }
}
const summarize = r => r && ({ ok: !!r.ok, cached: !!r.cached, error: r.error || null,
  words: r.episode?.words, bytes: r.episode?.bytes, title: r.episode?.title });

// ---- the one pipeline function. Both entry points call this. ----
export async function runPipeline(env, dateStr, force = false) {
  const lockKey = `locks/${dateStr}`;
  if (!force) {
    const existing = await rj(env, `episodes/${dateStr}.json`);
    if (existing) return { ok: true, cached: true, episode: existing };
  }
  try { await env.BUCKET.put(lockKey, '1', { onlyIf: { etagDoesNotMatch: '*' } }); }
  catch { return { ok: false, error: 'run already in progress' }; }

  try {
    // 1. SELECT
    const pool = await rj(env, 'pool/items.json');
    if (!pool) throw new Error('pool/items.json missing - run the migration first');
    validatePool(pool.items);
    const used = (await rj(env, 'used.json')) || { events: [], feats: [] };
    const { event, feat, exactDateMatch, matchKind } = selectForDate(pool.items, dateStr, used);

    // 2. SCRIPT - validate length in code, exactly ONE tightening call, never loop
    let script = toAscii(await claude(env, PERSONA, [{ role: 'user', content: buildUserPrompt(event, feat, dateStr, spokenWhen(event)) }]));
    let wc = wordCount(script);
    if (wc > WORD_CEILING) {
      const retry = toAscii(await claude(env, PERSONA, [
        { role: 'user', content: buildUserPrompt(event, feat, dateStr, spokenWhen(event)) },
        { role: 'assistant', content: script },
        { role: 'user', content: TIGHTEN_PROMPT }]));
      if (wordCount(retry) < wc) { script = retry; wc = wordCount(retry); }
    }

    // tripwires - logged and surfaced, never thrown
    if (wc < 200) throw new Error(`script too short to ship: ${wc} words. Refusing to publish.`);

    const truncated = script.includes('[TRUNCATED]');
    script = script.replace('[TRUNCATED]', '').trim();
    if (truncated) wc = wordCount(script);

    const nt = numericTripwire(script, event, feat);
    const flags = [...nt.flags.map(f => `unsourced number: ${f}`), ...quoteTripwire(script)];
    if (truncated) flags.push('script hit max_tokens and may end mid-sentence - review before publishing');

    // 3. BOOKEND then NARRATE. Fixed open and close, assembled in code so they are
    //    byte-identical in every episode.
    const full = assemble(coldOpen(dateStr), script, SIGN_OFF);
    wc = wordCount(full);
    const { clean, speech, pauseTotal } = buildNarration(full);
    const wpm = Number(env.WORDS_PER_MINUTE || 125);
    const secs = estimateSeconds(clean, wpm, pauseTotal);
    const audio = await narrate(speech, env);
    if (!audio || audio.length === 0) throw new Error('tts produced zero bytes. Refusing to publish.');
    await env.BUCKET.put(`audio/${dateStr}.mp3`, audio, { httpMetadata: { contentType: 'audio/mpeg' } });

    // Per-episode art removed 2026-08-30: the show cover is now the image for every
    // episode, in the feed and on the page. Generating a second, weaker image that
    // nothing displayed was pure cost and one more thing to fail.

    // 5. PERSIST
    await env.BUCKET.put(`transcript/${dateStr}.txt`, clean, { httpMetadata: { contentType: 'text/plain' } });
    const mm = String(Math.floor(secs / 60)), ss = String(secs % 60).padStart(2, '0');
    const episode = {
      date: dateStr, title: event.title, summary: event.hook,
      eventId: event.id, featId: feat.id, featTitle: feat.title,
      exactDateMatch, matchKind, words: wc, duration: `${mm}:${ss}`, seconds: secs,
      bytes: audio.length, flags, publishedAt: new Date().toISOString(),
      sources: [event.source, feat.source],
      writtenOnly: WRITTEN_ONLY_ORDER,
      confidence: { event: event.confidence, feat: feat.confidence },
    };
    used.events.push(event.id); used.feats.push(feat.id);
    await wj(env, 'used.json', used);
    // Full record, including QA flags, is the source of truth for the operator.
    await wj(env, `episodes/${dateStr}.json`, episode);

    // The PUBLIC manifest is a deliberately separate, redacted object. 'flags' is
    // QA output for the person running the show, not content for the listener -
    // it names failure modes ("unsourced number", "possible invented quotation")
    // that mean nothing to an audience and undermine trust in a finished episode.
    // Splitting these was a real defect: one object served both the admin view
    // and /api/episodes, so anything added for operator visibility was
    // automatically public. Redact explicitly rather than relying on the front
    // end to choose not to render a field it still receives.
    const { flags: _flags, ...publicEpisode } = episode;
    const man = (await rj(env, 'episodes.json')) || [];
    await wj(env, 'episodes.json', [...man.filter(e => e.date !== dateStr), publicEpisode]);

    const admin = (await rj(env, 'episodes-admin.json')) || [];
    await wj(env, 'episodes-admin.json', [...admin.filter(e => e.date !== dateStr), episode]);

    return { ok: true, episode };
  } finally { await env.BUCKET.delete(lockKey); }
}

export default {
  // Publishing days come from config, so cron and code cannot drift apart.
  async scheduled(evt, env) {
    const today = new Date(evt.scheduledTime || Date.now());
    const dateStr = today.toISOString().slice(0, 10);
    const days = String(env.PUBLISH_DAYS || '1,3,5').split(',').map(Number);
    if (!days.includes(today.getUTCDay())) {         // belt and braces if cron fires wide
      await recordRun(env, { trigger: 'cron', cron: evt.cron, date: dateStr, skipped: 'off day' });
      return;
    }
    try {
      const r = await runPipeline(env, dateStr);
      await recordRun(env, { trigger: 'cron', cron: evt.cron, date: dateStr, ...summarize(r) });
    } catch (e) {
      await recordRun(env, { trigger: 'cron', cron: evt.cron, date: dateStr, ok: false, error: e.message });
      throw e;   // still surface it in Workers Logs as a failed invocation
    }
  },

  async fetch(req, env) {
    const url = new URL(req.url), p = url.pathname;
    const origin = env.PUBLIC_ORIGIN || url.origin;

    if (p === '/refresh') {
      if (!auth(req, env)) return J({ error: 'unauthorized' }, 401);
      const d = url.searchParams.get('asOf') || new Date().toISOString().slice(0, 10);
      try {
        const r = await runPipeline(env, d, url.searchParams.get('force') === '1');
        await recordRun(env, { trigger: 'refresh', date: d, ...summarize(r) });
        return J(r);
      } catch (e) {
        await recordRun(env, { trigger: 'refresh', date: d, ok: false, error: e.message });
        return J({ ok: false, error: e.message }, 500);
      }
    }

    if (p === '/status') {
      if (!auth(req, env)) return J({ error: 'unauthorized' }, 401);
      const pool = await rj(env, 'pool/items.json');
      // This is the check that would have caught the current outage immediately:
      // a pool can be fully present and schema-valid while containing zero items
      // the show is actually allowed to select. That state throws no error
      // anywhere visible - /refresh fails silently from the site's perspective,
      // and nothing before this surfaced it in /status.
      const verifiedEvents = pool ? pool.items.filter(i => i.type === 'event' && i.verification === 'VERIFIED').length : 0;
      const verifiedFeats = pool ? pool.items.filter(i => i.type === 'feat' && i.verification === 'VERIFIED').length : 0;
      const canPublish = verifiedEvents > 0 && verifiedFeats > 0;
      // Runs: if no cron entry is newer than ~3 days, the trigger is not firing -
      // a different fault from a run that fires and fails, and the fix differs too
      // (`npx wrangler triggers deploy` vs reading the error below).
      const runs = (await rj(env, RUN_LOG_KEY)) || [];
      const lastCron = runs.find(r => r.trigger === 'cron') || null;
      const cronSilentHours = lastCron ? Math.round((Date.now() - Date.parse(lastCron.at)) / 36e5) : null;
      const eps = (await rj(env, 'episodes.json')) || [];
      const lastPublished = eps.map(e => e.publishedAt).filter(Boolean).sort().pop() || null;
      return J({
        ok: true,
        lastPublished,
        lastCronRun: lastCron, cronSilentHours,
        cronProblem: !lastCron ? 'no cron invocation recorded yet - trigger may not be registered'
          : cronSilentHours > 80 ? `no cron invocation for ${cronSilentHours}h - run: npx wrangler triggers deploy`
          : (lastCron.ok === false ? `last cron run failed: ${lastCron.error}` : null),
        recentRuns: runs.slice(0, 10),
        poolItems: pool ? pool.items.length : 0,
        verifiedEvents, verifiedFeats, canPublish,
        publishBlockedReason: canPublish ? null :
          `no VERIFIED ${verifiedEvents === 0 ? 'events' : 'feats'} - run the Phase 1 worksheet through promote.mjs`,
        quarantineEnforced: QUARANTINE_IDS,
        leak: pool ? pool.items.filter(i => QUARANTINE_IDS.includes(i.id)).map(i => i.id) : [],
        secrets: {
          ANTHROPIC_API_KEY: !!env.ANTHROPIC_API_KEY, ELEVENLABS_API_KEY: !!env.ELEVENLABS_API_KEY,
          NARRATOR_VOICE_ID: !!env.NARRATOR_VOICE_ID, REFRESH_SECRET: !!env.REFRESH_SECRET },
        wpm: env.WORDS_PER_MINUTE, speed: env.NARRATOR_SPEED,
        cover: await coverStatus(env, origin),
      });
    }

    if (p === '/diag') {
      if (!auth(req, env)) return J({ error: 'unauthorized' }, 401);
      const model = env.SCRIPT_MODEL || 'claude-sonnet-5';
      const r = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: { 'x-api-key': env.ANTHROPIC_API_KEY, 'anthropic-version': '2023-06-01', 'content-type': 'application/json' },
        body: JSON.stringify({ model, max_tokens: 64, messages: [{ role: 'user', content: 'Reply with the single word: ready' }] }),
      });
      const raw = await r.text();
      return J({ model, httpStatus: r.status, raw: raw.slice(0, 900) });
    }

    if (p === '/api/episodes') return J((await rj(env, 'episodes.json')) || []);

    if (p === '/admin/episodes') {
      if (!auth(req, env)) return J({ error: 'unauthorized' }, 401);
      return J((await rj(env, 'episodes-admin.json')) || []);
    }

    // /feed.xml is the path people guess (and the one first handed to Overcast);
    // it 404'd. Serve the same feed rather than redirect - some podcast apps
    // do not follow redirects on the initial subscribe.
    if (p === '/rss.xml' || p === '/feed.xml') {
      const eps = (await rj(env, 'episodes.json')) || [];
      return new Response(buildRss(eps, origin, `${origin}/cover/show.jpg`),
        { headers: { 'content-type': 'application/rss+xml; charset=utf-8', 'cache-control': 'no-cache' } });
    }

    const m = p.match(/^\/(audio|transcript|cover)\/(.+)$/);
    if (m) {
      const key = `${m[1]}/${m[2]}`;
      // Apple validates artwork with a HEAD request before it ever GETs the bytes.
      // Serve it from R2 metadata so we never stream a file just to answer a probe.
      if (req.method === 'HEAD') {
        const meta = await env.BUCKET.head(key);
        if (!meta) return new Response(null, { status: 404 });
        const hh = new Headers();
        meta.writeHttpMetadata(hh);
        hh.set('etag', meta.httpEtag);
        hh.set('content-length', String(meta.size));
        hh.set('accept-ranges', 'bytes');
        hh.set('cache-control', 'public, max-age=86400, must-revalidate');
        return new Response(null, { status: 200, headers: hh });
      }
      // accept-ranges was advertised but Range was ignored: every request got a
      // full 200. Apple requires real 206 responses and players use them to seek.
      // R2 parses the Range header itself; obj.range is set only when it applied.
      const wantsRange = req.headers.has('range');
      const obj = await env.BUCKET.get(key, wantsRange ? { range: req.headers } : undefined);
      if (!obj) return new Response('not found', { status: 404 });
      const h = new Headers();
      obj.writeHttpMetadata(h);
      h.set('etag', obj.httpEtag);
      h.set('cache-control', 'public, max-age=86400, must-revalidate');  // never immutable
      h.set('accept-ranges', 'bytes');                                    // Apple needs Range
      if (wantsRange && obj.range) {
        const r = obj.range;
        const start = r.suffix != null ? obj.size - r.suffix : (r.offset ?? 0);
        const len = r.suffix != null ? r.suffix : (r.length ?? obj.size - start);
        h.set('content-range', `bytes ${start}-${start + len - 1}/${obj.size}`);
        h.set('content-length', String(len));
        return new Response(obj.body, { status: 206, headers: h });
      }
      h.set('content-length', String(obj.size));
      return new Response(obj.body, { headers: h });
    }

    if (env.ASSETS) return env.ASSETS.fetch(req);
    return new Response('not found', { status: 404 });
  },
};
