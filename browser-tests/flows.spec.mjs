import { test, expect } from "@playwright/test";
import { example, APP } from "../src/core.js";
const key = `${APP}:v1`;
test("profile editing, literal instructions, photo and HTML sheet export survive reload", async ({
  page,
}) => {
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  await page.goto("/");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await page.getByLabel("Pet name", { exact: true }).fill("Miso & friends");
  await page
    .getByLabel("Feeding instructions", { exact: true })
    .fill("<script>keep as text</script>");
  await page
    .getByLabel("Reference photo (PNG, JPEG or WebP, under 1.4 MB)", {
      exact: true,
    })
    .setInputFiles({
      name: "tiny.png",
      mimeType: "image/png",
      buffer: Buffer.from(
        "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN7cAAAAASUVORK5CYII=",
        "base64",
      ),
    });
  await expect(page.locator("#editor img")).toBeVisible();
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await page.reload();
  await expect(page.getByLabel("Pet name", { exact: true })).toHaveValue(
    "Miso & friends",
  );
  await expect(page.locator("#preview")).toContainText(
    "<script>keep as text</script>",
  );
  const download = page.waitForEvent("download");
  await page
    .getByRole("button", { name: "Export handoff HTML", exact: true })
    .click();
  expect((await download).suggestedFilename()).toBe("pet-sitter-handoff.html");
  expect(errors).toEqual([]);
});
test("strict backup preview cancel and corrupt storage recovery preserve originals", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const before = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.locator("#import").setInputFiles({
    name: "empty.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ app: APP, version: 1, data: { pets: [] } }),
    ),
  });
  await expect(page.getByRole("dialog")).toBeVisible();
  await page
    .getByRole("button", { name: "Cancel import", exact: true })
    .click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(before);
  await page.evaluate((k) => localStorage.setItem(k, "broken original"), key);
  await page.reload();
  await expect(page.locator("#recover")).toBeVisible();
  await page.locator("#import").setInputFiles({
    name: "good.json",
    mimeType: "application/json",
    buffer: Buffer.from(
      JSON.stringify({ app: APP, version: 1, data: example() }),
    ),
  });
  await page
    .getByRole("button", { name: "Apply replacement", exact: true })
    .click();
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(
    "broken original",
  );
  await page.locator("#replace-confirm").check();
  await page
    .getByRole("button", { name: "Apply replacement", exact: true })
    .click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
});
test("storage quota and cross-tab conflicts refuse mutation; narrow and print views retain contacts", async ({
  page,
  context,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const second = await context.newPage();
  await second.goto("/");
  await page.getByLabel("Pet name", { exact: true }).fill("Fresh profile");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await second.getByLabel("Pet name", { exact: true }).fill("Stale profile");
  await second
    .getByRole("button", { name: "Save profile", exact: true })
    .click();
  await expect(second.locator("#message")).toContainText(
    /another tab|Another tab/,
  );
  await second.close();
  const raw = await page.evaluate((k) => localStorage.getItem(k), key);
  await page.evaluate(
    () =>
      (Storage.prototype.setItem = function () {
        throw new DOMException("quota", "QuotaExceededError");
      }),
  );
  await page.getByLabel("Pet name", { exact: true }).fill("Quota draft");
  await page.getByRole("button", { name: "Save profile", exact: true }).click();
  await expect(page.locator("#message")).toContainText("rejected the save");
  expect(await page.evaluate((k) => localStorage.getItem(k), key)).toBe(raw);
  await page.reload();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#print-sheet")).toBeVisible();
  await expect(page.locator("#print-sheet")).toContainText(
    "Emergency contacts",
  );
});
