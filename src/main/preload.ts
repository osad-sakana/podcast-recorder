const { contextBridge, ipcRenderer } = require('electron')

export interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  showSaveDialog: () => Promise<{
    canceled: boolean
    filePath?: string
  }>
  writeFile: (filePath: string, buffer: ArrayBuffer) => Promise<{
    success: boolean
    error?: string
  }>
  getDefaultSavePath: () => Promise<string>
}

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('toggle-always-on-top'),
  showSaveDialog: (): Promise<{ canceled: boolean; filePath?: string }> => 
    ipcRenderer.invoke('show-save-dialog'),
  writeFile: (filePath: string, buffer: ArrayBuffer): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('write-file', filePath, buffer),
  getDefaultSavePath: (): Promise<string> => ipcRenderer.invoke('get-default-save-path'),
} as ElectronAPI)