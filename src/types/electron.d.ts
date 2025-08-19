export interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  showSaveDialog: () => Promise<{
    canceled: boolean
    filePath?: string
  }>
  getDefaultSavePath: () => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}