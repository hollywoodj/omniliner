const { contextBridge, ipcRenderer, shell } = require("electron");

contextBridge.exposeInMainWorld("omnilinerDesktop", {
  platform: process.platform,
  isElectron: true,
  versions: {
    electron: process.versions.electron,
    chrome: process.versions.chrome,
    node: process.versions.node,
  },
  openExternal: (url) => ipcRenderer.invoke("open-external", url),
  onOpenUrl: (cb) => {
    const listener = (_event, url) => cb(url);
    ipcRenderer.on("open-url", listener);
    return () => ipcRenderer.removeListener("open-url", listener);
  },
});
