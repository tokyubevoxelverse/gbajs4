"""
JavaBoyAdvance / gbajs4 - GBA Emulator Launcher
Starts the gbajs4 web emulator using Node.js with proper COOP/COEP headers.
"""
import subprocess
import sys
import os
import time
import socket
import shutil
import atexit

BASE_DIR = os.path.dirname(os.path.abspath(__file__))
SERVER_JS = os.path.join(BASE_DIR, "server.js")
PID_FILE = os.path.join(BASE_DIR, ".node_server.pid")
PORT = 9966
URL = f"http://127.0.0.1:{PORT}/"

# Global reference to server process
_node_process = None


def cleanup():
    """Kill the Node.js server on exit."""
    global _node_process
    
    # Kill by process object
    if _node_process is not None:
        try:
            _node_process.terminate()
            _node_process.wait(timeout=3)
        except:
            try:
                _node_process.kill()
            except:
                pass
    
    # Kill by PID file
    if os.path.exists(PID_FILE):
        try:
            with open(PID_FILE, 'r') as f:
                pid = int(f.read().strip())
            if os.name == 'nt':
                subprocess.run(['taskkill', '/PID', str(pid), '/F', '/T'],
                             capture_output=True, timeout=5)
            else:
                import signal
                os.kill(pid, signal.SIGTERM)
        except:
            pass
        try:
            os.remove(PID_FILE)
        except:
            pass


def find_node():
    """Find Node.js executable."""
    node = shutil.which("node")
    if node:
        return node

    # Check for bundled node.exe under this program's OfflineDependencies
    od = os.path.join(BASE_DIR, 'OfflineDependencies')
    if os.path.isdir(od):
        # walk and find node.exe
        for root, dirs, files in os.walk(od):
            if 'node.exe' in files:
                return os.path.join(root, 'node.exe')

    # Common Windows install locations as a last resort
    if os.name == 'nt':
        for p in [r"C:\Program Files\nodejs\node.exe", r"C:\Program Files (x86)\nodejs\node.exe"]:
            if os.path.exists(p):
                return p
    return None


def wait_for_server(timeout=15):
    """Wait for the server to be ready."""
    start = time.time()
    while time.time() - start < timeout:
        try:
            with socket.create_connection(("127.0.0.1", PORT), timeout=2):
                return True
        except:
            time.sleep(0.5)
    return False


def main():
    global _node_process
    
    # Debug log file
    log_file = os.path.join(BASE_DIR, "debug.log")
    def log(msg):
        with open(log_file, 'a') as f:
            f.write(f"{msg}\n")
    
    log("=== Starting GBA Emulator ===")
    
    # Register cleanup
    atexit.register(cleanup)
    
    # Kill any leftover server
    cleanup()
    
    # Check dist folder
    dist_dir = os.path.join(BASE_DIR, "gbajs4", "dist")
    log(f"Checking dist: {dist_dir}")
    if not os.path.exists(dist_dir):
        log("ERROR: dist folder not found")
        sys.exit(1)
    log("dist folder OK")
    
    # Find Node.js
    node_exe = find_node()
    log(f"Node.js: {node_exe}")
    if not node_exe:
        log("ERROR: Node.js not found")
        sys.exit(1)
    
    # Start Node.js server
    log(f"Starting Node.js with: {node_exe} {SERVER_JS} {PORT}")
    try:
        _node_process = subprocess.Popen(
            [node_exe, SERVER_JS, str(PORT)],
            cwd=BASE_DIR,
            stdout=subprocess.DEVNULL,
            stderr=subprocess.DEVNULL,
            stdin=subprocess.DEVNULL,
            creationflags=subprocess.CREATE_NO_WINDOW if os.name == 'nt' else 0
        )
        log(f"Node.js started with PID: {_node_process.pid}")
        
        # Write PID file IMMEDIATELY
        with open(PID_FILE, 'w') as f:
            f.write(str(_node_process.pid))
        log(f"PID file written: {PID_FILE}")
        
    except Exception as e:
        log(f"ERROR starting Node.js: {e}")
        sys.exit(1)
    
    # Wait for server
    log("Waiting for server...")
    if not wait_for_server():
        log("ERROR: Server did not start in time")
        cleanup()
        sys.exit(1)
    log("Server is ready!")
    
    # Open browser
    if "--no-browser" not in sys.argv:
        log("Opening browser...")
        try:
            if os.name == 'nt':
                os.startfile(URL)
            else:
                import webbrowser
                webbrowser.open(URL)
        except Exception as e:
            log(f"Browser error: {e}")
    
    log("Entering main loop...")
    # Keep Python alive while Node runs
    try:
        while _node_process.poll() is None:
            time.sleep(1)
    except KeyboardInterrupt:
        log("Keyboard interrupt")
    finally:
        log("Cleaning up...")
        cleanup()
        cleanup()


if __name__ == "__main__":
    main()
