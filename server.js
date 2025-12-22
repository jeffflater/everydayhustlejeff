const http = require('http');
const fs = require('fs');
const path = require('path');

const PORT = process.env.PORT || 3001;

const mimeTypes = {
    '.html': 'text/html',
    '.css': 'text/css',
    '.js': 'text/javascript',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
};

// Store connected SSE clients
const clients = [];

// Live reload script to inject into HTML
const liveReloadScript = `
<script>
(function() {
    const evtSource = new EventSource('/__livereload');
    evtSource.onmessage = function(e) {
        if (e.data === 'reload') {
            window.location.reload();
        }
    };
    evtSource.onerror = function() {
        console.log('Live reload disconnected. Reconnecting...');
        setTimeout(() => window.location.reload(), 2000);
    };
})();
</script>
</body>`;

const server = http.createServer((req, res) => {
    // Handle SSE endpoint for live reload
    if (req.url === '/__livereload') {
        res.writeHead(200, {
            'Content-Type': 'text/event-stream',
            'Cache-Control': 'no-cache',
            'Connection': 'keep-alive',
            'Access-Control-Allow-Origin': '*'
        });
        res.write('data: connected\n\n');

        clients.push(res);

        req.on('close', () => {
            const index = clients.indexOf(res);
            if (index > -1) clients.splice(index, 1);
        });
        return;
    }

    let filePath = req.url === '/' ? '/index.html' : req.url.split('?')[0];
    filePath = path.join(__dirname, filePath);

    const ext = path.extname(filePath).toLowerCase();
    const contentType = mimeTypes[ext] || 'application/octet-stream';

    fs.readFile(filePath, (err, content) => {
        if (err) {
            if (err.code === 'ENOENT') {
                res.writeHead(404, { 'Content-Type': 'text/html' });
                res.end('<h1>404 - File Not Found</h1>');
            } else {
                res.writeHead(500);
                res.end(`Server Error: ${err.code}`);
            }
        } else {
            // Inject live reload script into HTML files
            if (ext === '.html') {
                content = content.toString().replace('</body>', liveReloadScript);
            }
            res.writeHead(200, { 'Content-Type': contentType });
            res.end(content);
        }
    });
});

// Watch for file changes
const watchedExtensions = ['.html', '.css', '.js'];
let debounceTimer = null;

function notifyClients() {
    clients.forEach(client => {
        client.write('data: reload\n\n');
    });
}

fs.watch(__dirname, { recursive: false }, (eventType, filename) => {
    if (!filename) return;
    const ext = path.extname(filename).toLowerCase();
    if (watchedExtensions.includes(ext)) {
        // Debounce to avoid multiple reloads
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            console.log(`📝 File changed: ${filename}`);
            notifyClients();
        }, 100);
    }
});

server.listen(PORT, () => {
    console.log(`🔥 Everyday Hustle Jeff server running at http://localhost:${PORT}`);
    console.log(`🔄 Live reload enabled - watching for file changes`);
});
