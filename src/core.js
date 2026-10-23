import { inspectPhoto } from "./photo.js";
export const APP = "pet-sitter-handoff";
export function object(value, keys) {
  if (
    !value ||
    typeof value !== "object" ||
    Array.isArray(value) ||
    Object.keys(value).some((k) => !keys.includes(k))
  )
    throw new Error("Unexpected record structure.");
}
export function text(value, label, max = 6000, required = false) {
  if (
    typeof value !== "string" ||
    value.length > max ||
    (required && !value.trim())
  )
    throw new Error(
      `${label} must be ${required ? "nonempty text" : "text"} up to ${max} characters.`,
    );
  return value;
}
export function photo(value) {
  inspectPhoto(value);
  return value;
}
export function profile(p) {
  object(p, [
    "id",
    "name",
    "species",
    "feeding",
    "walks",
    "supplies",
    "quirks",
    "contacts",
    "owner",
    "photo",
  ]);
  text(p.id, "Identifier", 80, true);
  text(p.name, "Pet name", 100, true);
  text(p.species, "Species", 100);
  for (const k of [
    "feeding",
    "walks",
    "supplies",
    "quirks",
    "contacts",
    "owner",
  ])
    text(p[k], k);
  photo(p.photo);
  return p;
}
export function validate(data) {
  object(data, ["pets"]);
  if (!Array.isArray(data.pets) || data.pets.length > 100)
    throw new Error("Keep up to 100 pet profiles per backup.");
  data.pets.forEach(profile);
  if (new Set(data.pets.map((p) => p.id)).size !== data.pets.length)
    throw new Error("Duplicate profile identifiers.");
  return data;
}
export function escape(value) {
  return String(value).replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[
        c
      ],
  );
}
export function sheet(pets) {
  pets.forEach(profile);
  return (
    '<!doctype html><html lang="en"><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Pet sitter handoff</title><style>*{box-sizing:border-box}h1,h2{overflow-wrap:anywhere}body{font:18px/1.5 system-ui;max-width:850px;margin:2rem auto;padding:1rem;color:#172c32}article{break-after:page}h1{font-size:2rem}h2{font-size:1.1rem;border-bottom:1px solid #aaa;margin-top:1.5rem}p{white-space:pre-wrap;overflow-wrap:anywhere}img{max-width:180px;max-height:180px;object-fit:contain}footer{font-size:.85rem;color:#455}@media print{body{margin:0}article:last-of-type{break-after:auto}}</style><body><h1>Pet sitter handoff</h1>' +
    pets
      .map(
        (p) =>
          "<article><h2>" +
          escape(p.name) +
          (p.species ? " · " + escape(p.species) : "") +
          "</h2>" +
          (p.photo
            ? '<img alt="' + escape(p.name) + '" src="' + p.photo + '">'
            : "") +
          [
            ["Owner & handoff notes", p.owner],
            ["Feeding", p.feeding],
            ["Walks & daily routine", p.walks],
            ["Supplies & locations", p.supplies],
            ["Quirks & handling notes", p.quirks],
            ["Emergency contacts & owner instructions", p.contacts],
          ]
            .map(
              ([k, v]) =>
                "<h2>" +
                k +
                "</h2><p>" +
                (v ? escape(v) : "Not supplied. Confirm with the owner.") +
                "</p>",
            )
            .join("") +
          "</article>",
      )
      .join("") +
    "<footer>Owner-supplied instructions. Confirm missing or unclear information with the owner. This sheet does not provide medical advice.</footer></body></html>"
  );
}
export const empty = () => ({ pets: [] });
export const example = () => ({
  pets: [
    {
      id: "example-pet",
      name: "Miso",
      species: "Dog",
      feeding:
        "Owner example: one measured scoop at 08:00 and 18:00. Scoop is inside the food tub.",
      walks: "Morning and evening walks. Harness hangs by the door.",
      supplies:
        "Food in the pantry. Lead, waste bags and towel by the front door.",
      quirks:
        "Wait at the door before opening it. Enjoys a quiet place to settle.",
      contacts:
        "Replace this example with the owner’s verified contacts before using the sheet.",
      owner: "Example profile only. Review every instruction with the owner.",
      photo: null,
    },
  ],
});
