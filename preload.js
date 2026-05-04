// ============================================================
// ESXC4 — preload.js
// This file runs BETWEEN Electron and your HTML app.
// It's a security layer — it decides what Node.js features
// your app is allowed to use.
//
// Think of it as a bouncer:
// Node.js (powerful) ──► preload.js (filter) ──► your app
// ============================================================

const { contextBridge, ipcRenderer } = require('electron')

// contextBridge.exposeInMainWorld() puts things on the
// window object so your app's JavaScript can use them.
// Only what you list here is accessible — nothing else.

contextBridge.exposeInMainWorld('xc4', {
  // App version — shown in settings panel
  version: '1.0.0',

  // Platform info — so the app knows it's running as
  // a desktop app vs browser
  platform: process.platform,   // 'win32', 'darwin', 'linux'
  isDesktop: true,

  // Send messages from app to main process
  // Used later for things like: open file dialog,
  // minimise to tray, show notifications etc
  send: (channel, data) => {
    const allowed = ['app-ready', 'save-data', 'open-file']
    if (allowed.includes(channel)) {
      ipcRenderer.send(channel, data)
    }
  },

  // Listen for messages from main process back to app
  // Used later for: data saved confirmation, updates etc
  on: (channel, callback) => {
    const allowed = ['data-saved', 'update-available']
    if (allowed.includes(channel)) {
      ipcRenderer.on(channel, (_event, ...args) => callback(...args))
    }
  }
})
