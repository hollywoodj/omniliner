import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, MouseEvent } from "react";
import { api } from "./api";
import { AboutSheet, ExportSheet, FindSheet, PreferencesSheet, ResourceBrowser } from "./Dialogs";
import { I } from "./icons";
import { Inspector } from "./Inspector";
import { OutlineView } from "./Outline";
import { Sidebar } from "./Sidebar";
import { flatten, keywordMatches } from "./outlineView";
import type { DocSummary, InspectorGroup, OutlineDocument, Preferences, Row, SidebarTab, Template } from "./types";

type MenuId = string | null;

export default function App() {
  const [docs, setDocs] = useState<DocSummary[]>([]);
  const [doc, setDoc] = useState<OutlineDocument | null>(null);
  const [prefs, setPrefs] = useState<Preferences | null>(null);
  const [templates, setTemplates] = useState<Template[]>([]);
  const [selected, setSelected] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedColumn, setSelectedColumn] = useState<string | null>("topic");
  const [sidebar, setSidebar] = useState(true);
  const [inspector, setInspector] = useState(true);
  const [toolbar, setToolbar] = useState(true);
  const [sidebarTab, setSidebarTab] = useState<SidebarTab>("sections");
  const [inspGroup, setInspGroup] = useState<InspectorGroup>("selection");
  const [focusIds, setFocusIds] = useState<string[]>([]);
  const [filterId, setFilterId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [menu, setMenu] = useState<MenuId>(null);
  const [sheet, setSheet] = useState<string | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [findQ, setFindQ] = useState("");
  const [findR, setFindR] = useState("");
  const [findHits, setFindHits] = useState<{ rowId: string; field: string; start: number; end: number }[]>([]);
  const [findIndex, setFindIndex] = useState(0);
  const [ctx, setCtx] = useState<{ x: number; y: number; id: string } | null>(null);
  const [distraction, setDistraction] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const undo = useRef<OutlineDocument[]>([]);
  const redo = useRef<OutlineDocument[]>([]);

  const notify = (s: string) => {
    setToast(s);
    setTimeout(() => setToast(null), 3800);
  };

  const load = async (id?: string) => {
    const state = await api.state();
    setPrefs(state.preferences);
    setTemplates(state.templates);
    setDocs(state.documents);
    const pick = id || state.recentDocumentIds[0] || state.documents[0]?.id;
    if (pick) setDoc(await api.document(pick));
  };

  useEffect(() => {
    load().catch((e) => notify(String(e)));
  }, []);

  useEffect(() => {
    const bridge = (window as unknown as { omnilinerDesktop?: { onOpenUrl?: (cb: (url: string) => void) => () => void } }).omnilinerDesktop;
    const handler = (url: string) => {
      api.openUrl(url).then((result) => {
        if (result.document) {
          setDoc(result.document);
          if (result.ids?.length) setSelected(result.ids);
        }
      }).catch(() => undefined);
    };
    const q = new URLSearchParams(location.search).get("url") || location.hash.replace(/^#/, "");
    if (q && q.includes(":")) handler(q);
    return bridge?.onOpenUrl?.(handler);
  }, []);

  const pushUndo = (current: OutlineDocument) => {
    undo.current = [...undo.current.slice(-40), structuredClone(current)];
    redo.current = [];
  };

  const apply = (next: OutlineDocument) => {
    if (doc) pushUndo(doc);
    setDoc(next);
    if (next.keepSorted) {
      api.command(next.id, "sort", { spec: next.keepSorted }).then(setDoc).catch(() => undefined);
    }
  };

  const run = async (command: string, body: Record<string, unknown> = {}) => {
    if (!doc) return;
    pushUndo(doc);
    const next = await api.command(doc.id, command, { ids: selected, ...body });
    setDoc(next);
    return next;
  };

  const savePatch = async (patch: Partial<OutlineDocument>) => {
    if (!doc) return;
    pushUndo(doc);
    setDoc(await api.patchDocument(doc.id, patch));
  };

  const patchRow = async (id: string, patch: Partial<Row>) => {
    if (!doc) return;
    setDoc(await api.patchRow(doc.id, id, patch));
  };

  const onSelect = (id: string, e?: MouseEvent) => {
    if (e?.shiftKey) setSelected((s) => (s.includes(id) ? s : [...s, id]));
    else setSelected([id]);
    setCtx(null);
  };

  const selectedRows = doc ? doc.rows.filter((r) => selected.includes(r.id)) : [];
  const selectedCol = doc?.columns.find((c) => c.id === selectedColumn) || null;

  const matchIds = useMemo(() => {
    if (!doc) return undefined;
    if (filterId) {
      const f = doc.filters.find((x) => x.id === filterId);
      if (!f) return undefined;
      const hits = new Set<string>();
      for (const row of doc.rows) {
        const ok = f.rules.every((rule) => {
          const text = rule.field === "note" ? row.note : rule.field === "status" ? row.status : row.topic;
          if (rule.op === "unchecked") return row.status !== "checked";
          if (rule.op === "checked") return row.status === "checked";
          if (rule.op === "contains") return text.toLowerCase().includes(String(rule.value ?? "").toLowerCase());
          return true;
        });
        if (ok) hits.add(row.id);
      }
      return hits;
    }
    if (query.trim()) return keywordMatches(doc, query);
    return undefined;
  }, [doc, filterId, query]);

  const addRow = async (placement?: "below" | "above" | "inside" | "outside") => {
    if (!doc) return;
    const place = placement || prefs?.newRowsCreated || "below";
    const next = await api.addRow(doc.id, { relativeId: selected[0] || null, placement: place, topic: "" });
    apply(next);
    const created = next.rows.find((r) => !doc.rows.some((o) => o.id === r.id));
    if (created) {
      setSelected([created.id]);
      setEditingId(created.id);
    }
  };

  const openExternal = async (url: string) => {
    const bridge = (window as unknown as { omnilinerDesktop?: { openExternal?: (u: string) => void } }).omnilinerDesktop;
    if (bridge?.openExternal) bridge.openExternal(url);
    else window.open(url, "_blank");
  };

  const sendOmniClone = async () => {
    if (!doc) return;
    const r = await api.sendOmniClone(doc.id, selected);
    for (const url of r.urls) await openExternal(url);
    await navigator.clipboard.writeText(r.taskPaper).catch(() => undefined);
    notify(r.urls.length ? "Sent to OmniClone. TaskPaper copied." : "Copied TaskPaper.");
  };

  const sendNotebook = async () => {
    if (!doc) return;
    const r = await api.sendNotebook(doc.id, selected);
    if (r.ok && r.url) {
      await openExternal(r.url);
      notify(`Created Notebook note ${r.url}`);
    } else {
      await navigator.clipboard.writeText(r.payload.content);
      notify(r.error ? `Notebook offline — HTML copied. ${r.error}` : "Copied HTML for Notebook.");
    }
  };

  const copyLink = async () => {
    const id = selected[0];
    if (!id) return;
    const url = `omnioutliner:///open?row=${id}`;
    await navigator.clipboard.writeText(url);
    notify(`Copied ${url}`);
  };

  const doFind = async (q = findQ) => {
    if (!doc) return;
    const r = await api.find(doc.id, q);
    setFindHits(r.hits);
    setFindIndex(0);
    if (r.hits[0]) {
      setSelected([r.hits[0].rowId]);
      setEditingId(r.hits[0].rowId);
    }
  };

  const jumpHit = (dir: 1 | -1) => {
    if (!findHits.length) return;
    const i = (findIndex + dir + findHits.length) % findHits.length;
    setFindIndex(i);
    setSelected([findHits[i].rowId]);
  };

  const doExport = (fmt: string) => {
    if (!doc) return;
    const a = document.createElement("a");
    a.href = api.exportUrl(doc.id, fmt);
    a.download = "";
    a.click();
    setSheet(null);
  };

  const onImportFile = async (file: File) => {
    const text = await file.text();
    const imported = await api.importText(text, file.name);
    setDoc(imported);
    setDocs((d) => [{ id: imported.id, title: imported.title, rowCount: imported.rows.length, columnCount: imported.columns.length, updatedAt: imported.updatedAt, themeId: imported.themeId }, ...d]);
    notify(`Imported ${file.name}`);
  };

  const dropRow = async (rowId: string, targetId: string, position: "before" | "after" | "inside") => {
    if (!doc) return;
    const target = doc.rows.find((r) => r.id === targetId);
    if (!target) return;
    // Use indent/outdent/move approximations via save of parent/order
    const moving = doc.rows.find((r) => r.id === rowId);
    if (!moving) return;
    const next = structuredClone(doc);
    const row = next.rows.find((r) => r.id === rowId)!;
    if (position === "inside") {
      row.parentId = targetId;
      row.order = next.rows.filter((r) => r.parentId === targetId).length;
    } else {
      row.parentId = target.parentId;
      row.order = target.order + (position === "after" ? 1 : 0);
    }
    setDoc(await api.saveDocument(next));
  };

  useEffect(() => {
    const onKey = (e: globalThis.KeyboardEvent) => {
      const meta = e.metaKey || e.ctrlKey;
      const el = e.target as HTMLElement;
      const inField = el.tagName === "INPUT" || el.tagName === "TEXTAREA" || el.tagName === "SELECT";
      if (meta && e.key === ",") { e.preventDefault(); setSheet("prefs"); }
      if (meta && e.key.toLowerCase() === "n" && !e.shiftKey) { e.preventDefault(); setSheet("new"); }
      if (meta && e.shiftKey && e.key.toLowerCase() === "n") { e.preventDefault(); setSheet("new"); }
      if (meta && e.key.toLowerCase() === "f" && !e.shiftKey && !e.altKey) { e.preventDefault(); setSheet("find"); }
      if (meta && e.altKey && e.key.toLowerCase() === "f") { e.preventDefault(); (document.querySelector(".toolbar .search") as HTMLInputElement | null)?.focus(); }
      if (meta && e.shiftKey && e.key.toLowerCase() === "i") { e.preventDefault(); setInspector((s) => !s); }
      if (meta && e.altKey && e.key === "1") { e.preventDefault(); setSidebar((s) => !s); }
      if (meta && e.key.toLowerCase() === "i" && !e.shiftKey && inField) return;
      if (meta && e.key.toLowerCase() === "b") { e.preventDefault(); run("localStyle", { style: { fontWeight: "bold" } }); }
      if (meta && e.key.toLowerCase() === "i" && !e.shiftKey) { e.preventDefault(); run("localStyle", { style: { italic: true } }); }
      if (meta && e.key.toLowerCase() === "u") { e.preventDefault(); run("localStyle", { style: { underline: true } }); }
      if (meta && e.key === "]") { e.preventDefault(); run("indent"); }
      if (meta && e.key === "[") { e.preventDefault(); run("outdent"); }
      if (meta && e.key === "}") { e.preventDefault(); addRow("inside"); }
      if (meta && e.key === "{") { e.preventDefault(); addRow("outside"); }
      if (meta && e.key === "9") { e.preventDefault(); e.altKey ? run("expand", { completely: true }) : e.ctrlKey ? run("expandAll") : run("expand"); }
      if (meta && e.key === "0") { e.preventDefault(); e.altKey ? run("collapse", { completely: true }) : e.ctrlKey ? run("collapseAll") : run("collapse"); }
      if (meta && e.shiftKey && e.key.toLowerCase() === "f") { e.preventDefault(); e.altKey ? setFocusIds([]) : setFocusIds(selected); }
      if (meta && e.altKey && e.key.toLowerCase() === "g") { e.preventDefault(); run("group"); }
      if (meta && e.altKey && e.key.toLowerCase() === "u") { e.preventDefault(); run("ungroup"); }
      if (meta && e.key.toLowerCase() === "d") { e.preventDefault(); run("duplicate"); }
      if (meta && e.key.toLowerCase() === "z") {
        e.preventDefault();
        if (e.shiftKey) {
          const n = redo.current.pop();
          if (n && doc) { undo.current.push(doc); setDoc(n); api.saveDocument(n).then(setDoc); }
        } else {
          const n = undo.current.pop();
          if (n && doc) { redo.current.push(doc); setDoc(n); api.saveDocument(n).then(setDoc); }
        }
      }
      if (e.key === "Tab" && prefs?.tabIndents && !e.altKey) {
        e.preventDefault();
        run(e.shiftKey ? "outdent" : "indent");
      }
      if (e.key === "Enter" && prefs?.returnCreatesRow && el.tagName !== "TEXTAREA") {
        e.preventDefault();
        addRow(e.shiftKey ? "above" : prefs.newRowsCreated);
      }
      if (e.key === "Escape") {
        setMenu(null);
        setCtx(null);
        setEditingId(null);
        if (distraction) setDistraction(false);
      }
      if ((e.key === "Delete" || e.key === "Backspace") && !inField) {
        e.preventDefault();
        if (doc && selected.length) {
          fetch(`/api/documents/${doc.id}/rows/delete`, {
            method: "POST",
            headers: { "content-type": "application/json" },
            body: JSON.stringify({ ids: selected }),
          })
            .then((r) => r.json())
            .then((n) => {
              setDoc(n);
              setSelected([]);
            });
        }
      }
      if (meta && e.ctrlKey && ["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight"].includes(e.key)) {
        e.preventDefault();
        const map: Record<string, string> = { ArrowUp: "moveUp", ArrowDown: "moveDown", ArrowLeft: "outdent", ArrowRight: "indent" };
        run(map[e.key]);
      }
      if (e.ctrlKey && !meta && /^[1-7]$/.test(e.key) && prefs?.namedStyleModifier === "control") {
        const style = doc?.namedStyles.find((s) => s.shortcut === e.key);
        if (style) { e.preventDefault(); run("namedStyle", { styleId: style.id }); }
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [prefs, selected, doc, distraction]);

  if (!doc || !prefs) {
    return <div className="app" style={{ placeItems: "center", display: "grid" }}>Opening OmniOutliner…</div>;
  }

  const stats = doc.stats || { rows: doc.rows.length, words: 0, characters: 0, checked: 0, notes: 0 };
  const vis = flatten(doc, { focusIds, matchIds });
  const current = selectedRows[0];

  const Item = ({ label, shortcut, action, disabled }: { label: string; shortcut?: string; action?: () => void; disabled?: boolean }) => (
    <button className={disabled ? "disabled" : ""} onClick={() => { action?.(); setMenu(null); }}>
      {label}
      {shortcut && <span className="kbd">{shortcut}</span>}
    </button>
  );

  const stamp = async (kind: "short-date" | "long-date" | "time" | "short-datetime" | "long-datetime") => {
    if (!current) return;
    const now = new Date();
    const text =
      kind === "short-date" ? now.toLocaleDateString() :
      kind === "long-date" ? now.toLocaleDateString(undefined, { dateStyle: "long" }) :
      kind === "time" ? now.toLocaleTimeString() :
      kind === "short-datetime" ? `${now.toLocaleDateString()} ${now.toLocaleTimeString(undefined, { timeStyle: "short" })}` :
      now.toLocaleString(undefined, { dateStyle: "long", timeStyle: "medium" });
    await patchRow(current.id, { topic: `${current.topic} ${text}`.trim() });
  };

  return (
    <div className={`app ${doc.horizontalGrid ? "doc-hgrid" : ""} ${doc.verticalGrid ? "doc-vgrid" : ""} ${distraction ? "df" : ""}`} style={{ zoom: String(doc.zoom) } as CSSProperties} onClick={() => { setMenu(null); setCtx(null); }}>
      <div className="menubar" onClick={(e) => e.stopPropagation()}>
        <div className="traffic"><i className="r" /><i className="y" /><i className="g" /></div>
        {([
          ["app", "OmniOutliner"],
          ["file", "File"],
          ["edit", "Edit"],
          ["format", "Format"],
          ["view", "View"],
          ["organize", "Organize"],
          ["automation", "Automation"],
          ["window", "Window"],
          ["help", "Help"],
        ] as const).map(([id, label]) => (
          <div key={id} className={`menu ${menu === id ? "open" : ""} ${id === "app" ? "app-name" : ""}`} onClick={() => setMenu(menu === id ? null : id)}>
            {label}
            <div className="menu-panel">
              {id === "app" && (
                <>
                  <Item label="About OmniOutliner" action={() => setSheet("about")} />
                  <div className="sep" />
                  <Item label="Settings…" shortcut="⌘," action={() => setSheet("prefs")} />
                  <Item label="Keyboard Shortcuts…" action={() => setSheet("prefs")} />
                  <div className="sep" />
                  <Item label="Hide OmniOutliner" shortcut="⌘H" />
                  <Item label="Quit OmniOutliner" shortcut="⌘Q" />
                </>
              )}
              {id === "file" && (
                <>
                  <Item label="New" shortcut="⌘N" action={() => setSheet("new")} />
                  <Item label="Resource Browser" shortcut="⇧⌘N" action={() => setSheet("new")} />
                  <Item label="Open…" shortcut="⌘O" action={() => fileRef.current?.click()} />
                  <div className="label">Open Recent</div>
                  {docs.map((d) => <Item key={d.id} label={d.title} action={() => load(d.id)} />)}
                  <div className="sep" />
                  <Item label="Close" shortcut="⌘W" />
                  <Item label="Save" shortcut="⌘S" action={() => api.saveDocument(doc).then(setDoc)} />
                  <Item label="Export…" shortcut="⌥⌘E" action={() => setSheet("export")} />
                  <Item label="Save as Template" action={() => fetch("/api/templates", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId: doc.id }) }).then(() => notify("Saved template"))} />
                  <div className="sep" />
                  <Item label="Share → Send to OmniClone" action={sendOmniClone} />
                  <Item label="Share → Send to Notebook" action={sendNotebook} />
                  <Item label="Page Setup…" shortcut="⇧⌘P" />
                  <Item label="Print…" shortcut="⌘P" action={() => window.print()} />
                </>
              )}
              {id === "edit" && (
                <>
                  <Item label="Undo" shortcut="⌘Z" />
                  <Item label="Redo" shortcut="⇧⌘Z" />
                  <div className="sep" />
                  <Item label="Cut" shortcut="⌘X" />
                  <Item label="Copy" shortcut="⌘C" />
                  <Item label="Copy as Link" action={copyLink} />
                  <Item label="Paste" shortcut="⌘V" />
                  <Item label="Duplicate Selection" shortcut="⌘D" action={() => run("duplicate")} />
                  <Item label="Delete" action={async () => {
                    const n = await fetch(`/api/documents/${doc.id}/rows/delete`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ ids: selected }) }).then((r) => r.json());
                    setDoc(n); setSelected([]);
                  }} />
                  <div className="sep" />
                  <div className="label">Set Status</div>
                  <Item label="Checked" action={() => run("status", { status: "checked" })} />
                  <Item label="Unchecked" action={() => run("status", { status: "unchecked" })} />
                  <Item label="Calculated" action={() => run("status", { status: "calculated" })} />
                  <Item label="None" action={() => run("status", { status: "none" })} />
                  <div className="sep" />
                  <Item label="Edit Note" shortcut="⌘'" action={() => current && patchRow(current.id, { noteExpanded: true })} />
                  <Item label="Add Link…" shortcut="⌘K" action={() => {
                    const href = prompt("URL", "https://");
                    if (href && current) patchRow(current.id, { topic: `${current.topic} ${href}` });
                  }} />
                  <div className="label">Insert Time Stamp</div>
                  <Item label="Short Date" shortcut="⌘/" action={() => stamp("short-date")} />
                  <Item label="Long Date" shortcut="⌥⌘/" action={() => stamp("long-date")} />
                  <Item label="Time" shortcut="⌘@" action={() => stamp("time")} />
                  <Item label="Short Date and Time" shortcut="⌘|" action={() => stamp("short-datetime")} />
                  <Item label="Long Date and Time" shortcut="⌥⌘|" action={() => stamp("long-datetime")} />
                  <div className="sep" />
                  <Item label="Find…" shortcut="⌘F" action={() => setSheet("find")} />
                  <Item label="Find Next" shortcut="⌘G" action={() => jumpHit(1)} />
                  <Item label="Find Previous" shortcut="⇧⌘G" action={() => jumpHit(-1)} />
                </>
              )}
              {id === "format" && (
                <>
                  <Item label="Copy Style" shortcut="⌥⌘C" />
                  <Item label="Paste Style" shortcut="⌥⌘V" />
                  <Item label="Clear Style" shortcut="⌃⌘⌫" action={() => run("clearStyle")} />
                  <div className="sep" />
                  <Item label="Bold" shortcut="⌘B" action={() => run("localStyle", { style: { fontWeight: "bold" } })} />
                  <Item label="Italic" shortcut="⌘I" action={() => run("localStyle", { style: { italic: true } })} />
                  <Item label="Underline" shortcut="⌘U" action={() => run("localStyle", { style: { underline: true } })} />
                  <div className="sep" />
                  <div className="label">Row Numbering</div>
                  {["none", "decimal", "upperAlpha", "lowerAlpha", "upperRoman", "lowerRoman", "outline"].map((s) => (
                    <Item key={s} label={s} action={() => savePatch({ numbering: { ...doc.numbering, style: s } })} />
                  ))}
                  <div className="sep" />
                  <Item label="Apply Template Theme…" action={() => setSheet("theme")} />
                </>
              )}
              {id === "view" && (
                <>
                  <Item label="Expand All" shortcut="⌃⌘9" action={() => run("expandAll")} />
                  <Item label="Collapse All" shortcut="⌃⌘0" action={() => run("collapseAll")} />
                  <Item label="Expand Row(s)" shortcut="⌘9" action={() => run("expand")} />
                  <Item label="Collapse Row(s)" shortcut="⌘0" action={() => run("collapse")} />
                  <div className="sep" />
                  <Item label="Focus" shortcut="⇧⌘F" action={() => setFocusIds(selected)} />
                  <Item label="Unfocus" shortcut="⌥⇧⌘F" action={() => setFocusIds([])} />
                  <Item label="Zoom In" shortcut="⌘>" action={() => savePatch({ zoom: Math.min(4, doc.zoom + 0.1) })} />
                  <Item label="Zoom Out" shortcut="⌘<" action={() => savePatch({ zoom: Math.max(0.5, doc.zoom - 0.1) })} />
                  <Item label="Zoom to Actual Size" action={() => savePatch({ zoom: 1 })} />
                  <div className="sep" />
                  <Item label={doc.showStatus ? "Hide Status Checkboxes" : "Show Status Checkboxes"} action={() => savePatch({ showStatus: !doc.showStatus })} />
                  <Item label="Use Typewriter Mode" action={() => savePatch({ typewriterMode: !doc.typewriterMode })} />
                  <Item label={doc.foldedEditing ? "Show Full Row Text: Always" : "Show Full Row Text: When Editing"} action={() => savePatch({ foldedEditing: !doc.foldedEditing, fullRowText: doc.foldedEditing ? "always" : "whenEditing" })} />
                  <Item label={doc.notesDisplay === "pane" ? "Notes: Display Inline" : "Notes: Display in Pane"} action={() => savePatch({ notesDisplay: doc.notesDisplay === "pane" ? "inline" : "pane" })} />
                  <Item label="Show/Hide All Notes" shortcut="⌃⌘'" action={() => {
                    const any = doc.rows.some((r) => r.noteExpanded);
                    Promise.all(doc.rows.map((r) => api.patchRow(doc.id, r.id, { noteExpanded: !any }))).then(() => load(doc.id));
                  }} />
                  <div className="sep" />
                  <Item label={sidebar ? "Hide Sidebar" : "Show Sidebar"} shortcut="⌥⌘1" action={() => setSidebar((s) => !s)} />
                  <Item label={inspector ? "Hide Inspector" : "Show Inspector"} shortcut="⇧⌘I" action={() => setInspector((s) => !s)} />
                  <Item label={toolbar ? "Hide Toolbar" : "Show Toolbar"} shortcut="⌥⌘T" action={() => setToolbar((s) => !s)} />
                  <Item label="Enter Full Screen" shortcut="⌃⌘F" action={() => document.documentElement.requestFullscreen?.()} />
                  <Item label="Distraction Free" action={() => setDistraction(true)} />
                </>
              )}
              {id === "organize" && (
                <>
                  <Item label="Add Row" action={() => addRow("below")} />
                  <Item label="Add Inside" shortcut="⌘}" action={() => addRow("inside")} />
                  <Item label="Add Outside" shortcut="⌘{" action={() => addRow("outside")} />
                  <Item label="Add Column" action={() => api.addColumn(doc.id, { title: "Column", type: "text" }).then(setDoc)} />
                  <Item label="Remove Column" disabled={!selectedCol || selectedCol.isTopic} action={() => selectedCol && api.deleteColumn(doc.id, selectedCol.id).then(setDoc)} />
                  <div className="sep" />
                  <div className="label">Keep Sorted</div>
                  <Item label="Clear Sorting" action={() => savePatch({ keepSorted: null })} />
                  <Item label="Topic, A-Z" action={() => savePatch({ keepSorted: { columnId: "topic", direction: "asc" } })} />
                  <Item label="Topic, Z-A" action={() => savePatch({ keepSorted: { columnId: "topic", direction: "desc" } })} />
                  <Item label="Status, Unchecked to Checked" action={() => savePatch({ keepSorted: { columnId: "status", direction: "asc" } })} />
                  <div className="label">Sort Outline</div>
                  <Item label="Topic, A-Z" action={() => run("sort", { spec: { columnId: "topic", direction: "asc" }, ids: [] })} />
                  <Item label="Topic, Z-A" action={() => run("sort", { spec: { columnId: "topic", direction: "desc" }, ids: [] })} />
                  <Item label="Status, Unchecked to Checked" action={() => run("sort", { spec: { columnId: "status", direction: "asc" }, ids: [] })} />
                  <div className="sep" />
                  <Item label="Move Up" shortcut="⌃⌘↑" action={() => run("moveUp")} />
                  <Item label="Move Down" shortcut="⌃⌘↓" action={() => run("moveDown")} />
                  <Item label="Indent" shortcut="⌘]" action={() => run("indent")} />
                  <Item label="Outdent" shortcut="⌘[" action={() => run("outdent")} />
                  <Item label="Group" shortcut="⌥⌘G" action={() => run("group")} />
                  <Item label="Ungroup" shortcut="⌥⌘U" action={() => run("ungroup")} />
                  <div className="sep" />
                  <Item label="Send to OmniClone" action={sendOmniClone} />
                  <Item label="Send to Notebook" action={sendNotebook} />
                </>
              )}
              {id === "automation" && (
                <>
                  <Item label="Show Console" action={() => notify("Automation console: POST /automation/tell")} />
                  <Item label="API Reference" action={() => openExternal("https://omni-automation.com/omnioutliner/")} />
                  <Item label="Tell OmniClone addRow" action={sendOmniClone} />
                </>
              )}
              {id === "window" && (
                <>
                  <Item label="Minimize" shortcut="⌘M" />
                  <Item label="Zoom" />
                  <div className="sep" />
                  {docs.map((d) => <Item key={d.id} label={d.title} action={() => load(d.id)} />)}
                </>
              )}
              {id === "help" && (
                <>
                  <Item label="OmniOutliner Help" action={() => openExternal("https://support.omnigroup.com/documentation/omnioutliner/universal/6.2.1/en/")} />
                  <Item label="Integration Guide" action={() => notify("See README: omnioutliner:/// and Notebook/OmniClone bridges")} />
                </>
              )}
            </div>
          </div>
        ))}
      </div>

      {toolbar && (
        <div className="toolbar">
          <button className="tool" title="Add Row" onClick={() => addRow()}>{I.addRow}</button>
          <button className="tool" title="Add Column" onClick={() => api.addColumn(doc.id, { title: "Column", type: "text" }).then(setDoc)}>{I.addCol}</button>
          <button className={`tool ${doc.showStatus ? "on" : ""}`} title="Status" onClick={() => savePatch({ showStatus: !doc.showStatus })}>{I.status}</button>
          <button className="tool" title="Notes" onClick={() => current && patchRow(current.id, { noteExpanded: !current.noteExpanded })}>{I.note}</button>
          <button className={`tool ${focusIds.length ? "on" : ""}`} title="Focus" onClick={() => setFocusIds(focusIds.length ? [] : selected)}>{I.focus}</button>
          <button className={`tool ${sidebar ? "on" : ""}`} title="Sidebar" onClick={() => setSidebar((s) => !s)}>{I.sidebar}</button>
          <button className={`tool ${inspector ? "on" : ""}`} title="Inspector" onClick={() => setInspector((s) => !s)}>{I.inspector}</button>
          <button className="tool" title="Share" onClick={sendOmniClone}>{I.share}</button>
          <input className="search" placeholder="Filter" value={query} onChange={(e) => setQuery(e.target.value)} />
        </div>
      )}

      <div className="body">
        {sidebar && (
          <Sidebar
            doc={doc}
            tab={sidebarTab}
            selected={selected}
            activeFilter={filterId}
            onTab={setSidebarTab}
            onSelect={(id) => setSelected([id])}
            onFocus={setFocusIds}
            onFilter={setFilterId}
            onNamedStyle={(id) => run("namedStyle", { styleId: id })}
          />
        )}
        <div className="outline-wrap">
          <OutlineView
            doc={doc}
            selected={selected}
            editingId={editingId}
            selectedColumn={selectedColumn}
            focusIds={focusIds}
            matchIds={matchIds}
            hit={findHits[findIndex] || null}
            onSelect={onSelect}
            onSelectColumn={setSelectedColumn}
            onEdit={setEditingId}
            onPatchRow={patchRow}
            onCell={(rowId, columnId, value) => run("setCell", { rowId, columnId, value })}
            onToggle={(id, completely) => run(doc.rows.find((r) => r.id === id)?.collapsed ? "expand" : "collapse", { ids: [id], completely })}
            onCycleStatus={(id) => run("cycleStatus", { ids: [id] })}
            onContext={(e, id) => { e.preventDefault(); setSelected([id]); setCtx({ x: e.clientX, y: e.clientY, id }); }}
            onDrop={dropRow}
            onResizeColumn={(id, width) => api.patchColumn(doc.id, id, { width }).then(setDoc)}
          />
          {doc.notesDisplay === "pane" && (
            <div className="note-pane">
              <label style={{ fontSize: 11, color: "#6e6e73" }}>Note</label>
              <textarea
                value={current?.note || ""}
                placeholder={current ? "Note for this row" : "Select a row"}
                onChange={(e) => current && patchRow(current.id, { note: e.target.value })}
              />
            </div>
          )}
        </div>
        {inspector && (
          <Inspector
            doc={doc}
            prefs={prefs}
            group={inspGroup}
            selected={selectedRows}
            selectedColumn={selectedCol}
            onGroup={setInspGroup}
            onPatchDoc={savePatch}
            onPatchRow={patchRow}
            onPatchColumn={(id, patch) => api.patchColumn(doc.id, id, patch).then(setDoc)}
            onNamedStyle={(id) => run("namedStyle", { styleId: id })}
            onAddColumn={() => api.addColumn(doc.id, { title: "Column", type: "text" }).then(setDoc)}
            onRemoveColumn={() => selectedCol && !selectedCol.isTopic && api.deleteColumn(doc.id, selectedCol.id).then(setDoc)}
          />
        )}
      </div>

      <div className="statusbar">
        <span>{doc.title}</span>
        <span>{stats.rows} rows</span>
        <span>{vis.length} visible</span>
        <span>{stats.words} words</span>
        <span>{stats.characters} characters</span>
        <span>{stats.checked} checked</span>
        {focusIds.length ? <span>Focused</span> : null}
        {filterId ? <span>Filter</span> : null}
      </div>

      {toast && <div className="toast">{toast}</div>}
      {ctx && (
        <div className="ctx" style={{ left: ctx.x, top: ctx.y }} onClick={(e) => e.stopPropagation()}>
          <button onClick={() => { addRow("below"); setCtx(null); }}>Add Row</button>
          <button onClick={() => { run("indent"); setCtx(null); }}>Indent</button>
          <button onClick={() => { run("outdent"); setCtx(null); }}>Outdent</button>
          <button onClick={() => { run("group"); setCtx(null); }}>Group</button>
          <button onClick={() => { copyLink(); setCtx(null); }}>Copy as Link</button>
          <button onClick={() => { sendOmniClone(); setCtx(null); }}>Send to OmniClone</button>
          <button onClick={() => { sendNotebook(); setCtx(null); }}>Send to Notebook</button>
        </div>
      )}

      <input ref={fileRef} type="file" hidden accept=".opml,.txt,.csv,.taskpaper,.md,.json,.xml" onChange={(e) => { const f = e.target.files?.[0]; if (f) onImportFile(f); }} />

      {sheet === "about" && <AboutSheet onClose={() => setSheet(null)} />}
      {sheet === "prefs" && <PreferencesSheet prefs={prefs} onChange={(p) => api.patchPreferences(p).then(setPrefs)} onClose={() => setSheet(null)} />}
      {sheet === "new" && (
        <ResourceBrowser
          templates={templates}
          onClose={() => setSheet(null)}
          onChoose={async (id) => {
            const t = templates.find((x) => x.id === id);
            if (t?.themeOnly) {
              await run("theme", { templateId: id });
            } else {
              const created = await api.createDocument(t?.name || "Untitled", id);
              setDoc(created);
              setDocs((d) => [{ id: created.id, title: created.title, rowCount: created.rows.length, columnCount: created.columns.length, updatedAt: created.updatedAt, themeId: created.themeId }, ...d]);
            }
            setSheet(null);
          }}
        />
      )}
      {sheet === "theme" && (
        <ResourceBrowser
          templates={templates.filter((t) => t.themeOnly || true)}
          onClose={() => setSheet(null)}
          onChoose={async (id) => { await run("theme", { templateId: id }); setSheet(null); }}
        />
      )}
      {sheet === "find" && (
        <FindSheet
          query={findQ}
          replacement={findR}
          index={findIndex}
          total={findHits.length}
          onQuery={(s) => { setFindQ(s); doFind(s); }}
          onReplacement={setFindR}
          onFind={jumpHit}
          onReplace={(all) => run("replace", { query: findQ, replacement: findR, all, current: findHits[findIndex] })}
          onClose={() => setSheet(null)}
        />
      )}
      {sheet === "export" && <ExportSheet onExport={doExport} onClose={() => setSheet(null)} />}
    </div>
  );
}
