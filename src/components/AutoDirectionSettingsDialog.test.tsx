// @vitest-environment jsdom
import { ChakraProvider, defaultSystem } from "@chakra-ui/react";
import { cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { AutoDirectionSettingsDialog } from "./AutoDirectionSettingsDialog";

describe("AutoDirectionSettingsDialog", () => {
  afterEach(() => cleanup());
  it("renders key labels", () => {
    render(
      <ChakraProvider value={defaultSystem}>
        <AutoDirectionSettingsDialog
        open
        onOpenChange={vi.fn()}
        fontFamily="sans-serif"
        enabled
        onEnabledChange={vi.fn()}
        beforeCutoffDirection="for_yoyogiuehara"
        onBeforeCutoffDirectionChange={vi.fn()}
        cutoffTime="16:00"
        onCutoffTimeChange={vi.fn()}
        afterCutoffDirection="for_kitaayase"
      />
      </ChakraProvider>
    );

    expect(screen.getByText("表示方面の自動設定")).toBeTruthy();
    expect(screen.getByText("表示方面（切替前）")).toBeTruthy();
    expect(screen.getByText("切替時刻")).toBeTruthy();
    expect(screen.getByText("表示方面（切替後）")).toBeTruthy();
  });

  it("calls callbacks on input changes", () => {
    const onEnabledChange = vi.fn();
    const onBeforeCutoffDirectionChange = vi.fn();
    const onCutoffTimeChange = vi.fn();

    render(
      <ChakraProvider value={defaultSystem}>
        <AutoDirectionSettingsDialog
        open
        onOpenChange={vi.fn()}
        fontFamily="sans-serif"
        enabled={false}
        onEnabledChange={onEnabledChange}
        beforeCutoffDirection="for_yoyogiuehara"
        onBeforeCutoffDirectionChange={onBeforeCutoffDirectionChange}
        cutoffTime="16:00"
        onCutoffTimeChange={onCutoffTimeChange}
        afterCutoffDirection="for_kitaayase"
      />
      </ChakraProvider>
    );

    const checkbox = screen.getAllByRole("checkbox").at(-1)!;
    fireEvent.click(checkbox);

    const selects = screen.getAllByRole("combobox");
    fireEvent.change(selects[0], { target: { value: "for_kitaayase" } });

    const timeInput = screen.getAllByDisplayValue("16:00").at(-1)!;
    fireEvent.change(timeInput, { target: { value: "17:30" } });

    expect(onEnabledChange).toHaveBeenCalled();
    expect(onBeforeCutoffDirectionChange).toHaveBeenCalledWith("for_kitaayase");
    expect(onCutoffTimeChange).toHaveBeenCalledWith("17:30");
  });
});
