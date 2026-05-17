const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let petWindow = null;
let petWindowBounds = null;
let petWindowPanelOpen = false;
let petWindowSettings = {
  scale: 'medium',
  alwaysOnTop: true
};

const PET_WINDOW_SIZES = {
  small: { width: 220, height: 220 },
  medium: { width: 260, height: 260 },
  large: { width: 320, height: 320 }
};
const PET_PANEL_SIZE = { width: 440, height: 550 };

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'pet-window-state.json');
}

function loadPetWindowBounds() {
  try {
    const raw = fs.readFileSync(getWindowStatePath(), 'utf8');
    const savedState = JSON.parse(raw);
    const bounds = savedState.bounds || savedState;
    if (
      Number.isInteger(bounds.x) &&
      Number.isInteger(bounds.y) &&
      Number.isInteger(bounds.width) &&
      Number.isInteger(bounds.height)
    ) {
      petWindowBounds = bounds;
    }

    if (savedState.settings && typeof savedState.settings === 'object') {
      petWindowSettings = {
        ...petWindowSettings,
        ...savedState.settings,
        scale: PET_WINDOW_SIZES[savedState.settings.scale] ? savedState.settings.scale : petWindowSettings.scale,
        alwaysOnTop: savedState.settings.alwaysOnTop !== false
      };
    }
  } catch {
    petWindowBounds = null;
  }
}

function savePetWindowBounds() {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  const bounds = petWindow.getBounds();
  if (petWindowPanelOpen) {
    const size = PET_WINDOW_SIZES[petWindowSettings.scale] || PET_WINDOW_SIZES.medium;
    petWindowBounds = {
      x: bounds.x + Math.round((bounds.width - size.width) / 2),
      y: bounds.y + Math.round((bounds.height - size.height) / 2),
      width: size.width,
      height: size.height
    };
  } else {
    petWindowBounds = bounds;
  }

  try {
    fs.writeFileSync(
      getWindowStatePath(),
      JSON.stringify({ bounds: petWindowBounds, settings: petWindowSettings }, null, 2),
      'utf8'
    );
  } catch (error) {
    console.warn('Failed to save pet window position:', error);
  }
}

function getPetWindowStatus() {
  return {
    isOpen: Boolean(petWindow && !petWindow.isDestroyed()),
    bounds: petWindow && !petWindow.isDestroyed() ? petWindow.getBounds() : null,
    settings: petWindowSettings
  };
}

function getPetWindowBounds() {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  return petWindow.getBounds();
}

function movePetWindow(bounds = {}) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const currentBounds = petWindow.getBounds();
  const nextX = Number.isFinite(bounds.x) ? Math.round(bounds.x) : currentBounds.x;
  const nextY = Number.isFinite(bounds.y) ? Math.round(bounds.y) : currentBounds.y;

  petWindow.setPosition(nextX, nextY, false);
  return petWindow.getBounds();
}

function resizePetWindow(size, options = {}) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const currentBounds = petWindow.getBounds();
  const anchorX = currentBounds.x + Math.round(currentBounds.width / 2);
  const anchorY = currentBounds.y + Math.round(currentBounds.height / 2);
  const nextWidth = Math.round(size.width);
  const nextHeight = Math.round(size.height);
  const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY }).workArea;
  const nextX = Math.min(
    Math.max(display.x, anchorX - Math.round(nextWidth / 2)),
    display.x + display.width - nextWidth
  );
  const nextY = Math.min(
    Math.max(display.y, anchorY - Math.round(nextHeight / 2)),
    display.y + display.height - nextHeight
  );

  petWindow.setBounds({
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight
  }, options.animate === true);

  savePetWindowBounds();
  return petWindow.getBounds();
}

function setPetWindowScale(scale = 'medium') {
  const nextScale = PET_WINDOW_SIZES[scale] ? scale : 'medium';
  petWindowSettings.scale = nextScale;
  resizePetWindow(PET_WINDOW_SIZES[nextScale]);
  return getPetWindowStatus();
}

function setPetWindowPanelMode(isOpen) {
  petWindowPanelOpen = Boolean(isOpen);
  if (isOpen) {
    resizePetWindow(PET_PANEL_SIZE);
    return getPetWindowStatus();
  }

  resizePetWindow(PET_WINDOW_SIZES[petWindowSettings.scale] || PET_WINDOW_SIZES.medium);
  return getPetWindowStatus();
}

function setPetWindowAlwaysOnTop(enabled) {
  petWindowSettings.alwaysOnTop = Boolean(enabled);
  if (petWindow && !petWindow.isDestroyed()) {
    petWindow.setAlwaysOnTop(petWindowSettings.alwaysOnTop, 'screen-saver');
    if (petWindowSettings.alwaysOnTop) {
      petWindow.moveTop();
    }
  }
  savePetWindowBounds();
  return getPetWindowStatus();
}

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 640,
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

  const initialSize = PET_WINDOW_SIZES[petWindowSettings.scale] || PET_WINDOW_SIZES.medium;
  petWindow = new BrowserWindow({
    width: initialSize.width,
    height: initialSize.height,
    x: petWindowBounds?.x,
    y: petWindowBounds?.y,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: petWindowSettings.alwaysOnTop,
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
  petWindow.setAlwaysOnTop(petWindowSettings.alwaysOnTop, 'screen-saver');
  petWindow.moveTop();

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

ipcMain.handle('pet-window:get-bounds', () => getPetWindowBounds());

ipcMain.handle('pet-window:move', (_event, bounds) => movePetWindow(bounds));

ipcMain.handle('pet-window:set-panel-mode', (_event, isOpen) => setPetWindowPanelMode(isOpen));

ipcMain.handle('pet-window:set-scale', (_event, scale) => setPetWindowScale(scale));

ipcMain.handle('pet-window:set-always-on-top', (_event, enabled) => setPetWindowAlwaysOnTop(enabled));

ipcMain.handle('main-window:show', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }
  mainWindow.show();
  mainWindow.focus();
  return true;
});

ipcMain.handle('app:quit', () => {
  app.quit();
  return true;
});

ipcMain.handle('pet-window:save-position', () => {
  savePetWindowBounds();
  return getPetWindowBounds();
});

app.whenReady().then(() => {
  loadPetWindowBounds();
  createMainWindow();
  createPetWindow();

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
