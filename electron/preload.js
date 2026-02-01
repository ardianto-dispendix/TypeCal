const { contextBridge } = require('electron');

contextBridge.exposeInMainWorld('typecal', {
  version: () => '1.0.0',
});
