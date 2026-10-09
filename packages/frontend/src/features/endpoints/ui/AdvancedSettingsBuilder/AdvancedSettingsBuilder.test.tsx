import { describe, it, expect, vi } from "vitest";
import { render, screen, fireEvent } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { AdvancedSettingsBuilder } from "./AdvancedSettingsBuilder";
vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

describe("AdvancedSettingsBuilder", () => {
  it("loads replacement values with the same number of keys", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn();
    const view = render(
      <AdvancedSettingsBuilder
        value={{ rtp_timeout: "10" }}
        onChange={onChange}
      />,
    );
    expect(screen.getByRole("button", { name: "rtp_timeout" })).toHaveAttribute(
      "aria-expanded",
      "false",
    );
    await user.click(screen.getByRole("button", { name: "rtp_timeout" }));
    expect(screen.getByRole("textbox")).toHaveValue("10");
    view.rerender(
      <AdvancedSettingsBuilder
        value={{ rtp_timeout: "60" }}
        onChange={onChange}
      />,
    );
    await user.click(screen.getByRole("button", { name: "rtp_timeout" }));
    expect(screen.getByRole("textbox")).toHaveValue("60");
    expect(onChange).not.toHaveBeenCalled();
  });

  it("groups choices and rejects invalid numeric values without losing the draft", async () => {
    const user = userEvent.setup();
    const onChange = vi.fn(),
      valid = vi.fn();
    render(
      <AdvancedSettingsBuilder
        value={{}}
        onChange={onChange}
        onValidationChange={valid}
      />,
    );
    await user.click(
      screen.getByRole("button", { name: "endpoints.addParameter" }),
    );
    expect(valid).toHaveBeenLastCalledWith(false);
    const select = screen.getByRole("combobox");
    expect(select.querySelector('option[value="direct_media"]')).toBeNull();
    expect(select.querySelector('option[value="webrtc"]')).toBeNull();
    expect(
      select.querySelector(
        'optgroup[label="endpoints.parameterCategory.timers"]',
      ),
    ).toBeTruthy();
    await user.selectOptions(select, "rtp_timeout");
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "-5" } });
    expect(screen.getByRole("alert")).toHaveTextContent(
      "endpoints.integerParameter",
    );
    expect(valid).toHaveBeenLastCalledWith(false);
    fireEvent.change(screen.getByRole("textbox"), { target: { value: "30" } });
    expect(valid).toHaveBeenLastCalledWith(true);
    expect(onChange).toHaveBeenLastCalledWith({ rtp_timeout: "30" });
  });
});
