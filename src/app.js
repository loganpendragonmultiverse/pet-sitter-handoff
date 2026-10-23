import { validate, sheet } from "./core.js";
import {
  $,
  el,
  button,
  field,
  message,
  uid,
  clone,
  vault,
  save,
  setup,
  markDirty,
  leaveDraft,
  dirty,
  readPhoto,
  download,
} from "./ui.js";
let selected = null,
  draft = null,
  inputs = {},
  lastDelete = null,
  query = "",
  editorRevision = 0,
  pendingPhotos = new Map();
const labels = {
  owner: "Owner & handoff notes",
  feeding: "Feeding instructions",
  walks: "Walks & daily routine",
  supplies: "Supplies & locations",
  quirks: "Quirks & handling notes",
  contacts: "Emergency contacts & owner instructions",
};
function refresh() {
  if (!vault.data.pets.some((p) => p.id === selected))
    selected = vault.data.pets[0]?.id || null;
  draft = clone(vault.data.pets.find((p) => p.id === selected) || null);
  renderNav();
  renderEditor();
  renderSheets();
}
function renderNav() {
  const host = $("records");
  host.replaceChildren();
  for (const p of vault.data.pets.filter((p) =>
    `${p.name} ${p.species}`.toLowerCase().includes(query),
  )) {
    const b = button(
      p.name,
      () => {
        if (!leaveDraft()) return;
        selected = p.id;
        markDirty(false);
        refresh();
      },
      selected === p.id ? "secondary selected" : "secondary",
    );
    if (p.species) b.append(el("small", p.species));
    host.append(b);
  }
  if (!host.children.length)
    host.append(
      el(
        "p",
        query
          ? "No profiles match your search."
          : "No profiles saved. Add a pet or explore the example.",
        "hint",
      ),
    );
}
function capture() {
  if (!draft) return;
  for (const [key, input] of Object.entries(inputs)) draft[key] = input.value;
}
function newProfile() {
  if (!leaveDraft()) return;
  selected = null;
  draft = {
    id: uid(),
    name: "",
    species: "",
    owner: "",
    feeding: "",
    walks: "",
    supplies: "",
    quirks: "",
    contacts: "",
    photo: null,
  };
  markDirty();
  renderNav();
  renderEditor();
  renderSheets();
  inputs.name.focus();
}
function renderEditor() {
  const revision = ++editorRevision;
  pendingPhotos.clear();
  const host = $("editor");
  host.replaceChildren();
  if (!draft) {
    host.append(
      el(
        "div",
        "Create a profile for each pet, then print a clear handoff sheet.",
        "empty",
      ),
    );
    return;
  }
  const heading = el("div", undefined, "section-title");
  heading.append(el("h2", selected ? "Edit pet profile" : "New pet profile"));
  host.append(heading);
  const form = el("form");
  inputs = {};
  const names = el("div", undefined, "fields");
  for (const [key, label] of [
    ["name", "Pet name"],
    ["species", "Species / description"],
  ]) {
    const f = field(label, {
      value: draft[key],
      max: 100,
      required: key === "name",
    });
    inputs[key] = f.input;
    names.append(f.wrap);
  }
  form.append(names);
  const photoRow = el("div", undefined, "actions");
  const photoHost = el("div");
  const showPhoto = () => {
    photoHost.replaceChildren();
    if (draft.photo) {
      const img = el("img", undefined, "profile-photo");
      img.src = draft.photo;
      img.alt = draft.name || "Pet reference photo";
      photoHost.append(img);
    }
  };
  showPhoto();
  const file = field("Reference photo (PNG, JPEG or WebP, under 1.4 MB)", {
    type: "file",
  });
  file.input.accept = "image/png,image/jpeg,image/webp";
  let photoEpoch = 0;
  file.input.onchange = async () => {
    const epoch = ++photoEpoch;
    pendingPhotos.set("profile", epoch);
    try {
      const chosen = file.input.files[0];
      if (!chosen) return;
      const photo = await readPhoto(chosen);
      if (revision !== editorRevision || epoch !== photoEpoch) return;
      capture();
      draft.photo = photo;
      showPhoto();
      markDirty();
    } catch (e) {
      if (revision === editorRevision && epoch === photoEpoch)
        message(e.message, true);
    } finally {
      if (revision === editorRevision && epoch === photoEpoch) {
        pendingPhotos.delete("profile");
        file.input.value = "";
      }
    }
  };
  photoRow.append(
    photoHost,
    file.wrap,
    button("Remove photo", () => {
      photoEpoch++;
      pendingPhotos.delete("profile");
      file.input.value = "";
      draft.photo = null;
      showPhoto();
      markDirty();
    }),
  );
  form.append(photoRow);
  for (const [key, label] of Object.entries(labels)) {
    const f = field(label, { value: draft[key], multiline: true, max: 6000 });
    inputs[key] = f.input;
    form.append(f.wrap);
  }
  form.append(
    el(
      "p",
      "Only record instructions the owner supplied. Confirm emergency contacts and unclear details before handoff. This tool does not provide medical advice or send information to a sitter.",
      "hint",
    ),
  );
  const actions = el("div", undefined, "actions");
  const submit = el("button", "Save profile");
  submit.type = "submit";
  actions.append(
    submit,
    button("Discard draft changes", () => {
      if (!leaveDraft()) return;
      markDirty(false);
      refresh();
    }),
  );
  if (selected)
    actions.append(
      button(
        "Delete profile",
        () => {
          if (
            !confirm(
              "Delete this saved profile? Undo is available until another save, restore or reload.",
            )
          )
            return;
          const before = vault.data,
            next = vault.data;
          next.pets = next.pets.filter((p) => p.id !== selected);
          save(next);
          lastDelete = { data: before, basis: vault.raw };
          $("undo").hidden = false;
          selected = null;
          refresh();
        },
        "danger",
      ),
    );
  form.append(actions);
  form.oninput = () => markDirty();
  form.onsubmit = (e) => {
    e.preventDefault();
    try {
      if (pendingPhotos.size)
        throw new Error(
          "Wait for the selected photo to finish preparing before saving.",
        );
      capture();
      const next = vault.data,
        index = next.pets.findIndex((p) => p.id === draft.id);
      if (index < 0) next.pets.push(clone(draft));
      else next.pets[index] = clone(draft);
      validate(next);
      save(next);
      selected = draft.id;
      refresh();
    } catch (e) {
      message(e.message, true);
    }
  };
  host.append(form);
}
function profileCard(p) {
  const article = el("article", undefined, "profile-card");
  article.append(el("h2", `${p.name}${p.species ? ` · ${p.species}` : ""}`));
  if (p.photo) {
    const image = el("img", undefined, "profile-photo");
    image.src = p.photo;
    image.alt = `Reference photo of ${p.name}`;
    article.append(image);
  }
  for (const [key, label] of Object.entries(labels))
    article.append(
      el("h3", label),
      el("p", p[key] || "Not supplied. Confirm with the owner."),
    );
  return article;
}
function renderSheets() {
  const preview = $("preview");
  preview.replaceChildren();
  const print = $("print-sheet");
  print.replaceChildren(el("h1", "Pet sitter handoff"));
  const selectedPet = vault.data.pets.find((p) => p.id === selected);
  if (selectedPet)
    preview.append(
      el(
        "p",
        "Preview of the saved profile. Save editor changes to update it.",
        "hint",
      ),
      profileCard(selectedPet),
    );
  const pets =
    $("print-scope").value === "selected"
      ? selectedPet
        ? [selectedPet]
        : []
      : vault.data.pets;
  for (const pet of pets) print.append(profileCard(pet));
  if (!pets.length) print.append(el("p", "No saved pet profiles selected."));
  print.append(
    el(
      "p",
      "Owner-supplied instructions. Confirm missing or unclear information with the owner. This sheet does not provide medical advice.",
    ),
  );
}
$("new").onclick = newProfile;
$("search").oninput = (e) => {
  query = e.target.value.toLowerCase();
  renderNav();
};
$("print-scope").onchange = renderSheets;
$("export-sheet").onclick = () => {
  try {
    if (dirty)
      throw new Error(
        "Save or discard editor changes before exporting a sheet.",
      );
    if (vault.locked) throw new Error(vault.problem);
    const pets =
      $("print-scope").value === "selected"
        ? vault.data.pets.filter((p) => p.id === selected)
        : vault.data.pets;
    if (!pets.length) throw new Error("Save a pet profile before exporting.");
    download("pet-sitter-handoff.html", sheet(pets), "text/html");
    message(
      "Sheet downloaded. Review it before sharing it yourself. It includes private owner-supplied details.",
    );
  } catch (e) {
    message(e.message, true);
  }
};
$("undo").onclick = () => {
  try {
    if (!lastDelete || !leaveDraft()) return;
    if (vault.raw !== lastDelete.basis) {
      lastDelete = null;
      $("undo").hidden = true;
      throw new Error(
        "Undo is no longer available after another save or restore. Your newer saved data has been kept.",
      );
    }
    save(lastDelete.data);
    lastDelete = null;
    $("undo").hidden = true;
    refresh();
  } catch (e) {
    message(e.message, true);
  }
};
setup(refresh, (data) => `${data.pets.length} records`);
