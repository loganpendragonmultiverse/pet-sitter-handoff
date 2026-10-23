import test from "node:test";
import assert from "node:assert/strict";
import { APP, validate, empty, example } from "../src/core.js";
import { createVault, encode, decode } from "../src/vault.js";
function storage(initial = null) {
  let value = initial;
  return {
    getItem() {
      return value;
    },
    setItem(k, next) {
      value = next;
    },
    get raw() {
      return value;
    },
  };
}
test("backup round trip keeps complete data and rejects other tools or versions", () => {
  const data = example(),
    raw = encode(data, APP, validate);
  assert.deepEqual(decode(raw, APP, validate), data);
  assert.throws(() => decode(raw, "other-app", validate));
  assert.throws(() =>
    decode(raw.replace('"version": 1', '"version": 2'), APP, validate),
  );
  assert.throws(() => decode("{", APP, validate));
});
test("corrupt original bytes remain unchanged until an explicit recovery replacement", () => {
  const store = storage("broken bytes"),
    v = createVault(store, "key", APP, validate, empty);
  assert.equal(v.corrupt, true);
  assert.throws(() => v.save(example()));
  assert.throws(() => v.export());
  assert.equal(v.raw, "broken bytes");
  assert.equal(store.raw, "broken bytes");
  v.save(example(), { recovery: true });
  assert.deepEqual(v.data, example());
  assert.equal(v.locked, false);
});
test("storage write failure preserves previous data and quota errors remain actionable", () => {
  const old = encode(empty(), APP, validate),
    store = storage(old),
    v = createVault(store, "key", APP, validate, empty);
  store.setItem = () => {
    throw new Error("quota");
  };
  assert.throws(() => v.save(example()), /storage rejected/i);
  assert.deepEqual(v.data, empty());
  assert.equal(store.raw, old);
});
test("stale tabs refuse writes before touching another tab’s saved value", () => {
  const store = storage(),
    v = createVault(store, "key", APP, validate, empty);
  store.setItem("key", encode(example(), APP, validate));
  assert.throws(() => v.save(empty()), /Another tab/);
  assert.deepEqual(decode(store.raw, APP, validate), example());
  assert.equal(v.locked, true);
});
test("storage read failure cannot silently reset or export an empty backup", () => {
  const v = createVault(
    {
      getItem() {
        throw new Error("blocked");
      },
      setItem() {
        throw new Error("must not write");
      },
    },
    "key",
    APP,
    validate,
    empty,
  );
  assert.equal(v.locked, true);
  assert.throws(() => v.save(example()));
  assert.throws(() => v.export());
});
test("caller mutations never alter the saved in-memory baseline", () => {
  const store = storage(),
    v = createVault(store, "key", APP, validate, empty);
  v.save(example());
  const outside = v.data;
  for (const values of Object.values(outside))
    if (Array.isArray(values)) values.length = 0;
  assert.deepEqual(v.data, example());
});

test("a known decoded snapshot can still be backed up after later storage read failure", () => {
  const store = storage(encode(example(), APP, validate)),
    v = createVault(store, "key", APP, validate, empty);
  store.getItem = () => {
    throw new Error("later blocked");
  };
  v.drift();
  assert.equal(v.locked, true);
  assert.deepEqual(decode(v.export(), APP, validate), example());
});
