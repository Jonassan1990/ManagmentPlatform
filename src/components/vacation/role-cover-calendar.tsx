import Link from "next/link";
import type {
  DayCover,
  DayCoverPerson,
} from "@/modules/vacation/application/vacation-coverage";
import { toUtcDateOnly } from "@/modules/vacation/application/working-days";

const TONE_CLASS = {
  green: "bg-[var(--color-success-soft)] text-[var(--ok)]",
  yellow: "bg-[var(--color-warning-soft)] text-[var(--warning)]",
  red: "bg-[var(--color-error-soft)] text-[var(--danger)]",
  closed: "bg-[var(--surface)] text-[var(--muted)]",
} as const;

const TONE_LABEL = {
  green: "All roles available",
  yellow: "At least one person available",
  red: "No role available",
  closed: "Not a working day",
} as const;

export function RoleCoverCalendar({
  year,
  month,
  days,
  selectedDate,
  hrefForDay,
}: {
  year: number;
  month: number;
  days: DayCover[];
  selectedDate: string | null;
  hrefForDay: (date: string) => string;
}) {
  const byDate = new Map(days.map((day) => [day.date, day]));
  const first = new Date(Date.UTC(year, month - 1, 1));
  const daysInMonth = new Date(Date.UTC(year, month, 0)).getUTCDate();
  const startWeekday = (first.getUTCDay() + 6) % 7;
  const cells: Array<string | null> = [];
  for (let i = 0; i < startWeekday; i += 1) cells.push(null);
  for (let day = 1; day <= daysInMonth; day += 1) {
    const date = new Date(Date.UTC(year, month - 1, day));
    const key = date.toISOString().slice(0, 10);
    cells.push(key);
  }
  const selected = selectedDate ? byDate.get(selectedDate) : undefined;
  const showDetail =
    selected && (selected.tone === "yellow" || selected.tone === "red");

  return (
    <div>
      <ul className="mb-4 flex flex-wrap gap-3 text-sm">
        <Legend tone="green" label="All roles available" />
        <Legend tone="yellow" label="At least one person available" />
        <Legend tone="red" label="No role available" />
      </ul>
      <div className="grid grid-cols-7 gap-1">
        {["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"].map((label) => (
          <div
            key={label}
            className="px-1 py-1 text-center text-[10px] font-semibold uppercase tracking-wide text-[var(--muted)]"
          >
            {label}
          </div>
        ))}
        {cells.map((date, index) => {
          if (!date) {
            return <div key={`empty-${index}`} className="min-h-11" />;
          }
          const day = byDate.get(date);
          const tone = day?.tone ?? "closed";
          const dayNumber = Number(date.slice(8, 10));
          const label = `${dayLabel(date)}. ${TONE_LABEL[tone]}`;
          const className = `flex min-h-11 flex-col items-center justify-center rounded-md px-1 py-1 text-center text-sm font-semibold ${TONE_CLASS[tone]} ${
            selectedDate === date ? "ring-2 ring-[var(--ink)] ring-offset-1" : ""
          }`;
          if (tone === "yellow" || tone === "red") {
            const offCount = day?.off.length ?? 0;
            const hint =
              offCount === 0 ? "Part" : offCount === 1 ? "1 off" : `${offCount} off`;
            return (
              <Link
                key={date}
                href={hrefForDay(date)}
                aria-label={label}
                aria-current={selectedDate === date ? "date" : undefined}
                className={className}
              >
                <span>{dayNumber}</span>
                <span className="text-[10px] font-medium leading-tight">
                  {hint}
                </span>
              </Link>
            );
          }
          return (
            <div key={date} className={className} aria-label={label}>
              <span>{dayNumber}</span>
            </div>
          );
        })}
      </div>
      {showDetail ? <DayDetail day={selected} /> : null}
    </div>
  );
}

function Legend({
  tone,
  label,
}: {
  tone: "green" | "yellow" | "red";
  label: string;
}) {
  return (
    <li className="flex items-center gap-2">
      <span
        className={`inline-block h-3 w-3 rounded-sm ${TONE_CLASS[tone]}`}
        aria-hidden
      />
      <span className="text-[var(--ink)]">{label}</span>
    </li>
  );
}

function DayDetail({ day }: { day: DayCover }) {
  const departments = groupDepartments([...day.off, ...day.available]);
  return (
    <div className="mt-4 rounded-md border border-[var(--line)] p-4">
      <h3 className="text-base font-semibold text-[var(--ink)]">
        {dayLabel(day.date)}
      </h3>
      <p className="mt-1 text-sm text-[var(--muted)]">
        {day.tone === "red"
          ? "No role is available."
          : "At least one person is still available."}
      </p>
      <div className="mt-4 space-y-4">
        {departments.map((department) => (
          <section key={department.id}>
            <h4 className="text-sm font-semibold text-[var(--ink)]">
              {department.name}
            </h4>
            <PersonList title="Off" people={department.off} />
            <PersonList title="Available" people={department.available} />
          </section>
        ))}
      </div>
    </div>
  );
}

function PersonList({
  title,
  people,
}: {
  title: string;
  people: DayCoverPerson[];
}) {
  if (people.length === 0) return null;
  return (
    <div className="mt-2">
      <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
        {title}
      </p>
      <ul className="mt-1 space-y-1">
        {people.map((person) => (
          <li key={person.principalId} className="text-sm text-[var(--ink)]">
            {person.displayName}
            <span className="text-[var(--muted)]"> · {person.role}</span>
            {person.note ? (
              <span className="text-[var(--muted)]"> · {person.note}</span>
            ) : null}
          </li>
        ))}
      </ul>
    </div>
  );
}

function groupDepartments(people: DayCoverPerson[]) {
  const groups = new Map<
    string,
    { id: string; name: string; off: DayCoverPerson[]; available: DayCoverPerson[] }
  >();
  for (const person of people) {
    const group = groups.get(person.departmentId) ?? {
      id: person.departmentId,
      name: person.departmentName,
      off: [],
      available: [],
    };
    if (person.availability === "off") group.off.push(person);
    else group.available.push(person);
    groups.set(person.departmentId, group);
  }
  return [...groups.values()].sort((a, b) => {
    if (a.off.length !== b.off.length) return b.off.length - a.off.length;
    return a.name.localeCompare(b.name);
  });
}

function dayLabel(date: string): string {
  return toUtcDateOnly(date).toLocaleDateString("en-GB", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
    timeZone: "UTC",
  });
}
