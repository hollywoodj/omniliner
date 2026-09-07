import type { MouseEvent } from "react";
import type { Column, OutlineDocument, Row } from "./types";
import { flatten, mergedStyle, showHeaders, visibleColumns, type VisibleRow } from "./outlineView";

type Props = {
  doc: OutlineDocument;
  selected: string[];
  editingId: string | null;
  selectedColumn: string | null;
  focusIds: string[];
  matchIds?: Set<string>;
  hit?: { rowId: string; field: string } | null;
  onSelect: (id: string, e?: MouseEvent) => void;
  onSelectColumn: (id: string) => void;
  onEdit: (id: string | null) => void;
  onPatchRow: (id: string, patch: Partial<Row>) => void;
  onCell: (rowId: string, columnId: string, value: string | number | boolean | null) => void;
  onToggle: (id: string, completely?: boolean) => void;
  onCycleStatus: (id: string) => void;
  onContext: (e: MouseEvent, id: string) => void;
  onDrop: (rowId: string, targetId: string, position: "before" | "after" | "inside") => void;
  onResizeColumn: (id: string, width: number) => void;
};

function CellEditor({
  column,
  row,
  onCell,
}: {
  column: Column;
  row: Row;
  onCell: (rowId: string, columnId: string, value: string | number | boolean | null) => void;
}) {
  const value = column.isTopic ? row.topic : row.cells[column.id];
  if (column.type === "checkbox") {
    return (
      <div className="cell-check">
        <input type="checkbox" checked={value === true || value === "true"} onChange={(e) => onCell(row.id, column.id, e.target.checked)} />
      </div>
    );
  }
  if (column.type === "popup") {
    return (
      <select className="cell-input" value={String(value ?? "")} onChange={(e) => onCell(row.id, column.id, e.target.value)}>
        <option value=""></option>
        {(column.popupOptions || []).map((o) => (
          <option key={o}>{o}</option>
        ))}
      </select>
    );
  }
  const type = column.type === "date" ? "date" : column.type === "number" || column.type === "duration" ? "text" : "text";
  return (
    <input
      className="cell-input"
      type={type}
      value={value == null ? "" : String(value)}
      placeholder={column.type === "duration" ? "2h" : ""}
      onChange={(e) => onCell(row.id, column.id, e.target.value)}
    />
  );
}

