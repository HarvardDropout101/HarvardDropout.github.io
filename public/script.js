const socket = io();

// Set deviceId cookie if server requests
socket.on('set-device-id', function(deviceId) {
  document.cookie = `deviceId=${deviceId}; path=/; max-age=31536000`;
  // Optionally reload to ensure deviceId is sent on next auth
  if (!document.cookie.includes(`deviceId=${deviceId}`)) {
    location.reload();
  }
});

const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const authColorPicker = document.getElementById('auth-color-picker');
const authError = document.getElementById('auth-error');
const chatSection = document.getElementById('chat-section');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const fileInput = document.getElementById('file-input');
const uploadBtn = document.getElementById('upload-btn');
const gifBtn = document.getElementById('gif-btn');
const emojiBtn = document.getElementById('emoji-btn');
const gifPicker = document.getElementById('gif-picker');
const emojiPicker = document.getElementById('emoji-picker');

let authenticated = false;
let currentColor = '#0984e3';
let typing = false;
let typingTimeout;

// Preset GIFs and Emojis
const presetGifs = [
  'https://media.giphy.com/media/3oEjI6SIIHBdRxXI40/giphy.gif',
  'https://media.giphy.com/media/l0MYt5jPR6QX5pnqM/giphy.gif',
  'https://media.giphy.com/media/ICOgUNjpvO0PC/giphy.gif',
  'https://media.giphy.com/media/5GoVLqeAOo6PK/giphy.gif',
  'https://media.giphy.com/media/ASd0Ukj0y3qMM/giphy.gif'
];
const presetEmojis = ['😀','😂','😍','😎','😭','👍','🎉','🔥','🥳','🤖'];

// Helper to format time ago
function timeAgo(timestamp) {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  if (diffMin < 1) return 'just now';
  if (diffMin === 1) return '1 minute ago';
  return `${diffMin} minutes ago`;
}

// Handle authentication
if (authForm) {
  authForm.addEventListener('submit', function(e) {
    e.preventDefault();
    const prevUsername = localStorage.getItem('chat_username') || '';
    const newUsername = usernameInput.value;
    socket.emit('auth', {
      password: passwordInput.value,
      name: newUsername,
      color: authColorPicker.value,
      prevUsername // send previous username
    });
    localStorage.setItem('chat_username', newUsername);
  });
}

socket.on('auth-success', function() {
  console.log('Auth success');
  authenticated = true;
  authSection.style.display = 'none';
  chatSection.style.display = '';
  authError.style.display = 'none';
  input.focus();
  checkDrawingAuth();
  showDrawingContainer();
  if (openDrawTab) openDrawTab.style.display = 'none';
});

socket.on('auth-fail', function(data) {
  let msg = 'Wrong password or username!';
  if (data && data.reason === 'username') {
    msg = 'Username is currently being used';
  } else if (data && data.reason === 'color') {
    msg = 'Chat color is currently being used';
  }
  authError.textContent = msg;
  authError.style.display = '';
  passwordInput.value = '';
  passwordInput.focus();
  authenticated = false;
  checkDrawingAuth();
  hideDrawingContainer();
  if (openDrawTab) openDrawTab.style.display = 'none';
});

// Show message history on login
socket.on('message history', function(history) {
  messages.innerHTML = '';
  history.forEach(function(msg) {
    addMessage(msg);
  });
});

// Typing indicator
input.addEventListener('input', function() {
  if (!authenticated) return;
  if (!typing) {
    typing = true;
    socket.emit('typing');
  }
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    typing = false;
    socket.emit('stop typing');
  }, 1200);
});
input.addEventListener('blur', function() {
  if (typing) {
    typing = false;
    socket.emit('stop typing');
  }
});

