/**
 * Orders strings by UTF-16 code units, the order `Array.prototype.sort()` uses by default. Suited to machine values
 * such as ISO dates, codes and identifiers; text shown to people is ordered with `localeCompare` instead.
 */
export function compareCodeUnits(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}
