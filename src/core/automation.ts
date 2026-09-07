import { blankRow } from "./factory.js";
import { addRow, childrenOf, patchRow, rowById } from "./outline.js";
import type { OutlineDocument, Row } from "./types.js";

export interface AutomationContext {
  document: { name: string; id: string };
  outline: {
    rootItem: RowProxy;
    itemNamed(name: string): RowProxy | null;
  };
  selection: { items: RowProxy[] };
}

export class RowProxy {
  constructor(
    private doc: OutlineDocument,
    public row: Row,
  ) {}
  get id() {
    return this.row.id;
  }
  get topic() {
    return this.row.topic;
  }
  set topic(v: string) {
    this.row.topic = v;
  }
  get note() {
    return this.row.note;
  }
  set note(v: string) {
    this.row.note = v;
  }
  children(): RowProxy[] {
    return childrenOf(this.doc, this.row.id).map((r) => new RowProxy(this.doc, r));
  }
  addChild(topic = "New Row"): RowProxy {
    const child = blankRow({ topic, parentId: this.row.id === "root" ? null : this.row.id, order: childrenOf(this.doc, this.row.id === "root" ? null : this.row.id).length });
    this.doc.rows.push(child);
    return new RowProxy(this.doc, child);
  }
  remove() {
    this.doc.rows = this.doc.rows.filter((r) => r.id !== this.row.id);
  }
}

export function automationContext(doc: OutlineDocument, selectedIds: string[] = []): AutomationContext {
  const rootRow: Row = blankRow({ id: "root", topic: doc.title });
  const root = new RowProxy(doc, rootRow);
  root.addChild = (topic = "New Row") => {
    const child = blankRow({ topic, parentId: null, order: childrenOf(doc, null).length });
    doc.rows.push(child);
    return new RowProxy(doc, child);
  };
  return {
    document: { name: doc.title, id: doc.id },
    outline: {
      rootItem: root,
      itemNamed(name: string) {
        const row = doc.rows.find((r) => r.topic.toLowerCase() === name.toLowerCase());
        return row ? new RowProxy(doc, row) : null;
      },
    },
    selection: {
      items: selectedIds.map((id) => rowById(doc, id)).filter((r): r is Row => Boolean(r)).map((r) => new RowProxy(doc, r)),
    },
  };
}

export type TellFunctionName =
  | "addRow"
  | "addChild"
  | "setTopic"
  | "setNote"
  | "remove"
  | "copyFromOmniPlan"
  | "copyFromOmniFocus";

export function applyTell(doc: OutlineDocument, functionName: string, argument: unknown, selectedIds: string[] = []): { doc: OutlineDocument; result: unknown } {
  const arg = (argument ?? {}) as Record<string, unknown>;
  const topic = String(arg.topic ?? arg.name ?? arg.title ?? "New Row");
  const note = String(arg.note ?? "");
  if (functionName === "addRow" || functionName === "addChild") {
    const relative = selectedIds[0] ?? null;
    const next = addRow(doc, relative, functionName === "addChild" ? "inside" : "below", { topic, note });
    const created = next.rows[next.rows.length - 1];
    return { doc: next, result: { id: created.id, url: `omnioutliner:///open?row=${created.id}` } };
  }
  if (functionName === "setTopic" && selectedIds[0]) {
    return { doc: patchRow(doc, selectedIds[0], { topic }), result: { id: selectedIds[0] } };
  }
  if (functionName === "setNote" && selectedIds[0]) {
    return { doc: patchRow(doc, selectedIds[0], { note }), result: { id: selectedIds[0] } };
  }
  if (functionName === "copyFromOmniPlan" || functionName === "copyFromOmniFocus") {
    const items = Array.isArray(argument) ? argument : [argument];
    let next = doc;
    const ids: string[] = [];
    for (const item of items) {
      const rec = (item ?? {}) as Record<string, unknown>;
      const t = String(rec.OPtaskTitle ?? rec.OFtaskTitle ?? rec.title ?? rec.name ?? "Untitled");
      const n = String(rec.OPtaskNote ?? rec.OFtaskNote ?? rec.note ?? "");
      next = addRow(next, null, "below", { topic: t, note: n });
      ids.push(next.rows[next.rows.length - 1].id);
    }
    return { doc: next, result: { ids, urls: ids.map((id) => `omnioutliner:///open?row=${id}`) } };
  }
  return { doc, result: { error: `Unknown function ${functionName}` } };
}
