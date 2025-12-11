// src/utils/holiday.ts

let holidayData: Record<string, string> | null = null;

// public ディレクトリの JSON を fetch で取得
async function loadHolidayData() {
  const url = "/kitaayase/data/holidays.json";
  const res = await fetch(url);
  holidayData = await res.json();
}

/** YYYY-MM-DD 形式の日付が休日なら true を返す */
export async function isHoliday(dateStr: string): Promise<boolean> {
  if (!holidayData) {
    await loadHolidayData();
  }
  return Boolean(holidayData![dateStr]);
}