// Show typing indicator in chat
let typingIndicator = null;
socket.on('user typing', function(usernames) {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
  if (usernames && usernames.length > 0) {
    const names = usernames.join(', ');
    typingIndicator = document.createElement('li');
    typingIndicator.textContent = `${names} ${usernames.length === 1 ? 'is' : 'are'} typing...`;
    typingIndicator.style.color = '#aaa';
    typingIndicator.style.opacity = '0.6';
    typingIndicator.style.fontStyle = 'italic';
    typingIndicator.style.background = 'transparent';
    typingIndicator.id = 'typing-indicator';
    messages.appendChild(typingIndicator);
    messages.scrollTop = messages.scrollHeight;
  }
});

// Remove typing indicator on message
function removeTypingIndicator() {
  if (typingIndicator) {
    typingIndicator.remove();
    typingIndicator = null;
  }
}

function addMessage(msg) {
  removeTypingIndicator();
  const item = document.createElement('li');
  if (msg && typeof msg === 'object' && !Array.isArray(msg)) {
    // Unwrap nested text if present
    if (msg.type === 'text' && typeof msg.text === 'object' && msg.text.text) {
      msg.text = msg.text.text;
    }
    const ago = msg.timestamp ? `<span style="font-size:0.85em;color:#aaa;margin-left:8px;">${timeAgo(msg.timestamp)}</span>` : '';
    let content = '';
    if (msg.type === 'image' && typeof msg.data === 'string') {
      content = `<img src="${msg.data}" alt="image" style="max-width:180px;max-height:180px;border-radius:8px;vertical-align:middle;display:block;margin-top:6px;" />`;
    } else if (msg.type === 'gif' && typeof msg.url === 'string') {
      content = `<img src="${msg.url}" alt="gif" style="max-width:180px;max-height:180px;border-radius:8px;vertical-align:middle;display:block;margin-top:6px;" />`;
    } else if (msg.type === 'emoji' && typeof msg.emoji === 'string') {
      content = `<span style="font-size:2em;vertical-align:middle;">${msg.emoji}</span>`;
    } else if ((msg.type === 'text' || !msg.type) && typeof msg.text === 'string') {
      content = `<span>${msg.text}</span>`;
    } else if (msg.user === 'System' && typeof msg.text === 'string') {
      content = `<span style='color:#aaa;'>${msg.text}</span>`;
    } else if (typeof msg.text === 'string') {
      content = `<span>${msg.text}</span>`;
    } else {
      content = '';
    }
    const userLabel = (msg.user && msg.user !== 'System') ? `<span style=\"color:${msg.color || '#0984e3'};font-weight:bold;\">${msg.user}:</span> ` : (msg.user === 'System' ? `<span style=\"color:#aaa;font-weight:bold;\">System:</span> ` : '');
    item.innerHTML = `${userLabel}${content} ${ago}`;
  } else if (typeof msg === 'string') {
    item.textContent = msg;
  } else {
    item.textContent = '[unrenderable message]';
  }
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
}

// File upload logic
if (uploadBtn && fileInput) {
  uploadBtn.addEventListener('click', () => fileInput.click());
  fileInput.addEventListener('change', function() {
    const file = fileInput.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
      const base64 = e.target.result;
      socket.emit('chat message', {
        type: 'image',
        data: base64,
        name: file.name
      });
    };
    reader.readAsDataURL(file);
    fileInput.value = '';
  });
}

// GIF picker logic
if (gifBtn && gifPicker) {
  gifBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (gifPicker.style.display === 'none' || gifPicker.style.display === '') {
      gifPicker.style.display = 'block';
      gifPicker.innerHTML = '';
      presetGifs.forEach(url => {
        const img = document.createElement('img');
        img.src = url;
        img.style.width = '64px';
        img.style.margin = '6px';
        img.style.cursor = 'pointer';
        img.onclick = () => {
          socket.emit('chat message', { type: 'gif', url });
          gifPicker.style.display = 'none';
        };
        gifPicker.appendChild(img);
      });
    } else {
      gifPicker.style.display = 'none';
    }
  });
  document.addEventListener('click', (e) => {
    if (gifPicker.style.display === 'block' && !gifPicker.contains(e.target) && e.target !== gifBtn) {
      gifPicker.style.display = 'none';
    }
  });
}

