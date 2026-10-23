import { readFile, writeFile, mkdir, cp, rm, readdir } from "node:fs/promises";
import { existsSync } from "node:fs";
import { join } from "node:path";
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
const pkg = JSON.parse(await readFile("package.json", "utf8"));
const files = ["photo.js", "core.js", "vault.js", "ui.js", "app.js"].filter(
  (f) => existsSync(`src/${f}`),
);
let source = "";
for (const f of files) {
  source +=
    (await readFile(`src/${f}`, "utf8"))
      .replace(/^import\b[\s\S]*?;\s*(?=\r?\n|$)/gm, "")
      .replace(/^export\s+(?=(?:const|let|var|function|class)\b)/gm, "") + "\n";
}
let html = await readFile("index.html", "utf8");
const css = await readFile("src/styles.css", "utf8");
html = html.replace(
  /<link\b(?=[^>]*\brel=["']stylesheet["'])(?=[^>]*\bhref=["']src\/styles\.css["'])[^>]*>/i,
  () => `<style>${css}</style>`,
);
html = html.replace(
  /<script\b(?=[^>]*\bsrc=["']src\/app\.js["'])[^>]*>\s*<\/script>/i,
  () =>
    `<script type="module">${source.replace(/<\/script/gi, () => "<\\/script")}</script>`,
);
if (/\b(?:src|href)=["']src\//.test(html) || /^import\b/m.test(source))
  throw new Error("Offline bundling left an external module or stylesheet.");
await mkdir("dist/site", { recursive: true });
await writeFile("dist/site/index.html", html);
const stage = `dist/${pkg.name}-${pkg.version}`;
await rm(stage, { recursive: true, force: true });
await mkdir(stage, { recursive: true });
await writeFile(join(stage, "index.html"), html);
for (const f of [
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "DEVELOPMENT.md",
  "TESTING.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "SUPPORT.md",
  "CODE_OF_CONDUCT.md",
])
  if (existsSync(f)) await cp(f, join(stage, f), { recursive: true });
await mkdir(join(stage, "source"), { recursive: true });
for (const f of [
  "index.html",
  "README.md",
  "LICENSE",
  "CHANGELOG.md",
  "DEVELOPMENT.md",
  "TESTING.md",
  "SECURITY.md",
  "CONTRIBUTING.md",
  "SUPPORT.md",
  "CODE_OF_CONDUCT.md",
  "package.json",
  "package-lock.json",
  "src",
  "test",
  "scripts",
  "examples",
  "browser-tests",
  "playwright.config.mjs",
  ".github",
  ".gitignore",
])
  if (existsSync(f)) await cp(f, join(stage, "source", f), { recursive: true });
const zip = `dist/${pkg.name}-${pkg.version}.zip`;
const code =
  "from pathlib import Path; import sys,zipfile; root=Path(sys.argv[1]); out=zipfile.ZipFile(sys.argv[2],'w',zipfile.ZIP_DEFLATED); [(lambda p: out.writestr(zipfile.ZipInfo(p.relative_to(root).as_posix(),date_time=(2026,1,1,0,0,0)),p.read_bytes(),compress_type=zipfile.ZIP_DEFLATED))(p) for p in sorted(root.rglob('*')) if p.is_file()]; out.close()";
const result = spawnSync(
  process.platform === "win32" ? "python" : "python3",
  ["-c", code, stage, zip],
  { stdio: "inherit" },
);
if (result.status !== 0)
  throw new Error("ZIP packaging failed. Python 3 is required.");
const digest = createHash("sha256")
  .update(await readFile(zip))
  .digest("hex");
await writeFile(
  "dist/SHA256SUMS",
  `${digest}  ${pkg.name}-${pkg.version}.zip\n`,
);
console.log(`Built ${zip}\n${digest}`);
