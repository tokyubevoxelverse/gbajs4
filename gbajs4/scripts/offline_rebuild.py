#!/usr/bin/env python3
"""
offline_rebuild.py

Automatically rebuilds the Electron package using available offline
dependencies. Designed to be portable so you can move the project
folder anywhere and still rebuild (when OfflineDependencies is present).

Usage:
  python scripts/offline_rebuild.py [--project PATH] [--offline PATH] [--no-package]

If --offline is not provided the script searches upward and beside the
project folder for a directory named `OfflineDependencies`.
"""
from __future__ import annotations

import argparse
import json
import os
import shutil
import subprocess
import sys
from pathlib import Path
from typing import Optional


def find_project_root(start: Path) -> Optional[Path]:
    p = start.resolve()
    for _ in range(10):
        if (p / 'package.json').is_file():
            return p
        if p.parent == p:
            break
        p = p.parent
    return None


def find_offline_dir(project_root: Path) -> Optional[Path]:
    # Common candidates: sibling or ancestor OfflineDependencies
    candidates = [project_root / 'OfflineDependencies', project_root.parent / 'OfflineDependencies']
    # walk up a few levels to find OfflineDependencies
    p = project_root
    for _ in range(6):
        cand = p / 'OfflineDependencies'
        candidates.append(cand)
        if p.parent == p:
            break
        p = p.parent

    # check all candidates and then a small breadth search around project root
    for c in candidates:
        if c.exists() and c.is_dir():
            return c.resolve()

    # as a last resort, scan project_root siblings
    for sibling in project_root.parent.iterdir():
        if sibling.name.lower() == 'offlinedependencies' and sibling.is_dir():
            return sibling.resolve()

    return None


def copy_offline_node_modules(offline_dir: Path, project_root: Path) -> bool:
    """Copy node_modules from offline directory into project node_modules.
    Returns True if copy happened, False if no offline node_modules found."""
    offline_nm = offline_dir / 'node_modules'
    if not offline_nm.exists():
        # also look for nested node_modules under offline_dir
        for candidate in offline_dir.rglob('node_modules'):
            offline_nm = candidate
            break

    if not offline_nm.exists():
        print('No node_modules found inside OfflineDependencies')
        return False

    target_nm = project_root / 'node_modules'
    print(f'Copying offline node_modules from {offline_nm} to {target_nm} (may take a while)')
    target_nm_parent = target_nm.parent
    target_nm_parent.mkdir(parents=True, exist_ok=True)

    # Use copytree with dirs_exist_ok where available to merge folders
    try:
        shutil.copytree(offline_nm, target_nm, dirs_exist_ok=True)
    except TypeError:
        # older Python versions - fallback manual merge
        for src in offline_nm.iterdir():
            dst = target_nm / src.name
            if src.is_dir():
                if dst.exists():
                    # merge recursively
                    for item in src.rglob('*'):
                        rel = item.relative_to(src)
                        dest_item = dst / rel
                        if item.is_dir():
                            dest_item.mkdir(parents=True, exist_ok=True)
                        else:
                            dest_item.parent.mkdir(parents=True, exist_ok=True)
                            if not dest_item.exists():
                                shutil.copy2(item, dest_item)
                else:
                    shutil.copytree(src, dst)
            else:
                dst.parent.mkdir(parents=True, exist_ok=True)
                if not dst.exists():
                    shutil.copy2(src, dst)

    return True


def run_cmd(cmd, cwd: Path, env=None) -> int:
    print(f'Running: {" ".join(cmd)} (cwd={cwd})')
    proc = subprocess.run(cmd, cwd=str(cwd), env=env or os.environ)
    return proc.returncode


def main(argv=None):
    parser = argparse.ArgumentParser()
    parser.add_argument('--project', '-p', type=Path, default=Path.cwd(), help='Project folder (where package.json lives)')
    parser.add_argument('--offline', '-o', type=Path, help='OfflineDependencies folder (optional)')
    parser.add_argument('--no-package', action='store_true', help="Don't run the final 'electron:package' step")
    parser.add_argument('--force-net-install', action='store_true', help='Allow network install if offline copy not found')
    args = parser.parse_args(argv)

    project_root = find_project_root(args.project)
    if not project_root:
        print('Error: package.json not found. Run this script inside the project tree.')
        return 2

    print(f'Project root: {project_root}')

    offline_dir = Path(args.offline) if args.offline else find_offline_dir(project_root)
    if offline_dir:
        print(f'OfflineDependencies located at: {offline_dir}')
    else:
        print('OfflineDependencies not found automatically')

    copied = False
    if offline_dir:
        copied = copy_offline_node_modules(offline_dir, project_root)

    # Ensure node is available
    node = shutil.which('node')
    npm = shutil.which('npm')
    if not node or not npm:
        print('Error: node or npm not found on PATH. Please install Node.js or ensure PATH is correct.')
        return 3

    # If we didn't copy offline node_modules, try prefer-offline install if allowed
    if not copied:
        if args.force_net_install:
            print('No offline modules found; proceeding with network install (this may take a while).')
            rc = run_cmd([npm, 'install', '--legacy-peer-deps', '--prefer-offline', '--no-audit', '--no-fund'], project_root)
            if rc != 0:
                print('npm install failed')
                return rc
        else:
            print('No offline dependencies copied and network install not allowed. Use --force-net-install to allow network installation.')
            # but still try npm install with prefer-offline to use any cached packages
            rc = run_cmd([npm, 'install', '--legacy-peer-deps', '--prefer-offline', '--no-audit', '--no-fund'], project_root)
            if rc != 0:
                print('npm install failed; aborting')
                return rc

    # Run the build + package (project scripts run build by default in electron:package)
    if args.no_package:
        print("Skipping packaging; running 'npm run build' instead")
        rc = run_cmd([npm, 'run', 'build'], project_root)
        return rc

    rc = run_cmd([npm, 'run', 'electron:package'], project_root)
    if rc == 0:
        print('Packaging finished successfully. Check dist/ for installer or unpacked app.')
    else:
        print('Packaging failed; check output for errors.')

    return rc


if __name__ == '__main__':
    sys.exit(main())
