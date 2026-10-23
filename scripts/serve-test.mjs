import { createStaticTestServer } from "./static-test-server.mjs";
const port = Number(process.argv[2]);
if (!Number.isInteger(port) || port < 1024 || port > 65535)
  throw new Error("Supply the configured local test port.");
const server = await createStaticTestServer([
  {
    root: process.cwd(),
    routes: [
      ["/", "index.html"],
      ["/index.html", "index.html"],
      ["/src/core.js", "src/core.js"],
      ["/src/app.js", "src/app.js"],
      ["/src/styles.css", "src/styles.css"],
      ["/src/ui.js", "src/ui.js"],
      ["/src/vault.js", "src/vault.js"],
      ["/src/photo.js", "src/photo.js"],
    ],
  },
]);
server.listen(port, "127.0.0.1");
