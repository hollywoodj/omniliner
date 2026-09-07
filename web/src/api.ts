import type { DocSummary, OutlineDocument, Preferences, Template } from "./types";

const json = async <T>(res: Promise<Response>): Promise<T> => {
  const resolved = await res;
  if (!resolved.ok) throw new Error(`${resolved.status} ${await resolved.text()}`);
  return resolved.json() as Promise<T>;
};

export const api = {
  health: () => json<{ version: string }>(fetch("/api/health")),
  state: () =>
    json<{ documents: DocSummary[]; preferences: Preferences; templates: Template[]; recentDocumentIds: string[] }>(
      fetch("/api/state"),
    ),
  document: (id: string) => json<OutlineDocument>(fetch(`/api/documents/${id}`)),
  createDocument: (title?: string, templateId?: string) =>
    json<OutlineDocument>(fetch("/api/documents", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ title, templateId }) })),
  saveDocument: (doc: OutlineDocument) =>
    json<OutlineDocument>(fetch(`/api/documents/${doc.id}`, { method: "PUT", headers: { "content-type": "application/json" }, body: JSON.stringify(doc) })),
  patchDocument: (id: string, patch: Partial<OutlineDocument>) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })),
  deleteDocument: (id: string) => json(fetch(`/api/documents/${id}`, { method: "DELETE" })),
  addRow: (id: string, body: Record<string, unknown>) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}/rows`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })),
  patchRow: (id: string, rowId: string, body: Record<string, unknown>) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}/rows/${rowId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })),
  command: (id: string, command: string, body: Record<string, unknown> = {}) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}/command`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ command, ...body }) })),
  addColumn: (id: string, body: Record<string, unknown>) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}/columns`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })),
  patchColumn: (id: string, colId: string, body: Record<string, unknown>) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}/columns/${colId}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })),
  deleteColumn: (id: string, colId: string) => json<OutlineDocument>(fetch(`/api/documents/${id}/columns/${colId}`, { method: "DELETE" })),
  addFilter: (id: string, body: Record<string, unknown>) =>
    json<OutlineDocument>(fetch(`/api/documents/${id}/filters`, { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(body) })),
  exportUrl: (id: string, format: string) => `/api/documents/${id}/export/${format}`,
  importText: (text: string, filename?: string, format?: string) =>
    json<OutlineDocument>(fetch("/api/import", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ text, filename, format }) })),
  find: (id: string, q: string) => json<{ hits: { rowId: string; field: string; start: number; end: number }[] }>(fetch(`/api/documents/${id}/find?q=${encodeURIComponent(q)}`)),
  openUrl: (url: string) => json<{ parsed: unknown; document: OutlineDocument; ids: string[] }>(fetch(`/api/open?url=${encodeURIComponent(url)}`)),
  sendOmniClone: (documentId: string, ids: string[]) =>
    json<{ urls: string[]; taskPaper: string }>(fetch("/bridge/omniclone/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId, ids }) })),
  sendNotebook: (documentId: string, ids: string[]) =>
    json<{ ok: boolean; url?: string; error?: string; payload: { title: string; content: string } }>(
      fetch("/bridge/notebook/send", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify({ documentId, ids }) }),
    ),
  patchPreferences: (patch: Partial<Preferences>) =>
    json<Preferences>(fetch("/api/preferences", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) })),
  templates: () => json<Template[]>(fetch("/api/templates")),
};
