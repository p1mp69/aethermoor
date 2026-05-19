const express = require('express');
const { WebSocketServer } = require('ws');
const path = require('path');
const fs = require('fs');

const app = express();
const PORT = process.env.PORT || 3000;
const SESSIONS_FILE = path.join(__dirname, 'sessions.json');
const sessions = new Map(); // sid -> { world, clients: Set<ws> }

function freshPlayer(classIdx) {
  return {
    name: '--', classIdx: classIdx, raceId: 'human',
    level: 1, xp: 0, xpNeeded: 100, skillPoints: 3,
    unlockedNodes: {}, lastSeen: 0,
    spawnType: '', location: '',
    busyUntil: 0, busyAction: null, busyXP: 0, busyMsg: '',
    inventory: [], equipped: { weapon: null, armor: null, accessory: null },
    resources: { stone: 0, wood: 0, crystals: 0, gold: 0 },
    hasOrg: false, baseLevel: 0,
    fame: 0, fameActions: { boss: 0, explore: 0, war: 0, nemesis: 0, org: 0, grind: 0, merchant: 0 },
    metNpcs: [], abilityCooldowns: {}, nextActionBoost: null, soulLinkActive: false,
    npcRelationships: {}, crew: [], career: null,
    careerProgress: { merchantActions: 0, meditateActions: 0, investigateActions: 0, goldEarned: 0, bossesKilled: 0, warsWon: 0, dungeonsCleared: 0, exploreActions: 0, grindActions: 0 },
    properties: [], revealedIntel: [],
    bossesKilled: 0, warsWon: 0, dungeonsCleared: 0,
    completedQuests: [], shadowGovHints: 0, politicsFactions: {},
    npcParty: [], questProgress: {}, worldModifiers: {},
    subClass: null, subClassPending: 0,
    learnedSpells: {}, magicMastery: {}, spellCooldowns: {},
    hp: null, maxHP: null,
    unlockedAchievements: [], factionStanding: {}, completedMilestones: []
  };
}

function freshW() {
  return {
    p1: freshPlayer(0), p2: freshPlayer(1), p3: freshPlayer(2), p4: freshPlayer(3),
    arcs: [], nemesis: null, log: [], dungeons: 0, bosses: 0, wars: 0, infamy: 0,
    worldEvent: null, worldEventExpiry: 0, worldBosses: [],
    createdAt: Date.now(), partyStatus: null, org: null,
    pvpState: {}, worldModifiers: {}, worldXPBoost: 1, maxPlayers: 4
  };
}

