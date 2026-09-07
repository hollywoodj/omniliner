import type { ReactNode } from "react";
import type { Preferences, Template } from "./types";

export function Sheet(props: { title: string; onClose: () => void; children: ReactNode }) {
  return (
    <div className="sheet" onClick={props.onClose}>
      <div className="card" onClick={(e) => e.stopPropagation()}>
        <h3>{props.title}</h3>
        {props.children}
      </div>
    </div>
  );
}

export function AboutSheet({ onClose }: { onClose: () => void }) {
  return (
    <Sheet title="About OmniOutliner" onClose={onClose}>
      <p>Version 6.2.1 (OmniLiner clone). Not affiliated with The Omni Group.</p>
      <p>Hierarchical outlines, columns, named styles, saved filters, OPML, and URL-scheme bridges to Notebook and OmniClone.</p>
      <div className="sheet-actions">
        <button className="ghost" onClick={onClose}>Close</button>
      </div>
    </Sheet>
  );
}

export function PreferencesSheet({ prefs, onChange, onClose }: { prefs: Preferences; onChange: (p: Partial<Preferences>) => void; onClose: () => void }) {
  return (
    <Sheet title="Settings" onClose={onClose}>
      <div className="insp-group">
        <h4>Keyboard</h4>
        <label className="field" style={{ flexDirection: "row", gap: 8 }}>
          <input type="checkbox" checked={prefs.tabIndents} onChange={(e) => onChange({ tabIndents: e.target.checked })} />
          Tab indents the current row
        </label>
        <label className="field" style={{ flexDirection: "row", gap: 8 }}>
          <input type="checkbox" checked={prefs.returnCreatesRow} onChange={(e) => onChange({ returnCreatesRow: e.target.checked })} />
          Return creates a new row
        </label>
        <div className="field">
          <label>New rows are created</label>
          <select value={prefs.newRowsCreated} onChange={(e) => onChange({ newRowsCreated: e.target.value as Preferences["newRowsCreated"] })}>
            <option value="below">Below</option>
            <option value="above">Above</option>
            <option value="inside">Inside</option>
          </select>
        </div>
      </div>
      <div className="insp-group">
        <h4>Integrations</h4>
        <div className="field">
          <label>Notebook API</label>
          <input value={prefs.notebookUrl} onChange={(e) => onChange({ notebookUrl: e.target.value })} />
        </div>
        <div className="field">
          <label>OmniClone / OmniFocus scheme</label>
          <select value={prefs.omnicloneScheme} onChange={(e) => onChange({ omnicloneScheme: e.target.value as Preferences["omnicloneScheme"] })}>
            <option value="omniclone">omniclone</option>
            <option value="omnifocus">omnifocus</option>
            <option value="both">both</option>
          </select>
        </div>
        <div className="field">
          <label>OmniPlan clone URL</label>
          <input value={prefs.omniplanUrl} onChange={(e) => onChange({ omniplanUrl: e.target.value })} />
        </div>
      </div>
      <div className="sheet-actions">
        <button className="ghost" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

export function ResourceBrowser({ templates, onChoose, onClose }: { templates: Template[]; onChoose: (id: string) => void; onClose: () => void }) {
  return (
    <Sheet title="Resource Browser" onClose={onClose}>
      <p style={{ color: "#6e6e73", fontSize: 12 }}>Choose a template. Theme-only items apply styles without replacing rows.</p>
      <div className="template-grid">
        {templates.map((t) => (
          <button key={t.id} onClick={() => onChoose(t.id)}>
            <strong>{t.name}</strong>
            <div style={{ color: "#6e6e73", fontSize: 11 }}>{t.themeOnly ? "Theme" : t.builtIn ? "Built-in template" : "User template"}</div>
          </button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}

export function FindSheet({
  query,
  replacement,
  index,
  total,
  onQuery,
  onReplacement,
  onFind,
  onReplace,
  onClose,
}: {
  query: string;
  replacement: string;
  index: number;
  total: number;
  onQuery: (s: string) => void;
  onReplacement: (s: string) => void;
  onFind: (dir: 1 | -1) => void;
  onReplace: (all: boolean) => void;
  onClose: () => void;
}) {
  return (
    <Sheet title="Find" onClose={onClose}>
      <div className="field">
        <label>Find</label>
        <input autoFocus value={query} onChange={(e) => onQuery(e.target.value)} onKeyDown={(e) => e.key === "Enter" && onFind(1)} />
      </div>
      <div className="field">
        <label>Replace</label>
        <input value={replacement} onChange={(e) => onReplacement(e.target.value)} />
      </div>
      <div style={{ fontSize: 12, color: "#6e6e73" }}>{total ? `${index + 1} of ${total}` : "No matches"}</div>
      <div className="sheet-actions">
        <button className="ghost" onClick={() => onFind(-1)}>Previous</button>
        <button className="ghost" onClick={() => onFind(1)}>Next</button>
        <button className="ghost" onClick={() => onReplace(false)}>Replace</button>
        <button className="ghost" onClick={() => onReplace(true)}>Replace All</button>
        <button className="ghost" onClick={onClose}>Done</button>
      </div>
    </Sheet>
  );
}

export function ExportSheet({ onExport, onClose }: { onExport: (fmt: string) => void; onClose: () => void }) {
  const formats = [
    ["opml", "OPML"],
    ["csv", "CSV"],
    ["html", "HTML"],
    ["dhtml", "Dynamic HTML"],
    ["txt", "Plain Text"],
    ["taskpaper", "TaskPaper"],
    ["markdown", "Markdown"],
    ["json", "OmniLiner JSON"],
  ];
  return (
    <Sheet title="Export" onClose={onClose}>
      <div className="template-grid">
        {formats.map(([id, label]) => (
          <button key={id} onClick={() => onExport(id)}>{label}</button>
        ))}
      </div>
      <div className="sheet-actions">
        <button className="ghost" onClick={onClose}>Cancel</button>
      </div>
    </Sheet>
  );
}
