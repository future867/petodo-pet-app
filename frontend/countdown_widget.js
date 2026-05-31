const MS_PER_DAY = 24 * 60 * 60 * 1000;

const titleElement = document.querySelector('#widgetTitle');
const dateElement = document.querySelector('#widgetDate');
const statusElement = document.querySelector('#widgetStatus');
const emptyTextElement = document.querySelector('#widgetEmptyText');
const refreshButton = document.querySelector('#widgetRefreshButton');
const closeButton = document.querySelector('#widgetCloseButton');

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

function getGoalStatus(targetDate) {
  const todayKey = getTodayKey();

  if (targetDate === todayKey) {
    return {
      tone: 'today',
      text: '就是今天，加油！'
    };
  }

  if (targetDate < todayKey) {
    return {
      tone: 'completed',
      text: '已结束'
    };
  }

  const remainingDays = Math.round((getDateKeyTimestamp(targetDate) - getDateKeyTimestamp(todayKey)) / MS_PER_DAY);
  return {
    tone: 'upcoming',
    text: `还有 ${remainingDays} 天`
  };
}

function selectWidgetGoal(goals = []) {
  if (!Array.isArray(goals) || goals.length === 0) {
    return null;
  }

  const todayKey = getTodayKey();
  const todayGoal = goals.find((goal) => goal.targetDate === todayKey);
  if (todayGoal) {
    return todayGoal;
  }

  const upcomingGoals = goals
    .filter((goal) => goal.targetDate > todayKey)
    .sort((left, right) => left.targetDate.localeCompare(right.targetDate));
  if (upcomingGoals.length > 0) {
    return upcomingGoals[0];
  }

  const completedGoals = goals
    .filter((goal) => goal.targetDate < todayKey)
    .sort((left, right) => right.targetDate.localeCompare(left.targetDate));
  return completedGoals[0] || null;
}

function renderEmptyState() {
  titleElement.textContent = '还没有未来目标';
  dateElement.textContent = '去主页面添加一个目标';
  statusElement.textContent = '还没有未来目标';
  statusElement.className = 'widget-status';
  emptyTextElement.hidden = false;
}

function renderGoal(goal) {
  const status = getGoalStatus(goal.targetDate);
  titleElement.textContent = goal.name;
  dateElement.textContent = goal.targetDate;
  statusElement.textContent = status.text;
  statusElement.className = `widget-status${status.tone === 'today' ? ' is-today' : ''}${status.tone === 'completed' ? ' is-completed' : ''}`;
  emptyTextElement.hidden = true;
}

async function refreshWidget() {
  if (!window.petodo?.loadCountdownGoals) {
    renderEmptyState();
    dateElement.textContent = '当前环境不支持读取桌面数据';
    return;
  }

  refreshButton.disabled = true;
  refreshButton.textContent = '刷新中...';

  try {
    const goals = await window.petodo.loadCountdownGoals();
    const selectedGoal = selectWidgetGoal(Array.isArray(goals) ? goals : []);

    if (!selectedGoal) {
      renderEmptyState();
      return;
    }

    renderGoal(selectedGoal);
  } catch (error) {
    console.warn('Failed to refresh countdown widget:', error);
    titleElement.textContent = '读取失败';
    dateElement.textContent = '请稍后再试';
    statusElement.textContent = '还没有未来目标';
    statusElement.className = 'widget-status';
    emptyTextElement.hidden = false;
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = '刷新';
  }
}

async function closeWidget() {
  if (!window.petodo?.closeCountdownWidget) {
    window.close();
    return;
  }

  await window.petodo.closeCountdownWidget();
}

refreshButton?.addEventListener('click', refreshWidget);
closeButton?.addEventListener('click', closeWidget);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeWidget();
  }
});

refreshWidget();