// Emoji picker logic
if (emojiBtn && emojiPicker) {
  emojiBtn.addEventListener('click', (e) => {
    e.stopPropagation();
    if (emojiPicker.style.display === 'none' || emojiPicker.style.display === '') {
      emojiPicker.style.display = 'block';
      emojiPicker.innerHTML = '';
      presetEmojis.forEach(emoji => {
        const span = document.createElement('span');
        span.textContent = emoji;
        span.style.fontSize = '2em';
        span.style.margin = '8px';
        span.style.cursor = 'pointer';
        span.onclick = () => {
          socket.emit('chat message', { type: 'emoji', emoji });
          emojiPicker.style.display = 'none';
        };
        emojiPicker.appendChild(span);
      });
    } else {
      emojiPicker.style.display = 'none';
    }
  });
  document.addEventListener('click', (e) => {
    if (emojiPicker.style.display === 'block' && !emojiPicker.contains(e.target) && e.target !== emojiBtn) {
      emojiPicker.style.display = 'none';
    }
  });
}

// Handle chat
if (form) {
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    if (input.value && authenticated) {
      socket.emit('chat message', { type: 'text', text: input.value });
      input.value = '';
    }
  });
}

socket.on('chat message', function(msg) {
  // Support both legacy and new message formats
  const item = document.createElement('li');
  if (typeof msg === 'object' && msg !== null) {
    // Unwrap nested text if present (from new server)
    let text = msg.text;
    if (typeof text === 'object' && text && typeof text.text === 'string') {
      text = text.text;
    }
    let content = '';
    if (msg.type === 'image' && typeof msg.data === 'string') {
      content = `<img src="${msg.data}" alt="image" style="max-width:180px;max-height:180px;border-radius:8px;vertical-align:middle;display:block;margin-top:6px;" />`;
    } else if (msg.type === 'gif' && typeof msg.url === 'string') {
      content = `<img src="${msg.url}" alt="gif" style="max-width:180px;max-height:180px;border-radius:8px;vertical-align:middle;display:block;margin-top:6px;" />`;
    } else if (msg.type === 'emoji' && typeof msg.emoji === 'string') {
      content = `<span style="font-size:2em;vertical-align:middle;">${msg.emoji}</span>`;
    } else if (typeof text === 'string' && text.length > 0) {
      content = `<span>${text}</span>`;
    }
    if (msg.user && msg.user !== 'System') {
      item.innerHTML = `<span style="color:${msg.color || '#0984e3'};font-weight:bold;">${msg.user}:</span> ${content}`;
    } else if (msg.user === 'System' && typeof text === 'string') {
      item.innerHTML = `<span style='color:#aaa;'>${text}</span>`;
    } else {
      item.textContent = text || '';
    }
  } else {
    item.textContent = msg;
  }
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});

// Track online users
socket.on('connect', function() {
  // Existing connection logic
});

// Listen for online user count
socket.on('online count', function(count) {
  const onlineCount = document.getElementById('online-count');
  if (onlineCount) {
    onlineCount.textContent = `${count} online`;
  }
});

// === Group Drawing Board ===
const drawingContainer = document.getElementById('drawing-container');
const drawingHeader = document.getElementById('drawing-header');
const drawingMinBtn = null; // Remove minimize button logic
const drawingCloseBtn = document.getElementById('drawing-close-btn');
const openDrawTab = document.getElementById('open-draw-tab');
const canvas = document.getElementById('group-canvas');
const ctx = canvas ? canvas.getContext('2d') : null;
const brushColorInput = document.getElementById('brush-color');
const brushSizeInput = document.getElementById('brush-size');
const clearBtn = document.getElementById('clear-canvas');
const undoBtn = document.getElementById('undo-canvas');
// Per-user stroke history for undo
let myStrokes = [];
let allStrokes = [];
let drawing = false;
let lastX = 0, lastY = 0;
let brushColor = brushColorInput ? brushColorInput.value : '#0984e3';
let brushSize = brushSizeInput ? parseInt(brushSizeInput.value) : 6;
let drawingEnabled = false;
let remoteCursors = {};

