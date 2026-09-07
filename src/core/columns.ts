import { childrenOf, flatten } from "./outline.js";
import type { CellValue, Column, OutlineDocument } from "./types.js";

const DURATION_UNITS: Record<string, number> = {
  s: 1,
  sec: 1,
  m: 60,
  min: 60,
  h: 3600,
  hr: 3600,
  d: 86400,
  w: 604800,
};

export function parseDuration(input: string | number | null | undefined): number | null {
  if (input == null || input === "") return null;
  if (typeof input === "number" && Number.isFinite(input)) return input;
  const text = String(input).trim().toLowerCase();
  if (!text) return null;
  if (/^\d+(\.\d+)?$/.test(text)) return Number(text) * 60;
  const re = /(\d+(?:\.\d+)?)\s*(w|d|h|hr|m|min|s|sec)?/g;
  let total = 0;
  let match: RegExpExecArray | null;
  let found = false;
  while ((match = re.exec(text))) {
    found = true;
    const n = Number(match[1]);
    const unit = match[2] || "m";
    total += n * (DURATION_UNITS[unit] ?? 60);
  }
  return found ? total : null;
}

export function formatDuration(seconds: number | null | undefined): string {
  if (seconds == null || !Number.isFinite(seconds)) return "";
  const abs = Math.abs(seconds);
  const w = Math.floor(abs / 604800);
  const d = Math.floor((abs % 604800) / 86400);
  const h = Math.floor((abs % 86400) / 3600);
  const m = Math.floor((abs % 3600) / 60);
  const parts: string[] = [];
  if (w) parts.push(`${w}w`);
  if (d) parts.push(`${d}d`);
  if (h) parts.push(`${h}h`);
  if (m || !parts.length) parts.push(`${m}m`);
  return (seconds < 0 ? "-" : "") + parts.join(" ");
}

export function parseNumber(value: CellValue): number | null {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "boolean") return value ? 1 : 0;
  if (typeof value === "string") {
    const n = Number(value.replace(/,/g, "").trim());
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

export function cellNumeric(doc: OutlineDocument, rowId: string, column: Column): number | null {
  const row = doc.rows.find((r) => r.id === rowId);
  if (!row) return null;
  const raw = column.isTopic ? row.topic : row.cells[column.id];
  if (column.type === "duration") return parseDuration(raw as string | number | null);
  if (column.type === "checkbox") return raw === true || raw === "true" || raw === "checked" ? 1 : 0;
  if (column.type === "number" || column.type === "date") return parseNumber(raw);
  return parseNumber(raw);
}

export function columnSummary(doc: OutlineDocument, column: Column, parentId: string | null = null): number | null {
  if (column.summary === "none" || column.summary === "hidden") return null;
  const kids = parentId === null ? flatten(doc, { includeCollapsed: true }).map((v) => v.row) : childrenOf(doc, parentId);
  const values = kids
    .map((row) => {
      const direct = cellNumeric(doc, row.id, column);
      if (direct != null) return direct;
      if (childrenOf(doc, row.id).length) return columnSummary(doc, column, row.id);
      return null;
    })
    .filter((n): n is number => n != null);
  if (!values.length) return null;
  if (column.summary === "total") return values.reduce((a, b) => a + b, 0);
  if (column.summary === "average") return values.reduce((a, b) => a + b, 0) / values.length;
  if (column.summary === "minimum") return Math.min(...values);
  if (column.summary === "maximum") return Math.max(...values);
  return null;
}

export function formatCell(column: Column, value: CellValue): string {
  if (value == null || value === "") return "";
  if (column.type === "checkbox") return value === true || value === "true" || value === "checked" ? "✓" : "";
  if (column.type === "duration") {
    const n = parseDuration(value as string | number);
    return n == null ? String(value) : formatDuration(n);
  }
  if (column.type === "number") {
    const n = parseNumber(value);
    if (n == null) return String(value);
    const decimals = column.decimals ?? 0;
    return n.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals });
  }
  if (column.type === "date") {
    const d = new Date(String(value));
    if (Number.isNaN(d.getTime())) return String(value);
    if (column.format === "long") return d.toLocaleDateString(undefined, { dateStyle: "long" });
    if (column.format === "datetime") return d.toLocaleString();
    return d.toLocaleDateString();
  }
  return String(value);
}
