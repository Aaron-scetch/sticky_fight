const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: { origin: "*" }
});

// 🔑 Zentrale Datenstruktur
let players = {};

io.on("connection", socket => {
  socket.on("state_update", (state) => {
    players[socket.id] = {
      ...players[socket.id],
      ...state
    };
  });

  socket.on("disconnect", () => {
    delete players[socket.id];
  });
});

const BROADCAST_RATE = 15;

setInterval(() => {
  io.emit("world_state", players);
}, 1000 / BROADCAST_RATE);

server.listen(process.env.PORT || 10000, () => {
  console.log("Server läuft");
});