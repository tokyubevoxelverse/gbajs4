const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = parseInt(process.argv[2]) || 9966;
const DIST_DIR = path.join(__dirname, 'gbajs4', 'dist');

const MIME_TYPES = {
    '.html': 'text/html; charset=utf-8',
    '.js': 'application/javascript; charset=utf-8',
    '.mjs': 'application/javascript; charset=utf-8',
    '.css': 'text/css; charset=utf-8',
    '.json': 'application/json; charset=utf-8',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.wasm': 'application/wasm',
    '.webmanifest': 'application/manifest+json',
    '.map': 'application/json'
};

// Headers required for SharedArrayBuffer
const COOP_COEP_HEADERS = {
    'Cross-Origin-Opener-Policy': 'same-origin',
    'Cross-Origin-Embedder-Policy': 'require-corp',
    'Cross-Origin-Resource-Policy': 'same-origin'
};

function serveFile(res, filePath, contentType) {
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.writeHead(404, { ...COOP_COEP_HEADERS, 'Content-Type': 'text/plain' });
            res.end('Not Found');
            return;
        }
        res.writeHead(200, { ...COOP_COEP_HEADERS, 'Content-Type': contentType });
        res.end(data);
    });
}

const server = http.createServer((req, res) => {
    // Parse URL using WHATWG URL API
    const reqUrl = new URL(req.url, `http://${req.headers.host}`);
    let pathname = decodeURIComponent(reqUrl.pathname || '/');
    
    // Default to index.html
    if (pathname === '/') pathname = '/index.html';
    
    let filePath = path.join(DIST_DIR, pathname);
    
    // Security: prevent directory traversal
    const normalizedPath = path.normalize(filePath);
    if (!normalizedPath.startsWith(DIST_DIR)) {
        res.writeHead(403, { ...COOP_COEP_HEADERS, 'Content-Type': 'text/plain' });
        res.end('Forbidden');
        return;
    }
    
    // Check if file exists
    fs.stat(filePath, (err, stats) => {
        if (err || !stats.isFile()) {
            // SPA fallback - serve index.html
            filePath = path.join(DIST_DIR, 'index.html');
        }
        
        const ext = path.extname(filePath).toLowerCase();
        const contentType = MIME_TYPES[ext] || 'application/octet-stream';
        
        serveFile(res, filePath, contentType);
    });
});

server.listen(PORT, '127.0.0.1', () => {
    console.log(`GBAjs3 server running at http://127.0.0.1:${PORT}/`);
    console.log('Cross-Origin-Isolated headers enabled for SharedArrayBuffer');
});
