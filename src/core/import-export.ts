import { blankColumn, blankDocument, blankRow } from "./factory.js";
import { childrenOf, flatten } from "./outline.js";
import type { OutlineDocument, Row, StatusValue } from "./types.js";

function xmlEscape(s: string): string {
  return s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

function stripTags(s: string): string {
  return s.replace(/<[^>]+>/g, "");
}

function indentText(text: string, depth: number): string {
  return `${"\t".repeat(depth)}${text}`;
}

export function toOpml(doc: OutlineDocument): string {
  const walk = (parentId: string | null): string =>
    childrenOf(doc, parentId)
      .map((row) => {
        const attrs = [`text="${xmlEscape(stripTags(row.topic))}"`];
        if (row.note) attrs.push(`_note="${xmlEscape(row.note)}"`);
        if (row.status === "checked") attrs.push(`_status="checked"`);
        else if (row.status === "unchecked") attrs.push(`_status="unchecked"`);
        for (const col of doc.columns.filter((c) => !c.isTopic && c.visible)) {
          const v = row.cells[col.id];
          if (v != null && v !== "") attrs.push(`${xmlEscape(col.title.replace(/\s+/g, "_"))}="${xmlEscape(String(v))}"`);
        }
        const kids = walk(row.id);
        if (kids) return `<outline ${attrs.join(" ")}>${kids}</outline>`;
        return `<outline ${attrs.join(" ")}/>`;
      })
      .join("");
  return `<?xml version="1.0" encoding="UTF-8"?>\n<opml version="2.0"><head><title>${xmlEscape(doc.title)}</title></head><body>${walk(null)}</body></opml>`;
}

export function fromOpml(xml: string, title = "Imported"): OutlineDocument {
  const doc = blankDocument({ title, rows: [] });
  const outlineRe = /<outline\b([^>]*)(\/>|>)/gi;
  const stack: { id: string | null; remaining: string }[] = [{ id: null, remaining: xml }];
  // Simple recursive parse of outline tags
  const parse = (fragment: string, parentId: string | null): void => {
    const re = /<outline\b([^>]*)(?:\/>|>([\s\S]*?)<\/outline>)/gi;
    let match: RegExpExecArray | null;
    let order = 0;
    while ((match = re.exec(fragment))) {
      const attrs = match[1] || "";
      const inner = match[2] || "";
      const get = (name: string) => {
        const m = attrs.match(new RegExp(`${name}\\s*=\\s*"([^"]*)"`, "i"));
        return m ? decodeXml(m[1]) : "";
      };
      const topic = get("text") || get("title");
      const note = get("_note") || get("note");
      const statusRaw = get("_status") || get("status");
      let status: StatusValue = "none";
      if (statusRaw === "checked") status = "checked";
      else if (statusRaw === "unchecked") status = "unchecked";
      const row = blankRow({
        topic,
        note,
        status,
        statusMode: status === "none" ? "none" : "explicit",
        parentId,
        order: order++,
      });
      doc.rows.push(row);
      if (inner.trim()) parse(inner, row.id);
    }
  };
  const body = xml.match(/<body[^>]*>([\s\S]*?)<\/body>/i)?.[1] ?? xml;
  parse(body, null);
  if (!doc.rows.length) doc.rows.push(blankRow({ topic: "" }));
  const headTitle = xml.match(/<title[^>]*>([\s\S]*?)<\/title>/i)?.[1];
  if (headTitle) doc.title = decodeXml(stripTags(headTitle));
  void outlineRe;
  void stack;
  return doc;
}

function decodeXml(s: string): string {
  return s
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
    .replace(/&amp;/g, "&");
}

export function toTaskPaper(doc: OutlineDocument, ids?: string[]): string {
  const lines: string[] = [];
  const allowed = ids?.length ? new Set(expandIds(doc, ids)) : null;
  const walk = (parentId: string | null, depth: number) => {
    for (const row of childrenOf(doc, parentId)) {
      if (allowed && !allowed.has(row.id)) continue;
      const tags: string[] = [];
      if (row.status === "checked") tags.push("@done");
      if (row.status === "unchecked") tags.push("@unchecked");
      for (const col of doc.columns.filter((c) => !c.isTopic)) {
        const v = row.cells[col.id];
        if (v == null || v === "" || v === false) continue;
        const key = col.title.toLowerCase().replace(/\s+/g, "");
        if (col.type === "checkbox" && v) tags.push(`@${key}`);
        else tags.push(`@${key}(${String(v)})`);
      }
      const tagStr = tags.length ? ` ${tags.join(" ")}` : "";
      lines.push(indentText(`- ${stripTags(row.topic)}${tagStr}`, depth));
      if (row.note.trim()) {
        for (const noteLine of row.note.split("\n")) lines.push(indentText(noteLine, depth + 1));
      }
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return lines.join("\n");
}

function expandIds(doc: OutlineDocument, ids: string[]): string[] {
  const set = new Set<string>();
  const add = (id: string) => {
    set.add(id);
    for (const child of childrenOf(doc, id)) add(child.id);
  };
  for (const id of ids) add(id);
  return [...set];
}

export function fromTaskPaper(text: string, title = "Imported"): OutlineDocument {
  const doc = blankDocument({ title, rows: [] });
  const stack: { depth: number; id: string }[] = [];
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  let lastRow: Row | null = null;
  let orderAt: Record<string, number> = { root: 0 };
  for (const raw of lines) {
    if (!raw.trim()) continue;
    const tabMatch = raw.match(/^(\t *)|^ */);
    const indent = raw.startsWith("\t") ? raw.match(/^\t*/)?.[0].length ?? 0 : Math.floor((raw.match(/^ */)?.[0].length ?? 0) / 2);
    const trimmed = raw.trim();
    const isTask = /^[-*] /.test(trimmed) || /:$/.test(trimmed);
    if (!isTask && lastRow) {
      lastRow.note = lastRow.note ? `${lastRow.note}\n${trimmed}` : trimmed;
      continue;
    }
    let topic = trimmed.replace(/^[-*]\s+/, "").replace(/:$/, "");
    const tags = [...topic.matchAll(/@([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?/g)];
    topic = topic.replace(/@([a-zA-Z0-9_-]+)(?:\(([^)]*)\))?/g, "").trim();
    while (stack.length && stack[stack.length - 1].depth >= indent) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const key = parentId ?? "root";
    const row = blankRow({ topic, parentId, order: orderAt[key] ?? 0 });
    orderAt[key] = (orderAt[key] ?? 0) + 1;
    for (const tag of tags) {
      const name = tag[1].toLowerCase();
      const value = tag[2];
      if (name === "done") {
        row.status = "checked";
        row.statusMode = "explicit";
      } else if (name === "unchecked") {
        row.status = "unchecked";
        row.statusMode = "explicit";
      }
      if (value) row.cells[name] = value;
    }
    doc.rows.push(row);
    lastRow = row;
    stack.push({ depth: indent, id: row.id });
    orderAt[row.id] = 0;
  }
  if (!doc.rows.length) doc.rows.push(blankRow({ topic: "" }));
  return doc;
}

export function toPlainText(doc: OutlineDocument): string {
  return flatten(doc, { includeCollapsed: true })
    .map((v) => `${"\t".repeat(v.depth)}${stripTags(v.row.topic)}`)
    .join("\n");
}

export function fromPlainText(text: string, title = "Imported"): OutlineDocument {
  const doc = blankDocument({ title, rows: [] });
  const stack: { depth: number; id: string }[] = [];
  const orderAt: Record<string, number> = { root: 0 };
  for (const raw of text.replace(/\r\n/g, "\n").split("\n")) {
    if (!raw.trim()) continue;
    const depth = raw.startsWith("\t") ? (raw.match(/^\t*/)?.[0].length ?? 0) : Math.floor((raw.match(/^ */)?.[0].length ?? 0) / 2);
    const topic = raw.trim();
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const key = parentId ?? "root";
    const row = blankRow({ topic, parentId, order: orderAt[key] ?? 0 });
    orderAt[key] = (orderAt[key] ?? 0) + 1;
    doc.rows.push(row);
    stack.push({ depth, id: row.id });
    orderAt[row.id] = 0;
  }
  if (!doc.rows.length) doc.rows.push(blankRow({ topic: "" }));
  return doc;
}

export function toMarkdown(doc: OutlineDocument): string {
  const lines = [`# ${doc.title}`, ""];
  const walk = (parentId: string | null, depth: number) => {
    for (const row of childrenOf(doc, parentId)) {
      const check =
        row.status === "checked" ? "[x] " : row.status === "unchecked" || row.statusMode === "explicit" ? "[ ] " : "";
      lines.push(`${"  ".repeat(depth)}- ${check}${stripTags(row.topic)}`);
      if (row.note.trim()) lines.push(`${"  ".repeat(depth + 1)}> ${row.note.replace(/\n/g, " ")}`);
      walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return lines.join("\n");
}

export function toCsv(doc: OutlineDocument): string {
  const cols = doc.columns.filter((c) => c.visible);
  const header = ["Level", ...cols.map((c) => c.title), "Notes", "Status"].map(csvCell).join(",");
  const lines = [header];
  for (const vis of flatten(doc, { includeCollapsed: true })) {
    const values = cols.map((c) => {
      if (c.isTopic) return vis.row.topic;
      return vis.row.cells[c.id] ?? "";
    });
    lines.push(
      [String(vis.depth), ...values, vis.row.note, vis.effectiveStatus].map((v) => csvCell(String(v ?? ""))).join(","),
    );
  }
  return lines.join("\n");
}

function csvCell(s: string): string {
  if (/[",\n]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

export function fromCsv(text: string, title = "Imported"): OutlineDocument {
  const rows = parseCsv(text);
  if (!rows.length) return blankDocument({ title });
  const header = rows[0].map((h) => h.trim());
  const doc = blankDocument({ title, rows: [] });
  const extra = header.filter((h) => !["level", "topic", "notes", "note", "status"].includes(h.toLowerCase()));
  for (const name of extra) {
    doc.columns.push(blankColumn({ title: name, type: "text" }));
  }
  const topicIdx = header.findIndex((h) => h.toLowerCase() === "topic");
  const levelIdx = header.findIndex((h) => h.toLowerCase() === "level");
  const noteIdx = header.findIndex((h) => h.toLowerCase() === "notes" || h.toLowerCase() === "note");
  const statusIdx = header.findIndex((h) => h.toLowerCase() === "status");
  const stack: { depth: number; id: string }[] = [];
  const orderAt: Record<string, number> = { root: 0 };
  for (const cells of rows.slice(1)) {
    const depth = levelIdx >= 0 ? Number(cells[levelIdx] || 0) : 0;
    const topic = topicIdx >= 0 ? cells[topicIdx] : cells[0] || "";
    while (stack.length && stack[stack.length - 1].depth >= depth) stack.pop();
    const parentId = stack.length ? stack[stack.length - 1].id : null;
    const key = parentId ?? "root";
    const row = blankRow({
      topic,
      parentId,
      order: orderAt[key] ?? 0,
      note: noteIdx >= 0 ? cells[noteIdx] || "" : "",
    });
    orderAt[key] = (orderAt[key] ?? 0) + 1;
    if (statusIdx >= 0) {
      const st = (cells[statusIdx] || "").toLowerCase();
      if (st === "checked") {
        row.status = "checked";
        row.statusMode = "explicit";
      } else if (st === "unchecked") {
        row.status = "unchecked";
        row.statusMode = "explicit";
      }
    }
    for (const col of doc.columns.filter((c) => !c.isTopic)) {
      const idx = header.findIndex((h) => h === col.title);
      if (idx >= 0) row.cells[col.id] = cells[idx] ?? "";
    }
    doc.rows.push(row);
    stack.push({ depth, id: row.id });
    orderAt[row.id] = 0;
  }
  if (!doc.rows.length) doc.rows.push(blankRow({ topic: "" }));
  return doc;
}

function parseCsv(text: string): string[][] {
  const rows: string[][] = [];
  let row: string[] = [];
  let cell = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const ch = text[i];
    if (inQuotes) {
      if (ch === '"' && text[i + 1] === '"') {
        cell += '"';
        i += 1;
      } else if (ch === '"') inQuotes = false;
      else cell += ch;
    } else if (ch === '"') inQuotes = true;
    else if (ch === ",") {
      row.push(cell);
      cell = "";
    } else if (ch === "\n") {
      row.push(cell);
      rows.push(row);
      row = [];
      cell = "";
    } else if (ch !== "\r") cell += ch;
  }
  if (cell.length || row.length) {
    row.push(cell);
    rows.push(row);
  }
  return rows.filter((r) => r.some((c) => c.trim()));
}

export function toHtml(doc: OutlineDocument, dynamic = false): string {
  const walk = (parentId: string | null): string => {
    const kids = childrenOf(doc, parentId);
    if (!kids.length) return "";
    return `<ul>${kids
      .map((row) => {
        const note = row.note ? `<div class="note">${xmlEscape(row.note)}</div>` : "";
        return `<li data-status="${row.status}">${xmlEscape(stripTags(row.topic))}${note}${walk(row.id)}</li>`;
      })
      .join("")}</ul>`;
  };
  const script = dynamic
    ? `<script>document.querySelectorAll("li").forEach(li=>{const kids=li.querySelector(":scope > ul");if(!kids)return;const t=document.createElement("button");t.textContent="▾";t.onclick=()=>{kids.hidden=!kids.hidden;t.textContent=kids.hidden?"▸":"▾"};li.prepend(t);})</script>`
    : "";
  return `<!doctype html><html><head><meta charset="utf-8"><title>${xmlEscape(doc.title)}</title>
<style>body{font:15px/1.45 -apple-system,Helvetica,sans-serif;max-width:860px;margin:40px auto;color:#1d1d1f} .note{color:#6e6e73;font-style:italic;margin:4px 0 8px} li{margin:4px 0} button{margin-right:6px}</style>
</head><body><h1>${xmlEscape(doc.title)}</h1>${walk(null)}${script}</body></html>`;
}

export function detectImport(text: string, filename = ""): OutlineDocument {
  const name = filename.toLowerCase();
  const trimmed = text.trim();
  if (name.endsWith(".opml") || trimmed.startsWith("<?xml") || trimmed.includes("<opml")) return fromOpml(text, filename || "OPML");
  if (name.endsWith(".csv") || (trimmed.includes(",") && trimmed.split("\n")[0].includes("Topic"))) return fromCsv(text, filename || "CSV");
  if (name.endsWith(".taskpaper") || /^[-*] /.test(trimmed) || trimmed.includes("@done")) return fromTaskPaper(text, filename || "TaskPaper");
  return fromPlainText(text, filename || "Text");
}

export type ExportFormat = "opml" | "csv" | "html" | "dhtml" | "txt" | "taskpaper" | "markdown" | "json";

export function exportDocument(doc: OutlineDocument, format: ExportFormat): { mime: string; body: string; filename: string } {
  const base = doc.title.replace(/[^\w.-]+/g, "-") || "outline";
  switch (format) {
    case "opml":
      return { mime: "text/xml", body: toOpml(doc), filename: `${base}.opml` };
    case "csv":
      return { mime: "text/csv", body: toCsv(doc), filename: `${base}.csv` };
    case "html":
      return { mime: "text/html", body: toHtml(doc, false), filename: `${base}.html` };
    case "dhtml":
      return { mime: "text/html", body: toHtml(doc, true), filename: `${base}.html` };
    case "txt":
      return { mime: "text/plain", body: toPlainText(doc), filename: `${base}.txt` };
    case "taskpaper":
      return { mime: "text/plain", body: toTaskPaper(doc), filename: `${base}.taskpaper` };
    case "markdown":
      return { mime: "text/markdown", body: toMarkdown(doc), filename: `${base}.md` };
    default:
      return { mime: "application/json", body: JSON.stringify(doc, null, 2), filename: `${base}.ooutline.json` };
  }
}

export function timestampText(kind: "short-date" | "long-date" | "time" | "short-datetime" | "long-datetime", at = new Date()): string {
  if (kind === "short-date") return at.toLocaleDateString();
  if (kind === "long-date") return at.toLocaleDateString(undefined, { dateStyle: "long" });
  if (kind === "time") return at.toLocaleTimeString();
  if (kind === "short-datetime") return `${at.toLocaleDateString()} ${at.toLocaleTimeString(undefined, { timeStyle: "short" })}`;
  return at.toLocaleString(undefined, { dateStyle: "long", timeStyle: "medium" });
}

export function sortDocument(doc: OutlineDocument, spec: { columnId: string; direction: "asc" | "desc" }, selectedIds?: string[]): OutlineDocument {
  const next = structuredClone(doc);
  const dir = spec.direction === "asc" ? 1 : -1;
  const valueOf = (row: Row): string | number => {
    if (spec.columnId === "topic") return row.topic.toLowerCase();
    if (spec.columnId === "note") return row.note.toLowerCase();
    if (spec.columnId === "status") return row.status;
    const v = row.cells[spec.columnId];
    if (typeof v === "number") return v;
    return String(v ?? "").toLowerCase();
  };
  const compare = (a: Row, b: Row) => {
    const va = valueOf(a);
    const vb = valueOf(b);
    if (va < vb) return -1 * dir;
    if (va > vb) return 1 * dir;
    return 0;
  };
  const parents = new Set<string | null>();
  if (selectedIds?.length) {
    for (const id of selectedIds) {
      const row = next.rows.find((r) => r.id === id);
      if (row) parents.add(row.parentId);
    }
  } else {
    for (const row of next.rows) parents.add(row.parentId);
  }
  for (const parentId of parents) {
    const siblings = next.rows.filter((r) => r.parentId === parentId).sort(compare);
    siblings.forEach((row, i) => (row.order = i));
  }
  next.updatedAt = new Date().toISOString();
  return next;
}
