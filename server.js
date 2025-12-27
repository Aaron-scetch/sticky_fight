const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');

const app = express();
app.use(cors()); // Erlaubt Zugriff von deinem eigenen Server

const server = http.createServer(app);
const io = new Server(server, {
    cors: {
        origin: "*", // Erlaubt alle Quellen für den Test
        methods: ["GET", "POST"]
    }
});

io.on('connection', (socket) => {
    console.log('Ein User ist verbunden:', socket.id);

    socket.on('message', (msg) => {
        console.log('Nachricht erhalten:', msg);
        // Schickt die Nachricht an alle verbundenen Clients zurück
        io.emit('message', msg);
    });

    socket.on('disconnect', () => {
        console.log('User getrennt');
    });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, '0.0.0.0', () => {
    console.log(`Socket.IO Server läuft auf Port ${PORT}`);
});