const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray } = require('electron');
const fs = require('fs');
const path = require('path');

let mainWindow = null;
let petWindow = null;
let countdownWidgetWindow = null;
let todoWidgetWindow = null;
let tray = null;
let isQuitting = false;
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

function getCountdownStoragePath() {
  return path.join(app.getPath('userData'), 'countdown-goals.json');
}

function getTodoStoragePath() {
  return path.join(app.getPath('userData'), 'todo-state.json');
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function isValidDateKey(value) {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const [year, month, day] = value.split('-').map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  return date.getUTCFullYear() === year
    && date.getUTCMonth() === month - 1
    && date.getUTCDate() === day;
}

function normalizeTodoList(tasks = []) {
  if (!Array.isArray(tasks)) {
    return [];
  }

  return tasks
    .filter((task) => task && typeof task.name === 'string')
    .map((task) => ({
      id: String(task.id || createId('task')),
      name: task.name.trim(),
      type: typeof task.type === 'string' && task.type.trim() ? task.type : '学习',
      estimatedPomodoros: Number(task.estimatedPomodoros) || 1,
      completedPomodoros: Number(task.completedPomodoros) || 0,
      completedFocusRecordKeys: Array.isArray(task.completedFocusRecordKeys)
        ? task.completedFocusRecordKeys.map(String)
        : [],
      completed: Boolean(task.completed)
    }))
    .filter((task) => task.name);
}

function normalizeTodoState(todoState = {}) {
  const todoList = normalizeTodoList(todoState.todoList);
  const currentTaskId = typeof todoState.currentTaskId === 'string'
    && todoList.some((task) => task.id === todoState.currentTaskId && !task.completed)
    ? todoState.currentTaskId
    : '';
  const todoListDate = isValidDateKey(todoState.todoListDate) ? todoState.todoListDate : '';

  return {
    todoList,
    currentTaskId,
    todoListDate
  };
}

function loadTodoStateFromDisk() {
  try {
    const raw = fs.readFileSync(getTodoStoragePath(), 'utf8');
    return normalizeTodoState(JSON.parse(raw));
  } catch {
    return normalizeTodoState();
  }
}

function saveTodoStateToDisk(todoState = {}) {
  const normalizedState = normalizeTodoState(todoState);
  fs.writeFileSync(
    getTodoStoragePath(),
    JSON.stringify(normalizedState, null, 2),
    'utf8'
  );
  return normalizedState;
}

function normalizeCountdownGoals(goals = []) {
  if (!Array.isArray(goals)) {
    return [];
  }

  return goals
    .filter((goal) => goal && typeof goal.name === 'string' && isValidDateKey(goal.targetDate))
    .map((goal) => ({
      id: String(goal.id || `countdown-${Date.now()}-${Math.random().toString(16).slice(2)}`),
      name: goal.name.trim(),
      targetDate: goal.targetDate,
      note: typeof goal.note === 'string' ? goal.note.trim() : ''
    }))
    .filter((goal) => goal.name);
}

function loadCountdownGoalsFromDisk() {
  try {
    const raw = fs.readFileSync(getCountdownStoragePath(), 'utf8');
    return normalizeCountdownGoals(JSON.parse(raw));
  } catch {
    return [];
  }
}

function saveCountdownGoalsToDisk(goals = []) {
  const normalizedGoals = normalizeCountdownGoals(goals);
  fs.writeFileSync(
    getCountdownStoragePath(),
    JSON.stringify(normalizedGoals, null, 2),
    'utf8'
  );
  return normalizedGoals;
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

function updateTrayMenu() {
  if (!tray) {
    return;
  }

  const contextMenu = Menu.buildFromTemplate([
    {
      label: '打开主窗口',
      click: () => showMainWindow()
    },
    { type: 'separator' },
    {
      label: '打开今日待办小组件',
      click: () => createTodoWidgetWindow()
    },
    {
      label: '关闭今日待办小组件',
      enabled: Boolean(todoWidgetWindow && !todoWidgetWindow.isDestroyed()),
      click: () => closeTodoWidgetWindow()
    },
    { type: 'separator' },
    {
      label: '打开未来倒计时小组件',
      click: () => createCountdownWidgetWindow()
    },
    {
      label: '关闭未来倒计时小组件',
      enabled: Boolean(countdownWidgetWindow && !countdownWidgetWindow.isDestroyed()),
      click: () => closeCountdownWidgetWindow()
    },
    { type: 'separator' },
    {
      label: '退出 Petodo',
      click: () => {
        isQuitting = true;
        app.quit();
      }
    }
  ]);

  tray.setContextMenu(contextMenu);
}

function createTray() {
  if (tray) {
    return tray;
  }

  const iconPath = path.join(__dirname, 'assets', 'pet', 'luoxiaohei', 'happy', 'happy_01.png');
  const trayIcon = fs.existsSync(iconPath)
    ? nativeImage.createFromPath(iconPath).resize({ width: 16, height: 16 })
    : nativeImage.createEmpty();

  tray = new Tray(trayIcon);
  tray.setToolTip('Petodo');
  tray.on('click', () => showMainWindow());
  updateTrayMenu();
  return tray;
}

function showMainWindow(pageName) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    createMainWindow();
  }

  mainWindow.show();
  if (mainWindow.isMinimized()) {
    mainWindow.restore();
  }
  mainWindow.focus();

  if (pageName) {
    const sendNavigation = () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('navigation:set-page', pageName);
      }
    };

    if (mainWindow.webContents.isLoading()) {
      mainWindow.webContents.once('did-finish-load', sendNavigation);
    } else {
      sendNavigation();
    }
  }

  return true;
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

  mainWindow.on('close', (event) => {
    if (isQuitting) {
      return;
    }

    event.preventDefault();
    mainWindow.hide();
  });

  mainWindow.on('closed', () => {
    mainWindow = null;
    updateTrayMenu();
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
    updateTrayMenu();
  });

  petWindow.on('close', () => {
    savePetWindowBounds();
  });

  return petWindow;
}

