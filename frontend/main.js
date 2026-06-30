const { app, BrowserWindow, ipcMain, Menu, nativeImage, screen, Tray, shell } = require('electron');
const fs = require('fs');
const path = require('path');
const { notifyTodoStateUpdated } = require('./todo_state_sync');
const { centerBoundsInWorkArea } = require('./pet_window_position');

let mainWindow = null;
let petWindow = null;
let countdownWidgetWindow = null;
let todoWidgetWindow = null;
let aboutWindow = null;
let tray = null;
let isQuitting = false;
let currentAccountId = 'future';
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
const COUNTDOWN_WIDGET_SIZE = { width: 300, height: 260 };
const COUNTDOWN_WIDGET_MARGIN = 18;
const TODO_WIDGET_SIZE = { width: 280, height: 320 };
const TODO_WIDGET_MIN_SIZE = { width: 260, height: 260 };
const TODO_WIDGET_MAX_SIZE = { width: 520, height: 720 };
const TODO_WIDGET_MARGIN = 18;
const ABOUT_WINDOW_SIZE = { width: 980, height: 680, minWidth: 760, minHeight: 560 };
const REPOSITORY_URL = 'https://github.com/future867/petodo-pet-app';
const RELEASES_URL = `${REPOSITORY_URL}/releases`;
const LATEST_RELEASE_API_URL = 'https://api.github.com/repos/future867/petodo-pet-app/releases/latest';
const MAIN_WINDOW_AUTH_LAYOUTS = {
  login: {
    width: 430,
    height: 520,
    minWidth: 400,
    minHeight: 480
  },
  app: {
    width: 1200,
    height: 760,
    minWidth: 960,
    minHeight: 640
  }
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

function normalizeAccountId(accountId) {
  return typeof accountId === 'string' ? accountId.trim() : '';
}

function getCurrentProfileId() {
  return currentAccountId || 'future';
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
  const accountId = normalizeAccountId(todoState.accountId);
  const todoList = normalizeTodoList(todoState.todoList);
  const currentTaskId = typeof todoState.currentTaskId === 'string'
    && todoList.some((task) => task.id === todoState.currentTaskId && !task.completed)
    ? todoState.currentTaskId
    : '';
  const todoListDate = isValidDateKey(todoState.todoListDate) ? todoState.todoListDate : '';

  return {
    accountId,
    todoList,
    currentTaskId,
    todoListDate
  };
}

function loadTodoStateFromDisk() {
  try {
    const raw = fs.readFileSync(getTodoStoragePath(), 'utf8');
    const savedState = normalizeTodoState(JSON.parse(raw));
    const profileId = getCurrentProfileId();
    if (savedState.accountId && savedState.accountId !== profileId) {
      return normalizeTodoState({ accountId: profileId });
    }
    return {
      ...savedState,
      accountId: savedState.accountId || profileId
    };
  } catch {
    return normalizeTodoState({ accountId: getCurrentProfileId() });
  }
}

function saveTodoStateToDisk(todoState = {}) {
  const normalizedState = normalizeTodoState({
    ...todoState,
    accountId: getCurrentProfileId()
  });
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
    const saved = JSON.parse(raw);
    if (saved && !Array.isArray(saved) && saved.accountId && saved.accountId !== getCurrentProfileId()) {
      return [];
    }
    return normalizeCountdownGoals(Array.isArray(saved) ? saved : saved?.goals);
  } catch {
    return [];
  }
}

function saveCountdownGoalsToDisk(goals = []) {
  const normalizedGoals = normalizeCountdownGoals(goals);
  fs.writeFileSync(
    getCountdownStoragePath(),
    JSON.stringify({ accountId: getCurrentProfileId(), goals: normalizedGoals }, null, 2),
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

function getMainWindowDisplayWorkArea() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    return screen.getDisplayMatching(mainWindow.getBounds()).workArea;
  }

  return screen.getPrimaryDisplay().workArea;
}

