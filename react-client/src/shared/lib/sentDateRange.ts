const vietnamDate = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Ho_Chi_Minh", year: "numeric", month: "2-digit", day: "2-digit" });

/** Compare calendar days in the same timezone used by the backend date filters. */
export function isWithinSentDates(createdAt: string, from: string, to: string): boolean {
  const value = new Date(createdAt);
  if (!Number.isFinite(value.getTime())) return false;
  const parts = vietnamDate.formatToParts(value);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  const date = get("year") + "-" + get("month") + "-" + get("day");
  return (!from || date >= from) && (!to || date <= to);
}
