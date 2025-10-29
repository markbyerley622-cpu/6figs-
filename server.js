let fetch;
try {
  // Prefer native fetch if available
  fetch = global.fetch || ((...args) => import('node-fetch').then(({ default: f }) => f(...args)));
} catch {
  // Fallback for environments without global.fetch
  fetch = (...args) => import('node-fetch').then(({ default: f }) => f(...args));
}




const express = require("express");
const fs = require("fs");
const path = require("path");
const multer = require("multer");
const session = require("express-session");
require("dotenv").config();
const cors = require("cors");
const compression = require("compression");

const http = require("http");
const { Server } = require("socket.io");


const app = express();

// ✅ Enable GZIP compression for faster page loading
app.use(compression());

app.use(express.json({ limit: "50mb" })); // ✅ increase payload size limit for base64 images
app.use(express.urlencoded({ limit: "50mb", extended: true }));

// ✅ Serve static files with caching for better performance
app.use(express.static("public", {
  maxAge: "1h", // Cache static files for 1 hour
  etag: true,
  lastModified: true
}));

app.use(cors());




// ✅ Serve Socket.IO client script (important for direct hosting)
app.use(
  "/socket.io",
  express.static(path.join(__dirname, "node_modules", "socket.io", "client-dist"))
);

const server = http.createServer(app);
const io = new Server(server);

// === Session setup ===
app.use(
  session({
    secret: process.env.SESSION_SECRET || "supersecretdevsession",
    resave: false,
    saveUninitialized: false,
    cookie: { secure: false }, // change to true if using HTTPS
  })
);

// === Paths ===
const UPLOADS_DIR = path.join(__dirname, "public", "uploads");
const GALLERY_FILE = path.join(__dirname, "gallery.json");
const SOLD_FILE = path.join(__dirname, "sold.json");
const CHART_FILE = path.join(__dirname, "chart.json");

const STATE_FILE = path.join(__dirname, "state.json");
if (!fs.existsSync(STATE_FILE)) fs.writeFileSync(STATE_FILE, JSON.stringify({}, null, 2));


if (!fs.existsSync(UPLOADS_DIR)) fs.mkdirSync(UPLOADS_DIR, { recursive: true });
if (!fs.existsSync(GALLERY_FILE)) fs.writeFileSync(GALLERY_FILE, "[]");
if (!fs.existsSync(SOLD_FILE)) fs.writeFileSync(SOLD_FILE, "[]");

const storage = multer.diskStorage({
  destination: (req, file, cb) => cb(null, UPLOADS_DIR),
  filename: (req, file, cb) => {
    const unique = Date.now() + "-" + Math.round(Math.random() * 1e6);
    cb(null, unique + path.extname(file.originalname));
  },
});
const upload = multer({ storage });

const DEV_KEY = process.env.DEV_KEY;

// === Chart Handling ===
app.get("/chart", (req, res) => {
  try {
    const data = JSON.parse(fs.readFileSync(CHART_FILE, "utf-8"));
    res.json(data);
  } catch {
    res.json({ address: "So11111111111111111111111111111111111111112" });
  }
});


// === Global State Get ===
app.get("/state", (req, res) => {
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    res.json(state);
  } catch {
    res.json({});
  }
});