function createCountdownWidgetWindow() {
  if (countdownWidgetWindow && !countdownWidgetWindow.isDestroyed()) {
    countdownWidgetWindow.show();
    countdownWidgetWindow.focus();
    countdownWidgetWindow.moveTop();
    return countdownWidgetWindow;
  }

  countdownWidgetWindow = new BrowserWindow({
    width: 260,
    height: 180,
    minWidth: 260,
    minHeight: 180,
    maxWidth: 320,
    maxHeight: 240,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    title: 'Petodo 倒计时小组件',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  countdownWidgetWindow.loadFile('countdown_widget.html');
  countdownWidgetWindow.setMenuBarVisibility(false);
  countdownWidgetWindow.setAlwaysOnTop(true, 'screen-saver');
  countdownWidgetWindow.moveTop();

  countdownWidgetWindow.on('closed', () => {
    countdownWidgetWindow = null;
    updateTrayMenu();
  });

  updateTrayMenu();
  return countdownWidgetWindow;
}

function closeCountdownWidgetWindow() {
  if (countdownWidgetWindow && !countdownWidgetWindow.isDestroyed()) {
    countdownWidgetWindow.close();
  }
}

function createTodoWidgetWindow() {
  if (todoWidgetWindow && !todoWidgetWindow.isDestroyed()) {
    todoWidgetWindow.show();
    todoWidgetWindow.focus();
    todoWidgetWindow.moveTop();
    return todoWidgetWindow;
  }

  todoWidgetWindow = new BrowserWindow({
    width: 280,
    height: 320,
    minWidth: 260,
    minHeight: 280,
    maxWidth: 340,
    maxHeight: 420,
    frame: false,
    transparent: true,
    resizable: false,
    alwaysOnTop: true,
    skipTaskbar: true,
    backgroundColor: '#00000000',
    title: '今日待办小组件',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  todoWidgetWindow.loadFile('todo_widget.html');
  todoWidgetWindow.setMenuBarVisibility(false);
  todoWidgetWindow.setAlwaysOnTop(true, 'screen-saver');
  todoWidgetWindow.moveTop();

  todoWidgetWindow.on('closed', () => {
    todoWidgetWindow = null;
    updateTrayMenu();
  });

  updateTrayMenu();
  return todoWidgetWindow;
}

function closeTodoWidgetWindow() {
  if (todoWidgetWindow && !todoWidgetWindow.isDestroyed()) {
    todoWidgetWindow.close();
  }
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

ipcMain.handle('main-window:show', (_event, pageName) => showMainWindow(pageName));

ipcMain.handle('app:quit', () => {
  isQuitting = true;
  app.quit();
  return true;
});

ipcMain.handle('pet-window:save-position', () => {
  savePetWindowBounds();
  return getPetWindowBounds();
});

ipcMain.handle('countdown-widget:open', () => {
  createCountdownWidgetWindow();
  return true;
});

ipcMain.handle('countdown-widget:close', () => {
  closeCountdownWidgetWindow();
  return true;
});

ipcMain.handle('todo-widget:open', () => {
  createTodoWidgetWindow();
  return true;
});

ipcMain.handle('todo-widget:close', () => {
  closeTodoWidgetWindow();
  return true;
});

ipcMain.handle('countdown-storage:load', () => loadCountdownGoalsFromDisk());

ipcMain.handle('countdown-storage:save', (_event, goals = []) => {
  return saveCountdownGoalsToDisk(goals);
});

ipcMain.handle('todo-storage:load', () => loadTodoStateFromDisk());

ipcMain.handle('todo-storage:save', (_event, todoState = {}) => {
  return saveTodoStateToDisk(todoState);
});

app.whenReady().then(() => {
  loadPetWindowBounds();
  createTray();
  createMainWindow();
  createPetWindow();

  app.on('activate', () => {
    if (!mainWindow) {
      createMainWindow();
    }
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
