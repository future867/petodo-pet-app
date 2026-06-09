const todoListElement = document.querySelector('#todoWidgetList');
const emptyElement = document.querySelector('#todoWidgetEmpty');
const summaryElement = document.querySelector('#todoWidgetSummary');
const refreshButton = document.querySelector('#todoWidgetRefreshButton');
const openMainButton = document.querySelector('#todoWidgetOpenMainButton');
const closeButton = document.querySelector('#todoWidgetCloseButton');
const resizeHandle = document.querySelector('#todoWidgetResizeHandle');
const widgetShell = document.querySelector('.todo-widget-shell');

let todoState = {
  todoList: [],
  currentTaskId: '',
  todoListDate: ''
};
let resizeSession = null;

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

function getVisibleTasks(tasks = []) {
  const unfinished = tasks.filter((task) => !task.completed);
  const completed = tasks.filter((task) => task.completed);
  return [...unfinished, ...completed];
}

function renderEmpty(message = '今天还没有待办，给自己安排一个小目标吧。') {
  todoListElement.innerHTML = '';
  emptyElement.querySelector('p').textContent = message;
  emptyElement.hidden = false;
  summaryElement.textContent = '0 个待办';
}

function renderTodoList() {
  const tasks = Array.isArray(todoState.todoList) ? todoState.todoList : [];
  const visibleTasks = getVisibleTasks(tasks);
  const unfinishedCount = tasks.filter((task) => !task.completed).length;
  const completedCount = tasks.length - unfinishedCount;

  if (tasks.length === 0) {
    renderEmpty();
    return;
  }

  emptyElement.hidden = true;
  summaryElement.textContent = `${unfinishedCount} 个未完成，${completedCount} 个已完成`;
  todoListElement.innerHTML = visibleTasks
    .map((task) => `
      <label class="todo-widget-item${task.completed ? ' is-completed' : ''}" data-task-id="${escapeHtml(task.id)}">
        <input class="todo-widget-checkbox" type="checkbox" ${task.completed ? 'checked' : ''} aria-label="切换待办状态">
        <span class="todo-widget-name" title="${escapeHtml(task.name)}">${escapeHtml(task.name)}</span>
        <span class="todo-widget-status">${task.completed ? '已完成' : '未完成'}</span>
      </label>
    `)
    .join('');
}

async function refreshWidget() {
  if (!window.petodo?.loadTodoState) {
    renderEmpty('当前环境无法读取今日待办。');
    return;
  }

  refreshButton.disabled = true;
  refreshButton.textContent = '刷新中...';

  try {
    const loadedState = await window.petodo.loadTodoState();
    todoState = {
      todoList: Array.isArray(loadedState?.todoList) ? loadedState.todoList : [],
      currentTaskId: typeof loadedState?.currentTaskId === 'string' ? loadedState.currentTaskId : '',
      todoListDate: typeof loadedState?.todoListDate === 'string' ? loadedState.todoListDate : ''
    };
    renderTodoList();
  } catch (error) {
    console.warn('Failed to refresh todo widget:', error);
    renderEmpty('读取失败，请稍后再试。');
  } finally {
    refreshButton.disabled = false;
    refreshButton.textContent = '刷新';
  }
}

async function saveWidgetState() {
  if (!window.petodo?.saveTodoState) {
    return;
  }

  const savedState = await window.petodo.saveTodoState(todoState);
  todoState = {
    todoList: Array.isArray(savedState?.todoList) ? savedState.todoList : todoState.todoList,
    currentTaskId: typeof savedState?.currentTaskId === 'string' ? savedState.currentTaskId : todoState.currentTaskId,
    todoListDate: typeof savedState?.todoListDate === 'string' ? savedState.todoListDate : todoState.todoListDate
  };
}

async function toggleTask(taskId, completed) {
  const task = todoState.todoList.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  task.completed = completed;
  if (completed && todoState.currentTaskId === taskId) {
    todoState.currentTaskId = '';
  }

  renderTodoList();

  try {
    await saveWidgetState();
    renderTodoList();
  } catch (error) {
    console.warn('Failed to save todo widget change:', error);
    task.completed = !completed;
    renderTodoList();
  }
}

