const FOCUS_SECONDS = 25 * 60;
const API_BASE_URL =
  (window.PETODO_CONFIG?.API_BASE_URL || window.API_BASE_URL || "http://120.77.145.202").replace(/\/+$/, '');
window.API_BASE_URL = API_BASE_URL;
const EMPTY_TASK_LABEL = '暂未选择任务';
const TODO_STORAGE_KEY = 'todoList';
const CURRENT_TASK_STORAGE_KEY = 'currentTask';
const TODO_DATE_STORAGE_KEY = 'todoListDate';
const COUNTDOWN_STORAGE_KEY = 'countdownGoals';
const USER_PROFILE_STORAGE_KEY = 'petodoUserProfile';
const ACCOUNT_PROFILE_STORAGE_PREFIX = 'petodoAccountProfile';
const ACCOUNT_DATA_STORAGE_PREFIX = 'petodoAccountData';
const DAILY_TASK_EASTER_EGG_SETTING_KEY = 'dailyTaskEasterEggEnabled';
const INITIAL_TASK_FOCUS_BACKFILL_STORAGE_KEY = 'taskFocusBackfill-2026-05-26-digital-report-v1';
const LOCAL_TIMER_TICK_MS = 250;
const DAILY_TODO_CHECK_MS = 60 * 1000;
const COMPLETION_DIALOG_AUTO_HIDE_MS = 5200;
const SCROLLBAR_VISIBLE_MS = 800;
const DEFAULT_IDLE_STATE = 'idle_1';
const SHORT_REST_SECOND_STAGE_SECONDS = 4 * 60;
const LONG_REST_SECOND_STAGE_SECONDS = 5 * 60;
const MS_PER_DAY = 24 * 60 * 60 * 1000;

const initialUserProfile = loadUserProfile();
const initialAccountId = initialUserProfile.isLoggedIn ? initialUserProfile.accountId : '';

const state = {
  page: 'home',
  phase: 'Focus Session',
  remainingSeconds: FOCUS_SECONDS,
  timerMode: 'idle',
  breakType: null,
  breakElapsedSeconds: 0,
  timerSnapshotRemainingSeconds: FOCUS_SECONDS,
  timerSnapshotClientTime: Date.now(),
  isRunning: false,
  completedToday: 0,
  totalFocusSeconds: 0,
  focusRecords: [],
  journalView: 'day',
  journalCursorDate: new Date(),
  journalSelectedDate: new Date(),
  userProfile: initialUserProfile,
  todoList: loadTodoList(initialAccountId),
  countdownList: loadCountdownList(initialAccountId),
  currentTaskId: loadCurrentTaskId(initialAccountId),
  todoListDate: loadTodoListDate(initialAccountId),
  pendingTodoRollover: false,
  petState: DEFAULT_IDLE_STATE,
  petReason: '',
  dailyTaskEasterEggEnabled: loadDailyTaskEasterEggSetting(initialAccountId),
  hunger: 80,
  mood: '平静',
  points: 0,
  timerId: null,
  hasLoadedAppStatus: false,
  lastCompletedFocusKey: '',
  zeroRefreshRequested: false
};

let lastSyncedAuthLayout = null;
let lastSyncedAccountId = null;

const PET_MESSAGES = {
  idle_1: '小动物正在陪你',
  idle_2: '小动物正在陪你',
  focus: '小动物正在陪你学习',
  rest: '小动物提醒你休息',
  rest_1: '小动物提醒你休息',
  rest_2: '小动物正在短休息',
  rest_long_start: '长休息开始，小黑也在休息',
  rest_long_after_5: '长休息进行中，小黑睡熟了',
  happy: '小动物很开心',
  fishing: '小动物正在钓鱼',
  hungry: '小动物有点饿了',
  hungry_heavy: '小动物已经很饿了',
  angry: '小动物生气了',
  sleep: '小动物睡着了',
  eating: '小动物正在吃补给',
  eating_watermelon: '小动物正在吃西瓜',
  eating_hamburger: '小动物正在吃汉堡',
  eating_pizza: '小动物正在吃披萨',
  eating_chicken_leg: '小动物正在吃鸡腿',
  finished_eating: '小动物吃得很开心'
};

const PET_STATE_TEXT = {
  idle_1: '陪伴中',
  idle_2: '陪伴中',
  focus: '专注中',
  rest: '休息中',
  rest_1: '休息中',
  rest_2: '休息中',
  rest_long_start: '长休息中',
  rest_long_after_5: '长休息中',
  happy: '开心',
  fishing: '钓鱼中',
  hungry: '有点饿',
  hungry_heavy: '很饿',
  angry: '生气了',
  sleep: '睡着了',
  eating: '进食中',
  eating_watermelon: '吃西瓜中',
  eating_hamburger: '吃汉堡中',
  eating_pizza: '吃披萨中',
  eating_chicken_leg: '吃鸡腿中',
  finished_eating: '吃完了'
};

const PET_IMAGES = {
  idle_1: 'assets/pet/luoxiaohei/gif/luoxiaohei-idle-1.gif',
  idle_2: 'assets/pet/luoxiaohei/gif/luoxiaohei-idle.gif',
  focus: 'assets/pet/luoxiaohei/gif/luoxiaohei-focus.gif',
  rest: 'assets/pet/luoxiaohei/gif/luoxiaohei-rest.gif',
  rest_1: 'assets/pet/luoxiaohei/gif/luoxiaohei-rest.gif',
  rest_2: 'assets/pet/luoxiaohei/gif/luoxiaohei-rest-2.gif',
  rest_long_start: 'assets/pet/luoxiaohei/gif/luoxiaohei-rest-long-start.gif',
  rest_long_after_5: 'assets/pet/luoxiaohei/gif/luoxiaohei-rest-long-after-5.gif',
  happy: 'assets/pet/luoxiaohei/img/happy/luoxiaohei-happy-01.png',
  fishing: 'assets/pet/luoxiaohei/gif/luoxiaohei-fishing.gif',
  hungry: 'assets/pet/luoxiaohei/gif/luoxiaohei-hungry.webp',
  hungry_heavy: 'assets/pet/luoxiaohei/gif/luoxiaohei-hungry-heavy.webp',
  angry: 'assets/pet/luoxiaohei/gif/luoxiaohei-angry.gif',
  sleep: 'assets/pet/luoxiaohei/gif/luoxiaohei-sleep.gif',
  eating: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating.gif',
  eating_watermelon: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating-watermelon.gif',
  eating_hamburger: 'assets/pet/luoxiaohei/img/eating/luoxiaohei-eating-hamburger.png',
  eating_pizza: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating-pizza.gif',
  eating_chicken_leg: 'assets/pet/luoxiaohei/img/eating/luoxiaohei-eating-chicken-leg.png',
  finished_eating: 'assets/pet/luoxiaohei/gif/luoxiaohei-finished-eating.gif'
};

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('[data-page-panel]');
document.querySelector('#page-home .countdown-header-actions')?.remove();
const loginScreen = document.querySelector('#loginScreen');
const loginForm = document.querySelector('#loginForm');
const loginAccountInput = document.querySelector('#loginAccountInput');
const loginPasswordInput = document.querySelector('#loginPasswordInput');
const registerButton = document.querySelector('#registerButton');
const userGreetingText = document.querySelector('#userGreetingText');
const windowMinimizeButton = document.querySelector('#windowMinimizeButton');
const windowMaximizeButton = document.querySelector('#windowMaximizeButton');
const windowCloseButton = document.querySelector('#windowCloseButton');
const profileNameInput = document.querySelector('#profileNameInput');
const profileAvatarInput = document.querySelector('#profileAvatarInput');
const profileAvatarButton = document.querySelector('#profileAvatarButton');
const chooseAvatarButton = document.querySelector('#chooseAvatarButton');
const saveProfileButton = document.querySelector('#saveProfileButton');
const logoutButton = document.querySelector('#logoutButton');
const avatarButtons = document.querySelectorAll('.avatar-button');
const avatarImages = document.querySelectorAll('[data-user-avatar]');
const avatarFallbacks = document.querySelectorAll('[data-avatar-fallback]');
const toast = document.querySelector('#toast');
const companionImage = document.querySelector('#companionImage');
const companionCard = document.querySelector('.companion-card');
const hungerText = document.querySelector('#hungerText');
const hungerGuidance = document.querySelector('#hungerGuidance');
const hungerGuidanceTitle = document.querySelector('#hungerGuidanceTitle');
const hungerGuidanceText = document.querySelector('#hungerGuidanceText');
const openShopButton = document.querySelector('#openShopButton');
const todoForm = document.querySelector('#todoForm');
const todoNameInput = document.querySelector('#todoNameInput');
const todoTypeSelect = document.querySelector('#todoTypeSelect');
const todoPomodoroSelect = document.querySelector('#todoPomodoroSelect');
const todoListElement = document.querySelector('#todoList');
const todoEmptyState = document.querySelector('#todoEmptyState');
const todoWidgetButton = document.querySelector('#todoWidgetButton');
const countdownAddButton = document.querySelector('#countdownAddButton');
const countdownWidgetButton = document.querySelector('#page-countdown #countdownWidgetButton');
const countdownModal = document.querySelector('#countdownModal');
const countdownModalBackdrop = document.querySelector('#countdownModalBackdrop');
const countdownModalCancelButton = document.querySelector('#countdownModalCancelButton');
const countdownForm = document.querySelector('#countdownForm');
const countdownNameInput = document.querySelector('#countdownNameInput');
const countdownDateInput = document.querySelector('#countdownDateInput');
const countdownNoteInput = document.querySelector('#countdownNoteInput');
const countdownListElement = document.querySelector('#countdownList');
const countdownEmptyState = document.querySelector('#countdownEmptyState');
const journalViewContent = document.querySelector('#journalViewContent');
const journalDayList = document.querySelector('#journalDayList');
const journalViewButtons = document.querySelectorAll('[data-journal-view]');
const journalPrevButton = document.querySelector('#journalPrevButton');
const journalNextButton = document.querySelector('#journalNextButton');
const journalRangeText = document.querySelector('#journalRangeText');
const journalStartTimeText = document.querySelector('#journalStartTimeText');
const journalPeriodTimeText = document.querySelector('#journalPeriodTimeText');
const journalPeriodCountText = document.querySelector('#journalPeriodCountText');
const journalBreakCountText = document.querySelector('#journalBreakCountText');
const journalPeriodChart = document.querySelector('#journalPeriodChart');
const journalChartEmptyState = document.querySelector('#journalChartEmptyState');
const journalPeriodSummary = document.querySelector('#journalPeriodSummary');
const journalSummaryScope = document.querySelector('#journalSummaryScope');
const journalDetailScope = document.querySelector('#journalDetailScope');
const journalDetailTotalText = document.querySelector('#journalDetailTotalText');
const journalRankSummary = document.querySelector('#journalRankSummary');
const journalRankList = document.querySelector('#journalRankList');
const journalRecentList = document.querySelector('#journalRecentList');
const journalEmptyState = document.querySelector('#journalEmptyState');
const completionDialog = document.querySelector('#completionDialog');
const completionCloseButton = document.querySelector('#completionCloseButton');
const completionContinueButton = document.querySelector('#completionContinueButton');
const dailyTaskEasterEggDialog = document.querySelector('#dailyTaskEasterEggDialog');
const dailyTaskEasterEggImage = document.querySelector('#dailyTaskEasterEggImage');
const dailyTaskEasterEggCloseButton = document.querySelector('#dailyTaskEasterEggCloseButton');
const dailyTaskEasterEggToggle = document.querySelector('#dailyTaskEasterEggToggle');
const todoRolloverDialog = document.querySelector('#todoRolloverDialog');
const todoRolloverSummary = document.querySelector('#todoRolloverSummary');
const todoRolloverCarryButton = document.querySelector('#todoRolloverCarryButton');
const todoRolloverClearButton = document.querySelector('#todoRolloverClearButton');
let appStatusPollTimer = null;
let dailyTodoCheckTimer = null;
let completionContinueBusy = false;

