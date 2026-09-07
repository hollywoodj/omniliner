import { BUILTIN_NAMED_STYLES, DEFAULT_STRUCTURAL_STYLES, type Column, type OutlineDocument, type Row } from "./types.js";
import { nowIso, uid } from "./ids.js";

export function blankColumn(partial: Partial<Column> = {}): Column {
  return {
    id: partial.id ?? uid("col_"),
    title: partial.title ?? "Column",
    type: partial.type ?? "text",
    width: partial.width ?? 140,
    visible: partial.visible ?? true,
    isTopic: partial.isTopic ?? false,
    summary: partial.summary ?? "none",
    format: partial.format,
    decimals: partial.decimals,
    popupOptions: partial.popupOptions,
    style: partial.style,
  };
}

export function topicColumn(): Column {
  return blankColumn({
    id: "topic",
    title: "Topic",
    type: "richText",
    width: 420,
    isTopic: true,
    visible: true,
  });
}

export function blankRow(partial: Partial<Row> = {}): Row {
  const ts = nowIso();
  return {
    id: partial.id ?? uid(),
    parentId: partial.parentId ?? null,
    order: partial.order ?? 0,
    topic: partial.topic ?? "",
    note: partial.note ?? "",
    status: partial.status ?? "none",
    statusMode: partial.statusMode ?? "none",
    collapsed: partial.collapsed ?? false,
    noteExpanded: partial.noteExpanded ?? false,
    cells: { ...(partial.cells ?? {}) },
    namedStyleIds: [...(partial.namedStyleIds ?? [])],
    localStyle: partial.localStyle ? { ...partial.localStyle } : undefined,
    attachments: [...(partial.attachments ?? [])],
    createdAt: partial.createdAt ?? ts,
    updatedAt: partial.updatedAt ?? ts,
  };
}

export function blankDocument(partial: Partial<OutlineDocument> = {}): OutlineDocument {
  const ts = nowIso();
  const title = partial.title ?? "Untitled";
  return {
    id: partial.id ?? uid("doc_"),
    title,
    documentName: partial.documentName ?? `${title}.ooutline`,
    rows: partial.rows ? structuredClone(partial.rows) : [blankRow({ topic: "" })],
    columns: partial.columns ? structuredClone(partial.columns) : [topicColumn()],
    styles: partial.styles ? structuredClone(partial.styles) : structuredClone(DEFAULT_STRUCTURAL_STYLES),
    namedStyles: partial.namedStyles ? structuredClone(partial.namedStyles) : structuredClone(BUILTIN_NAMED_STYLES),
    filters: partial.filters ? structuredClone(partial.filters) : [],
    themeId: partial.themeId ?? "classic",
    showStatus: partial.showStatus ?? true,
    showNotesColumn: partial.showNotesColumn ?? true,
    notesDisplay: partial.notesDisplay ?? "inline",
    notesSpanColumns: partial.notesSpanColumns ?? false,
    columnHeaders: partial.columnHeaders ?? "automatic",
    fullRowText: partial.fullRowText ?? "always",
    numbering: partial.numbering ?? { style: "none", suffix: "period" },
    indentChildren: partial.indentChildren ?? true,
    alternateRows: partial.alternateRows ?? false,
    horizontalGrid: partial.horizontalGrid ?? true,
    verticalGrid: partial.verticalGrid ?? false,
    rowPadding: partial.rowPadding ?? 4,
    zoom: partial.zoom ?? 1,
    typewriterMode: partial.typewriterMode ?? false,
    foldedEditing: partial.foldedEditing ?? false,
    keepSorted: partial.keepSorted ?? null,
    encryption: partial.encryption,
    createdAt: partial.createdAt ?? ts,
    updatedAt: partial.updatedAt ?? ts,
  };
}

export function cloneRow(row: Row, opts: { newIds?: boolean; parentId?: string | null } = {}): Row {
  const next = structuredClone(row);
  if (opts.newIds) next.id = uid();
  if (opts.parentId !== undefined) next.parentId = opts.parentId;
  next.createdAt = nowIso();
  next.updatedAt = next.createdAt;
  return next;
}
