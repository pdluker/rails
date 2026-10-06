# NOTES - The Rails Beneath Us

## Provisioned by Claude (confirmed live)
- R2 bucket `rails-beneath-us` created 2026-08-30T02:38:44Z, ENAM, Standard.
  Verified by read-back with r2_bucket_get.

## NOT done - requires your machine
- `wrangler deploy` (no deploy capability over MCP)
- `wrangler secret put` x4 (no access to your keys)
- Pool upload to R2 (needs wrangler with --remote)
- Custom domain route
- Cover art upload

## Account observations
- 23 Workers already exist. Workers Paid allows 250 cron triggers per ACCOUNT;
  confirm current usage before adding this one.
- An `ironrails` Worker exists (created 2026-05-11, last modified 2026-06-27)
  with NO matching R2 bucket. Likely an abandoned earlier rail attempt.
  GOTCHA 9: do not let it share a name, folder or bucket with this project.
  Decide whether to delete it before deploying.
- Existing buckets follow no single convention (`big-builds-podcast`,
  `innovation-daily`, `pod-audio`). This one is `rails-beneath-us`, matching
  the Worker name exactly.

## Decisions baked in
- WORDS_PER_MINUTE 125 and NARRATOR_SPEED 0.98, not the doc defaults of 140/1.06.
  Six-year-old listener. Recalibrate after episode one.
- SCRIPT_MODEL is the mid tier. Amendment 3: the strong model belongs on
  /promote, where fabrication actually enters, not on daily narration.
- Cron is weekdays only: `0 11 * * 1-5`.
- Quarantine is a separate R2 key, not a flag. `selection.js` never reads it.

## Self test
27 assertions, zero network, zero secrets. `npm run check`.
Includes an assertion that fails the build if any quarantined id appears in the pool.

## Build incidents
1. `toAscii` left double spaces after em dash substitution. Caught by the self
   test, fixed by collapsing runs of whitespace. Would have produced audible
   pacing artifacts in TTS.
2. Front end verified in a headless DOM against fake data before shipping
   (GOTCHA 16), not just read as markup.

## Status
Built and verified offline. NOT confirmed live end to end.

## 2026-08-30 - Worker deployed (by you), config reconciled
- Worker `rails-beneath-us` live, id 5a086b1b02924c8ea11ad594f54bae49.
  Confirmed deployed bundle matches source: schema, quarantine ids, tripwires,
  ascii fix all present in the live bundle.
- Custom domain `rails.stluker.com` bound to Production, zone stluker.com.
- workers.dev Production and Preview toggles switched OFF by hand in the dashboard.

### Drift risk found and fixed
wrangler.jsonc had no `routes` and no `workers_dev` key. `workers_dev` defaults
to TRUE, so the next `wrangler deploy` would have re-enabled the workers.dev
subdomain you just turned off, and the custom domain existed only as dashboard
state with nothing in version control. Both are now declared:

    "workers_dev": false,
    "preview_urls": false,
    "routes": [{ "pattern": "rails.stluker.com", "custom_domain": true }]

Self test now asserts all three, plus that PUBLIC_ORIGIN matches the route.
30 assertions, 0 failures.

## 2026-08-30 - first real run FAILED SILENTLY. Two bugs, both mine.

### GOTCHA 20 (new): ok:true with an empty artifact
First /refresh returned `"ok": true` with `words: 0, seconds: 0, bytes: 0` and
persisted the episode to episodes.json. Nothing was generated and nothing threw.

Chain: claude() returned an empty string -> buildNarration('') produced no
paragraphs -> splitBlocks('') returned [] -> narrate() never called ElevenLabs,
returned a zero-length Uint8Array -> R2 accepted a 0-byte mp3 -> episode marked
published. Every step handled empty input "gracefully" and the failure travelled
the whole pipeline disguised as success.

The doc's Gotcha 5 says never trust a model's self-reported metadata. This is the
sibling rule: never trust your OWN success flag if you did not assert the artifact
is non-empty. `ok: true` must mean "an artifact exists", not "no exception".

Three guards added, all fail loudly:
- claude(): a 200 with no text block throws, reporting model, stop_reason,
  block types and usage.
- pipeline: script under 200 words refuses to publish.
- pipeline: zero-byte audio refuses to publish.
Plus /diag - an authed route that makes one 64-token Anthropic call and returns
the raw response, to identify the root cause of the empty completion.

### GOTCHA 19: silently ignored config
wrangler 4.126 warned "Unexpected fields found in top-level field:
run_worker_first". Per Cloudflare docs, it must be NESTED inside `assets`.
At top level it is parsed, warned about, and discarded - the protection reads as
configured while doing nothing. /rss.xml worked anyway only because public/ has
just index.html, so nothing was shadowing it. Would have broken the moment a
second static file was added.

Self test now asserts run_worker_first is inside the assets block, not merely
present in the file. 31 assertions, 0 failures.

### Cover art
`--file=cover.jpg` failed: file not present in the project folder. Export the
poster to 3000x3000 JPG and place it in the project root first. The trailing
"Assertion failed ... uv_handle" is a known wrangler-on-Windows noise on error
exit, not a separate fault.

