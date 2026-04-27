const { app, BrowserWindow, ipcMain } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let petWindow = null;
let petWindowBounds = null;

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'pet-window-state.json');
}

function loadPetWindowBounds() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), 'utf8');
    const bounds = JSON.parse(raw);
    if (
      Number.isInteger(bounds.x) &&
      Number.isInteger(bounds.y) &&
      Number.isInteger(bounds.width) &&
      Number.isInteger(bounds.height)
    ) {
      petWindowBounds = bounds;
    }
  } catch {
    petWindowBounds = null;
  }
}

function savePetWindowBounds() {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  petWindowBounds = petWindow.getBounds();

  try {
    fs.writeFileSync(getWindowStatePath(), JSON.stringify(petWindowBounds, null, 2), 'utf8');
  } catch (error) {
    console.warn('Failed to save pet window position:', error);
  }
}

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
    title: 'Petodo 番茄钟桌宠',
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
    width: 260,
    height: 260,
    x: petWindowBounds?.x,
    y: petWindowBounds?.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    title: 'Petodo 桌宠',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  const petTheme = process.env.PETODO_PET_THEME;
  petWindow.loadFile('pet_window.html');
  if (petTheme) {
    petWindow.webContents.once('did-finish-load', () => {
      petWindow.webContents.executeJavaScript(`window.setPetTheme(${JSON.stringify(petTheme)})`);
    });
  }
  petWindow.setMenuBarVisibility(false);
  petWindow.setIgnoreMouseEvents(false);

  petWindow.on('moved', () => {
    savePetWindowBounds();
  });

  petWindow.on('closed', () => {
    petWindow = null;
  });

  petWindow.on('close', () => {
    savePetWindowBounds();
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
  loadPetWindowBounds();
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
