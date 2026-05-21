# Build & Package (Idiot-proof)

This short guide shows the minimum steps to build and package the Electron app. Copy-paste the commands — no thinking required.

**Where this file is:** BUILD-ELECTRON.md next to `package.json`.

**Prerequisites**
- Windows (packaging here targets Windows). Other OSes work if you adjust packaging targets.
- Node.js installed and on PATH (LTS recommended).
- Python 3.8+ (optional, for the offline helper script).
- Make sure `npm` is on your PATH.

If you already have a working copy of the repo, skip to "Quick packaged build".

---

**Quick packaged build (one command)**
1. Open PowerShell and change to the project folder (example):

```powershell
cd "D:\PrometheusVision\Programs\JavaBoy\gbajs4"
```

2. Run the packaging command (this runs the build then creates a Windows installer and an unpacked folder):

```powershell
npm run electron:package
```

3. When finished you will find the installer and an unpacked app in `dist/`:
- `dist\JavaBoyAdvance Setup <version>.exe` (installer)
- `dist\win-unpacked\JavaBoyAdvance.exe` (run this to test without installing)

---

**Quick dev run (fast test during development)**
1. Start Vite dev server in one terminal:

```powershell
npm run dev
```

2. In another terminal start Electron in dev mode (will point to the Vite server):

```powershell
npm run electron:dev
```

This lets you iterate quickly without packaging.

---

**Offline / moveable workflow (no internet required if you have OfflineDependencies)**
If you move the whole GameBoyAdvanceComplete folder and you have a pre-populated `OfflineDependencies` folder (contains `node_modules` or caches), use the helper script that will find and copy what's needed and run packaging.

Examples:

```powershell
# automatic search for OfflineDependencies near the project
python scripts/offline_rebuild.py

# explicitly point to your offline folder
python scripts/offline_rebuild.py --offline "D:\PrometheusVision\OfflineDependencies"

# if you want to allow network install when offline copy missing
python scripts/offline_rebuild.py --force-net-install
```

The script will:
- locate the project root (where `package.json` is)
- look for an `OfflineDependencies` folder (or use `--offline`)
- copy any offline `node_modules` into the project (merge)
- run `npm install` if necessary
- run `npm run electron:package` (unless you pass `--no-package`)

---

**Disable DevTools in packaged EXE (production)**
The packaged EXE will not auto-open DevTools. To temporarily enable DevTools in a packaged EXE for debugging, set an environment variable before launching:

PowerShell example:

```powershell
$env:ELECTRON_DEBUG = '1'
Start-Process 'D:\path\to\JavaBoyAdvance.exe'
```

Windows cmd example:

```cmd
set ELECTRON_DEBUG=1
"D:\path\to\JavaBoyAdvance.exe"
```

---

**Where to look when things go wrong**
- Build logs: terminal output when you run `npm run electron:package`.
- Packaged app runtime logs: `pv-electron.log` inside the app data folder for the current user (example `%APPDATA%\JavaBoyAdvance\pv-electron.log`).
- Preload errors: packaged preload scripts are in `dist\win-unpacked\resources\app.asar.unpacked\` (look for `electron-preload.cjs`).
- If ROMs won't load in the packaged app but they worked in dev, try the unpacked EXE `dist\win-unpacked\JavaBoyAdvance.exe` and open DevTools temporarily using `ELECTRON_DEBUG=1` to see renderer console errors.

---

**Tips / gotchas**
- If packaging fails due to missing native modules, run `npm install --legacy-peer-deps` first.
- Packaging can take several minutes and uses a lot of disk space. Use the unpacked EXE for quick testing before building the installer.
- If you move the project, use `scripts/offline_rebuild.py` to rehydrate `node_modules` from an `OfflineDependencies` folder or perform a fresh `npm install`.

---

If you want, I can add a tiny PowerShell wrapper that sets `ELECTRON_DEBUG` and launches the unpacked EXE for easy debugging, or a script to back up `node_modules` before merging. Want either of those?
