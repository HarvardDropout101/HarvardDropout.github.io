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
let messages = [];
const MESSAGE_LIFETIME_MS = 5 * 60 * 60 * 1000; // 5 hours in ms
let onlineCount = 0;
const typingUsers = new Set();

function pruneOldMessages() {
  const now = Date.now();
  messages = messages.filter(msg => now - msg.timestamp < MESSAGE_LIFETIME_MS);
}

function broadcastOnlineCount() {
  io.emit('online count', onlineCount);
}

io.on('connection', (socket) => {
  onlineCount++;
  broadcastOnlineCount();
  let authenticated = false;
  let username = null;

  // Send existing messages to new user
  socket.on('auth', ({ password, name }) => {
    if (password === PASSWORD && name && name.trim().length > 0) {
      authenticated = true;
      username = name.trim();
      users[socket.id] = username;
      userColors[socket.id] = '#0984e3';
      socket.emit('auth-success');
      // Prune and send messages
      pruneOldMessages();
      socket.emit('message history', messages);
      socket.broadcast.emit('chat message', {
        user: 'System',
        text: `${username} joined the chat.`,
        color: '#888',
        timestamp: Date.now()
      });
    } else {
      socket.emit('auth-fail');
    }
  });

  socket.on('set color', (color) => {
    if (authenticated && typeof color === 'string') {
      userColors[socket.id] = color;
    }
  });

  socket.on('typing', () => {
    if (authenticated && username) {
      typingUsers.add(username);
      socket.broadcast.emit('user typing', Array.from(typingUsers));
    }
  });

  socket.on('stop typing', () => {
    if (authenticated && username) {
      typingUsers.delete(username);
      socket.broadcast.emit('user typing', Array.from(typingUsers));
    }
  });

  socket.on('chat message', (msg) => {
    if (authenticated && username) {
      typingUsers.delete(username);
      socket.broadcast.emit('user typing', Array.from(typingUsers));
      pruneOldMessages();
      let message;
      if (typeof msg === 'object' && msg.type) {
        // Handle new message types
        message = {
          user: username,
          color: userColors[socket.id] || '#0984e3',
          timestamp: Date.now(),
          ...msg // type, text, data, url, emoji, etc.
        };
      } else {
        // Fallback for plain text
        message = {
          user: username,
          text: msg,
          color: userColors[socket.id] || '#0984e3',
          timestamp: Date.now(),
          type: 'text'
        };
      }
      // FIX: unwrap nested text for text messages
      if (message.type === 'text' && typeof message.text === 'object' && message.text.text) {
        message.text = message.text.text;
      }
      messages.push(message);
      io.emit('chat message', message);
    }
  });

  socket.on('disconnect', () => {
    if (authenticated && username) {
      typingUsers.delete(username);
      socket.broadcast.emit('user typing', Array.from(typingUsers));
      socket.broadcast.emit('chat message', {
        user: 'System',
        text: `${username} left the chat.`,
        color: '#888',
        timestamp: Date.now()
      });
      delete users[socket.id];
      delete userColors[socket.id];
    }
    onlineCount--;
    broadcastOnlineCount();
  });
});

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running on http://localhost:${PORT}`);
});
