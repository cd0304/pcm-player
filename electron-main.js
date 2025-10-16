const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 900,
    height: 700,
    webPreferences: {
      nodeIntegration: true,
      contextIsolation: false
    },
    icon: path.join(__dirname, 'icon.png')
  });

  mainWindow.loadFile('standalone-pcm-player.html');
  
  // 开发时打开开发者工具
  // mainWindow.webContents.openDevTools();
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// 处理文件选择
ipcMain.handle('select-pcm-file', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openFile'],
    filters: [
      { name: 'PCM文件', extensions: ['pcm'] },
      { name: '所有文件', extensions: ['*'] }
    ]
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const filePath = result.filePaths[0];
    const fileData = fs.readFileSync(filePath);
    return {
      name: path.basename(filePath),
      data: fileData.buffer
    };
  }
  
  return null;
});

// 处理目录扫描
ipcMain.handle('scan-directory', async () => {
  const result = await dialog.showOpenDialog(mainWindow, {
    properties: ['openDirectory']
  });
  
  if (!result.canceled && result.filePaths.length > 0) {
    const dirPath = result.filePaths[0];
    const files = fs.readdirSync(dirPath)
      .filter(file => file.toLowerCase().endsWith('.pcm'))
      .map(file => {
        const filePath = path.join(dirPath, file);
        const stats = fs.statSync(filePath);
        return {
          name: file,
          path: filePath,
          size: stats.size,
          mtime: stats.mtime.toISOString()
        };
      })
      .sort((a, b) => new Date(b.mtime) - new Date(a.mtime));
    
    return files;
  }
  
  return [];
});

// 处理文件读取
ipcMain.handle('read-pcm-file', async (event, filePath) => {
  try {
    const fileData = fs.readFileSync(filePath);
    return fileData.buffer;
  } catch (error) {
    throw new Error('读取文件失败: ' + error.message);
  }
});