function setDrawingEnabled(enabled) {
  drawingEnabled = enabled;
  if (canvas) canvas.style.pointerEvents = enabled ? 'auto' : 'none';
  if (brushColorInput) brushColorInput.disabled = !enabled;
  if (brushSizeInput) brushSizeInput.disabled = !enabled;
  if (clearBtn) clearBtn.disabled = !enabled;
  if (undoBtn) undoBtn.disabled = !enabled;
  if (drawingContainer) drawingContainer.style.opacity = enabled ? '1' : '0.6';
}

// Only allow drawing if logged in
function checkDrawingAuth() {
  setDrawingEnabled(authenticated);
}

// Draggable/closable logic
if (drawingHeader && drawingContainer) {
  let offsetX = 0, offsetY = 0, isDragging = false;
  drawingHeader.addEventListener('mousedown', (e) => {
    if (e.target.tagName === 'BUTTON') return;
    isDragging = true;
    const rect = drawingContainer.getBoundingClientRect();
    offsetX = e.clientX - rect.left;
    offsetY = e.clientY - rect.top;
    document.body.style.userSelect = 'none';
  });
  document.addEventListener('mousemove', (e) => {
    if (!isDragging) return;
    drawingContainer.style.left = (e.clientX - offsetX) + 'px';
    drawingContainer.style.top = (e.clientY - offsetY) + 'px';
    drawingContainer.style.right = 'auto';
    drawingContainer.style.position = 'fixed';
  });
  document.addEventListener('mouseup', () => {
    isDragging = false;
    document.body.style.userSelect = '';
  });
}
if (drawingCloseBtn && drawingContainer) {
  drawingCloseBtn.addEventListener('click', () => {
    hideDrawingContainer();
    remoteCursors = {};
    renderRemoteCursors();
  });
}
if (openDrawTab) {
  openDrawTab.addEventListener('click', () => {
    showDrawingContainer();
  });
}
// Restore if closed/minimized on login
function showDrawingContainer() {
  if (drawingContainer) {
    drawingContainer.classList.remove('drawing-hidden');
    drawingContainer.classList.remove('drawing-minimized');
  }
  if (openDrawTab) openDrawTab.style.display = 'none';
}
function hideDrawingContainer() {
  if (drawingContainer) drawingContainer.classList.add('drawing-hidden');
  if (openDrawTab) openDrawTab.style.display = '';
}
// Drawing events
if (canvas && ctx) {
  canvas.addEventListener('mousedown', (e) => {
    if (!drawingEnabled) return;
    drawing = true;
    [lastX, lastY] = [e.offsetX, e.offsetY];
  });
  canvas.addEventListener('mouseup', () => { drawing = false; });
  canvas.addEventListener('mouseout', () => { drawing = false; });
  canvas.addEventListener('mousemove', (e) => {
    if (!drawing || !drawingEnabled) return;
    const x = e.offsetX, y = e.offsetY;
    drawLine(lastX, lastY, x, y, brushColor, brushSize, true);
    [lastX, lastY] = [x, y];
    socket.emit('drawing-cursor', { x, y });
  });
}
function drawLine(x1, y1, x2, y2, color, size, emit, recordStroke = true) {
  ctx.strokeStyle = color;
  ctx.lineWidth = size;
  ctx.lineCap = 'round';
  ctx.beginPath();
  ctx.moveTo(x1, y1);
  ctx.lineTo(x2, y2);
  ctx.stroke();
  ctx.closePath();
  if (emit) {
    socket.emit('draw-line', { x1, y1, x2, y2, color, size });
  }
  if (recordStroke && drawingEnabled) {
    // Only record if this is the local user's stroke
    myStrokes.push({ x1, y1, x2, y2, color, size });
    allStrokes.push({ x1, y1, x2, y2, color, size, user: 'me' });
  } else if (recordStroke) {
    // For remote strokes
    allStrokes.push({ x1, y1, x2, y2, color, size, user: 'other' });
  }
}
socket.on('draw-line', ({ x1, y1, x2, y2, color, size }) => {
  if (ctx) drawLine(x1, y1, x2, y2, color, size, false, true);
});
if (undoBtn) {
  undoBtn.addEventListener('click', () => {
    if (!drawingEnabled || myStrokes.length === 0) return;
    myStrokes.pop();
    // Remove the last 'me' stroke from allStrokes
    let idx = -1;
    for (let i = allStrokes.length - 1; i >= 0; i--) {
      if (allStrokes[i].user === 'me') {
        idx = i;
        break;
      }
    }
    if (idx !== -1) allStrokes.splice(idx, 1);
    // Redraw everything
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    for (const s of allStrokes) {
      ctx.strokeStyle = s.color;
      ctx.lineWidth = s.size;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
      ctx.closePath();
    }
    // Notify others to re-sync (optional: not needed for local undo)
  });
}
if (brushColorInput) {
  brushColorInput.addEventListener('input', (e) => {
    brushColor = e.target.value;
  });
}
if (brushSizeInput) {
  brushSizeInput.addEventListener('input', (e) => {
    brushSize = parseInt(e.target.value);
  });
}
if (clearBtn) {
  clearBtn.addEventListener('click', () => {
    if (!drawingEnabled) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    myStrokes = [];
    allStrokes = [];
    socket.emit('clear-canvas');
    remoteCursors = {};
    renderRemoteCursors();
  });
}
socket.on('clear-canvas', () => {
  if (ctx) ctx.clearRect(0, 0, canvas.width, canvas.height);
  myStrokes = [];
  allStrokes = [];
  remoteCursors = {};
  renderRemoteCursors();
});
// Enable/disable drawing on auth
window.addEventListener('DOMContentLoaded', () => {
  checkDrawingAuth();
  hideDrawingContainer();
  if (openDrawTab) openDrawTab.style.display = 'none';
});

