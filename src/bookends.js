// Deterministic open and close. NOT model-written - that is the whole point.
// A ritual the listener can say along with is only a ritual if it is identical
// every time. Generating it costs tokens and guarantees drift.

const MONTHS = ['January','February','March','April','May','June','July','August',
                'September','October','November','December'];
const ORD = ['','first','second','third','fourth','fifth','sixth','seventh','eighth','ninth','tenth',
 'eleventh','twelfth','thirteenth','fourteenth','fifteenth','sixteenth','seventeenth','eighteenth',
 'nineteenth','twentieth','twenty first','twenty second','twenty third','twenty fourth','twenty fifth',
 'twenty sixth','twenty seventh','twenty eighth','twenty ninth','thirtieth','thirty first'];

const SEASON = { 12:'winter',1:'winter',2:'winter',3:'spring',4:'spring',5:'spring',
                 6:'summer',7:'summer',8:'summer',9:'autumn',10:'autumn',11:'autumn' };

// The script may never state more precision than the data supports.
// The pool carries a precision level; this renders the ONLY phrasing allowed.
export function spokenWhen(item) {
  const m = item.month, d = item.day, y = item.year;
  switch (item.precision) {
    case 'DAY':    return `on ${MONTHS[m-1]} ${ORD[d]}, ${y}`;
    case 'MONTH':  return `in ${MONTHS[m-1]} of ${y}`;
    case 'SEASON': return `in the ${SEASON[m]} of ${y}`;
    case 'YEAR':   return `in ${y}`;
    case 'CIRCA':  return `around ${y}`;
    default:       return `in ${y}`;   // unknown precision degrades to the safest form
  }
}

export function spokenDate(dateStr) {
  const [y, m, d] = dateStr.split('-').map(Number);
  return `${MONTHS[m - 1]} ${ORD[d]}`;
}

// Fixed words. The only variable is the date.
export function coldOpen(dateStr) {
  return `Two long, one short, one long. That is a train telling the world it is coming. ` +
         `This is The Rails Beneath Us. Today is ${spokenDate(dateStr)}.`;
}

// Fixed words. No variables at all - identical in every episode, forever.
// "tomorrow" would be a lie on a Monday when the next episode is Wednesday.
// Kept cadence-agnostic so a schedule change never makes the bookend wrong.
export const SIGN_OFF =
  `Wherever you are right now, somebody once had to build the way to get there. ` +
  `That is the rails beneath us. I will see you next time.`;

export function assemble(coldOpenText, body, signOffText) {
  return [coldOpenText, body.trim(), signOffText].join('\n\n');
}
