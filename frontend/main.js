const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');

let mainWindow = null;
let petWindow = null;

function getPetWindowStatus() {
  return {
    isOpen: Boolean(petWindow && !petWindow.isDestroyed())
  };
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 640,
    minWidth: 720,
    minHeight: 520,
    title: 'Petodo 像素桌宠番茄钟',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');

  mainWindow.on('closed', () => {
    mainWindow = null;
    if (petWindow && !petWindow.isDestroyed()) {
      petWindow.close();
    }
  });
}

function createPetWindow() {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.focus();
    return petWindow;
  }

  petWindow = new BrowserWindow({
    width: 220,
    height: 180,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    title: 'Petodo 小猫',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  petWindow.loadFile('pet_window.html');

  petWindow.on('closed', () => {
    petWindow = null;
  });

  return petWindow;
}

ipcMain.handle('pet-window:open', () => {
  createPetWindow();
  return getPetWindowStatus();
});

ipcMain.handle('pet-window:close', () => {
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.close();
  }
  return { isOpen: false };
});

ipcMain.handle('pet-window:status', () => getPetWindowStatus());

app.whenReady().then(() => {
  createMainWindow();

  app.on('activate', () => {
    if (!mainWindow) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});
