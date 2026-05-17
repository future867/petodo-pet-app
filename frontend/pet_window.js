const SLEEP_AFTER_MS = 60 * 1000;
const EATING_DURATION_MS = 2200;
const TAP_CLICK_WINDOW_MS = 700;
const TAP_REQUIRED_CLICKS = 2;
const DRAG_CLICK_THRESHOLD_PX = 4;
const FUN_ACTION_HOLD_MS = 4200;
const API_BASE_URL = 'http://127.0.0.1:8000';
const DEFAULT_THEME_NAME = 'luoxiaohei';
const PET_SCALE_ORDER = ['small', 'medium', 'large'];
const DEFAULT_MENU_STATE = {
  isOpen: false,
  backendOnline: false,
  points: 0,
  scale: 'medium',
  alwaysOnTop: true,
};
const PET_THEMES = {
  luoxiaohei: 'assets/pet/luoxiaohei',
  clawd: 'assets/pet/clawd'
};

const petRoot = document.querySelector('#pet-root');
const petSprite = document.querySelector('#pet-sprite');
const timerBubble = document.querySelector('#timer-bubble');
const timerText = document.querySelector('#timer-text');
const toolPanel = document.querySelector('#pet-tool-panel');
const panelStatus = document.querySelector('#panel-status');
const timerToggleButton = document.querySelector('#timer-toggle-button');
const pinToggleButton = document.querySelector('#pin-toggle-button');

let renderer = null;
let activeState = 'idle';
let stateBeforeTemporary = 'idle';
let activeThemeName = DEFAULT_THEME_NAME;
let lastTimerStatus = 'idle';
let isDraggingPet = false;
let sleepTimer = null;
let manualTransitionTimer = null;
let statusPollTimer = null;
let lastCompletedFocusKey = null;
let tapClickCount = 0;
let tapClickTimer = null;
let dragSession = null;
let suppressClickAfterDrag = false;
let suppressClickAfterPanelClose = false;
let menuState = { ...DEFAULT_MENU_STATE };
let manualVisualHoldUntil = 0;
let manualHoldReturnTimer = null;

function getRequestedThemeName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('theme') || DEFAULT_THEME_NAME;
}

function resolveTheme(themeName) {
  if (PET_THEMES[themeName]) {
    return {
      name: themeName,
      basePath: PET_THEMES[themeName]
    };
  }

  console.warn(`Unknown pet theme "${themeName}", falling back to "${DEFAULT_THEME_NAME}".`);
  return {
    name: DEFAULT_THEME_NAME,
    basePath: PET_THEMES[DEFAULT_THEME_NAME]
  };
}

function clearManualTransition() {
  if (manualTransitionTimer) {
    clearTimeout(manualTransitionTimer);
    manualTransitionTimer = null;
  }

  if (manualHoldReturnTimer) {
    clearTimeout(manualHoldReturnTimer);
    manualHoldReturnTimer = null;
  }
}

function resetTapClicks() {
  tapClickCount = 0;
  if (tapClickTimer) {
    clearTimeout(tapClickTimer);
    tapClickTimer = null;
  }
}

function hasPetWindowDragApi() {
  return Boolean(
    window.petodo?.getPetWindowBounds &&
    window.petodo?.movePetWindow &&
    window.petodo?.savePetWindowPosition
  );
}

function hasPetWindowControlApi() {
  return Boolean(
    window.petodo?.setPetWindowPanelMode &&
    window.petodo?.setPetWindowScale &&
    window.petodo?.setPetWindowAlwaysOnTop
  );
}

async function requestBackend(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    }
  });

  if (!response.ok) {
    throw new Error(`Request failed: ${response.status}`);
  }

  return response.json();
}

function setPanelMessage(message) {
  if (panelStatus) {
    panelStatus.textContent = message;
  }
}

