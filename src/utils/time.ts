export function toServiceDayMinutes(hour: number, minute: number) {
  const total = hour * 60 + minute;
  return (total - 240 + 1440) % 1440; // 4:00=0
}

export function parseTimeToServiceDayMinutes(time: string): number | null {
  const [h, m] = time.split(":").map(Number);
  if (Number.isNaN(h) || Number.isNaN(m)) return null;
  return toServiceDayMinutes(h, m);
}
