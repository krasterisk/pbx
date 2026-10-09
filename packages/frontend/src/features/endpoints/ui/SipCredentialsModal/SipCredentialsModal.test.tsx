import React from "react";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import "@testing-library/jest-dom";
import type { RootState } from "@/app/store/store";
import { ru } from "@/shared/config/locales/ru";
import { en } from "@/shared/config/locales/en";
import { SipCredentialsModal } from "./SipCredentialsModal";

const mockDispatch = vi.fn();
let mockState: Partial<RootState>;

vi.mock("react-i18next", () => ({
  useTranslation: () => ({
    t: (key: string, options?: string | { field?: string }) => {
      if (typeof options === "string") return options;
      if (options && typeof options.field === "string")
        return `${key}:${options.field}`;
      return key;
    },
    i18n: { language: "ru" },
  }),
}));

vi.mock("@/shared/hooks/useAppStore", () => ({
  useAppDispatch: () => mockDispatch,
  useAppSelector: (selector: (state: RootState) => unknown) =>
    selector(mockState as RootState),
}));

vi.mock("@/shared/api/endpoints/endpointApi", () => ({
  useGetEndpointCredentialsQuery: () => ({
    data: {
      sipId: "e1-1001",
      extension: "1001",
      username: "1001",
      password: "secret",
      authType: "userpass",
      domain: "pbx.local",
      webrtc: {
        sipId: "ew1-1001",
        extension: "1001",
        username: "1001w",
        password: "wsecret",
        authType: "userpass",
        domain: "pbx.local",
        transport: "wss",
      },
    },
    isLoading: false,
  }),
}));

function renderModal() {
  mockState = {
    endpointsPage: {
      isModalOpen: false,
      isBulkModalOpen: false,
      selectedEndpoint: null,
      modalMode: "create",
      credentialsSipId: "e1-1001",
    },
  };
  return render(<SipCredentialsModal />);
}

function installClipboard(writeText: ReturnType<typeof vi.fn>) {
  Object.defineProperty(window, "isSecureContext", {
    configurable: true,
    value: true,
  });
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: { writeText },
  });
}

describe("SipCredentialsModal", () => {
  beforeEach(() => {
    mockDispatch.mockClear();
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: vi.fn(() => true),
    });
  });

  it("uses locale keys for every credential label", () => {
    renderModal();

    expect(screen.getByText("endpoints.sipCredentials")).toBeInTheDocument();
    expect(screen.getByText("endpoints.credSip")).toBeInTheDocument();
    expect(screen.getByText("endpoints.credWebrtc")).toBeInTheDocument();
    expect(screen.getAllByText("endpoints.credServer").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("endpoints.credLogin").length).toBeGreaterThan(
      0,
    );
    expect(screen.getAllByText("endpoints.password").length).toBeGreaterThan(0);
    expect(screen.getByText("endpoints.transport")).toBeInTheDocument();
    expect(
      screen.getByRole("button", { name: "endpoints.copyAll" }),
    ).toBeInTheDocument();
    expect(screen.queryByText("SIP Server / Domain")).not.toBeInTheDocument();
    expect(screen.queryByText("Username / Login")).not.toBeInTheDocument();
  });

  it("has Russian and English strings for the credential modal", () => {
    expect(ru.endpoints.sipCredentials).toBe("Данные для подключения");
    expect(en.endpoints.sipCredentials).toBe("SIP Credentials");
    expect(ru.endpoints.credServer).toBe("SIP-сервер / домен");
    expect(en.endpoints.credServer).toBe("SIP Server / Domain");
    expect(ru.endpoints.credLogin).toBe("Имя пользователя / логин");
    expect(en.endpoints.credLogin).toBe("Username / Login");
    expect(ru.endpoints.copyAll).toBe("Скопировать всё");
    expect(en.endpoints.copyAll).toBe("Copy all");
    expect(ru.endpoints.credEmpty).toBe("Нет данных для подключения");
    expect(en.endpoints.credEmpty).toBe("No connection details");
    expect(ru.endpoints.copyField).toContain("{{field}}");
    expect(en.endpoints.copyField).toContain("{{field}}");
    expect(ru.endpoints.password).toBe("Пароль");
    expect(en.endpoints.transport).toBe("Transport");
  });

  it("copies a field when the clipboard API is available", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    renderModal();

    const [copyDomain] = screen.getAllByRole("button", {
      name: /endpoints.copyField:endpoints.credServer/,
    });
    await user.click(copyDomain);

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith("pbx.local");
    });
  });

  it("copies all credentials with translated labels", async () => {
    const user = userEvent.setup();
    const writeText = vi.fn().mockResolvedValue(undefined);
    installClipboard(writeText);
    renderModal();

    await user.click(screen.getByRole("button", { name: "endpoints.copyAll" }));

    await waitFor(() => {
      expect(writeText).toHaveBeenCalledWith(
        [
          "endpoints.credSip",
          "endpoints.credServer: pbx.local",
          "endpoints.credLogin: 1001",
          "endpoints.password: secret",
          "",
          "endpoints.credWebrtc",
          "endpoints.credServer: pbx.local",
          "endpoints.credLogin: 1001w",
          "endpoints.password: wsecret",
          "endpoints.transport: WSS",
        ].join("\n"),
      );
    });
  });

  it("falls back to a selection copy when the clipboard API rejects", async () => {
    const user = userEvent.setup();
    const writeText = vi
      .fn()
      .mockRejectedValue(
        new DOMException("Document is not focused", "NotAllowedError"),
      );
    installClipboard(writeText);
    let copied = "";
    Object.defineProperty(document, "execCommand", {
      configurable: true,
      writable: true,
      value: (command: string) => {
        if (command !== "copy") return false;
        const area = document.querySelector("textarea");
        copied = area instanceof HTMLTextAreaElement ? area.value : "";
        return copied.length > 0;
      },
    });
    renderModal();

    const [copyPassword] = screen.getAllByRole("button", {
      name: /endpoints.copyField:endpoints.password/,
    });
    await user.click(copyPassword);

    await waitFor(() => {
      expect(copied).toBe("secret");
      const [button] = screen.getAllByRole("button", {
        name: /endpoints.copyField:endpoints.password/,
      });
      expect(button.querySelector(".lucide-check")).toBeTruthy();
    });
  });
});
