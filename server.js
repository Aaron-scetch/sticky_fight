const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

/*
  LOBBY STRUKTUR
  lobbies = {
    lobbyId: {
      id: string,
      players: {
        socketId: {
          id, x, y, hp
        }
      }
    }
  }
*/
const lobbies = {};
const MAX_PLAYERS = 10;
const BROADCAST_RATE = 15;

// =======================
// SOCKET HANDLING
// =======================
io.on("connection", (socket) => {
  console.log("Verbunden:", socket.id);

  // -----------------------
  // LOBBY ERSTELLEN
  // -----------------------
  socket.on("create_lobby", () => {
    const lobbyId = generateLobbyId();
    lobbies[lobbyId] = {
      id: lobbyId,
      players: {}
    };
    leaveLobby(socket);
    joinLobby(socket, lobbyId);
  });

  // -----------------------
  // LOBBY BEITRETEN
  // -----------------------
  socket.on("join_lobby", (lobbyId) => {
    if (!lobbies[lobbyId]) return;
    if (Object.keys(lobbies[lobbyId].players).length >= MAX_PLAYERS) return;

    leaveLobby(socket);
    joinLobby(socket, lobbyId);
  });

  // -----------------------
  // STATE UPDATE VOM CLIENT
  // -----------------------
  socket.on("state_update", (state) => {
    const lobbyId = socket.lobbyId;
    if (!lobbyId) return;

    const player = lobbies[lobbyId]?.players[socket.id];
    if (!player) return;

    // einfache Plausibilitätschecks
    if (Math.abs(state.x - player.x) > 100) return;
    if (Math.abs(state.y - player.y) > 100) return;

    player.x = state.x;
    player.y = state.y;
    player.hp = state.hp;
  });

  // -----------------------
  // DISCONNECT
  // -----------------------
  socket.on("disconnect", () => {
    leaveLobby(socket);
    console.log("Getrennt:", socket.id);
  });
});

// =======================
// BROADCAST TICK (LOBBY-WEISE)
// =======================
setInterval(() => {
  for (const lobbyId in lobbies) {
    const lobby = lobbies[lobbyId];
    io.to(lobbyId).emit("world_state", lobby.players);
  }
}, 1000 / BROADCAST_RATE);

// =======================
// HILFSFUNKTIONEN
// =======================
function joinLobby(socket, lobbyId) {
  leaveLobby(socket);

  socket.join(lobbyId);
  socket.lobbyId = lobbyId;

  lobbies[lobbyId].players[socket.id] = {
    id: socket.id
  };
  
  io.to(lobbyId).emit("lobby_update", lobbies[lobbyId]);
}

function leaveLobby(socket) {
  const lobbyId = socket.lobbyId;
  if (!lobbyId || !lobbies[lobbyId]) return;

  socket.leave(lobbyId);
  delete lobbies[lobbyId].players[socket.id];

  if (Object.keys(lobbies[lobbyId].players).length === 0) {
    delete lobbies[lobbyId];
  } else {
    io.to(lobbyId).emit("lobby_update", lobbies[lobbyId]);
  }

  socket.lobbyId = null;
}

function generateLobbyId() {
  return Math.random().toString(36).substr(2, 5);
}

// =======================
server.listen(process.env.PORT || 10000, () => {
  console.log("Server läuft");
});