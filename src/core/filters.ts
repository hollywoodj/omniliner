import { flatten } from "./outline.js";
import type { FilterRule, OutlineDocument, SavedFilter } from "./types.js";

export function ruleMatches(doc: OutlineDocument, rowId: string, rule: FilterRule): boolean {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return false;
  const fieldValue = (): string => {
    if (rule.field === "topic") return row.topic;
    if (rule.field === "note") return row.note;
    if (rule.field === "status") return row.status;
    if (rule.field === "column" && rule.columnId) {
      if (rule.columnId === "topic") return row.topic;
      return String(row.cells[rule.columnId] ?? "");
    }
    return "";
  };
  const text = fieldValue();
  const needle = String(rule.value ?? "");
  switch (rule.op) {
    case "contains":
      return text.toLowerCase().includes(needle.toLowerCase());
    case "equals":
      return text.toLowerCase() === needle.toLowerCase();
    case "startsWith":
      return text.toLowerCase().startsWith(needle.toLowerCase());
    case "endsWith":
      return text.toLowerCase().endsWith(needle.toLowerCase());
    case "checked":
      return row.status === "checked";
    case "unchecked":
      return row.status === "unchecked" || row.status === "none";
    case "empty":
      return !text.trim();
    case "notEmpty":
      return Boolean(text.trim());
    case "gt":
      return Number(text) > Number(rule.value);
    case "lt":
      return Number(text) < Number(rule.value);
    default:
      return false;
  }
}

export function filterMatches(doc: OutlineDocument, filter: SavedFilter): Set<string> {
  const hits = new Set<string>();
  for (const row of doc.rows) {
    const results = filter.rules.map((rule) => ruleMatches(doc, row.id, rule));
    const ok = filter.rules.length === 0 ? true : filter.match === "all" ? results.every(Boolean) : results.some(Boolean);
    if (ok) hits.add(row.id);
  }
  return hits;
}

export function keywordMatches(doc: OutlineDocument, query: string): Set<string> {
  const q = query.trim().toLowerCase();
  const hits = new Set<string>();
  if (!q) return hits;
  for (const row of doc.rows) {
    const blob = `${row.topic} ${row.note} ${Object.values(row.cells).join(" ")}`.toLowerCase();
    if (blob.includes(q)) hits.add(row.id);
  }
  return hits;
}

export function findHits(doc: OutlineDocument, query: string, useRegex = false): { rowId: string; field: "topic" | "note"; start: number; end: number }[] {
  const hits: { rowId: string; field: "topic" | "note"; start: number; end: number }[] = [];
  if (!query) return hits;
  let re: RegExp | null = null;
  if (useRegex) {
    try {
      re = new RegExp(query, "gi");
    } catch {
      re = null;
    }
  }
  const scan = (rowId: string, field: "topic" | "note", text: string) => {
    if (re) {
      re.lastIndex = 0;
      let m: RegExpExecArray | null;
      while ((m = re.exec(text))) {
        hits.push({ rowId, field, start: m.index, end: m.index + m[0].length });
        if (!m[0]) re.lastIndex += 1;
      }
      return;
    }
    const lower = text.toLowerCase();
    const needle = query.toLowerCase();
    let from = 0;
    while (from <= lower.length) {
      const i = lower.indexOf(needle, from);
      if (i < 0) break;
      hits.push({ rowId, field, start: i, end: i + needle.length });
      from = i + Math.max(needle.length, 1);
    }
  };
  for (const { row } of flatten(doc, { includeCollapsed: true })) {
    scan(row.id, "topic", row.topic);
    scan(row.id, "note", row.note);
  }
  return hits;
}

export function replaceHits(
  doc: OutlineDocument,
  query: string,
  replacement: string,
  useRegex = false,
  all = true,
  current?: { rowId: string; field: "topic" | "note"; start: number; end: number },
): OutlineDocument {
  const next = structuredClone(doc);
  const apply = (rowId: string, field: "topic" | "note", start: number, end: number) => {
    const row = next.rows.find((r) => r.id === rowId);
    if (!row) return;
    const text = field === "topic" ? row.topic : row.note;
    const value = text.slice(0, start) + replacement + text.slice(end);
    if (field === "topic") row.topic = value;
    else row.note = value;
  };
  if (!all && current) {
    apply(current.rowId, current.field, current.start, current.end);
    return next;
  }
  const hits = findHits(next, query, useRegex).reverse();
  for (const hit of hits) apply(hit.rowId, hit.field, hit.start, hit.end);
  return next;
}
