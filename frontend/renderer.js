const FOCUS_SECONDS = 25 * 60;
const API_BASE_URL = 'http://127.0.0.1:8000';
const EMPTY_TASK_LABEL = '暂未选择任务';
const TODO_STORAGE_KEY = 'todoList';
const CURRENT_TASK_STORAGE_KEY = 'currentTask';
const TODO_DATE_STORAGE_KEY = 'todoListDate';
const DAILY_TASK_EASTER_EGG_SETTING_KEY = 'dailyTaskEasterEggEnabled';
const INITIAL_TASK_FOCUS_BACKFILL_STORAGE_KEY = 'taskFocusBackfill-2026-05-26-digital-report-v1';
const LOCAL_TIMER_TICK_MS = 250;
const DAILY_TODO_CHECK_MS = 60 * 1000;
const COMPLETION_DIALOG_AUTO_HIDE_MS = 5200;
const DEFAULT_IDLE_STATE = 'idle_1';

const state = {
  page: 'home',
  phase: 'Focus Session',
  remainingSeconds: FOCUS_SECONDS,
  timerMode: 'idle',
  timerSnapshotRemainingSeconds: FOCUS_SECONDS,
  timerSnapshotClientTime: Date.now(),
  isRunning: false,
  completedToday: 0,
  totalFocusSeconds: 0,
  focusRecords: [],
  todoList: loadTodoList(),
  currentTaskId: loadCurrentTaskId(),
  todoListDate: loadTodoListDate(),
  pendingTodoRollover: false,
  petState: DEFAULT_IDLE_STATE,
  petReason: '',
  dailyTaskEasterEggEnabled: loadDailyTaskEasterEggSetting(),
  hunger: 80,
  mood: '平静',
  points: 0,
  timerId: null,
  hasLoadedAppStatus: false,
  lastCompletedFocusKey: '',
  zeroRefreshRequested: false
};

const PET_MESSAGES = {
  idle_1: '小动物正在陪你',
  idle_2: '小动物正在陪你',
  focus: '小动物正在陪你学习',
  rest: '小动物提醒你休息',
  happy: '小动物很开心',
  fishing: '小动物正在钓鱼',
  hungry: '小动物有点饿了',
  hungry_heavy: '小动物已经很饿了',
  angry: '小动物生气了',
  sleep: '小动物睡着了',
  eating: '小动物正在吃补给',
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
  happy: '开心',
  fishing: '钓鱼中',
  hungry: '有点饿',
  hungry_heavy: '很饿',
  angry: '生气了',
  sleep: '睡着了',
  eating: '进食中',
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
  happy: 'assets/pet/luoxiaohei/happy/happy_01.png',
  fishing: 'assets/pet/luoxiaohei/gif/luoxiaohei-fishing.gif',
  hungry: 'assets/pet/luoxiaohei/gif/luoxiaohei-hungry.webp',
  hungry_heavy: 'assets/pet/luoxiaohei/gif/luoxiaohei-hungry-heavy.gif',
  angry: 'assets/pet/luoxiaohei/gif/luoxiaohei-angry.gif',
  sleep: 'assets/pet/luoxiaohei/gif/luoxiaohei-sleep.gif',
  eating: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating.gif',
  eating_hamburger: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating-hamburger.png',
  eating_pizza: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating-pizza.gif',
  eating_chicken_leg: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating-chicken-leg.png',
  finished_eating: 'assets/pet/luoxiaohei/gif/luoxiaohei-finished-eating.gif'
};

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('[data-page-panel]');
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
const journalDayList = document.querySelector('#journalDayList');
const journalRecentList = document.querySelector('#journalRecentList');
const journalEmptyState = document.querySelector('#journalEmptyState');
const completionDialog = document.querySelector('#completionDialog');
const completionCloseButton = document.querySelector('#completionCloseButton');
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

function loadTodoList() {
  try {
    const saved = JSON.parse(localStorage.getItem(TODO_STORAGE_KEY) || '[]');
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

function loadCurrentTaskId() {
  return localStorage.getItem(CURRENT_TASK_STORAGE_KEY) || '';
}

function loadTodoListDate() {
  return localStorage.getItem(TODO_DATE_STORAGE_KEY) || '';
}

function loadDailyTaskEasterEggSetting() {
  return localStorage.getItem(DAILY_TASK_EASTER_EGG_SETTING_KEY) !== 'false';
}

function saveTodoState() {
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.todoList));
  localStorage.setItem(CURRENT_TASK_STORAGE_KEY, state.currentTaskId);
  localStorage.setItem(TODO_DATE_STORAGE_KEY, state.todoListDate || getTodayKey());
}

function saveDailyTaskEasterEggSetting() {
  localStorage.setItem(DAILY_TASK_EASTER_EGG_SETTING_KEY, String(state.dailyTaskEasterEggEnabled));
}

