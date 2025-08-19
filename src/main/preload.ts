const { contextBridge, ipcRenderer } = require('electron')

export interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  showSaveDialog: () => Promise<{
    canceled: boolean
    filePath?: string
  }>
}

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('toggle-always-on-top'),
  showSaveDialog: (): Promise<{ canceled: boolean; filePath?: string }> => 
    ipcRenderer.invoke('show-save-dialog'),
} as ElectronAPI)