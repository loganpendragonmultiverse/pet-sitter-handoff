# Development and completion acceptance

Keep owner-supplied feeding, routine, supplies, quirks and emergency contacts in separate pet profiles. Produce a readable handoff sheet without creating an account or transmitting it to a sitter.

## Bounded version 1 scope

Save multiple separate profiles; retain owner-supplied text literally; prepare/remove photos; print selected/all profiles; export a self-contained escaped HTML sheet; show missing instructions clearly. No medical advice or transmission is included.

- Instructions must come from the owner. The tool does not provide medical advice, create care recommendations, verify contacts or contact anyone.
- Blank sections are marked “Not supplied. Confirm with the owner.” A filled-in form is not a safety certification.
- Exported HTML and backups include private contact details and photos. Review them and choose how to share them yourself.
- Up to 100 profiles per backup. Photo picker accepts PNG/JPEG/WebP under 1.4 MB, decodes the image locally and re-encodes a white-background JPEG at up to 1200 pixels per side. Transparency is flattened.
- Imported photos must have supported raster signatures, bounded size and dimensions at most 1600 pixels per side. SVG and other attachment formats are refused.

## Architecture

Dependency-free ES modules separate pure input/domain logic (`core.js`), guarded persistence and versioned backups (`vault.js`), DOM helpers (`ui.js`) and the project-specific interface (`app.js`). User text reaches text nodes. The pet/kit raster validator checks allowed signatures, lengths and dimensions before an imported backup can replace data; the photo picker decodes/resizes/re-encodes locally. Print output is generated from saved records.

## Required completion evidence

Meaningful domain and persistence tests, syntax/network checks, all three browser engines at desktop/narrow widths, keyboard-accessible controls, source and directly opened exact ZIP entry point, actual print output, import cancel/confirm, corrupt storage recovery, stale writes, quota failures, deletion/reset undo and async input races must be reviewed. Independent review must leave no identified meaningful remaining contribution inside the intended scope. Publication still requires repository/CI/CodeQL settings, immutable tag, exact tag-built artifact digests and the coordinated Forge/catalog/owner reconciliation. No Gold status is assigned in this candidate.