function getScaleStep(direction) {
  const currentIndex = PET_SCALE_ORDER.indexOf(menuState.scale);
  const safeIndex = currentIndex >= 0 ? currentIndex : 1;
  const nextIndex = Math.min(
    PET_SCALE_ORDER.length - 1,
    Math.max(0, safeIndex + direction)
  );

  return PET_SCALE_ORDER[nextIndex];
}

function applyMenuState(status = {}) {
  const settings = status.settings || {};
  if (settings.scale) {
    menuState.scale = settings.scale;
  }
  if (typeof settings.alwaysOnTop === 'boolean') {
    menuState.alwaysOnTop = settings.alwaysOnTop;
  }
  petRoot.dataset.scale = menuState.scale;
  pinToggleButton?.classList.toggle('is-active', menuState.alwaysOnTop);
}

function updateMenuButtons() {
  if (timerToggleButton) {
    const label = timerToggleButton.querySelector('b');
    if (label) {
      label.textContent = lastTimerStatus === 'focus' ? '暂停' : '专注';
    }
  }

  const feedButton = toolPanel?.querySelector('[data-action="feed"]');
  const timerButtons = toolPanel?.querySelectorAll('[data-action="timer-toggle"], [data-action="timer-reset"]') || [];
  if (feedButton) {
    const shouldDisable = menuState.backendOnline && menuState.points < 20;
    feedButton.disabled = shouldDisable;
    feedButton.classList.toggle('is-disabled', shouldDisable);
    feedButton.title = shouldDisable ? '积分不足，暂时不能兑换小鱼干' : '';
  }

  timerButtons.forEach((button) => {
    button.disabled = menuState.isOpen && !menuState.backendOnline;
    button.classList.toggle('is-disabled', button.disabled);
  });
}

async function syncWindowSettings() {
  if (!window.petodo?.getPetWindowStatus) {
    return;
  }

  try {
    applyMenuState(await window.petodo.getPetWindowStatus());
  } catch (error) {
    console.warn('Failed to sync pet window settings:', error);
  }
}

function resolveTimerBaseState() {
  if (lastTimerStatus === 'focus') {
    return 'focus';
  }

  if (lastTimerStatus === 'break' || lastTimerStatus === 'rest') {
    return 'rest';
  }

  return 'idle';
}

async function setPetTheme(themeName = DEFAULT_THEME_NAME, options = {}) {
  const theme = resolveTheme(themeName);

  renderer?.clearTimers();
  renderer = new window.PetRenderer({
    imageElement: petSprite,
    timerBubbleElement: timerBubble,
    timerTextElement: timerText,
    themeBasePath: theme.basePath
  });

  try {
    await renderer.init();
  } catch (error) {
    console.error(error);
    if (theme.name !== DEFAULT_THEME_NAME) {
      return setPetTheme(DEFAULT_THEME_NAME, { persist: false });
    }
  }

  activeThemeName = theme.name;
  activeState = renderer.currentState || 'idle';
  window.petRenderer = renderer;

  if (options.persist !== false) {
    localStorage.setItem('petodo:pet-theme', theme.name);
  }

  return renderer;
}

function rememberActivity() {
  clearTimeout(sleepTimer);
  sleepTimer = window.setTimeout(() => {
    setPetState('sleep');
  }, SLEEP_AFTER_MS);
}

async function setPetState(stateName, options = {}) {
  if (!renderer) {
    console.warn('Pet renderer is not ready yet.');
    return;
  }

  if (!options.keepManualTransition) {
    clearManualTransition();
  }

  if (activeState === stateName && options.force !== true) {
    rememberActivity();
    return;
  }

  activeState = stateName;
  await renderer.setPetState(stateName, options);
  rememberActivity();
}

function updateTimerText(text) {
  renderer?.updateTimerText(text);
}

