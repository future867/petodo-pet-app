const { app, BrowserWindow, ipcMain, screen } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let petWindow = null;
let petWindowBounds = null;
let petWindowPanelOpen = false;
let petWindowSettings = {
  scalePercent: 100,
  alwaysOnTop: true
};

const PET_SCALE_MIN = 70;
const PET_SCALE_MAX = 140;
const LEGACY_PET_SCALE_PERCENT = {
  small: (140 / 180) * 100,
  medium: 100,
  large: (220 / 180) * 100
};
const PET_WINDOW_SCALE_POINTS = [
  { percent: LEGACY_PET_SCALE_PERCENT.small, side: 220 },
  { percent: LEGACY_PET_SCALE_PERCENT.medium, side: 260 },
  { percent: LEGACY_PET_SCALE_PERCENT.large, side: 320 }
];
const PET_PANEL_SIZE = { width: 440, height: 610 };
const PET_PANEL_LAYOUT = {
  padding: 14,
  gap: 8,
  panelWidth: 228
};

function getWindowStatePath() {
  return path.join(app.getPath('userData'), 'pet-window-state.json');
}

function clampPetScalePercent(scalePercent) {
  const nextPercent = Number(scalePercent);
  if (!Number.isFinite(nextPercent)) {
    return 100;
  }

  return Math.min(PET_SCALE_MAX, Math.max(PET_SCALE_MIN, nextPercent));
}

function resolveSavedScalePercent(settings = {}) {
  if (Number.isFinite(settings.scalePercent)) {
    return clampPetScalePercent(settings.scalePercent);
  }

  return LEGACY_PET_SCALE_PERCENT[settings.scale] || 100;
}

