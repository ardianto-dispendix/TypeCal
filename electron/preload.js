const { contextBridge } = require('electron');

// Minimal, future-proof bridge. Add safe APIs here if needed later.
contextBridge.exposeInMainWorld('typecal', {
  version: () => '1.0.0',
});
