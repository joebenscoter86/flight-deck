const DAY = 24 * 60 * 60 * 1000;

// How long an item has been waiting on the user. original_date is set when a task is
// carried over; created_at is the first time a source produced it; list_date is the floor.
export function waitingDays(task, todayISO) {
  const first = task.original_date || (task.created_at || '').slice(0, 10) || task.list_date;
  const diff = Math.floor((Date.parse(todayISO) - Date.parse(first)) / DAY);
  return Number.isFinite(diff) && diff > 0 ? diff : 0;
}
