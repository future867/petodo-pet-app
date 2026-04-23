const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('petodo', {
  appName: 'Petodo',
  openPetWindow: () => ipcRenderer.invoke('pet-window:open'),
  closePetWindow: () => ipcRenderer.invoke('pet-window:close'),
  getPetWindowStatus: () => ipcRenderer.invoke('pet-window:status')
});
