const socket = io();

const authSection = document.getElementById('auth-section');
const authForm = document.getElementById('auth-form');
const passwordInput = document.getElementById('password');
const usernameInput = document.getElementById('username');
const authError = document.getElementById('auth-error');
const chatSection = document.getElementById('chat-section');
const form = document.getElementById('form');
const input = document.getElementById('input');
const messages = document.getElementById('messages');
const colorPicker = document.getElementById('color-picker');
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
    console.log('Submitting auth:', passwordInput.value, usernameInput.value);
    socket.emit('auth', {
      password: passwordInput.value,
      name: usernameInput.value
    });
  });
}

socket.on('auth-success', function() {
  console.log('Auth success');
  authenticated = true;
  authSection.style.display = 'none';
  chatSection.style.display = '';
  authError.style.display = 'none';
  input.focus();
});

socket.on('auth-fail', function() {
  console.log('Auth fail');
  authError.style.display = '';
  passwordInput.value = '';
  passwordInput.focus();
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

// Handle color picker
if (colorPicker) {
  colorPicker.addEventListener('input', function() {
    currentColor = colorPicker.value;
    socket.emit('set color', colorPicker.value);
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
