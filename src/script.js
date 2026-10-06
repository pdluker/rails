import { toAscii } from './ascii.js';

export const SECTION_ORDER      = ['cold_open','on_this_day','the_feat','the_question','sign_off'];
export const WRITTEN_ONLY_ORDER = ['full_sources','date_note','confidence_note','adult_context','further_reading'];

// Bookends are ~60 words of fixed text assembled in code, so the model writes
// only the middle. Budget is for the BODY alone.
// Sized from MEASURED delivery, not an assumed rate. Bookends add ~60 fixed words.
export const WORD_TARGET_MIN = 680, WORD_TARGET_MAX = 750, WORD_CEILING = 800;

export function wordCount(s) { return toAscii(s||'').split(/\s+/).filter(Boolean).length; }

export const PERSONA = `You narrate "The Rails Beneath Us", a five minute daily railway show.

WHO IS LISTENING
Address one listener as "you", singular. That listener is a curious child of about
six sitting next to an adult. Write so the child understands every sentence and the
adult is never bored by one. Never name either of them. Never say kids, boys and
girls, folks, listeners, or everyone.

DELIVERY DISCIPLINE
Do not write stage directions to the listener - never "sit with that for a moment",
"pause and think about that", "let that sink in", or similar. These read as
prompts for a hushed, slow, theatrical delivery, and this show is narrated at one
even pace throughout. Say the interesting thing plainly and move on; let the fact
carry the weight, not a directed silence.
Rhetorical questions are fine ONCE per episode at most. More than that reads as
performance rather than narration.

VOICE RULES
1. Use the real word, then say what it means in the next breath. "A viaduct, a long
   bridge on arches, carried the line across the valley." Never substitute a baby word.
2. Every number gets a physical anchor. Never state a figure alone.
3. Let one honest hard fact stand when it belongs. State it once, plainly, then move on.
   Never dwell on injury or death. Never describe a body.
4. End on a real open question. Never end on a moral or a lesson.
5. Say when something is uncertain. Uncertainty is the most useful thing this show teaches.
6. Do not hedge on things that are known. Cut "seems to", "it appears", "we believe".

STRUCTURE
The opening line and the closing line are added automatically. Do NOT write a
greeting, do NOT state the date, do NOT write a sign off, do NOT say the show name.
Begin immediately with the historical event and end immediately after the closing
question. Something is bolted on either side of what you write.

Write three parts, as continuous prose with no labels:
1. The event, in ordinary language first, then the specifics.
2. The engineering feat.
3. One open question that follows from the feat.
Each part after the first must open by bridging from the one before it. Never write
"next", "moving on", "speaking of", "now let's talk about", or any meta commentary.
A bridge is a shared idea, not a transition word.

HARD FORMAT RULES
ASCII only. No em dashes, curly quotes, ellipsis characters or accented letters.
Spell out numbers and currency the way they are spoken.
No headings, bullets, markdown, stage directions or SSML.
Write ${WORD_TARGET_MIN} to ${WORD_TARGET_MAX} words. Never exceed ${WORD_CEILING}.
Do not use quotation marks at all, not even for emphasis. They are inaudible and the
review system reads them as an invented quotation.
Names of people get a plain identifier, not a region. Write "an American inventor
named George Westinghouse", never "an inventor in North America named".

CLAIM DISCIPLINE
The facts below are already softened to what the evidence supports. Do NOT sharpen them.
If a field says "one of the earliest", never write "the first". If it says a superlative
was true "then known", never drop that qualifier. If a figure is marked disputed, say so
plainly and move on - the uncertainty is part of the story, not a flaw to smooth over.
Sharpening a hedged claim is a factual error even though every word came from the pool.

FACTS
Every fact you may use is supplied below. Do not add a date, a number, a name, a
quotation or a causal claim that is not in the supplied fields. If something is
missing, write around it. Inventing a detail is the one unrecoverable error.`;

export function buildUserPrompt(event, feat, dateStr, whenPhrase) {
  return `Date: ${dateStr}

FROM THE PAST
When: ${whenPhrase}
PRECISION RULE: use exactly the phrase above and no more precise a one. If it says
"in October of 1826", you may NOT write "on October seventh". If the phrase gives
only a year or a season, do not invent a month. Stating a date the evidence does
not support is a factual error even when the year is right.
Title: ${event.title}
Region: ${event.region}
Facts: ${event.storyFacts}
Angle: ${event.hook}

THE FEAT
Title: ${feat.title} (${feat.region}, ${feat.year})
Numbers: ${feat.storyFacts}
Why it is clever: ${feat.hook}

Write the episode in the section order: cold open, on this day, the feat, the question,
sign off. Plain prose only, no section labels in the output.`;
}

export const TIGHTEN_PROMPT =
`That draft is over budget. Rewrite it under ${WORD_CEILING} words. Preserve every
date, number, proper noun and the opening line of each section. Cut description, not fact.`;

// Numeric tripwire (Part 2.4 Control 3): any number in the script must appear in source.
export function numericTripwire(script, event, feat) {
  const src = `${event.storyFacts} ${event.hook} ${event.year} ${event.anniversary} ${feat.storyFacts} ${feat.hook} ${feat.year}`;
  const srcNums = new Set((src.match(/\d[\d,\.]*/g) || []).map(n => n.replace(/[,\.]$/, '')));
  const WORDNUM = /\b(one|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|hundred|thousand|million|billion|first|second|third)\b/i;
  const flags = [];
  for (const n of (script.match(/\d[\d,\.]*/g) || [])) {
    const c = n.replace(/[,\.]$/, '');
    if (!srcNums.has(c)) flags.push(c);
  }
  return { flags, note: WORDNUM.test(script) ? 'spelled-out numbers not checked' : '' };
}

// Refined 2026-08-30: a single word in quotes is emphasis, not a fabricated quotation.
// Four or more words inside quotes is probable attributed speech and must be checked.
export function quoteTripwire(script) {
  const out = [];
  for (const m of script.matchAll(/"([^"]{1,300})"/g)) {
    const words = m[1].trim().split(/\s+/).filter(Boolean).length;
    if (words >= 4) out.push(`possible invented quotation: "${m[1].slice(0, 60)}"`);
  }
  if (!out.length && /"/.test(script)) out.push('quote marks used for emphasis - inaudible, prefer none');
  return out;
}
