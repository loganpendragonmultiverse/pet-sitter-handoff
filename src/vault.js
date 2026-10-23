export const MAX_BYTES = 12 * 1024 * 1024;
export function decode(raw, app, validate) {
  if (
    typeof raw !== "string" ||
    new TextEncoder().encode(raw).length > MAX_BYTES
  )
    throw new Error("Backup must be a JSON file smaller than 12 MB.");
  let value;
  try {
    value = JSON.parse(raw);
  } catch {
    throw new Error("This file is not valid JSON.");
  }
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !["app", "version", "data"].includes(k)) ||
    value.app !== app ||
    value.version !== 1
  )
    throw new Error(
      "This is not a supported backup for this tool (format version 1).",
    );
  validate(value.data);
  return structuredClone(value.data);
}
export function encode(data, app, validate) {
  validate(data);
  const raw = JSON.stringify({ app, version: 1, data }, null, 2);
  if (new TextEncoder().encode(raw).length > MAX_BYTES)
    throw new Error(
      "Your backup exceeds 12 MB. Remove some photos or split the collection.",
    );
  return raw;
}
export function createVault(storage, key, app, validate, empty) {
  let baseline = null,
    data = empty(),
    problem = "",
    corrupt = false,
    unavailable = false,
    stale = false,
    known = false;
  try {
    baseline = storage.getItem(key);
    if (baseline !== null) data = decode(baseline, app, validate);
    known = true;
  } catch (e) {
    problem = `Saved data could not be opened: ${e.message} Original stored bytes have not been changed.`;
    corrupt = baseline !== null;
    unavailable = !corrupt;
  }
  return {
    get data() {
      return structuredClone(data);
    },
    get raw() {
      return baseline;
    },
    get problem() {
      return problem;
    },
    get locked() {
      return corrupt || unavailable || stale;
    },
    get corrupt() {
      return corrupt;
    },
    export() {
      if (corrupt || !known)
        throw new Error(
          "Export the original recovery bytes instead. A normal backup cannot be made from unreadable storage.",
        );
      return encode(data, app, validate);
    },
    drift() {
      try {
        if (storage.getItem(key) !== baseline) {
          stale = true;
          problem =
            "Saved data changed in another tab. Copy any unsaved form text and keep original selected photos before reloading. You may export the saved copy; backups do not include unsaved editor changes.";
        }
      } catch {
        unavailable = true;
        problem =
          "Browser storage is unavailable. Keep this tab open and export a backup if possible.";
      }
      return problem;
    },
    save(next, { recovery = false } = {}) {
      if (unavailable || stale || (corrupt && !recovery))
        throw new Error(problem || "Reload before saving.");
      const raw = encode(next, app, validate);
      let current;
      try {
        current = storage.getItem(key);
      } catch {
        unavailable = true;
        throw new Error("Browser storage cannot be read. No data was changed.");
      }
      if (current !== baseline) {
        stale = true;
        problem =
          "Another tab changed saved data. Your changes were not saved. Copy any unsaved form text and keep original selected photos before reloading. A backup contains saved records only.";
        throw new Error(problem);
      }
      try {
        storage.setItem(key, raw);
      } catch {
        throw new Error(
          "Browser storage rejected the save, often because it is full or blocked. Your previous saved data is unchanged. Export a backup and reduce photos or use a browser that allows storage.",
        );
      }
      baseline = raw;
      data = structuredClone(next);
      corrupt = false;
      known = true;
      problem = "";
      return this.data;
    },
  };
}
