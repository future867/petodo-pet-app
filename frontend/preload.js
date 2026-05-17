const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petodo', {
  appName: 'Petodo',
  openPetWindow: () => ipcRenderer.invoke('pet-window:open'),
  closePetWindow: () => ipcRenderer.invoke('pet-window:close'),
  getPetWindowStatus: () => ipcRenderer.invoke('pet-window:status'),
  getPetWindowBounds: () => ipcRenderer.invoke('pet-window:get-bounds'),
  movePetWindow: (bounds) => ipcRenderer.invoke('pet-window:move', bounds),
  savePetWindowPosition: () => ipcRenderer.invoke('pet-window:save-position'),
  setPetWindowPanelMode: (isOpen) => ipcRenderer.invoke('pet-window:set-panel-mode', isOpen),
  setPetWindowScale: (scale) => ipcRenderer.invoke('pet-window:set-scale', scale),
  setPetWindowAlwaysOnTop: (enabled) => ipcRenderer.invoke('pet-window:set-always-on-top', enabled),
  showMainWindow: () => ipcRenderer.invoke('main-window:show'),
  quitApp: () => ipcRenderer.invoke('app:quit')
});
