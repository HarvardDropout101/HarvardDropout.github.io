const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const path = require('path');
const cookieParser = require('cookie-parser');
const crypto = require('crypto');

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(path.join(__dirname, 'public')));
app.use(cookieParser());

const PASSWORD = "bruh"; // Change this to your desired password

// Store users by socket id
const users = {};
const userColors = {};
let messages = [];
const MESSAGE_LIFETIME_MS = 5 * 60 * 60 * 1000; // 5 hours in ms
let onlineCount = 0;
const typingUsers = new Set();

// Track device sessions: { deviceId: [username1, username2, ...] }
const deviceSessions = {};

// Track last username per deviceId
const deviceLastUsername = {};

function pruneOldMessages() {
  const now = Date.now();
  messages = messages.filter(msg => now - msg.timestamp < MESSAGE_LIFETIME_MS);
}

// Helper to check if a username is already in use
function isUsernameTaken(name) {
  return Object.values(users).some(u => u.toLowerCase() === name.toLowerCase());
}

// Helper to check if a color is already in use
function isColorTaken(color, socketId) {
  return Object.entries(userColors).some(([id, c]) => c.toLowerCase() === color.toLowerCase() && id !== socketId);
}

function broadcastOnlineCount() {
  io.emit('online count', onlineCount);
}

io.on('connection', (socket) => {
  // Get or assign deviceId from cookie
  let deviceId;
  if (socket.handshake.headers.cookie) {
    const cookies = Object.fromEntries(socket.handshake.headers.cookie.split(';').map(c => c.trim().split('=')));
    deviceId = cookies.deviceId;
  }
  if (!deviceId) {
    deviceId = crypto.randomBytes(16).toString('hex');
    // Send deviceId to client to set cookie
    setTimeout(() => socket.emit('set-device-id', deviceId), 100);
  }

  onlineCount++;
  broadcastOnlineCount();
  let authenticated = false;
  let username = null;
  let previousUsernames = [];

  socket.on('auth', ({ password, name, color, prevUsername }) => {
    if (password !== PASSWORD || !name || name.trim().length === 0) {
      socket.emit('auth-fail', { reason: 'invalid' });
      return;
    }
    if (isUsernameTaken(name.trim())) {
      socket.emit('auth-fail', { reason: 'username' });
      return;
    }
    if (!color || typeof color !== 'string' || isColorTaken(color, socket.id)) {
      socket.emit('auth-fail', { reason: 'color' });
      return;
    }
    // Compare with previous username sent by client
    let isNameChange = prevUsername && prevUsername.trim().length > 0 &&
      prevUsername.trim().toLowerCase() !== name.trim().toLowerCase();
    username = name.trim();
    users[socket.id] = username;
    userColors[socket.id] = color;
    authenticated = true;
    socket.emit('auth-success');
    pruneOldMessages();
    socket.emit('message history', messages);
    if (isNameChange) {
      io.emit('chat message', {
        user: 'System',
        text: `${prevUsername} has changed their name to ${username}.`,
        color: '#888',
        timestamp: Date.now()
      });
    } else {
      io.emit('chat message', {
        user: 'System',
        text: `${username} joined the chat.`,
        color: '#888',
        timestamp: Date.now()
      });
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
