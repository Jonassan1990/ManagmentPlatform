import { ensureVacationSheetRoster } from "@/modules/demo/ensure-vacation-sheet-roster";

let pending: Promise<void> | null = null;

/**
 * Keep the real vacation-sheet people in the organization.
 * Call sites keep this name; fictional demo switcher users are no longer created.
 */
export function ensureDemoDepartmentUsers(): Promise<void> {
  if (!pending) {
    pending = run().catch((error) => {
      pending = null;
      console.error(
        "[demo] vacation sheet people were not synced",
        error instanceof Error ? error.name : "unknown",
      );
    });
  }
  return pending;
}

async function run(): Promise<void> {
  await ensureVacationSheetRoster();
}
