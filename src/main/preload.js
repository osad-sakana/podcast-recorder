const { contextBridge, ipcRenderer } = require('electron')

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: () => ipcRenderer.invoke('toggle-always-on-top'),
  showSaveDialog: (title, inputSource) => ipcRenderer.invoke('show-save-dialog', title, inputSource),
  writeFile: (filePath, buffer) => ipcRenderer.invoke('write-file', filePath, buffer),
  getDefaultSavePath: (title, inputSource) => ipcRenderer.invoke('get-default-save-path', title, inputSource),
})