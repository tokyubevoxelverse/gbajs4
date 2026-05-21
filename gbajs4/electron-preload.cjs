const fs = require('fs');
const { readFile } = require('fs/promises');

try {
  if (typeof File !== 'undefined' && File.prototype) {
    const origArrayBuffer = File.prototype.arrayBuffer;

    File.prototype.arrayBuffer = async function () {
      try {
        const ab = await origArrayBuffer.call(this);
        if (ab && ab.byteLength) return ab;
      } catch (e) {}

      if (this.path) {
        try {
          const buf = await readFile(this.path);
          return buf.buffer.slice(buf.byteOffset, buf.byteOffset + buf.byteLength);
        } catch (e) {}
      }

      throw new Error('Unable to read File contents (no fallback available)');
    };
  }
} catch (e) {
  try {
    fs.appendFileSync('electron-preload.log', `${new Date().toISOString()} preload patch failed: ${e}\n`);
  } catch (er) {}
}
