/** Returns true if any scheduled time is within ±90 minutes of now. */
export function isMedicationDueSoon(schedule: string[]): boolean {
  const now = new Date();
  const nowMins = now.getHours() * 60 + now.getMinutes();

  return schedule.some((entry) => {
    const mins = parseScheduleTime(entry);
    if (mins == null) return false;
    const diff = Math.abs(nowMins - mins);
    return diff <= 90;
  });
}

function parseScheduleTime(value: string): number | null {
  const match = value.trim().match(/^(\d{1,2}):(\d{2})\s*(AM|PM)?$/i);
  if (!match) return null;

  let hours = parseInt(match[1], 10);
  const minutes = parseInt(match[2], 10);
  const meridiem = match[3]?.toUpperCase();

  if (meridiem === 'PM' && hours < 12) hours += 12;
  if (meridiem === 'AM' && hours === 12) hours = 0;

  return hours * 60 + minutes;
}
