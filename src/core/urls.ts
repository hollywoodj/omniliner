export type OmniUrlKind =
  | "row"
  | "document"
  | "open"
  | "add"
  | "paste"
  | "run"
  | "x-callback-add"
  | "unknown";

export interface ParsedOmniUrl {
  app: string;
  kind: OmniUrlKind;
  ids: string[];
  query: Record<string, string>;
  raw: string;
}

function queryFrom(url: URL): Record<string, string> {
  const out: Record<string, string> = {};
  url.searchParams.forEach((value, key) => {
    out[key] = value;
  });
  return out;
}

/** Normalize `omnioutliner:///path` (three slashes) into a parseable URL. */
export function parseOmniUrl(raw: string): ParsedOmniUrl {
  const value = String(raw ?? "").trim();
  const app = (value.match(/^([a-z][a-z0-9+.-]*):/i)?.[1] || "omnioutliner").toLowerCase();
  const normalized = value.replace(/^([a-z][a-z0-9+.-]*):\/\/\//i, "$1://localhost/");
  let url: URL;
  try {
    url = new URL(normalized);
  } catch {
    return { app, kind: "unknown", ids: [], query: {}, raw: value };
  }
  const query = queryFrom(url);
  const parts = url.pathname.replace(/^\//, "").split("/").filter(Boolean);
  if (parts[0] === "x-callback-url" && parts[1] === "add") {
    return { app, kind: "x-callback-add", ids: [], query, raw: value };
  }
  if (parts[0] === "add") return { app, kind: "add", ids: [], query, raw: value };
  if (parts[0] === "paste") return { app, kind: "paste", ids: [], query, raw: value };
  if (parts[0] === "open" || query.row) {
    const id = query.row || parts[1] || "";
    return { app, kind: "open", ids: id ? [id] : [], query, raw: value };
  }
  if (parts[0] === "row" || parts[0] === "task") {
    const ids = (parts[1] || "").split(",").filter(Boolean);
    return { app, kind: "row", ids, query, raw: value };
  }
  if (parts[0] === "document" || parts[0] === "file") {
    return { app, kind: "document", ids: parts[1] ? [parts[1]] : [], query, raw: value };
  }
  if (url.hostname === "localhost" && url.pathname.includes("omnijs-run")) {
    return { app, kind: "run", ids: [], query, raw: value };
  }
  return { app, kind: "unknown", ids: parts.slice(1), query, raw: value };
}

export function rowUrl(rowId: string, scheme = "omnioutliner"): string {
  return `${scheme}:///open?row=${encodeURIComponent(rowId)}`;
}

export function documentUrl(docId: string, scheme = "omnioutliner"): string {
  return `${scheme}:///document/${encodeURIComponent(docId)}`;
}

export function addUrl(
  params: { name: string; note?: string; autosave?: boolean; xSuccess?: string },
  scheme = "omnioutliner",
): string {
  const path = params.xSuccess ? "x-callback-url/add" : "add";
  const qs = new URLSearchParams();
  qs.set("name", params.name);
  if (params.note) qs.set("note", params.note);
  qs.set("autosave", params.autosave === false ? "false" : "true");
  if (params.xSuccess) qs.set("x-success", params.xSuccess);
  return `${scheme}:///${path}?${qs.toString()}`;
}

export function pasteUrl(content: string, scheme = "omnioutliner"): string {
  const qs = new URLSearchParams({ content });
  return `${scheme}:///paste?${qs.toString()}`;
}
