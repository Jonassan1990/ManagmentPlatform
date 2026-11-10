/** Swedish public holidays and the eves that this workplace treats as closed. */
const HOLIDAYS: Record<string, string> = {
  "2025-12-24": "Julafton",
  "2025-12-25": "Juldagen",
  "2025-12-26": "Annandag jul",
  "2025-12-31": "Nyårsafton",
  "2026-01-01": "Nyårsdagen",
  "2026-01-06": "Trettondedag jul",
  "2026-04-03": "Långfredagen",
  "2026-04-05": "Påskdagen",
  "2026-04-06": "Annandag påsk",
  "2026-05-01": "Första maj",
  "2026-05-14": "Kristi himmelsfärdsdag",
  "2026-05-24": "Pingstdagen",
  "2026-06-06": "Sveriges nationaldag",
  "2026-06-19": "Midsommarafton",
  "2026-06-20": "Midsommardagen",
  "2026-10-31": "Alla helgons dag",
  "2026-12-24": "Julafton",
  "2026-12-25": "Juldagen",
  "2026-12-26": "Annandag jul",
  "2026-12-31": "Nyårsafton",
  "2027-01-01": "Nyårsdagen",
  "2027-01-06": "Trettondedag jul",
};

export function swedishHolidayName(isoDate: string): string | null {
  return HOLIDAYS[isoDate] ?? null;
}
