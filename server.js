// Local development preview server for ABDO CUT
const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
require('dotenv').config();

const PORT = process.env.PORT || 8085;
const ROOT_DIR = __dirname;

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
  '.avif': 'image/avif',
  '.webp': 'image/webp',
  '.mp4': 'video/mp4',
  '.webm': 'video/webm'
};

const apiHandlers = {
  '/api/auth': require('./api/auth'),
  '/api/config': require('./api/config'),
  '/api/media': require('./api/media'),
  '/api/sign-upload': require('./api/sign-upload'),
  '/api/upload-hyperserve': require('./api/upload-hyperserve'),
  '/api/stats': require('./api/stats')
};

function enhanceRes(res) {
  res.status = function(code) {
    res.statusCode = code;
    return res;
  };
  res.json = function(data) {
    if (!res.getHeader('Content-Type')) {
      res.setHeader('Content-Type', 'application/json');
    }
    res.end(JSON.stringify(data));
    return res;
  };
  return res;
}

const server = http.createServer((req, res) => {
  enhanceRes(res);
  const parsedUrl = url.parse(req.url, true);
  let pathname = parsedUrl.pathname;

  if (pathname.startsWith('/api/')) {
    const cleanPath = pathname.replace(/\/$/, '');
    const handler = apiHandlers[cleanPath];
    if (handler) {
      req.query = parsedUrl.query;
      let body = '';
      req.on('data', chunk => { body += chunk; });
      req.on('end', () => {
        if (body) {
          try { req.body = JSON.parse(body); } catch (e) { req.body = body; }
        } else {
          req.body = {};
        }
        try {
          handler(req, res);
        } catch (err) {
          console.error(`API Error on ${pathname}:`, err);
          res.status(500).json({ error: 'Internal server error', details: err.message });
        }
      });
      return;
    }
    return res.status(404).json({ error: 'API endpoint not found' });
  }

  // Rewrite /admin to /admin/index.html
  if (pathname === '/admin' || pathname === '/admin/') {
    pathname = '/admin/index.html';
  } else if (pathname === '/') {
    pathname = '/index.html';
  }

  let filePath = path.join(ROOT_DIR, pathname);
  if (!fs.existsSync(filePath)) {
    filePath = path.join(ROOT_DIR, 'index.html');
  }

  const ext = path.extname(filePath).toLowerCase();
  const contentType = MIME_TYPES[ext] || 'application/octet-stream';

  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(500);
      res.end('Server Error');
      return;
    }
    res.writeHead(200, { 'Content-Type': contentType });
    res.end(content);
  });
});

server.listen(PORT, '0.0.0.0', () => {
  console.log(`Server running at http://localhost:${PORT}`);
  console.log(`Public Site: http://localhost:${PORT}/`);
  console.log(`Admin Panel: http://localhost:${PORT}/admin/`);
});
