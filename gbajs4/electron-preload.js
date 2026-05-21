const fs = require('fs');
const { readFile } = require('fs/promises');

// In some Electron contexts files selected by the user expose a `path`
// property but their browser `File` methods (like `arrayBuffer`) may not
// behave consistently. Patch `File.prototype.arrayBuffer` to provide a
// fallback that reads from the OS path when available.
try {
  if (typeof File !== 'undefined' && File.prototype) {
    const origArrayBuffer = File.prototype.arrayBuffer;

    File.prototype.arrayBuffer = async function () {
      // Try original first
      try {
        const ab = await origArrayBuffer.call(this);
        if (ab && ab.byteLength) return ab;
      } catch (e) {
        // fallthrough to path-based read
      }

      // If Electron provided a native `path` property, read it via fs
      // and return an ArrayBuffer. This allows the renderer to pass a
      // File to the wasm module and still get the binary contents.
      // eslint-disable-next-line @typescript-eslint/ban-ts-comment
      // @ts-ignore
      if (this.path) {
        try {
          const buf = await readFile(this.path);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        } catch (e) {
          // ignore and rethrow below
        }
      }

      throw new Error('Unable to read File contents (no fallback available)');
    };
  }
} catch (e) {
  // If anything goes wrong here, avoid breaking the renderer; just log.
  try {
    fs.appendFileSync('electron-preload.log', `${new Date().toISOString()} preload patch failed: ${e}\n`);
  } catch (er) {
    /* ignore */
  }
}
