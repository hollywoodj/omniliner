import assert from "node:assert/strict";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdtempSync, readFileSync, statSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";

const repo = join(fileURLToPath(new URL("..", import.meta.url))).replace(/\/$/, "");
const openScript = join(repo, "scripts/open");
const installScript = join(repo, "scripts/install-shortcut");

function install(home: string, extraEnv: Record<string, string> = {}) {
  chmodSync(installScript, 0o755);
  return spawnSync("bash", [installScript], {
    encoding: "utf8",
    env: {
      ...process.env,
      HOME: home,
      XDG_CONFIG_HOME: join(home, ".config"),
      XDG_DATA_HOME: join(home, ".local/share"),
      XDG_DESKTOP_DIR: join(home, "Desktop"),
      OMNILOUTLINER_BIN: join(home, ".local/bin"),
      OMNILOUTLINER_MAC_APP: join(home, "Applications"),
      ...extraEnv,
    },
  });
}

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

  it("installs a GNOME-searchable OmniOutliner desktop entry", () => {
    const home = mkdtempSync(join(tmpdir(), "oo-shortcut-"));
    const result = install(home, { OMNILOUTLINER_PLATFORM: "Linux" });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const desktop = readFileSync(join(home, ".local/share/applications/omnioutliner.desktop"), "utf8");
    assert.match(desktop, /Name=OmniOutliner/);
    assert.match(desktop, /Icon=omnioutliner/);
    assert.match(desktop, /Keywords=.*OmniOutliner/);
    assert.match(desktop, new RegExp(`Exec=${openScript.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
    assert.equal(statSync(join(home, ".local/share/applications/omnioutliner.desktop")).mode & 0o111, 0o111);
    assert.ok(statSync(join(home, ".local/share/icons/hicolor/128x128/apps/omnioutliner.png")).isFile());
    assert.ok(statSync(join(home, "Desktop/OmniOutliner.desktop")).isFile());
    const bin = spawnSync("readlink", ["-f", join(home, ".local/bin/omnioutliner")], { encoding: "utf8" });
    assert.equal(bin.stdout.trim(), openScript);
    assert.match(result.stdout, /always launches the working tree/i);
  });

  it("installs a Spotlight-searchable OmniOutliner.app bundle", () => {
    const home = mkdtempSync(join(tmpdir(), "oo-shortcut-mac-"));
    const result = install(home, { OMNILOUTLINER_PLATFORM: "Darwin" });
    assert.equal(result.status, 0, result.stderr + result.stdout);
    const stub = readFileSync(join(home, "Applications/OmniOutliner.app/Contents/MacOS/OmniOutliner"), "utf8");
    const plist = readFileSync(join(home, "Applications/OmniOutliner.app/Contents/Info.plist"), "utf8");
    assert.match(stub, /scripts\/open/);
    assert.match(plist, /<string>OmniOutliner<\/string>/);
    assert.match(plist, /CFBundleIdentifier/);
    assert.equal(statSync(join(home, "Applications/OmniOutliner.app/Contents/MacOS/OmniOutliner")).mode & 0o111, 0o111);
    assert.ok(statSync(join(home, "Desktop/OmniOutliner.app/Contents/MacOS/OmniOutliner")).isFile());
    assert.match(result.stdout, /OmniOutliner\.app/);
  });
});
