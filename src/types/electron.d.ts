export interface ElectronAPI {
  toggleAlwaysOnTop: () => Promise<boolean>
  showSaveDialog: (
    title?: string,
    inputSource?: string
  ) => Promise<{
    canceled: boolean
    filePath?: string
  }>
  writeFile: (
    filePath: string,
    buffer: ArrayBuffer
  ) => Promise<{
    success: boolean
    error?: string
  }>
  getDefaultSavePath: (title?: string, inputSource?: string) => Promise<string>
}

declare global {
  interface Window {
    electronAPI: ElectronAPI
  }
}
