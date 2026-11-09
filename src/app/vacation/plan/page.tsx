import Link from "next/link";
import { redirect } from "next/navigation";
import { VacationSheetGrid } from "@/components/vacation/vacation-sheet-grid";
import { Breadcrumbs, PageHeader, Panel } from "@/components/ui/page";
import { buttonClassName } from "@/components/ui/button";
import type { SheetPlanKind } from "@/modules/vacation/application/vacation-plan-sheet";
import {
  getSheetDepartment,
  listSheetDepartments,
  sheetMonthCounts,
  sheetPeopleForMonth,
} from "@/modules/vacation/application/vacation-plan-sheet";
import { createServices } from "@/server/container";

export const dynamic = "force-dynamic";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

export default async function VacationPlanPage({
  searchParams,
}: {
  searchParams: Promise<{ year?: string; month?: string; department?: string }>;
}) {
  const params = await searchParams;
  const { authz } = createServices();
  await authz.ensureSystemRoles();
  const principal = await authz.resolveCurrentPrincipal();
  if (!principal) redirect("/");

  const departments = listSheetDepartments();
  const department = getSheetDepartment(params.department);
  const year = Number(params.year) || 2026;
  const month = Number(params.month) || department.peakMonth;
  const counts = sheetMonthCounts(department.code, year);
  const people = sheetPeopleForMonth(department.code, year, month);
  const days = daysInMonth(year, month);
  const monthLabel = `${MONTHS[month - 1] ?? ""} ${year}`;

  return (
    <div>
      <Breadcrumbs
        items={[
          { label: "Overview", href: "/" },
          { label: "People", href: "/vacation" },
          { label: "Vacation plan" },
        ]}
      />
      <PageHeader
        title="Vacation plan"
        description="The 2026 IN plan, one department at a time. Pick the department, then a month. The number on a month is how many planned days that department has."
        actions={
          <Link href="/vacation" className={buttonClassName({ variant: "secondary" })}>
            My requests
          </Link>
        }
      />
      <Panel>
        <h2 className="mb-3 text-base font-semibold text-[var(--ink)]">
          {department.code} · {monthLabel}
        </h2>
        <VacationSheetGrid
          departmentCode={department.code}
          year={year}
          month={month}
          departments={departments.map((row) => ({ code: row.code, people: row.people }))}
          monthCounts={counts}
          people={people.map((person) => ({
            name: person.name,
            group: person.group,
            days: days.map((date) => ({
              date,
              weekend: isWeekend(date),
              kind: kindOn(person.marks, date),
            })),
          }))}
        />
      </Panel>
    </div>
  );
}

function kindOn(marks: [string, SheetPlanKind][], date: string): SheetPlanKind | null {
  return marks.find(([day]) => day === date)?.[1] ?? null;
}

function daysInMonth(year: number, month: number): string[] {
  const days: string[] = [];
  const cursor = new Date(Date.UTC(year, month - 1, 1));
  while (cursor.getUTCMonth() === month - 1) {
    days.push(cursor.toISOString().slice(0, 10));
    cursor.setUTCDate(cursor.getUTCDate() + 1);
  }
  return days;
}

function isWeekend(date: string): boolean {
  const day = new Date(`${date}T00:00:00.000Z`).getUTCDay();
  return day === 0 || day === 6;
}
