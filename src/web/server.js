const express = require('express');
const path = require('path');
require('dotenv').config();

const apiRoutes = require('./routes/apiRoutes');
const campaignService = require('./services/CampaignService');

const app = express();
const PORT = process.env.WEB_PORT || 3000;

// Middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// SSE Connections
const sseConnections = new Set();

// Function to broadcast SSE message
function broadcastSSE(data) {
    const message = `data: ${JSON.stringify(data)}\n\n`;
    sseConnections.forEach(res => {
        try {
            res.write(message);
        } catch (error) {
            sseConnections.delete(res);
        }
    });
}

// SSE Endpoint
app.get('/api/events', (req, res) => {
    res.writeHead(200, {
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'Access-Control-Allow-Origin': '*'
    });

    sseConnections.add(res);
    res.write(`data: ${JSON.stringify({ type: 'connected', message: 'Connected to real-time updates' })}\n\n`);

    req.on('close', () => {
        sseConnections.delete(res);
    });
});

// Listen to CampaignService events and broadcast via SSE
campaignService.on('campaign_started', (data) => broadcastSSE({ type: 'campaign_started', ...data }));
campaignService.on('campaign_progress', (data) => broadcastSSE({ type: 'campaign_progress', ...data }));
campaignService.on('campaign_completed', (data) => broadcastSSE({ type: 'campaign_completed', ...data }));
campaignService.on('campaign_failed', (data) => broadcastSSE({ type: 'campaign_failed', ...data }));

// API Routes
app.use('/api', apiRoutes);

// Serve main dashboard
app.get('/', (req, res) => {
    res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

// Error handling
app.use((err, req, res, next) => {
    console.error(err.stack);
    res.status(500).json({ error: 'Something went wrong!' });
});

// Start server
app.listen(PORT, () => {
    console.log(`🚀 Business Leads AI Web Dashboard running on http://localhost:${PORT}`);
    console.log(`📊 Dashboard: http://localhost:${PORT}`);
    console.log(`🔌 API: http://localhost:${PORT}/api`);
});

module.exports = app;