async function setToolPanelOpen(isOpen) {
  if (!toolPanel || menuState.isOpen === isOpen) {
    return;
  }

  menuState.isOpen = isOpen;
  petRoot.classList.toggle('panel-open', isOpen);
  toolPanel.hidden = !isOpen;

  if (hasPetWindowControlApi()) {
    try {
      const status = await window.petodo.setPetWindowPanelMode(isOpen);
      applyMenuState(status);
    } catch (error) {
      console.warn('Failed to resize pet window for panel:', error);
    }
  }

  if (isOpen) {
    await fetchPetState({ silent: true });
    updateMenuButtons();
  }
}

async function toggleToolPanel() {
  await setToolPanelOpen(!menuState.isOpen);
}

async function playStateThen(stateName, nextState) {
  if (!renderer) {
    return;
  }

  clearManualTransition();
  renderer.onStateComplete = async (completedState) => {
    if (completedState !== stateName) {
      return;
    }

    renderer.onStateComplete = null;
    const resolvedNextState = typeof nextState === 'function' ? nextState() : nextState;
    await setPetState(resolvedNextState || 'idle', { rememberPrevious: false });
  };

  await setPetState(stateName, { keepManualTransition: true });
}

async function playTemporaryState(stateName, holdMs = FUN_ACTION_HOLD_MS) {
  stateBeforeTemporary = activeState;
  manualVisualHoldUntil = Date.now() + holdMs;
  await setPetState(stateName, { keepManualTransition: true });

  if (manualHoldReturnTimer) {
    clearTimeout(manualHoldReturnTimer);
  }

  manualHoldReturnTimer = window.setTimeout(async () => {
    manualHoldReturnTimer = null;
    manualVisualHoldUntil = 0;
    await setPetState(stateBeforeTemporary || resolveTimerBaseState(), {
      rememberPrevious: false,
      force: true
    });
  }, holdMs);
}

async function holdPetState(stateName, durationMs = 5000) {
  manualVisualHoldUntil = Date.now() + durationMs;
  await setPetState(stateName);
}

async function feedPet() {
  clearManualTransition();
  await setPetState('eating', { keepManualTransition: true });

  manualTransitionTimer = window.setTimeout(() => {
    playStateThen('finished_eating', () => resolveTimerBaseState());
  }, EATING_DURATION_MS);
}

async function redeemFishAndFeed() {
  if (!menuState.backendOnline) {
    setPanelMessage('后端未启动');
    await feedPet();
    return;
  }

  try {
    const result = await requestBackend('/shop/redeem', {
      method: 'POST',
      body: JSON.stringify({ food_id: 'fish' })
    });

    if (Number.isFinite(result.remaining_points)) {
      menuState.points = result.remaining_points;
    }

    if (!result.success) {
      setPanelMessage(result.message || '积分不足');
      updateMenuButtons();
      return;
    }

    if (result.feed_result?.status) {
      await updatePetFromBackend({ pet: result.feed_result.status });
    } else {
      await feedPet();
    }

    setPanelMessage(result.message || '吃到小鱼干');
    updateMenuButtons();
    window.setTimeout(() => fetchPetState({ silent: true }), 2600);
  } catch (error) {
    menuState.backendOnline = false;
    setPanelMessage('后端未启动');
    updateMenuButtons();
    await feedPet();
  }
}