## 2026-08-30 - GOTCHA 21: thinking budget consumed the entire max_tokens

Root cause of the empty episode, surfaced exactly as the new guard intended:

    stop_reason = max_tokens
    blocks      = ["thinking"]
    output_tokens = 1600, thinking_tokens = 1600

claude-sonnet-5 has extended thinking on. max_tokens was 1600, sized for a 660
word script (~900 tokens) with no allowance for a reasoning budget. The model
spent all 1600 tokens thinking and emitted ZERO text blocks. The API returned
200 and the old code read that as an empty script.

/diag passed because "reply with one word" needs no reasoning - which is why a
cheap liveness probe can look healthy while the real workload fails. Worth
remembering: a diagnostic that does not resemble the real call proves less than
it appears to.

Fix:
- thinking explicitly disabled. This show writes short narration around locked
  facts; it has no use for a reasoning budget.
- default max_tokens raised 1600 -> 8000, so even if thinking is ever re-enabled
  the budget survives it.
- 400 fallback: if a model rejects the thinking param, retry without it.
- stop_reason max_tokens with text present now returns the text and raises a
  review flag rather than silently shipping a truncated script.

Self test asserts thinking is disabled, max_tokens >= 4000, and the truncation
flag exists. 32 assertions, 0 failures.

GENERAL RULE for the master doc: when a reasoning-capable model is used,
max_tokens is not the output size. It is the output size PLUS an unbounded
thinking budget. Size it for both or disable thinking.

## Alignment with the Cloudflare Workers system prompt
Adopted: observability head_sampling_rate = 1.
Deliberately diverged: JavaScript not TypeScript (matches the existing pipeline
pattern and keeps the self test dependency-free), and compatibility_date is
2026-08-01 rather than the prompt's stale 2025-03-07. nodejs_compat is not set
because nothing in this Worker uses a Node builtin - adding it would violate the
prompt's own least-privilege guidance.

## 2026-08-30 - first real episodes published. Three defects found.

Pipeline confirmed working: 636 words (target 600-660), 5:12 (target 4:45-5:15),
both inside spec on the first calibrated run. WORDS_PER_MINUTE 125 looks close.

### 1. Art generated but never displayed
art/<date>.svg was written to R2 on every run and the front end never referenced
it. No error anywhere - the file existed, the page just never asked for it.
This is the mirror of Gotcha 20: there, an artifact was missing and reported as
success; here, an artifact existed and was silently unused. Both classes are
invisible without an assertion that the OUTPUT is actually consumed.
Fixed: <img> added with onerror removal so a missing image never breaks the card.
Self test now asserts the page references /art/.

### 2. RSS feed served stale and empty
The page showed two episodes while /rss.xml showed zero items. Both read the same
episodes.json, so the feed was an edge-cached copy from before the first publish:
`cache-control: public, max-age=600, must-revalidate` lets the edge serve a
cached body for ten minutes. must-revalidate does NOT prevent that - it only
governs behaviour once the entry is already stale.
Fixed: feed now sends `no-cache`. A podcast feed is small and must reflect a new
episode the instant it publishes. Audio keeps its long cache; the feed must not.

### 3. audio preload="none" reported 0:00 duration
Cosmetic, but it looks broken. Changed to preload="metadata" so the browser reads
the duration without downloading the file.

### Review flag that fired correctly
"quotation marks in narrative; quotes must come from a pool field" on the
2026-08-30 episode. The tripwire is working as designed. Read that line in the
transcript and confirm the model did not invent a quotation.

## 2026-08-30 - FACTUAL ERROR AIRED. Westinghouse feat entry was wrong.

The 2026-08-30 episode attributed the fail-safe inversion to Westinghouse's 1869
patent. That is wrong and enthusiasts will know it.

- US 88,929, 13 April 1869: the STRAIGHT air brake. Air is sent TO APPLY. NOT
  fail-safe - a burst hose left the train with no brakes at all.
- US 124,405, 5 March 1872: the AUTOMATIC air brake, with the triple valve and a
  per-car reservoir. Line held at ~70 psi; a DROP applies the brakes. This is the
  inversion the episode described.

Root cause is mine. The corpus EVENT entry for 13 April 1869 correctly says
"straight-air brake". The FEAT entry paired 1869 with the fail-safe description,
conflating two inventions three years apart, and I graded it confidence A.

Lesson for the corpus: an entry can be individually plausible and still be a
splice of two true things. Confidence A means "this date belongs to this fact",
not "both halves are separately real". Check pairings, not just facts.

FE0037 corrected to 1872 with both patents named and the 1869 distinction stated
explicitly in the facts field, so the model cannot repeat the conflation.

## Bookends added - assembled in CODE, not written by the model
A ritual is only a ritual if it is identical every time. Generating it per episode
costs tokens and guarantees drift. src/bookends.js emits fixed text; the only
variable in the whole open is the spoken date.

Cold open:  "Two long, one short, one long. That is a train telling the world it
             is coming. This is The Rails Beneath Us. Today is <date>."
Sign off:   "Wherever you are right now, somebody once had to build the way to get
             there. That is the rails beneath us. I will see you tomorrow."

