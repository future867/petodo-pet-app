const EATING_DURATION_MS = 2200;
const TAP_CLICK_WINDOW_MS = 700;
const TAP_REQUIRED_CLICKS = 2;
const DRAG_CLICK_THRESHOLD_PX = 4;
const FUN_ACTION_HOLD_MS = 4200;
const GREET_ACTION_HOLD_MS = 1350;
const RUN_ACTION_HOLD_MS = 2880;
const SURF_ACTION_HOLD_MS = 4020;
const STRETCH_ACTION_HOLD_MS = 4800;
const TASK_COMPLETION_EASTER_EGG_MS = 3000;
const LONG_IDLE_AFTER_MS = 2 * 60 * 1000;
const STATE_SOFT_SWITCH_MS = 180;
const BAG_ACTION_RETURN_DELAY_MS = 500;
const REST_INVITE_INTERVAL_MS = 60 * 1000;
const REST_INVITE_HOLD_MS = 10 * 1000;
const REST_END_WARNING_SECONDS = 60;
const FISHING_DURATION_MS = 4000;
const FISHING_HAPPY_HOLD_MS = 1800;
const FISHING_REWARD_POPUP_MS = 1700;
const PET_CLICK_MESSAGE_HOLD_MS = 2200;
const HUNGER_MESSAGE_HOLD_MS = 2600;
const CONNECTION_MESSAGE_HOLD_MS = 3600;
const API_BASE_URL = 'http://127.0.0.1:8000';
const CURRENT_TASK_STORAGE_KEY = 'currentTask';
const DEFAULT_THEME_NAME = 'luoxiaohei';
const DEFAULT_IDLE_STATE = 'idle_1';
const LONG_IDLE_STATE = 'idle_2';
const PET_SCALE_MIN = 70;
const PET_SCALE_MAX = 140;
const PET_SCALE_STEP = 10;
const LEGACY_PET_SCALE_PERCENT = {
  small: (140 / 180) * 100,
  medium: 100,
  large: (220 / 180) * 100
};
const DEFAULT_MENU_STATE = {
  isOpen: false,
  backendStatus: 'checking',
  points: 0,
  scalePercent: 100,
  alwaysOnTop: true,
};
const PET_THEMES = {
  luoxiaohei: 'assets/pet/luoxiaohei'
};
const REST_INVITATIONS = [
  { message: '小黑想打个滚。', state: 'roll', holdMs: FUN_ACTION_HOLD_MS },
  { message: '小黑想伸个懒腰。', state: 'stretch', holdMs: STRETCH_ACTION_HOLD_MS },
  { message: '小黑想和你打个招呼。', state: 'greet', holdMs: GREET_ACTION_HOLD_MS + BAG_ACTION_RETURN_DELAY_MS },
  { message: '小黑想跑一跑。', state: 'run', holdMs: RUN_ACTION_HOLD_MS + BAG_ACTION_RETURN_DELAY_MS },
  { message: '小黑想去冲浪。', state: 'surf', holdMs: SURF_ACTION_HOLD_MS },
  { message: '小黑想锻炼一下。', state: 'exercise', holdMs: FUN_ACTION_HOLD_MS },
  { message: '小黑想让你拍一拍。', state: 'tap', holdMs: FUN_ACTION_HOLD_MS },
  { message: '小黑想弹吉他。', state: 'guitar', holdMs: FUN_ACTION_HOLD_MS },
  { message: '小黑想磨磨爪子。', state: 'scratch', holdMs: FUN_ACTION_HOLD_MS }
];
const REST_END_WARNING_MESSAGE = '马上继续学习啦，喵。';
const FOCUS_CLICK_MESSAGE = '现在是专注时间，小黑陪你学习。';
const IDLE_CLICK_MESSAGE = '先完成一次专注，休息时再陪小黑玩。';
const BACKEND_OFFLINE_MESSAGE = '服务未连接，专注和投喂暂不可用';
const BACKEND_RESTORED_MESSAGE = '已连接，可以继续专注啦';
const petRoot = document.querySelector('#pet-root');
const petSprite = document.querySelector('#pet-sprite');
const petResizeHandle = document.querySelector('#pet-resize-handle');
const taskCompleteEasterEgg = document.querySelector('#task-complete-easter-egg');
const taskCompleteAnimation = document.querySelector('#task-complete-animation');
const timerBubble = document.querySelector('#timer-bubble');
const timerText = document.querySelector('#timer-text');
const fishingInviteBubble = document.querySelector('#fishing-invite-bubble');
const fishingStartButton = document.querySelector('#fishing-start-button');
const fishingDeclineButton = document.querySelector('#fishing-decline-button');
const fishingRewardPopup = document.querySelector('#fishing-reward-popup');
const fishingRewardText = document.querySelector('#fishing-reward-text');
const toolPanel = document.querySelector('#pet-tool-panel');
const panelStatus = document.querySelector('#panel-status');
const timerToggleButton = document.querySelector('#timer-toggle-button');
const pinToggleButton = document.querySelector('#pin-toggle-button');
const baitCount = document.querySelector('#bait-count');
const driedFishCount = document.querySelector('#dried-fish-count');
const fishCount = document.querySelector('#fish-count');
const rareFishCount = document.querySelector('#rare-fish-count');

