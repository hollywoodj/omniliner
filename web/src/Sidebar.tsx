import type { OutlineDocument, SavedFilter, SidebarTab } from "./types";
import { flatten } from "./outlineView";

export function Sidebar(props: {
  doc: OutlineDocument;
  tab: SidebarTab;
  selected: string[];
  activeFilter: string | null;
  onTab: (t: SidebarTab) => void;
  onSelect: (id: string) => void;
  onFocus: (ids: string[]) => void;
  onFilter: (id: string | null) => void;
  onNamedStyle: (id: string) => void;
}) {
  return (
    <aside className="sidebar">
      <div className="sidebar-tabs">
        {(["sections", "styles", "filters"] as SidebarTab[]).map((t) => (
          <button key={t} className={props.tab === t ? "on" : ""} onClick={() => props.onTab(t)}>
            {t[0].toUpperCase() + t.slice(1)}
          </button>
        ))}
      </div>
      <div className="sidebar-body">
        {props.tab === "sections" &&
          flatten(props.doc).map((v) => (
            <button
              key={v.row.id}
              className={`section-item ${props.selected.includes(v.row.id) ? "sel" : ""}`}
              style={{ ["--d" as string]: v.depth }}
              onClick={() => props.onSelect(v.row.id)}
              onDoubleClick={() => props.onFocus([v.row.id])}
            >
              <span className={v.hasChildren ? "handle-arrow" : "handle-dot"}>{v.hasChildren ? (v.row.collapsed ? "▸" : "▾") : ""}</span>
              <span>{v.row.topic || "Untitled"}</span>
            </button>
          ))}
        {props.tab === "styles" &&
          props.doc.namedStyles.map((s) => (
            <button key={s.id} className="style-item" onClick={() => props.onNamedStyle(s.id)}>
              {s.name}
              {s.shortcut ? <span className="kbd" style={{ marginLeft: "auto", color: "#888" }}>^{s.shortcut}</span> : null}
            </button>
          ))}
        {props.tab === "filters" && (
          <>
            <button className={`filter-item ${!props.activeFilter ? "sel" : ""}`} onClick={() => props.onFilter(null)}>
              All rows
            </button>
            {props.doc.filters.map((f: SavedFilter) => (
              <button key={f.id} className={`filter-item ${props.activeFilter === f.id ? "sel" : ""}`} onClick={() => props.onFilter(f.id)}>
                {f.name}
              </button>
            ))}
          </>
        )}
      </div>
    </aside>
  );
}
