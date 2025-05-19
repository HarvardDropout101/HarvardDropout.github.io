const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));

const PASSWORD = "bruh"; // Change this to your desired password

// Store users by socket id
const users = {};
const userColors = {};

io.on('connection', (socket) => {
  let authenticated = false;
  let username = null;

  socket.on('auth', ({ password, name }) => {
    if (password === PASSWORD && name && name.trim().length > 0) {
      authenticated = true;
      username = name.trim();
      users[socket.id] = username;
      // Set default color for new user
      userColors[socket.id] = '#0984e3';
      socket.emit('auth-success');
      socket.broadcast.emit('chat message', `${username} joined the chat.`);
    } else {
      socket.emit('auth-fail');
    }
  });

  socket.on('set color', (color) => {
    if (authenticated && typeof color === 'string') {
      userColors[socket.id] = color;
    }
  });

  socket.on('chat message', (msg) => {
    if (authenticated && username) {
      io.emit('chat message', {
        user: username,
        text: msg,
        color: userColors[socket.id] || '#0984e3'
      });
    }
  });

  socket.on('disconnect', () => {
    if (authenticated && username) {
      socket.broadcast.emit('chat message', `${username} left the chat.`);
      delete users[socket.id];
      delete userColors[socket.id];
    }
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
