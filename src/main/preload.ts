const { contextBridge, ipcRenderer } = require('electron')

export interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  showSaveDialog: (title?: string, inputSource?: string) => Promise<{
    canceled: boolean
    filePath?: string
  }>
  writeFile: (filePath: string, buffer: ArrayBuffer) => Promise<{
    success: boolean
    error?: string
  }>
  getDefaultSavePath: (title?: string, inputSource?: string) => Promise<string>
}

contextBridge.exposeInMainWorld('electronAPI', {
  toggleAlwaysOnTop: (): Promise<boolean> => ipcRenderer.invoke('toggle-always-on-top'),
  showSaveDialog: (title?: string, inputSource?: string): Promise<{ canceled: boolean; filePath?: string }> => 
    ipcRenderer.invoke('show-save-dialog', title, inputSource),
  writeFile: (filePath: string, buffer: ArrayBuffer): Promise<{ success: boolean; error?: string }> =>
    ipcRenderer.invoke('write-file', filePath, buffer),
  getDefaultSavePath: (title?: string, inputSource?: string): Promise<string> => ipcRenderer.invoke('get-default-save-path', title, inputSource),
} as ElectronAPI)