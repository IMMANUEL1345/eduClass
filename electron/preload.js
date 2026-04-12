const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
  getDbConfig:  ()    => ipcRenderer.invoke('get-db-config'),
  openExternal: (url) => ipcRenderer.invoke('open-external', url),
  platform:     process.platform,
  isDesktop:    true,
});
