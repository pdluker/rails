# Verification protocol - The Rails Beneath Us

Written 2026-08-30, after a factual error reached air.

## Where the corpus actually stands

All 224 items are now marked UNVERIFIED and the show cannot select them. That is
not pessimism, it is accuracy. Nothing in the hopper has ever been checked against
a second independent source.

What "Confirmed in DCNRHS Almanac" meant: one compilation contains this date.
What verification means: two independent sources agree, and the date, the actor
and the claim all come from the same event.

## Error rate: what the evidence actually supports

Four errors found so far, and it matters HOW each was found:

| Error | How found |
|---|---|
| Granite Railway, 6 Oct vs 7 Oct 1826 | duplicate collision |
| Phineas Davis, 25 Sep vs 27 Sep 1835 | duplicate collision |
| Rudolf Diesel, 15 Jun vs 18 Mar 1858 | duplicate collision |
| Westinghouse fail-safe dated 1869, actually 1872 | writing an episode |

None was found by a verification pass, because none has been run.

The only unbiased sample available: the 42-item expansion overlapped roughly six
audited entries. Two of those six disagreed on the date. That is 2 in 6.

Treat that number with real caution - n=6 is far too small to pin a rate, and the
plausible range around it is very wide. But even the optimistic end of that range
sits above 5 percent, and the pessimistic end is far worse. The honest summary is:
the corpus is somewhere between roughly 90 and 97 percent accurate on dates, we
cannot currently tell where, and the one item that ever faced production scrutiny
failed.

## Why 95 percent is the wrong target

1. **It is unmeasurable.** You cannot certify 95 percent without checking every
   entry - and once you have checked every entry you are near 99, not 95. A 95
   percent claim is either unverified or redundant.
2. **It permits an error a month.** Five percent at weekday cadence is about
   twelve errors a year. For a show whose pitch to enthusiasts is that it gets
   things right, monthly is very visible.
3. **It treats all errors as equal.** They are not. A day-of-month slip on an
   obscure line opening is nearly invisible. The Westinghouse conflation is the
   kind of thing a signalling engineer notices in the first minute and never
   forgets.

Replace the percentage target with a gate: **nothing airs until it is verified.**
Then accuracy is bounded by the protocol rather than estimated by hope.

## What the corpus is made of, by risk

Of 224 items, 126 carry at least one risk class:

- **82 "first" claims** - 44 percent of all events. This is by far the biggest
  exposure. Every "first railroad in X" hides a definitional argument: first
  chartered, first built, first steam-worked, first common carrier, first to
  carry paying passengers. Sources routinely disagree because they are silently
  answering different questions.
- **28 superlatives** - and these EXPIRE. Longest, highest, fastest change.
- **18 casualty figures** - contemporary reporting is unreliable and later
  scholarship often revises the toll.
- **13 attribution claims** - who invented or patented what. This is the class
  that produced the Westinghouse error.
- **9 name-drift risks** - Stourbridge Lion, Tom Thumb, John Bull. Popular names
  are frequently retroactive.

## Cost, honestly

Two independent sources per item, plus a pairing check.

| Class | Items | Minutes each | Hours |
|---|---|---|---|
| "first" claims | 82 | 20-25 | 27-34 |
| Superlatives | 28 | 12 | 6 |
| Casualty figures | 18 | 15 | 4.5 |
| Attribution | 13 | 15 | 3 |
| Low-risk remainder | 95 | 6-8 | 10-13 |
| **Total** | **224** | | **50-60 hours** |

That is the real price of a fully verified hopper. Roughly a week and a half of
full-time work, or three months of evenings.

## The plan that does not require 50 hours up front

Do not verify 224 before launching. Verify what airs, and let the gate hold the line.

**Phase 1 - launch buffer, about 3 hours.**
Verify 24 items: 18 events and 6 feats. At three episodes a week that is six weeks
of runway. Pick deliberately low-risk ones first - dated events with no "first",
no superlative and no casualty figure. There are 95 such items and they verify in
6 to 8 minutes each.

**Phase 2 - maintenance, about 90 minutes a week.**
Verify five items a week against a burn of three. That is a NET GAIN of two
episodes of buffer every week, so the hopper deepens on its own. This is the
single biggest argument for the M/W/F cadence: at five a week the same 90 minutes
only holds you level, and one missed week puts you behind.

**Phase 3 - work down the risk classes.**
Once the buffer is stable, spend maintenance time on the 82 "first" claims. Many
will resolve into "first X in Y, by the definition that Z uses", which is a better
script line than the bare claim anyway. Some will be unresolvable - mark them
DISPUTED and let them stay off air. A corpus of 140 verified entries is worth more
than 224 uncertain ones.

## The five checks, per item

1. **Two independent sources.** Not two websites quoting the same compilation.
   An error copied across twenty aggregator pages reads exactly like corroboration.
2. **Which event is this date?** Charter, groundbreaking, rails joined, ceremonial
   opening, first freight, first scheduled passenger service. Name it in the facts
   field. Most date disagreements are this and nothing more.
3. **Pairing check.** Did the date, the person and the claim all come from the SAME
   event? This is the Westinghouse check. Each half was true; the join was not.
4. **Qualify the superlative.** "Longest in the world" becomes "longest in the
   world at the time" or "longest until 1834". Add a re-check date.
5. **Name at the time versus name now.** Say which you are using.

## Runway at three episodes a week

184 events is 61 weeks of unrepeated material - fourteen months. The 71 low-risk
events alone give 24 weeks. Events are the binding constraint; a feat can recur
sooner than an anniversary without anyone noticing.

## Sources that count as independent

- The DCNRHS Almanac (already the first source on most entries)
- Railway and Locomotive Historical Society Bulletins
- University press railway histories
- Patent records - USPTO for numbers and dates, which are unambiguous
- National archives and state historical societies
- Contemporary newspapers, with the caveat that they report the ceremony
- Operator and infrastructure-owner engineering records for feats

Does NOT count as a second source: another aggregator, a listicle, an AI answer,
or a site that cites the same compilation you started from.

## On using a model to help

A model can draft the search, surface candidate sources and flag disagreement.
It must not be the thing that decides. The specific danger is that models and
search engines both reward consensus, and the failure mode in rail history is
precisely a wrong date repeated everywhere. Use it to find the disagreement, then
read the sources yourself.

Verification is the one step in this pipeline that cannot be automated, because
its entire value is that a human took responsibility for the claim.
