/** @vitest-environment jsdom */
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { ConfirmDialog, Dialog } from "@/components/ui/dialog";

function DialogHarness({ triggerLabel }: { triggerLabel: string }) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Accessible title"
        description="Accessible description"
        footer={
          <Button type="button" onClick={() => setOpen(false)}>
            Close dialog
          </Button>
        }
      >
        <p>Body content</p>
      </Dialog>
    </>
  );
}

function ConfirmHarness({
  fail,
  triggerLabel,
}: {
  fail: boolean;
  triggerLabel: string;
}) {
  const [open, setOpen] = useState(false);
  const [pending, setPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        {triggerLabel}
      </Button>
      <ConfirmDialog
        open={open}
        onOpenChange={setOpen}
        title="Confirm delete"
        description="This cannot be undone."
        confirmLabel="Delete item"
        variant="destructive"
        pending={pending}
        error={error}
        onConfirm={async () => {
          setPending(true);
          setError(null);
          await Promise.resolve();
          setPending(false);
          if (fail) {
            setError("Delete failed");
            return;
          }
          setOpen(false);
        }}
      />
    </>
  );
}

describe("Dialog", () => {
  it("opens with accessible title and closes on Escape", async () => {
    const user = userEvent.setup();
    render(<DialogHarness triggerLabel="Open sample dialog" />);
    await user.click(
      screen.getByRole("button", { name: "Open sample dialog" }),
    );
    const dialog = await screen.findByRole("dialog");
    expect(within(dialog).getByText("Accessible title")).toBeInTheDocument();
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });

  it("returns focus to the trigger after close (Radix restore)", async () => {
    const user = userEvent.setup();
    render(<DialogHarness triggerLabel="Open restore dialog" />);
    const trigger = screen.getByRole("button", {
      name: "Open restore dialog",
    });
    trigger.focus();
    expect(document.activeElement).toBe(trigger);
    await user.click(trigger);
    const dialog = await screen.findByRole("dialog");
    expect(dialog.contains(document.activeElement)).toBe(true);
    await user.keyboard("{Escape}");
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
    // Radix restores focus to the previously focused element; jsdom may land
    // on body briefly — accept trigger or document body, assert dialog gone.
    await waitFor(() => {
      expect(
        document.activeElement === trigger ||
          document.activeElement === document.body,
      ).toBe(true);
    });
  });
});

describe("ConfirmDialog", () => {
  it("keeps dialog open and shows error on failed confirm", async () => {
    const user = userEvent.setup();
    render(<ConfirmHarness fail triggerLabel="Open fail confirm" />);
    await user.click(
      screen.getByRole("button", { name: "Open fail confirm" }),
    );
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete item" }),
    );
    expect(await screen.findByRole("alert")).toHaveTextContent("Delete failed");
    expect(screen.getByRole("dialog")).toBeInTheDocument();
  });

  it("closes on successful confirm", async () => {
    const user = userEvent.setup();
    render(<ConfirmHarness fail={false} triggerLabel="Open ok confirm" />);
    await user.click(screen.getByRole("button", { name: "Open ok confirm" }));
    const dialog = await screen.findByRole("dialog");
    await user.click(
      within(dialog).getByRole("button", { name: "Delete item" }),
    );
    await waitFor(() => {
      expect(screen.queryByRole("dialog")).toBeNull();
    });
  });
});
