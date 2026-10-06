// One-time migration into R2. After this the Worker owns the pool.
// GOTCHA 15: --remote is mandatory or this writes to the local simulator.
import { execSync } from 'node:child_process';
const B = 'rails-beneath-us';
const run = c => { console.log('> ' + c); execSync(c, { stdio: 'inherit' }); };
run(`wrangler r2 object put ${B}/pool/items.json --file=data/items.json --content-type=application/json --remote`);
run(`wrangler r2 object put ${B}/quarantine/items.json --file=data/quarantine.json --content-type=application/json --remote`);
console.log('\nPool uploaded. Quarantine is a SEPARATE key. selection.js never reads it.');
