# Deploy - run these on your machine, in order

Everything below needs wrangler and your own credentials. Nothing here was run for you.

## 0. Get the files onto your machine (GOTCHA 18)
Download the bundle, extract, then `dir` the folder and confirm `src/index.js` exists
before you run anything. "entry-point file at index.js was not found" is what skipping
this looks like.

    cd rails-beneath-us
    npm install

## 1. Self test first, offline, before touching wrangler
    npm run check
Expect: 27 passed, 0 failed.

## 2. Confirm exactly one R2 binding (GOTCHA 4)
The bucket already exists - do NOT run `wrangler r2 bucket create`.
    type wrangler.jsonc          # PowerShell; `cat` on macOS/Linux
Confirm exactly one entry in `r2_buckets`.

## 3. Secrets
    wrangler secret put ANTHROPIC_API_KEY
    wrangler secret put ELEVENLABS_API_KEY
    wrangler secret put NARRATOR_VOICE_ID
    wrangler secret put REFRESH_SECRET
NARRATOR_VOICE_ID must be the voice ID string, never a display name.
Pick a warm, unhurried voice and audition it on a paragraph with a hard proper
noun in it - Desjardins or Jungfraujoch - before committing.

## 4. Upload the pool (GOTCHA 15 - --remote is mandatory)
    npm run migrate

## 5. Deploy
    wrangler deploy

## 6. Confirm secrets landed BEFORE spending a paid generation call
Wrangler's deploy summary does not list secrets; absence there is not evidence.
    curl.exe -H "Authorization: Bearer YOUR_SECRET" https://YOUR_HOST/status
Check `poolItems` is 224, `leak` is empty, and all four secrets read true.

## 7. Real run, twice, at two different dates
    curl.exe -X POST -H "Authorization: Bearer YOUR_SECRET" "https://YOUR_HOST/refresh?asOf=2026-09-01"
    curl.exe -X POST -H "Authorization: Bearer YOUR_SECRET" "https://YOUR_HOST/refresh?asOf=2026-05-10"
Use `curl.exe`, not bare `curl`, from PowerShell (GOTCHA 2).
`ok: true` is not evidence a human can hear it - open the audio, the page, the
transcript, and the feed. Read the `flags` array on both episodes.

## 8. Time it, then recalibrate
Play the real episode with a stopwatch. If actual differs from the reported
duration by more than a few seconds, change `WORDS_PER_MINUTE` in wrangler.jsonc
and redeploy. A 20 percent gap on first run is normal, not an edge case.

## 9. Cover art
    wrangler r2 object put rails-beneath-us/cover/show.jpg --file=cover.jpg --content-type=image/jpeg --remote
Your poster, exported to 3000x3000 JPG. Apple will not accept the per-episode SVGs.

## 10. Confirm the cron attached - separately from confirming the deploy succeeded
Cloudflare dashboard, Worker, Triggers tab. A successful deploy and an attached
cron are two different outcomes.

## 11. Test the feed in Apple Podcasts specifically
Not just a browser audio tag. Apple validates the enclosure length attribute.

## 12. Gate the first 30 runs
Read every script before it publishes. You are checking two things the code cannot:
whether the tone lands for a six-year-old, and whether any GENTLE_REWRITE story
slipped through in wording that a regex passed but a parent would not.
