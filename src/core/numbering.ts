import type { OutlineDocument, RowNumberStyle } from "./types.js";

const ROMAN: [number, string][] = [
  [1000, "M"],
  [900, "CM"],
  [500, "D"],
  [400, "CD"],
  [100, "C"],
  [90, "XC"],
  [50, "L"],
  [40, "XL"],
  [10, "X"],
  [9, "IX"],
  [5, "V"],
  [4, "IV"],
  [1, "I"],
];

export function toRoman(n: number): string {
  let v = Math.max(1, Math.floor(n));
  let out = "";
  for (const [value, glyph] of ROMAN) {
    while (v >= value) {
      out += glyph;
      v -= value;
    }
  }
  return out;
}

export function toAlpha(n: number, lower = false): string {
  let v = Math.max(1, Math.floor(n));
  let out = "";
  while (v > 0) {
    v -= 1;
    out = String.fromCharCode(65 + (v % 26)) + out;
    v = Math.floor(v / 26);
  }
  return lower ? out.toLowerCase() : out;
}

function siblings(doc: OutlineDocument, parentId: string | null) {
  return doc.rows.filter((r) => r.parentId === parentId).sort((a, b) => a.order - b.order);
}

function indexAmongSiblings(doc: OutlineDocument, id: string): number {
  const row = doc.rows.find((r) => r.id === id);
  if (!row) return 0;
  return siblings(doc, row.parentId).findIndex((r) => r.id === id);
}

function formatToken(style: RowNumberStyle, n: number): string {
  if (style === "none") return "";
  if (style === "decimal" || style === "outline") return String(n);
  if (style === "upperAlpha") return toAlpha(n, false);
  if (style === "lowerAlpha") return toAlpha(n, true);
  if (style === "upperRoman") return toRoman(n);
  if (style === "lowerRoman") return toRoman(n).toLowerCase();
  return String(n);
}

export function rowNumber(doc: OutlineDocument, id: string): string {
  const style = doc.numbering.style;
  if (style === "none") return "";
  const row = doc.rows.find((r) => r.id === id);
  if (!row) return "";
  let body = "";
  if (style === "outline") {
    const stack: number[] = [];
    let current = row;
    while (current) {
      stack.unshift(indexAmongSiblings(doc, current.id) + 1);
      if (!current.parentId) break;
      const parent = doc.rows.find((r) => r.id === current.parentId);
      if (!parent) break;
      current = parent;
    }
    body = stack.join(".");
  } else {
    body = formatToken(style, indexAmongSiblings(doc, id) + 1);
  }
  const suffix = doc.numbering.suffix;
  if (suffix === "period") return `${body}.`;
  if (suffix === "paren") return `${body})`;
  if (suffix === "wrapped") return `(${body})`;
  return body;
}
