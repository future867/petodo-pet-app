const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petodo', {
  appName: 'Petodo',
  openPetWindow: (options) => ipcRenderer.invoke('pet-window:open', options),
  closePetWindow: () => ipcRenderer.invoke('pet-window:close'),
  getPetWindowStatus: () => ipcRenderer.invoke('pet-window:status'),
  getPetWindowBounds: () => ipcRenderer.invoke('pet-window:get-bounds'),
  movePetWindow: (bounds) => ipcRenderer.invoke('pet-window:move', bounds),
  savePetWindowPosition: () => ipcRenderer.invoke('pet-window:save-position'),
  setPetWindowPanelMode: (isOpen) => ipcRenderer.invoke('pet-window:set-panel-mode', isOpen),
  setPetWindowScale: (scalePercent, options) => ipcRenderer.invoke('pet-window:set-scale', scalePercent, options),
  setPetWindowAlwaysOnTop: (enabled) => ipcRenderer.invoke('pet-window:set-always-on-top', enabled),
  openCountdownWidget: () => ipcRenderer.invoke('countdown-widget:open'),
  closeCountdownWidget: () => ipcRenderer.invoke('countdown-widget:close'),
  openTodoWidget: () => ipcRenderer.invoke('todo-widget:open'),
  closeTodoWidget: () => ipcRenderer.invoke('todo-widget:close'),
  getTodoWidgetBounds: () => ipcRenderer.invoke('todo-widget:get-bounds'),
  resizeTodoWidget: (size) => ipcRenderer.invoke('todo-widget:resize', size),
  loadCountdownGoals: () => ipcRenderer.invoke('countdown-storage:load'),
  saveCountdownGoals: (goals) => ipcRenderer.invoke('countdown-storage:save', goals),
  loadTodoState: () => ipcRenderer.invoke('todo-storage:load'),
  saveTodoState: (todoState) => ipcRenderer.invoke('todo-storage:save', todoState),
  showMainWindow: (pageName) => ipcRenderer.invoke('main-window:show', pageName),
  setMainWindowAuthLayout: (isLoggedIn) => ipcRenderer.invoke('main-window:set-auth-layout', isLoggedIn),
  setCurrentAccountId: (accountId) => ipcRenderer.invoke('account:set-current', accountId),
  getCurrentAccountId: () => ipcRenderer.invoke('account:get-current'),
  minimizeMainWindow: () => ipcRenderer.invoke('main-window:minimize'),
  toggleMaximizeMainWindow: () => ipcRenderer.invoke('main-window:toggle-maximize'),
  closeMainWindow: () => ipcRenderer.invoke('main-window:close'),
  onNavigateToPage: (callback) => {
    if (typeof callback !== 'function') {
      return () => {};
    }

    const listener = (_event, pageName) => callback(pageName);
    ipcRenderer.on('navigation:set-page', listener);
    return () => ipcRenderer.removeListener('navigation:set-page', listener);
  },
  quitApp: () => ipcRenderer.invoke('app:quit')
});
