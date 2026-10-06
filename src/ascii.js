// Gotcha 3: enforce in code, not just in the prompt.
const MAP = { '\u2014':' - ', '\u2013':'-', '\u2019':"'", '\u2018':"'", '\u201c':'"',
              '\u201d':'"', '\u2026':'...', '\u00a0':' ', '\u00b0':' degrees' };
export function toAscii(s) {
  if (typeof s !== 'string') return s;
  let out = s;
  for (const [k, v] of Object.entries(MAP)) out = out.split(k).join(v);
  out = out.normalize('NFKD');
  out = Array.from(out).filter(c => c.charCodeAt(0) < 128).join('');
  return out.replace(/[ \t]{2,}/g, ' ').replace(/ +\n/g, '\n');
}
export function isAscii(s) { return Array.from(s || '').every(c => c.charCodeAt(0) < 128); }
