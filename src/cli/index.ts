#!/usr/bin/env node
import { Command } from "commander";
import {
  APP_VERSION,
  addRow,
  createDocument,
  deleteDocument,
  deleteRows,
  exportDocument,
  flatten,
  getDocument,
  indentRows,
  loadState,
  outdentRows,
  parseOmniUrl,
  putDocument,
  sendSelectionToOmniClone,
  sendToNotebook,
  setStatus,
  type ExportFormat,
} from "../core/index.js";

const program = new Command();
program.name("omniliner").description("OmniOutliner 6 Pro clone CLI").version(APP_VERSION);

function did(opts: { document?: string }): string {
  return opts.document || loadState().documents[0]?.id;
}

program
  .command("docs")
  .description("List documents")
  .action(() => {
    for (const d of loadState().documents) {
      console.log(`${d.id}\t${d.title}\t${d.rows.length} rows`);
    }
  });

program
  .command("new")
  .description("Create a document")
  .argument("[title]")
  .option("--template <id>")
  .action((title, opts) => {
    const d = createDocument(title || "Untitled", opts.template);
    console.log(d.id, d.title);
  });

program
  .command("delete")
  .argument("<id>")
  .action((id) => {
    deleteDocument(id);
    console.log("deleted", id);
  });

program
  .command("rows")
  .option("-d, --document <id>")
  .action((opts) => {
    const doc = getDocument(did(opts));
    for (const v of flatten(doc, { includeCollapsed: true })) {
      const pad = "  ".repeat(v.depth);
      const num = v.number ? `${v.number} ` : "";
      const st = v.effectiveStatus === "none" ? " " : v.effectiveStatus === "checked" ? "x" : v.effectiveStatus === "mixed" ? "-" : "o";
      console.log(`${pad}[${st}] ${num}${v.row.topic}`);
    }
  });

program
  .command("add")
  .argument("<topic>")
  .option("-d, --document <id>")
  .option("--note <text>")
  .option("--inside <rowId>")
  .action((topic, opts) => {
    const doc = getDocument(did(opts));
    const next = addRow(doc, opts.inside || flatten(doc).at(-1)?.row.id || null, opts.inside ? "inside" : "below", { topic, note: opts.note || "" });
    const created = next.rows.at(-1);
    putDocument(next);
    console.log(created?.id, created?.topic);
  });

program
  .command("rm")
  .argument("<rowId...>")
  .option("-d, --document <id>")
  .action((ids: string[], opts) => {
    putDocument(deleteRows(getDocument(did(opts)), ids));
  });

program
  .command("indent")
  .argument("<rowId...>")
  .option("-d, --document <id>")
  .action((ids: string[], opts) => {
    putDocument(indentRows(getDocument(did(opts)), ids));
  });

program
  .command("outdent")
  .argument("<rowId...>")
  .option("-d, --document <id>")
  .action((ids: string[], opts) => {
    putDocument(outdentRows(getDocument(did(opts)), ids));
  });

program
  .command("check")
  .argument("<rowId...>")
  .option("-d, --document <id>")
  .action((ids: string[], opts) => {
    putDocument(setStatus(getDocument(did(opts)), ids, "checked"));
  });

program
  .command("export")
  .option("-d, --document <id>")
  .option("-f, --format <fmt>", "opml", "opml")
  .action((opts) => {
    const exported = exportDocument(getDocument(did(opts)), opts.format as ExportFormat);
    process.stdout.write(exported.body);
  });

program
  .command("url")
  .argument("<url>")
  .action((url) => {
    console.log(JSON.stringify(parseOmniUrl(url), null, 2));
  });

program
  .command("send-omniclone")
  .option("-d, --document <id>")
  .argument("[rowIds...]")
  .action((ids: string[], opts) => {
    const payload = sendSelectionToOmniClone(getDocument(did(opts)), ids, loadState().preferences);
    console.log(payload.taskPaper);
    for (const u of payload.urls) console.error(u);
  });

program
  .command("send-notebook")
  .option("-d, --document <id>")
  .argument("[rowIds...]")
  .action(async (ids: string[], opts) => {
    const result = await sendToNotebook(getDocument(did(opts)), ids, loadState().preferences);
    console.log(JSON.stringify(result, null, 2));
  });

program.parseAsync(process.argv);
