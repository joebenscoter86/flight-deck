// In-process refresh timer. The reel's promise is "you didn't even have to press
// refresh", so the server refreshes itself on the hour and skips quiet hours.

export function isQuietHour(hour, [start, end]) {
  if (start === end) return false;
  return start < end ? (hour >= start && hour < end) : (hour >= start || hour < end);
}

export function nextDelayMs(now, everyMinutes) {
  const ms = everyMinutes * 60 * 1000;
  const elapsed = now.getTime() % ms;
  return elapsed === 0 ? ms : ms - elapsed;
}

export function startScheduler({ everyMinutes, quietHours, run, log = console.log, timezone }) {
  let timer = null;
  const tick = async () => {
    const now = new Date();
    const hour = Number(new Intl.DateTimeFormat('en-US', { hour: 'numeric', hour12: false, timeZone: timezone }).format(now));
    if (!isQuietHour(hour % 24, quietHours)) {
      try { await run(); log(`[scheduler] refresh ran at ${now.toISOString()}`); }
      catch (e) { log(`[scheduler] refresh failed: ${e.message}`); }
    }
    timer = setTimeout(tick, nextDelayMs(new Date(), everyMinutes));
  };
  timer = setTimeout(tick, nextDelayMs(new Date(), everyMinutes));
  return { stop: () => clearTimeout(timer) };
}
