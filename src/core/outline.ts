import { blankRow } from "./factory.js";
import { nowIso, uid } from "./ids.js";
import type { OutlineDocument, Row, StatusValue, VisibleRow } from "./types.js";
import { rowNumber } from "./numbering.js";

export function mutate(doc: OutlineDocument, fn: (d: OutlineDocument) => void): OutlineDocument {
  const next = structuredClone(doc);
  fn(next);
  next.updatedAt = nowIso();
  return next;
}

export function childrenOf(doc: OutlineDocument, parentId: string | null): Row[] {
  return doc.rows.filter((r) => r.parentId === parentId).sort((a, b) => a.order - b.order);
}

export function rowById(doc: OutlineDocument, id: string): Row | undefined {
  return doc.rows.find((r) => r.id === id);
}

export function descendants(doc: OutlineDocument, id: string): Row[] {
  const out: Row[] = [];
  const walk = (parentId: string) => {
    for (const child of childrenOf(doc, parentId)) {
      out.push(child);
      walk(child.id);
    }
  };
  walk(id);
  return out;
}

export function ancestors(doc: OutlineDocument, id: string): Row[] {
  const out: Row[] = [];
  let current = rowById(doc, id);
  while (current?.parentId) {
    const parent = rowById(doc, current.parentId);
    if (!parent) break;
    out.unshift(parent);
    current = parent;
  }
  return out;
}

export function depthOf(doc: OutlineDocument, id: string): number {
  return ancestors(doc, id).length;
}

export function hasChildren(doc: OutlineDocument, id: string): boolean {
  return doc.rows.some((r) => r.parentId === id);
}

export function reindexSiblings(doc: OutlineDocument, parentId: string | null): void {
  childrenOf(doc, parentId).forEach((row, i) => {
    row.order = i;
  });
}

export function effectiveStatus(doc: OutlineDocument, row: Row): StatusValue {
  if (row.statusMode === "none" && row.status === "none") {
    if (!hasChildren(doc, row.id)) return "none";
  }
  if (row.statusMode === "calculated" || (row.statusMode === "none" && hasChildren(doc, row.id) && row.status === "none")) {
    const kids = descendants(doc, row.id).filter((r) => r.statusMode !== "none" || r.status === "checked" || r.status === "unchecked");
    const leafish = childrenOf(doc, row.id);
    const pool = leafish.length ? leafish : kids;
    if (!pool.length) return "none";
    const states = pool.map((k) => effectiveStatus(doc, k)).filter((s) => s !== "none");
    if (!states.length) return "none";
    if (states.every((s) => s === "checked")) return "checked";
    if (states.every((s) => s === "unchecked")) return "unchecked";
    return "mixed";
  }
  if (row.status === "checked") return "checked";
  if (row.status === "unchecked") return "unchecked";
  return row.status;
}

export function cycleStatus(row: Row): Row {
  const next = { ...row, updatedAt: nowIso() };
  if (next.statusMode === "none" || next.status === "none") {
    next.statusMode = "explicit";
    next.status = "unchecked";
    return next;
  }
  if (next.status === "unchecked") {
    next.status = "checked";
    return next;
  }
  next.statusMode = "none";
  next.status = "none";
  return next;
}

export function setStatus(doc: OutlineDocument, ids: string[], status: StatusValue | "calculated"): OutlineDocument {
  return mutate(doc, (d) => {
    for (const id of ids) {
      const row = rowById(d, id);
      if (!row) continue;
      if (status === "calculated") {
        row.statusMode = "calculated";
        row.status = "none";
      } else if (status === "none") {
        row.statusMode = "none";
        row.status = "none";
      } else {
        row.statusMode = "explicit";
        row.status = status;
      }
      row.updatedAt = nowIso();
    }
  });
}

export interface FlattenOptions {
  includeCollapsed?: boolean;
  focusIds?: string[];
  matchIds?: Set<string>;
}

export function flatten(doc: OutlineDocument, opts: FlattenOptions = {}): VisibleRow[] {
  const out: VisibleRow[] = [];
  const focus = opts.focusIds?.length ? new Set(expandFocus(doc, opts.focusIds)) : null;
  const walk = (parentId: string | null, depth: number) => {
    for (const row of childrenOf(doc, parentId)) {
      if (focus && !focus.has(row.id)) continue;
      if (opts.matchIds && !opts.matchIds.has(row.id) && !descendants(doc, row.id).some((c) => opts.matchIds!.has(c.id))) {
        continue;
      }
      out.push({
        row,
        depth,
        number: rowNumber(doc, row.id),
        hasChildren: hasChildren(doc, row.id),
        effectiveStatus: effectiveStatus(doc, row),
      });
      if (opts.includeCollapsed || !row.collapsed) walk(row.id, depth + 1);
    }
  };
  walk(null, 0);
  return out;
}

