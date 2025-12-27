const express = require("express");
const http = require("http");
const { Server } = require("socket.io");

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: "*", // für TEST ok
    methods: ["GET", "POST"]
  }
});

io.on("connection", (socket) => {
  console.log("Client verbunden:", socket.id);

  socket.on("test_message", (data) => {
    console.log("Nachricht erhalten:", data);

    socket.emit("test_response", {
      msg: "Hallo von Render.com 👋",
      time: new Date()
    });
  });

  socket.on("disconnect", () => {
    console.log("Client getrennt");
  });
});

const PORT = process.env.PORT || 10000;
server.listen(PORT, () => {
  console.log("Server läuft auf Port", PORT);
});