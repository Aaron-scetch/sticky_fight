const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// 🔑 Zentrale Datenstruktur
let players = [];

io.on("connection", (socket) => {
  console.log("Spieler verbunden:", socket.id);

  // 🟢 Spieler anlegen
  players.push({
    playerId: socket.id,
    data: {}
  });

  // 🔄 aktuelle Liste an alle senden
  io.emit("sync_players", players);

  // 📥 Daten vom Spieler empfangen
  socket.on("player_update", (playerData) => {
    const player = players.find(p => p.playerId === socket.id);
    if (player) {
      player.data = playerData;
    }

    // 🔄 Update an alle schicken
    io.emit("sync_players", players);
  });

  // 🔴 Spieler entfernen
  socket.on("disconnect", () => {
    console.log("Spieler getrennt:", socket.id);
    players = players.filter(p => p.playerId !== socket.id);

    io.emit("sync_players", players);
  });
});

server.listen(process.env.PORT || 10000, () => {
  console.log("Server läuft");
});