// === Global State Update ===
app.post("/update-state", (req, res) => {
  const { key, updates } = req.body;
  if (key !== DEV_KEY) return res.status(403).json({ error: "Access denied" });

  try {
    const state = fs.existsSync(STATE_FILE)
      ? JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"))
      : {};

    // 🧠 Merge deeply to retain old values
const newState = structuredClone(state);

for (const key in updates) {
  if (updates[key] === null) {
    // ✅ Explicitly handle null values (for deleting nextPurchase, etc.)
    newState[key] = null;
  } else if (typeof updates[key] === "object" && !Array.isArray(updates[key])) {
    newState[key] = { ...(state[key] || {}), ...updates[key] };
  } else {
    newState[key] = updates[key];
  }
}

    fs.writeFileSync(STATE_FILE, JSON.stringify(newState, null, 2));

    // 🧩 Keep chart.json synced with contract address
    if (updates.contractAddress) {
      fs.writeFileSync(
        CHART_FILE,
        JSON.stringify({ address: updates.contractAddress }, null, 2)
      );
    }

    // ✅ Broadcast globally to all clients
    io.emit("stateUpdated", newState);

    // Also broadcast chart change (for iframe reloads)
    if (updates.contractAddress) io.emit("chartUpdated", { address: updates.contractAddress });

    res.json({ success: true, state: newState });
  } catch (err) {
    console.error("❌ Update State Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// === Upload Gallery ===
app.post("/upload-gallery", upload.array("images"), (req, res) => {
  try {
    // Ensure metas is always an array of objects
    let metas = [];
    if (Array.isArray(req.body.meta)) {
      metas = req.body.meta.map((m) => {
        try {
          return JSON.parse(m);
        } catch {
          return { name: "Unknown", price: "0" };
        }
      });
    } else if (req.body.meta) {
      try {
        metas = [JSON.parse(req.body.meta)];
      } catch {
        metas = [{ name: "Unknown", price: "0" }];
      }
    }

    const gallery = JSON.parse(fs.readFileSync(GALLERY_FILE, "utf-8"));

    req.files.forEach((file, i) => {
      const meta = metas[i] || { name: "Unknown", price: "0" };
      gallery.push({
        name: meta.name,
        price: meta.price,
        url: `/uploads/${file.filename}`,
        magicEdenUrl: meta.magicEdenUrl || "",
        date: new Date().toISOString(),
      });
    });

    fs.writeFileSync(GALLERY_FILE, JSON.stringify(gallery, null, 2));

// ✅ Broadcast globally
io.emit("galleryUpdated");

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Upload Gallery Error:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/verify-dev", (req, res) => {
  const { key } = req.body;
  const k = (key || "").toString().trim();
  const dev = (process.env.DEV_KEY || "").toString().trim();

  console.log("[verify-dev] received key:", k ? "****" : "(none)");
  console.log("[verify-dev] DEV_KEY loaded:", dev ? "OK" : "MISSING");

  if (!dev) {
    return res.status(500).json({ valid: false, error: "Server DEV_KEY missing" });
  }

  if (k === dev) {
    console.log("[verify-dev] ✅ keys match — dev unlocked");
    req.session.devUnlocked = true; // ✅ Set session flag
    return res.json({ valid: true });
  }

  console.log("[verify-dev] ❌ invalid key");
  res.status(403).json({ valid: false });
});


// === Gallery NFTs ===
app.get("/gallery", (req, res) => {
  try {
    const gallery = JSON.parse(fs.readFileSync(GALLERY_FILE, "utf-8"));
    res.json(gallery);
  } catch {
    res.json([]);
  }
});


// === Delete a specific NFT from Gallery ===
app.post("/delete-gallery", (req, res) => {
  if (!req.session?.devUnlocked) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  try {
    let gallery = JSON.parse(fs.readFileSync(GALLERY_FILE, "utf-8"));
    const { name, url } = req.body;

    if (!name && !url) {
      return res.status(400).json({ success: false, error: "Missing NFT identifier" });
    }

    // Find the NFT by name or URL
    const index = gallery.findIndex(
      (nft) =>
        (name && nft.name === name) ||
        (url && nft.url === url)
    );

    if (index === -1) {
      return res.status(404).json({ success: false, error: "NFT not found in gallery" });
    }

    // Remove the matching NFT
    const [target] = gallery.splice(index, 1);

    // Delete image file if it exists
    if (target.url) {
      const imgPath = path.join(__dirname, "public", target.url.replace(/^\/+/, ""));
      if (fs.existsSync(imgPath)) {
        fs.unlinkSync(imgPath);
        console.log(`🧹 Deleted image: ${imgPath}`);
      }
    }

    // Save updated gallery
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(gallery, null, 2));

// ✅ Notify everyone
io.emit("galleryUpdated");

    console.log(`✅ Deleted NFT: ${target.name || "(unnamed)"}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete Gallery Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});



// === Sold NFTs ===
app.get("/sold", (req, res) => {
  try {
    const solds = JSON.parse(fs.readFileSync(SOLD_FILE, "utf-8"));
    res.json(solds);
  } catch {
    res.json([]);
  }
});

app.post("/upload-sold", upload.array("images"), (req, res) => {
  try {
    const metas = Array.isArray(req.body.meta)
      ? req.body.meta.map((m) => JSON.parse(m))
      : [JSON.parse(req.body.meta)];

    const solds = JSON.parse(fs.readFileSync(SOLD_FILE, "utf-8"));

    req.files.forEach((file, i) => {
      const meta = metas[i] || { name: "Unknown", price: "0" };
      solds.push({
        name: meta.name,
        price: meta.price,
        url: `/uploads/${file.filename}`,
        date: new Date().toISOString(),
      });
    });

    fs.writeFileSync(SOLD_FILE, JSON.stringify(solds, null, 2));

// ✅ Broadcast globally
io.emit("soldUpdated");

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Upload Sold Error:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/delete-sold", (req, res) => {
  if (!req.session?.devUnlocked) {
    return res.status(403).json({ success: false, error: "Unauthorized" });
  }

  try {
    const { name } = req.body;
    if (!name) return res.status(400).json({ success: false, error: "Missing NFT name" });

    const soldData = JSON.parse(fs.readFileSync(SOLD_FILE, "utf8"));
    const updated = soldData.filter(
      (nft) => nft.name.trim().toLowerCase() !== name.trim().toLowerCase()
    );

    fs.writeFileSync(SOLD_FILE, JSON.stringify(updated, null, 2));

// ✅ Broadcast globally
io.emit("soldUpdated");

    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete Sold Error:", err);
    res.status(500).json({ success: false, error: "Failed to delete NFT" });
  }
});

// === Lobby System ===
const LOBBY_HISTORY_FILE = path.join(__dirname, "lobby-history.json");
if (!fs.existsSync(LOBBY_HISTORY_FILE)) fs.writeFileSync(LOBBY_HISTORY_FILE, "[]");

const lobbyUsers = new Map(); // Track connected users: socket.id -> { username, walletAddress }
const MAX_LOBBY_HISTORY = 100; // Keep last 100 messages

// Load lobby history
function getLobbyHistory() {
  try {
    return JSON.parse(fs.readFileSync(LOBBY_HISTORY_FILE, "utf-8"));
  } catch {
    return [];
  }
}

// Save lobby message to history
function saveLobbyMessage(message) {
  try {
    let history = getLobbyHistory();
    history.push(message);

    // Keep only last MAX_LOBBY_HISTORY messages
    if (history.length > MAX_LOBBY_HISTORY) {
      history = history.slice(-MAX_LOBBY_HISTORY);
    }

    fs.writeFileSync(LOBBY_HISTORY_FILE, JSON.stringify(history, null, 2));
  } catch (err) {
    console.error("❌ Error saving lobby message:", err);
  }
}

// Broadcast online count to all clients
function broadcastOnlineCount() {
  const count = lobbyUsers.size;
  io.emit("lobbyOnlineCount", count);
  console.log(`👥 Lobby users online: ${count}`);
}

io.on("connection", (socket) => {
  console.log("🌐 New client connected:", socket.id);

  // Send current state immediately
  try {
    const state = JSON.parse(fs.readFileSync(STATE_FILE, "utf-8"));
    socket.emit("stateUpdated", state);
  } catch {
    socket.emit("stateUpdated", {});
  }

  // === Lobby Events ===

  // User joins lobby
  socket.on("lobbyJoin", (data) => {
    const { username, walletAddress } = data;
    lobbyUsers.set(socket.id, { username, walletAddress });

    console.log(`🎮 ${username} joined the lobby`);

    // Send message history to the user
    const history = getLobbyHistory();
    socket.emit("lobbyHistory", history.slice(-50)); // Send last 50 messages

    // Notify all users
    io.emit("userJoined", { username });

    // Update online count
    broadcastOnlineCount();
  });

  // User sends message
  socket.on("lobbyMessage", (message) => {
    const user = lobbyUsers.get(socket.id);

    if (!user) {
      console.warn("⚠️ Message from non-lobby user:", socket.id);
      return;
    }

    // Add timestamp if not present
    if (!message.timestamp) {
      message.timestamp = Date.now();
    }

    console.log(`💬 [${user.username}]: ${message.text}`);

    // Save to history
    saveLobbyMessage(message);

    // Broadcast to all clients
    io.emit("lobbyMessage", message);
  });

  socket.on("disconnect", () => {
    const user = lobbyUsers.get(socket.id);

    if (user) {
      console.log(`❌ ${user.username} left the lobby`);
      lobbyUsers.delete(socket.id);

      // Notify all users
      io.emit("userLeft", { username: user.username });

      // Update online count
      broadcastOnlineCount();
    } else {
      console.log("❌ Client disconnected:", socket.id);
    }
  });
});

let cachedSolPrice = null;
let lastFetchTime = 0;

app.get("/sol-price", async (req, res) => {
  const TEN_MINUTES = 10 * 60 * 1000;
  const now = Date.now();

  // ✅ Serve cached value if it's fresh
  if (cachedSolPrice && now - lastFetchTime < TEN_MINUTES) {
    return res.json(cachedSolPrice);
  }

  try {
    const url = "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd";
    console.log("🌐 Fetching new SOL price from:", url);

    const r = await fetch(url);
    console.log("🔍 Fetch status:", r.status);

    if (!r.ok) throw new Error("Coingecko API failed");

    const data = await r.json();

    if (!data.solana || typeof data.solana.usd !== "number") {
      throw new Error("Invalid Coingecko data structure");
    }

    cachedSolPrice = data;
    lastFetchTime = now;

    res.json(data);
  } catch (err) {
    console.error("❌ SOL price fetch failed:", err);
    // fallback to last cached value or 0
    res.json(cachedSolPrice || { solana: { usd: 0 }, error: err.message });
  }
});



// === Start Server ===
const PORT = process.env.PORT || 3000;
server.listen(PORT, () => console.log(`🚀 Server running with WebSocket on port ${PORT}`));

