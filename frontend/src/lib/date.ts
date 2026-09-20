/**
 * The API sends date columns as full timestamps
 * ("2026-09-20T00:00:00.000000Z"), so comparing or showing them raw is wrong.
 */
export function dateOnly(value: string): string {
  return value.slice(0, 10);
}

/**
 * True when the date is today on the server's clock (UTC) or the viewer's —
 * a phone in Cambodia is a day ahead of UTC until 07:00, and either reading
 * of "today" is a legitimate match for a record made just now.
 */
export function isToday(value: string): boolean {
  const day = dateOnly(value);
  const now = new Date();
  const local = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}-${String(now.getDate()).padStart(2, "0")}`;

  return day === local || day === now.toISOString().slice(0, 10);
}
