# gbajs4 / JavaBoyAdvance

A Game Boy Advance emulator that runs in the browser (mGBA WASM) or as a native Windows desktop app (Electron). Fork of [gbajs3](https://github.com/thenick775/gbajs3).

Two ways to use it: **web** (Python launcher serves the built React app over localhost with the COOP/COEP headers SharedArrayBuffer needs) or **exe** (packaged Electron desktop installer).

## Prerequisites

- **Node.js** 22.x — required for build and for the web launcher. If you don't have it installed, the bundled copy in `OfflineDependencies/node-v22.12.0-win-x64/` is auto-discovered.
- **Python** 3.8+ — only required for the web launcher script.
- **Windows** for the `.exe` installer build target.

## Run

### Web (browser)

From the repo root:

```powershell
python app.py
```

Starts a local HTTP server on `http://127.0.0.1:9966/` with the COOP/COEP headers required for SharedArrayBuffer, then opens your default browser. Pass `--no-browser` to skip auto-launch. Requires `gbajs4/dist/` to exist (see **Build → Web**).

### Exe (desktop)

Download `JavaBoyAdvance Setup <version>.exe` from the [Releases page](https://github.com/tokyubevoxelverse/gbajs4/releases) and run it. The installer drops the app under `%LOCALAPPDATA%\Programs\JavaBoyAdvance\` with a Start Menu shortcut. To debug a packaged exe, set `ELECTRON_DEBUG=1` before launching to open DevTools.

## Build from source

All build commands run inside the `gbajs4/` folder.

```powershell
cd gbajs4
npm install
```

### Web build

```powershell
npm run build
```

Produces `gbajs4/dist/`. After this, `python app.py` (from the repo root) will serve it.

For a fast dev loop without packaging:

```powershell
npm run dev               # Vite dev server on :5173
```

### Exe build

```powershell
npm run electron:package
```

Produces:

- `gbajs4/dist/win-unpacked/JavaBoyAdvance.exe` — unpacked, run directly without installing
- `gbajs4/dist/JavaBoyAdvance Setup <version>.exe` — NSIS installer

For a fast Electron dev loop (no packaging):

```powershell
npm run dev               # terminal 1
npm run electron:dev      # terminal 2
```

### Offline build

If you don't have Node on PATH, the helper script uses the bundled Node in `OfflineDependencies/`:

```powershell
python gbajs4/scripts/offline_rebuild.py
```

See [BUILD-ELECTRON.md](BUILD-ELECTRON.md) for more packaging details.

## Loading ROMs

ROMs are not included in the repo (copyright). Use the in-app **Load Local Rom** menu after launch. The emulator persists ROMs and save data in IndexedDB / the userData folder.

## Project layout

```
JavaBoy/
  app.py                    Python launcher (starts server.js, opens browser)
  server.js                 Static HTTP server with COOP/COEP headers
  BUILD-ELECTRON.md         Detailed packaging notes
  OfflineDependencies/      Bundled Node.exe for offline build/run
  gbajs4/                   React + Electron app source (npm scripts run here)
    src/                    React source
    dist/                   Built output (web + electron renderer)
    electron-main.js        Electron entrypoint
    package.json            Build scripts and electron-builder config
```

## License

MIT — see [LICENSE](LICENSE). Upstream [gbajs3](https://github.com/thenick775/gbajs3) is GPL-3.0; that license still governs the upstream code this fork is built on.
