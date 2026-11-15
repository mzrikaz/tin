// Desktop shell for the TIN registration app.
//
// IRD's backend has no CORS and relies on same-origin session cookies (captcha + anti-forgery),
// so the app can't call it from a plain web page. This file starts a small local server that:
//   1. serves the built React app (dist/), and
//   2. forwards IRD paths (/Registration, /DefaultCaptcha, …) to eservices.ird.gov.lk,
//      re-labelling IRD's cookies for localhost — the same thing the Vite dev proxy does.
// The window then loads http://localhost:<port>, so everything is same-origin.
// Uses only Node built-ins.

const { app, BrowserWindow, shell, Menu } = require('electron')
const http = require('node:http')
const https = require('node:https')
const fs = require('node:fs')
const path = require('node:path')

const IRD_ORIGIN = 'https://eservices.ird.gov.lk'
const IRD_PATHS = ['/Registration', '/Common', '/Content', '/Scripts', '/bundles', '/DefaultCaptcha']
const DIST = path.join(__dirname, '..', 'dist')

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.woff2': 'font/woff2',
  '.map': 'application/json',
}

function serveStatic(req, res) {
  const url = new URL(req.url, 'http://localhost')
  let file = path.normalize(path.join(DIST, decodeURIComponent(url.pathname)))
  if (!file.startsWith(DIST)) {
    res.writeHead(403).end()
    return
  }
  if (!fs.existsSync(file) || fs.statSync(file).isDirectory()) file = path.join(DIST, 'index.html')
  res.writeHead(200, {
    'Content-Type': MIME[path.extname(file)] ?? 'application/octet-stream',
    'Cache-Control': file.endsWith('index.html') ? 'no-cache' : 'public, max-age=31536000, immutable',
  })
  fs.createReadStream(file).pipe(res)
}

function proxyToIrd(req, res) {
  const target = new URL(req.url, IRD_ORIGIN)
  const headers = { ...req.headers }
  delete headers.host
  delete headers['accept-encoding'] // keep bodies plain so nothing needs decoding here
  headers.origin = IRD_ORIGIN
  headers.referer = `${IRD_ORIGIN}/registration/tinregistration/showrequestheader`

  const upstream = https.request(target, { method: req.method, headers }, (up) => {
    const out = { ...up.headers }
    // Store IRD's cookies as localhost cookies: drop Domain=…
    if (out['set-cookie']) out['set-cookie'] = out['set-cookie'].map((c) => c.replace(/;\s*Domain=[^;]*/gi, ''))
    // Keep redirects inside the app.
    if (out.location?.startsWith(IRD_ORIGIN)) out.location = out.location.slice(IRD_ORIGIN.length) || '/'
    res.writeHead(up.statusCode ?? 502, out)
    up.pipe(res)
  })
  upstream.setTimeout(60_000, () => upstream.destroy(new Error('IRD did not respond in time')))
  upstream.on('error', (err) => {
    if (!res.headersSent) res.writeHead(502, { 'Content-Type': 'text/plain' })
    res.end(`Could not reach IRD: ${err.message}`)
  })
  req.pipe(upstream)
}

// Drafts live in localStorage/IndexedDB, which are tied to the origin (including the port).
// So the app always uses the same port; it's remembered in case the default was busy once.
const DEFAULT_PORT = 51880
const portFile = () => path.join(app.getPath('userData'), 'port.json')

function listen(server, port) {
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => {
      server.off('error', reject)
      resolve(port)
    })
  })
}

async function startServer() {
  const server = http.createServer((req, res) => {
    if (IRD_PATHS.some((p) => req.url === p || req.url.startsWith(p + '/') || req.url.startsWith(p + '?'))) proxyToIrd(req, res)
    else serveStatic(req, res)
  })
  let preferred = DEFAULT_PORT
  try {
    preferred = JSON.parse(fs.readFileSync(portFile(), 'utf8')).port || DEFAULT_PORT
  } catch {
    /* first run */
  }
  for (let port = preferred; port < preferred + 20; port++) {
    try {
      await listen(server, port)
      if (port !== preferred) console.warn(`[TIN] port ${preferred} busy, using ${port} — drafts saved under the old port won't show.`)
      fs.mkdirSync(path.dirname(portFile()), { recursive: true })
      fs.writeFileSync(portFile(), JSON.stringify({ port }))
      return port
    } catch {
      /* try next */
    }
  }
  throw new Error('No free local port for the app server')
}

async function createWindow() {
  const port = await startServer()
  const appUrl = `http://localhost:${port}/`

  const win = new BrowserWindow({
    width: 1280,
    height: 860,
    minWidth: 380,
    title: 'TIN Registration',
    backgroundColor: '#020617',
    autoHideMenuBar: true,
    webPreferences: { contextIsolation: true, nodeIntegration: false, sandbox: true },
  })

  // Links to IRD pages etc. open in the user's normal browser.
  win.webContents.setWindowOpenHandler(({ url }) => {
    if (/^https?:\/\//.test(url)) shell.openExternal(url)
    return { action: 'deny' }
  })
  win.webContents.on('will-navigate', (e, url) => {
    if (!url.startsWith(appUrl)) {
      e.preventDefault()
      if (/^https?:\/\//.test(url)) shell.openExternal(url)
    }
  })

  await win.loadURL(appUrl)
}

// Keep a single instance so two windows can't overwrite each other's draft.
if (!app.requestSingleInstanceLock()) {
  app.quit()
} else {
  app.on('second-instance', () => {
    const [win] = BrowserWindow.getAllWindows()
    if (win) {
      if (win.isMinimized()) win.restore()
      win.focus()
    }
  })
  app.whenReady().then(() => {
    if (process.platform !== 'darwin') Menu.setApplicationMenu(null)
    createWindow()
    app.on('activate', () => BrowserWindow.getAllWindows().length === 0 && createWindow())
  })
  app.on('window-all-closed', () => process.platform !== 'darwin' && app.quit())
}
