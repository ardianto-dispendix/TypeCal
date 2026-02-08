const { app, BrowserWindow, shell, Menu, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = !app.isPackaged;
const { registerNotionIpc } = require('./notion');

function createWindow() {
  const isMac = process.platform === 'darwin';
  
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 520,
    minWidth: 600,
    minHeight: 520,
    maxWidth: 600,
    maxHeight: 720,
    backgroundColor: '#212225',
    show: false,    
    frame: isMac,
    titleBarStyle: isMac ? 'hiddenInset' : 'default',
    trafficLightPosition: isMac ? { x: 16, y: 12 } : undefined,
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.setTitle('TypeCal');

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:4200';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    let indexPath = path.join(__dirname, 'dist', 'text-calculator', 'index.html');
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(__dirname, '..', 'dist', 'text-calculator', 'index.html');
    }
    
    console.log('Loading file:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    mainWindow.loadURL(pathToFileURL(indexPath).href);
  }
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] [${level}] ${message} (${sourceId}:${line})`);
  });

  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  Menu.setApplicationMenu(null);
  registerNotionIpc(app, ipcMain);
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
