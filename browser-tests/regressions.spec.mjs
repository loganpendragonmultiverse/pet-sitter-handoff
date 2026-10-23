import { test, expect } from "@playwright/test";
import { APP, example } from "../src/core.js";
const dinner = APP === "dinner-finish-together",
  pet = APP === "pet-sitter-handoff",
  collection = dinner ? "meals" : pet ? "pets" : "kits",
  nameLabel = dinner ? "Meal name" : pet ? "Pet name" : "Kit name",
  saveLabel = dinner ? "Save meal" : pet ? "Save profile" : "Save kit",
  deleteLabel = dinner ? "Delete meal" : pet ? "Delete profile" : "Delete kit",
  key = `${APP}:v1`;
test("valid long words fit narrow screens and stale undo cannot replace newer saved work", async ({
  page,
}) => {
  await page.goto("/");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await page.getByLabel(nameLabel, { exact: true }).fill("A".repeat(100));
  await page.getByRole("button", { name: saveLabel, exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  expect(
    await page.evaluate(
      () => document.documentElement.scrollWidth <= innerWidth + 1,
    ),
  ).toBe(true);
  page.once("dialog", (d) => d.accept());
  await page.getByRole("button", { name: deleteLabel, exact: true }).click();
  await page
    .getByRole("button", {
      name: dinner ? "New meal" : pet ? "Add pet" : "New kit",
      exact: true,
    })
    .click();
  await page.getByLabel(nameLabel, { exact: true }).fill("Newer saved record");
  await page.getByRole("button", { name: saveLabel, exact: true }).click();
  await page
    .getByRole("button", { name: "Undo last deletion / reset", exact: true })
    .click();
  await expect(page.locator("#message")).toContainText(
    "newer saved data has been kept",
  );
  const data = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).data,
    key,
  );
  expect(data[collection]).toHaveLength(1);
  expect(data[collection][0].name).toBe("Newer saved record");
});
test("slow earlier backup reads cannot replace the latest preview", async ({
  page,
}) => {
  await page.goto("/");
  await page.evaluate(() => {
    const original = File.prototype.text;
    File.prototype.text = function () {
      const file = this;
      return new Promise((resolve, reject) =>
        setTimeout(
          () => original.call(file).then(resolve, reject),
          file.name === "slow.json" ? 500 : 10,
        ),
      );
    };
  });
  const a = example(),
    b = example();
  a[collection][0].name = "Earlier stale backup";
  b[collection][0].name = "Latest backup";
  const payload = (name, data) => ({
    name,
    mimeType: "application/json",
    buffer: Buffer.from(JSON.stringify({ app: APP, version: 1, data })),
  });
  await page.locator("#import").setInputFiles(payload("slow.json", a));
  await page.locator("#import").setInputFiles(payload("fast.json", b));
  await expect(page.getByRole("dialog")).toBeVisible();
  await page.waitForTimeout(600);
  await page.locator("#replace-confirm").check();
  await page
    .getByRole("button", { name: "Apply replacement", exact: true })
    .click();
  await expect(page.getByLabel(nameLabel, { exact: true })).toHaveValue(
    "Latest backup",
  );
});
test("visual timer-only state requires replacement confirmation and new kit has no stale reset action", async ({
  page,
}) => {
  test.skip(!dinner && pet, "This state belongs to meal and kit workflows.");
  await page.goto("/");
  if (dinner) {
    const data = {
      meals: [],
      timers: [
        {
          id: "timer",
          label: "Active standalone timer",
          endsAt: Date.now() + 600000,
        },
      ],
    };
    await page.evaluate(
      ({ key, app, data }) =>
        localStorage.setItem(key, JSON.stringify({ app, version: 1, data })),
      { key, app: APP, data },
    );
    await page.reload();
    page.once("dialog", (d) => d.dismiss());
    await page
      .getByRole("button", { name: "Load example", exact: true })
      .click();
    await expect(page.locator("#timers")).toContainText(
      "Active standalone timer",
    );
  } else {
    await page
      .getByRole("button", { name: "Load example", exact: true })
      .click();
    await page.getByRole("button", { name: "New kit", exact: true }).click();
    await expect(
      page.getByRole("button", {
        name: "Reset all present counts to zero",
        exact: true,
      }),
    ).toHaveCount(0);
  }
});
test("pending photo saves are refused, latest selection wins and removal cancels pending reads", async ({
  page,
}) => {
  test.skip(dinner, "Dinner has no photo inputs.");
  await page.goto("/");
  await page.getByRole("button", { name: "Load example", exact: true }).click();
  await page.evaluate(() => {
    const original = FileReader.prototype.readAsDataURL;
    FileReader.prototype.readAsDataURL = function (file) {
      const reader = this;
      setTimeout(
        () => original.call(reader, file),
        file.name === "slow.png" ? 500 : 10,
      );
    };
  });
  const images = await page.evaluate(() =>
    [1, 2].map((width) => {
      const canvas = document.createElement("canvas");
      canvas.width = width;
      canvas.height = 1;
      canvas.getContext("2d").fillRect(0, 0, width, 1);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
  );
  const file = (name, image) => ({
    name,
    mimeType: "image/png",
    buffer: Buffer.from(image, "base64"),
  });
  const input = page
    .getByLabel("Reference photo (PNG, JPEG or WebP, under 1.4 MB)", {
      exact: true,
    })
    .first();
  await input.setInputFiles(file("slow.png", images[0]));
  await page.getByRole("button", { name: saveLabel, exact: true }).click();
  await expect(page.locator("#message")).toContainText("finish preparing");
  await input.setInputFiles(file("fast.png", images[1]));
  await expect(page.locator("#editor img").first()).toBeVisible();
  await page.waitForTimeout(600);
  expect(
    await page
      .locator("#editor img")
      .first()
      .evaluate((img) => img.naturalWidth),
  ).toBe(2);
  await input.setInputFiles(file("slow.png", images[0]));
  await page
    .getByRole("button", { name: "Remove photo", exact: true })
    .first()
    .click();
  await page.waitForTimeout(600);
  await expect(page.locator("#editor img")).toHaveCount(0);
  await page.getByRole("button", { name: saveLabel, exact: true }).click();
  const saved = await page.evaluate(
    (k) => JSON.parse(localStorage.getItem(k)).data,
    key,
  );
  expect(pet ? saved.pets[0].photo : saved.kits[0].items[0].photo).toBe(null);
});
