const API_BASE_URL = 'http://127.0.0.1:8000';

const modeText = document.querySelector('#modeText');
const timeText = document.querySelector('#timeText');
const statusText = document.querySelector('#statusText');
const startButton = document.querySelector('#startButton');
const pauseButton = document.querySelector('#pauseButton');
const resetButton = document.querySelector('#resetButton');
const openPetButton = document.querySelector('#openPetButton');
const closePetButton = document.querySelector('#closePetButton');
const petStatusText = document.querySelector('#petStatusText');

const MODE_LABELS = {
  idle: '待机',
  focus: '专注中',
  break: '休息中',
  paused: '已暂停',
  unknown: '未知'
};

function formatTime(totalSeconds) {
  const safeSeconds = Math.max(0, totalSeconds || 0);
  const minutes = Math.floor(safeSeconds / 60).toString().padStart(2, '0');
  const seconds = Math.floor(safeSeconds % 60).toString().padStart(2, '0');
  return `${minutes}:${seconds}`;
}

function formatMode(mode) {
  return MODE_LABELS[mode] || mode || '未知';
}

function showStatus(data) {
  modeText.textContent = formatMode(data.mode);
  timeText.textContent = formatTime(data.remaining_seconds);
  statusText.textContent = data.is_running ? '计时中' : '未计时';
}

async function requestTimer(path, method = 'GET') {
  const response = await fetch(`${API_BASE_URL}${path}`, { method });
  if (!response.ok) {
    throw new Error('请求失败');
  }
  return response.json();
}

async function refreshStatus() {
  try {
    const data = await requestTimer('/timer/status');
    showStatus(data);
  } catch (error) {
    modeText.textContent = formatMode('unknown');
    timeText.textContent = '--:--';
    statusText.textContent = '无法连接后端，请先启动 FastAPI 服务';
  }
}

async function runAction(path) {
  try {
    const data = await requestTimer(path, 'POST');
    showStatus(data);
  } catch (error) {
    statusText.textContent = '操作失败，请检查后端是否已经启动';
  }
}

function showPetStatus(status) {
  petStatusText.textContent = status.isOpen ? '已打开' : '未打开';
}

async function refreshPetStatus() {
  if (!window.petodo?.getPetWindowStatus) {
    petStatusText.textContent = '无法读取';
    return;
  }

  const status = await window.petodo.getPetWindowStatus();
  showPetStatus(status);
}

async function openPetWindow() {
  const status = await window.petodo.openPetWindow();
  showPetStatus(status);
}

async function closePetWindow() {
  const status = await window.petodo.closePetWindow();
  showPetStatus(status);
}

startButton.addEventListener('click', () => runAction('/timer/start'));
pauseButton.addEventListener('click', () => runAction('/timer/pause'));
resetButton.addEventListener('click', () => runAction('/timer/reset'));
openPetButton.addEventListener('click', openPetWindow);
closePetButton.addEventListener('click', closePetWindow);

refreshStatus();
refreshPetStatus();
setInterval(refreshStatus, 1000);
setInterval(refreshPetStatus, 2000);
