# OmniOutliner

An OmniOutliner 6 Pro clone: hierarchical outlines, columns, notes, named styles, saved filters, inspectors, OPML/TaskPaper, and the same URL-scheme / Omni Automation contracts used by Notebook and OmniClone.

This is not affiliated with The Omni Group. UI, menus, inspectors, and file formats follow [OmniOutliner 6.2.1](https://www.omnigroup.com/omnioutliner) so the other apps in this suite can plug in without a custom mapping layer.

## Run

```bash
npm install
npm run dev          # API :4466  ·  UI :5174 (proxied)
npm test
npx tsx src/cli/index.ts --help
```

Production-style: `npm run build && PORT=4466 npm start` (serves `web/dist` from the API).

## Desktop app (Electron)

```bash
npm run build:electron:linux   # AppImage + .deb
npm run build:electron:mac     # .dmg + .zip
npm run build:electron:win     # NSIS .exe
```

User documents live in Electron `userData` (`~/.config/OmniOutliner/data/` on Linux).

Development without packaging:

```bash
npm run dev:api
npm run electron
```

## OmniOutliner feature map

| Feature | Where |
|---|---|
| Unlimited outline hierarchy, expand/collapse | Organize / View / row handles |
| Status checkboxes (checked / unchecked / calculated / none) | Edit → Set Status, Document Inspector |
| Row notes (inline or pane), notes column | View → Notes, ⌘' |
| Columns: rich text, text, number, duration, date, checkbox, pop-up | Organize → Add Column, Column Type Inspector |
| Column summaries (total / average / min / max) | Column Type Inspector |
| Structural + named styles, row numbering | Format, Styles sidebar, Selection Inspector |
| Section list + Focus | Sidebar → Sections, ⇧⌘F |
| Keyword filter + saved filters | Toolbar search, Sidebar → Filters |
| Find / replace (batch) | Edit → Find… (⌘F) |
| Folded editing / typewriter / distraction-free | View menu |
| Templates & themes | File → Resource Browser, Format → Apply Template Theme |
| OPML, CSV, HTML, Dynamic HTML, TXT, TaskPaper, Markdown, JSON | File → Export / Open |
| Omni Links | Edit → Copy as Link (`omnioutliner:///open?row=…`) |
| Audio attachments | Row attachments (file/audio data URLs) |
| Keyboard shortcuts matching OO 5/6 Pro | See menus; Tab indents, Return adds a row |
| Omni Automation `tellFunction` | `POST /automation/tell` |

## Notebook + OmniClone integration

OmniLiner speaks the same URL contracts those apps already use.

```
omnioutliner:///open?row={id}
omnioutliner:///document/{id}
omnioutliner:///add?name=…&note=…&autosave=true
omnioutliner:///paste?content=TASKPAPER
omnioutliner:///x-callback-url/add?…&x-success=notebook://note/{id}

omniclone:///add?name=…&note=omnioutliner:///open?row=…&autosave=true
omniclone:///paste?target=inbox&content=- Parent%0A%09- Child

notebook://note/{uuid}
POST http://127.0.0.1:8799/api/v1/notes
```

From the app: **Organize → Send to OmniClone** / **Send to Notebook**. Settings store the Notebook API URL and OmniClone scheme (`omniclone` / `omnifocus` / both).

Drop-in snippets for the other repos: [`docs/INTEGRATION.md`](docs/INTEGRATION.md).

## CLI

```bash
npx tsx src/cli/index.ts docs
npx tsx src/cli/index.ts new "Weekly review" --template launch
npx tsx src/cli/index.ts rows
npx tsx src/cli/index.ts add "Call Jordan" --note "notebook://note/…"
npx tsx src/cli/index.ts export -f opml
npx tsx src/cli/index.ts send-omniclone
npx tsx src/cli/index.ts url 'omnioutliner:///add?name=Milk'
```

## HTTP API

Base URL: `http://127.0.0.1:4466` (`PORT` / `OMNILINER_DATA`).

| Method | Path | Purpose |
|---|---|---|
| GET | `/api/health` | Version |
| GET | `/api/state` | Documents, prefs, templates |
| GET/POST | `/api/documents` | List / create |
| GET/PUT/PATCH/DELETE | `/api/documents/:id` | Document |
| POST | `/api/documents/:id/rows` | Add row |
| POST | `/api/documents/:id/command` | indent, outdent, group, sort, status, theme… |
| GET | `/api/documents/:id/export/{opml,csv,html,dhtml,txt,taskpaper,markdown,json}` | Export |
| POST | `/api/import` | OPML / TaskPaper / text / CSV |
| GET | `/api/open?url=omnioutliner:///open?row=…` | Resolve URL scheme |
| POST | `/automation/tell` | Omni Automation analogue |
| POST | `/bridge/omniclone/send` | TaskPaper + `omniclone:///…` URLs |
| POST | `/bridge/notebook/send` | Create a note via Notebook REST |
| POST | `/bridge/omniplan/receive` | Ingest OmniPlan task payloads |

## Architecture

```
src/core     document model, outline ops, import/export, URL/automation
src/server   Express API (same store as CLI)
src/cli      omniliner CLI
web/         React UI (OmniOutliner 6 Mac chrome)
electron/    desktop shell, omnioutliner:// + omniliner:// protocols
```
