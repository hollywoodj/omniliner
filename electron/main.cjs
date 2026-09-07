const { app, BrowserWindow, shell, Menu, dialog, ipcMain } = require("electron");
const path = require("path");
const { spawn } = require("child_process");
const http = require("http");
const fs = require("fs");

const APP_NAME = "OmniOutliner";
const DEFAULT_PORT = 4466;
let mainWindow = null;
let serverProcess = null;
let serverPort = DEFAULT_PORT;
const pendingUrls = [];

function appRoot() {
  return app.isPackaged ? process.resourcesPath : path.join(__dirname, "..");
}

function serverEntryPath() {
  if (!app.isPackaged) return path.join(appRoot(), "dist", "server", "index.js");
  return path.join(process.resourcesPath, "app.asar.unpacked", "dist", "server", "index.js");
}

function userDataDir() {
  return path.join(app.getPath("userData"), "data");
}

function waitForHealth(port, attempts = 60) {
  return new Promise((resolve, reject) => {
    let n = 0;
    const tick = () => {
      const req = http.get(`http://127.0.0.1:${port}/api/health`, (res) => {
        res.resume();
        if (res.statusCode === 200) resolve();
        else if (++n >= attempts) reject(new Error("Server health check failed"));
        else setTimeout(tick, 250);
      });
      req.on("error", () => {
        if (++n >= attempts) reject(new Error("Server did not start"));
        else setTimeout(tick, 250);
      });
    };
    tick();
  });
}

function startBackend() {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(userDataDir(), { recursive: true });
    const root = appRoot();
    const serverEntry = serverEntryPath();
    const env = {
      ...process.env,
      OMNILINER_DATA: userDataDir(),
      PORT: String(serverPort),
      NODE_ENV: "production",
    };

    if (app.isPackaged) {
      serverProcess = spawn(process.execPath, [serverEntry], {
        env: { ...env, ELECTRON_RUN_AS_NODE: "1" },
        stdio: "inherit",
        cwd: root,
      });
    } else {
      serverProcess = spawn(process.platform === "win32" ? "npx.cmd" : "npx", ["tsx", path.join(root, "src", "server", "index.ts")], {
        env,
        stdio: "inherit",
        cwd: root,
        shell: process.platform === "win32",
      });
    }

    serverProcess.on("error", reject);
    serverProcess.on("exit", (code) => {
      if (code && code !== 0) console.error(`${APP_NAME} server exited with code ${code}`);
    });
    waitForHealth(serverPort).then(resolve).catch(reject);
  });
}

function stopBackend() {
  if (serverProcess && !serverProcess.killed) {
    serverProcess.kill("SIGTERM");
    serverProcess = null;
  }
}

function sendOpenUrl(url) {
  if (mainWindow && !mainWindow.isDestroyed()) mainWindow.webContents.send("open-url", url);
  else pendingUrls.push(url);
}

function isAllowedExternalUrl(url) {
  return /^(https?:|mailto:|omniclone:|omnifocus:|omniplan:|omnioutliner:|omniliner:|notebook:)/i.test(String(url || ""));
}

function buildMenu() {
  const template = [
    {
      label: APP_NAME,
      submenu: [{ role: "about" }, { type: "separator" }, { role: "services" }, { type: "separator" }, { role: "hide" }, { role: "hideOthers" }, { role: "unhide" }, { type: "separator" }, { role: "quit" }],
    },
    {
      label: "File",
      submenu: [
        { label: "Reload", accelerator: "CmdOrCtrl+R", click: () => mainWindow?.webContents.reload() },
        { type: "separator" },
        { role: "close" },
      ],
    },
    { label: "Edit", submenu: [{ role: "undo" }, { role: "redo" }, { type: "separator" }, { role: "cut" }, { role: "copy" }, { role: "paste" }, { role: "selectAll" }] },
    { label: "View", submenu: [{ role: "reload" }, { role: "toggleDevTools" }, { type: "separator" }, { role: "resetZoom" }, { role: "zoomIn" }, { role: "zoomOut" }, { type: "separator" }, { role: "togglefullscreen" }] },
    { label: "Window", submenu: [{ role: "minimize" }, { role: "zoom" }, { type: "separator" }, { role: "front" }] },
    {
      label: "Help",
      submenu: [
        { label: "OmniOutliner Documentation", click: () => shell.openExternal("https://support.omnigroup.com/documentation/omnioutliner/universal/6.2.1/en/") },
        { label: "Show Data Folder", click: () => shell.openPath(userDataDir()) },
      ],
    },
  ];
  Menu.setApplicationMenu(Menu.buildFromTemplate(template));
}

async function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1440,
    height: 900,
    minWidth: 960,
    minHeight: 640,
    title: APP_NAME,
    backgroundColor: "#ececec",
    show: false,
    webPreferences: {
      preload: path.join(__dirname, "preload.cjs"),
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
    },
  });

  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
    for (const url of pendingUrls.splice(0)) sendOpenUrl(url);
  });
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
    return { action: "deny" };
  });
  mainWindow.webContents.on("will-navigate", (event, url) => {
    if (url.startsWith("http://127.0.0.1:") || url.startsWith("http://localhost:")) return;
    event.preventDefault();
    if (isAllowedExternalUrl(url)) shell.openExternal(url);
  });

  await mainWindow.loadURL(`http://127.0.0.1:${serverPort}/`);
  mainWindow.on("closed", () => {
    mainWindow = null;
  });
}

ipcMain.handle("open-external", (_e, url) => {
  if (isAllowedExternalUrl(url)) return shell.openExternal(url);
});

function handleProtocolUrl(url) {
  if (/^(omnioutliner|omniliner):/i.test(url)) sendOpenUrl(url);
}

const gotLock = app.requestSingleInstanceLock();
if (!gotLock) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const url = argv.find((a) => /^(omnioutliner|omniliner):/i.test(a));
    if (url) handleProtocolUrl(url);
    if (mainWindow) {
      if (mainWindow.isMinimized()) mainWindow.restore();
      mainWindow.focus();
    }
  });

  app.on("open-url", (event, url) => {
    event.preventDefault();
    handleProtocolUrl(url);
  });

  if (process.defaultApp) {
    if (process.argv.length >= 2) {
      app.setAsDefaultProtocolClient("omnioutliner", process.execPath, [path.resolve(process.argv[1])]);
      app.setAsDefaultProtocolClient("omniliner", process.execPath, [path.resolve(process.argv[1])]);
    }
  } else {
    app.setAsDefaultProtocolClient("omnioutliner");
    app.setAsDefaultProtocolClient("omniliner");
  }

  app.whenReady().then(async () => {
    buildMenu();
    try {
      await startBackend();
      await createWindow();
    } catch (err) {
      dialog.showErrorBox(`${APP_NAME} failed to start`, err instanceof Error ? err.message : String(err));
      app.quit();
    }
  });

  app.on("window-all-closed", () => {
    if (process.platform !== "darwin") app.quit();
  });

  app.on("activate", async () => {
    if (BrowserWindow.getAllWindows().length === 0 && serverProcess) await createWindow();
  });

  app.on("before-quit", () => stopBackend());
}
