const express = require("express");
const fs = require("fs");
const path = require("path");
const fetch = require("node-fetch");
const multer = require("multer");
const session = require("express-session");
require("dotenv").config();

const app = express();
app.use(express.json());
app.use(express.static("public"));

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

app.post("/update-chart", (req, res) => {
  const { key, address } = req.body;
  if (key !== DEV_KEY) return res.status(403).json({ error: "Access denied" });
  fs.writeFileSync(CHART_FILE, JSON.stringify({ address }, null, 2));
  res.json({ success: true });
});

// === Dex Proxy ===
app.get("/dex/:pair", async (req, res) => {
  const pair = req.params.pair;
  try {
    const r = await fetch(`https://api.dexscreener.com/latest/dex/pairs/solana/${pair}`);
    if (!r.ok) throw new Error("Dex API error");
    res.json(await r.json());
  } catch (err) {
    res.status(500).json({ error: "Dex fetch failed", details: err.message });
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
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Upload Gallery Error:", err);
    res.status(500).json({ success: false });
  }
});

app.post("/verify-dev", (req, res) => {
  // 🧠 Skip re-check if already unlocked this session
  if (req.session?.devUnlocked) {
    console.log("[verify-dev] 🔁 Already unlocked for this session — skipping key check");
    return res.json({ valid: true });
  }

  const { key } = req.body;
  console.log("[verify-dev] received key:", JSON.stringify(key));
  console.log("[verify-dev] DEV_KEY loaded:", typeof DEV_KEY === "undefined" ? "MISSING" : "LOADED");

  const k = (key || "").toString().trim();
  const dev = (DEV_KEY || "").toString().trim();

  if (!dev) {
    console.warn("[verify-dev] DEV_KEY not set in environment!");
    return res.status(500).json({ valid: false, error: "Server DEV_KEY missing" });
  }

  if (k === dev) {
    req.session.devUnlocked = true;
    console.log("[verify-dev] ✅ keys match — dev unlocked for this session");
    return res.json({ valid: true });
  }

  console.log("[verify-dev] ❌ keys DO NOT match:", { received: k, expected: dev });
  res.json({ valid: false });
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
    console.log(`✅ Deleted NFT: ${target.name || "(unnamed)"}`);
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete Gallery Error:", err);
    res.status(500).json({ success: false, error: err.message });
  }
});


// === Move NFT to Sold ===
app.post("/move-to-sold", (req, res) => {
  const { key, name, soldPrice } = req.body;
  if (key !== DEV_KEY) return res.status(403).json({ error: "Access denied" });

  try {
    const gallery = JSON.parse(fs.readFileSync(GALLERY_FILE, "utf-8"));
    const solds = JSON.parse(fs.readFileSync(SOLD_FILE, "utf-8"));
    const nft = gallery.find((n) => n.name === name);
    if (!nft) return res.status(404).json({ success: false });

    const moved = { ...nft, price: soldPrice, soldDate: new Date().toISOString() };
    solds.push(moved);

    const updatedGallery = gallery.filter((n) => n.name !== name);
    fs.writeFileSync(GALLERY_FILE, JSON.stringify(updatedGallery, null, 2));
    fs.writeFileSync(SOLD_FILE, JSON.stringify(solds, null, 2));
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Move to Sold Error:", err);
    res.status(500).json({ success: false });
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
    res.json({ success: true });
  } catch (err) {
    console.error("❌ Delete Sold Error:", err);
    res.status(500).json({ success: false, error: "Failed to delete NFT" });
  }
});


// === Start Server ===
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`🚀 Server running on port ${PORT}`));

