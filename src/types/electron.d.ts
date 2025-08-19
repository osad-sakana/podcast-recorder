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

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}