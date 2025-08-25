const { app, BrowserWindow, ipcMain, dialog } = require('electron')
const path = require('path')
const os = require('os')

let mainWindow
let loadingWindow

const createLoadingWindow = () => {
  loadingWindow = new BrowserWindow({
    width: 420,
    height: 800,
    frame: false,
    alwaysOnTop: true,
    transparent: false,
    backgroundColor: '#1a1a1a',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
    },
    show: false,
  })

  const loadingHTML = `
    <!DOCTYPE html>
    <html lang="ja">
    <head>
      <meta charset="UTF-8">
      <meta name="viewport" content="width=device-width, initial-scale=1.0">
      <title>Podcast Recorder - Loading...</title>
      <style>
        body {
          margin: 0;
          padding: 0;
          background: linear-gradient(135deg, #1a1a1a 0%, #2d3748 100%);
          color: white;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', sans-serif;
          display: flex;
          flex-direction: column;
          justify-content: center;
          align-items: center;
          height: 100vh;
          overflow: hidden;
        }
        .logo {
          width: 80px;
          height: 80px;
          background: linear-gradient(45deg, #4299E1, #E53E3E);
          border-radius: 20px;
          display: flex;
          align-items: center;
          justify-content: center;
          margin-bottom: 24px;
          animation: pulse 2s ease-in-out infinite;
        }
        .logo-icon {
          font-size: 36px;
          color: white;
        }
        .title {
          font-size: 24px;
          font-weight: 600;
          margin-bottom: 8px;
          text-align: center;
        }
        .subtitle {
          font-size: 14px;
          opacity: 0.7;
          margin-bottom: 32px;
          text-align: center;
        }
        .spinner {
          width: 40px;
          height: 40px;
          border: 3px solid rgba(255, 255, 255, 0.1);
          border-top: 3px solid #4299E1;
          border-radius: 50%;
          animation: spin 1s linear infinite;
        }
        .loading-text {
          margin-top: 16px;
          font-size: 14px;
          opacity: 0.8;
          animation: fadeInOut 2s ease-in-out infinite;
        }
        @keyframes pulse {
          0%, 100% { transform: scale(1); opacity: 1; }
          50% { transform: scale(1.05); opacity: 0.8; }
        }
        @keyframes spin {
          0% { transform: rotate(0deg); }
          100% { transform: rotate(360deg); }
        }
        @keyframes fadeInOut {
          0%, 100% { opacity: 0.8; }
          50% { opacity: 0.4; }
        }
        .progress-bar {
          width: 200px;
          height: 3px;
          background: rgba(255, 255, 255, 0.1);
          border-radius: 2px;
          margin: 20px 0;
          overflow: hidden;
        }
        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #4299E1, #E53E3E);
          width: 0%;
          border-radius: 2px;
          animation: loading 3s ease-in-out;
        }
        @keyframes loading {
          0% { width: 0%; }
          50% { width: 60%; }
          100% { width: 100%; }
        }
      </style>
    </head>
    <body>
      <div class="logo">
        <div class="logo-icon">🎙️</div>
      </div>
      <h1 class="title">Podcast Recorder</h1>
      <p class="subtitle">音声録音アプリケーション</p>
      <div class="progress-bar">
        <div class="progress-fill"></div>
      </div>
      <div class="spinner"></div>
      <div class="loading-text">アプリケーションを起動中...</div>
    </body>
    </html>
  `

  loadingWindow.loadURL('data:text/html;charset=utf-8,' + encodeURIComponent(loadingHTML))
  
  loadingWindow.once('ready-to-show', () => {
    loadingWindow.show()
  })

  loadingWindow.on('closed', () => {
    loadingWindow = null
  })
}

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
    show: false,
    resizable: true,
  })

  if (process.env.NODE_ENV === 'development') {
    mainWindow.loadURL('http://localhost:3000')
    mainWindow.webContents.openDevTools()
  } else {
    // パッケージされたアプリの場合の正しいパス
    const indexPath = app.isPackaged
      ? path.join(process.resourcesPath, 'renderer', 'index.html')
      : path.join(__dirname, '../../dist/renderer/index.html')
    
    console.log('Loading index.html from:', indexPath)
    mainWindow.loadFile(indexPath)
  }

  mainWindow.once('ready-to-show', () => {
    // ローディングウィンドウを閉じてメインウィンドウを表示
    if (loadingWindow) {
      loadingWindow.close()
    }
    mainWindow.show()
  })

  mainWindow.on('closed', () => {
    mainWindow = null
  })
}

app.whenReady().then(() => {
  createLoadingWindow()
  
  // メインウィンドウの作成を少し遅らせる
  setTimeout(() => {
    createWindow()
  }, 500)

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createLoadingWindow()
      setTimeout(() => {
        createWindow()
      }, 500)
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
