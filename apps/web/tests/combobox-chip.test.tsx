import { renderToString } from "react-dom/server";
import { expect, it } from "vitest";
import { Combobox, ComboboxChip, ComboboxChips } from "@/components/ui/combobox";

it("keeps chip layout and appearance when a caller limits its width", () => {
  const markup = renderToString(
    <Combobox multiple value={["sunset"]}>
      <ComboboxChips>
        <ComboboxChip className="max-w-full" removeProps={{ "aria-label": "Remove sunset" }}>
          sunset
        </ComboboxChip>
      </ComboboxChips>
    </Combobox>,
  );
  const chip = markup.match(/<div[^>]*data-slot="combobox-chip"[^>]*>/u)?.[0];
  expect(chip).toBeDefined();
  expect(chip).toContain("flex items-center");
  expect(chip).toContain("bg-accent");
  expect(chip).toContain("ps-2");
  expect(chip).toContain("max-w-full");
  expect(markup).toContain('aria-label="Remove sunset"');
});
