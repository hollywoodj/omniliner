import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
  addUrl,
  applyTell,
  blankDocument,
  blankRow,
  buildOmniCloneAddUrl,
  buildOmniClonePasteUrl,
  findHits,
  keywordMatches,
  outlineToNotebookHtml,
  parseOmniUrl,
  replaceHits,
  rowNumber,
  rowUrl,
  sendSelectionToOmniClone,
  DEFAULT_PREFERENCES,
} from "../src/core/index.ts";

describe("url schemes", () => {
  it("parses OmniOutliner open, add, paste, and x-callback URLs", () => {
    const open = parseOmniUrl("omnioutliner:///open?row=mLUW8Czar_j");
    assert.equal(open.kind, "open");
    assert.deepEqual(open.ids, ["mLUW8Czar_j"]);
    const add = parseOmniUrl("omnioutliner:///add?name=Buy%20milk&note=notebook://note/abc");
    assert.equal(add.kind, "add");
    assert.equal(add.query.name, "Buy milk");
    const paste = parseOmniUrl("omniliner:///paste?content=-%20One");
    assert.equal(paste.kind, "paste");
    const xc = parseOmniUrl("omnioutliner:///x-callback-url/add?name=Hi&x-success=notebook://note/1");
    assert.equal(xc.kind, "x-callback-add");
    assert.equal(xc.query["x-success"], "notebook://note/1");
  });

  it("builds row and add URLs", () => {
    assert.equal(rowUrl("abc"), "omnioutliner:///open?row=abc");
    assert.match(addUrl({ name: "Task", note: "n" }), /\/\/\/add\?/);
  });
});

describe("omniclone + notebook integration", () => {
  it("builds OmniClone add/paste URLs matching Notebook's contract", () => {
    const add = buildOmniCloneAddUrl("omniclone", { name: "Write copy", note: "omnioutliner:///open?row=1", autosave: true });
    assert.equal(add.startsWith("omniclone:///add?"), true);
    assert.match(add, /name=Write%20copy/);
    assert.match(add, /autosave=true/);
    const paste = buildOmniClonePasteUrl("omniclone", "- Buy milk\n\t- Nested");
    assert.match(paste, /omniclone:\/\/\/paste\?/);
    assert.match(paste, /target=inbox/);
  });

  it("sends a single row as add and a branch as TaskPaper paste", () => {
    const doc = blankDocument({
      rows: [
        blankRow({ id: "p", topic: "Parent", order: 0 }),
        blankRow({ id: "c", topic: "Child", parentId: "p", order: 0 }),
      ],
    });
    const single = sendSelectionToOmniClone(doc, ["c"], DEFAULT_PREFERENCES);
    assert.equal(single.urls.length, 1);
    assert.match(single.urls[0], /\/\/\/add\?/);
    const branch = sendSelectionToOmniClone(doc, ["p"], DEFAULT_PREFERENCES);
    assert.match(branch.taskPaper, /- Parent/);
    assert.match(branch.taskPaper, /\t- Child/);
  });

  it("renders Notebook HTML with deep links and checklists", () => {
    const doc = blankDocument({
      title: "Launch",
      rows: [blankRow({ id: "r1", topic: "Ship it", status: "unchecked", statusMode: "explicit" })],
    });
    const html = outlineToNotebookHtml(doc);
    assert.match(html, /notebook|omnioutliner:\/\/\/open\?row=r1/);
    assert.match(html, /data-type="taskItem"/);
  });
});

describe("filters, find, numbering, automation", () => {
  it("matches keyword filters and find/replace", () => {
    const doc = blankDocument({
      rows: [
        blankRow({ id: "a", topic: "Release notes", note: "draft" }),
        blankRow({ id: "b", topic: "Video" }),
      ],
    });
    assert.deepEqual([...keywordMatches(doc, "release")], ["a"]);
    const hits = findHits(doc, "draft");
    assert.equal(hits[0].field, "note");
    const replaced = replaceHits(doc, "draft", "final");
    assert.equal(replaced.rows[0].note, "final");
  });

  it("numbers rows in outline style", () => {
    const doc = blankDocument({
      numbering: { style: "outline", suffix: "period" },
      rows: [
        blankRow({ id: "a", topic: "A", order: 0 }),
        blankRow({ id: "a1", topic: "A1", parentId: "a", order: 0 }),
        blankRow({ id: "b", topic: "B", order: 1 }),
      ],
    });
    assert.equal(rowNumber(doc, "a"), "1.");
    assert.equal(rowNumber(doc, "a1"), "1.1.");
    assert.equal(rowNumber(doc, "b"), "2.");
  });

  it("applies Omni Automation tell functions", () => {
    const doc = blankDocument({ rows: [blankRow({ id: "a", topic: "A" })] });
    const added = applyTell(doc, "addRow", { topic: "B" }, ["a"]);
    assert.equal(added.doc.rows.some((r) => r.topic === "B"), true);
    const fromPlan = applyTell(doc, "copyFromOmniPlan", [{ OPtaskTitle: "From Plan", OPtaskNote: "omniplan:///task/1" }]);
    assert.equal(fromPlan.doc.rows.some((r) => r.topic === "From Plan"), true);
  });
});