let renderer = null;
let activeState = DEFAULT_IDLE_STATE;
let stateBeforeTemporary = DEFAULT_IDLE_STATE;
let activeThemeName = DEFAULT_THEME_NAME;
let lastTimerStatus = 'idle';
let isDraggingPet = false;
let isResizingPet = false;
let longIdleTimer = null;
let manualTransitionTimer = null;
let statusPollTimer = null;
let lastCompletedFocusKey = null;
let tapClickCount = 0;
let tapClickTimer = null;
let dragSession = null;
let resizeSession = null;
let suppressClickAfterDrag = false;
let suppressClickAfterPanelClose = false;
let menuState = { ...DEFAULT_MENU_STATE };
let manualVisualHoldUntil = 0;
let manualHoldReturnTimer = null;
let longIdleStartedAt = 0;
let forcedBubbleUntil = 0;
let forcedBubbleMessage = '';
let forcedBubbleToken = 0;
let lastTimerText = '25:00';
let lastRemainingSeconds = null;
let lastRestInviteAt = 0;
let lastRestInviteMessage = '';
let lastRestInviteState = '';
let lastRestEndingWarningKey = '';
let restInviteBubbleTimer = null;
let activeRestInvitation = null;
let taskCompletionEasterEggTimer = null;
let lastHungerNoticeKey = '';
let fishingStatus = null;
let fishingInviteVisible = false;
let fishingSessionId = '';
let fishingSettleTimer = null;
let fishingRewardTimer = null;
let fishingBusy = false;

function wait(ms) {
  return new Promise((resolve) => {
    window.setTimeout(resolve, ms);
  });
}

function normalizePetStateName(stateName) {
  return stateName === 'idle' ? DEFAULT_IDLE_STATE : stateName;
}

function isIdleState(stateName = activeState) {
  return stateName === DEFAULT_IDLE_STATE || stateName === LONG_IDLE_STATE;
}

function resolveIdleReturnState(stateName = activeState) {
  return isIdleState(stateName) ? DEFAULT_IDLE_STATE : stateName;
}

function isTimerIdleMode() {
  return !['focus', 'break', 'rest'].includes(lastTimerStatus);
}

function isRestTimerMode() {
  return lastTimerStatus === 'break' || lastTimerStatus === 'rest';
}

function isFocusTimerMode() {
  return lastTimerStatus === 'focus';
}

function pickRandomItem(items, previousValue = '') {
  if (!items.length) {
    return null;
  }

  if (items.length === 1) {
    return items[0];
  }

  let nextItem = items[Math.floor(Math.random() * items.length)];
  let guard = 0;
  while ((nextItem === previousValue || nextItem.state === previousValue) && guard < 8) {
    nextItem = items[Math.floor(Math.random() * items.length)];
    guard += 1;
  }

  return nextItem;
}

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

function clearLongIdleTimer() {
  if (longIdleTimer) {
    clearTimeout(longIdleTimer);
    longIdleTimer = null;
  }
}

function resetLongIdleClock() {
  clearLongIdleTimer();
  longIdleStartedAt = 0;
}

function resetTapClicks() {
  tapClickCount = 0;
  if (tapClickTimer) {
    clearTimeout(tapClickTimer);
    tapClickTimer = null;
  }
}

async function queueSingleClickGreeting() {
  if (tapClickTimer) {
    clearTimeout(tapClickTimer);
  }

  tapClickTimer = window.setTimeout(async () => {
    tapClickTimer = null;
    const shouldGreet = tapClickCount > 0;
    resetTapClicks();
    if (!shouldGreet || isDraggingPet) {
      return;
    }

    await setToolPanelOpen(false);
    await playTemporaryState('greet', GREET_ACTION_HOLD_MS);
  }, TAP_CLICK_WINDOW_MS);
}

function showPetBubble(message, holdMs = 0) {
  if (!message || !renderer?.showBubble) {
    return;
  }

  renderer.showBubble(message);
  if (holdMs > 0) {
    const bubbleToken = ++forcedBubbleToken;
    forcedBubbleMessage = message;
    forcedBubbleUntil = Date.now() + holdMs;
    window.setTimeout(() => {
      if (bubbleToken !== forcedBubbleToken || Date.now() < forcedBubbleUntil) {
        return;
      }

      forcedBubbleUntil = 0;
      forcedBubbleMessage = '';
      if (isRestTimerMode()) {
        updateRestInviteBubble({ force: true });
      } else if (lastTimerStatus === 'focus') {
        renderer?.updateTimerText(lastTimerText);
      } else {
        renderer?.hideBubble?.();
      }
    }, holdMs + 30);
  }
}

function clearPetBubbleHold() {
  forcedBubbleToken += 1;
  forcedBubbleUntil = 0;
  forcedBubbleMessage = '';
}

function getHungerNotice(petStatus, reason = '') {
  if (petStatus === 'hungry') {
    return { key: 'hungry', message: '我有点饿了' };
  }

  if (petStatus === 'hungry_heavy') {
    return { key: 'hungry_heavy', message: '我好饿...' };
  }

  if (petStatus === 'angry') {
    const waitedTooLong = reason.includes('持续太久');
    return {
      key: waitedTooLong ? 'angry-time' : 'angry-low',
      message: waitedTooLong ? '太久没吃东西啦！' : '太饿了！'
    };
  }

  return null;
}

function clearRestInviteBubbleTimer() {
  if (restInviteBubbleTimer) {
    window.clearTimeout(restInviteBubbleTimer);
    restInviteBubbleTimer = null;
  }
}

function clearFishingSettleTimer() {
  if (fishingSettleTimer) {
    window.clearTimeout(fishingSettleTimer);
    fishingSettleTimer = null;
  }
}

function updateFishingInventory(nextStatus = fishingStatus) {
  const status = nextStatus || {};
  const inventory = status.fishInventory || {};
  if (baitCount) {
    baitCount.textContent = String(status.bait ?? 0);
  }
  if (driedFishCount) {
    driedFishCount.textContent = String(inventory.driedFish ?? 0);
  }
  if (fishCount) {
    fishCount.textContent = String(inventory.fish ?? 0);
  }
  if (rareFishCount) {
    rareFishCount.textContent = String(status.rareFishCount ?? 0);
  }
}

