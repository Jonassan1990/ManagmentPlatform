"use client";

import { Button } from "@/components/ui/button";
import { fieldClassName } from "@/components/ui/forms";

export type EditableOnboardingStep = {
  key: string;
  id?: string;
  title: string;
  description: string;
};

export function OnboardingStepsEditor({
  items,
  onChange,
  disabled,
}: {
  items: EditableOnboardingStep[];
  onChange: (items: EditableOnboardingStep[]) => void;
  disabled?: boolean;
}) {
  function update(index: number, patch: Partial<EditableOnboardingStep>) {
    onChange(
      items.map((item, itemIndex) =>
        itemIndex === index ? { ...item, ...patch } : item,
      ),
    );
  }

  function move(index: number, direction: -1 | 1) {
    const next = index + direction;
    if (next < 0 || next >= items.length) return;
    const copy = [...items];
    const [row] = copy.splice(index, 1);
    if (!row) return;
    copy.splice(next, 0, row);
    onChange(copy);
  }

  return (
    <ol className="space-y-3">
      {items.map((item, index) => (
        <li
          key={item.key}
          className="rounded-md border border-[var(--line)] p-3"
        >
          <div className="mb-2 flex flex-wrap items-center justify-between gap-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-[var(--muted)]">
              Step {index + 1}
            </p>
            <div className="flex flex-wrap gap-1">
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
              >
                Up
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || index === items.length - 1}
                onClick={() => move(index, 1)}
              >
                Down
              </Button>
              <Button
                type="button"
                size="sm"
                variant="ghost"
                disabled={disabled || items.length <= 1}
                onClick={() =>
                  onChange(items.filter((row) => row.key !== item.key))
                }
              >
                Remove
              </Button>
            </div>
          </div>
          <label className="block space-y-1 text-sm">
            <span className="font-medium text-[var(--ink)]">Title</span>
            <input
              className={fieldClassName}
              value={item.title}
              disabled={disabled}
              maxLength={300}
              onChange={(event) => update(index, { title: event.target.value })}
            />
          </label>
          <label className="mt-2 block space-y-1 text-sm">
            <span className="font-medium text-[var(--ink)]">Description</span>
            <textarea
              className={fieldClassName}
              rows={2}
              value={item.description}
              disabled={disabled}
              maxLength={2000}
              onChange={(event) =>
                update(index, { description: event.target.value })
              }
            />
          </label>
        </li>
      ))}
      <Button
        type="button"
        variant="secondary"
        size="sm"
        disabled={disabled || items.length >= 30}
        onClick={() =>
          onChange([
            ...items,
            {
              key: `new-${Date.now()}`,
              title: "",
              description: "",
            },
          ])
        }
      >
        Add step
      </Button>
    </ol>
  );
}
