# Integrating OmniLiner with Notebook and OmniClone

OmniLiner (this repo) already **sends** and **receives** using the contracts those apps speak. This file is the drop-in work for `hollywoodj/notebook` and `hollywoodj/omniclone` so Share menus round-trip.

## What OmniLiner already does

| Direction | Mechanism |
|---|---|
| Notebook → OmniLiner | `omnioutliner:///add?name=&note=notebook://note/{id}` or `/paste` TaskPaper |
| OmniLiner → Notebook | `POST {NOTEBOOK_URL}/api/v1/notes` plus `notebook://note/{id}` |
| OmniClone → OmniLiner | `omnioutliner:///add` / `/paste` (same shapes OmniClone already accepts) |
| OmniLiner → OmniClone | `omniclone:///add` and `omniclone:///paste?target=inbox&content=` TaskPaper, including `omnioutliner:///open?row=` in the note |

URL parser: `src/core/urls.ts`. OmniClone builders: `src/core/integration.ts` (same query encoding as Notebook’s `omniFocus.ts`).

## Notebook (`apps/desktop`)

### 1. Allow the scheme in Electron

In `electron/main.cjs` `isAllowedExternalUrl`:

```js
return /^(https?:|mailto:|omniclone:|omnifocus:|notebook:|omnioutliner:|omniliner:)/i.test(String(url || ""));
```

### 2. Share → Send to OmniOutliner

Mirror `sendToOmniClone` with scheme `omnioutliner`:

```ts
import { buildOmniFocusAddUrl, buildOmniFocusPasteUrl, omniFocusNoteField } from "./omniFocus.ts";
import { noteAppLink } from "./uiChrome.ts";

export function sendUrlsForOutline(note: { id: string; title: string; content: string }) {
  const link = noteAppLink(note.id);
  return [
    buildOmniFocusAddUrl("omnioutliner", {
      name: note.title || "Untitled",
      note: omniFocusNoteField(link, /* snippet */ undefined),
      autosave: true,
      xSuccess: link,
    }),
  ];
}
```

Checklists can keep using `buildOmniFocusPasteUrl("omnioutliner", taskPaper)` — OmniLiner’s `/paste` handler imports TaskPaper into the current document.

### 3. Preferences

Add `omnioutliner_enabled` next to `omniclone_enabled`, default true. Menu: **Note → Share → Send to OmniOutliner**.

## OmniClone

OmniClone already handles inbound `omniclone:///add` and `/paste`. No parser changes are required to **receive** from OmniLiner.

To **send a task back** to the outline (Organize in OmniClone / share on a task):

```ts
const url =
  `omnioutliner:///add?name=${encodeURIComponent(task.title)}` +
  `&note=${encodeURIComponent(task.note || `omniclone:///task/${task.id}`)}` +
  `&autosave=true`;
```

If the task note already contains `omnioutliner:///open?row=…`, open that URL instead of creating a duplicate row.

Allow `omnioutliner:` / `omniliner:` in Electron `openExternal` the same way `notebook:` is allowed if present.

## OmniPlan clone

OmniPlanner already stubs `OMNIOUTLINER_URL` and `omnioutliner` in `src/core/bridge.ts`. Point it at `http://127.0.0.1:4466` and POST:

```http
POST /automation/tell
{ "functionName": "copyFromOmniPlan", "argument": [ { "OPtaskTitle": "…", "OPtaskNote": "omniplan:///task/12" } ] }
```

Or `POST /bridge/omniplan/receive` with the same payload.

## TaskPaper dialect (shared with OmniClone)

```
Launch:
	- Write copy @due(Today) @done
		Note line
		- Nested child
```
