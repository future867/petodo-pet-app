const SLEEP_AFTER_MS = 60 * 1000;
const EATING_DURATION_MS = 2200;
const DEFAULT_THEME_NAME = 'clawd';
const PET_THEMES = {
  clawd: 'assets/pet/clawd'
};

const petRoot = document.querySelector('#pet-root');
const petSprite = document.querySelector('#pet-sprite');
const timerBubble = document.querySelector('#timer-bubble');
const timerText = document.querySelector('#timer-text');

let renderer = null;
let activeState = 'idle';
let stateBeforeTemporary = 'idle';
let activeThemeName = DEFAULT_THEME_NAME;
let lastTimerStatus = 'idle';
let isDraggingPet = false;
let sleepTimer = null;
let manualTransitionTimer = null;

function getRequestedThemeName() {
  const params = new URLSearchParams(window.location.search);
  return params.get('theme') || localStorage.getItem('petodo:pet-theme') || DEFAULT_THEME_NAME;
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
}

function resolveTimerBaseState() {
  if (lastTimerStatus === 'focus') {
    return 'focus';
  }

  if (lastTimerStatus === 'rest') {
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

  activeState = stateName;
  await renderer.setPetState(stateName, options);
  rememberActivity();
}

function updateTimerText(text) {
  renderer?.updateTimerText(text);
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

async function playTemporaryState(stateName) {
  stateBeforeTemporary = activeState;
  await playStateThen(stateName, () => stateBeforeTemporary || resolveTimerBaseState());
}

async function feedPet() {
  clearManualTransition();
  await setPetState('eating', { keepManualTransition: true });

  manualTransitionTimer = window.setTimeout(() => {
    playStateThen('finished_eating', () => resolveTimerBaseState());
  }, EATING_DURATION_MS);
}

function bindPetInteractions() {
  petSprite.addEventListener('pointerdown', async () => {
    isDraggingPet = true;
    stateBeforeTemporary = activeState;
    await setPetState('drag');
  });

  window.addEventListener('pointerup', async () => {
    if (!isDraggingPet) {
      return;
    }

    isDraggingPet = false;
    await setPetState(stateBeforeTemporary || resolveTimerBaseState(), { rememberPrevious: false });
  });

  petSprite.addEventListener('click', async () => {
    if (isDraggingPet) {
      return;
    }

    await playTemporaryState('tap');
  });
}

function bindKeyboardShortcuts() {
  const stateByKey = {
    1: 'idle',
    2: 'focus',
    3: 'rest',
    4: 'happy',
    5: 'sleep',
    6: 'hungry_light',
    7: 'hungry_medium',
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
    return 'hungry_medium';
  }

  if (hungerLevel < 60) {
    return 'hungry_light';
  }

  return 'idle';
}

async function updatePetFromBackend(data = {}) {
  if (data.remainingSeconds !== undefined && data.remainingSeconds !== null) {
    const minutes = Math.floor(data.remainingSeconds / 60);
    const seconds = data.remainingSeconds % 60;
    updateTimerText(`${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`);
  }

  if (data.timerStatus) {
    lastTimerStatus = data.timerStatus;
  }

  if (data.focusCompleted) {
    lastTimerStatus = 'rest';
    await playStateThen('happy', 'rest');
    return;
  }

  if (data.timerStatus === 'focus') {
    await setPetState('focus');
    return;
  }

  if (data.timerStatus === 'rest') {
    await setPetState('rest');
    return;
  }

  if (data.petStatus === 'angry') {
    await setPetState('angry');
    return;
  }

  if (data.petStatus === 'hungry_light' || data.petStatus === 'hungry_medium') {
    await setPetState(data.petStatus);
    return;
  }

  if (data.petStatus === 'hungry') {
    await setPetState('hungry_light');
    return;
  }

  await setPetState(stateFromHungerLevel(data.hungerLevel));
}

async function fetchPetState() {
  // Reserved for later FastAPI integration:
  // const response = await fetch('http://127.0.0.1:8000/pet/status');
  // const data = await response.json();
  // await updatePetFromBackend(data);
}

window.setPetState = setPetState;
window.setPetTheme = setPetTheme;
window.getPetTheme = () => activeThemeName;
window.updateTimerText = updateTimerText;
window.updatePetFromBackend = updatePetFromBackend;
window.feedPet = feedPet;
window.fetchPetState = fetchPetState;

window.addEventListener('DOMContentLoaded', async () => {
  petSprite.addEventListener('error', () => renderer?.handleImageError());
  await setPetTheme(getRequestedThemeName(), { persist: false });
  bindPetInteractions();
  bindKeyboardShortcuts();
  rememberActivity();
});