async function closeWidget() {
  if (!window.petodo?.closeTodoWidget) {
    window.close();
    return;
  }

  await window.petodo.closeTodoWidget();
}

async function openMainWindow() {
  if (!window.petodo?.showMainWindow) {
    return;
  }

  await window.petodo.showMainWindow('todo');
}

function hasTodoWidgetResizeApi() {
  return Boolean(window.petodo?.getTodoWidgetBounds && window.petodo?.resizeTodoWidget);
}

function scheduleTodoWidgetResize(width, height) {
  if (!resizeSession || !hasTodoWidgetResizeApi()) {
    return;
  }

  resizeSession.nextWidth = width;
  resizeSession.nextHeight = height;

  if (resizeSession.resizeFrame) {
    return;
  }

  resizeSession.resizeFrame = window.requestAnimationFrame(async () => {
    const session = resizeSession;
    if (!session) {
      return;
    }

    session.resizeFrame = null;

    try {
      await window.petodo.resizeTodoWidget({
        width: session.nextWidth,
        height: session.nextHeight
      });
    } catch (error) {
      console.warn('Failed to resize todo widget:', error);
    }
  });
}

async function beginTodoWidgetResize(event) {
  if ((event.button !== undefined && event.button !== 0) || !hasTodoWidgetResizeApi()) {
    return;
  }

  event.preventDefault?.();
  event.stopPropagation?.();

  const bounds = await window.petodo.getTodoWidgetBounds();
  if (!bounds) {
    return;
  }

  try {
    resizeHandle.setPointerCapture(event.pointerId);
  } catch {
    // Pointer capture is best-effort while the frameless window changes size.
  }

  widgetShell?.classList.add('is-resizing');
  resizeSession = {
    pointerId: event.pointerId,
    startScreenX: event.screenX,
    startScreenY: event.screenY,
    startWidth: bounds.width,
    startHeight: bounds.height,
    nextWidth: bounds.width,
    nextHeight: bounds.height,
    resizeFrame: null
  };
}

function moveTodoWidgetResize(event) {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) {
    return;
  }

  event.preventDefault?.();
  const deltaX = event.screenX - resizeSession.startScreenX;
  const deltaY = event.screenY - resizeSession.startScreenY;
  scheduleTodoWidgetResize(
    resizeSession.startWidth + deltaX,
    resizeSession.startHeight + deltaY
  );
}

async function endTodoWidgetResize(event) {
  if (!resizeSession || event.pointerId !== resizeSession.pointerId) {
    return;
  }

  const session = resizeSession;
  resizeSession = null;
  widgetShell?.classList.remove('is-resizing');

  try {
    resizeHandle.releasePointerCapture(event.pointerId);
  } catch {
    // Pointer capture may already be released after the window resize.
  }

  if (session.resizeFrame) {
    window.cancelAnimationFrame(session.resizeFrame);
    try {
      await window.petodo.resizeTodoWidget({
        width: session.nextWidth,
        height: session.nextHeight
      });
    } catch (error) {
      console.warn('Failed to finish todo widget resize:', error);
    }
  }
}

todoListElement.addEventListener('change', (event) => {
  if (!event.target.matches('.todo-widget-checkbox')) {
    return;
  }

  const item = event.target.closest('.todo-widget-item');
  if (!item) {
    return;
  }

  toggleTask(item.dataset.taskId, event.target.checked);
});

refreshButton?.addEventListener('click', refreshWidget);
openMainButton?.addEventListener('click', openMainWindow);
closeButton?.addEventListener('click', closeWidget);
resizeHandle?.addEventListener('pointerdown', beginTodoWidgetResize);
window.addEventListener('pointermove', moveTodoWidgetResize);
window.addEventListener('pointerup', endTodoWidgetResize);
window.addEventListener('pointercancel', endTodoWidgetResize);

document.addEventListener('keydown', (event) => {
  if (event.key === 'Escape') {
    closeWidget();
  }
});

refreshWidget();
