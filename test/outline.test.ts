import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addRow,
  blankDocument,
  blankRow,
  childrenOf,
  collapseAll,
  deleteRows,
  duplicateRows,
  effectiveStatus,
  flatten,
  groupRows,
  indentRows,
  moveRows,
  outdentRows,
  setStatus,
  ungroupRows,
} from "../src/core/index.ts";

function seed() {
  let doc = blankDocument({ title: "Test", rows: [] });
  doc.rows.push(blankRow({ id: "a", topic: "A", order: 0 }));
  doc.rows.push(blankRow({ id: "b", topic: "B", order: 1 }));
  doc.rows.push(blankRow({ id: "c", topic: "C", order: 2 }));
  return doc;
}

describe("outline hierarchy", () => {
  it("adds rows below, above, and inside", () => {
    let doc = seed();
    doc = addRow(doc, "a", "below", { id: "a2", topic: "A2" });
    assert.equal(childrenOf(doc, null).map((r) => r.topic).join(","), "A,A2,B,C");
    doc = addRow(doc, "a", "above", { id: "a0", topic: "A0" });
    assert.equal(childrenOf(doc, null).map((r) => r.topic).join(","), "A0,A,A2,B,C");
    doc = addRow(doc, "a", "inside", { id: "a-child", topic: "child" });
    assert.equal(childrenOf(doc, "a").map((r) => r.topic).join(","), "child");
  });

  it("indents and outdents", () => {
    let doc = seed();
    doc = indentRows(doc, ["b"]);
    assert.equal(doc.rows.find((r) => r.id === "b")?.parentId, "a");
    doc = outdentRows(doc, ["b"]);
    assert.equal(doc.rows.find((r) => r.id === "b")?.parentId, null);
    assert.deepEqual(childrenOf(doc, null).map((r) => r.id), ["a", "b", "c"]);
  });

  it("outdent takes following siblings as children", () => {
    let doc = blankDocument({ rows: [] });
    doc.rows = [
      blankRow({ id: "p", topic: "P", order: 0 }),
      blankRow({ id: "c1", topic: "C1", parentId: "p", order: 0 }),
      blankRow({ id: "c2", topic: "C2", parentId: "p", order: 1 }),
    ];
    doc = outdentRows(doc, ["c1"]);
    assert.equal(doc.rows.find((r) => r.id === "c1")?.parentId, null);
    assert.equal(doc.rows.find((r) => r.id === "c2")?.parentId, "c1");
  });

  it("moves rows up and down among siblings", () => {
    let doc = seed();
    doc = moveRows(doc, ["b"], "down");
    assert.deepEqual(childrenOf(doc, null).map((r) => r.id), ["a", "c", "b"]);
    doc = moveRows(doc, ["b"], "up");
    assert.deepEqual(childrenOf(doc, null).map((r) => r.id), ["a", "b", "c"]);
  });

  it("groups and ungroups", () => {
    let doc = seed();
    doc = groupRows(doc, ["a", "b"], "Group");
    const group = doc.rows.find((r) => r.topic === "Group");
    assert.ok(group);
    assert.equal(doc.rows.find((r) => r.id === "a")?.parentId, group!.id);
    doc = ungroupRows(doc, [group!.id]);
    assert.equal(doc.rows.find((r) => r.id === "a")?.parentId, null);
    assert.equal(doc.rows.find((r) => r.id === "b")?.parentId, null);
  });

  it("deletes a row and its descendants", () => {
    let doc = seed();
    doc = indentRows(doc, ["b"]);
    doc = deleteRows(doc, ["a"]);
    assert.equal(doc.rows.some((r) => r.id === "a" || r.id === "b"), false);
    assert.equal(doc.rows.some((r) => r.id === "c"), true);
  });

  it("duplicates a subtree with new ids", () => {
    let doc = seed();
    doc = indentRows(doc, ["b"]);
    doc = duplicateRows(doc, ["a"]);
    const topics = flatten(doc, { includeCollapsed: true }).map((v) => v.row.topic);
    assert.deepEqual(topics, ["A", "B", "A", "B", "C"]);
    const ids = doc.rows.map((r) => r.id);
    assert.equal(new Set(ids).size, ids.length);
  });

  it("collapses so flatten hides children", () => {
    let doc = seed();
    doc = indentRows(doc, ["b"]);
    doc = collapseAll(doc);
    assert.deepEqual(flatten(doc).map((v) => v.row.id), ["a", "c"]);
  });

  it("calculates parent status from children", () => {
    let doc = seed();
    doc = indentRows(doc, ["b"]);
    doc = indentRows(doc, ["c"]);
    doc = setStatus(doc, ["a"], "calculated");
    doc = setStatus(doc, ["b"], "checked");
    doc = setStatus(doc, ["c"], "checked");
    assert.equal(effectiveStatus(doc, doc.rows.find((r) => r.id === "a")!), "checked");
    doc = setStatus(doc, ["c"], "unchecked");
    assert.equal(effectiveStatus(doc, doc.rows.find((r) => r.id === "a")!), "mixed");
  });
});