The whistle pattern is the real North American grade crossing signal - long long
short long - so the enthusiast half hears an accurate detail and the child half
hears something they can chant. Body word budget dropped 600-660 to 540-600 to
make room for ~60 words of fixed bookend.

## Quote tripwire refined
It fired on: The brakes were never really "off" waiting to be turned on.
That is emphasis, not a fabricated quotation - a true positive by the old rule and
a useless one. Now: 4+ words inside quotes is flagged as probable invented speech;
a single word raises only a soft note. The persona also now forbids quote marks
outright, since they are inaudible in narration anyway.

## 2026-08-30 - verification made a HARD GATE. Corpus re-graded to UNVERIFIED.

All 224 items reset to verification: UNVERIFIED. selection.js now filters on
BOTH ageRating and verification, so nothing can air until a human has checked it.
Running the show today throws: "no VERIFIED items available". That is correct
behaviour, not a regression.

Schema additions:
  verification    UNVERIFIED | IN_REVIEW | VERIFIED | DISPUTED
  sources[]       array, minimum 2 independent for VERIFIED
  pairingChecked  boolean, required true for VERIFIED
  verifiedOn      date, required for VERIFIED
  riskClasses[]   first_claim | superlative | casualty | attribution | name_drift

pairingChecked exists because of the Westinghouse failure specifically: the date
was right, the description was right, and they belonged to different inventions
three years apart. Two-source checking alone would NOT have caught it - both
halves are independently well documented. The question that catches it is "did
these come from the same event?"

Superlatives now expire: VERIFIED fails schema validation if a superlative was
verified more than 365 days ago.

Corpus risk profile: 126 of 224 items carry a risk class. 82 are "first" claims,
44 percent of all events - by far the largest exposure, because "first" always
hides a definitional argument.

See VERIFICATION_PROTOCOL.md for the cost model and the phased plan.
41 assertions, 0 failures.

## 2026-08-30 - cadence moved to Mon/Wed/Fri

Runway: 184 events = 61 weeks unrepeated, up from 37 at weekday cadence.
Verification economics invert, which is the real reason for the change:
  5/wk cadence + 5 verified/wk = treadmill, one missed week puts you behind
  3/wk cadence + 5 verified/wk = net +2/wk, the buffer deepens on its own
Launch buffer drops from 40 items (~4.7h) to 24 items (~2.8h).

Changes:
- cron "0 11 * * 1-5" -> "0 11 * * 1,3,5"
- new var PUBLISH_DAYS "1,3,5", checked in scheduled() so a wide-firing cron
  cannot publish on an off day. Self test asserts cron and PUBLISH_DAYS agree,
  so the two cannot silently drift.
- SIGN_OFF "I will see you tomorrow" -> "I will see you next time". "Tomorrow"
  is a lie on a Monday when the next episode is Wednesday. Now cadence-agnostic,
  so a future schedule change cannot make the bookend wrong again.

The suite caught its own stale assertion during this change: the ordering test was
still looking for "see you tomorrow" and failed. Exactly what it is for.

Tradeoff accepted: M/W/F is not a commute habit the way daily is. Listener
habit formation is traded for sustainability and accuracy. Given that an error
already reached air and 224 items sit unverified, accuracy is the right side.

43 assertions, 0 failures.

## 2026-08-30 - precision made a schema field

Analysis of softening dates:
  Fixes 2 of the 4 known errors (Granite Railway, Phineas Davis - both within-month).
  Does NOT fix Diesel (months differ, needs YEAR) or Westinghouse (a pairing error,
  not a date error at all).
  Removes 71 of 224 items from hard checking - 31 percent.
  Full corpus verification 57.6h -> 42.7h. Launch buffer 2.8h -> 1.2h.

The bigger lever is the CLAIM, not the date. 84 "first" claims vs 71 date-only items:
  soften date only                      42.7h
  soften "first" claims only            32.4h
  soften date AND "first" claims        18.4h
  + superlatives                        14.9h
  + casualty figures                    12.5h

Softening both date and claim takes the corpus from 57.6h to 18.4h - a 68 percent
cut. Date softening alone is 26 percent.

Implemented: precision is now a required enum on every event.
  DAY    "on October seventh, 1826"
  MONTH  "in October of 1826"
  SEASON "in the autumn of 1826"
  YEAR   "in 1826"
  CIRCA  "around 1826"
spokenWhen() renders the ONLY phrasing allowed and is injected into the prompt with
an explicit rule forbidding greater precision. An unknown precision value degrades
to the safest form, not the loudest.

Schema enforces: DAY precision + VERIFIED requires two sources agreeing ON THE DAY,
not merely two sources about the event.

All events default to DAY - that is the claim currently being made, unverified.
Downgrade each one as verification finds the evidence does not support it. Do NOT
bulk-downgrade to MONTH: precision is a property of the evidence, and blanket
vagueness where the source IS solid throws away real information.

WHAT SOFTENING CANNOT FIX
  attribution (14 items): who invented or patented what. "Westinghouse designed a
  brake that fails safe" is true of 1872 and false of 1869. There is no vaguer way
  to say it that is still worth saying.
  pairing (all items): a softer date does not stop a fact splice.
These two classes still need the full protocol. They are also the errors that hurt
most, because they are the ones an enthusiast notices.

