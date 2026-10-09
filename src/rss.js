export function buildRss(episodes, origin, coverUrl) {
  const esc = t => String(t || '').replace(/[<>&'"]/g, c =>
    ({ '<':'&lt;','>':'&gt;','&':'&amp;',"'":'&apos;','"':'&quot;' }[c]));
  const items = episodes.slice().reverse().map(e => `
  <item>
   <title>${esc(e.title)}</title>
   <description>${esc(e.summary)}</description>
   <pubDate>${new Date(e.publishedAt).toUTCString()}</pubDate>
   <guid isPermaLink="false">${esc(e.date)}</guid>
   <enclosure url="${origin}/audio/${e.date}.mp3" length="${e.bytes}" type="audio/mpeg"/>
   <itunes:duration>${e.duration}</itunes:duration>
   <itunes:image href="${coverUrl}"/>
   <itunes:explicit>false</itunes:explicit>
  </item>`).join('');
  return `<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:itunes="http://www.itunes.com/dtds/podcast-1.0.dtd">
 <channel>
  <title>The Rails Beneath Us</title>
  <link>${origin}</link>
  <language>en-us</language>
  <description>Five minutes of railway history and engineering, every Wednesday morning.</description>
  <itunes:author>ST Luker</itunes:author>
  <itunes:image href="${coverUrl}"/>
  <itunes:category text="History"/>
  <itunes:category text="Kids &amp; Family"/>
  <itunes:explicit>false</itunes:explicit>${items}
 </channel>
</rss>`;
}
