import express from "express";
import cors from "cors";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import {
  APP_NAME,
  APP_VERSION,
  addRow,
  applyNamedStyle,
  applyTell,
  applyTheme,
  clearLocalStyle,
  collapseAll,
  createDocument,
  cycleStatus,
  deleteDocument,
  deleteRows,
  detectImport,
  documentSummary,
  duplicateRows,
  expandAll,
  exportDocument,
  findHits,
  flatten,
  fromOpml,
  fromTaskPaper,
  getDocument,
  groupRows,
  indentRows,
  keywordMatches,
  listTemplates,
  loadState,
  moveRows,
  outdentRows,
  parseOmniUrl,
  patchLocalStyle,
  patchPreferences,
  patchRow,
  putDocument,
  replaceHits,
  rowById,
  saveAsTemplate,
  saveState,
  sendSelectionToOmniClone,
  sendToNotebook,
  setCell,
  setCollapsed,
  setStatus,
  sortDocument,
  ungroupRows,
  wordStats,
  blankColumn,
  type ExportFormat,
  type OutlineDocument,
  type SavedFilter,
  type StatusValue,
} from "../core/index.js";

const __dirname = dirname(fileURLToPath(import.meta.url));
export const PORT = Number(process.env.PORT || 4466);

function withStats(doc: OutlineDocument) {
  return { ...doc, stats: wordStats(doc), visible: flatten(doc).length };
}

