import { getKhmerHolidays, toKhmerLunarDate } from "khmer-chhankitek-calendar";

// Khmer lunar dates and Cambodia's holiday list, computed in the browser
// (khmer-chhankitek-calendar has no dependencies and no network calls).

export type KhmerHoliday = { date: string; nameEn: string; nameKm: string };

// A holiday as the import dialog lists it: multi-day ones say which day.
export type KhmerHolidayListing = KhmerHoliday & { label: string };

export type KhmerDay = {
  // Short form for a calendar cell, e.g. "១២រោច" (12th of the waning moon).
  short: string;
  // Full sentence, e.g. "ថ្ងៃអង្គារ ១២រោច ខែចេត្រ ឆ្នាំមមី អដ្ឋស័ក ពុទ្ធសករាជ ២៥៦៩".
  full: string;
  month: string;
  // ថ្ងៃសីល — Buddhist observance day.
  isSil: boolean;
  holidays: KhmerHoliday[];
};

const dayCache = new Map<string, KhmerDay>();
const yearCache = new Map<number, Map<string, KhmerHoliday>>();

/**
 * The library lists several entries for one date (e.g. "Pchum Ben Festival"
 * and "Pchum Ben", or Labour Day and Visak Bochea on 1 May). Merge them into
 * one holiday per date, dropping a name that is just part of a longer one.
 */
function holidaysByDate(year: number): Map<string, KhmerHoliday> {
  const cached = yearCache.get(year);
  if (cached) return cached;

  const grouped = new Map<string, { nameEn: string; nameKm: string }[]>();
  for (const h of getKhmerHolidays(year)) {
    const date = h.date.slice(0, 10);
    grouped.set(date, [...(grouped.get(date) ?? []), { nameEn: h.nameEn ?? h.nameKm, nameKm: h.nameKm }]);
  }

  const merged = new Map<string, KhmerHoliday>();
  for (const [date, entries] of grouped) {
    const unique = entries.filter(
      (e, i) =>
        entries.findIndex((o) => o.nameEn === e.nameEn) === i &&
        !entries.some((o) => o.nameEn !== e.nameEn && o.nameEn.includes(e.nameEn)),
    );
    merged.set(date, {
      date,
      nameEn: unique.map((e) => e.nameEn).join(" / "),
      nameKm: unique.map((e) => e.nameKm).join(" / "),
    });
  }

  yearCache.set(year, merged);
  return merged;
}

/** One entry per date, sorted — what the import dialog lists. */
export function khmerHolidaysForYear(year: number): KhmerHolidayListing[] {
  const list = [...holidaysByDate(year).values()].sort((a, b) => a.date.localeCompare(b.date));

  // Consecutive dates with the same name are one multi-day holiday.
  return list.map((holiday, i) => {
    let start = i;
    while (start > 0 && list[start - 1].nameEn === holiday.nameEn && isNextDay(list[start - 1].date, list[start].date)) start--;
    let end = i;
    while (end < list.length - 1 && list[end + 1].nameEn === holiday.nameEn && isNextDay(list[end].date, list[end + 1].date)) end++;

    const length = end - start + 1;
    return { ...holiday, label: length > 1 ? `${holiday.nameEn} (Day ${i - start + 1}/${length})` : holiday.nameEn };
  });
}

function isNextDay(a: string, b: string): boolean {
  return new Date(b + "T00:00:00Z").getTime() - new Date(a + "T00:00:00Z").getTime() === 86_400_000;
}

/** `isoDate` is "YYYY-MM-DD". */
export function khmerDay(isoDate: string): KhmerDay {
  const cached = dayCache.get(isoDate);
  if (cached) return cached;

  const lunar = toKhmerLunarDate(isoDate);
  const holiday = holidaysByDate(Number(isoDate.slice(0, 4))).get(isoDate);

  const day: KhmerDay = {
    short: `${lunar.moonDayKhmer}${lunar.moonStatus}`,
    full: lunar.lunarDateText,
    month: lunar.khmerMonth,
    isSil: lunar.isSilDay,
    holidays: holiday ? [holiday] : [],
  };

  dayCache.set(isoDate, day);
  return day;
}
