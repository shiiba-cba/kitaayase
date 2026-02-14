// src/utils/holiday.ts

let holidayData: Record<string, string> | null = null;

// public ディレクトリの JSON を fetch で取得
async function loadHolidayData() {
  const url = "/kitaayase/data/holidays.json";
  const res = await fetch(url);
  if (!res.ok) throw new Error(`holidays.json fetch failed: ${res.status}`);
  holidayData = await res.json();
}

/** YYYY-MM-DD 形式の日付が休日なら true を返す */
export async function isHoliday(dateStr: string): Promise<boolean> {
  if (!holidayData) {
    try {
      await loadHolidayData();
    } catch {
      return false;
    }
  }
  return Boolean(holidayData?.[dateStr]);
}
