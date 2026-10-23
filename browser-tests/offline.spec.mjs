import { test, expect } from "@playwright/test";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { pathToFileURL } from "node:url";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { APP } from "../src/core.js";
let extracted;
test.beforeAll(async () => {
  extracted = await mkdtemp(join(tmpdir(), `${APP}-artifact-`));
  const zip = resolve(`dist/${APP}-1.0.0.zip`),
    result = spawnSync(process.platform === "win32" ? "python" : "python3", [
      "-c",
      "import sys,zipfile; zipfile.ZipFile(sys.argv[1]).extractall(sys.argv[2])",
      zip,
      extracted,
    ]);
  if (result.status !== 0)
    throw new Error(
      result.stderr?.toString() ||
        "Build the release ZIP before browser acceptance.",
    );
  const digest = createHash("sha256")
    .update(await readFile(zip))
    .digest("hex");
  expect(await readFile("dist/SHA256SUMS", "utf8")).toContain(digest);
  expect(await readFile(join(extracted, "index.html"), "utf8")).toBe(
    await readFile("dist/site/index.html", "utf8"),
  );
});
test.afterAll(async () => {
  if (extracted) await rm(extracted, { recursive: true, force: true });
});
test("exact extracted offline ZIP supports the saved workflow, narrow layout and printable sheet", async ({
  browser,
  browserName,
}, testInfo) => {
  const context = await browser.newContext({
    offline: true,
    locale: "en-GB",
    timezoneId: "UTC",
    viewport: { width: 1280, height: 900 },
  });
  const page = await context.newPage(),
    errors = [],
    network = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("request", (r) => {
    if (/^https?:/.test(r.url())) network.push(r.url());
  });
  await page.goto(pathToFileURL(join(extracted, "index.html")).href);
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  const pet = APP === "pet-sitter-handoff",
    dinner = APP === "dinner-finish-together";
  await expect(page.locator("#records")).toContainText(
    dinner ? "Sunday dinner" : pet ? "Miso" : "Weekend camping box",
  );
  if (pet) {
    await page
      .getByLabel("Owner & handoff notes", { exact: true })
      .fill(
        "Please check every instruction with the owner before the handoff. ".repeat(
          18,
        ),
      );
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
    await page.getByRole("button", { name: "Add pet", exact: true }).click();
    await page.getByLabel("Pet name", { exact: true }).fill("Juniper");
    await page
      .getByLabel("Feeding instructions", { exact: true })
      .fill("Owner-supplied example: fill in the measured amount and routine.");
    await page
      .getByRole("button", { name: "Save profile", exact: true })
      .click();
  }
  await page.reload();
  await expect(page.locator("#records")).toContainText(
    dinner ? "Sunday dinner" : pet ? "Juniper" : "Weekend camping box",
  );
  await page.screenshot({
    path: testInfo.outputPath("offline-desktop.png"),
    fullPage: true,
  });
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  await page.screenshot({
    path: testInfo.outputPath("offline-narrow.png"),
    fullPage: true,
  });
  await page.emulateMedia({ media: "print" });
  await expect(page.locator("#print-sheet")).toBeVisible();
  await page.screenshot({
    path: testInfo.outputPath("offline-print.png"),
    fullPage: true,
  });
  if (browserName === "chromium")
    await page.pdf({
      path: testInfo.outputPath("offline-print.pdf"),
      format: "A4",
      printBackground: true,
    });
  expect(network).toEqual([]);
  expect(errors).toEqual([]);
  await context.close();
});
