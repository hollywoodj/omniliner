import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  blankColumn,
  blankDocument,
  blankRow,
  columnSummary,
  detectImport,
  exportDocument,
  fromOpml,
  fromTaskPaper,
  parseDuration,
  toOpml,
  toTaskPaper,
} from "../src/core/index.ts";

describe("import / export", () => {
  it("round-trips OPML hierarchy, notes, and status", () => {
    let doc = blankDocument({ title: "Plan", rows: [] });
    const parent = blankRow({ id: "p", topic: "Parent", note: "hello", status: "unchecked", statusMode: "explicit", order: 0 });
    const child = blankRow({ id: "c", topic: "Child", parentId: "p", status: "checked", statusMode: "explicit", order: 0 });
    doc.rows = [parent, child];
    const xml = toOpml(doc);
    const imported = fromOpml(xml);
    assert.equal(imported.title, "Plan");
    assert.equal(imported.rows[0].topic, "Parent");
    assert.equal(imported.rows[0].note, "hello");
    assert.equal(imported.rows[1].parentId, imported.rows[0].id);
    assert.equal(imported.rows[1].status, "checked");
  });

  it("exports TaskPaper tags OmniClone understands", () => {
    let doc = blankDocument({ rows: [] });
    doc.columns.push(blankColumn({ id: "due", title: "Due", type: "date" }));
    doc.rows = [
      blankRow({ id: "p", topic: "Website", order: 0 }),
      blankRow({ id: "t", topic: "Write copy", parentId: "p", status: "checked", statusMode: "explicit", cells: { due: "Today" }, order: 0 }),
    ];
    const tp = toTaskPaper(doc);
    assert.match(tp, /- Website/);
    assert.match(tp, /\t- Write copy @done @due\(Today\)/);
    const back = fromTaskPaper(tp, "Back");
    assert.equal(back.rows[0].topic, "Website");
    assert.equal(back.rows[1].status, "checked");
  });

  it("detects OPML vs text", () => {
    const opml = detectImport(`<?xml version="1.0"?><opml version="2.0"><head><title>X</title></head><body><outline text="Hi"/></body></opml>`);
    assert.equal(opml.rows[0].topic, "Hi");
    const txt = detectImport("Alpha\n\tBeta");
    assert.equal(txt.rows[1].parentId, txt.rows[0].id);
  });

  it("exports csv and html", () => {
    const doc = blankDocument({ title: "Doc", rows: [blankRow({ topic: "Hello" })] });
    assert.match(exportDocument(doc, "csv").body, /Topic/);
    assert.match(exportDocument(doc, "html").body, /Hello/);
    assert.match(exportDocument(doc, "markdown").body, /- Hello/);
  });

  it("parses OmniOutliner-style durations", () => {
    assert.equal(parseDuration("2h"), 7200);
    assert.equal(parseDuration("1d 3h"), 86400 + 10800);
    assert.equal(parseDuration("30m"), 1800);
  });

  it("summarizes numeric columns from children", () => {
    const col = blankColumn({ id: "n", title: "N", type: "number", summary: "total" });
    const doc = blankDocument({
      columns: [{ id: "topic", title: "Topic", type: "richText", width: 200, visible: true, isTopic: true, summary: "none" }, col],
      rows: [
        blankRow({ id: "p", topic: "P", order: 0 }),
        blankRow({ id: "a", topic: "A", parentId: "p", cells: { n: 3 }, order: 0 }),
        blankRow({ id: "b", topic: "B", parentId: "p", cells: { n: 4 }, order: 1 }),
      ],
    });
    assert.equal(columnSummary(doc, col, "p"), 7);
  });
});
