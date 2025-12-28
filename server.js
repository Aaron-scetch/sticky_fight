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
const DEFAULT_MAP = "standard";

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

    const p = publicLobbies[socket.lobbyId].players[socket.id];
    p.ready = !p.ready;

    syncPublicLobbies();
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
  // DISCONNECT
  // -----------------------
  socket.on("disconnect", () => {
    leaveLobby(socket);
  });
});

// =======================
// LOBBY FUNKTIONEN
// =======================
function createAndJoinLobby(socket, name) {
  const lobbyId = generateId();

  lobbies[lobbyId] = {
    id: lobbyId,
    status: "menu",
    time: 0,
    map: DEFAULT_MAP,
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
    x: 0,
    y: 0,
    skin: "default",
    img: "",
    health: 100
  };

  publicLobbies[lobbyId].players[socket.id] = {
    id: socket.id,
    name: socket.playerName,
    ready: false
  };

  syncLobby(lobbyId);
  syncPublicLobbies();
}

function leaveLobby(socket) {
  const lobbyId = socket.lobbyId;
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