const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const sessions = new Map(); // sid -> { world, clients: Set<ws> }

function freshW() {
  return {
    p1: { name:'--', classIdx:0, level:1, xp:0, xpNeeded:100, skillPoints:3, unlockedNodes:{}, lastSeen:0, spawnType:'', location:'', busyUntil:0, busyAction:null, busyXP:0, busyMsg:'' },
    p2: { name:'--', classIdx:1, level:1, xp:0, xpNeeded:100, skillPoints:3, unlockedNodes:{}, lastSeen:0, spawnType:'', location:'', busyUntil:0, busyAction:null, busyXP:0, busyMsg:'' },
    arcs:[], nemesis:null, log:[], dungeons:0, bosses:0, wars:0, infamy:0,
    worldEvent:null, worldEventExpiry:0, createdAt: Date.now()
  };
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      Object.entries(data).forEach(([sid, world]) => {
        sessions.set(sid, { world, clients: new Set() });
      });
      if (sessions.size > 0) console.log(`Restored ${sessions.size} session(s).`);
    }
  } catch(e) { console.error('Could not load sessions:', e.message); }
}

function saveSessions() {
  const data = {};
  sessions.forEach((session, sid) => { data[sid] = session.world; });
  try { fs.writeFileSync(SESSIONS_FILE, JSON.stringify(data)); } catch(e) {}
}

loadSessions();
app.use(express.static(path.join(__dirname, 'public')));

const server = app.listen(PORT, () => {
  console.log('╔══════════════════════════════════╗');
  console.log('║  AETHERMOOR  —  Dual Awakening   ║');
  console.log('╠══════════════════════════════════╣');
  console.log(`║  http://localhost:${PORT}           ║`);
  console.log('╚══════════════════════════════════╝');
  console.log('Share the URL + a session code with your partner.');
});

const wss = new WebSocketServer({ server });

wss.on('connection', (ws) => {
  ws.sid = null;

  ws.on('message', (raw) => {
    let msg;
    try { msg = JSON.parse(raw); } catch(e) { return; }

    if (msg.type === 'join' && msg.sid) {
      ws.sid = String(msg.sid).toUpperCase().slice(0, 10);
      if (!sessions.has(ws.sid)) {
        sessions.set(ws.sid, { world: freshW(), clients: new Set() });
        saveSessions();
      }
      const session = sessions.get(ws.sid);
      session.clients.add(ws);
      ws.send(JSON.stringify({ type: 'world', world: session.world }));
      console.log(`[${ws.sid}] player joined (${session.clients.size} in session)`);
    }

    if (msg.type === 'update' && ws.sid) {
      const session = sessions.get(ws.sid);
      if (!session) return;
      session.world = msg.world;
      saveSessions();
      session.clients.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'world', world: msg.world }));
        }
      });
    }

    if (msg.type === 'ping') {
      ws.send(JSON.stringify({ type: 'pong' }));
    }
  });

  ws.on('close', () => {
    if (ws.sid && sessions.has(ws.sid)) {
      const session = sessions.get(ws.sid);
      session.clients.delete(ws);
      console.log(`[${ws.sid}] player left (${session.clients.size} remaining)`);
    }
  });

  ws.on('error', () => {});
});