function createTaskId() {
  return `task-${Date.now()}-${Math.random().toString(16).slice(2)}`;
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

  if (!localStorage.getItem(INITIAL_TASK_FOCUS_BACKFILL_STORAGE_KEY)) {
    const reportTask = getCurrentTask();
    if (reportTask?.name === '数电实验报告') {
      state.focusRecords
        .filter((record) => !record.task_id && record.completed_date === '2026-05-26')
        .forEach((record) => {
          changed = addFocusRecordToTask(reportTask, record) || changed;
        });
      localStorage.setItem(INITIAL_TASK_FOCUS_BACKFILL_STORAGE_KEY, 'true');
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
  dailyTaskEasterEggImage.src = `assets/pet/luoxiaohei/gif/task-complete-fish.webp?restart=${Date.now()}`;
  void dailyTaskEasterEggDialog.offsetWidth;
  dailyTaskEasterEggDialog.classList.add('is-visible');
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

  navItems.forEach((item) => {
    item.classList.toggle('is-active', item.dataset.page === pageName);
  });

  pages.forEach((page) => {
    page.classList.toggle('is-active', page.dataset.pagePanel === pageName);
  });
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

  document.querySelector('#journalTodayText').textContent = String(state.completedToday);
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

function updateCompanionView() {
  const message = state.petReason || PET_MESSAGES[state.petState] || PET_MESSAGES[DEFAULT_IDLE_STATE];
  const petText = PET_STATE_TEXT[state.petState] || PET_STATE_TEXT[DEFAULT_IDLE_STATE];
  const guidance = getHungerGuidance();

  document.querySelector('#homeMessageText').textContent = message;
  document.querySelector('#companionMessageText').textContent = message;
  document.querySelector('#companionStateText').textContent = petText;
  hungerText.textContent = `${state.hunger}%`;
  document.querySelector('#moodText').textContent = state.mood;
  document.querySelector('#pointsText').textContent = String(state.points);
  document.querySelector('#journalPointsText').textContent = String(state.points);
  companionImage.src = PET_IMAGES[state.petState] || PET_IMAGES[DEFAULT_IDLE_STATE];
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
    state.phase = 'Break Time';
  } else if (timerStatus.mode === 'paused') {
    state.phase = 'Paused';
  } else if (timerStatus.mode === 'idle') {
    state.phase = 'Focus Session';
  }

  if (typeof timerStatus.is_running === 'boolean') {
    state.isRunning = timerStatus.is_running;
  }

  state.timerMode = timerStatus.mode || state.timerMode;
  syncLocalTimerSnapshot(timerStatus);
  state.hasLoadedAppStatus = true;
  maybeShowPendingTodoRollover();
}

async function requestBackend(path, options = {}) {
  const response = await fetch(`${API_BASE_URL}${path}`, {
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers || {})
    },
    ...options
  });

  if (!response.ok) {
    throw new Error('请求失败');
  }

  return response.json();
}

async function refreshAppStatus({ silent = true } = {}) {
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

function renderJournalDays() {
  const days = buildRecentSevenDays();
  const maxMinutes = Math.max(1, ...days.map((day) => day.minutes));

  journalDayList.innerHTML = days
    .map((day) => {
      const width = Math.round((day.minutes / maxMinutes) * 100);
      return `
        <div class="day-row">
          <span>${day.label}</span>
          <div class="bar"><span style="width: ${width}%"></span></div>
          <strong>${day.minutes} min</strong>
        </div>
      `;
    })
    .join('');
}

function renderRecentRecords() {
  const recentRecords = [...state.focusRecords]
    .sort((a, b) => Number(b.completed_at || 0) - Number(a.completed_at || 0))
    .slice(0, 8);

  document.querySelector('#journalRecentSummary').textContent = `${recentRecords.length} records`;
  journalEmptyState.hidden = recentRecords.length > 0;
  journalRecentList.innerHTML = recentRecords
    .map((record) => `
      <article class="recent-item">
        <strong>${formatRecordTime(record)}</strong>
        <span>${formatDuration(record.focus_seconds)}</span>
      </article>
    `)
    .join('');
}

function renderJournalView() {
  document.querySelector('#journalTotalTimeText').textContent = formatDuration(state.totalFocusSeconds);
  document.querySelector('#journalStreakText').textContent = String(calculateStudyStreak());
  renderJournalDays();
  renderRecentRecords();
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

function render() {
  updateTimerView();
  updateCompanionView();
  renderTodoView();
  renderJournalView();
}

function escapeHtml(value) {
  return value.replace(/[&<>"']/g, (char) => {
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
  feedWithFood('hamburger', '汉堡');
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

if (state.currentTaskId && !getCurrentTask()) {
  state.currentTaskId = '';
  saveTodoState();
}

navItems.forEach((item) => {
  item.addEventListener('click', () => setPage(item.dataset.page));
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
todoListElement.addEventListener('click', handleTodoListClick);
todoListElement.addEventListener('change', handleTodoListChange);
document.querySelector('#feedButton').addEventListener('click', feedPet);
openShopButton.addEventListener('click', () => setPage('shop'));
document.querySelector('#openPetButton').addEventListener('click', openPetWindow);
document.querySelector('#closePetButton').addEventListener('click', closePetWindow);
completionCloseButton?.addEventListener('click', hideCompletionDialog);
dailyTaskEasterEggCloseButton?.addEventListener('click', hideDailyTaskEasterEggDialog);
todoRolloverCarryButton?.addEventListener('click', carryOverTodoTasksToToday);
todoRolloverClearButton?.addEventListener('click', clearTodoTasksForToday);
dailyTaskEasterEggToggle?.addEventListener('change', () => {
  state.dailyTaskEasterEggEnabled = dailyTaskEasterEggToggle.checked;
  saveDailyTaskEasterEggSetting();
});

if (dailyTaskEasterEggToggle) {
  dailyTaskEasterEggToggle.checked = state.dailyTaskEasterEggEnabled;
}

render();
refreshAppStatus().finally(checkTodoRollover);
refreshPetStatus();
appStatusPollTimer = window.setInterval(refreshAppStatus, 2000);
dailyTodoCheckTimer = window.setInterval(checkTodoRollover, DAILY_TODO_CHECK_MS);
window.setInterval(refreshPetStatus, 2000);
