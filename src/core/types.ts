/** OmniOutliner 6 Pro domain types, aligned with Omni Automation and the published manuals. */

export const APP_VERSION = "6.2.1";
export const APP_NAME = "OmniOutliner";
export const APP_ID = "omniliner";
export const DEFAULT_PORT = 4466;

export type ColumnType =
  | "richText"
  | "text"
  | "number"
  | "duration"
  | "date"
  | "checkbox"
  | "popup";

export type ColumnSummary = "none" | "total" | "average" | "minimum" | "maximum" | "hidden";
export type StatusValue = "checked" | "unchecked" | "mixed" | "none";
export type StatusMode = "explicit" | "calculated" | "none";
export type RowNumberStyle =
  | "none"
  | "decimal"
  | "upperAlpha"
  | "lowerAlpha"
  | "upperRoman"
  | "lowerRoman"
  | "outline";
export type RowNumberSuffix = "none" | "period" | "paren" | "wrapped";
export type NoteDisplay = "inline" | "pane";
export type ColumnHeadersMode = "show" | "automatic" | "hide";
export type FullRowTextMode = "always" | "whenEditing";
export type SidebarTab = "sections" | "styles" | "filters";
export type InspectorGroup = "selection" | "document";
export type Alignment = "left" | "center" | "right" | "justify";
export type Appearance = "system" | "light" | "dark";
export type NewRowPlacement = "below" | "inside" | "above";
export type OmniCloneSchemePref = "omniclone" | "omnifocus" | "both";
export type CellValue = string | number | boolean | null;

export interface TextStyle {
  fontFamily: string;
  fontSize: number;
  fontWeight: "normal" | "bold" | number;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string;
  backgroundColor: string | null;
  alignment: Alignment;
  lineHeight: number;
  paragraphSpacing: number;
}

export interface Column {
  id: string;
  title: string;
  type: ColumnType;
  width: number;
  visible: boolean;
  isTopic: boolean;
  summary: ColumnSummary;
  format?: string;
  decimals?: number;
  popupOptions?: string[];
  style?: Partial<TextStyle>;
}

export interface Attachment {
  id: string;
  name: string;
  mime: string;
  dataUrl?: string;
  size: number;
  kind: "file" | "image" | "audio";
}

export interface Row {
  id: string;
  parentId: string | null;
  order: number;
  topic: string;
  note: string;
  status: StatusValue;
  statusMode: StatusMode;
  collapsed: boolean;
  noteExpanded: boolean;
  cells: Record<string, CellValue>;
  namedStyleIds: string[];
  localStyle?: Partial<TextStyle>;
  attachments: Attachment[];
  createdAt: string;
  updatedAt: string;
}

export interface NamedStyle {
  id: string;
  name: string;
  style: Partial<TextStyle>;
  shortcut?: string;
}

export interface StructuralStyles {
  wholeDocument: Partial<TextStyle>;
  levelStyles: Record<number, Partial<TextStyle>>;
  columnTitles: Partial<TextStyle>;
  notes: Partial<TextStyle>;
  topic: Partial<TextStyle>;
}

export type FilterField = "topic" | "note" | "status" | "column";
export type FilterOp =
  | "contains"
  | "equals"
  | "startsWith"
  | "endsWith"
  | "checked"
  | "unchecked"
  | "gt"
  | "lt"
  | "empty"
  | "notEmpty";

export interface FilterRule {
  id: string;
  field: FilterField;
  columnId?: string;
  op: FilterOp;
  value?: string | number | boolean;
}

export interface SavedFilter {
  id: string;
  name: string;
  rules: FilterRule[];
  match: "all" | "any";
}

export interface SortSpec {
  columnId: "topic" | "note" | "status" | string;
  direction: "asc" | "desc";
}

export interface OutlineDocument {
  id: string;
  title: string;
  documentName: string;
  rows: Row[];
  columns: Column[];
  styles: StructuralStyles;
  namedStyles: NamedStyle[];
  filters: SavedFilter[];
  themeId: string;
  showStatus: boolean;
  showNotesColumn: boolean;
  notesDisplay: NoteDisplay;
  notesSpanColumns: boolean;
  columnHeaders: ColumnHeadersMode;
  fullRowText: FullRowTextMode;
  numbering: { style: RowNumberStyle; suffix: RowNumberSuffix };
  indentChildren: boolean;
  alternateRows: boolean;
  horizontalGrid: boolean;
  verticalGrid: boolean;
  rowPadding: number;
  zoom: number;
  typewriterMode: boolean;
  foldedEditing: boolean;
  keepSorted: SortSpec | null;
  encryption?: { enabled: boolean; hint: string };
  createdAt: string;
  updatedAt: string;
}

