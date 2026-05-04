// ============================================================
// ESXC4 — main.js
// This is the BRAIN of your desktop app.
// Electron reads this file first when you launch ESXC4.
// It creates the window and loads your app inside it.
// ============================================================

const { app, BrowserWindow, shell } = require('electron')
const path = require('path')

// ── createWindow ──────────────────────────────────────────
// This function builds your app window.
// BrowserWindow = the actual window you see on screen.
// ──────────────────────────────────────────────────────────
function createWindow() {
  const win = new BrowserWindow({
    // Window size when it first opens
    width: 1400,
    height: 900,

    // Minimum size — stops the window getting too small
    minWidth: 800,
    minHeight: 600,

    // Start maximised on Windows
    show: false,

    // Custom title bar text
    title: 'ESXC4',

    // Remove default menu bar (File, Edit, View etc)
    autoHideMenuBar: true,

    // Window styling
    backgroundColor: '#07050f',  // ESXC4 dark background colour

    // Icon — shown in taskbar and alt-tab
    icon: path.join(__dirname, 'assets', 'icon.png'),

    // Security settings for loading local files
    webPreferences: {
      // preload.js runs before your app loads
      // It safely connects Node.js features to your HTML
      preload: path.join(__dirname, 'preload.js'),

      // Allow loading local files
      contextIsolation: true,
      nodeIntegration: false,
    }
  })

  // Load your ESXC4 HTML file into the window
  // __dirname = the folder where main.js lives
  win.loadFile(path.join(__dirname, 'src', 'index.html'))

  // Show window once it's fully loaded (no white flash)
  win.once('ready-to-show', () => {
    win.maximize()   // Open fullscreen by default
    win.show()
  })

  // Open any links that open a new tab in the real browser
  // instead of inside the Electron window
  win.webContents.setWindowOpenHandler(({ url }) => {
    shell.openExternal(url)
    return { action: 'deny' }
  })
}

// ── App lifecycle ──────────────────────────────────────────
// 'whenReady' fires when Electron has fully started up
// This is where we create our window
// ──────────────────────────────────────────────────────────
app.whenReady().then(() => {
  createWindow()

  // On Mac: re-open window if user clicks dock icon
  // (Mac apps stay "open" even with all windows closed)
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow()
    }
  })
})

// ── Quit behaviour ─────────────────────────────────────────
// On Windows/Linux: quit when all windows are closed
// On Mac: keep app running (standard Mac behaviour)
// ──────────────────────────────────────────────────────────
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit()
  }
})
