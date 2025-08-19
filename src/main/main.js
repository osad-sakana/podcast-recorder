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
      preload: path.join(__dirname, './preload.js')
    },
    titleBarStyle: 'default',
    show: true,
    resizable: true
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
ipcMain.handle('get-default-save-path', () => {
  const desktopPath = path.join(os.homedir(), 'Desktop')
  const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
  return path.join(desktopPath, `recording-${timestamp}.wav`)
})

// ファイル保存ダイアログ
ipcMain.handle('show-save-dialog', async () => {
  if (mainWindow) {
    const desktopPath = path.join(os.homedir(), 'Desktop')
    const timestamp = new Date().toISOString().slice(0, 19).replace(/:/g, '-')
    const defaultPath = path.join(desktopPath, `recording-${timestamp}.wav`)
    
    const result = await dialog.showSaveDialog(mainWindow, {
      filters: [
        { name: 'Audio Files', extensions: ['wav', 'mp3'] }
      ],
      defaultPath: defaultPath
    })
    return result
  }
  return null
})