const timeDisplays = [
  document.querySelector('#homeTimeText')
];

const phaseDisplays = [
  document.querySelector('#homePhaseText')
];

const completedDisplays = [
  document.querySelector('#homeCompletedText')
];

const taskDisplays = [
  document.querySelector('#homeTaskText'),
  document.querySelector('#sidebarTaskText'),
  document.querySelector('#todoCurrentText')
];

const startButtons = [
  document.querySelector('#homeStartButton')
];

const pauseButtons = [
  document.querySelector('#homePauseButton')
];

const resetButtons = [
  document.querySelector('#homeResetButton')
];

function setupOnDemandScrollbars() {
  document.querySelectorAll('.content, .companion-panel').forEach((scrollRegion) => {
    let hideScrollbarTimer = 0;

    scrollRegion.addEventListener('wheel', () => {
      scrollRegion.classList.add('is-scrolling');
      window.clearTimeout(hideScrollbarTimer);
      hideScrollbarTimer = window.setTimeout(() => {
        scrollRegion.classList.remove('is-scrolling');
      }, SCROLLBAR_VISIBLE_MS);
    }, { passive: true });
  });
}

function loadUserProfile() {
  try {
    const saved = JSON.parse(localStorage.getItem(USER_PROFILE_STORAGE_KEY) || '{}');
    return {
      isLoggedIn: Boolean(saved.isLoggedIn),
      accountId: typeof saved.accountId === 'string' ? saved.accountId : '',
      accountName: typeof saved.accountName === 'string' ? saved.accountName.trim() : '',
      name: typeof saved.name === 'string' ? saved.name.trim() : '',
      avatar: typeof saved.avatar === 'string' ? saved.avatar : ''
    };
  } catch {
    return {
      isLoggedIn: false,
      accountId: '',
      accountName: '',
      name: '',
      avatar: ''
    };
  }
}

function saveUserProfile() {
  localStorage.setItem(USER_PROFILE_STORAGE_KEY, JSON.stringify(state.userProfile));
  saveAccountProfile(state.userProfile);
}

function getAccountProfileKey(accountId) {
  return `${ACCOUNT_PROFILE_STORAGE_PREFIX}:${accountId}`;
}

function getAccountDataKey(baseKey, accountId = state?.userProfile?.accountId) {
  return accountId ? `${ACCOUNT_DATA_STORAGE_PREFIX}:${accountId}:${baseKey}` : baseKey;
}

function loadAccountProfile(accountId) {
  if (!accountId) {
    return {};
  }

  try {
    return JSON.parse(localStorage.getItem(getAccountProfileKey(accountId)) || '{}') || {};
  } catch {
    return {};
  }
}

function saveAccountProfile(profile = state.userProfile) {
  if (!profile.accountId) {
    return;
  }

  localStorage.setItem(getAccountProfileKey(profile.accountId), JSON.stringify({
    accountId: profile.accountId,
    accountName: profile.accountName || '',
    name: profile.name || '',
    avatar: profile.avatar || ''
  }));
}

function getProfileName() {
  return state.userProfile.name || state.userProfile.accountName || 'Petodo';
}

function getProfileInitial() {
  return getProfileName().trim().charAt(0).toUpperCase() || 'P';
}