export interface Template {
  id: string;
  name: string;
  builtIn: boolean;
  isDefault: boolean;
  themeOnly?: boolean;
  document: Partial<OutlineDocument>;
}

export interface Preferences {
  tabIndents: boolean;
  returnCreatesRow: boolean;
  newRowsCreated: NewRowPlacement;
  escapeEndsEditing: boolean;
  namedStyleModifier: "control" | "command";
  appearance: Appearance;
  defaultTemplateId: string;
  notebookUrl: string;
  omnicloneScheme: OmniCloneSchemePref;
  omniplanUrl: string;
  omnioutlinerScheme: string;
}

export interface AppState {
  version: string;
  documents: OutlineDocument[];
  templates: Template[];
  preferences: Preferences;
  recentDocumentIds: string[];
}

export interface VisibleRow {
  row: Row;
  depth: number;
  number: string;
  hasChildren: boolean;
  effectiveStatus: StatusValue;
}

export interface DocumentStats {
  rows: number;
  visibleRows: number;
  words: number;
  characters: number;
  checked: number;
  notes: number;
}

export interface FindHit {
  rowId: string;
  field: "topic" | "note" | string;
  start: number;
  end: number;
}

export const DEFAULT_TEXT_STYLE: TextStyle = {
  fontFamily: "Helvetica Neue",
  fontSize: 13,
  fontWeight: "normal",
  italic: false,
  underline: false,
  strikethrough: false,
  color: "#1d1d1f",
  backgroundColor: null,
  alignment: "left",
  lineHeight: 1.35,
  paragraphSpacing: 0,
};

export const DEFAULT_PREFERENCES: Preferences = {
  tabIndents: true,
  returnCreatesRow: true,
  newRowsCreated: "below",
  escapeEndsEditing: true,
  namedStyleModifier: "control",
  appearance: "system",
  defaultTemplateId: "blank",
  notebookUrl: "http://127.0.0.1:8799",
  omnicloneScheme: "omniclone",
  omniplanUrl: "http://127.0.0.1:4577",
  omnioutlinerScheme: "omnioutliner",
};

export const DEFAULT_STRUCTURAL_STYLES: StructuralStyles = {
  wholeDocument: { fontFamily: "Helvetica Neue", fontSize: 13, color: "#1d1d1f" },
  levelStyles: {
    1: { fontSize: 18, fontWeight: "bold", color: "#1d1d1f" },
    2: { fontSize: 15, fontWeight: "bold", color: "#3a3a3c" },
    3: { fontSize: 13, fontWeight: "bold", color: "#48484a" },
  },
  columnTitles: { fontSize: 11, fontWeight: "bold", color: "#6e6e73" },
  notes: { fontSize: 12, italic: true, color: "#6e6e73" },
  topic: {},
};

export const BUILTIN_NAMED_STYLES: NamedStyle[] = [
  { id: "heading-1", name: "Heading 1", style: { fontSize: 22, fontWeight: "bold" }, shortcut: "1" },
  { id: "heading-2", name: "Heading 2", style: { fontSize: 17, fontWeight: "bold" }, shortcut: "2" },
  { id: "heading-3", name: "Heading 3", style: { fontSize: 14, fontWeight: "bold" }, shortcut: "3" },
  { id: "highlight", name: "Highlight", style: { backgroundColor: "#fff3bf" }, shortcut: "4" },
  { id: "emphasis", name: "Emphasis", style: { italic: true, color: "#c2410c" }, shortcut: "5" },
  { id: "code", name: "Code", style: { fontFamily: "ui-monospace, SFMono-Regular, Menlo, monospace", fontSize: 12, backgroundColor: "#f3f4f6" }, shortcut: "6" },
  { id: "done", name: "Done", style: { strikethrough: true, color: "#8e8e93" }, shortcut: "7" },
];
