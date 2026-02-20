const express = require('express');
const fs = require('fs');
const path = require('path');

const app = express();
const port = process.env.PORT || 3000;
const logFilePath = path.join(__dirname, 'webhook_logs.log');

// Store recent requests in memory for the UI
let recentRequests = [];
const MAX_RECENT_REQUESTS = 50;

// SSE Clients
let clients = [];

// Ensure log file exists
if (!fs.existsSync(logFilePath)) {
    fs.writeFileSync(logFilePath, '');
} else {
    // Optionally load some history from log file if needed, 
    // but for now we'll just use in-memory for the session.
}

// Middleware to parse JSON and URL-encoded bodies
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files from 'public' directory
app.use(express.static(path.join(__dirname, 'public')));

// SSE Endpoint
app.get('/events', (req, res) => {
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.flushHeaders();

    const clientId = Date.now();
    const newClient = { id: clientId, res };
    clients.push(newClient);

    req.on('close', () => {
        clients = clients.filter(c => c.id !== clientId);
    });
});

// API to get recent logs
app.get('/api/logs', (req, res) => {
    res.json(recentRequests);
});

// POST endpoint for webhooks
app.post('/webhook', (req, res) => {
    const timestamp = new Date().toISOString();
    const logEntry = {
        id: Date.now() + Math.random().toString(36).substr(2, 9),
        timestamp,
        method: req.method,
        headers: req.headers,
        query: req.query,
        body: req.body
    };

    // Add to in-memory list
    recentRequests.unshift(logEntry);
    if (recentRequests.length > MAX_RECENT_REQUESTS) {
        recentRequests.pop();
    }

    // Broadcast via SSE
    clients.forEach(client => {
        client.res.write(`data: ${JSON.stringify(logEntry)}\n\n`);
    });

    const logString = `[${timestamp}] Incoming Webhook Request:\n${JSON.stringify(logEntry, null, 2)}\n${'-'.repeat(50)}\n`;

    // Append to log file
    fs.appendFile(logFilePath, logString, (err) => {
        if (err) {
            console.error('Error writing to log file:', err);
            return res.status(500).send('Internal Server Error');
        }
        console.log(`[${timestamp}] Webhook received and logged.`);
        res.status(200).send('Webhook received');
    });
});

app.listen(port, () => {
    console.log(`Webhook tester server listening at http://localhost:${port}`);
    console.log(`Logs will be written to: ${logFilePath}`);
    console.log(`UI available at http://localhost:${port}`);
});