function expandFocus(doc: OutlineDocument, ids: string[]): string[] {
  const set = new Set<string>();
  for (const id of ids) {
    for (const a of ancestors(doc, id)) set.add(a.id);
    set.add(id);
    for (const d of descendants(doc, id)) set.add(d.id);
  }
  return [...set];
}

export function addRow(
  doc: OutlineDocument,
  relativeId: string | null,
  placement: "below" | "above" | "inside" | "outside" = "below",
  partial: Partial<Row> = {},
): OutlineDocument {
  return mutate(doc, (d) => {
    const relative = relativeId ? rowById(d, relativeId) : null;
    let parentId: string | null = relative?.parentId ?? null;
    let order = 0;
    if (!relative) {
      const top = childrenOf(d, null);
      order = top.length;
    } else if (placement === "inside") {
      parentId = relative.id;
      relative.collapsed = false;
      order = childrenOf(d, relative.id).length;
    } else if (placement === "outside") {
      parentId = relative.parentId ? rowById(d, relative.parentId)?.parentId ?? null : null;
      const siblings = childrenOf(d, parentId);
      const parent = relative.parentId ? rowById(d, relative.parentId) : null;
      const idx = parent ? siblings.findIndex((s) => s.id === parent.id) : siblings.findIndex((s) => s.id === relative.id);
      order = idx + 1;
    } else if (placement === "above") {
      parentId = relative.parentId;
      order = relative.order;
    } else {
      parentId = relative.parentId;
      order = relative.order + 1;
    }
    const row = blankRow({ ...partial, parentId, order });
    if (placement === "above" && relative) {
      for (const sib of d.rows.filter((r) => r.parentId === parentId && r.order >= order)) sib.order += 1;
    } else if ((placement === "below" || placement === "outside") && relative) {
      for (const sib of d.rows.filter((r) => r.parentId === parentId && r.order >= order)) sib.order += 1;
    }
    d.rows.push(row);
    reindexSiblings(d, parentId);
  });
}

export function deleteRows(doc: OutlineDocument, ids: string[]): OutlineDocument {
  const remove = new Set<string>();
  for (const id of ids) {
    remove.add(id);
    for (const d of descendants(doc, id)) remove.add(d.id);
  }
  return mutate(doc, (d) => {
    const parents = new Set(d.rows.filter((r) => remove.has(r.id)).map((r) => r.parentId));
    d.rows = d.rows.filter((r) => !remove.has(r.id));
    if (!d.rows.length) d.rows.push(blankRow({ topic: "" }));
    for (const p of parents) reindexSiblings(d, p);
  });
}

export function duplicateRows(doc: OutlineDocument, ids: string[]): OutlineDocument {
  return mutate(doc, (d) => {
    for (const id of ids) {
      const row = rowById(d, id);
      if (!row) continue;
      const copySubtree = (source: Row, parentId: string | null, order: number) => {
        const copy = { ...structuredClone(source), id: uid(), parentId, order, createdAt: nowIso(), updatedAt: nowIso() };
        d.rows.push(copy);
        childrenOf(d, source.id)
          .filter((c) => c.id !== copy.id)
          .forEach((child, i) => {
            if (d.rows.some((r) => r.id === child.id && r.parentId === source.id)) copySubtree(child, copy.id, i);
          });
        return copy;
      };
      const siblings = childrenOf(d, row.parentId);
      const idx = siblings.findIndex((s) => s.id === row.id);
      for (const sib of d.rows.filter((r) => r.parentId === row.parentId && r.order > row.order)) sib.order += 1;
      const snapshot = structuredClone(row);
      const kids = descendants(doc, row.id).map((r) => structuredClone(r));
      const copy = { ...snapshot, id: uid(), parentId: row.parentId, order: idx + 1, createdAt: nowIso(), updatedAt: nowIso() };
      d.rows.push(copy);
      const idMap = new Map<string, string>([[row.id, copy.id]]);
      for (const kid of kids) {
        const newId = uid();
        idMap.set(kid.id, newId);
        d.rows.push({
          ...kid,
          id: newId,
          parentId: kid.parentId ? idMap.get(kid.parentId) ?? copy.id : copy.id,
          createdAt: nowIso(),
          updatedAt: nowIso(),
        });
      }
      reindexSiblings(d, row.parentId);
    }
  });
}