47 assertions, 0 failures.

## 2026-08-30 - all five mitigations applied

  A softened to "one of the earliest"   79 items  (5 kept hard - pinned by a patent
                                                   number or statute, so not definitional)
  B dropped to MONTH precision          73 items
  C bounded in time                     22 items
  D pairingChecked                      41 items  (unchanged - only human check clears it)
  E marked disputed                     20 items

RESULT
  Full corpus verification   52.2h -> 27.4h   48 percent reduction
  Items with no residual risk  179 of 224     79 percent
  Launch buffer                1.6 hours      (was 2.8)
  Airable-clean events         153            51 weeks at 3x/wk

D is now 41 of the 45 residual items - 91 percent of what is left. Everything
cheap has been mitigated; what remains is the class that actually caused the
error that aired. That is the correct shape for the backlog.

SELECTION MADE PRECISION-AWARE
A MONTH item has no meaningful day, so matching on month+day would have made 73
items permanently unmatchable and pushed the show to "FROM THE ARCHIVE" forever.
Now tiered: exact_day, then same_month, then same_season, then archive. Page label
follows: ON THIS DAY / THIS MONTH IN HISTORY / THIS SEASON IN HISTORY / FROM THE
ARCHIVE. This is a net GAIN in matching - 111 day-precision items cover only 92
distinct days, but 73 month-precision items are eligible across whole months.

NEW RISK INTRODUCED BY THE MITIGATION
Softened text can be re-sharpened by the narrator. "one of the earliest railroads
in Minnesota" is one careless rewrite from "the first railroad in Minnesota", and
that would be a factual error where every word came from the pool. Added a CLAIM
DISCIPLINE block to the persona forbidding it, plus a self test asserting no
softened item still contains "the first".

COVERAGE GAP
March has fewer than three month-precision items. Seed a few March entries or that
month leans on exact-day and archive matches.

52 assertions, 0 failures.

## 2026-08-30 - Phase 1 tooling built

DELIBERATE DESIGN DECISION: the worksheet rows are RESEARCH TARGETS, not facts.
Patent number, grant date, birth date and death date columns are BLANK. A model
recalling a patent number is precisely the failure class this project has spent
its whole life fighting, and generating 150 plausible-looking numbers would have
been the single most damaging thing I could hand over.

69 targets: 30 patent subjects, 39 people. ~4-5 min each = 5-6 hours.
That is ~23 weeks of episodes at 3x/week and takes the corpus past 1900 for the
first time.

WHY PATENTS ARE THE RIGHT FIRST BLOCK
0.07 hours per airable episode, the best ratio of any expansion option. A patent
has a number, a grant date and a named assignee: no definitional argument, no
ceremony-versus-service ambiguity. Critically it is the direct antidote to failure
mode D, which is 91 percent of the residual backlog - a patent number IS the
pairing check. Had FE0037 carried US 124,405, the Westinghouse error was impossible.

THE JANNEY TRAP - a live example found while building this
Nearly every source: Eli Janney patented the knuckle coupler in 1873, US 138,405,
granted 29 April. ASME: his FIRST patent was 21 April 1868, and 1873 was his
second. Both are true. So "Janney patented the knuckle coupler" is a mode A and
mode D trap in the cleanest category in the corpus. Deciding WHICH patent the
story is about IS the pairing check. This is now the worked example in the
worksheet's HOW_TO sheet.

Grounded this session, two independent sources, ready to enter as VERIFIED:
  Eli H. Janney  b. 12 Nov 1831, d. 16 Jun 1912, Alexandria VA
                 US 138,405 filed 1 Apr 1873, granted 29 Apr 1873

scripts/promote.mjs merges only rows marked VERIFIED and runs every new item
through validateItem. Rows missing a second source, a pairing check or a precision
are REJECTED and listed. The fix is the worksheet row, never the schema.

52 assertions, 0 failures.

## 2026-08-30 - UI overhaul + a calibration error the screenshot exposed

### DURATION WAS WRONG ON THE PAGE AND IN THE FEED
Page metadata said 5:12. The player said 3:25.
  episode 1: 636 words in 205s = 186 wpm
  episode 2: 624 words in 195s = 192 wpm
Config said 125. The estimate was off by 50 percent, and that number goes into the
RSS enclosure duration, which Apple validates.

Two separate fixes, because they do different things:
  WORDS_PER_MINUTE 125 -> 189. This ONLY corrects the reported number. It does not
    make an episode longer. It is a measurement, not a target - it should always be
    set from a stopwatch, never chosen.
  NARRATOR_SPEED 0.98 -> 0.86. 190 wpm is adult news-anchor pace and much too fast
    for a six-year-old. This is the change that actually alters the audio.
  Body budget 540-600 -> 680-750 words, sized from the measured rate.
Re-measure after the next run. Both numbers will move.

Defensive fix: the page now reads duration from the audio file itself on
loadedmetadata and only falls back to the stored value. A bad WORDS_PER_MINUTE can
no longer put a false number in front of a listener.

