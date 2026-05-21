import { rmSync } from 'fs';
import path from 'path';

const distPath = path.join(process.cwd(), 'dist');
try {
  rmSync(distPath, { recursive: true, force: true });
  console.log('Removed dist directory');
} catch (e) {
  console.error('Failed to remove dist directory', e);
}
