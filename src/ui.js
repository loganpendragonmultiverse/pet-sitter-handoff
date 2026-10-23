import { APP, validate, empty, example } from "./core.js";
import { createVault, decode } from "./vault.js";
export const $ = (id) => document.getElementById(id);
export function el(tag, text, cls) {
  const n = document.createElement(tag);
  if (text !== undefined) n.textContent = text;
  if (cls) n.className = cls;
  return n;
}
export function button(label, action, cls = "secondary") {
  const b = el("button", label, cls);
  b.type = "button";
  b.addEventListener("click", () => {
    try {
      action();
    } catch (e) {
      message(e.message, true);
    }
  });
  return b;
}
export function field(
  label,
  {
    type = "text",
    value = "",
    max = 4000,
    min,
    step,
    required = false,
    multiline = false,
    options,
  } = {},
) {
  const wrap = el("label", undefined, "field");
  wrap.append(el("span", label));
  const n = el(options ? "select" : multiline ? "textarea" : "input");
  if (options) {
    for (const [v, t] of options) {
      const o = el("option", t);
      o.value = v;
      n.append(o);
    }
  } else {
    if (!multiline) n.type = type;
    n.maxLength = max;
    if (min !== undefined) n.min = min;
    if (step !== undefined) n.step = step;
  }
  n.value = value;
  n.required = required;
  wrap.append(n);
  return { wrap, input: n };
}
export function message(text, error = false) {
  const box = $("message");
  box.textContent = text;
  box.className = error ? "notice error" : "notice success";
  box.hidden = !text;
  if (error) {
    box.tabIndex = -1;
    box.focus();
  }
}
export function download(name, content, type = "application/json") {
  const blob = new Blob([content], { type }),
    url = URL.createObjectURL(blob),
    a = el("a");
  a.href = url;
  a.download = name;
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 30000);
}
export const uid = () =>
  globalThis.crypto?.randomUUID?.() ||
  `${Date.now()}-${Math.random().toString(36).slice(2)}`;
export const clone = (value) => structuredClone(value);
export let dirty = false;
export function markDirty(value = true) {
  dirty = value;
  $("unsaved").textContent = value ? "Unsaved changes" : "Saved locally";
}
export function leaveDraft() {
  return !dirty || confirm("Discard unsaved changes in this editor?");
}
export const vault = createVault(
  {
    getItem: (k) => localStorage.getItem(k),
    setItem: (k, v) => localStorage.setItem(k, v),
  },
  `${APP}:v1`,
  APP,
  validate,
  empty,
);
export function save(next) {
  vault.save(next);
  markDirty(false);
  message("Saved in this browser. Download a backup to keep another copy.");
}
export async function readPhoto(file) {
  if (!file) return null;
  if (
    !["image/png", "image/jpeg", "image/webp"].includes(file.type) ||
    file.size > 1400000
  )
    throw new Error("Choose a PNG, JPEG or WebP photo smaller than 1.4 MB.");
  const data = await new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onload = () => resolve(r.result);
    r.onerror = () => reject(new Error("The photo could not be read."));
    r.readAsDataURL(file);
  });
  return await new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => {
      try {
        if (image.naturalWidth * image.naturalHeight > 24000000)
          throw new Error(
            "Photo is too large to preview. Use an image under 24 megapixels.",
          );
        const scale = Math.min(
            1,
            1200 / image.naturalWidth,
            1200 / image.naturalHeight,
          ),
          canvas = document.createElement("canvas");
        canvas.width = Math.max(1, Math.round(image.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(image.naturalHeight * scale));
        const context = canvas.getContext("2d");
        if (!context) throw new Error("This browser cannot prepare the photo.");
        context.fillStyle = "#ffffff";
        context.fillRect(0, 0, canvas.width, canvas.height);
        context.drawImage(image, 0, 0, canvas.width, canvas.height);
        const result = canvas.toDataURL("image/jpeg", 0.85);
        if (result.length > 1800000)
          throw new Error(
            "Prepared photo is still too large. Choose a smaller image.",
          );
        resolve(result);
      } catch (e) {
        reject(e);
      }
    };
    image.onerror = () =>
      reject(new Error("The file is not a readable image."));
    image.src = data;
  });
}
export function setup(refresh, count) {
  let importTicket = 0;
  if (vault.problem) message(vault.problem, true);
  $("backup").onclick = () => {
    try {
      download(`${APP}-backup.json`, vault.export());
      message(
        "Backup downloaded. It contains saved records only, including any photos and private notes.",
      );
    } catch (e) {
      message(e.message, true);
    }
  };
  $("recover").hidden = !vault.corrupt;
  $("recover").onclick = () =>
    download(`${APP}-recovery.txt`, vault.raw, "text/plain");
  $("import").onchange = async (e) => {
    const ticket = ++importTicket,
      file = e.target.files[0];
    e.target.value = "";
    if (!file) return;
    try {
      if (file.size > 12 * 1024 * 1024)
        throw new Error("Backup must be smaller than 12 MB.");
      const raw = await file.text();
      if (ticket !== importTicket) return;
      const pending = decode(raw, APP, validate);
      const dialog = $("import-dialog");
      $("import-summary").textContent =
        `This backup contains ${count(pending)}. Applying it replaces all saved records in this browser. Your current saved copy contains ${count(vault.data)}. Download a backup first if you need both copies.`;
      $("replace-confirm").checked = false;
      $("import-error").hidden = true;
      if (!dialog.open) dialog.showModal();
      $("apply-import").onclick = () => {
        try {
          if (ticket !== importTicket) return;
          if (!$("replace-confirm").checked)
            throw new Error("Confirm replacement before applying this backup.");
          if (
            dirty &&
            !confirm(
              "Applying this backup discards unsaved editor changes. Continue?",
            )
          )
            return;
          vault.save(pending, { recovery: vault.corrupt });
          dialog.close();
          markDirty(false);
          $("recover").hidden = true;
          refresh();
          message(
            "Backup restored. Review your records and keep a separate backup.",
          );
        } catch (error) {
          $("import-error").textContent = error.message;
          $("import-error").hidden = false;
        }
      };
    } catch (error) {
      if (ticket === importTicket) message(error.message, true);
    }
  };
  $("cancel-import").onclick = () => {
    importTicket++;
    $("import-dialog").close();
  };
  $("import-dialog").addEventListener("cancel", () => {
    importTicket++;
  });
  $("example").onclick = () => {
    try {
      if (!leaveDraft()) return;
      if (
        count(vault.data) !== "0 records" &&
        !confirm(
          "Replace saved records with the example? Download a backup first if you need them.",
        )
      )
        return;
      save(example());
      refresh();
      message(
        "Example loaded. Replace the sample information before using it.",
      );
    } catch (e) {
      message(e.message, true);
    }
  };
  $("print").onclick = () => {
    if (dirty) {
      message(
        "Save your changes before printing. Print uses saved records.",
        true,
      );
      return;
    }
    if (vault.locked) {
      message(
        "Resolve the storage problem before printing saved records.",
        true,
      );
      return;
    }
    window.print();
  };
  addEventListener("storage", (e) => {
    if (e.key === `${APP}:v1` || e.key === null) {
      vault.drift();
      if (vault.problem) message(vault.problem, true);
    }
  });
  addEventListener("beforeunload", (e) => {
    if (dirty) {
      e.preventDefault();
      e.returnValue = "";
    }
  });
  refresh();
}