function centerPetWindowOnMainDisplay() {
  if (!petWindow || petWindow.isDestroyed()) {
    return null;
  }

  const centeredBounds = centerBoundsInWorkArea(petWindow.getBounds(), getMainWindowDisplayWorkArea());
  petWindow.setBounds(centeredBounds, false);
  savePetWindowBounds();
  return petWindow.getBounds();
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

function normalizeVersion(version) {
  return String(version || '')
    .trim()
    .replace(/^v/i, '')
    .split('-')[0];
}

function compareVersions(currentVersion, latestVersion) {
  const currentParts = normalizeVersion(currentVersion).split('.').map((part) => Number(part));
  const latestParts = normalizeVersion(latestVersion).split('.').map((part) => Number(part));

  if (
    currentParts.some((part) => !Number.isFinite(part)) ||
    latestParts.some((part) => !Number.isFinite(part))
  ) {
    return null;
  }

  const length = Math.max(currentParts.length, latestParts.length);
  for (let index = 0; index < length; index += 1) {
    const current = currentParts[index] || 0;
    const latest = latestParts[index] || 0;
    if (latest > current) {
      return 1;
    }
    if (latest < current) {
      return -1;
    }
  }

  return 0;
}

function getAboutInfo() {
  return {
    appName: 'Petodo',
    version: app.getVersion() || '0.1.0',
    repositoryUrl: REPOSITORY_URL,
    releasesUrl: RELEASES_URL,
    license: '暂未声明',
    author: 'future867',
    maintainer: 'future867'
  };
}

function isAllowedExternalUrl(url) {
  try {
    const parsedUrl = new URL(url);
    return parsedUrl.protocol === 'https:' &&
      parsedUrl.hostname === 'github.com' &&
      (
        parsedUrl.pathname === '/future867/petodo-pet-app' ||
        parsedUrl.pathname.startsWith('/future867/petodo-pet-app/')
      );
  } catch {
    return false;
  }
}

async function openAllowedExternalUrl(url) {
  if (!isAllowedExternalUrl(url)) {
    return false;
  }

  await shell.openExternal(url);
  return true;
}

async function checkForUpdate() {
  const currentVersion = app.getVersion() || '0.1.0';
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(LATEST_RELEASE_API_URL, {
      signal: controller.signal,
      headers: {
        Accept: 'application/vnd.github+json',
        'User-Agent': 'Petodo'
      }
    });

    if (!response.ok) {
      throw new Error(`GitHub release request failed: ${response.status}`);
    }

    const release = await response.json();
    const latestVersion = normalizeVersion(release.tag_name || release.name);
    const comparison = compareVersions(currentVersion, latestVersion);

    return {
      ok: true,
      currentVersion,
      latestVersion,
      hasUpdate: comparison === 1,
      canCompare: comparison !== null,
      releaseUrl: release.html_url || RELEASES_URL
    };
  } catch (error) {
    return {
      ok: false,
      currentVersion,
      message: error.name === 'AbortError'
        ? '检查更新超时，请稍后重试'
        : '检查更新失败，请稍后重试'
    };
  } finally {
    clearTimeout(timeoutId);
  }
}