function getPetWindowSize(scalePercent = petWindowSettings.scalePercent) {
  const percent = clampPetScalePercent(scalePercent);
  let lowerPoint = PET_WINDOW_SCALE_POINTS[0];
  let upperPoint = PET_WINDOW_SCALE_POINTS[1];

  if (percent >= PET_WINDOW_SCALE_POINTS[1].percent) {
    lowerPoint = PET_WINDOW_SCALE_POINTS[1];
    upperPoint = PET_WINDOW_SCALE_POINTS[2];
  }

  const progress = (percent - lowerPoint.percent) / (upperPoint.percent - lowerPoint.percent);
  const side = Math.round(lowerPoint.side + (upperPoint.side - lowerPoint.side) * progress);
  return { width: side, height: side };
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
      const { scale, ...savedSettings } = savedState.settings;
      petWindowSettings = {
        ...petWindowSettings,
        ...savedSettings,
        scalePercent: resolveSavedScalePercent(savedState.settings),
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
    const size = getPetWindowSize();
    const panelAnchor = getPetAnchorOffset(bounds, true);
    const normalAnchor = getPetAnchorOffset(size, false);
    petWindowBounds = {
      x: bounds.x + panelAnchor.x - normalAnchor.x,
      y: bounds.y + panelAnchor.y - normalAnchor.y,
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

function getPetAnchorOffset(size, isPanelOpen) {
  const width = Math.round(size.width);
  const height = Math.round(size.height);

  if (!isPanelOpen) {
    return {
      x: Math.round(width / 2),
      y: Math.round(height / 2)
    };
  }

  const petColumnWidth = Math.max(
    0,
    width - PET_PANEL_LAYOUT.padding * 2 - PET_PANEL_LAYOUT.gap - PET_PANEL_LAYOUT.panelWidth
  );

  return {
    x: PET_PANEL_LAYOUT.padding + Math.round(petColumnWidth / 2),
    y: Math.round(height / 2)
  };
}

function clampBoundsToDisplay(x, y, width, height, anchorX, anchorY) {
  const display = screen.getDisplayNearestPoint({ x: anchorX, y: anchorY }).workArea;

  return {
    x: Math.min(Math.max(display.x, x), display.x + display.width - width),
    y: Math.min(Math.max(display.y, y), display.y + display.height - height)
  };
}

function clampScaleAtFixedTopLeft(scalePercent) {
  if (!petWindow || petWindow.isDestroyed()) {
    return clampPetScalePercent(scalePercent);
  }

  const bounds = petWindow.getBounds();
  const display = screen.getDisplayNearestPoint({ x: bounds.x, y: bounds.y }).workArea;
  const availableSide = Math.min(
    display.x + display.width - bounds.x,
    display.y + display.height - bounds.y
  );
  let low = PET_SCALE_MIN;
  let high = clampPetScalePercent(scalePercent);

  if (getPetWindowSize(high).width <= availableSide) {
    return high;
  }

  for (let index = 0; index < 12; index += 1) {
    const middle = (low + high) / 2;
    if (getPetWindowSize(middle).width <= availableSide) {
      low = middle;
    } else {
      high = middle;
    }
  }

  return low;
}

function resizePetWindow(size, options = {}) {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const currentBounds = petWindow.getBounds();
  const nextWidth = Math.round(size.width);
  const nextHeight = Math.round(size.height);
  const fromPanelOpen = options.fromPanelOpen ?? petWindowPanelOpen;
  const toPanelOpen = options.toPanelOpen ?? petWindowPanelOpen;
  let nextX = currentBounds.x;
  let nextY = currentBounds.y;

  if (options.preserveTopLeft !== true) {
    const currentAnchor = getPetAnchorOffset(currentBounds, fromPanelOpen);
    const nextAnchor = getPetAnchorOffset({ width: nextWidth, height: nextHeight }, toPanelOpen);
    const anchorX = currentBounds.x + currentAnchor.x;
    const anchorY = currentBounds.y + currentAnchor.y;
    nextX = anchorX - nextAnchor.x;
    nextY = anchorY - nextAnchor.y;

    if (options.preservePetAnchor !== true) {
      const clamped = clampBoundsToDisplay(nextX, nextY, nextWidth, nextHeight, anchorX, anchorY);
      nextX = clamped.x;
      nextY = clamped.y;
    }
  }

  petWindow.setBounds({
    x: nextX,
    y: nextY,
    width: nextWidth,
    height: nextHeight
  }, options.animate === true);

  savePetWindowBounds();
  return petWindow.getBounds();
}

function setPetWindowScale(scalePercent = 100, options = {}) {
  const requestedPercent = typeof scalePercent === 'string'
    ? LEGACY_PET_SCALE_PERCENT[scalePercent] || 100
    : scalePercent;
  const nextPercent = options.preserveTopLeft === true && !petWindowPanelOpen
    ? clampScaleAtFixedTopLeft(requestedPercent)
    : clampPetScalePercent(requestedPercent);
  petWindowSettings.scalePercent = Math.round(nextPercent * 100) / 100;

  if (petWindowPanelOpen) {
    savePetWindowBounds();
  } else {
    resizePetWindow(getPetWindowSize(), {
      preserveTopLeft: options.preserveTopLeft === true
    });
  }
  return getPetWindowStatus();
}

function setPetWindowPanelMode(isOpen) {
  const wasPanelOpen = petWindowPanelOpen;
  petWindowPanelOpen = Boolean(isOpen);
  if (petWindowPanelOpen) {
    resizePetWindow(PET_PANEL_SIZE, {
      preservePetAnchor: true,
      fromPanelOpen: wasPanelOpen,
      toPanelOpen: true
    });
    return getPetWindowStatus();
  }

  resizePetWindow(getPetWindowSize(), {
    preservePetAnchor: true,
    fromPanelOpen: wasPanelOpen,
    toPanelOpen: false
  });
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

  const initialSize = getPetWindowSize();
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

function playPetWindowOpeningAnimation() {
  if (!petWindow || petWindow.isDestroyed()) {
    return;
  }

  const runAnimation = () => {
    if (!petWindow || petWindow.isDestroyed()) {
      return;
    }

    petWindow.webContents.executeJavaScript('window.playPetOpeningAnimation?.()', true).catch((error) => {
      console.warn('Failed to play pet opening animation:', error);
    });
  };

  if (petWindow.webContents.isLoading()) {
    petWindow.webContents.once('did-finish-load', runAnimation);
    return;
  }

  runAnimation();
}

ipcMain.handle('pet-window:open', (_event, options = {}) => {
  createPetWindow();
  if (options.openingAnimation === true) {
    playPetWindowOpeningAnimation();
  }
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

ipcMain.handle('pet-window:set-scale', (_event, scalePercent, options = {}) => setPetWindowScale(scalePercent, options));

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
