import type { CSSProperties } from "react";
import type { Column, OutlineDocument, Row, StatusValue } from "./types";

export type VisibleRow = {
  row: Row;
  depth: number;
  number: string;
  hasChildren: boolean;
  effectiveStatus: StatusValue;
};

export function childrenOf(doc: OutlineDocument, parentId: string | null): Row[] {
  return doc.rows.filter((r) => r.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function descendants(doc: OutlineDocument, id: string): Row[] {
  const out: Row[] = [];
  const walk = (pid: string) => {
    for (const c of childrenOf(doc, pid)) {
      out.push(c);
      walk(c.id);
    }
  };
  walk(id);
  return out;
}

export function hasChildren(doc: OutlineDocument, id: string): boolean {
  return doc.rows.some((r) => r.parentId === id);
}

export function effectiveStatus(doc: OutlineDocument, row: Row): StatusValue {
  if (row.statusMode === "calculated" || (row.statusMode === "none" && hasChildren(doc, row.id) && row.status === "none")) {
    const kids = childrenOf(doc, row.id);
    if (!kids.length) return row.status;
    const states = kids.map((k) => effectiveStatus(doc, k)).filter((s) => s !== "none");
    if (!states.length) return "none";
    if (states.every((s) => s === "checked")) return "checked";
    if (states.every((s) => s === "unchecked")) return "unchecked";
    return "mixed";
  }
  return row.status === "checked" ? "checked" : row.status === "unchecked" ? "unchecked" : "none";
}

function indexAmong(doc: OutlineDocument, id: string): number {
  const row = doc.rows.find((r) => r.id === id);
  if (!row) return 0;
  return childrenOf(doc, row.parentId).findIndex((r) => r.id === id);
}

export function rowNumber(doc: OutlineDocument, id: string): string {
  const style = doc.numbering.style;
  if (style === "none") return "";
  const row = doc.rows.find((r) => r.id === id);
  if (!row) return "";
  let body = "";
  if (style === "outline") {
    const stack: number[] = [];
    let current: Row | undefined = row;
    while (current) {
      stack.unshift(indexAmong(doc, current.id) + 1);
      current = current.parentId ? doc.rows.find((r) => r.id === current!.parentId) : undefined;
    }
    body = stack.join(".");
  } else {
    body = String(indexAmong(doc, id) + 1);
  }
  const suffix = doc.numbering.suffix;
  if (suffix === "period") return `${body}.`;
  if (suffix === "paren") return `${body})`;
  if (suffix === "wrapped") return `(${body})`;
  return body;
}

export function flatten(doc: OutlineDocument, opts: { focusIds?: string[]; matchIds?: Set<string> } = {}): VisibleRow[] {
  const out: VisibleRow[] = [];
  const focus = opts.focusIds?.length ? new Set(expandFocus(doc, opts.focusIds)) : null;
  const walk = (parentId: string | null, depth: number) => {
    for (const row of childrenOf(doc, parentId)) {
      if (focus && !focus.has(row.id)) continue;
      if (opts.matchIds && !opts.matchIds.has(row.id) && !descendants(doc, row.id).some((c) => opts.matchIds!.has(c.id))) continue;
      out.push({
        row,
        depth,
        number: rowNumber(doc, row.id),
        hasChildren: hasChildren(doc, row.id),
        effectiveStatus: effectiveStatus(doc, row),
      });
      if (!row.collapsed) walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function expandFocus(doc: OutlineDocument, ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    let cur = doc.rows.find((r) => r.id === id);
    while (cur) {
      set.add(cur.id);
      cur = cur.parentId ? doc.rows.find((r) => r.id === cur!.parentId) : undefined;
    }
    for (const d of descendants(doc, id)) set.add(d.id);
  }
  return [...set];
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

export function styleCss(style: Record<string, unknown> | undefined): CSSProperties {
  if (!style) return {};
  return {
    fontFamily: style.fontFamily as string | undefined,
    fontSize: style.fontSize ? Number(style.fontSize) : undefined,
    fontWeight: style.fontWeight as CSSProperties["fontWeight"],
    fontStyle: style.italic ? "italic" : undefined,
    textDecoration: style.underline ? "underline" : style.strikethrough ? "line-through" : undefined,
    color: style.color as string | undefined,
    background: style.backgroundColor as string | undefined,
    textAlign: style.alignment as CSSProperties["textAlign"],
  };
}

export function mergedStyle(doc: OutlineDocument, row: Row, depth: number): CSSProperties {
  const named = row.namedStyleIds.map((id) => doc.namedStyles.find((s) => s.id === id)?.style);
  const parts = [doc.styles.wholeDocument, doc.styles.topic, doc.styles.levelStyles[depth + 1], ...named, row.localStyle];
  return styleCss(Object.assign({}, ...parts.filter(Boolean)));
}

export function showHeaders(doc: OutlineDocument): boolean {
  const visible = doc.columns.filter((c) => c.visible).length;
  if (doc.columnHeaders === "show") return true;
  if (doc.columnHeaders === "hide") return false;
  return visible > 1;
}

export function visibleColumns(doc: OutlineDocument): Column[] {
  return doc.columns.filter((c) => c.visible);
}
