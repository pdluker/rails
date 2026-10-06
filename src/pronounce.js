// Ordered pattern -> replacement. Applied to EVERY string reaching TTS, including
// text assembled from nested pool fields. Display/page/transcript keep real spelling.
export const PRONUNCIATIONS = [
  [/Jungfraujoch/g, 'YOONG-frow-yokh'], [/Landwasser/g, 'LAND-vass-er'],
  [/Schenectady/g, 'ske-NEK-tuh-dee'], [/Desjardins/g, 'day-zhar-DAN'],
  [/Tehachapi/g, 'tuh-HATCH-uh-pee'], [/Mauch Chunk/g, 'mawk chunk'],
  [/Ypsilanti/g, 'ip-suh-LAN-tee'], [/Semmering/g, 'ZEM-er-ing'],
  [/Promontory/g, 'PROM-un-tor-ee'], [/Ribblehead/g, 'RIB-ul-hed'],
  [/Tanggula/g, 'tahng-GOO-lah'], [/Gotthard/g, 'GOT-hard'],
  [/Rhaetian/g, 'REE-shun'], [/Qinghai/g, 'ching-HIGH'],
  [/Oresund/g, 'UR-uh-sund'], [/Seikan/g, 'SAY-kahn'],
  [/Nilgiri/g, 'NEEL-gih-ree'], [/Konkan/g, 'KON-kun'],
  [/Chenab/g, 'chuh-NAHB'], [/\bFlam\b/g, 'flawm'],
  [/\bB&O\b/g, 'B and O'], [/&/g, ' and '],
  [/4-4-0/g, 'four four oh'], [/4-6-0/g, 'four six oh'], [/0-6-0/g, 'oh six oh'],
  [/\bkm\b/g, 'kilometres'], [/\bm\b(?=[\s,.])/g, 'metres'], [/\bft\b/g, 'feet'],
];
export function forSpeech(s) {
  let out = s || '';
  for (const [re, rep] of PRONUNCIATIONS) out = out.replace(re, rep);
  return out;
}
