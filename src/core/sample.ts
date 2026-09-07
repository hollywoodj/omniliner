import { blankColumn, blankDocument, blankRow } from "./factory.js";
import { nowIso } from "./ids.js";
import { BUILTIN_NAMED_STYLES, DEFAULT_STRUCTURAL_STYLES, type OutlineDocument, type Template } from "./types.js";

function due(days: number): string {
  const d = new Date();
  d.setDate(d.getDate() + days);
  return d.toISOString().slice(0, 10);
}

export function productLaunchDocument(): OutlineDocument {
  const status = blankColumn({ id: "statuscol", title: "State", type: "popup", width: 120, popupOptions: ["Not started", "In progress", "Blocked", "Done"] });
  const owner = blankColumn({ id: "owner", title: "Owner", type: "popup", width: 110, popupOptions: ["Alex", "Jordan", "Sam", "Taylor"] });
  const dueCol = blankColumn({ id: "due", title: "Due", type: "date", width: 110, format: "short" });
  const estimate = blankColumn({ id: "estimate", title: "Estimate", type: "duration", width: 100, summary: "total" });
  const cost = blankColumn({ id: "cost", title: "Cost", type: "number", width: 90, decimals: 0, summary: "total" });
  const done = blankColumn({ id: "done", title: "Done", type: "checkbox", width: 70, summary: "total" });

  const rows: ReturnType<typeof blankRow>[] = [];
  const add = (partial: Parameters<typeof blankRow>[0]) => {
    const row = blankRow(partial);
    rows.push(row);
    return row;
  };

  const launch = add({ topic: "Atlas 6.2 launch", status: "unchecked", statusMode: "calculated", namedStyleIds: ["heading-1"], note: "OmniOutliner-style working outline. Send branches to OmniClone or Notebook from Organize → Share." });
  const product = add({ parentId: launch.id, topic: "Product", namedStyleIds: ["heading-2"], order: 0 });
  add({ parentId: product.id, topic: "Freeze feature list", status: "checked", statusMode: "explicit", order: 0, cells: { statuscol: "Done", owner: "Alex", due: due(-3), estimate: "4h", cost: 0, done: true }, note: "Signed off in Notebook note for the launch brief." });
  add({ parentId: product.id, topic: "Write release notes", status: "unchecked", statusMode: "explicit", order: 1, cells: { statuscol: "In progress", owner: "Jordan", due: due(2), estimate: "6h", cost: 0, done: false }, note: "Include column types, saved filters, and OmniClone send." });
  add({ parentId: product.id, topic: "Record intro video", status: "unchecked", statusMode: "explicit", order: 2, cells: { statuscol: "Not started", owner: "Sam", due: due(5), estimate: "3h", cost: 400, done: false } });

  const eng = add({ parentId: launch.id, topic: "Engineering", namedStyleIds: ["heading-2"], order: 1 });
  add({ parentId: eng.id, topic: "OPML round-trip tests", status: "checked", statusMode: "explicit", order: 0, cells: { statuscol: "Done", owner: "Taylor", due: due(-1), estimate: "2h", cost: 0, done: true } });
  add({ parentId: eng.id, topic: "URL scheme handlers", status: "unchecked", statusMode: "explicit", order: 1, cells: { statuscol: "In progress", owner: "Taylor", due: due(1), estimate: "5h", cost: 0, done: false }, note: "omnioutliner:///add and /paste, plus omniclone:///add." });
  add({ parentId: eng.id, topic: "Notebook REST send", status: "unchecked", statusMode: "explicit", order: 2, cells: { statuscol: "Not started", owner: "Alex", due: due(3), estimate: "3h", cost: 0, done: false } });

  const goToMarket = add({ parentId: launch.id, topic: "Go to market", namedStyleIds: ["heading-2"], order: 2 });
  add({ parentId: goToMarket.id, topic: "Update website features page", status: "unchecked", statusMode: "explicit", order: 0, cells: { statuscol: "Not started", owner: "Jordan", due: due(4), estimate: "4h", cost: 0, done: false } });
  add({ parentId: goToMarket.id, topic: "Email existing OmniClone users", status: "unchecked", statusMode: "explicit", order: 1, cells: { statuscol: "Not started", owner: "Sam", due: due(6), estimate: "2h", cost: 0, done: false } });

  return blankDocument({
    title: "Atlas 6.2 Launch",
    documentName: "Atlas 6.2 Launch.ooutline",
    rows,
    columns: [
      { id: "topic", title: "Topic", type: "richText", width: 360, visible: true, isTopic: true, summary: "none" },
      status,
      owner,
      dueCol,
      estimate,
      cost,
      done,
    ],
    showStatus: true,
    numbering: { style: "outline", suffix: "period" },
    alternateRows: true,
    filters: [
      {
        id: "open-work",
        name: "Open work",
        match: "all",
        rules: [{ id: "r1", field: "status", op: "unchecked" }],
      },
      {
        id: "engineering",
        name: "Engineering",
        match: "all",
        rules: [{ id: "r2", field: "topic", op: "contains", value: "URL" }],
      },
    ],
  });
}