function hideFishingInvite() {
  fishingInviteVisible = false;
  if (fishingInviteBubble) {
    fishingInviteBubble.hidden = true;
  }
}

function showFishingInvite() {
  if (!fishingInviteBubble || fishingBusy || !isRestTimerMode() || lastRestEndingWarningKey !== '') {
    return;
  }

  clearRestInviteBubbleTimer();
  activeRestInvitation = null;
  renderer?.hideBubble?.();
  fishingInviteVisible = true;
  fishingInviteBubble.hidden = false;
  lastRestInviteAt = Date.now();
}

function showFishingReward(label) {
  if (!fishingRewardPopup || !fishingRewardText || !label) {
    return;
  }

  if (fishingRewardTimer) {
    window.clearTimeout(fishingRewardTimer);
    fishingRewardTimer = null;
  }

  fishingRewardText.textContent = label;
  fishingRewardPopup.hidden = false;
  fishingRewardPopup.classList.remove('is-visible');
  void fishingRewardPopup.offsetWidth;
  fishingRewardPopup.classList.add('is-visible');
  fishingRewardTimer = window.setTimeout(() => {
    fishingRewardPopup.hidden = true;
    fishingRewardTimer = null;
  }, FISHING_REWARD_POPUP_MS);
}

function isFishingActive() {
  return fishingBusy || Boolean(fishingStatus?.activeFishing);
}

function scheduleRestInviteBubbleHide(invitation) {
  clearRestInviteBubbleTimer();
  restInviteBubbleTimer = window.setTimeout(() => {
    restInviteBubbleTimer = null;
    if (activeRestInvitation !== invitation) {
      return;
    }

    activeRestInvitation = null;
    if (
      isRestTimerMode() &&
      forcedBubbleUntil <= Date.now() &&
      lastRestInviteMessage === invitation.message &&
      lastRestEndingWarningKey === ''
    ) {
      renderer?.hideBubble?.();
    }
  }, REST_INVITE_HOLD_MS);
}

function clearRestInviteState() {
  clearRestInviteBubbleTimer();
  activeRestInvitation = null;
  lastRestInviteAt = 0;
  lastRestInviteMessage = '';
  lastRestInviteState = '';
  lastRestEndingWarningKey = '';
  hideFishingInvite();
}