export function OutlineView(props: Props) {
  const cols = visibleColumns(props.doc);
  const rows = flatten(props.doc, { focusIds: props.focusIds, matchIds: props.matchIds });
  const headers = showHeaders(props.doc);
  const folded = props.doc.fullRowText === "whenEditing" || props.doc.foldedEditing;

  const onDragStart = (e: React.DragEvent, id: string) => {
    e.dataTransfer.setData("text/omniliner-row", id);
    e.dataTransfer.effectAllowed = "move";
  };
  const onDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
  };
  const onDrop = (e: React.DragEvent, target: VisibleRow) => {
    e.preventDefault();
    const id = e.dataTransfer.getData("text/omniliner-row");
    if (!id || id === target.row.id) return;
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    const y = e.clientY - rect.top;
    const position = e.altKey ? "inside" : y < rect.height / 3 ? "before" : y > (rect.height * 2) / 3 ? "after" : "inside";
    props.onDrop(id, target.row.id, position);
  };

  const startResize = (col: Column, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const startX = e.clientX;
    const startW = col.width;
    const move = (ev: globalThis.MouseEvent) => props.onResizeColumn(col.id, Math.max(60, startW + ev.clientX - startX));
    const up = () => {
      window.removeEventListener("mousemove", move);
      window.removeEventListener("mouseup", up);
    };
    window.addEventListener("mousemove", move);
    window.addEventListener("mouseup", up);
  };

  return (
    <div className={`outline-scroll ${props.doc.typewriterMode ? "typewriter" : ""}`}>
      <table className={`outline-table ${folded ? "folded" : ""}`}>
        {headers && (
          <thead>
            <tr>
              <th style={{ minWidth: 88 }}> </th>
              {cols.map((c) => (
                <th key={c.id} className={props.selectedColumn === c.id ? "sel" : ""} style={{ width: c.width, minWidth: c.width }} onClick={() => props.onSelectColumn(c.id)}>
                  {c.title}
                  <span className="col-resizer" onMouseDown={(e) => startResize(c, e)} />
                </th>
              ))}
            </tr>
          </thead>
        )}
        <tbody>
          {rows.map((v, i) => {
            const selected = props.selected.includes(v.row.id);
            const editing = props.editingId === v.row.id;
            const topicCol = cols.find((c) => c.isTopic);
            const other = cols.filter((c) => !c.isTopic);
            const st = v.effectiveStatus;
            return (
              <tr
                key={v.row.id}
                className={`outline-row ${selected ? "sel" : ""} ${editing ? "editing" : ""} ${props.doc.alternateRows && i % 2 ? "alt" : ""}`}
                onClick={(e) => props.onSelect(v.row.id, e)}
                onDoubleClick={() => props.onEdit(v.row.id)}
                onContextMenu={(e) => props.onContext(e, v.row.id)}
                onDragOver={onDragOver}
                onDrop={(e) => onDrop(e, v)}
              >
                <td>
                  <div className="gutter">
                    <button
                      className={`note-btn ${v.row.note ? "has" : ""}`}
                      title="Note"
                      onClick={(e) => {
                        e.stopPropagation();
                        props.onPatchRow(v.row.id, { noteExpanded: !v.row.noteExpanded, note: v.row.note });
                      }}
                    >
                      ≡
                    </button>
                    {v.hasChildren ? (
                      <button
                        className="disc"
                        draggable
                        onDragStart={(e) => onDragStart(e, v.row.id)}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onToggle(v.row.id, e.altKey);
                        }}
                      >
                        {v.row.collapsed ? "▸" : "▾"}
                      </button>
                    ) : (
                      <span className="handle-dot" draggable onDragStart={(e) => onDragStart(e, v.row.id)} />
                    )}
                    {props.doc.showStatus && (
                      <button
                        className={`status-box ${st}`}
                        onClick={(e) => {
                          e.stopPropagation();
                          props.onCycleStatus(v.row.id);
                        }}
                      >
                        {st === "checked" ? "✓" : st === "mixed" ? "–" : ""}
                      </button>
                    )}
                    {v.number && <span className="num">{v.number}</span>}
                  </div>
                </td>
                {topicCol && (
                  <td className="cell" style={{ width: topicCol.width, minWidth: topicCol.width }}>
                    <div className="topic-cell" style={{ paddingLeft: (props.doc.indentChildren ? v.depth : 0) * 18 }}>
                      <input
                        className="topic-input"
                        style={mergedStyle(props.doc, v.row, v.depth)}
                        value={v.row.topic}
                        data-row={v.row.id}
                        onChange={(e) => props.onPatchRow(v.row.id, { topic: e.target.value })}
                        onFocus={() => {
                          props.onSelect(v.row.id);
                          props.onEdit(v.row.id);
                        }}
                      />
                    </div>
                    {props.doc.notesDisplay === "inline" && v.row.noteExpanded && v.row.note !== undefined && (
                      <div className="inline-note" style={{ marginLeft: (props.doc.indentChildren ? v.depth : 0) * 18, maxWidth: props.doc.notesSpanColumns ? "100%" : topicCol.width }}>
                        <textarea
                          className="note-input"
                          rows={2}
                          value={v.row.note}
                          placeholder="Note"
                          onChange={(e) => props.onPatchRow(v.row.id, { note: e.target.value, noteExpanded: true })}
                          onClick={(e) => e.stopPropagation()}
                        />
                      </div>
                    )}
                  </td>
                )}
                {other.map((c) => (
                  <td key={c.id} className="cell" style={{ width: c.width, minWidth: c.width }}>
                    <CellEditor column={c} row={v.row} onCell={props.onCell} />
                  </td>
                ))}
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
