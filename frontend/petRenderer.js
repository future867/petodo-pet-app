class PetRenderer {
  constructor({ imageElement, timerBubbleElement, timerTextElement, themeBasePath }) {
    this.imageElement = imageElement;
    this.timerBubbleElement = timerBubbleElement;
    this.timerTextElement = timerTextElement;
    this.themeBasePath = themeBasePath.replace(/\/$/, '');
    this.theme = null;
    this.currentState = null;
    this.previousState = null;
    this.frameIndex = 0;
    this.animationTimer = null;
    this.stateCompleteTimer = null;
    this.onStateComplete = null;
    this.fallbackFrame = null;
    this.frameCache = new Map();
    this.timerTextValue = this.timerTextElement?.textContent || '25:00';
    this.currentStateBubble = null;
  }

  async init() {
    const response = await fetch(`${this.themeBasePath}/theme.json`);
    if (!response.ok) {
      throw new Error(`Failed to load pet theme: ${response.status}`);
    }

    this.theme = await response.json();
    const defaultState = this.theme.defaultState || 'idle_1';
    this.fallbackFrame = await this.resolveFallbackFrame(defaultState);
    await this.setPetState(defaultState);
  }

  async setPetState(stateName, options = {}) {
    if (!this.theme) {
      console.warn('Pet theme is not loaded yet.');
      return;
    }

    const nextState = this.theme.states[stateName] ? stateName : (this.theme.defaultState || 'idle_1');
    if (!this.theme.states[stateName]) {
      console.warn(`Missing pet state "${stateName}", falling back to "${nextState}".`);
    }

    this.clearTimers();
    this.previousState = options.rememberPrevious === false ? this.previousState : this.currentState;
    this.currentState = nextState;
    this.frameIndex = 0;
    this.updateRootState(nextState, null);

    const asset = await this.resolveAsset(nextState);
    if (!asset) {
      this.configureBubble(nextState, null);
      this.updateRootState(nextState, null);
      this.showImage(this.fallbackFrame);
      return;
    }

    this.configureBubble(nextState, asset);
    this.updateRootState(nextState, asset);

    if (asset.type === 'frames') {
      this.playFrames(asset, nextState);
      return;
    }

    this.playImage(asset, nextState);
  }

  async resolveFallbackFrame(defaultState) {
    const asset = await this.resolveAsset(defaultState);

    if (asset?.type === 'frames') {
      return asset.frames[0] || null;
    }

    return asset?.src || null;
  }

  updateTimerText(text) {
    this.timerTextValue = text || '';
    if (this.currentState === 'focus' && !this.currentStateBubble) {
      this.showBubble(this.timerTextValue);
    }
  }

  clearTimers() {
    if (this.animationTimer) {
      clearInterval(this.animationTimer);
      this.animationTimer = null;
    }

    if (this.stateCompleteTimer) {
      clearTimeout(this.stateCompleteTimer);
      this.stateCompleteTimer = null;
    }
  }

  configureBubble(stateName, asset) {
    this.currentStateBubble = asset?.bubble || null;

    if (this.currentStateBubble) {
      this.showBubble(this.currentStateBubble);
      return;
    }

    if (stateName === 'focus') {
      this.showBubble(this.timerTextValue);
      return;
    }

    this.hideBubble();
  }

  showBubble(text) {
    if (!this.timerBubbleElement || !this.timerTextElement) {
      return;
    }

    this.timerTextElement.textContent = text || '';
    this.timerBubbleElement.hidden = false;
  }

  hideBubble() {
    if (this.timerBubbleElement) {
      this.timerBubbleElement.hidden = true;
    }
  }

  updateRootState(stateName, asset) {
    const root = document.querySelector('#pet-root');
    if (!root) {
      return;
    }

    root.setAttribute('data-state', stateName);
    root.classList.toggle('angry-running', asset?.movement === 'run-top');
  }

  async resolveAsset(stateName, seen = new Set()) {
    if (seen.has(stateName)) {
      console.warn(`Circular pet state fallback detected for "${stateName}".`);
      return null;
    }

    seen.add(stateName);
    const state = this.theme.states[stateName];
    if (!state) {
      return null;
    }

    if (state.type === 'frames') {
      const frames = await this.loadFrames(state.path);
      if (frames.length > 0) {
        return {
          type: 'frames',
          frames,
          fps: state.fps || 6,
          playCount: state.playCount || 1,
          loop: state.loop !== false,
          bubble: state.bubble,
          movement: state.movement
        };
      }
    }

    if (state.type === 'image' || state.type === 'single' || state.type === 'animated') {
      const src = this.resolvePath(state.path);
      if (await this.fileExists(src)) {
        return {
          type: 'image',
          src,
          loop: state.loop !== false,
          durationMs: state.durationMs || state.duration || 700,
          bubble: state.bubble,
          movement: state.movement
        };
      }
    }

    console.warn(`Missing pet assets for state "${stateName}" at "${state.path}".`);
    if (state.fallbackTo) {
      return this.resolveAsset(state.fallbackTo, seen);
    }

    return null;
  }

  async loadFrames(relativeFolder) {
    const explicitFrames = this.theme.frameManifests?.[relativeFolder];
    if (explicitFrames?.length) {
      const existing = [];
      for (const fileName of explicitFrames) {
        const src = this.resolvePath(`${relativeFolder}/${fileName}`);
        if (await this.fileExists(src)) {
          existing.push(src);
        } else {
          console.warn(`Missing pet frame: ${src}`);
        }
      }
      return existing;
    }

    const cached = this.frameCache.get(relativeFolder);
    if (cached) {
      return cached;
    }

    const frames = [];
    const extensions = ['png', 'apng', 'gif', 'svg', 'webp'];
    for (let index = 1; index <= 90; index += 1) {
      const number = String(index).padStart(2, '0');
      let found = null;

      for (const extension of extensions) {
        const src = this.resolvePath(`${relativeFolder}/${relativeFolder}_${number}.${extension}`);
        if (await this.fileExists(src)) {
          found = src;
          break;
        }
      }

      if (!found) {
        break;
      }

      frames.push(found);
    }

    this.frameCache.set(relativeFolder, frames);
    return frames;
  }

  playFrames(asset, stateName) {
    const frameDuration = Math.max(30, Math.round(1000 / asset.fps));
    const playCount = Math.max(1, Math.round(asset.playCount || 1));
    let completedPlays = 0;
    this.showImage(asset.frames[0]);

    if (asset.frames.length === 1) {
      return;
    }

    this.animationTimer = setInterval(() => {
      this.frameIndex += 1;

      if (this.frameIndex >= asset.frames.length) {
        if (!asset.loop) {
          completedPlays += 1;
          if (completedPlays >= playCount) {
            this.frameIndex = asset.frames.length - 1;
            this.showImage(asset.frames[this.frameIndex]);
            this.clearTimers();
            this.onStateComplete?.(stateName);
            return;
          }
        }

        this.frameIndex = 0;
      }

      this.showImage(asset.frames[this.frameIndex]);
    }, frameDuration);

    if (!asset.loop) {
      this.stateCompleteTimer = setTimeout(() => {
        this.clearTimers();
        this.onStateComplete?.(stateName);
      }, frameDuration * asset.frames.length * playCount);
    }
  }

  playImage(asset, stateName) {
    this.showImage(asset.src);

    if (asset.loop) {
      return;
    }

    this.stateCompleteTimer = setTimeout(() => {
      this.clearTimers();
      this.onStateComplete?.(stateName);
    }, asset.durationMs);
  }

  showImage(src) {
    this.imageElement.dataset.fallbackActive = 'false';
    this.imageElement.src = src;
  }

  resolvePath(relativePath) {
    return `${this.themeBasePath}/${relativePath}`.replace(/\/+/g, '/');
  }

  fileExists(src) {
    return new Promise((resolve) => {
      const image = new Image();
      image.onload = () => resolve(true);
      image.onerror = () => resolve(false);
      image.src = src;
    });
  }

  handleImageError() {
    const failedSrc = this.imageElement.getAttribute('src');
    console.warn(`Pet image failed to load: ${failedSrc}`);

    if (this.imageElement.dataset.fallbackActive === 'true' || !this.fallbackFrame) {
      return;
    }

    this.imageElement.dataset.fallbackActive = 'true';
    this.imageElement.src = this.fallbackFrame;
  }
}

window.PetRenderer = PetRenderer;
