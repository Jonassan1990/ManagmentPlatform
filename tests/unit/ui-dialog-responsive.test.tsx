/** @vitest-environment jsdom */
import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { useState } from "react";
import { describe, expect, it } from "vitest";
import { Button } from "@/components/ui/button";
import { Dialog } from "@/components/ui/dialog";

function Harness() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button type="button" onClick={() => setOpen(true)}>
        Open
      </Button>
      <Dialog
        open={open}
        onOpenChange={setOpen}
        title="Responsive dialog"
        description="Fits narrow viewports"
      >
        <p>Body</p>
      </Dialog>
    </>
  );
}

describe("Dialog responsiveness", () => {
  it("uses viewport-bounded width and max height classes", async () => {
    const user = userEvent.setup();
    render(<Harness />);
    await user.click(screen.getByRole("button", { name: "Open" }));
    const dialog = await screen.findByRole("dialog");
    expect(dialog.className).toMatch(/max-w-\[calc\(100vw-1rem\)\]/);
    expect(dialog.className).toMatch(/max-h-\[min\(90dvh,40rem\)\]/);
  });
});
