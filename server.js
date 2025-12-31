const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  },
  transports: ["polling", "websocket"]
});

// =======================
// KONSTANTEN
// =======================
const MAX_PLAYERS = 10;

// =======================
// LISTEN
// =======================
const lobbies = {};        // Liste 1
const publicLobbies = {};  // Liste 2
const attacks = {};        // Liste 3

// =======================
// SERVER STATUS
// =======================
let serverReady = false;

// Server "wacht auf"
setTimeout(() => {
  serverReady = true;
  console.log("Server ist wach");
}, 2000);

// =======================
// SOCKET HANDLING
// =======================
io.on("connection", socket => {
  console.log("Client:", socket.id);

  // -----------------------
  // SERVER STATUS
  // -----------------------
  socket.emit("server_status", {
    ready: serverReady,
    full: Object.keys(getAllPlayers()).length >= MAX_PLAYERS
  });

  // -----------------------
  // NAME SETZEN + START
  // -----------------------
  socket.on("set_name", name => {
    if (!serverReady) return;
    if (Object.keys(getAllPlayers()).length >= MAX_PLAYERS) {
      socket.emit("server_full");
      return;
    }
    socket.playerName = name;

    createAndJoinLobby(socket, name);
  });

  // -----------------------
  // READY TOGGLE
  // -----------------------
  socket.on("toggle_ready", () => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;

    lobby.players[socket.id].ready = !lobby.players[socket.id].ready;
    syncLobby(socket.lobbyId);
  });

  // -----------------------
  // VISIBLE TOGGLE
  // -----------------------
  socket.on("toggle_visible", () => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;

    lobby.players[socket.id].visible = !lobby.players[socket.id].visible;
    syncLobby(socket.lobbyId);
  });

  // -----------------------
  // MAP SETZEN
  // -----------------------
  socket.on("set_map", map => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;

    lobby.map = map;
    syncLobby(socket.lobbyId);
  });

  // -----------------------
  // SKIN SETZEN
  // -----------------------
  socket.on("set_skin", skin => {
    const lobby = lobbies[socket.lobbyId];
    if (!lobby) return;

    lobby.players[socket.id].skin = skin;
    syncLobby(socket.lobbyId);
  });

  // -----------------------
  // LOBBY WECHSEL
  // -----------------------
  socket.on("join_lobby", lobbyId => {
    if (!lobbies[lobbyId]) return;
    if (Object.keys(lobbies[lobbyId].players).length === 4) return;

    leaveLobby(socket);
    joinLobby(socket, lobbyId);
  });

  socket.on("new_empty_lobby", () => {
    leaveLobby(socket);
    createAndJoinLobby(socket, getPlayerName(socket));
  });

  // -----------------------
  // PLAYER SENDET DATEN
  // -----------------------
  socket.on("player_state", data => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId) return;

    const lobby = lobbies[lobbyId];
    if (!lobby) return;

    if (lobby.status === "menu") return;

    const player = lobby.players[socket.id];
    if (!player) return;

    player.x = data.x;
    player.y = data.y;
    player.health = data.health;
    player.img = data.img;
  });

  // -----------------------
  // DISCONNECT
  // -----------------------
  socket.on("disconnect", () => {
    leaveLobby(socket);
  });
});

// ------------------------
// Periodischer Lobby-Check
// ------------------------
const BROADCAST_RATE = 10;
setInterval(() => {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];
    const players = Object.values(lobby.players);

    // ------------------------
    // Spielstart prüfen
    // ------------------------
    if (lobby.status === "menu") {
      if (players.length >= 2 && players.every(p => p.ready)) {
        lobby.status = "game";
        publicLobbies[lobbyId].status = "game";
        lobby.time = 120;

        players.forEach(p => p.ready = false);

        syncPublicLobbies();
        console.log(`Lobby ${lobbyId} startet jetzt!`);
      }
    }

    // ------------------------
    // Spiel läuft -> Zeit hochzählen
    // ------------------------
    if (lobby.status === "game") {
      lobby.time -= 1 / BROADCAST_RATE;

      const alivePlayers = players.filter(p => p.health > 0);
      if (lobby.time <= 0 || alivePlayers.length <= 1) {
        lobby.status = "menu";
        publicLobbies[lobbyId].status = "menu";
        lobby.time = 120;

        players.forEach(p => p.ready = false);
        syncPublicLobbies();
        console.log(`Lobby ${lobbyId} zurück ins Menü`);
      }
    }

    // ------------------------
    // Lobby an Spieler senden
    // ------------------------
    syncLobby(lobbyId);
  }
}, 1000 / BROADCAST_RATE);

// =======================
// LOBBY FUNKTIONEN
// =======================

function createAndJoinLobby(socket, name) {
  const lobbyId = generateId();

  lobbies[lobbyId] = {
    id: lobbyId,
    status: "menu",
    time: 120,
    map: "map1",
    players: {}
  };

  publicLobbies[lobbyId] = {
    id: lobbyId,
    status: "menu",
    players: {}
  };

  attacks[lobbyId] = {};

  joinLobby(socket, lobbyId, name);
}

function joinLobby(socket, lobbyId) {
  socket.join(lobbyId);
  socket.lobbyId = lobbyId;

  lobbies[lobbyId].players[socket.id] = {
    id: socket.id,
    name: socket.playerName,
    ready: false,
    x: 0,
    y: 0,
    skin: "Stickman",
    img: "Stickman.png",
    health: 10,
    visible: true
  };

  publicLobbies[lobbyId].players[socket.id] = {
    id: socket.id,
    name: socket.playerName
  };

  syncLobby(lobbyId);
  syncPublicLobbies();
}

function leaveLobby(socket) {
  const lobbyId = socket.lobbyId;
  const prevLobbyId = socket.lobbyId;
  syncLobby(lobbyId);
  if (!lobbyId) return;

  delete lobbies[lobbyId].players[socket.id];
  delete publicLobbies[lobbyId].players[socket.id];

  socket.leave(lobbyId);
  socket.lobbyId = null;

  if (Object.keys(lobbies[lobbyId].players).length === 0) {
    delete lobbies[lobbyId];
    delete publicLobbies[lobbyId];
    delete attacks[lobbyId];
  }

  syncLobby(lobbyId);
  syncLobby(prevLobbyId);
  syncPublicLobbies();
}

// =======================
// SYNC
// =======================
function syncLobby(lobbyId) {
  io.to(lobbyId).emit("lobby_data", lobbies[lobbyId]);
}

function syncPublicLobbies() {
  io.emit("public_lobbies", publicLobbies);
}

// =======================
// HILFSFUNKTIONEN
// =======================
function getAllPlayers() {
  const all = {};
  for (const l in publicLobbies) {
    Object.assign(all, publicLobbies[l].players);
  }
  return all;
}

function getPlayerName(socket) {
  for (const l in lobbies) {
    if (lobbies[l].players[socket.id]) {
      return lobbies[l].players[socket.id].name;
    }
  }
  return "Player";
}

function generateId() {
  return Math.random().toString(36).substr(2, 6);
}

// =======================
server.listen(10000, () => {
  console.log("Server läuft auf 10000");
});

const SYNC_RATE = 30;

setInterval(() => {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];

    if (lobby.status === "menu") continue;

    const syncPlayers = {};

    for (const pid in lobby.players) {
      const p = lobby.players[pid];
      syncPlayers[pid] = {
        id: p.id,
        img: p.img,
        x: p.x,
        y: p.y,
        health: p.health
      };
    }

    io.to(lobbyId).emit("game_state", syncPlayers);
  }
}, 1000 / SYNC_RATE);