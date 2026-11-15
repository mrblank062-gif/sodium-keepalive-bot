const express = require('express');
const mineflayer = require('mineflayer');

const app = express();
const PORT = process.env.PORT || 3000;

let botStatus = 'Initializing';
let botInstance = null;
let keepAliveTimer = null;
let reconnectTimer = null;

const CONFIG = {
    host: '148.113.0.9',
    port: 25565,
    serverDomain: 'sodium.mcsh.gg',
    username: 'SodiumGhost',
    version: '1.21.1',
    reconnectDelay: 10000
};

function log(msg) {
    const time = new Date().toLocaleTimeString();
    console.log(`[${time}] [KeepAliveBot] ${msg}`);
}

function createBot() {
    if (reconnectTimer) {
        clearTimeout(reconnectTimer);
        reconnectTimer = null;
    }

    log(`Attempting connection to ${CONFIG.serverDomain} (${CONFIG.host}:${CONFIG.port}) as ${CONFIG.username}...`);
    botStatus = `Connecting to ${CONFIG.serverDomain}...`;

    try {
        botInstance = mineflayer.createBot({
            host: CONFIG.host,
            port: CONFIG.port,
            fakeHost: CONFIG.serverDomain,
            username: CONFIG.username,
            version: CONFIG.version,
            checkTimeoutInterval: 30000
        });
    } catch (err) {
        log(`Create error: ${err.message}. Retrying in ${CONFIG.reconnectDelay / 1000}s...`);
        scheduleReconnect();
        return;
    }

    botInstance.once('spawn', () => {
        botStatus = 'ONLINE & Connected (Server Held Awake 24/7)';
        log(`Successfully logged in and spawned! Server is now held awake 24/7.`);

        if (keepAliveTimer) clearInterval(keepAliveTimer);
        keepAliveTimer = setInterval(() => {
            if (botInstance && botInstance.entity) {
                try {
                    botInstance.swingArm('right');
                } catch (e) {}
            }
        }, 60000);
    });

    botInstance.on('kicked', (reason) => {
        let reasonStr = '';
        try {
            reasonStr = typeof reason === 'string' ? reason : JSON.stringify(reason);
        } catch (e) {
            reasonStr = String(reason);
        }
        botStatus = `Kicked: ${reasonStr}`;
        log(`Kicked / Disconnected: ${reasonStr}`);
        cleanupAndReconnect();
    });

    botInstance.on('end', (reason) => {
        botStatus = `Disconnected (${reason || 'ended'})`;
        log(`Connection closed (${reason || 'ended'}). Reconnecting in ${CONFIG.reconnectDelay / 1000}s...`);
        cleanupAndReconnect();
    });

    botInstance.on('error', (err) => {
        botStatus = `Socket error: ${err.message}`;
        log(`Socket / Protocol error: ${err.message}`);
        cleanupAndReconnect();
    });
}

function cleanupAndReconnect() {
    if (keepAliveTimer) {
        clearInterval(keepAliveTimer);
        keepAliveTimer = null;
    }
    if (botInstance) {
        try { botInstance.removeAllListeners(); } catch (e) {}
        try { botInstance.quit(); } catch (e) {}
        botInstance = null;
    }
    scheduleReconnect();
}

function scheduleReconnect() {
    if (reconnectTimer) return;
    reconnectTimer = setTimeout(() => {
        reconnectTimer = null;
        createBot();
    }, CONFIG.reconnectDelay);
}

// Start bot
createBot();

// HTTP server for Glitch / UptimeRobot 24/7 keep-alive ping
app.get('/', (req, res) => {
    res.json({
        service: 'SodiumSMP 24/7 Keep-Alive Ghost Bot',
        status: botStatus,
        botUser: CONFIG.username,
        server: CONFIG.serverDomain,
        uptimeSeconds: Math.floor(process.uptime()),
        timestamp: new Date().toISOString()
    });
});

app.get('/health', (req, res) => {
    res.status(200).send('OK');
});

app.listen(PORT, () => {
    log(`Web health server listening on port ${PORT}`);
});
