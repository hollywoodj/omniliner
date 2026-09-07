import type { Column, InspectorGroup, OutlineDocument, Preferences, Row } from "./types";

export function Inspector(props: {
  doc: OutlineDocument;
  prefs: Preferences;
  group: InspectorGroup;
  selected: Row[];
  selectedColumn: Column | null;
  onGroup: (g: InspectorGroup) => void;
  onPatchDoc: (patch: Partial<OutlineDocument>) => void;
  onPatchRow: (id: string, patch: Partial<Row>) => void;
  onPatchColumn: (id: string, patch: Partial<Column>) => void;
  onNamedStyle: (id: string) => void;
  onAddColumn: () => void;
  onRemoveColumn: () => void;
}) {
  const row = props.selected[0];
  return (
    <aside className="inspector">
      <div className="insp-tabs">
        <button className={props.group === "selection" ? "on" : ""} onClick={() => props.onGroup("selection")}>Selection Style</button>
        <button className={props.group === "document" ? "on" : ""} onClick={() => props.onGroup("document")}>Document</button>
      </div>
      <div className="insp-body">
        {props.group === "selection" && (
          <>
            <div className="insp-group">
              <h4>Row</h4>
              {row ? (
                <>
                  <div className="field">
                    <label>Topic</label>
                    <input value={row.topic} onChange={(e) => props.onPatchRow(row.id, { topic: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Note</label>
                    <textarea rows={3} value={row.note} onChange={(e) => props.onPatchRow(row.id, { note: e.target.value, noteExpanded: true })} />
                  </div>
                  <div className="field">
                    <label>Status</label>
                    <select
                      value={row.statusMode === "calculated" ? "calculated" : row.status}
                      onChange={(e) => {
                        const v = e.target.value;
                        if (v === "calculated") props.onPatchRow(row.id, { statusMode: "calculated", status: "none" });
                        else if (v === "none") props.onPatchRow(row.id, { statusMode: "none", status: "none" });
                        else props.onPatchRow(row.id, { statusMode: "explicit", status: v as Row["status"] });
                      }}
                    >
                      <option value="none">None</option>
                      <option value="unchecked">Unchecked</option>
                      <option value="checked">Checked</option>
                      <option value="calculated">Calculated</option>
                    </select>
                  </div>
                </>
              ) : (
                <div style={{ color: "#6e6e73", fontSize: 12 }}>Select a row to edit its style.</div>
              )}
            </div>
            <div className="insp-group">
              <h4>Apply Styles</h4>
              <div className="row-btns">
                {props.doc.namedStyles.map((s) => (
                  <button key={s.id} className={row?.namedStyleIds.includes(s.id) ? "on" : ""} onClick={() => props.onNamedStyle(s.id)}>
                    {s.name}
                  </button>
                ))}
              </div>
            </div>
            <div className="insp-group">
              <h4>Column Type</h4>
              {props.selectedColumn ? (
                <>
                  <div className="field">
                    <label>Title</label>
                    <input value={props.selectedColumn.title} disabled={props.selectedColumn.isTopic} onChange={(e) => props.onPatchColumn(props.selectedColumn!.id, { title: e.target.value })} />
                  </div>
                  <div className="field">
                    <label>Type</label>
                    <select value={props.selectedColumn.type} disabled={props.selectedColumn.isTopic} onChange={(e) => props.onPatchColumn(props.selectedColumn!.id, { type: e.target.value as Column["type"] })}>
                      <option value="richText">Rich Text</option>
                      <option value="text">Text</option>
                      <option value="number">Number</option>
                      <option value="duration">Duration</option>
                      <option value="date">Date</option>
                      <option value="checkbox">Checkbox</option>
                      <option value="popup">Pop-up List</option>
                    </select>
                  </div>
                  <div className="field">
                    <label>Summary</label>
                    <select value={props.selectedColumn.summary} onChange={(e) => props.onPatchColumn(props.selectedColumn!.id, { summary: e.target.value as Column["summary"] })}>
                      <option value="none">None</option>
                      <option value="total">Total</option>
                      <option value="average">Average</option>
                      <option value="minimum">Minimum</option>
                      <option value="maximum">Maximum</option>
                      <option value="hidden">Hidden</option>
                    </select>
                  </div>
                  {props.selectedColumn.type === "popup" && (
                    <div className="field">
                      <label>Options (one per line)</label>
                      <textarea
                        rows={4}
                        value={(props.selectedColumn.popupOptions || []).join("\n")}
                        onChange={(e) => props.onPatchColumn(props.selectedColumn!.id, { popupOptions: e.target.value.split("\n").filter(Boolean) })}
                      />
                    </div>
                  )}
                  <div className="row-btns">
                    <button onClick={props.onAddColumn}>Add Column</button>
                    <button onClick={props.onRemoveColumn} disabled={props.selectedColumn.isTopic}>Remove Column</button>
                  </div>
                </>
              ) : (
                <div className="row-btns">
                  <button onClick={props.onAddColumn}>Add Column</button>
                </div>
              )}
            </div>
          </>
        )}
        {props.group === "document" && (
          <>
            <div className="insp-group">
              <h4>Document</h4>
              <div className="field">
                <label>Title</label>
                <input value={props.doc.title} onChange={(e) => props.onPatchDoc({ title: e.target.value, documentName: `${e.target.value}.ooutline` })} />
              </div>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={props.doc.showStatus} onChange={(e) => props.onPatchDoc({ showStatus: e.target.checked })} />
                Show Row Status
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={props.doc.alternateRows} onChange={(e) => props.onPatchDoc({ alternateRows: e.target.checked })} />
                Alternate Rows
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={props.doc.horizontalGrid} onChange={(e) => props.onPatchDoc({ horizontalGrid: e.target.checked })} />
                Horizontal Grid
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={props.doc.verticalGrid} onChange={(e) => props.onPatchDoc({ verticalGrid: e.target.checked })} />
                Vertical Grid
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={props.doc.indentChildren} onChange={(e) => props.onPatchDoc({ indentChildren: e.target.checked })} />
                Indent Child Rows
              </label>
              <label className="field" style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <input type="checkbox" checked={props.doc.notesSpanColumns} onChange={(e) => props.onPatchDoc({ notesSpanColumns: e.target.checked })} />
                Notes Span Columns
              </label>
              <div className="field">
                <label>Column Headers</label>
                <select value={props.doc.columnHeaders} onChange={(e) => props.onPatchDoc({ columnHeaders: e.target.value as OutlineDocument["columnHeaders"] })}>
                  <option value="automatic">Automatic</option>
                  <option value="show">Show</option>
                  <option value="hide">Hide</option>
                </select>
              </div>
              <div className="field">
                <label>Notes</label>
                <select value={props.doc.notesDisplay} onChange={(e) => props.onPatchDoc({ notesDisplay: e.target.value as OutlineDocument["notesDisplay"] })}>
                  <option value="inline">Display Inline</option>
                  <option value="pane">Display in Pane</option>
                </select>
              </div>
              <div className="field">
                <label>Show Full Row Text</label>
                <select value={props.doc.fullRowText} onChange={(e) => props.onPatchDoc({ fullRowText: e.target.value as OutlineDocument["fullRowText"] })}>
                  <option value="always">Always</option>
                  <option value="whenEditing">When Editing</option>
                </select>
              </div>
              <div className="field">
                <label>Zoom</label>
                <input type="range" min={0.5} max={4} step={0.1} value={props.doc.zoom} onChange={(e) => props.onPatchDoc({ zoom: Number(e.target.value) })} />
              </div>
            </div>
            <div className="insp-group">
              <h4>Row Numbering</h4>
              <select value={props.doc.numbering.style} onChange={(e) => props.onPatchDoc({ numbering: { ...props.doc.numbering, style: e.target.value } })}>
                <option value="none">None</option>
                <option value="decimal">1, 2, 3, 4</option>
                <option value="upperAlpha">A, B, C, D</option>
                <option value="lowerAlpha">a, b, c, d</option>
                <option value="upperRoman">I, II, III, IV</option>
                <option value="lowerRoman">i, ii, iii, iv</option>
                <option value="outline">1, 1.1, 1.1.1</option>
              </select>
              <select value={props.doc.numbering.suffix} onChange={(e) => props.onPatchDoc({ numbering: { ...props.doc.numbering, suffix: e.target.value } })} style={{ marginTop: 6 }}>
                <option value="none">No suffix</option>
                <option value="period">x.</option>
                <option value="paren">x)</option>
                <option value="wrapped">(x)</option>
              </select>
            </div>
          </>
        )}
      </div>
    </aside>
  );
}
