import { readFileSync, readdirSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { ru } from "@/shared/config/locales/ru";
import { en } from "@/shared/config/locales/en";
function readKey(locale: unknown, key: string): unknown {
  return key
    .split(".")
    .reduce<unknown>(
      (current, part) =>
        current && typeof current === "object"
          ? (current as Record<string, unknown>)[part]
          : undefined,
      locale,
    );
}
describe("endpoint locale coverage", () => {
  it("has RU and EN entries for all module keys including validation and shared editors", () => {
    const feature = resolve(__dirname, "..");
    const files = readdirSync(feature, { recursive: true })
      .filter(
        (file) =>
          /\.tsx?$/.test(String(file)) && !String(file).includes(".test."),
      )
      .map((file) => resolve(feature, String(file)));
    files.push(
      resolve(
        feature,
        "../../shared/ui/PjsipSettingsBuilder/PjsipSettingsBuilder.tsx",
      ),
      resolve(feature, "../../shared/lib/pjsipSettings.ts"),
      resolve(
        feature,
        "../../entities/endpoint/ui/EndpointStatus/EndpointStatus.tsx",
      ),
    );
    const keys = new Set(
      files.flatMap((file) =>
        [
          ...readFileSync(file, "utf8").matchAll(
            /["'](endpoints(?:\.\w+)+)["']/g,
          ),
        ].map((match) => match[1]),
      ),
    );
    for (const category of [
      "media",
      "network",
      "security",
      "timers",
      "calls",
      "other",
    ])
      keys.add(`endpoints.parameterCategory.${category}`);
    for (const key of keys) {
      for (const [language, locale] of [
        ["ru", ru],
        ["en", en],
      ] as const) {
        expect(
          readKey(locale, key) ?? readKey(locale, `${key}_other`),
          `${language}: ${key}`,
        ).toBeDefined();
      }
    }
    expect(ru.endpoints.confirmBulkDelete).not.toContain("{{extensions}}");
    expect(en.endpoints.confirmBulkDelete).not.toContain("{{extensions}}");
  });
});
