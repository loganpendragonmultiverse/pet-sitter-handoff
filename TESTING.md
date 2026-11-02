# Testing Pet sitter handoff

## Commands

```sh
npm ci
npm test
npm run check
npm run build
npx playwright install chromium firefox webkit
npm run test:browser
```

Node tests exercise the domain boundaries and strict schemas, backup round trips, corrupt-byte preservation and explicit recovery, quota failures, stale-tab refusal, blocked storage and isolation of returned state. `check` parses every JavaScript source/test/script and rejects unexpected runtime network APIs or executable HTML insertion. It is not a security certification.

Browser tests are in `browser-tests/flows.spec.mjs`, using Playwright. The config starts `node scripts/serve-test.mjs 4286`, a fixed-route local HTTP server at `127.0.0.1:4286` and runs Chromium, Firefox and WebKit. They exercise saved editor changes/reload, import preview/cancel/explicit recovery, quota and stale-tab errors, narrow overflow and print visibility, plus the tool-specific workflow. Use `--project=chromium` for a focused rerun.

The directly opened release entry point is `dist/site/index.html`; verify the actual ZIP by extraction, open its `index.html` as a file URL while offline, and repeat the main workflow. A local HTTP flow alone does not establish file-protocol acceptance. Browser storage availability depends on browser policy. For print QA, inspect a browser-generated PDF or print preview, including multiple profiles/long notes and quantity rows. Review screenshots at desktop and narrow widths for visual defects.

## Results

The implementation agent ran the meaningful domain/persistence tests and syntax checks successfully on Windows Node.js. Browser and final artifact results are recorded in the batch manifest after verification; passing unit checks alone do not establish Gold or release completion.

The test server preloads only the listed application assets before accepting requests. Unknown paths and traversal attempts receive 404; request URLs are never filesystem paths. `npm test` includes synthetic static-server traversal and symlink-containment regressions.
