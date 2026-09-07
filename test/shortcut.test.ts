import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { mkdtempSync, readFileSync, chmodSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(fileURLToPath(new URL("..", import.meta.url))).replace(/\/$/, "");
const openScript = join(repo, "scripts/open");
const installScript = join(repo, "scripts/install-shortcut");

describe("evergreen OmniOutliner shortcut", () => {
  it("resolves the current working tree as the launch target", () => {
    chmodSync(openScript, 0o755);
    const result = spawnSync("bash", [openScript, "--print-repo"], {
      encoding: "utf8",
      env: { ...process.env, OMNILOUTLINER_HOME: repo },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), repo);
  });

  it("prints the live UI URL, not a packaged binary path", () => {
    const result = spawnSync("bash", [openScript, "--print-url"], {
      encoding: "utf8",
      env: { ...process.env, OMNILOUTLINER_HOME: repo },
    });
    assert.equal(result.status, 0, result.stderr);
    assert.equal(result.stdout.trim(), "http://127.0.0.1:5174/");
  });

  it("installs one OmniOutliner shortcut that execs scripts/open", () => {
    chmodSync(installScript, 0o755);
    const home = mkdtempSync(join(tmpdir(), "oo-shortcut-"));
    const result = spawnSync("bash", [installScript], {
      encoding: "utf8",
      env: {
        ...process.env,
        HOME: home,
        XDG_CONFIG_HOME: join(home, ".config"),
        XDG_DATA_HOME: join(home, ".local/share"),
        OMNILOUTLINER_BIN: join(home, ".local/bin"),
        OMNILOUTLINER_MAC_APP: join(home, "Applications"),
      },
    });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const desktop = join(home, ".local/share/applications/omnioutliner.desktop");
    const command = join(home, "Applications/OmniOutliner.command");
    const bin = join(home, ".local/bin/omnioutliner");
    const pinned = readFileSync(join(home, ".config/OmniOutliner/repo"), "utf8").trim();
    assert.equal(pinned, repo);
    const installed = process.platform === "darwin" ? readFileSync(command, "utf8") : readFileSync(desktop, "utf8");
    assert.match(installed, /scripts\/open/);
    const target = spawnSync("readlink", ["-f", bin], { encoding: "utf8" });
    assert.equal(target.stdout.trim(), openScript);
    assert.match(result.stdout, /always launches the working tree/i);
  });
});