function patchPlayer(p) {
  if (!p) return freshPlayer(0);
  if (!p.inventory) p.inventory = [];
  if (!p.equipped) p.equipped = { weapon: null, armor: null, accessory: null };
  if (!p.resources) p.resources = { stone: 0, wood: 0, crystals: 0, gold: 0 };
  if (!p.raceId) p.raceId = 'human';
  if (!p.unlockedNodes) p.unlockedNodes = {};
  if (!p.metNpcs) p.metNpcs = [];
  if (!p.abilityCooldowns) p.abilityCooldowns = {};
  if (!p.npcRelationships) p.npcRelationships = {};
  if (!p.crew) p.crew = [];
  if (!p.npcParty) p.npcParty = [];
  if (!p.completedQuests) p.completedQuests = [];
  if (!p.revealedIntel) p.revealedIntel = [];
  if (!p.politicsFactions) p.politicsFactions = {};
  if (!p.careerProgress) p.careerProgress = { merchantActions: 0, meditateActions: 0, investigateActions: 0, goldEarned: 0, bossesKilled: 0, warsWon: 0, dungeonsCleared: 0, exploreActions: 0, grindActions: 0 };
  if (!p.questProgress) p.questProgress = {};
  if (!p.worldModifiers) p.worldModifiers = {};
  if (!p.fameActions) p.fameActions = { boss: 0, explore: 0, war: 0, nemesis: 0, org: 0, grind: 0, merchant: 0 };
  if (!p.spellCooldowns) p.spellCooldowns = {};
  if (!p.magicMastery) p.magicMastery = {};
  if (!p.learnedSpells) p.learnedSpells = {};
  if (p.hasOrg === undefined) p.hasOrg = false;
  if (p.shadowGovHints === undefined) p.shadowGovHints = 0;
  if (p.subClass === undefined) p.subClass = null;
  if (p.subClassPending === undefined) p.subClassPending = 0;
  if (p.nextActionBoost === undefined) p.nextActionBoost = null;
  if (p.soulLinkActive === undefined) p.soulLinkActive = false;
  if (p.career === undefined) p.career = null;
  if (!p.properties) p.properties = [];
  if (!p.fame) p.fame = 0;
  if (!p.baseLevel) p.baseLevel = 0;
  if (!p.bossesKilled) p.bossesKilled = 0;
  if (!p.warsWon) p.warsWon = 0;
  if (!p.dungeonsCleared) p.dungeonsCleared = 0;
  if (p.hp === undefined) p.hp = null;
  if (p.maxHP === undefined) p.maxHP = null;
  if (!p.unlockedAchievements) p.unlockedAchievements = [];
  if (!p.factionStanding) p.factionStanding = {};
  if (!p.completedMilestones) p.completedMilestones = [];
  if (p.mentor === undefined) p.mentor = null;
  if (p.lordDisciple === undefined) p.lordDisciple = null;
  if (!p.metLords) p.metLords = [];
  return p;
}

function patchWorld(w) {
  if (!w) return freshW();
  if (!w.p1) w.p1 = freshPlayer(0); else w.p1 = patchPlayer(w.p1);
  if (!w.p2) w.p2 = freshPlayer(1); else w.p2 = patchPlayer(w.p2);
  if (!w.p3) w.p3 = freshPlayer(2); else w.p3 = patchPlayer(w.p3);
  if (!w.p4) w.p4 = freshPlayer(3); else w.p4 = patchPlayer(w.p4);
  if (!w.arcs) w.arcs = [];
  if (!w.log) w.log = [];
  if (!w.worldBosses) w.worldBosses = [];
  if (!w.pvpState) w.pvpState = {};
  if (!w.worldModifiers) w.worldModifiers = {};
  if (w.nemesis === undefined) w.nemesis = null;
  if (w.worldEvent === undefined) w.worldEvent = null;
  if (w.worldEventExpiry === undefined) w.worldEventExpiry = 0;
  if (!w.worldXPBoost) w.worldXPBoost = 1;
  if (!w.maxPlayers) w.maxPlayers = 4;
  if (w.org === undefined) w.org = null;
  if (w.partyStatus === undefined) w.partyStatus = null;
  if (!w.createdAt) w.createdAt = Date.now();
  if (!w.dungeons) w.dungeons = 0;
  if (!w.bosses) w.bosses = 0;
  if (!w.wars) w.wars = 0;
  if (!w.infamy) w.infamy = 0;
  return w;
}

function loadSessions() {
  try {
    if (fs.existsSync(SESSIONS_FILE)) {
      const data = JSON.parse(fs.readFileSync(SESSIONS_FILE, 'utf8'));
      Object.entries(data).forEach(([sid, world]) => {
        sessions.set(sid, { world: patchWorld(world), clients: new Set() });
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
      // Always patch before sending so clients always get a complete world
      session.world = patchWorld(session.world);
      session.clients.add(ws);
      ws.send(JSON.stringify({ type: 'world', world: session.world }));
      console.log(`[${ws.sid}] player joined (${session.clients.size} in session)`);
    }

    if (msg.type === 'update' && ws.sid) {
      const session = sessions.get(ws.sid);
      if (!session) return;
      session.world = patchWorld(msg.world);
      saveSessions();
      session.clients.forEach(client => {
        if (client !== ws && client.readyState === 1) {
          client.send(JSON.stringify({ type: 'world', world: session.world }));
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
