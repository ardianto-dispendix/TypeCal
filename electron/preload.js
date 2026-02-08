const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('typecal', {
  version: () => '1.0.0',
  getTodayOpenTasks: () => ipcRenderer.invoke('notion:getTodayOpenTasks'),
  getNotionConfig: () => ipcRenderer.invoke('notion:getConfig'),
  setNotionConfig: (config) => ipcRenderer.invoke('notion:setConfig', config),
  getTodayCalendarEvents: () => ipcRenderer.invoke('googleCalendar:getTodayEvents'),
  getGoogleCalendarConfig: () => ipcRenderer.invoke('googleCalendar:getConfig'),
  setGoogleCalendarConfig: (config) => ipcRenderer.invoke('googleCalendar:setConfig', config),
});
