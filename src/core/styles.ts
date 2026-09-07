import { flatten } from "./outline.js";
import type { OutlineDocument, TextStyle } from "./types.js";

export function mergeStyle(parts: Array<Partial<TextStyle> | undefined>): Partial<TextStyle> {
  return Object.assign({}, ...parts.filter(Boolean));
}

export function styleForRow(doc: OutlineDocument, rowId: string, depth: number): Partial<TextStyle> {
  const row = doc.rows.find((r) => r.id === rowId);
  const named = (row?.namedStyleIds ?? []).map((id) => doc.namedStyles.find((s) => s.id === id)?.style);
  return mergeStyle([
    doc.styles.wholeDocument,
    doc.styles.topic,
    doc.styles.levelStyles[depth + 1],
    ...named,
    row?.localStyle,
  ]);
}

export function cssFromStyle(style: Partial<TextStyle>): string {
  const bits: string[] = [];
  if (style.fontFamily) bits.push(`font-family:${style.fontFamily}`);
  if (style.fontSize) bits.push(`font-size:${style.fontSize}px`);
  if (style.fontWeight) bits.push(`font-weight:${style.fontWeight}`);
  if (style.italic) bits.push("font-style:italic");
  if (style.underline) bits.push("text-decoration:underline");
  if (style.strikethrough) bits.push("text-decoration:line-through");
  if (style.color) bits.push(`color:${style.color}`);
  if (style.backgroundColor) bits.push(`background:${style.backgroundColor}`);
  if (style.alignment) bits.push(`text-align:${style.alignment}`);
  if (style.lineHeight) bits.push(`line-height:${style.lineHeight}`);
  return bits.join(";");
}

export function applyNamedStyle(doc: OutlineDocument, ids: string[], styleId: string, toggle = true): OutlineDocument {
  const next = structuredClone(doc);
  for (const id of ids) {
    const row = next.rows.find((r) => r.id === id);
    if (!row) continue;
    if (toggle && row.namedStyleIds.includes(styleId)) {
      row.namedStyleIds = row.namedStyleIds.filter((s) => s !== styleId);
    } else if (!row.namedStyleIds.includes(styleId)) {
      row.namedStyleIds = [...row.namedStyleIds, styleId];
    }
  }
  return next;
}

export function patchLocalStyle(doc: OutlineDocument, ids: string[], patch: Partial<TextStyle>): OutlineDocument {
  const next = structuredClone(doc);
  for (const id of ids) {
    const row = next.rows.find((r) => r.id === id);
    if (!row) continue;
    row.localStyle = { ...(row.localStyle ?? {}), ...patch };
  }
  return next;
}

export function clearLocalStyle(doc: OutlineDocument, ids: string[]): OutlineDocument {
  const next = structuredClone(doc);
  for (const id of ids) {
    const row = next.rows.find((r) => r.id === id);
    if (!row) continue;
    row.localStyle = undefined;
    row.namedStyleIds = [];
  }
  return next;
}

export function visibleCount(doc: OutlineDocument): number {
  return flatten(doc).length;
}
