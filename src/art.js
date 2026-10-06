// Deterministic data-driven SVG. Not a raster generation call. Always try/catch at call site.
const C = { sky:'#F5B92E', ink:'#123049', red:'#A6231F', green:'#2E5E3A', cream:'#F4EBD3' };

export function buildArt(event, feat, dateStr) {
  const s = feat.scaleAnchor;
  const barW = s && s.comparisonValue
    ? Math.min(360, 360 * (s.value / Math.max(s.value, s.comparisonValue)))
    : 300;
  const cmpW = s && s.comparisonValue
    ? Math.min(360, 360 * (s.comparisonValue / Math.max(s.value, s.comparisonValue)))
    : 0;
  const esc = t => String(t || '').replace(/[<>&]/g, c => ({'<':'&lt;','>':'&gt;','&':'&amp;'}[c])).slice(0, 46);
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 640 640" width="640" height="640">
<rect width="640" height="640" fill="${C.sky}"/>
<rect x="0" y="560" width="640" height="80" fill="${C.green}"/>
<text x="40" y="70" font-family="Georgia,serif" font-size="20" fill="${C.red}">THE RAILS BENEATH US</text>
<text x="40" y="104" font-family="Georgia,serif" font-size="15" fill="${C.ink}">${esc(dateStr)}</text>
<text x="40" y="180" font-family="Georgia,serif" font-size="30" fill="${C.ink}">${esc(event.title)}</text>
<text x="40" y="214" font-family="Georgia,serif" font-size="17" fill="${C.red}">${esc(event.anniversary)} ${esc(event.year)}</text>
<text x="40" y="300" font-family="Georgia,serif" font-size="22" fill="${C.ink}">${esc(feat.title)}</text>
<rect x="40" y="330" width="${barW}" height="26" fill="${C.red}"/>
${cmpW ? `<rect x="40" y="366" width="${cmpW}" height="26" fill="${C.ink}" opacity="0.55"/>` : ''}
<text x="40" y="420" font-family="Georgia,serif" font-size="15" fill="${C.ink}">${s ? esc(s.value + ' ' + s.unit) : 'scale unavailable'}</text>
<g fill="none" stroke="${C.ink}" stroke-width="3">
<line x1="40" y1="470" x2="600" y2="470"/><line x1="40" y1="482" x2="600" y2="482"/></g>
</svg>`;
}