export function createApp() {
  const app = express();
  app.use(cors());
  app.use(express.json({ limit: "16mb" }));
  app.use(express.text({ type: ["text/*", "application/xml", "application/opml"], limit: "16mb" }));

  app.get("/api/health", (_req, res) => {
    res.json({ ok: true, app: "omniliner", name: APP_NAME, version: APP_VERSION });
  });

  app.get("/api/state", (_req, res) => {
    const state = loadState();
    res.json({
      ...state,
      documents: state.documents.map(documentSummary),
    });
  });

  app.get("/api/preferences", (_req, res) => res.json(loadState().preferences));
  app.patch("/api/preferences", (req, res) => res.json(patchPreferences(req.body)));

  app.get("/api/templates", (_req, res) => res.json(listTemplates()));
  app.post("/api/templates", (req, res) => {
    const doc = getDocument(String(req.body.documentId));
    res.status(201).json(saveAsTemplate(doc, req.body.name));
  });

  app.get("/api/documents", (_req, res) => {
    res.json(loadState().documents.map(documentSummary));
  });

  app.post("/api/documents", (req, res) => {
    const doc = createDocument(req.body.title || "Untitled", req.body.templateId);
    res.status(201).json(withStats(doc));
  });

  app.get("/api/documents/:id", (req, res) => {
    res.json(withStats(getDocument(req.params.id)));
  });

  app.put("/api/documents/:id", (req, res) => {
    const current = getDocument(req.params.id);
    res.json(withStats(putDocument({ ...current, ...req.body, id: current.id })));
  });

  app.patch("/api/documents/:id", (req, res) => {
    const current = getDocument(req.params.id);
    res.json(withStats(putDocument({ ...current, ...req.body, id: current.id, rows: req.body.rows ?? current.rows })));
  });

  app.delete("/api/documents/:id", (req, res) => {
    deleteDocument(req.params.id);
    res.json({ ok: true });
  });

  app.post("/api/documents/:id/rows", (req, res) => {
    const doc = getDocument(req.params.id);
    const next = addRow(doc, req.body.relativeId ?? null, req.body.placement || "below", req.body.row || { topic: req.body.topic || "" });
    res.json(withStats(putDocument(next)));
  });

  app.patch("/api/documents/:id/rows/:rowId", (req, res) => {
    res.json(withStats(putDocument(patchRow(getDocument(req.params.id), req.params.rowId, req.body))));
  });

  app.post("/api/documents/:id/rows/delete", (req, res) => {
    res.json(withStats(putDocument(deleteRows(getDocument(req.params.id), req.body.ids || []))));
  });

  app.post("/api/documents/:id/command", (req, res) => {
    const doc = getDocument(req.params.id);
    const ids: string[] = req.body.ids || [];
    const cmd = String(req.body.command || "");
    let next = doc;
    switch (cmd) {
      case "indent":
        next = indentRows(doc, ids);
        break;
      case "outdent":
        next = outdentRows(doc, ids);
        break;
      case "moveUp":
        next = moveRows(doc, ids, "up");
        break;
      case "moveDown":
        next = moveRows(doc, ids, "down");
        break;
      case "group":
        next = groupRows(doc, ids, req.body.title || "Group");
        break;
      case "ungroup":
        next = ungroupRows(doc, ids);
        break;
      case "duplicate":
        next = duplicateRows(doc, ids);
        break;
      case "expand":
        next = setCollapsed(doc, ids, false, Boolean(req.body.completely));
        break;
      case "collapse":
        next = setCollapsed(doc, ids, true, Boolean(req.body.completely));
        break;
      case "expandAll":
        next = expandAll(doc);
        break;
      case "collapseAll":
        next = collapseAll(doc);
        break;
      case "status":
        next = setStatus(doc, ids, req.body.status as StatusValue | "calculated");
        break;
      case "cycleStatus": {
        let cur = doc;
        for (const id of ids) {
          const row = rowById(cur, id);
          if (row) cur = patchRow(cur, id, cycleStatus(row));
        }
        next = cur;
        break;
      }
      case "namedStyle":
        next = applyNamedStyle(doc, ids, req.body.styleId, req.body.toggle !== false);
        break;
      case "localStyle":
        next = patchLocalStyle(doc, ids, req.body.style || {});
        break;
      case "clearStyle":
        next = clearLocalStyle(doc, ids);
        break;
      case "sort":
        next = sortDocument(doc, req.body.spec || { columnId: "topic", direction: "asc" }, ids.length ? ids : undefined);
        break;
      case "keepSorted":
        next = putDocument({ ...doc, keepSorted: req.body.spec ?? null });
        break;
      case "theme": {
        const tpl = loadState().templates.find((t) => t.id === req.body.templateId);
        next = tpl ? applyTheme(doc, tpl) : doc;
        break;
      }
      case "setCell":
        next = setCell(doc, req.body.rowId, req.body.columnId, req.body.value);
        break;
      case "replace":
        next = replaceHits(doc, req.body.query || "", req.body.replacement || "", Boolean(req.body.regex), req.body.all !== false, req.body.current);
        break;
      default:
        return res.status(400).json({ error: `Unknown command ${cmd}` });
    }
    res.json(withStats(putDocument(next)));
  });

  app.post("/api/documents/:id/columns", (req, res) => {
    const doc = getDocument(req.params.id);
    const col = blankColumn(req.body || { title: "Column", type: "text" });
    res.json(withStats(putDocument({ ...doc, columns: [...doc.columns, col], updatedAt: new Date().toISOString() })));
  });

  app.patch("/api/documents/:id/columns/:colId", (req, res) => {
    const doc = getDocument(req.params.id);
    const columns = doc.columns.map((c) => (c.id === req.params.colId ? { ...c, ...req.body, id: c.id } : c));
    res.json(withStats(putDocument({ ...doc, columns })));
  });

  app.delete("/api/documents/:id/columns/:colId", (req, res) => {
    const doc = getDocument(req.params.id);
    const col = doc.columns.find((c) => c.id === req.params.colId);
    if (col?.isTopic) return res.status(400).json({ error: "Topic column cannot be removed" });
    res.json(withStats(putDocument({ ...doc, columns: doc.columns.filter((c) => c.id !== req.params.colId) })));
  });

  app.post("/api/documents/:id/filters", (req, res) => {
    const doc = getDocument(req.params.id);
    const filter: SavedFilter = {
      id: req.body.id || `flt_${Date.now()}`,
      name: req.body.name || "Untitled Filter",
      match: req.body.match || "all",
      rules: req.body.rules || [{ id: "q", field: "topic", op: "contains", value: req.body.query || "" }],
    };
    res.json(withStats(putDocument({ ...doc, filters: [...doc.filters, filter] })));
  });

  app.get("/api/documents/:id/export/:format", (req, res) => {
    const doc = getDocument(req.params.id);
    const exported = exportDocument(doc, req.params.format as ExportFormat);
    res.setHeader("content-type", exported.mime);
    res.setHeader("content-disposition", `attachment; filename="${exported.filename}"`);
    res.send(exported.body);
  });

  app.post("/api/import", (req, res) => {
    const text = typeof req.body === "string" ? req.body : req.body.text || "";
    const filename = (req.body && req.body.filename) || req.query.filename || "Imported";
    const format = String(req.query.format || req.body.format || "");
    let doc: OutlineDocument;
    if (format === "opml") doc = fromOpml(text, String(filename));
    else if (format === "taskpaper") doc = fromTaskPaper(text, String(filename));
    else doc = detectImport(text, String(filename));
    res.status(201).json(withStats(putDocument(doc)));
  });

  app.get("/api/documents/:id/find", (req, res) => {
    const doc = getDocument(req.params.id);
    res.json({ hits: findHits(doc, String(req.query.q || ""), req.query.regex === "1") });
  });

  app.get("/api/open", (req, res) => {
    const parsed = parseOmniUrl(String(req.query.url || ""));
    const state = loadState();
    let doc = state.documents[0];
    if (parsed.kind === "document" && parsed.ids[0]) doc = getDocument(parsed.ids[0]);
    if (parsed.kind === "add" || parsed.kind === "x-callback-add") {
      doc = putDocument(addRow(doc, null, "below", { topic: parsed.query.name || "Untitled", note: parsed.query.note || "" }));
    }
    if (parsed.kind === "paste" && parsed.query.content) {
      const imported = fromTaskPaper(parsed.query.content, doc.title);
      imported.rows.forEach((row, i) => {
        if (!row.parentId) row.order = doc.rows.filter((r) => !r.parentId).length + i;
      });
      doc = putDocument({ ...doc, rows: [...doc.rows, ...imported.rows] });
    }
    res.json({ parsed, document: withStats(doc), ids: parsed.ids });
  });

  app.post("/automation/tell", (req, res) => {
    const state = loadState();
    const doc = req.body.documentId ? getDocument(req.body.documentId) : state.documents[0];
    const fn = String(req.body.functionName || req.body.function || "addRow");
    const applied = applyTell(doc, fn, req.body.argument, req.body.selectedIds || []);
    putDocument(applied.doc);
    res.json({ ok: true, result: applied.result });
  });

  app.post("/bridge/omniclone/send", async (req, res) => {
    const doc = getDocument(req.body.documentId);
    const payload = sendSelectionToOmniClone(doc, req.body.ids || [], loadState().preferences);
    res.json(payload);
  });

  app.post("/bridge/notebook/send", async (req, res) => {
    const doc = getDocument(req.body.documentId);
    const result = await sendToNotebook(doc, req.body.ids || [], loadState().preferences);
    res.json(result);
  });

  app.post("/bridge/omniplan/receive", (req, res) => {
    const state = loadState();
    const doc = req.body.documentId ? getDocument(req.body.documentId) : state.documents[0];
    const applied = applyTell(doc, "copyFromOmniPlan", req.body.tasks || req.body, []);
    res.json({ ok: true, result: applied.result, document: withStats(putDocument(applied.doc)) });
  });

  app.get("/api/keyword", (req, res) => {
    const doc = getDocument(String(req.query.documentId));
    res.json({ ids: [...keywordMatches(doc, String(req.query.q || ""))] });
  });

  const webDist = join(__dirname, "..", "..", "web", "dist");
  if (existsSync(webDist)) {
    app.use(express.static(webDist));
    app.use((req, res, next) => {
      if (req.path.startsWith("/api") || req.path.startsWith("/automation") || req.path.startsWith("/bridge")) return next();
      res.sendFile(join(webDist, "index.html"));
    });
  }

  return app;
}

export function startServer(port = PORT, host = "127.0.0.1"): Promise<{ port: number; close: () => Promise<void> }> {
  const app = createApp();
  return new Promise((resolve, reject) => {
    const server = app.listen(port, host, () => {
      console.log(`${APP_NAME} ${APP_VERSION}  http://${host}:${port}`);
      resolve({
        port,
        close: () =>
          new Promise((res, rej) => {
            server.close((err) => (err ? rej(err) : res()));
          }),
      });
    });
    server.on("error", reject);
  });
}

const isMain = Boolean(process.argv[1] && /server\/index\.(ts|js)/.test(process.argv[1]));
if (isMain) {
  startServer(PORT, "127.0.0.1").catch((err) => {
    console.error(err);
    process.exit(1);
  });
}
