import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { blankDocument } from "./factory.js";
import { productLaunchDocument, meetingAgendaDocument, builtinTemplates } from "./sample.js";
import { APP_VERSION, DEFAULT_PREFERENCES, type AppState, type OutlineDocument, type Preferences, type Template } from "./types.js";
import { nowIso, uid } from "./ids.js";

const DATA_DIR = process.env.OMNILOUTLINER_DATA || process.env.OMNILINER_DATA || join(process.cwd(), "data");
const DATA_FILE = join(DATA_DIR, "omnioutliner.json");

export function defaultState(): AppState {
  const launch = productLaunchDocument();
  const meeting = meetingAgendaDocument();
  return {
    version: APP_VERSION,
    documents: [launch, meeting],
    templates: builtinTemplates(),
    preferences: { ...DEFAULT_PREFERENCES },
    recentDocumentIds: [launch.id, meeting.id],
  };
}

let cache: AppState | null = null;

export function loadState(): AppState {
  if (cache) return cache;
  if (!existsSync(DATA_FILE)) {
    cache = defaultState();
    saveState(cache);
    return cache;
  }
  const parsed = JSON.parse(readFileSync(DATA_FILE, "utf8")) as AppState;
  parsed.preferences = { ...DEFAULT_PREFERENCES, ...parsed.preferences };
  parsed.templates = parsed.templates?.length ? parsed.templates : builtinTemplates();
  parsed.documents = parsed.documents?.length ? parsed.documents : defaultState().documents;
  parsed.recentDocumentIds = parsed.recentDocumentIds ?? parsed.documents.map((d) => d.id);
  cache = parsed;
  return cache;
}

export function saveState(state: AppState = loadState()): void {
  cache = state;
  mkdirSync(dirname(DATA_FILE), { recursive: true });
  writeFileSync(DATA_FILE, JSON.stringify(state, null, 2));
}

export function resetStateForTests(state?: AppState): AppState {
  cache = state ?? defaultState();
  return cache;
}

export function getDocument(id: string): OutlineDocument {
  const doc = loadState().documents.find((d) => d.id === id);
  if (!doc) throw Object.assign(new Error(`Document not found: ${id}`), { status: 404 });
  return doc;
}

export function putDocument(doc: OutlineDocument): OutlineDocument {
  const state = loadState();
  doc.updatedAt = nowIso();
  const idx = state.documents.findIndex((d) => d.id === doc.id);
  if (idx >= 0) state.documents[idx] = doc;
  else state.documents.push(doc);
  state.recentDocumentIds = [doc.id, ...state.recentDocumentIds.filter((id) => id !== doc.id)].slice(0, 12);
  saveState(state);
  return doc;
}

export function createDocument(title = "Untitled", templateId?: string): OutlineDocument {
  const state = loadState();
  const template = state.templates.find((t) => t.id === templateId);
  let doc: OutlineDocument;
  if (template && !template.themeOnly && template.document.rows) {
    doc = structuredClone(template.document) as OutlineDocument;
    doc.id = uid("doc_");
    doc.title = title || template.document.title || "Untitled";
    doc.documentName = `${doc.title}.ooutline`;
    doc.createdAt = nowIso();
    doc.updatedAt = doc.createdAt;
  } else {
    doc = blankDocument({ title });
    if (template?.document.styles) doc.styles = structuredClone(template.document.styles!);
    if (template?.document.themeId) doc.themeId = template.document.themeId;
  }
  return putDocument(doc);
}

export function deleteDocument(id: string): void {
  const state = loadState();
  state.documents = state.documents.filter((d) => d.id !== id);
  state.recentDocumentIds = state.recentDocumentIds.filter((x) => x !== id);
  if (!state.documents.length) state.documents.push(blankDocument({ title: "Untitled" }));
  saveState(state);
}

export function patchPreferences(patch: Partial<Preferences>): Preferences {
  const state = loadState();
  state.preferences = { ...state.preferences, ...patch };
  saveState(state);
  return state.preferences;
}

export function documentSummary(doc: OutlineDocument) {
  return {
    id: doc.id,
    title: doc.title,
    documentName: doc.documentName,
    rowCount: doc.rows.length,
    columnCount: doc.columns.length,
    updatedAt: doc.updatedAt,
    themeId: doc.themeId,
  };
}

export function listTemplates(): Template[] {
  return loadState().templates;
}

export function saveAsTemplate(doc: OutlineDocument, name?: string): Template {
  const state = loadState();
  const template: Template = {
    id: uid("tpl_"),
    name: name || `${doc.title} Template`,
    builtIn: false,
    isDefault: false,
    document: structuredClone(doc),
  };
  state.templates.push(template);
  saveState(state);
  return template;
}
