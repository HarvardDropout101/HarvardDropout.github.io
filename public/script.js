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

let authenticated = false;
let currentColor = '#0984e3';

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
      socket.emit('chat message', input.value);
      input.value = '';
    }
  });
}

socket.on('chat message', function(msg) {
  const item = document.createElement('li');
  if (typeof msg === 'object' && msg.text && msg.user) {
    item.innerHTML = `<span style="color:${msg.color || '#0984e3'};font-weight:bold;">${msg.user}:</span> <span>${msg.text}</span>`;
  } else {
    item.textContent = msg;
  }
  messages.appendChild(item);
  messages.scrollTop = messages.scrollHeight;
});