function renderRemoteCursors() {
  // Remove old cursor overlays
  let overlays = document.querySelectorAll('.remote-cursor');
  overlays.forEach(el => el.remove());
  for (const id in remoteCursors) {
    const c = remoteCursors[id];
    if (!c || !c.x || !c.y || !c.username) continue;
    const cursorDiv = document.createElement('div');
    cursorDiv.className = 'remote-cursor';
    cursorDiv.style.position = 'absolute';
    cursorDiv.style.left = (canvas.offsetLeft + c.x - 8) + 'px';
    cursorDiv.style.top = (canvas.offsetTop + c.y - 8) + 'px';
    cursorDiv.style.pointerEvents = 'none';
    cursorDiv.style.zIndex = 30;
    cursorDiv.innerHTML = `<svg width="16" height="16" style="vertical-align:middle;"><circle cx="8" cy="8" r="6" fill="${c.color || '#0984e3'}" stroke="#23262f" stroke-width="2"/></svg><span style="background:#23262f;color:${c.color || '#0984e3'};padding:2px 7px;border-radius:6px;font-size:0.95em;margin-left:2px;">${c.username}</span>`;
    canvas.parentNode.appendChild(cursorDiv);
  }
}
socket.on('drawing-cursor', ({ id, x, y, username, color }) => {
  remoteCursors[id] = { x, y, username, color };
  renderRemoteCursors();
  // Remove after 1.5s if no update
  clearTimeout(remoteCursors[id]?.timeout);
  remoteCursors[id].timeout = setTimeout(() => {
    delete remoteCursors[id];
    renderRemoteCursors();
  }, 1500);
});