function loadTodoList(accountId = state?.userProfile?.accountId) {
  if (!accountId) {
    return [];
  }

  try {
    const saved = JSON.parse(localStorage.getItem(getAccountDataKey(TODO_STORAGE_KEY, accountId)) || '[]');
    if (!Array.isArray(saved)) {
      return [];
    }

    return saved
      .filter((task) => task && typeof task.name === 'string')
      .map((task) => ({
        id: String(task.id || createTaskId()),
        name: task.name,
        type: task.type || '学习',
        estimatedPomodoros: Number(task.estimatedPomodoros) || 1,
        completedPomodoros: Number(task.completedPomodoros) || 0,
        completedFocusRecordKeys: Array.isArray(task.completedFocusRecordKeys)
          ? task.completedFocusRecordKeys.map(String)
          : [],
        completed: Boolean(task.completed)
      }));
  } catch {
    return [];
  }
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

function loadCountdownList(accountId = state?.userProfile?.accountId) {
  if (!accountId) {
    return [];
  }

  try {
    const saved = JSON.parse(localStorage.getItem(getAccountDataKey(COUNTDOWN_STORAGE_KEY, accountId)) || '[]');
    if (!Array.isArray(saved)) {
      return [];
    }

    return saved
      .filter((goal) => goal && typeof goal.name === 'string' && isValidDateKey(goal.targetDate))
      .map((goal) => ({
        id: String(goal.id || createCountdownId()),
        name: goal.name.trim(),
        targetDate: goal.targetDate,
        note: typeof goal.note === 'string' ? goal.note.trim() : ''
      }))
      .filter((goal) => goal.name);
  } catch {
    return [];
  }
}

function loadCurrentTaskId(accountId = state?.userProfile?.accountId) {
  if (!accountId) {
    return '';
  }
  return localStorage.getItem(getAccountDataKey(CURRENT_TASK_STORAGE_KEY, accountId)) || '';
}

function loadTodoListDate(accountId = state?.userProfile?.accountId) {
  if (!accountId) {
    return '';
  }
  return localStorage.getItem(getAccountDataKey(TODO_DATE_STORAGE_KEY, accountId)) || '';
}

function loadDailyTaskEasterEggSetting(accountId = state?.userProfile?.accountId) {
  if (!accountId) {
    return true;
  }
  return localStorage.getItem(getAccountDataKey(DAILY_TASK_EASTER_EGG_SETTING_KEY, accountId)) !== 'false';
}

function saveTodoState() {
  if (!state.userProfile.accountId) {
    return;
  }

  localStorage.setItem(getAccountDataKey(TODO_STORAGE_KEY), JSON.stringify(state.todoList));
  localStorage.setItem(getAccountDataKey(CURRENT_TASK_STORAGE_KEY), state.currentTaskId);
  localStorage.setItem(getAccountDataKey(TODO_DATE_STORAGE_KEY), state.todoListDate || getTodayKey());

  if (window.petodo?.saveTodoState) {
    window.petodo.saveTodoState({
      todoList: state.todoList,
      currentTaskId: state.currentTaskId,
      todoListDate: state.todoListDate || getTodayKey()
    }).catch((error) => {
      console.warn('Failed to save todo state to desktop storage:', error);
    });
  }
}

function applyTodoState(todoState = {}) {
  state.todoList = Array.isArray(todoState.todoList) ? todoState.todoList : [];
  state.currentTaskId = typeof todoState.currentTaskId === 'string' ? todoState.currentTaskId : '';
  state.todoListDate = typeof todoState.todoListDate === 'string' ? todoState.todoListDate : '';

  if (state.currentTaskId && !getCurrentTask()) {
    state.currentTaskId = '';
  }

  if (state.userProfile.accountId) {
    localStorage.setItem(getAccountDataKey(TODO_STORAGE_KEY), JSON.stringify(state.todoList));
    localStorage.setItem(getAccountDataKey(CURRENT_TASK_STORAGE_KEY), state.currentTaskId);
    localStorage.setItem(getAccountDataKey(TODO_DATE_STORAGE_KEY), state.todoListDate || getTodayKey());
  }
}

async function loadTodoState() {
  const legacyState = {
    todoList: loadTodoList(),
    currentTaskId: loadCurrentTaskId(),
    todoListDate: loadTodoListDate()
  };

  applyTodoState(legacyState);

  if (window.petodo?.saveTodoState) {
    window.petodo.saveTodoState(legacyState).catch((error) => {
      console.warn('Failed to sync account todo state to desktop storage:', error);
    });
  }

  return legacyState;
}

async function loadCountdownState() {
  const legacyGoals = loadCountdownList();
  state.countdownList = legacyGoals;
  return state.countdownList;
}

async function saveCountdownState() {
  if (!state.userProfile.accountId) {
    return state.countdownList;
  }

  localStorage.setItem(getAccountDataKey(COUNTDOWN_STORAGE_KEY), JSON.stringify(state.countdownList));

  if (!window.petodo?.saveCountdownGoals) {
    return state.countdownList;
  }

  try {
    const savedGoals = await window.petodo.saveCountdownGoals(state.countdownList);
    state.countdownList = Array.isArray(savedGoals) ? savedGoals : state.countdownList;
    localStorage.setItem(getAccountDataKey(COUNTDOWN_STORAGE_KEY), JSON.stringify(state.countdownList));
  } catch (error) {
    console.warn('Failed to save countdown goals to desktop storage:', error);
  }

  return state.countdownList;
}

function saveDailyTaskEasterEggSetting() {
  if (!state.userProfile.accountId) {
    return;
  }
  localStorage.setItem(getAccountDataKey(DAILY_TASK_EASTER_EGG_SETTING_KEY), String(state.dailyTaskEasterEggEnabled));
}

function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function createCountdownId() {
  return `countdown-${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

function getCurrentTask() {
  return state.todoList.find((task) => task.id === state.currentTaskId && !task.completed) || null;
}

function getCurrentTaskName() {
  return getCurrentTask()?.name || EMPTY_TASK_LABEL;
}

function getFocusRecordKey(record = {}) {
  if (!record.focus_id || !record.completed_at) {
    return '';
  }

  return `${record.focus_id}:${record.completed_at}`;
}

function addFocusRecordToTask(task, record) {
  const recordKey = getFocusRecordKey(record);
  if (!recordKey || task.completedFocusRecordKeys.includes(recordKey)) {
    return false;
  }

  task.completedFocusRecordKeys.push(recordKey);
  task.completedPomodoros += 1;
  return true;
}

function syncTaskFocusProgress() {
  let changed = false;
  const tasksById = new Map(state.todoList.map((task) => [task.id, task]));

  state.focusRecords.forEach((record) => {
    const task = record.task_id ? tasksById.get(String(record.task_id)) : null;
    if (task) {
      changed = addFocusRecordToTask(task, record) || changed;
    }
  });

  const backfillKey = getAccountDataKey(INITIAL_TASK_FOCUS_BACKFILL_STORAGE_KEY);
  if (!localStorage.getItem(backfillKey)) {
    const reportTask = getCurrentTask();
    if (reportTask?.name === '数电实验报告') {
      state.focusRecords
        .filter((record) => !record.task_id && record.completed_date === '2026-05-26')
        .forEach((record) => {
          changed = addFocusRecordToTask(reportTask, record) || changed;
        });
      localStorage.setItem(backfillKey, 'true');
    }
  }

  if (changed) {
    saveTodoState();
  }
}

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatDuration(totalSeconds) {
  const safeSeconds = Math.max(0, Number(totalSeconds) || 0);
  const totalMinutes = Math.round(safeSeconds / 60);
  const hours = Math.floor(totalMinutes / 60);
  const minutes = totalMinutes % 60;

  if (hours > 0 && minutes > 0) {
    return `${hours}h ${minutes}m`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  return `${totalMinutes} min`;
}

function showToast(message) {
  toast.textContent = message;
  toast.classList.add('is-visible');
  window.clearTimeout(showToast.hideTimer);
  showToast.hideTimer = window.setTimeout(() => {
    toast.classList.remove('is-visible');
  }, 1800);
}

function setCompletionContinueBusy(isBusy) {
  completionContinueBusy = isBusy;
  if (completionContinueButton) {
    completionContinueButton.disabled = isBusy;
    completionContinueButton.textContent = isBusy ? '正在开始...' : '继续专注';
  }
}

function hideCompletionDialog() {
  if (!completionDialog) {
    return;
  }

  completionDialog.classList.remove('is-visible');
  window.clearTimeout(hideCompletionDialog.hideTimer);
  hideCompletionDialog.hideTimer = window.setTimeout(() => {
    completionDialog.hidden = true;
  }, 180);
}

function showCompletionDialog() {
  if (!completionDialog) {
    return;
  }

  setCompletionContinueBusy(false);
  window.clearTimeout(showCompletionDialog.autoHideTimer);
  window.clearTimeout(hideCompletionDialog.hideTimer);
  completionDialog.hidden = false;
  completionDialog.classList.remove('is-visible');
  void completionDialog.offsetWidth;
  completionDialog.classList.add('is-visible');
  showCompletionDialog.autoHideTimer = window.setTimeout(hideCompletionDialog, COMPLETION_DIALOG_AUTO_HIDE_MS);
}

function hideDailyTaskEasterEggDialog() {
  if (!dailyTaskEasterEggDialog) {
    return;
  }

  dailyTaskEasterEggDialog.classList.remove('is-visible');
  window.clearTimeout(hideDailyTaskEasterEggDialog.hideTimer);
  hideDailyTaskEasterEggDialog.hideTimer = window.setTimeout(() => {
    if (dailyTaskEasterEggImage) {
      dailyTaskEasterEggImage.removeAttribute('src');
    }
    dailyTaskEasterEggDialog.hidden = true;
  }, 180);
}

function showDailyTaskEasterEggDialog() {
  if (!dailyTaskEasterEggDialog || !dailyTaskEasterEggImage) {
    return;
  }

  window.clearTimeout(hideDailyTaskEasterEggDialog.hideTimer);
  dailyTaskEasterEggDialog.hidden = false;
  dailyTaskEasterEggDialog.classList.remove('is-visible');
  dailyTaskEasterEggImage.src = `assets/ui/rewards/luoxiaohei-task-complete-fish.webp?restart=${Date.now()}`;
  void dailyTaskEasterEggDialog.offsetWidth;
  dailyTaskEasterEggDialog.classList.add('is-visible');
}

function resetCountdownForm() {
  countdownForm.reset();
}

function hideCountdownModal() {
  if (!countdownModal) {
    return;
  }

  countdownModal.classList.remove('is-visible');
  window.clearTimeout(hideCountdownModal.hideTimer);
  hideCountdownModal.hideTimer = window.setTimeout(() => {
    countdownModal.hidden = true;
  }, 180);
}

function showCountdownModal() {
  if (!countdownModal) {
    return;
  }

  window.clearTimeout(hideCountdownModal.hideTimer);
  countdownModal.hidden = false;
  countdownModal.classList.remove('is-visible');
  void countdownModal.offsetWidth;
  countdownModal.classList.add('is-visible');
  countdownNameInput.focus();
}

function getCompletedFocusKey(timerStatus = {}) {
  if (!timerStatus.last_completed_focus_id || !timerStatus.last_completed_focus_completed_at) {
    return '';
  }

  return `${timerStatus.last_completed_focus_id}:${timerStatus.last_completed_focus_completed_at}`;
}

function handleFocusCompletion(timerStatus = {}) {
  const completedKey = getCompletedFocusKey(timerStatus);

  if (!state.hasLoadedAppStatus) {
    state.lastCompletedFocusKey = completedKey;
    return;
  }

  if (!completedKey || completedKey === state.lastCompletedFocusKey) {
    return;
  }

  state.lastCompletedFocusKey = completedKey;
  showCompletionDialog();
}

function setPage(pageName) {
  state.page = pageName;
  document.body.classList.toggle('is-journal-page', pageName === 'journal');
  document.body.classList.toggle('is-full-page', ['journal', 'settings'].includes(pageName));

  navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.page === pageName);
  });

  pages.forEach((page) => {
    page.classList.toggle('is-active', page.dataset.pagePanel === pageName);
  });
}

function syncMainWindowAuthLayout(isLoggedIn) {
  if (lastSyncedAuthLayout === isLoggedIn) {
    return;
  }

  lastSyncedAuthLayout = isLoggedIn;
  const setAuthLayout = window.petodo?.setMainWindowAuthLayout;

  if (typeof setAuthLayout !== 'function') {
    return;
  }

  setAuthLayout(isLoggedIn).catch(() => {
    lastSyncedAuthLayout = null;
  });
}

function getActiveAccountId() {
  return state.userProfile.isLoggedIn && state.userProfile.accountId
    ? state.userProfile.accountId
    : '';
}

async function syncCurrentAccountId(options = {}) {
  const accountId = getActiveAccountId();
  if (options.force !== true && lastSyncedAccountId === accountId) {
    return accountId;
  }

  lastSyncedAccountId = accountId;
  const setCurrentAccountId = window.petodo?.setCurrentAccountId;

  if (typeof setCurrentAccountId !== 'function') {
    return accountId;
  }

  try {
    return await setCurrentAccountId(accountId);
  } catch (error) {
    lastSyncedAccountId = null;
    console.warn('Failed to sync current account for pet window:', error);
    return accountId;
  }
}

function renderProfile() {
  const isLoggedIn = Boolean(state.userProfile.isLoggedIn);
  const name = getProfileName();
  document.documentElement.classList.toggle('is-authenticated', isLoggedIn);
  document.body.classList.toggle('is-authenticated', isLoggedIn);
  loginScreen.hidden = isLoggedIn;
  syncMainWindowAuthLayout(isLoggedIn);
  syncCurrentAccountId();

  document.querySelector('#homeTitle').textContent = `Hi，${name}！`;

  if (userGreetingText) {
    userGreetingText.textContent = `Hi, ${name}!`;
  }

  if (profileNameInput && document.activeElement !== profileNameInput) {
    profileNameInput.value = state.userProfile.name || '';
  }

  if (loginAccountInput && !isLoggedIn && document.activeElement !== loginAccountInput) {
    loginAccountInput.value = state.userProfile.accountName || '';
  }

  if (loginPasswordInput && !isLoggedIn && document.activeElement !== loginPasswordInput) {
    loginPasswordInput.value = '';
  }

  const initial = getProfileInitial();
  avatarFallbacks.forEach((element) => {
    element.textContent = initial;
    element.hidden = Boolean(state.userProfile.avatar);
  });

  avatarImages.forEach((image) => {
    image.hidden = !state.userProfile.avatar;
    if (state.userProfile.avatar) {
      image.src = state.userProfile.avatar;
    } else {
      image.removeAttribute('src');
    }
  });
}

async function loadAccountSessionData() {
  state.todoList = loadTodoList();
  state.currentTaskId = loadCurrentTaskId();
  state.todoListDate = loadTodoListDate();
  state.countdownList = loadCountdownList();
  state.dailyTaskEasterEggEnabled = loadDailyTaskEasterEggSetting();

  await loadTodoState();
  await loadCountdownState();

  if (state.currentTaskId && !getCurrentTask()) {
    state.currentTaskId = '';
    saveTodoState();
  }
}

function resetSessionData() {
  stopTimer();
  state.remainingSeconds = FOCUS_SECONDS;
  state.timerMode = 'idle';
  state.phase = 'Focus Session';
  state.isRunning = false;
  state.completedToday = 0;
  state.totalFocusSeconds = 0;
  state.focusRecords = [];
  state.todoList = [];
  state.countdownList = [];
  state.currentTaskId = '';
  state.todoListDate = '';
  state.petState = DEFAULT_IDLE_STATE;
  state.petReason = '';
  state.hunger = 80;
  state.mood = '平静';
  state.points = 0;
  state.hasLoadedAppStatus = false;
  state.lastCompletedFocusKey = '';
  state.zeroRefreshRequested = false;
}

async function applyAuthenticatedAccount(account) {
  const savedProfile = loadAccountProfile(account.account_id);
  state.userProfile = {
    isLoggedIn: true,
    accountId: account.account_id,
    accountName: account.account_name,
    name: savedProfile.name || account.display_name || account.account_name,
    avatar: savedProfile.avatar || ''
  };
  saveUserProfile();
  await syncCurrentAccountId({ force: true });
  await loadAccountSessionData();
  setPage('home');
  renderProfile();
  render();
  await refreshAppStatus();
  checkTodoRollover();
}

async function authenticateUser(endpoint, successMessage) {
  const account = loginAccountInput.value.trim();
  const password = loginPasswordInput.value;

  if (!account) {
    showToast('请先输入账号');
    loginAccountInput.focus();
    return;
  }

  if (!password) {
    showToast('请先输入密码');
    loginPasswordInput.focus();
    return;
  }

  try {
    const accountProfile = await requestBackend(endpoint, {
      method: 'POST',
      body: JSON.stringify({
        account,
        password,
        display_name: account
      }),
      skipAuth: true
    });
    await applyAuthenticatedAccount(accountProfile);
    loginPasswordInput.value = '';
    showToast(successMessage(accountProfile));
  } catch (error) {
    showToast(error.message || '账号验证失败');
  }
}

function loginUser(event) {
  event.preventDefault();
  authenticateUser('/auth/login', (account) => `欢迎回来，${account.display_name}`);
}

function registerUser() {
  authenticateUser('/auth/register', (account) => `已创建账号，${account.display_name}`);
}

async function saveProfileFromSettings() {
  const name = profileNameInput.value.trim();

  if (!name) {
    showToast('昵称不能为空');
    profileNameInput.focus();
    return;
  }

  state.userProfile = {
    ...state.userProfile,
    isLoggedIn: true,
    name
  };
  saveUserProfile();
  renderProfile();

  try {
    const updated = await requestBackend('/auth/profile', {
      method: 'POST',
      body: JSON.stringify({ display_name: name })
    });
    state.userProfile = {
      ...state.userProfile,
      accountName: updated.account_name,
      name: updated.display_name
    };
    saveUserProfile();
    renderProfile();
    showToast('个人资料已保存');
  } catch (error) {
    showToast(error.message || '个人资料已保存在本地');
  }
}

function logoutUser() {
  saveUserProfile();
  state.userProfile = {
    ...state.userProfile,
    isLoggedIn: false
  };
  saveUserProfile();
  syncCurrentAccountId({ force: true });
  resetSessionData();
  setPage('home');
  renderProfile();
  render();
}

function chooseAvatar() {
  profileAvatarInput?.click();
}

function updateAvatarFromFile(event) {
  const file = event.target.files?.[0];
  if (!file) {
    return;
  }

  if (!file.type.startsWith('image/')) {
    showToast('请选择图片文件');
    event.target.value = '';
    return;
  }

  const reader = new FileReader();
  reader.addEventListener('load', () => {
    state.userProfile = {
      ...state.userProfile,
      isLoggedIn: true,
      avatar: String(reader.result || '')
    };
    saveUserProfile();
    renderProfile();
    showToast('头像已更新');
  });
  reader.readAsDataURL(file);
}

function updateTimerView() {
  const formattedTime = formatTime(state.remainingSeconds);
  const completedText = `今日已完成 ${state.completedToday} 次专注`;
  const currentTaskName = getCurrentTaskName();

  timeDisplays.forEach((element) => {
    element.textContent = formattedTime;
  });

  phaseDisplays.forEach((element) => {
    element.textContent = state.phase;
  });

  completedDisplays.forEach((element) => {
    element.textContent = completedText;
  });

  taskDisplays.forEach((element) => {
    element.textContent = currentTaskName;
  });

  const journalTodayText = document.querySelector('#journalTodayText');
  if (journalTodayText) {
    journalTodayText.textContent = String(state.completedToday);
  }
}

function getHungerGuidance() {
  if (state.petState === 'angry') {
    const waitedTooLong = state.petReason.includes('持续太久');
    return {
      tone: 'danger',
      title: waitedTooLong ? '太久没有投喂，小黑生气了' : '饱食度太低，小黑生气了',
      text: '请尽快投喂，或到补给商店兑换食物。',
      showShop: true
    };
  }

  if (state.petState === 'hungry_heavy') {
    return {
      tone: 'warning',
      title: '很饿，建议尽快投喂',
      text: '继续挨饿会让小黑生气。',
      showShop: true
    };
  }

  if (state.petState === 'hungry') {
    return {
      tone: 'watch',
      title: '有点饿了，喂点东西吧',
      text: '可以直接投喂，也可以去补给商店。',
      showShop: true
    };
  }

  return {
    tone: 'calm',
    title: '状态良好',
    text: '小黑现在不需要补给。',
    showShop: false
  };
}

function resolveRestDisplayState() {
  if (state.breakType === 'long') {
    return state.breakElapsedSeconds >= LONG_REST_SECOND_STAGE_SECONDS
      ? 'rest_long_after_5'
      : 'rest_long_start';
  }

  return state.breakElapsedSeconds >= SHORT_REST_SECOND_STAGE_SECONDS
    ? 'rest_2'
    : 'rest_1';
}

function getDisplayPetState() {
  if (state.petState === 'rest' && state.timerMode === 'break') {
    return resolveRestDisplayState();
  }

  return state.petState;
}

function updateCompanionView() {
  const displayPetState = getDisplayPetState();
  const message = state.petReason || PET_MESSAGES[displayPetState] || PET_MESSAGES[DEFAULT_IDLE_STATE];
  const petText = PET_STATE_TEXT[displayPetState] || PET_STATE_TEXT[DEFAULT_IDLE_STATE];
  const guidance = getHungerGuidance();

  document.querySelector('#homeMessageText').textContent = message;
  document.querySelector('#companionMessageText').textContent = message;
  document.querySelector('#companionStateText').textContent = petText;
  hungerText.textContent = `${state.hunger}%`;
  document.querySelector('#moodText').textContent = state.mood;
  document.querySelector('#pointsText').textContent = String(state.points);
  const journalPointsText = document.querySelector('#journalPointsText');
  if (journalPointsText) {
    journalPointsText.textContent = String(state.points);
  }
  companionImage.src = PET_IMAGES[displayPetState] || PET_IMAGES[DEFAULT_IDLE_STATE];
  companionCard.dataset.hungerTone = guidance.tone;
  hungerGuidance.dataset.tone = guidance.tone;
  hungerGuidanceTitle.textContent = guidance.title;
  hungerGuidanceText.textContent = guidance.text;
  openShopButton.hidden = !guidance.showShop;
}

function formatMood(value) {
  if (typeof value !== 'number') {
    return value || '平静';
  }

  if (value >= 80) {
    return '开心';
  }

  if (value >= 40) {
    return '平静';
  }

  return '低落';
}

function applyPetStatus(petStatus = {}) {
  if (petStatus.state) {
    state.petState = petStatus.state === 'idle' ? DEFAULT_IDLE_STATE : petStatus.state;
  }

  state.petReason = typeof petStatus.reason === 'string' ? petStatus.reason : '';

  if (Number.isFinite(petStatus.hunger)) {
    state.hunger = petStatus.hunger;
  }

  if (Number.isFinite(petStatus.mood)) {
    state.mood = formatMood(petStatus.mood);
  }
}

function applyAppStatus(data = {}) {
  const petStatus = data.pet || {};
  const timerStatus = data.timer || {};
  const focusStats = data.focus_stats || {};
  handleFocusCompletion(timerStatus);
  applyPetStatus(petStatus);

  if (Number.isFinite(data.today_completed_count)) {
    state.completedToday = data.today_completed_count;
  }

  if (Number.isFinite(data.points)) {
    state.points = data.points;
  }

  if (Number.isFinite(focusStats.total_focus_seconds)) {
    state.totalFocusSeconds = focusStats.total_focus_seconds;
  }

  if (Array.isArray(focusStats.records)) {
    state.focusRecords = focusStats.records;
    syncTaskFocusProgress();
  }

  if (Number.isFinite(data.remaining_seconds)) {
    state.remainingSeconds = data.remaining_seconds;
  } else if (Number.isFinite(timerStatus.remaining_seconds)) {
    state.remainingSeconds = timerStatus.remaining_seconds;
  }

  if (timerStatus.mode === 'focus') {
    state.phase = 'Focus Session';
  } else if (timerStatus.mode === 'break') {
    state.phase = timerStatus.break_type === 'long' ? 'Long Break' : 'Break Time';
  } else if (timerStatus.mode === 'paused') {
    state.phase = 'Paused';
  } else if (timerStatus.mode === 'idle') {
    state.phase = 'Focus Session';
  }

  if (typeof timerStatus.is_running === 'boolean') {
    state.isRunning = timerStatus.is_running;
  }

  state.timerMode = timerStatus.mode || state.timerMode;
  if (timerStatus.mode === 'break') {
    state.breakType = timerStatus.break_type || null;
    if (Number.isFinite(timerStatus.break_elapsed_seconds)) {
      state.breakElapsedSeconds = Math.max(0, timerStatus.break_elapsed_seconds);
    } else if (Number.isFinite(timerStatus.break_seconds) && Number.isFinite(timerStatus.remaining_seconds)) {
      state.breakElapsedSeconds = Math.max(0, timerStatus.break_seconds - timerStatus.remaining_seconds);
    }
  } else if (timerStatus.mode && timerStatus.mode !== 'paused') {
    state.breakType = null;
    state.breakElapsedSeconds = 0;
  }
  syncLocalTimerSnapshot(timerStatus);
  state.hasLoadedAppStatus = true;
  maybeShowPendingTodoRollover();
}

async function requestBackend(path, options = {}) {
  const { skipAuth = false, ...fetchOptions } = options;
  const requestUrl = buildBackendUrl(path);
  const headers = {
    'Content-Type': 'application/json',
    ...(fetchOptions.headers || {})
  };

  if (!skipAuth && state.userProfile.isLoggedIn && state.userProfile.accountId && !headers['X-Petodo-Account']) {
    headers['X-Petodo-Account'] = state.userProfile.accountId;
  }

  let response;
  try {
    response = await fetch(requestUrl, {
      headers,
      ...fetchOptions
    });
  } catch (error) {
    console.warn('Backend request failed:', requestUrl, error);
    throw error;
  }

  if (!response.ok) {
    let message = '请求失败';
    try {
      const errorBody = await response.json();
      message = errorBody.detail || message;
    } catch {}
    console.warn('Backend request returned error:', requestUrl, response.status);
    throw new Error(message);
  }

  return response.json();
}

function buildBackendUrl(path) {
  return `${API_BASE_URL}${path.startsWith('/') ? path : `/${path}`}`;
}

async function checkBackendHealth() {
  return requestBackend('/health', { skipAuth: true });
}

async function refreshAppStatus({ silent = true } = {}) {
  if (!state.userProfile.isLoggedIn || !state.userProfile.accountId) {
    return null;
  }

  try {
    const data = await requestBackend('/app/status');
    applyAppStatus(data);
    render();
    return data;
  } catch (error) {
    if (!silent) {
      showToast('后端还没有启动，暂时无法同步桌宠状态');
    }
    return null;
  }
}

function syncLocalTimerSnapshot(timerStatus = {}) {
  if (!Number.isFinite(timerStatus.remaining_seconds)) {
    stopTimer();
    return;
  }

  state.timerSnapshotRemainingSeconds = timerStatus.remaining_seconds;
  state.timerSnapshotClientTime = Date.now();
  state.zeroRefreshRequested = false;

  if (timerStatus.is_running) {
    startLocalTimer();
    return;
  }

  stopTimer();
}

function getLocalRemainingSeconds() {
  if (!state.isRunning || !['focus', 'break'].includes(state.timerMode)) {
    return state.remainingSeconds;
  }

  const elapsedSeconds = Math.max(0, (Date.now() - state.timerSnapshotClientTime) / 1000);
  return Math.max(0, Math.ceil(state.timerSnapshotRemainingSeconds - elapsedSeconds));
}

function tickLocalTimer() {
  const nextRemainingSeconds = getLocalRemainingSeconds();

  if (nextRemainingSeconds !== state.remainingSeconds) {
    state.remainingSeconds = nextRemainingSeconds;
    updateTimerView();
  }

  if (nextRemainingSeconds <= 0 && state.isRunning && !state.zeroRefreshRequested) {
    state.zeroRefreshRequested = true;
    refreshAppStatus();
  }
}

function updateTodoStats() {
  const total = state.todoList.length;
  const done = state.todoList.filter((task) => task.completed).length;

  document.querySelector('#todoTotalText').textContent = String(total);
  document.querySelector('#todoDoneText').textContent = String(done);
  document.querySelector('#todoListSummary').textContent = `${total} ${total === 1 ? 'task' : 'tasks'}`;
}

function areAllTodoTasksCompleted() {
  return state.todoList.length > 0 && state.todoList.every((task) => task.completed);
}

function maybeShowDailyTaskEasterEgg(wasAllCompleted) {
  if (
    !wasAllCompleted &&
    state.dailyTaskEasterEggEnabled &&
    areAllTodoTasksCompleted()
  ) {
    showDailyTaskEasterEggDialog();
  }
}

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getTodayKey() {
  return toDateKey(new Date());
}

function getDateKeyTimestamp(dateKey) {
  const [year, month, day] = dateKey.split('-').map(Number);
  return Date.UTC(year, month - 1, day);
}

function getCountdownStatus(targetDate) {
  const todayKey = getTodayKey();

  if (targetDate === todayKey) {
    return {
      text: '就是今天，加油！',
      tone: 'today',
      metricLabel: '就是',
      metricValue: '今天',
      metricSuffix: '',
      isCompleted: false
    };
  }

  if (targetDate < todayKey) {
    const elapsedDays = Math.round((getDateKeyTimestamp(todayKey) - getDateKeyTimestamp(targetDate)) / MS_PER_DAY);
    return {
      text: `已过去 ${elapsedDays} 天`,
      tone: 'completed',
      metricLabel: '已过去',
      metricValue: String(elapsedDays),
      metricSuffix: '天',
      isCompleted: true
    };
  }

  const remainingDays = Math.round((getDateKeyTimestamp(targetDate) - getDateKeyTimestamp(todayKey)) / MS_PER_DAY);
  return {
    text: `还有 ${remainingDays} 天`,
    tone: 'upcoming',
    metricLabel: '还有',
    metricValue: String(remainingDays),
    metricSuffix: '天',
    isCompleted: false
  };
}

function getTodoRolloverCounts() {
  const unfinished = state.todoList.filter((task) => !task.completed).length;

  return {
    unfinished,
    completed: state.todoList.length - unfinished
  };
}

function shouldDeferTodoRollover() {
  return state.isRunning && state.timerMode === 'focus';
}

function hideTodoRolloverDialog() {
  if (!todoRolloverDialog) {
    return;
  }

  todoRolloverDialog.classList.remove('is-visible');
  window.clearTimeout(hideTodoRolloverDialog.hideTimer);
  hideTodoRolloverDialog.hideTimer = window.setTimeout(() => {
    todoRolloverDialog.hidden = true;
  }, 180);
}

function showTodoRolloverDialog() {
  if (!todoRolloverDialog || !state.pendingTodoRollover) {
    return;
  }

  if (!todoRolloverDialog.hidden && todoRolloverDialog.classList.contains('is-visible')) {
    return;
  }

  const { unfinished, completed } = getTodoRolloverCounts();
  if (todoRolloverSummary) {
    todoRolloverSummary.textContent = completed > 0
      ? `昨天还有 ${unfinished} 个未完成待办，${completed} 个已完成待办会自动清掉。要延续未完成待办到今天吗？`
      : `昨天还有 ${unfinished} 个未完成待办，要延续到今天吗？`;
  }

  window.clearTimeout(hideTodoRolloverDialog.hideTimer);
  todoRolloverDialog.hidden = false;
  todoRolloverDialog.classList.remove('is-visible');
  void todoRolloverDialog.offsetWidth;
  todoRolloverDialog.classList.add('is-visible');
}

function maybeShowPendingTodoRollover() {
  if (state.pendingTodoRollover && !shouldDeferTodoRollover()) {
    showTodoRolloverDialog();
  }
}

function checkTodoRollover() {
  if (!state.userProfile.isLoggedIn || !state.userProfile.accountId) {
    return;
  }

  const today = getTodayKey();

  if (!state.todoListDate) {
    state.todoListDate = today;
    saveTodoState();
    return;
  }

  if (state.todoListDate === today) {
    state.pendingTodoRollover = false;
    return;
  }

  if (state.todoList.length === 0) {
    state.currentTaskId = '';
    state.todoListDate = today;
    state.pendingTodoRollover = false;
    saveTodoState();
    renderTodoView();
    updateTimerView();
    return;
  }

  state.pendingTodoRollover = true;
  maybeShowPendingTodoRollover();
}

function carryOverTodoTasksToToday() {
  const unfinishedTasks = state.todoList.filter((task) => !task.completed);

  state.todoList = unfinishedTasks;
  if (!state.todoList.some((task) => task.id === state.currentTaskId)) {
    state.currentTaskId = '';
  }

  state.todoListDate = getTodayKey();
  state.pendingTodoRollover = false;
  saveTodoState();
  hideTodoRolloverDialog();
  render();
  showToast(`已延续 ${unfinishedTasks.length} 个未完成待办`);
}

function clearTodoTasksForToday() {
  state.todoList = [];
  state.currentTaskId = '';
  state.todoListDate = getTodayKey();
  state.pendingTodoRollover = false;
  saveTodoState();
  hideTodoRolloverDialog();
  render();
  showToast('已清空今日待办');
}

function addDays(date, amount) {
  const next = new Date(date);
  next.setDate(next.getDate() + amount);
  return next;
}

function addMonths(date, amount) {
  const next = new Date(date);
  next.setMonth(next.getMonth() + amount);
  return next;
}

function addYears(date, amount) {
  const next = new Date(date);
  next.setFullYear(next.getFullYear() + amount);
  return next;
}

function startOfDay(date) {
  return new Date(date.getFullYear(), date.getMonth(), date.getDate());
}

function startOfWeek(date) {
  const start = startOfDay(date);
  const day = start.getDay();
  const mondayOffset = day === 0 ? -6 : 1 - day;
  return addDays(start, mondayOffset);
}

function startOfMonth(date) {
  return new Date(date.getFullYear(), date.getMonth(), 1);
}

function startOfYear(date) {
  return new Date(date.getFullYear(), 0, 1);
}

function getRecordsByDate() {
  return state.focusRecords.reduce((map, record) => {
    const key = record.completed_date;
    if (!key) {
      return map;
    }

    map[key] = (map[key] || 0) + (Number(record.focus_seconds) || 0);
    return map;
  }, {});
}

function buildRecentSevenDays() {
  const recordsByDate = getRecordsByDate();
  const today = new Date();
  const days = [];

  for (let index = 6; index >= 0; index -= 1) {
    const date = addDays(today, -index);
    const key = toDateKey(date);
    const seconds = recordsByDate[key] || 0;
    days.push({
      key,
      label: date.toLocaleDateString('en-US', { weekday: 'short' }),
      seconds,
      minutes: Math.round(seconds / 60)
    });
  }

  return days;
}

function calculateStudyStreak() {
  const recordsByDate = getRecordsByDate();
  let streak = 0;
  let cursor = new Date();

  while (recordsByDate[toDateKey(cursor)] > 0) {
    streak += 1;
    cursor = addDays(cursor, -1);
  }

  return streak;
}

function getRecordCompletedDate(record) {
  const completedAt = Number(record.completed_at);
  if (Number.isFinite(completedAt)) {
    return new Date(completedAt * 1000);
  }

  if (record.completed_date) {
    return new Date(`${record.completed_date}T12:00:00`);
  }

  return null;
}

function getJournalPeriod() {
  const cursor = state.journalCursorDate;

  if (state.journalView === 'week') {
    const start = startOfWeek(cursor);
    const end = addDays(start, 7);
    return {
      start,
      end,
      title: `${start.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })} - ${addDays(end, -1).toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}`,
      scope: '按周'
    };
  }

  if (state.journalView === 'month') {
    const start = startOfMonth(cursor);
    const end = addMonths(start, 1);
    return {
      start,
      end,
      title: start.toLocaleDateString('zh-CN', { year: 'numeric', month: 'long' }),
      scope: '按月'
    };
  }

  if (state.journalView === 'year') {
    const start = startOfYear(cursor);
    const end = addYears(start, 1);
    return {
      start,
      end,
      title: `${start.getFullYear()}年`,
      scope: '按年'
    };
  }

  const start = startOfDay(cursor);
  const end = addDays(start, 1);
  return {
    start,
    end,
    title: start.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' }),
    scope: '按天'
  };
}

function getJournalPeriodRecords(period = getJournalPeriod()) {
  return state.focusRecords
    .map((record) => ({
      ...record,
      completedDate: getRecordCompletedDate(record)
    }))
    .filter((record) => (
      record.completedDate &&
      record.completedDate >= period.start &&
      record.completedDate < period.end
    ))
    .sort((a, b) => Number(a.completed_at || 0) - Number(b.completed_at || 0));
}

function sumFocusSeconds(records) {
  return records.reduce((total, record) => total + (Number(record.focus_seconds) || 0), 0);
}

function formatClockTime(date) {
  if (!date) {
    return '--:--';
  }

  return date.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });
}

function buildJournalBuckets(period, records) {
  if (state.journalView === 'week') {
    return Array.from({ length: 7 }, (_, index) => {
      const start = addDays(period.start, index);
      const end = addDays(start, 1);
      return {
        label: start.toLocaleDateString('zh-CN', { weekday: 'short' }).replace('周', ''),
        seconds: sumFocusSeconds(records.filter((record) => record.completedDate >= start && record.completedDate < end))
      };
    });
  }

  if (state.journalView === 'month') {
    const dayCount = Math.round((period.end - period.start) / MS_PER_DAY);
    return Array.from({ length: dayCount }, (_, index) => {
      const start = addDays(period.start, index);
      const end = addDays(start, 1);
      return {
        label: String(index + 1),
        seconds: sumFocusSeconds(records.filter((record) => record.completedDate >= start && record.completedDate < end))
      };
    });
  }

  if (state.journalView === 'year') {
    return Array.from({ length: 12 }, (_, index) => {
      const start = new Date(period.start.getFullYear(), index, 1);
      const end = addMonths(start, 1);
      return {
        label: `${index + 1}月`,
        seconds: sumFocusSeconds(records.filter((record) => record.completedDate >= start && record.completedDate < end))
      };
    });
  }

  return Array.from({ length: 24 }, (_, hour) => {
    const start = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate(), hour);
    const end = new Date(period.start.getFullYear(), period.start.getMonth(), period.start.getDate(), hour + 1);
    return {
      label: String(hour).padStart(2, '0'),
      seconds: sumFocusSeconds(records.filter((record) => record.completedDate >= start && record.completedDate < end))
    };
  });
}

function formatRecordTime(record) {
  const completedAt = Number(record.completed_at);
  if (!Number.isFinite(completedAt)) {
    return record.completed_date || '未知时间';
  }

  const completedDate = new Date(completedAt * 1000);
  const todayKey = toDateKey(new Date());
  const yesterdayKey = toDateKey(addDays(new Date(), -1));
  const recordKey = toDateKey(completedDate);
  const timeText = completedDate.toLocaleTimeString('zh-CN', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (recordKey === todayKey) {
    return `今天 ${timeText}`;
  }

  if (recordKey === yesterdayKey) {
    return `昨天 ${timeText}`;
  }

  return `${recordKey} ${timeText}`;
}

function recordsForDate(records, date) {
  const key = toDateKey(date);
  return records.filter((record) => toDateKey(record.completedDate) === key);
}

function countStudyDays(records) {
  return new Set(records.map((record) => toDateKey(record.completedDate))).size;
}

function calculateLongestStreak(records) {
  const keys = [...new Set(records.map((record) => toDateKey(record.completedDate)))].sort();
  let longest = 0;
  let current = 0;
  let previous = null;

  keys.forEach((key) => {
    const date = new Date(`${key}T12:00:00`);
    if (previous && (date - previous) === MS_PER_DAY) {
      current += 1;
    } else {
      current = 1;
    }

    longest = Math.max(longest, current);
    previous = date;
  });

  return longest;
}

function renderJournalMetricCards(items) {
  return `
    <div class="journal-metric-grid">
      ${items.map((item) => `
        <article class="journal-metric-card">
          <span>${escapeHtml(item.label)}</span>
          <strong>${escapeHtml(item.value)}</strong>
          ${item.note ? `<em>${escapeHtml(item.note)}</em>` : ''}
        </article>
      `).join('')}
    </div>
  `;
}

function renderJournalTimeline(records, emptyText) {
  if (records.length === 0) {
    return `<div class="empty-state journal-empty-block"><p>${escapeHtml(emptyText)}</p></div>`;
  }

  return `
    <div class="journal-timeline">
      ${records.map((record, index) => `
        <article class="journal-timeline-item">
          <span class="journal-timeline-dot" aria-hidden="true"></span>
          <div>
            <strong>${formatClockTime(record.completedDate)}</strong>
            <p>完成第 ${index + 1} 个番茄 · ${formatDuration(record.focus_seconds)}</p>
          </div>
        </article>
      `).join('')}
    </div>
  `;
}

function getBestBucket(buckets, fallbackLabel = '--') {
  const best = buckets.reduce((currentBest, bucket) => (
    bucket.seconds > currentBest.seconds ? bucket : currentBest
  ), { label: fallbackLabel, seconds: 0 });
  return best.seconds > 0 ? best : { label: fallbackLabel, seconds: 0 };
}

function renderDayReview(period, records) {
  const totalSeconds = sumFocusSeconds(records);
  const firstRecord = records[0];
  const earnedPoints = records.length * 20;

  return `
    <section class="journal-mode journal-day-review">
      <div class="journal-mode-heading">
        <div>
          <p class="eyebrow">Daily Review</p>
          <h2>今日复盘</h2>
        </div>
        <span>${period.title}</span>
      </div>

      ${renderJournalMetricCards([
        { label: '今日专注总时长', value: formatDuration(totalSeconds), note: records.length ? '今天已留下记录' : '还没有开始' },
        { label: '开始时间', value: formatClockTime(firstRecord?.completedDate), note: '第一段完成时间' },
        { label: '完成次数', value: `${records.length} 次`, note: '完成番茄' },
        { label: '打断次数', value: `${Math.max(0, records.length - 1)} 次`, note: '按间隔估算' }
      ])}

      <div class="journal-split">
        <section class="journal-card journal-timeline-card">
          <div class="section-title">
            <h2>今日时间线</h2>
            <span>${records.length} records</span>
          </div>
          ${renderJournalTimeline(records, '今天还没有完成专注。')}
        </section>

        <section class="journal-card journal-achievement-card">
          <div class="section-title">
            <h2>今日成就</h2>
            <span>Daily Wins</span>
          </div>
          <div class="journal-achievement-list">
            <article>
              <strong>${records.length}</strong>
              <span>完成番茄</span>
            </article>
            <article>
              <strong>${earnedPoints}</strong>
              <span>获得积分</span>
            </article>
            <article>
              <strong>${calculateStudyStreak()}</strong>
              <span>连续学习天数</span>
            </article>
          </div>
        </section>
      </div>
    </section>
  `;
}

function renderWeekRhythm(period, records, buckets) {
  const totalSeconds = sumFocusSeconds(records);
  const bestDay = getBestBucket(buckets);
  const maxSeconds = Math.max(1, ...buckets.map((bucket) => bucket.seconds));
  const activeDays = buckets.filter((bucket) => bucket.seconds > 0).length;

  return `
    <section class="journal-mode journal-week-rhythm">
      <div class="journal-mode-heading">
        <div>
          <p class="eyebrow">Weekly Rhythm</p>
          <h2>一周节奏</h2>
        </div>
        <span>${period.title}</span>
      </div>

      ${renderJournalMetricCards([
        { label: '本周总时长', value: formatDuration(totalSeconds), note: `${activeDays} 天有记录` },
        { label: '完成次数', value: `${records.length} 次`, note: '本周完成番茄' },
        { label: '最佳学习日', value: bestDay.label, note: bestDay.seconds ? formatDuration(bestDay.seconds) : '暂无记录' },
        { label: '连续学习天数', value: `${calculateStudyStreak()} 天`, note: '截至今天' }
      ])}

      <div class="journal-split">
        <section class="journal-card journal-week-card">
          <div class="section-title">
            <h2>周一到周日</h2>
            <span>学习分布</span>
          </div>
          <div class="journal-week-bars">
            ${buckets.map((bucket) => {
              const width = Math.max(6, Math.round((bucket.seconds / maxSeconds) * 100));
              return `
                <article>
                  <strong>${bucket.label}</strong>
                  <div class="journal-week-track">
                    <span style="width: ${bucket.seconds > 0 ? width : 0}%"></span>
                  </div>
                  <em>${formatDuration(bucket.seconds)}</em>
                </article>
              `;
            }).join('')}
          </div>
        </section>

        <section class="journal-card journal-feedback-card">
          <div class="section-title">
            <h2>本周反馈</h2>
            <span>Next Step</span>
          </div>
          <div class="journal-feedback">
            <p>${records.length ? `本周最稳定的一天是 ${bestDay.label}，完成了 ${formatDuration(bestDay.seconds)}。` : '本周还没有专注记录，可以先完成一次 25 分钟。'}</p>
            <p>${activeDays >= 3 ? '下周目标：保持这个节奏，尝试把专注分布到更多天。' : '下周目标：至少完成 3 天打卡，让节奏先稳定下来。'}</p>
          </div>
        </section>
      </div>
    </section>
  `;
}

function buildMonthCalendarCells(period, records) {
  const dayCount = Math.round((period.end - period.start) / MS_PER_DAY);
  const leading = (period.start.getDay() + 6) % 7;
  const cells = Array.from({ length: leading }, () => ({ empty: true }));

  for (let index = 0; index < dayCount; index += 1) {
    const date = addDays(period.start, index);
    const dayRecords = recordsForDate(records, date);
    cells.push({
      empty: false,
      date,
      key: toDateKey(date),
      day: index + 1,
      records: dayRecords,
      seconds: sumFocusSeconds(dayRecords)
    });
  }

  return cells;
}

function ensureSelectedMonthDate(period) {
  if (state.journalSelectedDate < period.start || state.journalSelectedDate >= period.end) {
    const today = new Date();
    state.journalSelectedDate = today >= period.start && today < period.end ? today : period.start;
  }
}

function renderMonthCalendar(period, records) {
  ensureSelectedMonthDate(period);
  const cells = buildMonthCalendarCells(period, records);
  const selectedKey = toDateKey(state.journalSelectedDate);
  const selectedRecords = recordsForDate(records, state.journalSelectedDate);
  const totalSeconds = sumFocusSeconds(records);
  const selectedSeconds = sumFocusSeconds(selectedRecords);
  const weekdays = ['一', '二', '三', '四', '五', '六', '日'];

  return `
    <section class="journal-mode journal-month-calendar-view">
      <div class="journal-mode-heading">
        <div>
          <p class="eyebrow">Monthly Calendar</p>
          <h2>月度打卡日历</h2>
        </div>
        <span>${period.title}</span>
      </div>

      <div class="journal-month-layout">
        <section class="journal-card journal-month-calendar-card">
          <div class="section-title">
            <h2>打卡日历</h2>
            <span>${countStudyDays(records)} 天打卡 · ${formatDuration(totalSeconds)}</span>
          </div>
          <div class="journal-month-calendar">
            ${weekdays.map((weekday) => `<span class="journal-weekday">${weekday}</span>`).join('')}
            ${cells.map((cell) => cell.empty ? '<span class="journal-month-day is-empty"></span>' : `
              <button class="journal-month-day${cell.seconds > 0 ? ' has-study' : ''}${cell.key === selectedKey ? ' is-selected' : ''}" type="button" data-journal-date="${cell.key}">
                <strong>${cell.day}</strong>
                <small>${cell.seconds > 0 ? formatDuration(cell.seconds) : ''}</small>
              </button>
            `).join('')}
          </div>
        </section>

        <section class="journal-card journal-day-detail-card">
          <div class="section-title">
            <h2>当天详情</h2>
            <span>${state.journalSelectedDate.toLocaleDateString('zh-CN', { month: 'long', day: 'numeric' })}</span>
          </div>
          ${renderJournalMetricCards([
            { label: '当天总时长', value: formatDuration(selectedSeconds) },
            { label: '完成次数', value: `${selectedRecords.length} 次` }
          ])}
          ${renderJournalTimeline(selectedRecords, '这一天还没有专注记录。')}
        </section>
      </div>
    </section>
  `;
}

function renderYearReport(period, records, buckets) {
  const totalSeconds = sumFocusSeconds(records);
  const bestMonth = getBestBucket(buckets);
  const studyDays = countStudyDays(records);
  const longestStreak = calculateLongestStreak(records);
  const maxSeconds = Math.max(1, ...buckets.map((bucket) => bucket.seconds));

  return `
    <section class="journal-mode journal-year-report">
      <div class="journal-mode-heading">
        <div>
          <p class="eyebrow">Annual Growth</p>
          <h2>年度成长报告</h2>
        </div>
        <span>${period.title}</span>
      </div>

      ${renderJournalMetricCards([
        { label: '年度总专注时长', value: formatDuration(totalSeconds), note: '全年累计' },
        { label: '总番茄数', value: `${records.length} 个`, note: '完成次数' },
        { label: '学习天数', value: `${studyDays} 天`, note: '有记录的日期' },
        { label: '累计积分', value: String(state.points), note: '当前账号' }
      ])}

      <section class="journal-card journal-year-track-card">
        <div class="section-title">
          <h2>12 个月学习轨迹</h2>
          <span>${bestMonth.seconds ? `最佳月份 ${bestMonth.label}` : '暂无记录'}</span>
        </div>
        <div class="journal-year-track">
          ${buckets.map((bucket) => {
            const height = Math.max(8, Math.round((bucket.seconds / maxSeconds) * 100));
            return `
              <article>
                <span class="journal-year-bar"><i style="height: ${bucket.seconds > 0 ? height : 0}%"></i></span>
                <strong>${bucket.label}</strong>
                <small>${formatDuration(bucket.seconds)}</small>
              </article>
            `;
          }).join('')}
        </div>
      </section>

      <section class="journal-card journal-achievement-wall">
        <div class="section-title">
          <h2>年度成就墙</h2>
          <span>Milestones</span>
        </div>
        ${records.length ? `
          <div class="journal-achievement-grid">
            <article><strong>${formatRecordTime(records[0])}</strong><span>第一次完成专注</span></article>
            <article><strong>${bestMonth.label}</strong><span>最高产月份</span></article>
            <article><strong>${longestStreak} 天</strong><span>最长连续学习</span></article>
            <article><strong>${records.length} 个</strong><span>累计番茄</span></article>
          </div>
        ` : '<div class="empty-state journal-empty-block"><p>今年还没有专注记录，完成一次专注后这里会生成成长报告。</p></div>'}
      </section>
    </section>
  `;
}

function renderJournalView() {
  const period = getJournalPeriod();
  const records = getJournalPeriodRecords(period);
  const buckets = buildJournalBuckets(period, records);

  journalViewButtons.forEach((button) => {
    button.classList.toggle('is-active', button.dataset.journalView === state.journalView);
  });

  journalRangeText.textContent = period.title;

  if (!journalViewContent) {
    return;
  }

  if (state.journalView === 'week') {
    journalViewContent.innerHTML = renderWeekRhythm(period, records, buckets);
  } else if (state.journalView === 'month') {
    journalViewContent.innerHTML = renderMonthCalendar(period, records);
  } else if (state.journalView === 'year') {
    journalViewContent.innerHTML = renderYearReport(period, records, buckets);
  } else {
    journalViewContent.innerHTML = renderDayReview(period, records);
  }
}

function setJournalView(viewName) {
  if (!['day', 'week', 'month', 'year'].includes(viewName)) {
    return;
  }

  state.journalView = viewName;
  renderJournalView();
}

function shiftJournalPeriod(direction) {
  const amount = direction === 'next' ? 1 : -1;

  if (state.journalView === 'week') {
    state.journalCursorDate = addDays(state.journalCursorDate, amount * 7);
  } else if (state.journalView === 'month') {
    state.journalCursorDate = addMonths(state.journalCursorDate, amount);
  } else if (state.journalView === 'year') {
    state.journalCursorDate = addYears(state.journalCursorDate, amount);
  } else {
    state.journalCursorDate = addDays(state.journalCursorDate, amount);
  }

  renderJournalView();
}

function handleJournalViewClick(event) {
  const dateButton = event.target.closest('[data-journal-date]');
  if (!dateButton) {
    return;
  }

  state.journalSelectedDate = new Date(`${dateButton.dataset.journalDate}T12:00:00`);
  renderJournalView();
}

function getTaskStatus(task) {
  if (task.completed) {
    return 'completed';
  }

  if (task.id === state.currentTaskId) {
    return 'active';
  }

  return 'pending';
}

function getTaskStatusText(task) {
  const status = getTaskStatus(task);

  if (status === 'completed') {
    return '已完成';
  }

  if (status === 'active') {
    return '进行中';
  }

  return '未完成';
}

function renderTodoList() {
  todoListElement.innerHTML = '';
  todoEmptyState.hidden = state.todoList.length > 0;

  state.todoList.forEach((task) => {
    const status = getTaskStatus(task);
    const item = document.createElement('article');
    item.className = `todo-item is-${status}`;
    item.dataset.taskId = task.id;

    const progressText = `${task.completedPomodoros} / ${task.estimatedPomodoros} 个番茄`;
    const currentButtonText = status === 'active' ? '当前任务' : '设为当前任务';

    item.innerHTML = `
      <label class="todo-check">
        <input class="todo-complete" type="checkbox" ${task.completed ? 'checked' : ''} aria-label="标记任务完成">
      </label>
      <div class="todo-main">
        <div class="todo-title-row">
          <h2>${escapeHtml(task.name)}</h2>
          <span class="todo-status">${getTaskStatusText(task)}</span>
        </div>
        <div class="todo-meta">
          <span class="todo-tag">${escapeHtml(task.type)}</span>
          <span>进度：${progressText}</span>
        </div>
      </div>
      <div class="todo-actions">
        <button class="btn btn-secondary todo-current-button" type="button" ${task.completed || status === 'active' ? 'disabled' : ''}>${currentButtonText}</button>
        <button class="btn btn-ghost todo-delete-button" type="button">删除</button>
      </div>
    `;

    todoListElement.appendChild(item);
  });
}

function renderTodoView() {
  updateTodoStats();
  renderTodoList();
}

function renderCountdownList() {
  countdownListElement.innerHTML = '';
  countdownEmptyState.hidden = state.countdownList.length > 0;
  document.querySelector('#countdownListSummary').textContent = `${state.countdownList.length} 个目标`;

  state.countdownList.forEach((goal) => {
    const status = getCountdownStatus(goal.targetDate);
    const item = document.createElement('article');
    item.className = `countdown-item is-${status.tone}`;
    item.dataset.countdownId = goal.id;
    const titleText = status.isCompleted
      ? `${escapeHtml(goal.name)}（已完成）`
      : escapeHtml(goal.name);

    item.innerHTML = `
      <div class="countdown-main">
        <h2 class="countdown-title${status.isCompleted ? ' is-completed' : ''}">${titleText}</h2>
        <p class="countdown-note">${goal.note ? escapeHtml(goal.note) : '暂无备注'}</p>
      </div>
      <div class="countdown-side">
        <div class="countdown-status-block is-${status.tone}">
          <span class="countdown-status-label">${status.metricLabel}</span>
          <div class="countdown-status-value-row">
            <strong class="countdown-status-value">${status.metricValue}</strong>
            ${status.metricSuffix ? `<span class="countdown-status-suffix">${status.metricSuffix}</span>` : ''}
          </div>
        </div>
        <p class="countdown-date">${goal.targetDate}</p>
        <p class="countdown-status-text is-${status.tone}">${status.text}</p>
      </div>
      <div class="countdown-item-footer">
        <button class="btn btn-ghost countdown-delete-button" type="button">删除</button>
      </div>
    `;

    countdownListElement.appendChild(item);
  });
}

function renderCountdownView() {
  renderCountdownList();
}

function render() {
  renderProfile();
  updateTimerView();
  updateCompanionView();
  renderTodoView();
  renderCountdownView();
  renderJournalView();
}

function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, (char) => {
    const entities = {
      '&': '&amp;',
      '<': '&lt;',
      '>': '&gt;',
      '"': '&quot;',
      "'": '&#39;'
    };
    return entities[char];
  });
}

function addTodo(event) {
  event.preventDefault();

  const name = todoNameInput.value.trim();
  if (!name) {
    showToast('请先输入任务名称');
    todoNameInput.focus();
    return;
  }

  const task = {
    id: createTaskId(),
    name,
    type: todoTypeSelect.value,
    estimatedPomodoros: Number(todoPomodoroSelect.value),
    completedPomodoros: 0,
    completedFocusRecordKeys: [],
    completed: false
  };

  state.todoList.unshift(task);
  todoNameInput.value = '';
  todoPomodoroSelect.value = '1';
  saveTodoState();
  render();
  showToast('已添加任务');
}

function toggleTodoComplete(taskId, completed) {
  const task = state.todoList.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  const wasAllCompleted = areAllTodoTasksCompleted();
  task.completed = completed;

  if (completed && state.currentTaskId === taskId) {
    state.currentTaskId = '';
  }

  saveTodoState();
  render();
  maybeShowDailyTaskEasterEgg(wasAllCompleted);
}

function setCurrentTask(taskId) {
  const task = state.todoList.find((item) => item.id === taskId);
  if (!task || task.completed) {
    return;
  }

  state.currentTaskId = taskId;
  saveTodoState();
  render();
  showToast(`当前任务：${task.name}`);
}

function deleteTodo(taskId) {
  state.todoList = state.todoList.filter((task) => task.id !== taskId);

  if (state.currentTaskId === taskId) {
    state.currentTaskId = '';
  }

  saveTodoState();
  render();
}

function handleTodoListClick(event) {
  const item = event.target.closest('.todo-item');
  if (!item) {
    return;
  }

  const taskId = item.dataset.taskId;

  if (event.target.matches('.todo-current-button')) {
    setCurrentTask(taskId);
    return;
  }

  if (event.target.matches('.todo-delete-button')) {
    deleteTodo(taskId);
  }
}

function handleTodoListChange(event) {
  const item = event.target.closest('.todo-item');
  if (!item || !event.target.matches('.todo-complete')) {
    return;
  }

  toggleTodoComplete(item.dataset.taskId, event.target.checked);
}

async function addCountdownGoal(event) {
  event.preventDefault();

  const name = countdownNameInput.value.trim();
  const targetDate = countdownDateInput.value;
  const note = countdownNoteInput.value.trim();

  if (!name) {
    showToast('请先输入目标名称');
    countdownNameInput.focus();
    return;
  }

  if (!isValidDateKey(targetDate)) {
    showToast('请先选择目标日期');
    countdownDateInput.focus();
    return;
  }

  state.countdownList.unshift({
    id: createCountdownId(),
    name,
    targetDate,
    note
  });

  countdownNameInput.value = '';
  resetCountdownForm();
  await saveCountdownState();
  renderCountdownView();
  hideCountdownModal();
  showToast('已添加倒计时目标');
}

async function deleteCountdownGoal(countdownId) {
  state.countdownList = state.countdownList.filter((goal) => goal.id !== countdownId);
  await saveCountdownState();
  renderCountdownView();
  showToast('已删除倒计时目标');
}

function handleCountdownListClick(event) {
  const item = event.target.closest('.countdown-item');
  if (!item || !event.target.matches('.countdown-delete-button')) {
    return;
  }

  deleteCountdownGoal(item.dataset.countdownId);
}

function stopTimer() {
  if (state.timerId) {
    window.clearInterval(state.timerId);
    state.timerId = null;
  }
}

function startLocalTimer() {
  if (state.timerId) {
    return;
  }

  state.timerId = window.setInterval(tickLocalTimer, LOCAL_TIMER_TICK_MS);
}

async function startFocus() {
  if (state.isRunning) {
    return;
  }

  try {
    stopTimer();
    await checkBackendHealth();
    const timerStatus = await requestBackend('/timer/start', {
      method: 'POST',
      body: JSON.stringify({ task_id: getCurrentTask()?.id || null })
    });
    applyAppStatus({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    await refreshAppStatus();
    showToast('已开始专注');
  } catch (error) {
    showToast('后端还没有启动，暂时无法开始专注');
  }
}

async function pauseFocus() {
  if (!state.isRunning) {
    showToast('番茄钟已暂停');
    return;
  }

  try {
    stopTimer();
    const timerStatus = await requestBackend('/timer/pause', { method: 'POST' });
    applyAppStatus({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    await refreshAppStatus();
    showToast('已暂停');
  } catch (error) {
    showToast('后端还没有启动，暂时无法暂停');
  }
}

async function resetFocus() {
  try {
    stopTimer();
    const timerStatus = await requestBackend('/timer/reset', { method: 'POST' });
    applyAppStatus({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    await refreshAppStatus();
    showToast('已重置');
  } catch (error) {
    showToast('后端还没有启动，暂时无法重置');
  }
}

async function continueFocusAfterCompletion() {
  if (completionContinueBusy) {
    return;
  }

  try {
    setCompletionContinueBusy(true);
    hideCompletionDialog();
    stopTimer();

    const resetStatus = await requestBackend('/timer/reset', { method: 'POST' });
    applyAppStatus({ timer: resetStatus, remaining_seconds: resetStatus.remaining_seconds });

    const timerStatus = await requestBackend('/timer/start', {
      method: 'POST',
      body: JSON.stringify({ task_id: getCurrentTask()?.id || null })
    });
    applyAppStatus({ timer: timerStatus, remaining_seconds: timerStatus.remaining_seconds });
    await refreshAppStatus();
    showToast('已开始下一次专注');
  } catch (error) {
    showToast('后端还没有启动，暂时无法继续专注');
  } finally {
    setCompletionContinueBusy(false);
  }
}

async function feedWithFood(foodId, fallbackName) {
  const previousPetState = state.petState;
  try {
    const result = await requestBackend('/shop/redeem', {
      method: 'POST',
      body: JSON.stringify({ food_id: foodId })
    });

    if (Number.isFinite(result.remaining_points)) {
      state.points = result.remaining_points;
    }

    if (!result.success) {
      render();
      showToast(result.message || '积分不足，暂时不能兑换');
      return;
    }

    if (result.feed_result?.status) {
      applyPetStatus(result.feed_result.status);
    }

    render();
    const hungerAdded = result.feed_result?.hunger_added;
    const resultingHunger = result.feed_result?.status?.hunger;
    let feedMessage = Number.isFinite(hungerAdded) && hungerAdded > 0
      ? `投喂成功，饱食度 +${hungerAdded}`
      : '投喂成功，小黑已经吃饱了';

    if (['angry', 'hungry_heavy'].includes(previousPetState) && Number.isFinite(resultingHunger)) {
      if (resultingHunger >= 30) {
        feedMessage += '，小黑恢复精神了';
      } else if (previousPetState === 'angry') {
        feedMessage += '，小黑不生气了，但还需要补给';
      }
    }

    showToast(feedMessage || result.message || `已兑换${fallbackName}`);

    window.setTimeout(() => refreshAppStatus(), 2600);
    window.setTimeout(() => refreshAppStatus(), 5600);
  } catch (error) {
    showToast('后端还没有启动，暂时无法兑换');
  }
}

function redeemSupply(itemName, foodId) {
  feedWithFood(foodId, itemName);
}

function feedPet() {
  feedWithFood('watermelon', '西瓜');
}

function showPetStatus(status) {
  document.querySelector('#petStatusText').textContent = status?.isOpen ? '已打开' : '未打开';
}

async function refreshPetStatus() {
  if (!window.petodo?.getPetWindowStatus) {
    document.querySelector('#petStatusText').textContent = '主窗口预览中';
    return;
  }

  const status = await window.petodo.getPetWindowStatus();
  showPetStatus(status);
}

async function openPetWindow() {
  if (!window.petodo?.openPetWindow) {
    showToast('当前环境无法打开桌宠窗口');
    return;
  }

  const status = await window.petodo.openPetWindow({ openingAnimation: true });
  showPetStatus(status);
}

async function closePetWindow() {
  if (!window.petodo?.closePetWindow) {
    showToast('当前环境无法关闭桌宠窗口');
    return;
  }

  const status = await window.petodo.closePetWindow();
  showPetStatus(status);
}

async function openCountdownWidget() {
  if (!window.petodo?.openCountdownWidget) {
    showToast('当前环境无法打开桌面小组件');
    return;
  }

  try {
    await window.petodo.openCountdownWidget();
    showToast('桌面小组件已打开');
  } catch (error) {
    console.warn('Failed to open countdown widget:', error);
    showToast('桌面小组件打开失败');
  }
}

async function openTodoWidget() {
  if (!window.petodo?.openTodoWidget) {
    showToast('当前环境无法打开今日待办小组件');
    return;
  }

  try {
    await window.petodo.openTodoWidget();
    showToast('今日待办小组件已打开');
  } catch (error) {
    console.warn('Failed to open todo widget:', error);
    showToast('今日待办小组件打开失败');
  }
}

navItems.forEach((item) => {
  item.addEventListener('click', () => setPage(item.dataset.page));
});

journalViewButtons.forEach((button) => {
  button.addEventListener('click', () => setJournalView(button.dataset.journalView));
});

journalPrevButton?.addEventListener('click', () => shiftJournalPeriod('prev'));
journalNextButton?.addEventListener('click', () => shiftJournalPeriod('next'));
journalViewContent?.addEventListener('click', handleJournalViewClick);

avatarButtons.forEach((button) => {
  button.addEventListener('click', () => {
    const targetPage = button.dataset.pageShortcut;
    if (targetPage) {
      setPage(targetPage);
    }
  });
});

startButtons.forEach((button) => {
  button.addEventListener('click', startFocus);
});

pauseButtons.forEach((button) => {
  button.addEventListener('click', pauseFocus);
});

resetButtons.forEach((button) => {
  button.addEventListener('click', resetFocus);
});

document.querySelectorAll('.redeem-button').forEach((button) => {
  button.addEventListener('click', () => redeemSupply(button.dataset.item, button.dataset.foodId));
});

todoForm.addEventListener('submit', addTodo);
loginForm?.addEventListener('submit', loginUser);
registerButton?.addEventListener('click', registerUser);
chooseAvatarButton?.addEventListener('click', chooseAvatar);
profileAvatarButton?.addEventListener('click', chooseAvatar);
profileAvatarInput?.addEventListener('change', updateAvatarFromFile);
saveProfileButton?.addEventListener('click', saveProfileFromSettings);
logoutButton?.addEventListener('click', logoutUser);
windowMinimizeButton?.addEventListener('click', () => window.petodo?.minimizeMainWindow?.());
windowMaximizeButton?.addEventListener('click', () => window.petodo?.toggleMaximizeMainWindow?.());
windowCloseButton?.addEventListener('click', () => window.petodo?.closeMainWindow?.());
todoListElement.addEventListener('click', handleTodoListClick);
todoListElement.addEventListener('change', handleTodoListChange);
countdownForm.addEventListener('submit', addCountdownGoal);
countdownListElement.addEventListener('click', handleCountdownListClick);
countdownAddButton?.addEventListener('click', showCountdownModal);
countdownWidgetButton?.addEventListener('click', openCountdownWidget);
todoWidgetButton?.addEventListener('click', openTodoWidget);
countdownModalCancelButton?.addEventListener('click', () => {
  resetCountdownForm();
  hideCountdownModal();
});
countdownModalBackdrop?.addEventListener('click', () => {
  resetCountdownForm();
  hideCountdownModal();
});
document.querySelector('#feedButton').addEventListener('click', feedPet);
openShopButton.addEventListener('click', () => setPage('shop'));
document.querySelector('#openPetButton').addEventListener('click', openPetWindow);
document.querySelector('#closePetButton').addEventListener('click', closePetWindow);
completionCloseButton?.addEventListener('click', hideCompletionDialog);
completionContinueButton?.addEventListener('click', continueFocusAfterCompletion);
dailyTaskEasterEggCloseButton?.addEventListener('click', hideDailyTaskEasterEggDialog);
todoRolloverCarryButton?.addEventListener('click', carryOverTodoTasksToToday);
todoRolloverClearButton?.addEventListener('click', clearTodoTasksForToday);
dailyTaskEasterEggToggle?.addEventListener('change', () => {
  state.dailyTaskEasterEggEnabled = dailyTaskEasterEggToggle.checked;
  saveDailyTaskEasterEggSetting();
});
document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape' && countdownModal && !countdownModal.hidden) {
    resetCountdownForm();
    hideCountdownModal();
  }
});

if (dailyTaskEasterEggToggle) {
  dailyTaskEasterEggToggle.checked = state.dailyTaskEasterEggEnabled;
}

setupOnDemandScrollbars();

window.petodo?.onNavigateToPage?.((pageName) => {
  if (!state.userProfile.isLoggedIn) {
    return;
  }

  if (typeof pageName === 'string') {
    setPage(pageName);
    if (pageName === 'todo') {
      loadTodoState().then(() => {
        renderTodoView();
        updateTimerView();
      }).catch((error) => {
        console.warn('Failed to refresh todo state after navigation:', error);
      });
    }
  }
});

async function initializeApp() {
  await syncCurrentAccountId({ force: true });
  render();

  if (state.userProfile.isLoggedIn && state.userProfile.accountId) {
    await loadAccountSessionData();
    render();
    refreshAppStatus().finally(checkTodoRollover);
  }

  refreshPetStatus();
  appStatusPollTimer = window.setInterval(refreshAppStatus, 2000);
  dailyTodoCheckTimer = window.setInterval(checkTodoRollover, DAILY_TODO_CHECK_MS);
  window.setInterval(refreshPetStatus, 2000);
}

initializeApp().catch((error) => {
  console.warn('Failed to initialize app:', error);
  render();
});
