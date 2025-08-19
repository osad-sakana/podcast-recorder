const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  showSaveDialog: () => ipcRenderer.invoke('show-save-dialog'),
  getDefaultSavePath: () => ipcRenderer.invoke('get-default-save-path'),
})