function createAboutWindow() {
  if (aboutWindow && !aboutWindow.isDestroyed()) {
    aboutWindow.show();
    aboutWindow.focus();
    return aboutWindow;
  }

  aboutWindow = new BrowserWindow({
    width: ABOUT_WINDOW_SIZE.width,
    height: ABOUT_WINDOW_SIZE.height,
    minWidth: ABOUT_WINDOW_SIZE.minWidth,
    minHeight: ABOUT_WINDOW_SIZE.minHeight,
    show: false,
    title: 'Petodo About',
    backgroundColor: '#f7f7fb',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  aboutWindow.loadFile('about.html');
  aboutWindow.setMenuBarVisibility(false);
  aboutWindow.once('ready-to-show', () => {
    if (aboutWindow && !aboutWindow.isDestroyed()) {
      aboutWindow.show();
      aboutWindow.focus();
    }
  });

  aboutWindow.on('closed', () => {
    aboutWindow = null;
  });

  return aboutWindow;
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
      label: '关于 Petodo',
      click: () => createAboutWindow()
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

  const iconPath = path.join(__dirname, 'assets', 'pet', 'luoxiaohei', 'img', 'happy', 'luoxiaohei-happy-01.png');
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

function applyMainWindowAuthLayout(isLoggedIn) {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  const layout = isLoggedIn ? MAIN_WINDOW_AUTH_LAYOUTS.app : MAIN_WINDOW_AUTH_LAYOUTS.login;

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  }

  mainWindow.setMinimumSize(layout.minWidth, layout.minHeight);

  const currentBounds = mainWindow.getBounds();
  const { workArea } = screen.getDisplayMatching(currentBounds);
  const width = Math.min(layout.width, workArea.width);
  const height = Math.min(layout.height, workArea.height);
  const x = Math.round(workArea.x + (workArea.width - width) / 2);
  const y = Math.round(workArea.y + (workArea.height - height) / 2);

  mainWindow.setBounds({ x, y, width, height }, false);

  if (!mainWindow.isVisible()) {
    mainWindow.show();
  }

  return { width, height, minWidth: layout.minWidth, minHeight: layout.minHeight };
}

function createMainWindow() {
  const loginLayout = MAIN_WINDOW_AUTH_LAYOUTS.app;

  mainWindow = new BrowserWindow({
    width: loginLayout.width,
    height: loginLayout.height,
    minWidth: loginLayout.minWidth,
    minHeight: loginLayout.minHeight,
    show: false,
    frame: false,
    transparent: true,
    autoHideMenuBar: true,
    backgroundColor: '#00000000',
    title: 'Petodo 番茄钟桌宠',
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false
    }
  });

  mainWindow.loadFile('index.html');
  mainWindow.setMenuBarVisibility(false);

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
    showCountdownWidgetWithoutFocus();
    return countdownWidgetWindow;
  }

  const widgetBounds = getCountdownWidgetBounds();
  countdownWidgetWindow = new BrowserWindow({
    ...widgetBounds,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    show: false,
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
  countdownWidgetWindow.once('ready-to-show', () => {
    showCountdownWidgetWithoutFocus();
  });

  countdownWidgetWindow.on('closed', () => {
    countdownWidgetWindow = null;
    updateTrayMenu();
  });

  updateTrayMenu();
  return countdownWidgetWindow;
}

function getCountdownWidgetBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - COUNTDOWN_WIDGET_SIZE.width - COUNTDOWN_WIDGET_MARGIN,
    y: workArea.y + COUNTDOWN_WIDGET_MARGIN,
    width: COUNTDOWN_WIDGET_SIZE.width,
    height: COUNTDOWN_WIDGET_SIZE.height
  };
}

function showCountdownWidgetWithoutFocus() {
  if (!countdownWidgetWindow || countdownWidgetWindow.isDestroyed()) {
    return;
  }

  countdownWidgetWindow.setBounds(getCountdownWidgetBounds(), false);

  if (typeof countdownWidgetWindow.showInactive === 'function') {
    countdownWidgetWindow.showInactive();
    return;
  }

  countdownWidgetWindow.show();
}

function closeCountdownWidgetWindow() {
  if (countdownWidgetWindow && !countdownWidgetWindow.isDestroyed()) {
    countdownWidgetWindow.close();
  }
}

function getTodoWidgetBounds() {
  const { workArea } = screen.getPrimaryDisplay();
  return {
    x: workArea.x + workArea.width - TODO_WIDGET_SIZE.width - TODO_WIDGET_MARGIN,
    y: workArea.y + TODO_WIDGET_MARGIN,
    width: TODO_WIDGET_SIZE.width,
    height: TODO_WIDGET_SIZE.height
  };
}

function clampTodoWidgetSize(width, height) {
  return {
    width: Math.min(TODO_WIDGET_MAX_SIZE.width, Math.max(TODO_WIDGET_MIN_SIZE.width, Math.round(width))),
    height: Math.min(TODO_WIDGET_MAX_SIZE.height, Math.max(TODO_WIDGET_MIN_SIZE.height, Math.round(height)))
  };
}

function getTodoWidgetCurrentBounds() {
  if (!todoWidgetWindow || todoWidgetWindow.isDestroyed()) {
    return null;
  }

  return todoWidgetWindow.getBounds();
}

function resizeTodoWidgetWindow(size = {}) {
  if (!todoWidgetWindow || todoWidgetWindow.isDestroyed()) {
    return null;
  }

  const currentBounds = todoWidgetWindow.getBounds();
  const nextSize = clampTodoWidgetSize(
    Number.isFinite(size.width) ? size.width : currentBounds.width,
    Number.isFinite(size.height) ? size.height : currentBounds.height
  );
  const display = screen.getDisplayNearestPoint({
    x: currentBounds.x + currentBounds.width,
    y: currentBounds.y
  }).workArea;
  const nextRight = Math.min(
    display.x + display.width - TODO_WIDGET_MARGIN,
    Math.max(currentBounds.x + nextSize.width, currentBounds.x + currentBounds.width)
  );
  const nextX = Math.max(display.x + TODO_WIDGET_MARGIN, nextRight - nextSize.width);
  const nextY = Math.min(
    Math.max(display.y + TODO_WIDGET_MARGIN, currentBounds.y),
    display.y + display.height - nextSize.height - TODO_WIDGET_MARGIN
  );

  todoWidgetWindow.setBounds({
    x: nextX,
    y: nextY,
    width: nextSize.width,
    height: nextSize.height
  }, false);

  return todoWidgetWindow.getBounds();
}