### DESIGN OVERHAUL
The old page hit four of the five documented AI-design tells: cream background near
#F4F1EA, tracked-out all-caps eyebrows, meta strings joined with middle dots, a
monospace face for data labels, and a hairline-rule broadsheet layout. Rebuilt.

  Structure: Apple system palette - systemGroupedBackground, grouped card fills,
    label/secondaryLabel hierarchy, 16px radii, full dark mode.
  Type: SF system stack throughout, weight and size carrying hierarchy. ONE serif,
    used once, for the wordmark, so the page and the cover art read as one thing.
  Brand: the ochre and red survive as the masthead and the tint. Apple's system is
    the structure, not a replacement for the identity.

  Hierarchy fixed: the page has one job, which is to play today's episode. Latest
    episode is a full card with a 56px play control; earlier episodes collapse into
    compact 64px rows. Previously every episode was an identical block.

  Removed from listener view: WRITTEN ONLY config, confidence grades, review flags,
    and the SVG art. The art was a 640x640 mostly-empty yellow panel saying "scale
    unavailable" and it dominated every card. It still ships to the RSS feed where
    an episode image is actually used. Sources, transcript and review notes now sit
    behind one "Sources and notes" disclosure.

  Mobile: viewport-fit=cover, safe-area insets, 56px and 64px touch targets, custom
    player with a draggable scrub bar, no horizontal overflow, tabular numerals on
    the timer so it does not jitter.

Verified in a headless DOM: card renders, play toggles, details collapsed by
default, no all-caps eyebrows, review flags reachable but hidden.

55 assertions, 0 failures.

## 2026-08-30 - cover art becomes the show's single image

The cover now appears in three places and the per-episode SVG is gone.

PAGE: the artwork IS the masthead, centred, 300px or 68vw, rounded with a lift
shadow. The text wordmark is now a FALLBACK only, revealed by an onerror handler
if the image 404s - showing both would say the same thing twice, since the poster
already carries "ST Luker presents / The Rails Beneath Us". A visually-hidden h1
keeps the title available to screen readers and search engines. The cover also
appears as a 52px rounded thumbnail on each earlier-episode row, the way a podcast
app shows it.

FEED: every <item> now carries <itunes:image> pointing at the show cover, matching
the channel image. Previously items pointed at /art/<date>.jpg, which never existed
- Apple would have failed to load an image on every single episode.

REMOVED: src/art.js and the whole per-episode SVG path, including its R2 write, its
route and its run_worker_first entry. That image was a 640x640 mostly-empty yellow
panel reading "scale unavailable", it was never displayed anywhere after the
redesign, and generating a second weaker image that nothing showed was pure cost
and one more thing to fail. Deleting it is the right call, not a regression.

DEPENDENCY: this only works if cover/show.jpg is actually in R2. Verify with
  curl.exe -sI https://rails.stluker.com/cover/show.jpg
Expect 200 and content-type image/jpeg. The page degrades to the text wordmark if
it is missing, but Apple will reject a feed whose artwork 404s.

Housekeeping seen in the folder listing: rails-beneath-us.zip is sitting INSIDE the
project directory, so the archive is being extracted into itself. Move it out
before the next extract or you will nest copies.

54 assertions, 0 failures.

## 2026-08-30 - the cover is NOT in R2. Two blockers found.

The page rendered the serif fallback wordmark, which only appears when the
onerror handler fires. That is proof /cover/show.jpg returns 404. The artwork was
never uploaded to the bucket; a local ./cover folder is not R2.

BLOCKER 1 - file missing from R2.
BLOCKER 2 - the artwork is too small for Apple. The PNG renders at 1254x1254.
Apple requires a MINIMUM of 1400x1400, maximum 3000x3000, square, RGB, JPG or PNG,
under 512KB. At 1254 it is rejected outright with "Artwork must be between
1400 x 1400 and 3000 x 3000 pixels". Re-export at 3000x3000 before uploading -
that is the industry standard and satisfies every platform at once.

Apple also requires the host to answer HTTP HEAD requests; it probes the artwork
with HEAD before it ever GETs the bytes. The Worker previously had no HEAD branch,
so a HEAD would have fallen through and streamed a body or missed entirely. Added
an explicit HEAD path served from R2 metadata - correct content-length and etag,
no body, no wasted egress.

DIAGNOSABILITY - the real lesson
The page degraded so gracefully that the failure was invisible: it looked like a
design choice rather than a missing file. Graceful degradation is right for a
listener and wrong for the operator. /status now reports the cover: present,
size in KB, content type, and a named problem string when something is off.
Dimensions cannot be read from R2 metadata, so /status carries the requirement as
a reminder rather than pretending to check it.

General rule for the master doc: every asset the feed depends on needs a presence
check in /status. A silent fallback hides exactly the failures that block launch.

56 assertions, 0 failures.

## 2026-08-30 - cover renders but is cropped. Root cause: aspect-ratio not honored.

Screenshot showed the cover loading (not the onerror fallback) but cropped into a
tall narrow box, cutting "ST Luker presents" and "Beneath Us" off both edges. The
CSS was `.cover{width:min(300px,68vw);aspect-ratio:1/1;...object-fit:cover}` -
correct on paper, but `aspect-ratio` silently no-ops in some renderers (older
WebKit, some in-app/webview browsers, some screenshot and preview tools). When it
does not apply, width stays constrained but height is unconstrained, the box goes
tall, and object-fit:cover crops a square 3000x3000 image to fit - centered crop,
both side edges lost. That is exactly the screenshot.

