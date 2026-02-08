const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('typecal', {
  version: () => '1.0.0',
  getTodayOpenTasks: () => ipcRenderer.invoke('notion:getTodayOpenTasks'),
  getNotionConfig: () => ipcRenderer.invoke('notion:getConfig'),
  setNotionConfig: (config) => ipcRenderer.invoke('notion:setConfig', config),
});