function showTodoWidgetWithoutFocus() {
  if (!todoWidgetWindow || todoWidgetWindow.isDestroyed()) {
    return;
  }

  todoWidgetWindow.setBounds(getTodoWidgetBounds(), false);

  if (typeof todoWidgetWindow.showInactive === 'function') {
    todoWidgetWindow.showInactive();
    return;
  }

  todoWidgetWindow.show();
}

function createTodoWidgetWindow() {
  if (todoWidgetWindow && !todoWidgetWindow.isDestroyed()) {
    showTodoWidgetWithoutFocus();
    return todoWidgetWindow;
  }

  const widgetBounds = getTodoWidgetBounds();
  todoWidgetWindow = new BrowserWindow({
    ...widgetBounds,
    minWidth: TODO_WIDGET_MIN_SIZE.width,
    minHeight: TODO_WIDGET_MIN_SIZE.height,
    maxWidth: TODO_WIDGET_MAX_SIZE.width,
    maxHeight: TODO_WIDGET_MAX_SIZE.height,
    frame: false,
    transparent: true,
    resizable: false,
    skipTaskbar: true,
    hasShadow: false,
    focusable: true,
    show: false,
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
  todoWidgetWindow.once('ready-to-show', () => {
    showTodoWidgetWithoutFocus();
  });

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
  if (options.centerOnMainDisplay === true) {
    centerPetWindowOnMainDisplay();
  }
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

ipcMain.handle('main-window:set-auth-layout', (_event, isLoggedIn) => {
  return applyMainWindowAuthLayout(Boolean(isLoggedIn));
});

ipcMain.handle('account:set-current', (_event, accountId = '') => {
  const nextAccountId = normalizeAccountId(accountId) || 'future';
  const didChange = nextAccountId !== currentAccountId;
  currentAccountId = nextAccountId;
  if (didChange) {
    if (todoWidgetWindow && !todoWidgetWindow.isDestroyed()) {
      todoWidgetWindow.webContents.reloadIgnoringCache();
    }
    if (countdownWidgetWindow && !countdownWidgetWindow.isDestroyed()) {
      countdownWidgetWindow.webContents.reloadIgnoringCache();
    }
  }
  return currentAccountId;
});

ipcMain.handle('account:get-current', () => currentAccountId);

ipcMain.handle('main-window:minimize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  mainWindow.minimize();
  return true;
});

ipcMain.handle('main-window:toggle-maximize', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  if (mainWindow.isMaximized()) {
    mainWindow.unmaximize();
  } else {
    mainWindow.maximize();
  }

  return mainWindow.isMaximized();
});

ipcMain.handle('main-window:close', () => {
  if (!mainWindow || mainWindow.isDestroyed()) {
    return false;
  }

  mainWindow.close();
  return true;
});

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

ipcMain.handle('todo-widget:get-bounds', () => getTodoWidgetCurrentBounds());

ipcMain.handle('todo-widget:resize', (_event, size = {}) => resizeTodoWidgetWindow(size));

ipcMain.handle('countdown-storage:load', () => loadCountdownGoalsFromDisk());

ipcMain.handle('countdown-storage:save', (_event, goals = []) => {
  return saveCountdownGoalsToDisk(goals);
});

ipcMain.handle('todo-storage:load', () => loadTodoStateFromDisk());

ipcMain.handle('todo-storage:save', (event, todoState = {}) => {
  const savedState = saveTodoStateToDisk(todoState);
  notifyTodoStateUpdated(BrowserWindow.getAllWindows(), event.sender, savedState);
  return savedState;
});

ipcMain.handle('about:get-info', () => getAboutInfo());

ipcMain.handle('about:check-update', () => checkForUpdate());

ipcMain.handle('about:open-external', (_event, url) => openAllowedExternalUrl(url));

app.whenReady().then(() => {
  loadPetWindowBounds();
  createTray();
  createMainWindow();
  createPetWindow();

  app.on('activate', () => {
    showMainWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin' && isQuitting) {
    app.quit();
  }
});
