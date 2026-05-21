import path from 'path';
import fs from 'fs';
import { fileURLToPath } from 'url';
import http from 'http';
import { app, BrowserWindow } from 'electron';

function createWindow() {
  const win = new BrowserWindow({
    width: 1100,
    height: 780,
    title: 'JavaBoyAdvance',
    autoHideMenuBar: true,
    fullscreen: true,
    webPreferences: {
      contextIsolation: true,
      sandbox: false,
      // preload will be set to the electron preload script which patches
      // File access behavior in packaged Electron so uploads work correctly.
      preload: path.join(path.dirname(fileURLToPath(import.meta.url)), 'electron-preload.cjs')
    }
  });

  // Determine dev vs packaged at runtime using `app.isPackaged`.
  // When developing, run `npm run dev` (Vite) then `npm run electron:dev` to point Electron to the dev server.
  const isDev = !app.isPackaged;
  // Allow forcing devtools in production for debugging by setting env var
  const shouldOpenDevTools = isDev || process.env.ELECTRON_DEBUG === '1';

  if (isDev) {
    // In dev, load the Vite dev server
    win.loadURL('http://localhost:5173').catch(e => console.error('Failed to load dev server', e));
  } else {
    // In production, the app is packaged into an asar (or resources/app)
    // Compute __dirname equivalent for ESM
    const __dirname = path.dirname(fileURLToPath(import.meta.url));

    // Possible locations for the built `dist/index.html` in packaged app.
    // Electron packaging can place files directly under resources/app or inside resources/app.asar.
        // Locate a packaged `dist` directory (may be inside app.asar or resources/app/dist)
        const distCandidates = [
          path.join(process.resourcesPath, 'app', 'dist'),
          path.join(process.resourcesPath, 'app.asar', 'dist'),
          path.join(process.resourcesPath, 'dist'),
          path.join(__dirname, 'dist')
        ];

        let distDir = null;
        for (const d of distCandidates) {
          try { if (fs.existsSync(d)) { distDir = d; break; } } catch (e) { }
        }

        if (distDir) {
          // Start a minimal HTTP server to serve the built files with COOP/COEP headers.
          const mime = {
            '.html': 'text/html', '.js': 'application/javascript', '.css': 'text/css',
            '.wasm': 'application/wasm', '.json': 'application/json', '.png': 'image/png',
            '.jpg': 'image/jpeg', '.jpeg': 'image/jpeg', '.svg': 'image/svg+xml',
            '.map': 'application/octet-stream'
          };

          const server = http.createServer((req, res) => {
            try {
              let reqPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
              if (reqPath === '/') reqPath = '/index.html';
              const filePath = path.join(distDir, reqPath.replace(/^\/+/, ''));
              if (!fs.existsSync(filePath)) {
                res.statusCode = 404; res.end('Not found'); return;
              }
              const data = fs.readFileSync(filePath);
              const ext = path.extname(filePath).toLowerCase();
              const ctype = mime[ext] || 'application/octet-stream';
              // Required headers for cross-origin isolation to enable SharedArrayBuffer
              res.setHeader('Content-Type', ctype);
              res.setHeader('Cross-Origin-Embedder-Policy', 'require-corp');
              res.setHeader('Cross-Origin-Opener-Policy', 'same-origin');
              // Allow workers and wasm to be transferred
              res.end(data);
            } catch (e) {
              res.statusCode = 500; res.end('Server error');
            }
          });

          // Use a stable port so renderer origin (host+port) remains constant
          // between runs and localStorage/IndexedDB persists. Default to 5173
          // for compatibility with the dev server; allow override via env.
          const preferredPort = process.env.VITE_ELECTRON_PORT
            ? parseInt(process.env.VITE_ELECTRON_PORT, 10)
            : 5173;

          const onServerReady = () => {
            const port = server.address().port;
            const url = `http://127.0.0.1:${port}/`;
            // Log server start for diagnostics
            try { fs.appendFileSync(path.join(app.getPath('userData'), 'pv-electron.log'), `${new Date().toISOString()} server started at ${url} serving ${distDir}\n`); } catch (er) { }

            win.loadURL(url).catch(e => {
              const m = `Failed to load from local server ${url}: ${e}`;
              console.error(m);
              try { fs.appendFileSync(path.join(app.getPath('userData'), 'pv-electron.log'), `${new Date().toISOString()} ${m}\n`); } catch (er) { }
              if (shouldOpenDevTools) try { win.webContents.openDevTools({ mode: 'right' }); } catch (er) { }
            });
          };

          server.on('error', (err) => {
            // If the preferred port is in use, fall back to an ephemeral port
            if (err && err.code === 'EADDRINUSE') {
              try {
                server.listen(0, '127.0.0.1');
              } catch (e) {
                const m = `Failed to listen on fallback port: ${e}`;
                console.error(m);
                try { fs.appendFileSync(path.join(app.getPath('userData'), 'pv-electron.log'), `${new Date().toISOString()} ${m}\n`); } catch (er) { }
              }
            } else {
              const m = `Server error: ${err}`;
              console.error(m);
              try { fs.appendFileSync(path.join(app.getPath('userData'), 'pv-electron.log'), `${new Date().toISOString()} ${m}\n`); } catch (er) { }
            }
          });

          server.on('listening', onServerReady);
          try {
            server.listen(preferredPort, '127.0.0.1');
          } catch (e) {
            // fall back to ephemeral
            server.listen(0, '127.0.0.1');
          }

          // Open DevTools in packaged builds to help diagnose renderer errors
          if (shouldOpenDevTools) try { win.webContents.openDevTools({ mode: 'right' }); } catch (e) { }

          // Close server when app quits
          app.on('will-quit', () => { try { server.close(); } catch (e) { } });
        } else {
          const msg = `No packaged dist directory found. Tried: ${distCandidates.join(', ')}`;
          console.error(msg);
          try { fs.appendFileSync(path.join(app.getPath('userData'), 'pv-electron.log'), `${new Date().toISOString()} ${msg}\n`); } catch (er) { }
          try { win.loadURL('about:blank'); } catch (e) { /* ignore */ }
          if (shouldOpenDevTools) try { win.webContents.openDevTools({ mode: 'right' }); } catch (e) { /* ignore */ }
        }

    // Packaged path handling is done above with the local static server.
  }

  // Diagnostics: listen for renderer load failures and crashes and write them to a log file
  const logFile = path.join(app.getPath('userData'), 'pv-electron.log');
  function writeLog(msg) {
    try { fs.appendFileSync(logFile, `${new Date().toISOString()} ${msg}\n`); } catch (e) { /* ignore */ }
  }

  win.webContents.on('did-fail-load', (event, errorCode, errorDescription, validatedURL) => {
    const m = `did-fail-load code=${errorCode} desc=${errorDescription} url=${validatedURL}`;
    console.error(m);
    writeLog(m);
    // Open devtools to help diagnose blank white screens
    if (shouldOpenDevTools) try { win.webContents.openDevTools({ mode: 'right' }); } catch (e) { /* ignore */ }
  });

  win.webContents.on('crashed', () => {
    const m = 'renderer crashed';
    console.error(m);
    writeLog(m);
    if (shouldOpenDevTools) try { win.webContents.openDevTools({ mode: 'right' }); } catch (e) { /* ignore */ }
  });

  app.on('render-process-gone', (event, webContents, details) => {
    const m = `render-process-gone reason=${details.reason} exitCode=${details.exitCode}`;
    console.error(m);
    writeLog(m);
    if (shouldOpenDevTools) try { win.webContents.openDevTools({ mode: 'right' }); } catch (e) { /* ignore */ }
  });
}

// Ensure GPU is enabled where possible and ignore blacklists that may disable WebGL
app.commandLine.appendSwitch('ignore-gpu-blacklist');
app.commandLine.appendSwitch('enable-webgl');
app.commandLine.appendSwitch('disable-software-rasterizer');
app.commandLine.appendSwitch('enable-experimental-web-platform-features');

app.whenReady().then(() => {
  createWindow();
  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
