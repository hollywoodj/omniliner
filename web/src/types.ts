export type ColumnType = "richText" | "text" | "number" | "duration" | "date" | "checkbox" | "popup";
export type StatusValue = "checked" | "unchecked" | "mixed" | "none";
export type SidebarTab = "sections" | "styles" | "filters";
export type InspectorGroup = "selection" | "document";
export type CellValue = string | number | boolean | null;

export type Column = {
  id: string;
  title: string;
  type: ColumnType;
  width: number;
  visible: boolean;
  isTopic: boolean;
  summary: "none" | "total" | "average" | "minimum" | "maximum" | "hidden";
  format?: string;
  decimals?: number;
  popupOptions?: string[];
};

export type Row = {
  id: string;
  parentId: string | null;
  order: number;
  topic: string;
  note: string;
  status: StatusValue;
  statusMode: "explicit" | "calculated" | "none";
  collapsed: boolean;
  noteExpanded: boolean;
  cells: Record<string, CellValue>;
  namedStyleIds: string[];
  localStyle?: Record<string, unknown>;
  attachments: { id: string; name: string; mime: string; dataUrl?: string; size: number; kind: string }[];
};

export type NamedStyle = { id: string; name: string; style: Record<string, unknown>; shortcut?: string };
export type SavedFilter = { id: string; name: string; match: "all" | "any"; rules: { id: string; field: string; op: string; value?: string | number | boolean; columnId?: string }[] };

export type OutlineDocument = {
  id: string;
  title: string;
  documentName: string;
  rows: Row[];
  columns: Column[];
  styles: {
    wholeDocument: Record<string, unknown>;
    levelStyles: Record<number, Record<string, unknown>>;
    columnTitles: Record<string, unknown>;
    notes: Record<string, unknown>;
    topic: Record<string, unknown>;
  };
  namedStyles: NamedStyle[];
  filters: SavedFilter[];
  themeId: string;
  showStatus: boolean;
  showNotesColumn: boolean;
  notesDisplay: "inline" | "pane";
  notesSpanColumns: boolean;
  columnHeaders: "show" | "automatic" | "hide";
  fullRowText: "always" | "whenEditing";
  numbering: { style: string; suffix: string };
  indentChildren: boolean;
  alternateRows: boolean;
  horizontalGrid: boolean;
  verticalGrid: boolean;
  rowPadding: number;
  zoom: number;
  typewriterMode: boolean;
  foldedEditing: boolean;
  keepSorted: { columnId: string; direction: "asc" | "desc" } | null;
  stats?: { rows: number; words: number; characters: number; checked: number; notes: number };
  createdAt: string;
  updatedAt: string;
};

export type Preferences = {
  tabIndents: boolean;
  returnCreatesRow: boolean;
  newRowsCreated: "below" | "inside" | "above";
  escapeEndsEditing: boolean;
  namedStyleModifier: "control" | "command";
  appearance: "system" | "light" | "dark";
  defaultTemplateId: string;
  notebookUrl: string;
  omnicloneScheme: "omniclone" | "omnifocus" | "both";
  omniplanUrl: string;
  omnioutlinerScheme: string;
};

export type Template = { id: string; name: string; builtIn: boolean; isDefault: boolean; themeOnly?: boolean };
export type DocSummary = { id: string; title: string; rowCount: number; columnCount: number; updatedAt: string; themeId: string };
