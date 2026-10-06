import { forSpeech } from './pronounce.js';
import { toAscii } from './ascii.js';
import { SECTION_ORDER } from './script.js';

export const MAX_BLOCK_CHARS = 4000;          // well under provider limit
export const PAUSES = { cold_open: 0.9, section: 0.7, before_question: 1.2 };

// FIXED VOICE SETTINGS - not tunable per episode, on purpose.
// 2026-08-30: the air brake episode audibly dropped in volume mid-section. Root
// cause: the prior stability setting sat in ElevenLabs' EXPRESSIVE range, which
// deliberately varies delivery - pace, emphasis, and loudness - in response to
// the emotional register of the text. This show's persona writes reflective,
// rhetorical prose on purpose ("Sit with that for a moment", "Sounds backward,
// doesn't it?"), and that is exactly the kind of text an expressive model treats
// as a cue to go quiet and slow. The volume drop was not a bug in the pipeline;
// it was the model doing what a low-stability setting asks it to do, on text
// written to invite it.
// A Worker cannot decode and loudness-normalize MP3 after the fact - there is no
// ffmpeg here and no budget for a WASM audio pipeline for a 5 minute daily show.
// The correct fix is upstream: ask for flat, consistent delivery in the first
// place. stability high and style at 0 trade a little expressiveness for a show
// that sounds the same in the first paragraph as the last, every episode - which
// matters far more for a daily show a child hears three times a week than any
// single dramatic flourish would.
export const VOICE_SETTINGS = {
  stability: 0.82,        // High end: flat, consistent, minimal emotional swing.
  similarity_boost: 0.8,
  style: 0,                // 0 disables style exaggeration entirely - the main lever for
                            // mid-take loudness/pace drift on emotionally-coded text.
  use_speaker_boost: true, // normalizes the voice's own output level before it ever
                            // leaves ElevenLabs, independent of anything downstream.
};

// Two strings from the start: clean (transcript, word math) and speech (markup, API only).
export function buildNarration(cleanScript) {
  const clean = toAscii(cleanScript).trim();
  const paras = clean.split(/\n\s*\n/).filter(Boolean);
  let speech = '', pauseTotal = 0;
  paras.forEach((p, i) => {
    speech += forSpeech(p);
    if (i < paras.length - 1) {
      const isQ = /\?\s*$/.test(paras[i + 1]) || i === paras.length - 2;
      const secs = i === 0 ? PAUSES.cold_open : (isQ ? PAUSES.before_question : PAUSES.section);
      speech += ` <break time="${secs}s" />\n\n`;
      pauseTotal += secs;
    }
  });
  return { clean, speech, pauseTotal };
}

export function splitBlocks(speech) {
  const out = []; let cur = '';
  for (const p of speech.split(/\n\n/)) {
    if ((cur + p).length > MAX_BLOCK_CHARS) { if (cur) out.push(cur); cur = p; }
    else cur += (cur ? '\n\n' : '') + p;
  }
  if (cur) out.push(cur);
  return out;
}

// Never trust provider self-reports. Compute it. (Gotcha 5)
export function estimateSeconds(cleanText, wpm, pauseTotal) {
  const words = cleanText.split(/\s+/).filter(Boolean).length;
  return Math.round((words / wpm) * 60 + pauseTotal);
}

export async function narrate(speech, env) {
  const voice = env.NARRATOR_VOICE_ID;
  const speed = Math.min(1.2, Math.max(0.7, Number(env.NARRATOR_SPEED || 0.98)));
  const blocks = splitBlocks(speech);
  const parts = [];
  for (const b of blocks) {
    const r = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voice}`, {
      method: 'POST',
      headers: { 'xi-api-key': env.ELEVENLABS_API_KEY, 'Content-Type': 'application/json' },
      body: JSON.stringify({
        // CHANGED 2026-10-06: was eleven_multilingual_v2 (1 credit/char).
        // Flash v2.5 is 0.5 credits/char -- halves this show's ElevenLabs
        // usage on a shared Creator plan that every podcast draws from. It
        // supports the same <break> tags, voice_settings and speed. If the
        // narrator sounds noticeably different, revert this one line.
        text: b, model_id: 'eleven_flash_v2_5',
        voice_settings: { ...VOICE_SETTINGS, speed },
      }),
    });
    if (!r.ok) throw new Error(`tts ${r.status}: ${(await r.text()).slice(0, 300)}`);
    parts.push(new Uint8Array(await r.arrayBuffer()));
  }
  const total = parts.reduce((n, p) => n + p.length, 0);
  const out = new Uint8Array(total); let o = 0;
  for (const p of parts) { out.set(p, o); o += p.length; }
  return out;
}