FIX: replaced the CSS aspect-ratio property with the classic padding-top
intrinsic-ratio box (`.coverBox::before{padding-top:100%}`), which every CSS
renderer has supported since percentage padding existed. The image is absolutely
positioned to fill the reserved square. This cannot silently fail the way
aspect-ratio can - there is no feature to fail to support.

Verified the fix does not depend on a CSS layout engine at all: jsdom implements
zero CSS layout, so confirming the padding-top rule and absolute positioning are
present in the stylesheet (rather than trusting a rendered pixel measurement) is
renderer-agnostic proof, not a browser-specific pass. Locked in with a self test
that fails if the code ever reverts to bare aspect-ratio.

MOBILE PROPORTION, fixed at the same time: the poster was min(300px,68vw), which
on a real screenshot rendered roughly 710px tall - most of a phone's first
screen, pushing "Follow the show" and the actual episode below the fold on a page
whose one job is to play today's episode. Reduced to min(220px,52vw) and tightened
header padding. The cover is still the clear hero, now sized so the episode card
is visible without scrolling on a typical phone viewport.

58 assertions, 0 failures.

## 2026-08-30 - review flags removed from listener view; volume drop diagnosed and fixed

### FLAGS ARCHITECTURE FIX
"Needs review: quotation marks in narrative..." was visible on the public page.
Root cause was structural, not a rendering choice: pipeline wrote ONE episode
object containing both content (title, summary, sources) and QA output (flags),
and that single object was both the admin record and the public manifest served
by /api/episodes. Anything added for operator visibility was automatically public.

Fixed by splitting into two manifests, written on every run:
  episodes.json          public, flags stripped, served by /api/episodes, read by the page
  episodes-admin.json    full record including flags, served by new authed /admin/episodes
Per-date full record (episodes/<date>.json) is unchanged and still carries flags -
that stays the operator's detailed source of truth.
Removed the flags-rendering line from index.html entirely rather than relying on
the data simply being absent - the front end should not carry dead code that
becomes a trap the next time someone wires up the API differently.

