const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const os = require('os')

let mainWindow

const createWindow = () => {
  mainWindow = new BrowserWindow({
    width: 420,
    height: 800,
    minWidth: 400,
    minHeight: 750,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      enableRemoteModule: false,
      preload: path.join(__dirname, './preload.js'),
    },
    titleBarStyle: 'default',
    show: true,
    resizable: true,
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'))
  }

  mainWindow.once('ready-to-show', () => {
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createWindow()

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})

// 常に最前面表示の切り替え
ipcMain.handle('toggle-always-on-top', () => {
  if (mainWindow) {
    const isAlwaysOnTop = mainWindow.isAlwaysOnTop()
    mainWindow.setAlwaysOnTop(!isAlwaysOnTop)
    return !isAlwaysOnTop
  }
  return false
})

// デフォルトの保存先パスを取得
ipcMain.handle('get-default-save-path', (_, title = '', inputSource = '') => {
  const desktopPath = path.join(os.homedir(), 'Desktop')

  const now = new Date()
  const year = now.getFullYear()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  const day = String(now.getDate()).padStart(2, '0')
  const hour = String(now.getHours()).padStart(2, '0')
  const minute = String(now.getMinutes()).padStart(2, '0')
  const second = String(now.getSeconds()).padStart(2, '0')

  const dateTime = `${year}${month}${day}_${hour}${minute}${second}`
  const titlePart = title.trim() || 'recording'
  const hostName = 'macOS' // 簡易的な端末名

  // ファイル名に使用できない文字を除去
  const sanitizedTitle = titlePart.replace(/[<>:"/\\|?*]/g, '_')

  const fileName = `${dateTime}_${sanitizedTitle}_${hostName}.wav`
  return path.join(desktopPath, fileName)
})

// ファイル保存ダイアログ
ipcMain.handle('show-save-dialog', async (_, title = '', inputSource = '') => {
  if (mainWindow) {
    const desktopPath = path.join(os.homedir(), 'Desktop')

    const now = new Date()
    const year = now.getFullYear()
    const month = String(now.getMonth() + 1).padStart(2, '0')
    const day = String(now.getDate()).padStart(2, '0')
    const hour = String(now.getHours()).padStart(2, '0')
    const minute = String(now.getMinutes()).padStart(2, '0')
    const second = String(now.getSeconds()).padStart(2, '0')

    const dateTime = `${year}${month}${day}_${hour}${minute}${second}`
    const titlePart = title.trim() || 'recording'
    const hostName = 'macOS' // 簡易的な端末名

    // ファイル名に使用できない文字を除去
    const sanitizedTitle = titlePart.replace(/[<>:"/\\|?*]/g, '_')

    const fileName = `${dateTime}_${sanitizedTitle}_${hostName}.wav`
    const defaultPath = path.join(desktopPath, fileName)

    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [{ name: 'Audio Files', extensions: ['wav', 'webm'] }],
      defaultPath: defaultPath,
    })
    return result
  }
  return null
})

// ファイル書き込み
ipcMain.handle('write-file', async (_, filePath, arrayBuffer) => {
  const fs = require('fs').promises
  try {
    // ArrayBufferをBufferに変換
    const buffer = Buffer.from(arrayBuffer)
    await fs.writeFile(filePath, buffer)
    return { success: true }
  } catch (error) {
    console.error('File write error:', error)
    return { success: false, error: error.message }
  }
})