export function indentRows(doc: OutlineDocument, ids: string[]): OutlineDocument {
  return mutate(doc, (d) => {
    const ordered = flatten(d, { includeCollapsed: true }).map((v) => v.row).filter((r) => ids.includes(r.id));
    for (const row of ordered) {
      const siblings = childrenOf(d, row.parentId);
      const idx = siblings.findIndex((s) => s.id === row.id);
      if (idx <= 0) continue;
      const prev = siblings[idx - 1];
      row.parentId = prev.id;
      prev.collapsed = false;
      row.order = childrenOf(d, prev.id).length;
      row.updatedAt = nowIso();
      reindexSiblings(d, siblings[0]?.parentId ?? null);
      reindexSiblings(d, prev.id);
    }
  });
}

export function outdentRows(doc: OutlineDocument, ids: string[]): OutlineDocument {
  return mutate(doc, (d) => {
    const ordered = flatten(d, { includeCollapsed: true }).map((v) => v.row).filter((r) => ids.includes(r.id)).reverse();
    for (const row of ordered) {
      if (!row.parentId) continue;
      const parent = rowById(d, row.parentId);
      if (!parent) continue;
      const newParent = parent.parentId;
      const following = childrenOf(d, parent.id).filter((s) => s.order > row.order);
      row.parentId = newParent;
      row.order = parent.order + 1;
      row.updatedAt = nowIso();
      for (const sib of d.rows.filter((r) => r.parentId === newParent && r.order > parent.order && r.id !== row.id)) {
        sib.order += 1;
      }
      for (const f of following) {
        f.parentId = row.id;
      }
      reindexSiblings(d, parent.id);
      reindexSiblings(d, row.id);
      reindexSiblings(d, newParent);
    }
  });
}

export function moveRows(doc: OutlineDocument, ids: string[], direction: "up" | "down" | "left" | "right"): OutlineDocument {
  if (direction === "left") return outdentRows(doc, ids);
  if (direction === "right") return indentRows(doc, ids);
  return mutate(doc, (d) => {
    const delta = direction === "up" ? -1 : 1;
    const ordered = childrenGroups(d, ids);
    const walk = direction === "up" ? ordered : [...ordered].reverse();
    for (const group of walk) {
      const siblings = childrenOf(d, group.parentId);
      const indices = group.ids.map((id) => siblings.findIndex((s) => s.id === id)).filter((i) => i >= 0).sort((a, b) => a - b);
      if (!indices.length) continue;
      const first = indices[0];
      const last = indices[indices.length - 1];
      const swapWith = direction === "up" ? first - 1 : last + 1;
      if (swapWith < 0 || swapWith >= siblings.length) continue;
      const moving = indices.map((i) => siblings[i]);
      const target = siblings[swapWith];
      if (direction === "up") {
        const tOrder = target.order;
        moving.forEach((m, i) => (m.order = tOrder + i));
        target.order = tOrder + moving.length;
      } else {
        const tOrder = target.order;
        target.order = moving[0].order;
        moving.forEach((m, i) => (m.order = tOrder - moving.length + 1 + i));
      }
      reindexSiblings(d, group.parentId);
    }
  });
}

function childrenGroups(doc: OutlineDocument, ids: string[]): { parentId: string | null; ids: string[] }[] {
  const map = new Map<string, string[]>();
  for (const id of ids) {
    const row = rowById(doc, id);
    if (!row) continue;
    const key = String(row.parentId);
    if (!map.has(key)) map.set(key, []);
    map.get(key)!.push(id);
  }
  return [...map.entries()].map(([key, groupIds]) => ({
    parentId: key === "null" ? null : key,
    ids: groupIds,
  }));
}

export function groupRows(doc: OutlineDocument, ids: string[], title = "Group"): OutlineDocument {
  if (!ids.length) return doc;
  return mutate(doc, (d) => {
    const rows = ids.map((id) => rowById(d, id)).filter((r): r is Row => Boolean(r));
    if (!rows.length) return;
    const parentId = rows[0].parentId;
    const siblings = rows.filter((r) => r.parentId === parentId).sort((a, b) => a.order - b.order);
    if (!siblings.length) return;
    const firstOrder = siblings[0].order;
    const group = blankRow({ topic: title, parentId, order: firstOrder });
    d.rows.push(group);
    for (const sib of d.rows.filter((r) => r.parentId === parentId && r.order >= firstOrder && r.id !== group.id)) {
      sib.order += 1;
    }
    siblings.forEach((row, i) => {
      row.parentId = group.id;
      row.order = i;
      row.updatedAt = nowIso();
    });
    reindexSiblings(d, parentId);
    reindexSiblings(d, group.id);
  });
}