### VOLUME DROP - DIAGNOSED, NOT JUST PATCHED
Root cause: voice_settings.stability was 0.55, in ElevenLabs' EXPRESSIVE range,
which deliberately varies delivery - pace, emphasis, loudness - based on the
emotional register of the text. The air brake section is written in a reflective,
direct-address style on purpose ("Sit with that for a moment", "Sounds backward,
doesn't it?"). That is precisely the kind of text an expressive model reads as a
cue to go quiet and slow. This was the model doing what a low-stability setting
asked it to do, on text written to invite it - not a pipeline bug, not a block-
boundary artifact (the episode is one TTS call, well under the 4000 char split).

Considered and rejected: post-hoc loudness normalization. Not possible in this
architecture - a Cloudflare Worker has no ffmpeg and no budget for a WASM MP3
decode/normalize pass on a five-minute daily show. The fix has to be upstream.

Fix, two parts:
  1. VOICE_SETTINGS now pinned: stability 0.82 (was 0.55), style 0 (was unset -
     style exaggeration is the main lever for mid-take drift), use_speaker_boost
     true (normalizes ElevenLabs' own output level at the source). Extracted to a
     single exported constant so every synthesis call uses identical settings -
     previously nothing enforced that.
  2. Persona gained a DELIVERY DISCIPLINE block forbidding stage-direction phrasing
     ("sit with that for a moment", "let that sink in") and capping rhetorical
     questions at one per episode. The settings fix the symptom; this addresses
     the prose that was inviting it in the first place.

Trade-off stated plainly: this trades some expressiveness for a show that sounds
the same in the first paragraph as the last, every episode. Correct trade for a
daily show a six-year-old hears three times a week - consistency matters more
than any single dramatic flourish.

Both fixes locked in with self tests: settings cannot drift back down, flags
cannot leak back into the public manifest, /admin/episodes cannot go unauthed.

63 assertions, 0 failures.

### STILL TO VERIFY (cannot be done from here)
Re-run an episode with force=1, listen end to end, confirm the drop is gone.
Settings changes cannot be validated without hearing real audio.

## 2026-08-31 - TROUBLESHOOTING: site stopped updating. Root cause found.

### What was checked
Pulled the LIVE deployed Worker script via the Cloudflare API and diffed it
against source. The deployed code is fully current - it already contains every
fix through the flags-redaction and VOICE_SETTINGS change. wrangler deploy has
been run successfully and recently. THE SCRIPT IS NOT THE PROBLEM.

### Root cause
Two conversations ago, verification was made a hard gate: selectForDate throws
"no VERIFIED items available" when the pool contains zero VERIFIED events or
feats. The last known state of data/items.json (this session's sandbox copy) has
224 items, ALL still UNVERIFIED. The Phase 1 worksheet was built and a promote.mjs
intake script was written, but nothing in this conversation shows it was ever
run to merge VERIFIED rows back into the pool.

Consequence: every /refresh call since that gate went in - manual or via the
Mon/Wed/Fri cron - has been failing with that error. Nothing surfaces this on the
page or in the feed; the site simply stops receiving new episodes, which is
indistinguishable from "the website isn't updating" to anyone not reading the
raw JSON error from /refresh.

### Instrumentation gap found and fixed
/status reported poolItems (total count) but never the VERIFIED count, so this
exact failure mode was invisible even to a direct status check - you would have
seen "poolItems: 224" and reasonably assumed everything was fine. Added:
  verifiedEvents, verifiedFeats   - counted separately, not inferred from total
  canPublish                       - boolean, true only if both are > 0
  publishBlockedReason             - names which one is empty and points at the fix
This is the same lesson as the empty-episode incident (ok:true is not evidence) -
a count without a breakdown by the field that gates behavior is not diagnostic.

### How to confirm this is the cause, and the fix
  curl.exe -s -H "Authorization: Bearer $S" https://rails.stluker.com/status
Expect canPublish: false, verifiedEvents: 0, verifiedFeats: 0 BEFORE this deploy.
After deploying this change and reading /status again, the field will say exactly
why nothing is publishing. The actual fix is not code - it is completing Phase 1
verification (PHASE1_lookup_worksheet.xlsx) and running:
  node scripts/promote.mjs PHASE1_lookup_worksheet.xlsx
against rows marked VERIFIED, which merges them into data/items.json, then
  npm run migrate
to push the updated pool to R2. Only then will /refresh succeed again.

### On the local-files request
Could not inspect C:\\Users\\pdluk\\rails-beneath-us directly - that is the user's
machine, not this sandbox. Confirmed instead via the deployed Worker's live code,
which is authoritative for "did the deploy happen" regardless of local state.
Recommend the user confirm locally with:
  cd C:\\Users\\pdluk\\rails-beneath-us
  git status  (or) dir data\\items.json
  findstr /c:"VERIFIED" data\\items.json | find /c "VERIFIED"
to see whether their local pool has any verified rows the deploy simply hasn't
picked up (missing npm run migrate) versus never having been verified at all.

64 assertions, 0 failures.

## 2026-08-31 - stopgap unblock: 3 items VERIFIED, canPublish flips to true

User confirmed locally: 0 of 224 VERIFIED, matching the sandbox exactly. Rather
than send the user into a multi-hour Phase 1 session before the site can post
anything, checked whether any research ALREADY DONE in this conversation with
real web_search calls (not recalled from memory) could legitimately clear the
gate right now.

Two qualified:
  RE0036  Rudolf Diesel's birth - grounded 2026-08-30 (Britannica, Encyclopedia.com,
          Wikipedia all agree: 18 March 1858, Paris). Single fact, no pairing risk.
  FE0037  Westinghouse automatic air brake - THE item that originally aired wrong.
          Grounded 2026-08-30: USPTO 124,405 (1872) vs the 1869 straight-air brake,
          US 88,929. pairingChecked:true here specifically means "confirmed the
          fail-safe description belongs to 1872, not 1869" - the actual check that
          would have prevented the original error.
Both previously carried a single citation STRING in the sources field, which
fails the two-source array requirement. Rewritten as proper two-entry arrays.

One new item added from the Phase 1 worksheet targets, same standard:
  PT0001  Janney's knuckle coupler, US 138,405, granted 29 Apr 1873. Explicitly
          states this is the SECOND of Janney's two patents (an earlier one exists
          from 1868) - this exact ambiguity is the worked example in the
          worksheet's own HOW_TO sheet, so resolving it here is the pairing check
          done properly rather than skipped.

Validated with the ACTUAL schema code, not a re-implementation of its rules:
  node --input-type=module -e "import * as m from './src/pool-schema.js'; ..."
validatePool PASSED, 225 items. verifiedEvents: 2, verifiedFeats: 1, canPublish: true.

THIS IS A STOPGAP, STATED PLAINLY: 2 verified events and 1 verified feat is enough
to flip canPublish true and let /refresh succeed, but with only one feat, every
episode will pair a different event with the SAME Westinghouse feat until more
feats are verified. Real Phase 1 completion (the worksheet, ~5-6 hours) is still
the actual task - this only proves the pipeline end to end and gets the show
posting again today.

64 assertions, 0 failures.

## 2026-09-24 - live review. 11 missed runs, 2 live episodes carrying known errors.

LIVE FEED (fetched 2026-09-24): still only the two 2026-08-30 episodes. With
M/W/F cadence that is 11 scheduled runs since the last publish, all failing at
the verification gate. The stopgap (3 verified items) has NOT yet been migrated
and run - the feed proves it.

DEFECTS STILL LIVE IN THE FEED
1. The Minnesota episode (2026-08-30) aired the Westinghouse 1869/1872
   conflation, and its title "The first railroad in Minnesota" is an unsoftened
   mode-A claim. It predates every accuracy control. Still published.
2. Both live episodes report durations of 5:12 and 5:07. Real audio is 3:25 and
   3:15. They were generated under WORDS_PER_MINUTE 125. Apple validates this.
3. Channel description said "every weekday" - stale since the M/W/F change, and
   contradicting the page's "three mornings a week". FIXED in rss.js, test added.

Both old episodes should be regenerated or withdrawn. Regenerating with force=1
now picks only VERIFIED items, so the Minnesota slot becomes a different, clean
episode, and duration/flags are corrected in the same pass.

SANDBOX NOTE: the working copy was reset between sessions and restored from the
last packaged zip. Suite passed 64/64 on restore before any change - confirms the
zip was a faithful snapshot. Now 65/65.

LOCAL ACCESS: this chat surface (claude.ai web) has no access to the user's local
filesystem, and cannot be granted it. The right surface is the Code tab of the
Claude desktop app, which reads and edits the local folder directly and can run
npm run check, wrangler and curl.exe itself - collapsing the copy/paste loop that
caused most delays in this project.

## 2026-10-05 - CORRECTION: the outage is the cron, not the verification gate

The 2026-09-24 entry above says the missed runs were "all failing at the
verification gate". That is WRONG, and was written without access to logs.

EVIDENCE (Claude Code, desktop, with local wrangler + a Workers Logs export)
- Workers Logs 2026-09-18 -> 2026-09-25: 618 invocations, ALL eventType=fetch.
  ZERO scheduled invocations, across the Mon 9/21 and Wed 9/23 11:00 UTC slots.
  The code was never started on schedule, so no gate could have failed.
- The R2 pool already carried the stopgap (3 VERIFIED: RE0036, FE0037, PT0001),
  validatePool passes, and selectForDate run locally against the LIVE R2 pool
  picks cleanly for every date tried. Selection is not the blocker.
- 2026-09-28 14:21 UTC: a `wrangler deploy` went out. Since then the Wed 9/30,
  Fri 10/2 and Mon 10/5 slots have also produced nothing: no audio/, transcript/,
  episodes/<date>.json or locks/<date> key in R2 for any of them. Either the
  trigger is still not registered, or it fires and fails before the audio write.
  Those two cannot be told apart from R2 - which is the defect fixed below.

GOTCHA 22 (new): scheduled() was a black box
scheduled() wrote nothing on success, failure, or skip, and its exceptions went
only to Workers Logs (7-day retention, dashboard-only). "Cron never fired" and
"cron fired and threw" looked identical from every surface this project checks.
Same class as Gotcha 20: absence of an error is not evidence of a run.

FIX
- recordRun(): every invocation writes to runs/log.json (newest first, cap 40):
  cron runs, off-day skips, /refresh runs, with ok/error/words/bytes/title.
  Guarded so the log can never break a run. scheduled() still rethrows so the
  failure also shows in Workers Logs.
- scheduled() uses evt.scheduledTime, not wall clock, for the episode date.
- /status now reports lastPublished, lastCronRun, cronSilentHours, recentRuns,
  and cronProblem, which names the fault and the fix:
    no cron entry / >80h silent -> trigger not firing: npx wrangler triggers deploy
    last cron ok:false          -> the error text, read it
- Exercised against a fake bucket: off-day skip recorded, a failing publish-day
  run recorded with its error and rethrown, /status reports cronProblem.
70 assertions, 0 failures. `wrangler deploy --dry-run` builds clean.

NOT YET DONE - requires your machine/secrets
- deploy this, check Settings -> Triggers shows 0 11 * * 1,3,5
- one /refresh to prove Claude -> ElevenLabs -> R2 end to end (not run since 8/30;
  a secret was rotated 9/10)
- regenerate or withdraw the two 8/30 episodes (known errors, see 9/24 entry)

## 2026-10-05 - deployed; first episode since 8/30; feed made subscribable

- Deployed with run log + /status cron health (version a68d9e3d). Wrangler
  confirmed `schedule: 0 11 * * 1,3,5` registered.
- /refresh published 2026-10-05 "Rudolf Diesel is born": 756 words, 4:06,
  5.3 MB. Pipeline proven end to end after the 9/10 secret change.
- /feed.xml 404'd - it was the URL handed to Overcast. Now serves the same feed
  as /rss.xml (no redirect; some apps do not follow one on subscribe), and is in
  run_worker_first.
- GOTCHA 23: accept-ranges: bytes was advertised but Range was ignored - every
  audio request got a full 200. Apple requires 206. Now passes the Range header
  to R2 and returns 206 + content-range. First deploy printed `bytes NaN-NaN`:
  R2's range object carries a `suffix` KEY set to undefined, so `'suffix' in r`
  was true. Use `r.suffix != null`. Verified live: 0-99, open-ended, suffix.
73 assertions, 0 failures. Live version 7552d782.

## 2026-10-06 - TTS model: eleven_multilingual_v2 -> eleven_flash_v2_5

- All podcasts share one ElevenLabs Creator plan (100k credits/month + rollover).
  Multilingual v2 costs 1 credit/char; Flash v2.5 costs 0.5. This show was the
  only one on Multilingual v2 alone, so the switch halves its usage.
- Flash v2.5 supports the same <break> tags, voice_settings and speed. Voice
  timbre can differ slightly between models: listen to the Wed 10/7 episode.
  To revert, change model_id back in src/tts.js and deploy.
- selftest 73/73. Deployed as version 7137ac00. No other code changes.
