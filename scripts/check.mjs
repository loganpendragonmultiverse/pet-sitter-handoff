import { readdir, readFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";
for (const dir of ["src", "scripts", "test"])
  for (const file of await readdir(dir)) {
    if (!/\.(js|mjs)$/.test(file)) continue;
    const path = `${dir}/${file}`,
      r = spawnSync(process.execPath, ["--check", path], { stdio: "inherit" });
    if (r.status !== 0) process.exit(r.status || 1);
    if (dir === "src") {
      const source = await readFile(path, "utf8");
      if (/\b(?:eval|fetch|XMLHttpRequest)\s*\(|\.innerHTML\s*=/.test(source))
        throw new Error(`Unexpected executable HTML or network API: ${path}`);
    }
  }
console.log("JavaScript syntax and runtime network/HTML checks passed.");