export function ungroupRows(doc: OutlineDocument, ids: string[]): OutlineDocument {
  return mutate(doc, (d) => {
    for (const id of ids) {
      const parent = rowById(d, id);
      if (!parent) continue;
      const kids = childrenOf(d, parent.id);
      if (!kids.length) continue;
      let order = parent.order;
      for (const kid of kids) {
        kid.parentId = parent.parentId;
        kid.order = order++;
        kid.updatedAt = nowIso();
      }
      for (const sib of d.rows.filter((r) => r.parentId === parent.parentId && r.order > parent.order && r.id !== parent.id)) {
        sib.order += kids.length;
      }
      reindexSiblings(d, parent.parentId);
    }
  });
}

export function setCollapsed(doc: OutlineDocument, ids: string[], collapsed: boolean, completely = false): OutlineDocument {
  return mutate(doc, (d) => {
    for (const id of ids) {
      const targets = completely ? [rowById(d, id), ...descendants(d, id)] : [rowById(d, id)];
      for (const row of targets) {
        if (!row) continue;
        if (hasChildren(d, row.id)) row.collapsed = collapsed;
      }
    }
  });
}

export function expandAll(doc: OutlineDocument): OutlineDocument {
  return mutate(doc, (d) => {
    for (const row of d.rows) row.collapsed = false;
  });
}

export function collapseAll(doc: OutlineDocument): OutlineDocument {
  return mutate(doc, (d) => {
    for (const row of d.rows) if (hasChildren(d, row.id)) row.collapsed = true;
  });
}

export function patchRow(doc: OutlineDocument, id: string, patch: Partial<Row>): OutlineDocument {
  return mutate(doc, (d) => {
    const row = rowById(d, id);
    if (!row) return;
    Object.assign(row, patch, { id: row.id, updatedAt: nowIso() });
  });
}

export function setCell(doc: OutlineDocument, rowId: string, columnId: string, value: string | number | boolean | null): OutlineDocument {
  return mutate(doc, (d) => {
    const row = rowById(d, rowId);
    if (!row) return;
    if (columnId === "topic") row.topic = String(value ?? "");
    else row.cells[columnId] = value;
    row.updatedAt = nowIso();
  });
}

export function moveSubtree(doc: OutlineDocument, rowId: string, newParentId: string | null, beforeId?: string | null): OutlineDocument {
  if (rowId === newParentId) return doc;
  if (newParentId && (descendants(doc, rowId).some((r) => r.id === newParentId) || rowId === newParentId)) return doc;
  return mutate(doc, (d) => {
    const row = rowById(d, rowId);
    if (!row) return;
    const oldParent = row.parentId;
    row.parentId = newParentId;
    const siblings = childrenOf(d, newParentId).filter((r) => r.id !== rowId);
    if (beforeId) {
      const idx = siblings.findIndex((s) => s.id === beforeId);
      row.order = idx >= 0 ? idx : siblings.length;
      siblings.forEach((s, i) => {
        s.order = i >= row.order ? i + 1 : i;
      });
    } else {
      row.order = siblings.length;
    }
    reindexSiblings(d, oldParent);
    reindexSiblings(d, newParentId);
    row.updatedAt = nowIso();
  });
}

export function selectedSubtree(doc: OutlineDocument, ids: string[]): Row[] {
  const set = new Set(ids);
  const roots = ids.filter((id) => {
    const row = rowById(doc, id);
    return row && (!row.parentId || !set.has(row.parentId) && !ancestors(doc, id).some((a) => set.has(a.id)));
  });
  const out: Row[] = [];
  for (const id of roots) {
    const row = rowById(doc, id);
    if (!row) continue;
    out.push(row, ...descendants(doc, id));
  }
  return out;
}

export function wordStats(doc: OutlineDocument): { rows: number; words: number; characters: number; checked: number; notes: number } {
  const text = (s: string) => s.replace(/<[^>]+>/g, " ");
  let words = 0;
  let characters = 0;
  let checked = 0;
  let notes = 0;
  for (const row of doc.rows) {
    const t = `${text(row.topic)} ${text(row.note)}`.trim();
    characters += t.replace(/\s/g, "").length;
    words += t.split(/\s+/).filter(Boolean).length;
    if (effectiveStatus(doc, row) === "checked") checked += 1;
    if (row.note.trim()) notes += 1;
  }
  return { rows: doc.rows.length, words, characters, checked, notes };
}
