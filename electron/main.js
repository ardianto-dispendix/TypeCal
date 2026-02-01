const { app, BrowserWindow, shell, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const isDev = !app.isPackaged;

function createWindow() {
  const mainWindow = new BrowserWindow({
    width: 600,
    height: 310,
    minWidth: 600,
    minHeight: 310,
    backgroundColor: '#212225',
    show: false,    
    frame: false,    
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      sandbox: true,
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  mainWindow.once('ready-to-show', () => mainWindow.show());

  if (isDev) {
    const devUrl = process.env.ELECTRON_RENDERER_URL || 'http://localhost:4200';
    mainWindow.loadURL(devUrl);
    mainWindow.webContents.openDevTools({ mode: 'detach' });
  } else {
    // Try multiple possible paths for the dist folder
    let indexPath = path.join(__dirname, 'dist', 'text-calculator', 'index.html');
    
    // Check if file exists, otherwise try parent directory
    if (!fs.existsSync(indexPath)) {
      indexPath = path.join(__dirname, '..', 'dist', 'text-calculator', 'index.html');
    }
    
    console.log('Loading file:', indexPath);
    console.log('File exists:', fs.existsSync(indexPath));
    mainWindow.loadURL(pathToFileURL(indexPath).href);
    
    // Open dev tools to see any errors (optional - can be removed)
    // mainWindow.webContents.openDevTools({ mode: 'detach' });
  }

  // Log any errors
  mainWindow.webContents.on('crashed', () => {
    console.error('Renderer process crashed');
  });

  mainWindow.webContents.on('did-fail-load', (event, errorCode, errorDescription) => {
    console.error(`Failed to load: ${errorCode} ${errorDescription}`);
  });

  mainWindow.webContents.on('console-message', (event, level, message, line, sourceId) => {
    console.log(`[Renderer] [${level}] ${message} (${sourceId}:${line})`);
  });

  // Open external links in the system browser.
  mainWindow.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url);
    return { action: 'deny' };
  });
}

app.whenReady().then(() => {
  // Remove the menu bar
  Menu.setApplicationMenu(null);
  
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
