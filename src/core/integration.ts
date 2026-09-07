import { toMarkdown, toTaskPaper } from "./import-export.js";
import { childrenOf, selectedSubtree } from "./outline.js";
import type { OmniCloneSchemePref, OutlineDocument, Preferences } from "./types.js";
import { documentUrl, rowUrl } from "./urls.js";

export function schemesForPref(pref: OmniCloneSchemePref): string[] {
  if (pref === "omnifocus") return ["omnifocus"];
  if (pref === "both") return ["omniclone", "omnifocus"];
  return ["omniclone"];
}

function qs(params: Record<string, string | undefined>): string {
  const parts: string[] = [];
  for (const [key, value] of Object.entries(params)) {
    if (value == null || value === "") continue;
    parts.push(`${encodeURIComponent(key)}=${encodeURIComponent(value)}`);
  }
  return parts.join("&");
}

export function buildOmniCloneAddUrl(
  scheme: string,
  params: { name: string; note?: string; due?: string; project?: string; flag?: boolean; autosave?: boolean; xSuccess?: string },
): string {
  const path = params.xSuccess ? "x-callback-url/add" : "add";
  return `${scheme}:///${path}?${qs({
    name: params.name.trim() || "Untitled",
    note: params.note,
    due: params.due,
    project: params.project,
    flag: params.flag ? "true" : undefined,
    autosave: params.autosave === false ? "false" : "true",
    "x-success": params.xSuccess,
  })}`;
}

export function buildOmniClonePasteUrl(scheme: string, content: string, target = "inbox"): string {
  return `${scheme}:///paste?${qs({ target, content })}`;
}

export function noteField(link: string, snippet?: string): string {
  const extra = (snippet || "").trim();
  return extra ? `${link}\n\n${extra}` : link;
}

export function sendSelectionToOmniClone(doc: OutlineDocument, ids: string[], prefs: Preferences): { urls: string[]; taskPaper: string } {
  const rows = ids.length ? selectedSubtree(doc, ids) : doc.rows;
  const roots = ids.length ? ids.filter((id) => rows.some((r) => r.id === id && (!r.parentId || !ids.includes(r.parentId)))) : childrenOf(doc, null).map((r) => r.id);
  const taskPaper = toTaskPaper(doc, roots);
  const urls: string[] = [];
  for (const scheme of schemesForPref(prefs.omnicloneScheme)) {
    if (roots.length === 1) {
      const row = doc.rows.find((r) => r.id === roots[0]);
      urls.push(
        buildOmniCloneAddUrl(scheme, {
          name: row?.topic || doc.title,
          note: noteField(rowUrl(row?.id || doc.id, prefs.omnioutlinerScheme), row?.note),
          autosave: true,
        }),
      );
    } else {
      urls.push(buildOmniClonePasteUrl(scheme, taskPaper));
    }
  }
  return { urls, taskPaper };
}

export function outlineToNotebookHtml(doc: OutlineDocument, ids?: string[]): string {
  const allowed = ids?.length ? new Set(ids.flatMap((id) => [id, ...selectedSubtree(doc, [id]).map((r) => r.id)])) : null;
  const walk = (parentId: string | null): string => {
    const kids = childrenOf(doc, parentId).filter((r) => !allowed || allowed.has(r.id));
    if (!kids.length) return "";
    return `<ul>${kids
      .map((row) => {
        const checked = row.status === "checked" ? ` data-checked="true" data-type="taskItem"` : row.status === "unchecked" ? ` data-checked="false" data-type="taskItem"` : "";
        const link = `<a href="${rowUrl(row.id)}">${escapeHtml(row.topic)}</a>`;
        const note = row.note ? `<p>${escapeHtml(row.note)}</p>` : "";
        return `<li${checked}>${link}${note}${walk(row.id)}</li>`;
      })
      .join("")}</ul>`;
  };
  return `<h1>${escapeHtml(doc.title)}</h1><p><a href="${documentUrl(doc.id)}">${escapeHtml(documentUrl(doc.id))}</a></p>${walk(null)}`;
}

function escapeHtml(s: string): string {
  return s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

export async function sendToNotebook(
  doc: OutlineDocument,
  ids: string[],
  prefs: Preferences,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; noteId?: string; url?: string; error?: string; payload: { title: string; content: string } }> {
  const title = ids.length === 1 ? doc.rows.find((r) => r.id === ids[0])?.topic || doc.title : doc.title;
  const content = outlineToNotebookHtml(doc, ids.length ? ids : undefined);
  const payload = { title, content };
  try {
    const base = prefs.notebookUrl.replace(/\/$/, "");
    const notebooks = await fetchImpl(`${base}/api/v1/notebooks`);
    if (!notebooks.ok) throw new Error(`Notebook API ${notebooks.status}`);
    const list = (await notebooks.json()) as { id: string }[];
    const notebookId = list[0]?.id;
    if (!notebookId) throw new Error("No notebooks on the Notebook API");
    const created = await fetchImpl(`${base}/api/v1/notes`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ notebook_id: notebookId, title, content, tag_ids: [] }),
    });
    if (!created.ok) throw new Error(`Create note failed (${created.status})`);
    const note = (await created.json()) as { id: string };
    return { ok: true, noteId: note.id, url: `notebook://note/${note.id}`, payload };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err), payload };
  }
}

export async function tellPeer(
  url: string,
  body: unknown,
  fetchImpl: typeof fetch = fetch,
): Promise<{ ok: boolean; result?: unknown; error?: string }> {
  try {
    const res = await fetchImpl(`${url.replace(/\/$/, "")}/automation/tell`, {
      method: "POST",
      headers: { "content-type": "application/json" },
      body: JSON.stringify(body),
    });
    const json = await res.json();
    return { ok: res.ok, result: json };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : String(err) };
  }
}

export function notebookNoteFromPaste(name: string, note?: string): { topic: string; note: string } {
  return { topic: name || "Untitled", note: note || "" };
}

export function markdownPreview(doc: OutlineDocument): string {
  return toMarkdown(doc);
}