function updateRestInviteBubble(options = {}) {
  if (!renderer?.showBubble || !isRestTimerMode() || manualVisualHoldUntil > Date.now() || fishingInviteVisible || isFishingActive()) {
    return;
  }

  const now = Date.now();
  const remainingSeconds = Number(lastRemainingSeconds);
  if (Number.isFinite(remainingSeconds) && remainingSeconds <= REST_END_WARNING_SECONDS) {
    clearRestInviteBubbleTimer();
    activeRestInvitation = null;
    const warningKey = String(Math.max(0, Math.ceil(remainingSeconds / 10)));
    if (options.force || lastRestEndingWarningKey !== warningKey) {
      renderer.showBubble(REST_END_WARNING_MESSAGE);
      lastRestEndingWarningKey = warningKey;
      lastRestInviteAt = now;
    }
    return;
  }

  lastRestEndingWarningKey = '';
  if (!options.force && lastRestInviteAt && now - lastRestInviteAt < REST_INVITE_INTERVAL_MS) {
    return;
  }

  const nextInvitation = pickRandomItem(REST_INVITATIONS, lastRestInviteState);
  if (!nextInvitation) {
    return;
  }

  renderer.showBubble(nextInvitation.message);
  activeRestInvitation = nextInvitation;
  lastRestInviteMessage = nextInvitation.message;
  lastRestInviteState = nextInvitation.state;
  lastRestInviteAt = now;
  scheduleRestInviteBubbleHide(nextInvitation);
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

function hasPetWindowResizeApi() {
  return Boolean(
    window.petodo?.getPetWindowBounds &&
    window.petodo?.setPetWindowScale &&
    window.petodo?.savePetWindowPosition
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

function setBackendStatus(nextStatus) {
  const previousStatus = menuState.backendStatus;
  if (previousStatus === nextStatus) {
    updateMenuButtons();
    return;
  }

  menuState.backendStatus = nextStatus;

  if (nextStatus === 'offline') {
    setPanelMessage('服务未连接');
    showPetBubble(BACKEND_OFFLINE_MESSAGE, CONNECTION_MESSAGE_HOLD_MS);
  } else if (nextStatus === 'online') {
    setPanelMessage('准备好了');
    if (previousStatus === 'offline') {
      showPetBubble(BACKEND_RESTORED_MESSAGE, CONNECTION_MESSAGE_HOLD_MS);
    }
  } else {
    setPanelMessage('正在连接');
  }

  updateMenuButtons();
}

function setServiceActionUnavailableMessage() {
  setPanelMessage(menuState.backendStatus === 'checking' ? '正在连接服务' : '服务未连接');
}

function clampScalePercent(scalePercent) {
  const nextPercent = Number(scalePercent);
  if (!Number.isFinite(nextPercent)) {
    return 100;
  }

  return Math.min(PET_SCALE_MAX, Math.max(PET_SCALE_MIN, nextPercent));
}

function getScalePercentFromSettings(settings = {}) {
  if (Number.isFinite(settings.scalePercent)) {
    return clampScalePercent(settings.scalePercent);
  }

  return LEGACY_PET_SCALE_PERCENT[settings.scale] || 100;
}

function applyScalePercent(scalePercent) {
  menuState.scalePercent = clampScalePercent(scalePercent);
  petRoot.style.setProperty('--pet-scale-factor', String(menuState.scalePercent / 100));
  petRoot.dataset.scalePercent = String(Math.round(menuState.scalePercent));
}

function applyMenuState(status = {}) {
  const settings = status.settings || {};
  applyScalePercent(getScalePercentFromSettings(settings));
  if (typeof settings.alwaysOnTop === 'boolean') {
    menuState.alwaysOnTop = settings.alwaysOnTop;
  }
  pinToggleButton?.classList.toggle('is-active', menuState.alwaysOnTop);
  updateMenuButtons();
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
  const scaleDownButton = toolPanel?.querySelector('[data-action="scale-down"]');
  const scaleUpButton = toolPanel?.querySelector('[data-action="scale-up"]');
  const serviceUnavailable = menuState.backendStatus !== 'online';
  const serviceUnavailableTitle = menuState.backendStatus === 'checking'
    ? '正在连接服务，请稍候'
    : '服务未连接，暂不可用';
  if (feedButton) {
    const shouldDisable = serviceUnavailable || menuState.points < 20;
    feedButton.disabled = shouldDisable;
    feedButton.classList.toggle('is-disabled', shouldDisable);
    feedButton.title = serviceUnavailable
      ? serviceUnavailableTitle
      : (shouldDisable ? '积分不足，暂时不能兑换汉堡' : '');
  }

  timerButtons.forEach((button) => {
    button.disabled = serviceUnavailable;
    button.classList.toggle('is-disabled', button.disabled);
    button.title = serviceUnavailable ? serviceUnavailableTitle : '';
  });

  if (scaleDownButton) {
    scaleDownButton.disabled = menuState.scalePercent <= PET_SCALE_MIN;
    scaleDownButton.classList.toggle('is-disabled', scaleDownButton.disabled);
  }
  if (scaleUpButton) {
    scaleUpButton.disabled = menuState.scalePercent >= PET_SCALE_MAX;
    scaleUpButton.classList.toggle('is-disabled', scaleUpButton.disabled);
  }
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

  return DEFAULT_IDLE_STATE;
}

function canEnterLongIdle() {
  return (
    activeState === DEFAULT_IDLE_STATE &&
    isTimerIdleMode() &&
    !isDraggingPet &&
    !isResizingPet &&
    !menuState.isOpen &&
    manualVisualHoldUntil <= Date.now()
  );
}

function scheduleLongIdleTimer() {
  if (!canEnterLongIdle()) {
    if (activeState !== LONG_IDLE_STATE) {
      resetLongIdleClock();
    }
    return;
  }

  const now = Date.now();
  if (!longIdleStartedAt) {
    longIdleStartedAt = now;
  }

  const remainingMs = LONG_IDLE_AFTER_MS - (now - longIdleStartedAt);
  if (remainingMs <= 0) {
    resetLongIdleClock();
    softlySetPetState(LONG_IDLE_STATE, {
      rememberPrevious: false,
      force: true,
      keepIdleTimer: true
    });
    return;
  }

  if (longIdleTimer) {
    return;
  }

  longIdleTimer = window.setTimeout(async () => {
    longIdleTimer = null;
    if (!canEnterLongIdle()) {
      return;
    }

    longIdleStartedAt = 0;
    await softlySetPetState(LONG_IDLE_STATE, {
      rememberPrevious: false,
      force: true,
      keepIdleTimer: true
    });
  }, remainingMs);
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
  activeState = renderer.currentState || DEFAULT_IDLE_STATE;
  window.petRenderer = renderer;
  renderer.loadFrames?.('surf').catch((error) => {
    console.warn('Failed to preload surf frames:', error);
  });
  renderer.loadFrames?.('run').catch((error) => {
    console.warn('Failed to preload run frames:', error);
  });

  if (options.persist !== false) {
    localStorage.setItem('petodo:pet-theme', theme.name);
  }

  return renderer;
}

async function setPetState(stateName, options = {}) {
  if (!renderer) {
    console.warn('Pet renderer is not ready yet.');
    return;
  }

  const nextStateName = normalizePetStateName(stateName);

  if (!options.keepManualTransition) {
    clearManualTransition();
  }

  if (activeState === nextStateName && options.force !== true) {
    scheduleLongIdleTimer();
    return;
  }

  if (nextStateName === DEFAULT_IDLE_STATE && options.keepIdleTimer !== true) {
    resetLongIdleClock();
  } else if (!isIdleState(nextStateName)) {
    resetLongIdleClock();
  }

  activeState = nextStateName;
  await renderer.setPetState(nextStateName, options);
  if (forcedBubbleUntil > Date.now() && forcedBubbleMessage) {
    renderer.showBubble(forcedBubbleMessage);
  }
  scheduleLongIdleTimer();
}

async function softlySetPetState(stateName, options = {}) {
  const { switchMs: requestedSwitchMs, ...stateOptions } = options;
  const switchMs = Number.isFinite(requestedSwitchMs)
    ? Math.max(0, Math.round(requestedSwitchMs))
    : STATE_SOFT_SWITCH_MS;

  if (!petRoot) {
    await setPetState(stateName, stateOptions);
    return;
  }

  const previousSwitchMs = petRoot.style.getPropertyValue('--state-soft-switch-ms');
  petRoot.style.setProperty('--state-soft-switch-ms', `${switchMs}ms`);

  try {
    petRoot.classList.add('state-soft-switch');
    await wait(switchMs);
    await setPetState(stateName, stateOptions);
    await wait(40);
  } finally {
    petRoot.classList.remove('state-soft-switch');
    if (previousSwitchMs) {
      petRoot.style.setProperty('--state-soft-switch-ms', previousSwitchMs);
    } else {
      petRoot.style.removeProperty('--state-soft-switch-ms');
    }
  }
}

function updateTimerText(text) {
  lastTimerText = text || lastTimerText;
  if (forcedBubbleUntil > Date.now()) {
    return;
  }

  renderer?.updateTimerText(text);
}

function waitForNextPaint() {
  return new Promise((resolve) => {
    window.requestAnimationFrame(() => {
      window.requestAnimationFrame(resolve);
    });
  });
}

async function setToolPanelOpen(isOpen) {
  if (!toolPanel || menuState.isOpen === isOpen) {
    return;
  }

  if (isOpen && isFocusTimerMode()) {
    showPetBubble(FOCUS_CLICK_MESSAGE, PET_CLICK_MESSAGE_HOLD_MS);
    return;
  }

  menuState.isOpen = isOpen;
  petRoot.classList.add('panel-switching');
  await waitForNextPaint();

  if (!isOpen) {
    petRoot.classList.remove('panel-open');
    toolPanel.hidden = true;
    scheduleLongIdleTimer();
  }

  if (hasPetWindowControlApi()) {
    try {
      const status = await window.petodo.setPetWindowPanelMode(isOpen);
      applyMenuState(status);
    } catch (error) {
      console.warn('Failed to resize pet window for panel:', error);
    }
  }

  if (isOpen) {
    await waitForNextPaint();
    petRoot.classList.add('panel-open');
    toolPanel.hidden = false;
    await waitForNextPaint();
    petRoot.classList.remove('panel-switching');
    resetLongIdleClock();
    await fetchPetState();
    updateMenuButtons();
  } else {
    await waitForNextPaint();
    petRoot.classList.remove('panel-switching');
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
    const resolvedNextState = typeof nextState === 'function' ? await nextState() : nextState;
    await setPetState(resolvedNextState || DEFAULT_IDLE_STATE, { rememberPrevious: false });
  };

  await setPetState(stateName, { keepManualTransition: true });
}

async function playTemporaryState(stateName, holdMs = FUN_ACTION_HOLD_MS, options = {}) {
  stateBeforeTemporary = resolveIdleReturnState(activeState);
  manualVisualHoldUntil = Date.now() + holdMs;
  if (options.preserveBubble !== true) {
    clearPetBubbleHold();
  }
  await setPetState(stateName, { keepManualTransition: true });

  if (manualHoldReturnTimer) {
    clearTimeout(manualHoldReturnTimer);
  }

  manualHoldReturnTimer = window.setTimeout(async () => {
    manualHoldReturnTimer = null;
    manualVisualHoldUntil = 0;
    const nextState = options.returnState || stateBeforeTemporary || resolveTimerBaseState();
    const nextOptions = {
      rememberPrevious: false,
      force: true
    };

    if (options.smoothReturn) {
      await softlySetPetState(nextState, {
        ...nextOptions,
        switchMs: options.returnSwitchMs
      });
      if (isRestTimerMode() && options.refreshRestInviteOnReturn !== false) {
        updateRestInviteBubble({ force: true });
      }
      return;
    }

    await setPetState(nextState, nextOptions);
    if (isRestTimerMode() && options.refreshRestInviteOnReturn !== false) {
      updateRestInviteBubble({ force: true });
    }
  }, holdMs);
}

async function waitForRendererReady(timeoutMs = 3000) {
  const startedAt = Date.now();
  while (!renderer && Date.now() - startedAt < timeoutMs) {
    await wait(50);
  }

  return Boolean(renderer);
}

async function playPetOpeningAnimation() {
  if (!(await waitForRendererReady())) {
    return;
  }

  await setToolPanelOpen(false);
  await playTemporaryState('stretch', STRETCH_ACTION_HOLD_MS, {
    returnState: resolveTimerBaseState(),
    smoothReturn: true,
    preserveBubble: true
  });
}

async function playTaskCompletionEasterEgg() {
  if (!taskCompleteEasterEgg || !taskCompleteAnimation) {
    return;
  }

  await waitForRendererReady();
  if (taskCompletionEasterEggTimer) {
    window.clearTimeout(taskCompletionEasterEggTimer);
    taskCompletionEasterEggTimer = null;
  }

  taskCompleteEasterEgg.hidden = false;
  taskCompleteEasterEgg.classList.remove('is-visible');
  taskCompleteAnimation.removeAttribute('src');
  void taskCompleteEasterEgg.offsetWidth;
  taskCompleteAnimation.src = `assets/pet/luoxiaohei/gif/task-complete-fish.webp?restart=${Date.now()}`;
  taskCompleteEasterEgg.classList.add('is-visible');

  taskCompletionEasterEggTimer = window.setTimeout(() => {
    taskCompleteEasterEgg.classList.remove('is-visible');
    window.setTimeout(() => {
      taskCompleteAnimation.removeAttribute('src');
      taskCompleteEasterEgg.hidden = true;
    }, 200);
    taskCompletionEasterEggTimer = null;
  }, TASK_COMPLETION_EASTER_EGG_MS);
}

async function checkFishingInvite() {
  if (!isRestTimerMode() || fishingInviteVisible || isFishingActive() || manualVisualHoldUntil > Date.now()) {
    return;
  }

  try {
    const result = await requestBackend('/fishing/invite/check', { method: 'POST' });
    applyFishingStatus(result.fishing);
    if (result.invited) {
      showFishingInvite();
      return;
    }
    updateRestInviteBubble();
  } catch (error) {
    console.warn('Failed to check fishing invite:', error);
  }
}

async function declineFishingInvite() {
  hideFishingInvite();
  try {
    applyFishingStatus(await requestBackend('/fishing/invite/decline', { method: 'POST' }));
  } catch (error) {
    console.warn('Failed to decline fishing invite:', error);
  }
  updateRestInviteBubble({ force: true });
}

async function startFishing() {
  if (fishingBusy) {
    return;
  }

  hideFishingInvite();
  clearRestInviteBubbleTimer();
  activeRestInvitation = null;
  renderer?.hideBubble?.();
  await setToolPanelOpen(false);

  try {
    const result = await requestBackend('/fishing/start', { method: 'POST' });
    applyFishingStatus(result.fishing);
    if (!result.success || !result.fishing?.activeFishing?.sessionId) {
      showPetBubble(result.message || '现在不能钓鱼喵', PET_CLICK_MESSAGE_HOLD_MS);
      updateRestInviteBubble({ force: true });
      return;
    }
    await playFishingSession(result.fishing.activeFishing);
  } catch (error) {
    setBackendStatus('offline');
  }
}

async function playFishingSession(session) {
  if (!session?.sessionId) {
    return;
  }

  fishingBusy = true;
  fishingSessionId = session.sessionId;
  clearManualTransition();
  clearFishingSettleTimer();
  clearPetBubbleHold();
  manualVisualHoldUntil = Date.now() + FISHING_DURATION_MS + FISHING_HAPPY_HOLD_MS + 800;
  await setPetState('fishing', { keepManualTransition: true, force: true });
  showPetBubble('小黑正在钓鱼……', FISHING_DURATION_MS);

  const elapsedMs = Math.max(0, Date.now() - Number(session.startedAt || 0) * 1000);
  const remainingMs = Math.max(250, FISHING_DURATION_MS - elapsedMs);
  fishingSettleTimer = window.setTimeout(() => {
    fishingSettleTimer = null;
    settleFishing(session.sessionId);
  }, remainingMs);
}

async function settleFishing(sessionId) {
  if (!sessionId) {
    return;
  }

  try {
    const result = await requestBackend('/fishing/settle', {
      method: 'POST',
      body: JSON.stringify({ sessionId })
    });
    if (!result.success) {
      fishingBusy = false;
      fishingSessionId = '';
      manualVisualHoldUntil = 0;
      await setPetState(resolveTimerBaseState(), { rememberPrevious: false, force: true });
      return;
    }

    applyFishingStatus(result.fishing);
    showFishingReward(result.rewardLabel);
    showPetBubble(result.bubbleMessage || '鱼跑掉了喵……', PET_CLICK_MESSAGE_HOLD_MS);
    fishingBusy = false;
    fishingSessionId = '';

    if (result.result === 'boot') {
      manualVisualHoldUntil = Date.now() + PET_CLICK_MESSAGE_HOLD_MS;
      window.setTimeout(async () => {
        manualVisualHoldUntil = 0;
        await setPetState(resolveTimerBaseState(), { rememberPrevious: false, force: true });
        if (isRestTimerMode()) {
          updateRestInviteBubble({ force: true });
        }
      }, PET_CLICK_MESSAGE_HOLD_MS);
      return;
    }

    await playTemporaryState('happy', FISHING_HAPPY_HOLD_MS, {
      returnState: 'rest',
      smoothReturn: true,
      preserveBubble: true,
      refreshRestInviteOnReturn: true
    });
  } catch (error) {
    setBackendStatus('offline');
  }
}

async function holdPetState(stateName, durationMs = 5000) {
  manualVisualHoldUntil = Date.now() + durationMs;
  await setPetState(stateName);
}

async function feedPet() {
  clearManualTransition();
  await setPetState('eating_hamburger', { keepManualTransition: true });

  manualTransitionTimer = window.setTimeout(() => {
    playStateThen('finished_eating', () => resolveTimerBaseState());
  }, EATING_DURATION_MS);
}

async function redeemFishAndFeed() {
  if (menuState.backendStatus !== 'online') {
    setServiceActionUnavailableMessage();
    updateMenuButtons();
    return;
  }

  try {
    const result = await requestBackend('/shop/redeem', {
      method: 'POST',
      body: JSON.stringify({ food_id: 'hamburger' })
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

    setPanelMessage(result.message || '吃到汉堡');
    updateMenuButtons();
    window.setTimeout(() => fetchPetState(), 2600);
  } catch (error) {
    setBackendStatus('offline');
  }
}

async function toggleTimerFromPanel() {
  if (menuState.backendStatus !== 'online') {
    setServiceActionUnavailableMessage();
    updateMenuButtons();
    return;
  }

  try {
    const endpoint = lastTimerStatus === 'focus' ? '/timer/pause' : '/timer/start';
    const requestOptions = { method: 'POST' };
    if (endpoint === '/timer/start') {
      requestOptions.body = JSON.stringify({
        task_id: localStorage.getItem(CURRENT_TASK_STORAGE_KEY) || null
      });
    }
    const timerStatus = await requestBackend(endpoint, requestOptions);
    await updatePetFromBackend({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    setPanelMessage(lastTimerStatus === 'focus' ? '专注中' : '已暂停');
    updateMenuButtons();
  } catch (error) {
    setBackendStatus('offline');
  }
}

async function resetTimerFromPanel() {
  if (menuState.backendStatus !== 'online') {
    setServiceActionUnavailableMessage();
    updateMenuButtons();
    return;
  }

  try {
    const timerStatus = await requestBackend('/timer/reset', { method: 'POST' });
    await updatePetFromBackend({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    setPanelMessage('已重置');
    updateMenuButtons();
  } catch (error) {
    setBackendStatus('offline');
  }
}

async function setScaleFromPanel(direction) {
  const requestedPercent = clampScalePercent(menuState.scalePercent + direction * PET_SCALE_STEP);
  applyScalePercent(requestedPercent);

  if (!window.petodo?.setPetWindowScale) {
    return;
  }

  try {
    applyMenuState(await window.petodo.setPetWindowScale(requestedPercent));
    if (menuState.isOpen && window.petodo?.setPetWindowPanelMode) {
      applyMenuState(await window.petodo.setPetWindowPanelMode(true));
    }
    setPanelMessage(`${Math.round(menuState.scalePercent)}% 大小`);
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
  if (isFishingActive() && !['hide', 'open-main', 'quit'].includes(action)) {
    showPetBubble('小黑正在钓鱼……', PET_CLICK_MESSAGE_HOLD_MS);
    return;
  }

  const actionHandlers = {
    sleep: () => holdPetState('sleep', 8000),
    feed: redeemFishAndFeed,
    greet: () => playTemporaryState('greet', GREET_ACTION_HOLD_MS + BAG_ACTION_RETURN_DELAY_MS),
    run: () => playTemporaryState('run', RUN_ACTION_HOLD_MS + BAG_ACTION_RETURN_DELAY_MS),
    roll: () => playTemporaryState('roll'),
    surf: () => playTemporaryState('surf', SURF_ACTION_HOLD_MS),
    exercise: () => playTemporaryState('exercise'),
    guitar: () => playTemporaryState('guitar'),
    scratch: () => playTemporaryState('scratch'),
    stretch: () => playTemporaryState('stretch', STRETCH_ACTION_HOLD_MS),
    tap: () => playTemporaryState('tap'),
    'timer-toggle': toggleTimerFromPanel,
    'timer-reset': resetTimerFromPanel,
    pin: togglePinFromPanel,
    'scale-down': () => setScaleFromPanel(-1),
    'scale-up': () => setScaleFromPanel(1),
    hide: async () => {
      await setToolPanelOpen(false);
      await window.petodo?.closePetWindow?.();
    },
    'open-main': () => window.petodo?.showMainWindow?.(),
    quit: () => window.petodo?.quitApp?.()
  };

  await actionHandlers[action]?.();
}

async function playInvitedRestInteraction() {
  if (fishingInviteVisible || isFishingActive()) {
    return;
  }

  const invitation = activeRestInvitation;
  if (!invitation || lastRestEndingWarningKey !== '') {
    return;
  }

  clearRestInviteBubbleTimer();
  activeRestInvitation = null;
  renderer?.hideBubble?.();
  await setToolPanelOpen(false);
  await playTemporaryState(invitation.state, invitation.holdMs, {
    returnState: 'rest',
    smoothReturn: true,
    refreshRestInviteOnReturn: false
  });
}

async function handlePetClickByTimerMode() {
  resetTapClicks();
  await setToolPanelOpen(false);

  if (fishingInviteVisible || isFishingActive()) {
    return;
  }

  if (isRestTimerMode()) {
    await playInvitedRestInteraction();
    return;
  }

  if (lastTimerStatus === 'focus') {
    showPetBubble(FOCUS_CLICK_MESSAGE, PET_CLICK_MESSAGE_HOLD_MS);
    return;
  }

  showPetBubble(IDLE_CLICK_MESSAGE, PET_CLICK_MESSAGE_HOLD_MS);
}

function schedulePetWindowResize(scalePercent) {
  if (!resizeSession || !hasPetWindowResizeApi()) {
    return;
  }

  resizeSession.nextScalePercent = clampScalePercent(scalePercent);
  if (resizeSession.resizeFrame) {
    return;
  }

  resizeSession.resizeFrame = window.requestAnimationFrame(async () => {
    const session = resizeSession;
    if (!session) {
      return;
    }

    session.resizeFrame = null;
    const status = await window.petodo.setPetWindowScale(session.nextScalePercent, {
      preserveTopLeft: true
    });
    applyMenuState(status);
  });
}

async function beginPetResize(event) {
  if ((event.button !== undefined && event.button !== 0) || menuState.isOpen || !hasPetWindowResizeApi()) {
    return;
  }

  event.preventDefault?.();
  event.stopPropagation?.();
  resetTapClicks();
  resetLongIdleClock();
  isResizingPet = true;
  petRoot.classList.add('resizing');

  try {
    petResizeHandle.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort while the frameless window changes size.
  }

  const bounds = await window.petodo.getPetWindowBounds();
  if (!bounds) {
    isResizingPet = false;
    petRoot.classList.remove('resizing');
    return;
  }

  resizeSession = {
    pointerId: event.pointerId,
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startScalePercent: menuState.scalePercent,
    nextScalePercent: menuState.scalePercent,
    resizeFrame: null
  };
}

function movePetResize(event) {
  if (!isResizingPet || !resizeSession || event.pointerId !== resizeSession.pointerId) {
    return;
  }

  event.preventDefault?.();
  const deltaX = event.screenX - resizeSession.startScreenX;
  const deltaY = event.screenY - resizeSession.startScreenY;
  const dominantDelta = Math.abs(deltaX) > Math.abs(deltaY) ? deltaX : deltaY;
  schedulePetWindowResize(resizeSession.startScalePercent + dominantDelta / 2.6);
}

async function endPetResize(event) {
  if (!isResizingPet || (resizeSession && event.pointerId !== resizeSession.pointerId)) {
    return;
  }

  const session = resizeSession;
  resizeSession = null;
  isResizingPet = false;
  petRoot.classList.remove('resizing');

  try {
    petResizeHandle.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released after the window resize.
  }

  if (session?.resizeFrame) {
    window.cancelAnimationFrame(session.resizeFrame);
    const status = await window.petodo.setPetWindowScale(session.nextScalePercent, {
      preserveTopLeft: true
    });
    applyMenuState(status);
  }

  if (hasPetWindowResizeApi()) {
    await window.petodo.savePetWindowPosition();
  }
  scheduleLongIdleTimer();
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
  resetLongIdleClock();
  isDraggingPet = true;
  suppressClickAfterDrag = false;
  stateBeforeTemporary = resolveIdleReturnState(activeState);

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

  scheduleLongIdleTimer();

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
  petResizeHandle?.addEventListener('pointerdown', beginPetResize);
  petResizeHandle?.addEventListener('click', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  petResizeHandle?.addEventListener('contextmenu', (event) => {
    event.preventDefault();
    event.stopPropagation();
  });
  window.addEventListener('pointermove', movePetResize);
  window.addEventListener('pointercancel', endPetResize);
  window.addEventListener('pointerup', endPetResize);

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

    await handlePetClickByTimerMode();
  });

  petSprite.addEventListener('contextmenu', async (event) => {
    event.preventDefault();
    event.stopPropagation();
    resetTapClicks();
    suppressClickAfterPanelClose = false;
    suppressClickAfterDrag = false;
    if (isFishingActive()) {
      showPetBubble('小黑正在钓鱼……', PET_CLICK_MESSAGE_HOLD_MS);
      return;
    }
    if (isFocusTimerMode()) {
      showPetBubble(FOCUS_CLICK_MESSAGE, PET_CLICK_MESSAGE_HOLD_MS);
      return;
    }
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

  fishingStartButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    startFishing();
  });

  fishingDeclineButton?.addEventListener('click', (event) => {
    event.stopPropagation();
    declineFishingInvite();
  });
}

function bindKeyboardShortcuts() {
  const stateByKey = {
    1: DEFAULT_IDLE_STATE,
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
    return DEFAULT_IDLE_STATE;
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

  return DEFAULT_IDLE_STATE;
}

function applyFishingStatus(status) {
  if (!status) {
    return;
  }

  fishingStatus = status;
  updateFishingInventory(status);
  if (!status.pendingInvitation && !status.activeFishing) {
    hideFishingInvite();
  }
}

function maybeResumeFishingSession() {
  const session = fishingStatus?.activeFishing;
  if (!session?.sessionId || fishingBusy || session.sessionId === fishingSessionId) {
    return;
  }

  playFishingSession(session);
}

async function setBackendIdleState() {
  if (activeState === LONG_IDLE_STATE) {
    scheduleLongIdleTimer();
    return;
  }

  await setPetState(DEFAULT_IDLE_STATE);
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
  applyFishingStatus(data.fishing);

  if (remainingSeconds !== undefined && remainingSeconds !== null) {
    lastRemainingSeconds = Number(remainingSeconds);
    const minutes = Math.floor(remainingSeconds / 60);
    const seconds = remainingSeconds % 60;
    updateTimerText(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  }

  if (timerStatus) {
    lastTimerStatus = timerStatus;
    if (!isRestTimerMode()) {
      clearRestInviteState();
    }
    if (isFocusTimerMode() && menuState.isOpen) {
      await setToolPanelOpen(false);
    }
  }

  if (Number.isFinite(data.points)) {
    menuState.points = data.points;
  } else if (Number.isFinite(data.points_status?.current_points)) {
    menuState.points = data.points_status.current_points;
  }
  updateMenuButtons();

  if (isDraggingPet || isResizingPet) {
    return;
  }

  maybeResumeFishingSession();
  if (isFishingActive()) {
    return;
  }

  if (manualVisualHoldUntil > Date.now()) {
    return;
  }

  const hungerNotice = getHungerNotice(petStatus, pet.reason || '');
  if (!hungerNotice) {
    lastHungerNoticeKey = '';
  }

  if (petStatus === 'happy' && completedFocusKey && completedFocusKey !== lastCompletedFocusKey) {
    lastCompletedFocusKey = completedFocusKey;
    lastTimerStatus = 'break';
    await playStateThen('happy', async () => {
      await setPetState('rest', { rememberPrevious: false });
      await checkFishingInvite();
      return 'rest';
    });
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

  if (petStatus === 'eating_hamburger' || petStatus === 'eating_pizza' || petStatus === 'eating_chicken_leg') {
    await setPetState(petStatus);
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
    await checkFishingInvite();
    updateRestInviteBubble();
    return;
  }

  if (petStatus === 'idle' || petStatus === DEFAULT_IDLE_STATE || petStatus === LONG_IDLE_STATE) {
    await setBackendIdleState();
    return;
  }

  if (hungerNotice) {
    await setPetState(petStatus);
    if (lastHungerNoticeKey !== hungerNotice.key) {
      lastHungerNoticeKey = hungerNotice.key;
      showPetBubble(hungerNotice.message, HUNGER_MESSAGE_HOLD_MS);
    }
    return;
  }

  if (['sleep', 'tap', 'greet', 'run', 'roll', 'surf', 'exercise', 'guitar', 'scratch', 'stretch'].includes(petStatus)) {
    await setPetState(petStatus);
    return;
  }

  const nextState = stateFromHungerLevel(hungerLevel);
  if (nextState === DEFAULT_IDLE_STATE) {
    await setBackendIdleState();
    return;
  }

  await setPetState(nextState);
}

async function fetchPetState() {
  try {
    const data = await requestBackend('/app/status');
    await updatePetFromBackend(data);
    setBackendStatus('online');
  } catch (error) {
    setBackendStatus('offline');
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
window.playPetOpeningAnimation = playPetOpeningAnimation;
window.playTaskCompletionEasterEgg = playTaskCompletionEasterEgg;

window.addEventListener('DOMContentLoaded', async () => {
  petSprite.addEventListener('error', () => renderer?.handleImageError());
  await setPetTheme(getRequestedThemeName(), { persist: false });
  await syncWindowSettings();
  updateMenuButtons();
  bindPetInteractions();
  bindKeyboardShortcuts();
  scheduleLongIdleTimer();
  startBackendStatusPolling();
});
