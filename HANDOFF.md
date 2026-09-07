# HANDOFF

OmniOutliner 6.2.1 clone (omniliner). Stack matches omniplanner: TypeScript core → Express :4466 → Vite/React → Electron.

## In this pass

- Document model: rows, columns (7 types + summaries), notes, status (incl. calculated), named/structural styles, numbering, saved filters, themes/templates.
- Outline ops: add/delete/duplicate, indent/outdent, move, group/ungroup, expand/collapse, focus, keep-sorted vs destructive sort, find/replace.
- Import/export: OPML, CSV, HTML, Dynamic HTML, TXT, TaskPaper, Markdown, JSON.
- URL schemes `omnioutliner` / `omniliner`: open, add, paste, x-callback-url/add, document.
- Bridges: OmniClone add/paste, Notebook REST + `notebook://`, OmniPlan tell/receive.
- UI: macOS chrome, menus from OO 5/6 Pro, sidebar (Sections/Styles/Filters), inspectors, notes pane, resource browser.

## Next gaps vs real OmniOutliner Pro

- True rich-text runs inside a cell (we store a topic string + whole-row named styles).
- Encrypted documents, iCloud, multiple windows on one file.
- AppleScript / full Omni Automation JS console.
- PowerPoint/Word/Excel export, RTF/RTFD.
- Live audio recording UI (attachment model is ready).
- Wire Share into Notebook and OmniClone apps using `docs/INTEGRATION.md`.

## Tests

`npm test` — outline ops, OPML/TaskPaper, URL + OmniClone/Notebook builders, filters, numbering, automation tell.