export function meetingAgendaDocument(): OutlineDocument {
  const duration = blankColumn({ id: "mins", title: "Minutes", type: "number", width: 90, decimals: 0, summary: "total" });
  const presenter = blankColumn({ id: "who", title: "Presenter", type: "popup", width: 120, popupOptions: ["Alex", "Jordan", "Sam"] });
  const rows: ReturnType<typeof blankRow>[] = [];
  const add = (partial: Parameters<typeof blankRow>[0]) => {
    const row = blankRow(partial);
    rows.push(row);
    return row;
  };
  const agenda = add({ topic: "Monday staff meeting", namedStyleIds: ["heading-1"], note: "Conference room B · 10:00" });
  add({ parentId: agenda.id, topic: "Wins from last week", order: 0, cells: { mins: 10, who: "Alex" } });
  add({ parentId: agenda.id, topic: "Launch blockers", order: 1, cells: { mins: 20, who: "Jordan" }, note: "Bring OmniClone inbox snapshot." });
  add({ parentId: agenda.id, topic: "Notebook tags cleanup", order: 2, cells: { mins: 10, who: "Sam" } });
  add({ parentId: agenda.id, topic: "Next actions", order: 3, cells: { mins: 10, who: "Alex" }, status: "unchecked", statusMode: "explicit" });
  return blankDocument({
    title: "Staff Meeting",
    documentName: "Staff Meeting.ooutline",
    rows,
    columns: [
      { id: "topic", title: "Topic", type: "richText", width: 420, visible: true, isTopic: true, summary: "none" },
      presenter,
      duration,
    ],
    numbering: { style: "decimal", suffix: "period" },
    themeId: "meeting",
  });
}

export function blankTemplateDocument(): OutlineDocument {
  return blankDocument({ title: "Untitled", rows: [blankRow({ topic: "" })] });
}

export function builtinTemplates(): Template[] {
  return [
    { id: "blank", name: "Blank", builtIn: true, isDefault: true, document: blankTemplateDocument() },
    { id: "launch", name: "Project Launch", builtIn: true, isDefault: false, document: productLaunchDocument() },
    { id: "meeting", name: "Meeting Agenda", builtIn: true, isDefault: false, document: meetingAgendaDocument() },
    {
      id: "classic-theme",
      name: "Classic",
      builtIn: true,
      isDefault: false,
      themeOnly: true,
      document: { themeId: "classic", styles: DEFAULT_STRUCTURAL_STYLES, namedStyles: BUILTIN_NAMED_STYLES },
    },
    {
      id: "modern-theme",
      name: "Modern",
      builtIn: true,
      isDefault: false,
      themeOnly: true,
      document: {
        themeId: "modern",
        styles: {
          ...DEFAULT_STRUCTURAL_STYLES,
          wholeDocument: { fontFamily: "Inter, Helvetica Neue, sans-serif", fontSize: 13, color: "#111827" },
          levelStyles: {
            1: { fontSize: 20, fontWeight: "bold", color: "#111827" },
            2: { fontSize: 15, fontWeight: "bold", color: "#e8772e" },
          },
        },
      },
    },
    {
      id: "legal-theme",
      name: "Legal",
      builtIn: true,
      isDefault: false,
      themeOnly: true,
      document: {
        themeId: "legal",
        numbering: { style: "outline", suffix: "period" },
        styles: {
          ...DEFAULT_STRUCTURAL_STYLES,
          wholeDocument: { fontFamily: "Times New Roman, Times, serif", fontSize: 14 },
        },
      },
    },
  ];
}

export function applyTheme(doc: OutlineDocument, template: Template): OutlineDocument {
  const src = template.document;
  return {
    ...doc,
    themeId: src.themeId ?? template.id,
    styles: src.styles ? structuredClone(src.styles) : doc.styles,
    namedStyles: src.namedStyles ? structuredClone(src.namedStyles) : doc.namedStyles,
    numbering: src.numbering ?? doc.numbering,
    alternateRows: src.alternateRows ?? doc.alternateRows,
    updatedAt: nowIso(),
  };
}
