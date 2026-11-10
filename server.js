'use strict';

/*
 * Activity Insights — tiny local server.
 *
 * Serves the dashboard from ./public and proxies /api/* to a running
 * ActivityWatch server (default http://127.0.0.1:5600).
 *
 * This proxy exists because ActivityWatch's API does not send CORS headers,
 * so a page opened from file:// (or another port) cannot read it directly.
 *
 * Usage:  node server.js [--no-open]
 * Env:    PORT=5601  AW_URL=http://127.0.0.1:5600  NO_OPEN=1
 */

const http = require('node:http');
const fs = require('node:fs');
const path = require('node:path');
const { spawn } = require('node:child_process');

const PORT = Number(process.env.PORT || 5601);
const AW_URL = process.env.AW_URL || 'http://127.0.0.1:5600';
const PUBLIC_DIR = path.join(__dirname, 'public');
const OPEN_BROWSER = process.argv.indexOf('--no-open') === -1 && process.env.NO_OPEN !== '1';

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.ico': 'image/x-icon',
  '.webp': 'image/webp',
  '.woff': 'font/woff',
  '.woff2': 'font/woff2',
  '.txt': 'text/plain; charset=utf-8',
  '.md': 'text/plain; charset=utf-8'
};

const HOP_BY_HOP = new Set([
  'connection', 'keep-alive', 'proxy-authenticate', 'proxy-authorization',
  'te', 'trailer', 'transfer-encoding', 'upgrade'
]);

function sendJson(res, status, payload) {
  const body = JSON.stringify(payload);
  res.writeHead(status, {
    'content-type': 'application/json; charset=utf-8',
    'cache-control': 'no-store',
    'content-length': Buffer.byteLength(body)
  });
  res.end(body);
}

function proxyApi(req, res, incomingUrl) {
  let target;
  try {
    target = new URL(AW_URL);
  } catch (err) {
    sendJson(res, 500, { error: 'Invalid AW_URL: ' + AW_URL });
    return;
  }

  const headers = {};
  for (const [key, value] of Object.entries(req.headers)) {
    if (!HOP_BY_HOP.has(key.toLowerCase()) && key.toLowerCase() !== 'host') {
      headers[key] = value;
    }
  }

  const options = {
    protocol: target.protocol,
    hostname: target.hostname,
    port: target.port || (target.protocol === 'https:' ? 443 : 80),
    method: req.method,
    path: incomingUrl.pathname + incomingUrl.search,
    headers
  };

  const upstream = http.request(options, function (upstreamRes) {
    const responseHeaders = {};
    for (const [key, value] of Object.entries(upstreamRes.headers)) {
      if (!HOP_BY_HOP.has(key.toLowerCase())) responseHeaders[key] = value;
    }
    responseHeaders['cache-control'] = 'no-store';
    res.writeHead(upstreamRes.statusCode || 502, responseHeaders);
    upstreamRes.pipe(res);
  });

  upstream.setTimeout(60000, function () {
    upstream.destroy(new Error('ActivityWatch request timed out after 60s'));
  });

  upstream.on('error', function (err) {
    if (!res.headersSent) {
      sendJson(res, 502, {
        error: 'Cannot reach ActivityWatch at ' + AW_URL,
        detail: err.message,
        hint: 'Make sure ActivityWatch is running (aw-qt) and the API is on port 5600.'
      });
    } else {
      res.destroy();
    }
  });

  req.pipe(upstream);
}

function serveStatic(req, res, incomingUrl) {
  if (req.method !== 'GET' && req.method !== 'HEAD') {
    res.writeHead(405, { allow: 'GET, HEAD' });
    res.end('Method not allowed');
    return;
  }

  let pathname;
  try {
    pathname = decodeURIComponent(incomingUrl.pathname);
  } catch (err) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (pathname === '/') pathname = '/index.html';

  const filePath = path.resolve(PUBLIC_DIR, '.' + pathname);
  const relative = path.relative(PUBLIC_DIR, filePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  fs.stat(filePath, function (statErr, stats) {
    if (statErr || !stats.isFile()) {
      res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const headers = {
      'content-type': MIME_TYPES[ext] || 'application/octet-stream',
      'content-length': stats.size,
      'cache-control': ext === '.html' ? 'no-cache' : 'public, max-age=60'
    };

    res.writeHead(200, headers);
    if (req.method === 'HEAD') {
      res.end();
      return;
    }
    fs.createReadStream(filePath).pipe(res);
  });
}

const server = http.createServer(function (req, res) {
  let incomingUrl;
  try {
    incomingUrl = new URL(req.url, 'http://localhost');
  } catch (err) {
    res.writeHead(400);
    res.end('Bad request');
    return;
  }

  if (incomingUrl.pathname === '/healthz') {
    sendJson(res, 200, { ok: true, aw: AW_URL, port: PORT });
    return;
  }

  if (incomingUrl.pathname === '/api' || incomingUrl.pathname.startsWith('/api/')) {
    proxyApi(req, res, incomingUrl);
    return;
  }

  serveStatic(req, res, incomingUrl);
});

server.on('error', function (err) {
  if (err.code === 'EADDRINUSE') {
    console.error('\n  Port ' + PORT + ' is already in use.');
    console.error('  Another copy of this dashboard is probably running.');
    const portHint = process.platform === 'win32'
      ? 'set PORT=5602 && node server.js'
      : 'PORT=5602 node server.js';
    console.error('  Set a different port, e.g.:  ' + portHint + '\n');
  } else {
    console.error('\n  Server error:', err.message, '\n');
  }
  process.exit(1);
});

server.listen(PORT, '127.0.0.1', function () {
  const url = 'http://localhost:' + PORT + '/';
  console.log('');
  console.log('  Activity Insights');
  console.log('  -----------------');
  console.log('  Dashboard : ' + url);
  console.log('  ActivityWatch API: ' + AW_URL);
  console.log('  Press Ctrl+C to stop.');
  console.log('');

  if (OPEN_BROWSER) {
    const command = process.platform === 'win32'
      ? ['cmd', ['/c', 'start', '', url]]
      : process.platform === 'darwin'
        ? ['open', [url]]
        : ['xdg-open', [url]];
    try {
      const child = spawn(command[0], command[1], { detached: true, stdio: 'ignore' });
      child.on('error', function () { /* browser opening is best-effort */ });
      child.unref();
    } catch (err) {
      /* ignore */
    }
  }
});
