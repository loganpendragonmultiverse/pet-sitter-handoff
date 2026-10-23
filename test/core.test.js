import test from "node:test";
import assert from "node:assert/strict";
import { validate, example, sheet } from "../src/core.js";
import { inspectPhoto } from "../src/photo.js";
test("separate profiles retain owner-supplied instructions and exported sheets escape private text", () => {
  const data = example();
  data.pets.push({
    ...structuredClone(data.pets[0]),
    id: "second",
    name: "<script>alert(1)</script>",
    contacts: "Owner & vet <unknown>",
  });
  validate(data);
  const html = sheet(data.pets);
  assert.ok(html.includes("&lt;script&gt;alert(1)&lt;/script&gt;"));
  assert.ok(!html.includes("<script>"));
  assert.ok(html.includes("Owner &amp; vet &lt;unknown&gt;"));
  assert.ok(html.includes("Miso"));
});
test("missing optional instructions are explicit on the handoff", () => {
  const data = example();
  data.pets[0].feeding = "";
  assert.match(sheet(data.pets), /Not supplied\. Confirm with the owner\./);
});
test("strict profiles reject duplicate ids, unknown fields and wrong instruction types", () => {
  const data = example();
  data.pets.push(structuredClone(data.pets[0]));
  assert.throws(() => validate(data));
  assert.throws(() =>
    validate({ pets: [{ ...example().pets[0], feeding: 7 }] }),
  );
  assert.throws(() =>
    validate({ pets: [{ ...example().pets[0], medication: "made up" }] }),
  );
});
test("raster validator rejects spoofed, oversized and executable-image data", () => {
  assert.throws(() => inspectPhoto("data:image/png;base64,YWJjZA=="));
  assert.throws(() => inspectPhoto("data:image/svg+xml;base64,PHN2Zz4="));
  const bytes = new Uint8Array(45);
  bytes.set([137, 80, 78, 71, 13, 10, 26, 10]);
  new DataView(bytes.buffer).setUint32(8, 13);
  bytes.set([73, 72, 68, 82], 12);
  new DataView(bytes.buffer).setUint32(16, 100000);
  new DataView(bytes.buffer).setUint32(20, 1);
  bytes.set([73, 69, 78, 68], 37);
  assert.throws(() =>
    inspectPhoto(
      `data:image/png;base64,${Buffer.from(bytes).toString("base64")}`,
    ),
  );
});
test("a genuine small PNG is accepted with its exact raster size", () => {
  const photo =
    "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+aN7cAAAAASUVORK5CYII=";
  assert.deepEqual(inspectPhoto(photo), { width: 1, height: 1, type: "png" });
});
