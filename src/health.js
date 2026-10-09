// Turns the last refresh result into what the page shows in its banner. The reader
// is not technical: every message says what happened and what to do, in plain words.

const HELP = 'In the Claude app, open the Code tab, choose the flight-deck folder and say: "Flight Deck could not update."';

export function refreshHealth(result) {
  if (!result) return { level: 'ok', messages: [], at: null, offerManual: false };
  const messages = [];
  let level = 'ok';

  for (const err of result.errors || []) {
    level = 'error';
    // Errors written for the user pass through; raw ones get a plain message, with
    // the original kept as `detail` for whoever helps them.
    const raw = /^(Claude pull|GCX|Fathom): /.test(err);
    messages.push(raw
      ? { text: `Your list could not update on the last try. ${HELP}`, detail: err }
      : { text: err });
  }
  for (const m of result.pull?.missing || []) {
    if (level === 'ok') level = 'warn';
    messages.push({ text: `${m}. Until then your list leaves it out.` });
  }
  // When the background refresh failed, the page offers the manual route instead.
  return { level, messages, at: result.finished_at || result.started_at || null, offerManual: level === 'error' };
}
