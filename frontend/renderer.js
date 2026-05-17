const FOCUS_SECONDS = 25 * 60;
const API_BASE_URL = 'http://127.0.0.1:8000';
const EMPTY_TASK_LABEL = '暂未选择任务';
const TODO_STORAGE_KEY = 'todoList';
const CURRENT_TASK_STORAGE_KEY = 'currentTask';
const LOCAL_TIMER_TICK_MS = 250;
const COMPLETION_DIALOG_AUTO_HIDE_MS = 5200;

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
  petState: 'idle',
  petReason: '',
  hunger: 80,
  mood: '平静',
  points: 0,
  timerId: null,
  hasLoadedAppStatus: false,
  lastCompletedFocusKey: '',
  zeroRefreshRequested: false
};

const PET_MESSAGES = {
  idle: '小动物正在陪你',
  focus: '小动物正在陪你学习',
  rest: '小动物提醒你休息',
  happy: '小动物很开心',
  hungry: '小动物有点饿了',
  hungry_heavy: '小动物已经很饿了',
  angry: '小动物生气了',
  sleep: '小动物睡着了',
  eating: '小动物正在吃补给',
  finished_eating: '小动物吃得很开心'
};

const PET_STATE_TEXT = {
  idle: '陪伴中',
  focus: '专注中',
  rest: '休息中',
  happy: '开心',
  hungry: '有点饿',
  hungry_heavy: '很饿',
  angry: '生气了',
  sleep: '睡着了',
  eating: '进食中',
  finished_eating: '吃完了'
};

const PET_IMAGES = {
  idle: 'assets/pet/luoxiaohei/gif/luoxiaohei-idle.gif',
  focus: 'assets/pet/luoxiaohei/gif/luoxiaohei-focus.gif',
  rest: 'assets/pet/luoxiaohei/gif/luoxiaohei-rest.gif',
  happy: 'assets/pet/luoxiaohei/gif/luoxiaohei-happy.gif',
  hungry: 'assets/pet/luoxiaohei/gif/luoxiaohei-hungry.webp',
  hungry_heavy: 'assets/pet/luoxiaohei/gif/luoxiaohei-hungry-heavy.gif',
  angry: 'assets/pet/luoxiaohei/gif/luoxiaohei-angry.gif',
  sleep: 'assets/pet/luoxiaohei/gif/luoxiaohei-sleep.gif',
  eating: 'assets/pet/luoxiaohei/gif/luoxiaohei-eating.gif',
  finished_eating: 'assets/pet/luoxiaohei/gif/luoxiaohei-finished-eating.gif'
};

const navItems = document.querySelectorAll('.nav-item');
const pages = document.querySelectorAll('[data-page-panel]');
const toast = document.querySelector('#toast');
const companionImage = document.querySelector('#companionImage');
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
let appStatusPollTimer = null;

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
        completed: Boolean(task.completed)
      }));
  } catch {
    return [];
  }
}

function loadCurrentTaskId() {
  return localStorage.getItem(CURRENT_TASK_STORAGE_KEY) || '';
}

function saveTodoState() {
  localStorage.setItem(TODO_STORAGE_KEY, JSON.stringify(state.todoList));
  localStorage.setItem(CURRENT_TASK_STORAGE_KEY, state.currentTaskId);
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

function updateCompanionView() {
  const message = state.petReason || PET_MESSAGES[state.petState] || PET_MESSAGES.idle;
  const petText = PET_STATE_TEXT[state.petState] || PET_STATE_TEXT.idle;

  document.querySelector('#homeMessageText').textContent = message;
  document.querySelector('#companionMessageText').textContent = message;
  document.querySelector('#companionStateText').textContent = petText;
  document.querySelector('#hungerText').textContent = `${state.hunger}%`;
  document.querySelector('#moodText').textContent = state.mood;
  document.querySelector('#pointsText').textContent = String(state.points);
  document.querySelector('#journalPointsText').textContent = String(state.points);
  companionImage.src = PET_IMAGES[state.petState] || PET_IMAGES.idle;
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
    state.petState = petStatus.state;
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

function toDateKey(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
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

  task.completed = completed;
  task.completedPomodoros = completed ? task.estimatedPomodoros : 0;

  if (completed && state.currentTaskId === taskId) {
    state.currentTaskId = '';
  }

  saveTodoState();
  render();
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
    const timerStatus = await requestBackend('/timer/start', { method: 'POST' });
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
    showToast(result.message || `已兑换${fallbackName}`);

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
  feedWithFood('fish', '小鱼干');
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

  const status = await window.petodo.openPetWindow();
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
document.querySelector('#openPetButton').addEventListener('click', openPetWindow);
document.querySelector('#closePetButton').addEventListener('click', closePetWindow);
completionCloseButton?.addEventListener('click', hideCompletionDialog);

render();
refreshAppStatus();
refreshPetStatus();
appStatusPollTimer = window.setInterval(refreshAppStatus, 2000);
window.setInterval(refreshPetStatus, 2000);
