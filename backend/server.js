const http = require('http');
const fs = require('fs');
const path = require('path');
const chatHandler = require('./api/chat.js');

// Configurar dotenv (para simular el entorno Vercel localmente)
try {
  const envContent = fs.readFileSync(path.join(__dirname, '.env'), 'utf-8');
  envContent.split('\n').forEach(line => {
    const trimmedLine = line.trim();
    const match = trimmedLine.match(/^([^=]+)=(.*)$/);
    if (match) {
      process.env[match[1].trim()] = match[2].trim();
    }
  });
} catch (e) {
  console.log('No .env file found or error parsing it.');
}

const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.json': 'application/json'
};

const server = http.createServer(async (req, res) => {
  // CORS (opcional)
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

  if (req.method === 'OPTIONS') {
    res.writeHead(204);
    res.end();
    return;
  }

  // Routing para /api/chat
  if (req.url.startsWith('/api/chat')) {
    let bodyData = '';
    req.on('data', chunk => {
      bodyData += chunk.toString();
    });
    req.on('end', async () => {
      try {
        req.body = bodyData ? JSON.parse(bodyData) : {};
        
        // Mock res.status().json() methods for the Vercel handler
        const mockRes = {
          status: function(code) {
            this.statusCode = code;
            return this;
          },
          json: function(data) {
            res.writeHead(this.statusCode || 200, { 'Content-Type': 'application/json' });
            res.end(JSON.stringify(data));
          }
        };

        await chatHandler(req, mockRes);
      } catch (err) {
        console.error('Error handling API request:', err);
        res.writeHead(500, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: err.message || 'Internal Server Error' }));
      }
    });
    return;
  }

  // Static file serving
  let urlPath = req.url === '/' ? '/index.html' : req.url;
  urlPath = urlPath.split('?')[0];

  const filePath = path.join(__dirname, urlPath);

  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.writeHead(404, { 'Content-Type': 'text/plain' });
      res.end('404 Not Found');
      return;
    }

    const ext = path.extname(filePath);
    res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
    res.end(data);
  });
});

const PORT = 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}/`);
  console.log(`API endpoint available at http://localhost:${PORT}/api/chat`);
});
