// === LOBBY WEBSOCKET CLIENT ===

const socket = io();
let walletAddress = null;
let username = "Anonymous";

// DOM Elements
const messagesContainer = document.getElementById("messages");
const messageInput = document.getElementById("message-input");
const sendBtn = document.getElementById("send-btn");
const onlineCountEl = document.getElementById("online-count");
const walletDisplayEl = document.getElementById("lobby-wallet-display");

// === Sound System ===
const audioContext = new (window.AudioContext || window.webkitAudioContext)();

function playRetroSound(type = 'click') {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();

  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);

  switch(type) {
    case 'click':
      oscillator.frequency.value = 800;
      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.1);
      break;
    case 'message':
      oscillator.frequency.value = 1000;
      gainNode.gain.setValueAtTime(0.2, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.15);
      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.15);
      break;
    case 'join':
      oscillator.frequency.value = 600;
      gainNode.gain.setValueAtTime(0.25, audioContext.currentTime);
      oscillator.start(audioContext.currentTime);
      oscillator.frequency.exponentialRampToValueAtTime(800, audioContext.currentTime + 0.1);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.2);
      oscillator.stop(audioContext.currentTime + 0.2);
      break;
  }
}

// === Check for connected wallet ===
function checkWallet() {
  const savedWallet = localStorage.getItem("phantomWallet");
  if (savedWallet) {
    walletAddress = savedWallet;
    username = savedWallet.slice(0, 4) + "..." + savedWallet.slice(-4);
    walletDisplayEl.textContent = username;

    // Notify server that we have a wallet
    socket.emit("lobbyJoin", { username, walletAddress });
  } else {
    walletDisplayEl.textContent = "Not Connected (Anonymous)";
    username = "Anon" + Math.floor(Math.random() * 9999);

    // Join as anonymous
    socket.emit("lobbyJoin", { username, walletAddress: null });
  }
}

// === Add message to UI ===
function addMessage(data) {
  const messageDiv = document.createElement("div");
  messageDiv.className = data.system ? "message system" : "message";

  const time = new Date(data.timestamp || Date.now()).toLocaleTimeString('en-US', {
    hour: '2-digit',
    minute: '2-digit'
  });

  if (data.system) {
    messageDiv.innerHTML = `
      <span class="message-text">${escapeHtml(data.text)}</span>
      <span class="message-time">${time}</span>
    `;
  } else {
    messageDiv.innerHTML = `
      <span class="message-sender">${escapeHtml(data.username)}:</span>
      <span class="message-text">${escapeHtml(data.text)}</span>
      <span class="message-time">${time}</span>
    `;
  }

  messagesContainer.appendChild(messageDiv);
  messagesContainer.scrollTop = messagesContainer.scrollHeight;

  // Play sound for new messages
  if (!data.system) {
    playRetroSound('message');
  }
}

// === Escape HTML to prevent XSS ===
function escapeHtml(text) {
  const map = {
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  };
  return text.replace(/[&<>"']/g, m => map[m]);
}

// === Send message ===
function sendMessage() {
  const text = messageInput.value.trim();
  if (!text) return;

  playRetroSound('click');

  const message = {
    username,
    walletAddress,
    text,
    timestamp: Date.now()
  };

  socket.emit("lobbyMessage", message);
  messageInput.value = "";
}

// === Event Listeners ===
sendBtn.addEventListener("click", sendMessage);

messageInput.addEventListener("keypress", (e) => {
  if (e.key === "Enter") {
    sendMessage();
  }
});

// Add sound effects to buttons
sendBtn.addEventListener('mouseenter', () => playRetroSound('hover'));

function playHoverSound() {
  const oscillator = audioContext.createOscillator();
  const gainNode = audioContext.createGain();
  oscillator.connect(gainNode);
  gainNode.connect(audioContext.destination);
  oscillator.frequency.value = 600;
  gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
  gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.05);
  oscillator.start(audioContext.currentTime);
  oscillator.stop(audioContext.currentTime + 0.05);
}

document.querySelector('.back-btn').addEventListener('mouseenter', playHoverSound);

// === WebSocket Events ===

// Connection established
socket.on("connect", () => {
  console.log("🌐 Connected to lobby server:", socket.id);
  checkWallet();
  addMessage({
    system: true,
    text: "Connected to lobby server!",
    timestamp: Date.now()
  });
});

// Disconnection
socket.on("disconnect", () => {
  console.log("❌ Disconnected from lobby server");
  addMessage({
    system: true,
    text: "Disconnected from server. Trying to reconnect...",
    timestamp: Date.now()
  });
});

// Receive lobby message
socket.on("lobbyMessage", (data) => {
  addMessage(data);
});

// Update online count
socket.on("lobbyOnlineCount", (count) => {
  onlineCountEl.textContent = count;
});

// User joined notification
socket.on("userJoined", (data) => {
  playRetroSound('join');
  addMessage({
    system: true,
    text: `${data.username} joined the lobby!`,
    timestamp: Date.now()
  });
});

// User left notification
socket.on("userLeft", (data) => {
  addMessage({
    system: true,
    text: `${data.username} left the lobby.`,
    timestamp: Date.now()
  });
});

// Load message history
socket.on("lobbyHistory", (messages) => {
  messages.forEach(msg => {
    addMessage(msg);
  });
});

// Initialize on page load
window.addEventListener("load", () => {
  checkWallet();
  messageInput.focus();
});