async function toggleTimerFromPanel() {
  if (!menuState.backendOnline) {
    setPanelMessage('后端未启动');
    updateMenuButtons();
    return;
  }

  try {
    const endpoint = lastTimerStatus === 'focus' ? '/timer/pause' : '/timer/start';
    const timerStatus = await requestBackend(endpoint, { method: 'POST' });
    await updatePetFromBackend({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    setPanelMessage(lastTimerStatus === 'focus' ? '专注中' : '已暂停');
    updateMenuButtons();
  } catch (error) {
    menuState.backendOnline = false;
    setPanelMessage('后端未启动');
    updateMenuButtons();
  }
}

async function resetTimerFromPanel() {
  if (!menuState.backendOnline) {
    setPanelMessage('后端未启动');
    updateMenuButtons();
    return;
  }

  try {
    const timerStatus = await requestBackend('/timer/reset', { method: 'POST' });
    await updatePetFromBackend({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    setPanelMessage('已重置');
    updateMenuButtons();
  } catch (error) {
    menuState.backendOnline = false;
    setPanelMessage('后端未启动');
    updateMenuButtons();
  }
}

async function setScaleFromPanel(scale) {
  menuState.scale = scale;
  petRoot.dataset.scale = scale;

  if (!window.petodo?.setPetWindowScale) {
    return;
  }

  try {
    applyMenuState(await window.petodo.setPetWindowScale(scale));
    if (menuState.isOpen && window.petodo?.setPetWindowPanelMode) {
      applyMenuState(await window.petodo.setPetWindowPanelMode(true));
    }
    setPanelMessage(scale === 'large' ? '放大了' : scale === 'small' ? '缩小了' : '中等大小');
  } catch (error) {
    console.warn('Failed to set pet scale:', error);
  }
}

async function togglePinFromPanel() {
  menuState.alwaysOnTop = !menuState.alwaysOnTop;
  pinToggleButton?.classList.toggle('is-active', menuState.alwaysOnTop);

  if (!window.petodo?.setPetWindowAlwaysOnTop) {
    return;
  }

  try {
    applyMenuState(await window.petodo.setPetWindowAlwaysOnTop(menuState.alwaysOnTop));
    setPanelMessage(menuState.alwaysOnTop ? '保持在前面' : '取消置顶');
  } catch (error) {
    console.warn('Failed to toggle pet window pin:', error);
  }
}

async function handleToolAction(action) {
  const actionHandlers = {
    sleep: () => holdPetState('sleep', 8000),
    feed: redeemFishAndFeed,
    roll: () => playTemporaryState('roll'),
    guitar: () => playTemporaryState('guitar'),
    scratch: () => playTemporaryState('scratch'),
    tap: () => playTemporaryState('tap'),
    'timer-toggle': toggleTimerFromPanel,
    'timer-reset': resetTimerFromPanel,
    pin: togglePinFromPanel,
    'scale-down': () => setScaleFromPanel(getScaleStep(-1)),
    'scale-up': () => setScaleFromPanel(getScaleStep(1)),
    hide: async () => {
      await setToolPanelOpen(false);
      await window.petodo?.closePetWindow?.();
    },
    'open-main': () => window.petodo?.showMainWindow?.(),
    quit: () => window.petodo?.quitApp?.()
  };

  await actionHandlers[action]?.();
}

function schedulePetWindowMove(x, y) {
  if (!dragSession || !hasPetWindowDragApi()) {
    return;
  }

  dragSession.nextX = x;
  dragSession.nextY = y;

  if (dragSession.moveFrame) {
    return;
  }

  dragSession.moveFrame = window.requestAnimationFrame(async () => {
    const session = dragSession;
    if (!session) {
      return;
    }

    session.moveFrame = null;
    await window.petodo.movePetWindow({
      x: session.nextX,
      y: session.nextY
    });
  });
}

async function beginPetDrag(event) {
  if (event.button !== undefined && event.button !== 0) {
    return;
  }

  if (menuState.isOpen) {
    suppressClickAfterPanelClose = true;
    await setToolPanelOpen(false);
  }
  resetTapClicks();
  isDraggingPet = true;
  suppressClickAfterDrag = false;
  stateBeforeTemporary = activeState;

  try {
    petSprite.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort because the OS may already control the drag.
  }

  if (hasPetWindowDragApi()) {
    const bounds = await window.petodo.getPetWindowBounds();
    dragSession = bounds ? {
      pointerId: event.pointerId,
      startScreenX: event.screenX,
      startScreenY: event.screenY,
      startX: bounds.x,
      startY: bounds.y,
      nextX: bounds.x,
      nextY: bounds.y,
      moved: false,
      moveFrame: null
    } : null;
  }

  await setPetState('drag');
}

function movePetDrag(event) {
  if (!isDraggingPet || !dragSession || event.pointerId !== dragSession.pointerId) {
    return;
  }

  const deltaX = event.screenX - dragSession.startScreenX;
  const deltaY = event.screenY - dragSession.startScreenY;
  const distance = Math.hypot(deltaX, deltaY);

  if (distance > DRAG_CLICK_THRESHOLD_PX) {
    dragSession.moved = true;
    suppressClickAfterDrag = true;
  }

  schedulePetWindowMove(dragSession.startX + deltaX, dragSession.startY + deltaY);
}

async function endPetDrag(event) {
  if (!isDraggingPet || (dragSession && event.pointerId !== dragSession.pointerId)) {
    return;
  }

  const session = dragSession;
  const didMove = Boolean(session?.moved);
  isDraggingPet = false;
  dragSession = null;

  try {
    petSprite.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released when the pointer leaves the window.
  }

  if (session?.moveFrame) {
    window.cancelAnimationFrame(session.moveFrame);
    if (hasPetWindowDragApi()) {
      await window.petodo.movePetWindow({
        x: session.nextX,
        y: session.nextY
      });
    }
  }

  if (hasPetWindowDragApi()) {
    await window.petodo.savePetWindowPosition();
  }

  await setPetState(stateBeforeTemporary || resolveTimerBaseState(), {
    rememberPrevious: false,
    force: true
  });

  if (didMove) {
    window.setTimeout(() => {
      suppressClickAfterDrag = false;
    }, 120);
  }
}

function bindPetInteractions() {
  petSprite.addEventListener('pointerdown', beginPetDrag);
  window.addEventListener('pointermove', movePetDrag);
  window.addEventListener('pointercancel', endPetDrag);
  window.addEventListener('pointerup', endPetDrag);

  petSprite.addEventListener('click', async () => {
    if (suppressClickAfterPanelClose) {
      suppressClickAfterPanelClose = false;
      resetTapClicks();
      return;
    }

    if (suppressClickAfterDrag) {
      suppressClickAfterDrag = false;
      resetTapClicks();
      return;
    }

    tapClickCount += 1;
    if (tapClickTimer) {
      clearTimeout(tapClickTimer);
    }

    tapClickTimer = window.setTimeout(resetTapClicks, TAP_CLICK_WINDOW_MS);

    if (tapClickCount < TAP_REQUIRED_CLICKS) {
      return;
    }

    resetTapClicks();
    await setToolPanelOpen(false);
    await playTemporaryState('tap');
  });

  petSprite.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetTapClicks();
    suppressClickAfterPanelClose = false;
    suppressClickAfterDrag = false;
    await toggleToolPanel();
  });

  document.addEventListener('pointerdown', (event) => {
    if (!menuState.isOpen || toolPanel.contains(event.target) || event.target === petSprite) {
      return;
    }

    setToolPanelOpen(false);
  });

  toolPanel.querySelectorAll('[data-action]').forEach((button) => {
    button.addEventListener('click', async () => {
      if (button.disabled) {
        return;
      }

      await handleToolAction(button.dataset.action);
    });
  });
}

function bindKeyboardShortcuts() {
  const stateByKey = {
    1: 'idle',
    2: 'focus',
    3: 'rest',
    4: 'happy',
    5: 'sleep',
    6: 'hungry',
    7: 'hungry_heavy',
    8: 'angry',
    9: 'eating',
    0: 'finished_eating'
  };

  window.addEventListener('keydown', (event) => {
    const state = stateByKey[event.key];
    if (!state) {
      return;
    }

    if (state === 'happy') {
      playStateThen('happy', 'rest');
      return;
    }

    if (state === 'eating') {
      feedPet();
      return;
    }

    if (state === 'finished_eating') {
      playStateThen('finished_eating', () => resolveTimerBaseState());
      return;
    }

    setPetState(state);
  });
}

function stateFromHungerLevel(hungerLevel) {
  if (typeof hungerLevel !== 'number') {
    return 'idle';
  }

  if (hungerLevel < 10) {
    return 'angry';
  }

  if (hungerLevel < 30) {
    return 'hungry_heavy';
  }

  if (hungerLevel < 60) {
    return 'hungry';
  }

  return 'idle';
}

async function updatePetFromBackend(data = {}) {
  const timer = data.timer || {};
  const pet = data.pet || {};
  const remainingSeconds = data.remaining_seconds ?? data.remainingSeconds ?? timer.remaining_seconds;
  const timerStatus = timer.mode || data.timerStatus;
  const petStatus = pet.state || data.petStatus;
  const hungerLevel = data.hunger ?? pet.hunger ?? data.hungerLevel;
  const completedFocusKey = timer.last_completed_focus_id && timer.last_completed_focus_completed_at
    ? `${timer.last_completed_focus_id}:${timer.last_completed_focus_completed_at}`
    : '';

  if (remainingSeconds !== undefined && remainingSeconds !== null) {
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    updateTimerText(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  }

  if (timerStatus) {
    lastTimerStatus = timerStatus;
  }

  if (Number.isFinite(data.points)) {
    menuState.points = data.points;
  } else if (Number.isFinite(data.points_status?.current_points)) {
    menuState.points = data.points_status.current_points;
  }
  updateMenuButtons();

  if (isDraggingPet) {
    return;
  }

  if (manualVisualHoldUntil > Date.now()) {
    return;
  }

  if (petStatus === 'happy' && completedFocusKey && completedFocusKey !== lastCompletedFocusKey) {
    lastCompletedFocusKey = completedFocusKey;
    lastTimerStatus = 'break';
    await playStateThen('happy', 'rest');
    return;
  }

  if (petStatus === 'happy') {
    await setPetState('happy');
    return;
  }

  if (petStatus === 'eating') {
    await setPetState('eating');
    return;
  }

  if (petStatus === 'finished_eating') {
    await playStateThen('finished_eating', () => resolveTimerBaseState());
    return;
  }

  if (timerStatus === 'focus' || petStatus === 'focus') {
    await setPetState('focus');
    return;
  }

  if (timerStatus === 'break' || timerStatus === 'rest' || petStatus === 'rest') {
    await setPetState('rest');
    return;
  }

  if (['idle', 'sleep', 'hungry', 'hungry_heavy', 'angry', 'drag', 'tap', 'roll', 'guitar', 'scratch'].includes(petStatus)) {
    await setPetState(petStatus);
    return;
  }

  await setPetState(stateFromHungerLevel(hungerLevel));
}

async function fetchPetState(options = {}) {
  try {
    const data = await requestBackend('/app/status');
    menuState.backendOnline = true;
    if (!options.silent) {
      setPanelMessage('准备好了');
    }
    await updatePetFromBackend(data);
  } catch (error) {
    menuState.backendOnline = false;
    if (!options.silent) {
      setPanelMessage('后端未启动');
    }
    updateMenuButtons();
    console.warn('Failed to sync pet state from backend:', error);
  }
}

function startBackendStatusPolling() {
  if (statusPollTimer) {
    clearInterval(statusPollTimer);
  }

  fetchPetState();
  statusPollTimer = window.setInterval(fetchPetState, 1000);
}

window.setPetState = setPetState;
window.setPetTheme = setPetTheme;
window.getPetTheme = () => activeThemeName;
window.updateTimerText = updateTimerText;
window.updatePetFromBackend = updatePetFromBackend;
window.feedPet = feedPet;
window.fetchPetState = fetchPetState;
window.toggleToolPanel = toggleToolPanel;

window.addEventListener('DOMContentLoaded', async () => {
  petSprite.addEventListener('error', () => renderer?.handleImageError());
  await setPetTheme(getRequestedThemeName(), { persist: false });
  await syncWindowSettings();
  updateMenuButtons();
  bindPetInteractions();
  bindKeyboardShortcuts();
  rememberActivity();
  startBackendStatusPolling();
});
