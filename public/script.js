console.log('[SCRIPT LOADED] 📜 script.js is loading...');
console.log('[SCRIPT INFO] Audio system is DISABLED - video background only');
console.log('[SCRIPT INFO] All AudioContext warnings should be eliminated');

// === AUDIO SYSTEM DISABLED (video only) ===
// No-op functions to prevent errors
function playRetroSound(type = 'click') {
  console.log(`[AUDIO DISABLED] playRetroSound('${type}') called but audio is disabled`);
  // Audio disabled - video only
}

function addSoundEffects() {
  console.log('[AUDIO DISABLED] addSoundEffects() called but audio is disabled');
  // Audio disabled - video only
}

// === DOM Elements ===
const solPriceEl = document.getElementById("sol-price");
const tokenPriceEl = document.getElementById("token-price");
const marketCapEl = document.getElementById("market-cap");
const changeEl = document.getElementById("change");
const nftCountEl = document.getElementById("nft-count");
const holdingEl = document.getElementById("holding");
const gallerySummary = document.getElementById("gallery-summary");
const galleryGrid = document.getElementById("gallery-grid");
const contractEl = document.getElementById("contract");


// === GLOBAL SOCKET.IO SYNC ===
const socket = io();

// 🔁 Live gallery refresh
socket.on("galleryUpdated", () => {
  console.log("🖼️ Gallery updated globally — refreshing...");
  loadGallery();
});

// 🔁 Live sold gallery refresh
socket.on("soldUpdated", () => {
  console.log("💸 Sold gallery updated globally — refreshing...");
  loadSoldGallery();
});

// 🔁 Live state sync (burn %, contract, next purchase, confetti)
socket.on("stateUpdated", (state) => {
  console.log("🌍 Global state updated:", state);

  // 🪙 Contract Address
  if (state.contractAddress) {
    document.getElementById("contract").textContent = state.contractAddress;
  }

  // 🔥 Burn Percent
  if (state.burnPercent !== undefined) {
    document.getElementById("burned-percent").textContent = `${state.burnPercent}% 🔥`;
  }

  // 💰 Token Stats (update globally when received)
  if (state.tokenStats) {
    const { price, liquidity, change24h, marketCap } = state.tokenStats;

    const tokenPriceEl = document.getElementById("token-price");
    const liquidityEl = document.getElementById("market-cap");
    const marketCapEl = document.getElementById("real-market-cap");
    const changeEl = document.getElementById("change");

    if (tokenPriceEl && price !== undefined)
      tokenPriceEl.textContent = `$${Number(price).toFixed(6)}`;

    if (liquidityEl && liquidity !== undefined)
      liquidityEl.textContent = `$${Number(liquidity).toFixed(2)}M`;

    if (marketCapEl && marketCap !== undefined)
      marketCapEl.textContent = `$${Number(marketCap).toFixed(2)}M`;

    if (changeEl && change24h !== undefined)
      changeEl.textContent = `${Number(change24h).toFixed(2)}%`;
  }

  // 🎯 Next NFT goal
  if (state.nextPurchase) {
    const next = state.nextPurchase;
    const container = document.getElementById("next-nft-preview");
    if (container) {
      container.innerHTML = `
        <div class="nft-card" onclick="window.open('${next.link}', '_blank')">
          <img src="${next.image}" alt="${next.name}" class="nft-img">
          <div class="nft-info">
            <p class="nft-name">${next.name}</p>
            <p class="nft-price">${next.price} SOL</p>
          </div>
        </div>
      `;
    }
    window.nextPurchasePrice = next.price;
    updateProgress();
  }

  // 🎉 Confetti trigger (no more polling)
  if (state.confetti) {
    console.log("🎉 Global confetti ON");
    launchConfetti();
  }
});



window.devUnlocked = false; // global flag to check if dev mode is unlocked


// === Global Confetti Trigger ===
function launchConfetti() {
  if (window.confettiActive) return; // prevent spam
  window.confettiActive = true;

  // Play success sound!
  playRetroSound('success');

  // Simple confetti burst using canvas-confetti (if included)
  if (window.confetti) {
    const duration = 5 * 1000;
    const end = Date.now() + duration;

    (function frame() {
      window.confetti({
        particleCount: 5,
        angle: 60,
        spread: 55,
        origin: { x: 0 },
      });
      window.confetti({
        particleCount: 5,
        angle: 120,
        spread: 55,
        origin: { x: 1 },
      });
      if (Date.now() < end) requestAnimationFrame(frame);
      else window.confettiActive = false;
    })();
  } else {
    console.warn("🎉 Confetti function not found (missing library)");
  }
}

// === Load Global Server State (instead of localStorage) ===
async function loadGlobalState() {
  try {
    const res = await fetch("/state");
    const state = await res.json();

    // 🪙 Contract Address
    if (state.contractAddress) {
      document.getElementById("contract").textContent = state.contractAddress;
    }

    // 🔥 Burn %
    if (state.burnPercent) {
      document.getElementById("burned-percent").textContent = `${state.burnPercent}% 🔥`;
    }

    // 💰 Token Stats (persisted globally)
    if (state.tokenStats) {
      const { price, liquidity, change24h, marketCap } = state.tokenStats;

      const tokenPriceEl = document.getElementById("token-price");
      const liquidityEl = document.getElementById("market-cap");
      const marketCapEl = document.getElementById("real-market-cap");
      const changeEl = document.getElementById("change");

      if (tokenPriceEl && price !== undefined)
        tokenPriceEl.textContent = `$${Number(price).toFixed(6)}`;

      if (liquidityEl && liquidity !== undefined)
        liquidityEl.textContent = `$${Number(liquidity).toFixed(2)}M`;

      if (marketCapEl && marketCap !== undefined)
        marketCapEl.textContent = `$${Number(marketCap).toFixed(2)}M`;

      if (changeEl && change24h !== undefined)
        changeEl.textContent = `${Number(change24h).toFixed(2)}%`;
    }

    // 🎯 Next NFT Goal
    if (state.nextPurchase) {
      const next = state.nextPurchase;
      const container = document.getElementById("next-nft-preview");
      if (container) {
        container.innerHTML = `
          <div class="nft-card" onclick="window.open('${next.link}', '_blank')">
            <img src="${next.image}" alt="${next.name}" class="nft-img">
            <div class="nft-info">
              <p class="nft-name">${next.name}</p>
              <p class="nft-price">${next.price} SOL</p>
            </div>
          </div>
        `;
      }
      window.nextPurchasePrice = next.price;
      updateProgress();
    }

  } catch (err) {
    console.warn("⚠️ Could not load global state:", err);
  }
}


// === Treasury Placeholder Values ===
let nftCount = 0;


// === Fetch SOL Price ===
async function fetchSolPrice() {
  try {
    // Get SOL price from backend
    const res = await fetch("/sol-price");
    const data = await res.json();
    const solPrice = data.solana.usd;

    // Update the UI
    solPriceEl.textContent = `$${solPrice.toFixed(2)}`;

  } catch (err) {
    console.error("❌ SOL price fetch error:", err);
    solPriceEl.textContent = "Error";
  }
}

// 🧠 Auto-run this when the page loads
fetchSolPrice();



// === Update Placeholder Stats for empty state ===
function updatePlaceholderStats() {
  tokenPriceEl.textContent = "$0.0000";
  marketCapEl.textContent = "$0.00M";
  document.getElementById("real-market-cap").textContent = "$0.00M";
  changeEl.textContent = "-0.00%";
  nftCountEl.textContent = `${nftCount}`;
  holdingEl.textContent = `${nftCount} Retardios`;
  gallerySummary.textContent = `RetardioStrategy™ is currently holding ${nftCount} NFTs`;
}




// === Token Loader (GeckoTerminal Edition) ===
const unlockTokenLoaderBtn = document.getElementById("pa");
const tokenLoaderDiv = document.getElementById("token-loader");
const contractInput = document.getElementById("token-contract");
const loadTokenBtn = document.getElementById("load-token");

unlockTokenLoaderBtn.addEventListener("click", async () => {
  const key = prompt("Enter dev key:");
  if (!key) return;

  try {
    const res = await fetch("/verify-dev", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ key })
    });
    const data = await res.json();

    if (data.valid) {
      tokenLoaderDiv.style.display = "block";
      unlockTokenLoaderBtn.style.display = "none";
      alert("Token loader unlocked! Paste a GeckoTerminal pool ID or contract.");
      window.devUnlocked = true; // ✅ same global flag
      localStorage.setItem("devKey", key);

      // ✅ Reload galleries to show delete buttons immediately
      loadGallery();
      loadSoldGallery();
    } else {
      alert("Wrong key!");
    }
  } catch (err) {
    console.error("Dev key verification failed:", err);
    alert("Error verifying key");
  }
});


// === Fetch Token Stats from GeckoTerminal ===
async function updateStats(poolId) {
  try {
    await fetchSolPrice(); // keep SOL price updated

    const res = await fetch(`https://api.geckoterminal.com/api/v2/networks/solana/pools/${poolId}`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    const attr = data.data?.attributes;

    if (!attr) throw new Error("Invalid response structure");

    // ✅ Extract stats
    const priceUsd = parseFloat(attr.base_token_price_usd) || 0;
    const change = parseFloat(attr.price_change_percentage.h24) || 0;
    const liquidity = parseFloat(attr.reserve_in_usd) || 0;
    const fdvUsd = parseFloat(attr.fdv_usd) || 0; // Fully diluted valuation (price × total supply)
    const marketCapUsd = fdvUsd || parseFloat(attr.market_cap_usd) || 0; // Prefer FDV which is price × supply

    // ✅ Update UI elements
    document.getElementById("token-price").textContent = `$${priceUsd.toFixed(6)}`;
    document.getElementById("market-cap").textContent = `$${(liquidity / 1_000_000).toFixed(2)}M`;
    document.getElementById("real-market-cap").textContent = `$${(marketCapUsd / 1_000_000).toFixed(2)}M`;
    document.getElementById("change").textContent = `${change.toFixed(2)}%`;

    // Get current NFT count from gallery
    const galleryCount = document.querySelectorAll("#gallery-grid .nft-card").length;
    document.getElementById("holding").textContent = `${galleryCount} Retardio${galleryCount !== 1 ? "s" : ""}`;

    // ✅ Update the live GeckoTerminal iframe (without rebuilding it)
    const geckoFrame = document.getElementById("gecko-frame");
    if (geckoFrame) {
      // Add fade-out / fade-in for smoother transitions
      geckoFrame.style.opacity = "0";
      setTimeout(() => {
        geckoFrame.src = `https://www.geckoterminal.com/solana/pools/${poolId}?embed=1&theme=dark`;
        geckoFrame.onload = () => {
          geckoFrame.style.transition = "opacity 0.8s ease";
          geckoFrame.style.opacity = "1";
        };
      }, 300);
    }

    // ✅ Save stats globally for all users
    if (window.devUnlocked) {
      await fetch("/update-state", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          key: localStorage.getItem("devKey"),
          updates: {
            tokenStats: {
              price: priceUsd,
              liquidity: liquidity / 1_000_000,
              marketCap: marketCapUsd / 1_000_000,
              change24h: change
            }
          }
        })
      });
      console.log("✅ Token stats saved globally");
    }

  } catch (err) {
    console.error("Error fetching token stats:", err);
    alert("Failed to load pool data: " + err.message);
  }
}


// === Load Token Button ===
loadTokenBtn.addEventListener("click", async () => {
  const poolId = contractInput.value.trim();
  if (!poolId) return alert("Paste a GeckoTerminal pool ID or token address first!");

  // ✅ Update contract field immediately
  const contractEl = document.getElementById("contract");
  contractEl.textContent = poolId;

// ✅ Save globally for all users
if (window.devUnlocked) {
  await fetch("/update-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: localStorage.getItem("devKey"),
      updates: { contractAddress: poolId }
    })
  });
  console.log("✅ Contract address saved globally");
}

  // ✅ Load stats
  await updateStats(poolId);
});


// === Global Treasury Gallery Load ===
async function loadGallery() {
  try {
    const res = await fetch("/gallery");
    const data = await res.json();
    const grid = document.getElementById("gallery-grid");
    grid.innerHTML = "";

    // --- Render each NFT ---
    data.forEach((nft) => {
      const card = document.createElement("div");
      card.className = "nft-card";

      const img = document.createElement("img");
      img.src = nft.url || "placeholder.png";
      img.alt = nft.name;
      img.className = "nft-img";

      const info = document.createElement("div");
      info.className = "nft-info";
      info.innerHTML = `
        <p class="nft-name">${nft.name}</p>
        <p class="nft-price">Listing Price: ${nft.price} SOL</p>
      `;

      const buyHint = document.createElement("div");
      buyHint.className = "buy-hint";
      buyHint.textContent = "💸 Click to Buy";

      card.appendChild(img);
      card.appendChild(info);
      card.appendChild(buyHint);

      // --- Developer Delete X ---
      if (window.devUnlocked) {
        const deleteBtn = document.createElement("div");
        deleteBtn.className = "delete-x";
        deleteBtn.textContent = "✕";

        deleteBtn.addEventListener("click", async (e) => {
          e.stopPropagation(); // prevent opening link
          const confirmDelete = confirm(`Delete this NFT?`);
          if (!confirmDelete) return;

          try {
            const res = await fetch("/delete-gallery", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                name: nft.name || null,
                url: nft.url || null
              })
            });
            const data = await res.json();

            if (data.success) {
              alert("✅ NFT deleted");
              loadGallery(); // refresh gallery
            } else {
              alert("❌ Failed to delete NFT: " + (data.error || "Unknown error"));
            }
          } catch (err) {
            console.error("Delete failed:", err);
            alert("Error deleting NFT");
          }
        });

        card.appendChild(deleteBtn);
      }

      // --- Click to Buy behavior ---
      card.addEventListener("click", () => {
        playRetroSound('coin'); // Play coin sound when clicking NFT!
        const url =
          nft.magicEdenUrl ||
          `https://magiceden.io/item-details/${encodeURIComponent(nft.id)}`;
        window.open(url, "_blank");
      });

      grid.appendChild(card);
    });

    // Re-add sound effects to newly loaded NFT cards
    addSoundEffects();

    // === ✅ Update stats ===
    const currentCount = data.length;

    // Update UI with current count (not all-time)
    document.getElementById("gallery-summary").textContent =
      `RetardioStrategy™ is currently holding ${currentCount} NFT${currentCount !== 1 ? "s" : ""}`;
    document.getElementById("holding").textContent =
      `${currentCount} Retardio${currentCount !== 1 ? "s" : ""}`;
    document.getElementById("nft-count").textContent = currentCount;

  } catch (err) {
    console.warn("loadGallery failed:", err);
  }
}




// === Global Sold Gallery Load ===
async function loadSoldGallery() {
  try {
    const res = await fetch("/sold");
    const data = await res.json();
    const grid = document.getElementById("sold-gallery-grid");
    grid.innerHTML = "";

    data.forEach((nft) => {
      const card = document.createElement("div");
      card.className = "nft-card";

      const img = document.createElement("img");
      img.src = nft.url || "placeholder.png";
      img.alt = nft.name;
      img.className = "nft-img";

      const info = document.createElement("div");
      info.className = "nft-info";
      info.innerHTML = `
        <p class="nft-name">${nft.name}</p>
        <p class="nft-price">Sold for ${nft.price} SOL</p>
      `;

      card.appendChild(img);
      card.appendChild(info);

      // --- Developer Delete X ---
      if (window.devUnlocked) {
        const deleteX = document.createElement("div");
        deleteX.className = "delete-x";
        deleteX.textContent = "✖";
        deleteX.title = "Delete Sold NFT";

        deleteX.addEventListener("click", async (e) => {
          e.stopPropagation();
          if (!confirm(`🧹 Delete sold NFT "${nft.name}"?`)) return;

          const resp = await fetch("/delete-sold", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ name: nft.name }),
          });

          const result = await resp.json();
          if (!result.success) {
            alert(result.error || "❌ Failed to delete NFT (not authorized?)");
            return;
          }

          alert("✅ Sold NFT deleted");
          loadSoldGallery(); // ✅ Reload gallery to sync state
        });

        card.appendChild(deleteX);
      }

      grid.appendChild(card);
    });

    document.getElementById("sold-summary").textContent =
      `RetardioStrategy™ has sold ${data.length} NFTs`;

  } catch (err) {
    console.warn("loadSoldGallery failed:", err);
  }
}




//np
document.addEventListener("DOMContentLoaded", () => {
  const npBtn = document.getElementById("np");
  const fileInput = document.getElementById("next-nft-upload");

  if (!npBtn || !fileInput) return console.error("Missing #np or #next-nft-upload element!");

  npBtn.addEventListener("click", () => {
    if (!window.devUnlocked) return alert("🚫 Developer mode required.");

    fileInput.click();

    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const name = prompt("Enter NFT Name:");
      const price = parseFloat(prompt("Enter Listing Price (SOL):"));
      const link = prompt("Enter NFT Listing URL (optional):");

      if (isNaN(price) || price <= 0) return alert("❌ Invalid price!");

      const reader = new FileReader();

      reader.onload = async (e) => {
        const imageData = e.target.result;

        const nextNFTContainer = document.getElementById("next-nft-preview");
        if (!nextNFTContainer) return alert("⚠️ next-nft-preview not found in DOM!");

        // 🖼️ Update preview instantly
        nextNFTContainer.innerHTML = `
          <div class="nft-card" onclick="window.open('${link}', '_blank')">
            <img src="${imageData}" alt="${name}" class="nft-img">
            <div class="nft-info">
              <p class="nft-name">${name}</p>
              <p class="nft-price">${price.toFixed(2)} SOL</p>
            </div>
          </div>
        `;

        // 💾 Update progress vars
        window.nextPurchasePrice = price;

        alert(`Next purchase goal set to ${price} SOL`);

        // ✅ Save to global server state (AFTER reader finished)
        if (window.devUnlocked) {
          try {
            const res = await fetch("/update-state", {
              method: "POST",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({
                key: localStorage.getItem("devKey"),
                updates: {
                  nextPurchase: {
                    name,
                    price,
                    link,
                    image: imageData, // ✅ correct — fully loaded image
                  },
                },
              }),
            });

            const result = await res.json();
            console.log("✅ nextPurchase saved:", result);
          } catch (err) {
            console.error("❌ Failed to save nextPurchase:", err);
          }
        }
      };

      // ⏩ Start reading the file
      reader.readAsDataURL(file);
    };
  });
});



// === Sold Gallery Elements ===
const soldGrid = document.getElementById("sold-gallery-grid");
const soldSummary = document.getElementById("sold-summary");
const soldUpload = document.getElementById("sold-upload");


const treasuryEl = document.getElementById("Treasury");

// Your Solana wallet address
const walletAddress = "E1AJ5rcPiErwNGJa9E5g8nVFvDijJAj5Fo2j7MSS8ta4";

// Update the text and link
treasuryEl.textContent = walletAddress;
treasuryEl.href = `https://solscan.io/account/${walletAddress}`;

// === Progress tracking globals & config ===
window.nextPurchasePrice = 0; // in SOL (global so other inline handlers can set it)
let currentSolBalance = 0;
const SOLANA_RPC = "https://mainnet.helius-rpc.com/?api-key=1a1e3f5e-0b60-4bfa-bbb1-c76b460671ae";

// --- Fetch SOL balance (uses getBalance RPC) ---
async function fetchSolBalance() {
  try {
    const resp = await fetch(SOLANA_RPC, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        jsonrpc: "2.0",
        id: 1,
        method: "getBalance",
        params: [walletAddress],
      }),
    });
    const json = await resp.json();
    const lamports = json?.result?.value;
    if (typeof lamports !== "number") throw new Error("Invalid balance response");
    return lamports / 1e9;
  } catch (err) {
    console.warn("fetchSolBalance error:", err);
    return 0;
  }
}

// --- Update the progress bar UI ---
async function updateProgress() {
  const progressFill = document.getElementById("progress-fill");
  const progressPercent = document.getElementById("progress-percent");
  const needSolEl = document.getElementById("need-sol");
  const missingSolEl = document.getElementById("missing-sol");
  const progressSection = document.querySelector(".progress-section");
  const nextNFT = document.querySelector("#next-nft-container img");
  if (!progressFill || !progressPercent || !needSolEl || !missingSolEl) return;

  // No goal set yet
  if (!window.nextPurchasePrice || window.nextPurchasePrice <= 0) {
    progressFill.style.width = "0%";
    progressPercent.textContent = "0%";
    needSolEl.textContent = "0.000";
    missingSolEl.textContent = "0.0000";
    progressFill.style.background = "#9945FF";
    progressFill.classList.remove("glow");
    progressPercent.classList.remove("surge");
    progressSection.classList.remove("active");
    if (nextNFT) nextNFT.style.filter = "brightness(0.8)";
    return;
  }

  // Get current SOL and calculate
  currentSolBalance = await fetchSolBalance();
  const progress = Math.min((currentSolBalance / window.nextPurchasePrice) * 100, 100);
  const remaining = Math.max(window.nextPurchasePrice - currentSolBalance, 0);

  // Update bar + numbers
  progressFill.style.width = `${progress.toFixed(1)}%`;
  progressPercent.textContent = `${progress.toFixed(1)}%`;
  needSolEl.textContent = remaining.toFixed(3);
  missingSolEl.textContent = remaining.toFixed(4);

  // === DOPAMINE VISUAL EFFECTS ===
  if (progress >= 100 && !window.confettiActive) {
    window.confettiActive = true; // prevent double-trigger

    // 🪙 READY — full Solana glow
    progressFill.style.background = "linear-gradient(90deg, #14F195, #9945FF)";
    progressFill.style.boxShadow = "0 0 60px #14F195, 0 0 120px #9945FF";
    progressPercent.textContent = "READY 🪙";
    progressPercent.style.color = "#14F195";
    progressPercent.style.textShadow = "0 0 15px #14F195, 0 0 40px #9945FF";
    progressFill.classList.add("glow");
    progressPercent.classList.add("surge");
    progressSection.classList.add("active");

    if (nextNFT) {
      nextNFT.style.filter = "brightness(1.3) drop-shadow(0 0 30px #14F195)";
      nextNFT.style.transform = "rotate(0deg)";
    }

    // 🎉 Trigger confetti celebration for 10 seconds
    launchConfetti();


// 🌍 Tell the server to trigger global confetti
fetch("/update-state", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    key: localStorage.getItem("devKey"),
    updates: { confetti: true }
  })
});


    const confettiDuration = 10000; // 10s
    setTimeout(() => {
      window.confettiActive = false;

// 🌍 Reset global confetti flag
fetch("/update-state", {
  method: "POST",
  headers: { "Content-Type": "application/json" },
  body: JSON.stringify({
    key: localStorage.getItem("devKey"),
    updates: { confetti: false }
  })
});




      // 🧹 Reset everything
      progressFill.style.width = "0%";
      progressPercent.textContent = "0%";
      progressFill.style.background = "#9945FF";
      progressFill.classList.remove("glow");
      progressPercent.classList.remove("surge");
      progressSection.classList.remove("active");
      needSolEl.textContent = "0.000";
      missingSolEl.textContent = "0.0000";
      progressPercent.style.color = "#fff";
      progressPercent.style.textShadow = "none";
      window.nextPurchasePrice = 0;

      // Remove the current NFT image
      if (nextNFT) nextNFT.remove();

    }, confettiDuration);

  } else if (progress >= 90) {
    // ⚡ Charging up — Solana neon pulse
    progressFill.style.background = "linear-gradient(90deg, #9945FF, #14F195)";
    progressFill.style.boxShadow = "0 0 40px #14F195a0, 0 0 80px #9945FFa0";
    progressFill.classList.add("glow");
    progressPercent.classList.add("surge");
    progressSection.classList.add("active");
    progressPercent.style.color = "#14F195";
    progressPercent.style.textShadow = "0 0 10px #14F195, 0 0 20px #9945FF";

    // NFT "charging" effect
    if (nextNFT) {
      nextNFT.style.filter = "brightness(1.2) drop-shadow(0 0 20px #14F195a0)";
      nextNFT.style.transition = "transform 1.5s ease-in-out";
      nextNFT.style.transform = "rotate(1deg)";
      setTimeout(() => (nextNFT.style.transform = "rotate(-1deg)"), 1500);
    }
  } else {
    // 🟣 Normal progress
    progressFill.style.background = "linear-gradient(90deg, #ff4fd8, #9945FF)";
    progressFill.style.boxShadow = "0 0 15px #ff4fd880";
    progressFill.classList.remove("glow");
    progressPercent.classList.remove("surge");
    progressSection.classList.remove("active");
    progressPercent.style.color = "#fff";
    progressPercent.style.textShadow = "0 0 8px #ff4fd8, 0 0 15px #ff82e4";
    if (nextNFT) nextNFT.style.filter = "brightness(1)";
  }
}

// Expose a setter so other (inline) scripts can set the goal easily
window.setNextPurchasePrice = function (price) {
  const p = Number(price);
  if (isNaN(p) || p <= 0) return;
  window.nextPurchasePrice = p;
  updateProgress();
};





socket.on("chartUpdated", ({ address }) => {
  console.log("📊 Chart updated globally:", address);
  const chartFrame = document.getElementById("gecko-frame");
  if (chartFrame) {
    chartFrame.src = `https://www.geckoterminal.com/solana/pools/${address}?embed=1&theme=dark`;
  }
  // Also update the contract address display at top
  const contractEl = document.getElementById("contract");
  if (contractEl) {
    contractEl.textContent = address;
  }
});



// === Expose functions globally (for debugging or reuse) ===
window.loadGallery = loadGallery;
window.loadSoldGallery = loadSoldGallery;
window.loadGlobalState = loadGlobalState;
window.updateProgress = updateProgress;
window.updateStats = updateStats;
window.launchConfetti = launchConfetti;


// === SPACE INVADERS GAME FOR DASHBOARD BOX ===
function initDashboardSpaceInvaders() {
  const canvas = document.getElementById('dashboardGameCanvas');
  if (!canvas) return;

  const ctx = canvas.getContext('2d');
  const dashboard = canvas.parentElement;

  // Set canvas size to match dashboard
  function resizeCanvas() {
    canvas.width = dashboard.offsetWidth;
    canvas.height = dashboard.offsetHeight;
  }
  resizeCanvas();
  window.addEventListener('resize', resizeCanvas);

  // Space Invader class
  class DashboardInvader {
    constructor() {
      this.x = Math.random() * canvas.width;
      this.y = Math.random() * canvas.height;
      this.size = 30 + Math.random() * 20;
      this.dx = (Math.random() - 0.5) * 1.2;
      this.dy = (Math.random() - 0.5) * 0.5;
      this.animFrame = 0;
      this.animSpeed = 0.08;
      this.type = Math.floor(Math.random() * 3);
      this.colors = ['#00FF00', '#FF00FF', '#00FFFF', '#FFFF00'];
      this.color = this.colors[Math.floor(Math.random() * this.colors.length)];
    }

    draw() {
      this.x += this.dx;
      this.y += this.dy;
      this.animFrame += this.animSpeed;

      // Bounce off edges
      if (this.x < 0 || this.x > canvas.width) this.dx *= -1;
      if (this.y < 0 || this.y > canvas.height) this.dy *= -1;

      ctx.save();
      ctx.translate(this.x, this.y);
      ctx.fillStyle = this.color;
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 20;

      const frame = Math.floor(this.animFrame) % 2;
      const s = this.size / 8;

      // Draw classic Space Invader sprite
      if (this.type === 0) {
        const pattern = frame === 0
          ? [[0,0,1,0,0,0,0,0,1,0,0],
             [0,0,0,1,0,0,0,1,0,0,0],
             [0,0,1,1,1,1,1,1,1,0,0],
             [0,1,1,0,1,1,1,0,1,1,0],
             [1,1,1,1,1,1,1,1,1,1,1],
             [1,0,1,1,1,1,1,1,1,0,1],
             [1,0,1,0,0,0,0,0,1,0,1],
             [0,0,0,1,1,0,1,1,0,0,0]]
          : [[0,0,1,0,0,0,0,0,1,0,0],
             [1,0,0,1,0,0,0,1,0,0,1],
             [1,0,1,1,1,1,1,1,1,0,1],
             [1,1,1,0,1,1,1,0,1,1,1],
             [1,1,1,1,1,1,1,1,1,1,1],
             [0,1,1,1,1,1,1,1,1,1,0],
             [0,0,1,0,0,0,0,0,1,0,0],
             [0,1,0,0,0,0,0,0,0,1,0]];
        this.drawPattern(pattern, s);
      } else if (this.type === 1) {
        const pattern = frame === 0
          ? [[0,0,1,0,0,0,0,0,1,0,0],
             [0,0,0,1,0,0,0,1,0,0,0],
             [0,0,1,1,1,1,1,1,1,0,0],
             [0,1,1,0,1,1,1,0,1,1,0],
             [1,1,1,1,1,1,1,1,1,1,1],
             [1,0,1,1,1,1,1,1,1,0,1],
             [1,0,1,0,0,0,0,0,1,0,1],
             [0,0,0,1,1,0,1,1,0,0,0]]
          : [[0,0,1,0,0,0,0,0,1,0,0],
             [1,0,0,1,0,0,0,1,0,0,1],
             [1,0,1,1,1,1,1,1,1,0,1],
             [1,1,1,0,1,1,1,0,1,1,1],
             [1,1,1,1,1,1,1,1,1,1,1],
             [0,1,1,1,1,1,1,1,1,1,0],
             [0,0,1,0,0,0,0,0,1,0,0],
             [0,1,0,0,0,0,0,0,0,1,0]];
        this.drawPattern(pattern, s);
      } else {
        const pattern = frame === 0
          ? [[0,0,0,0,1,1,1,1,0,0,0,0],
             [0,1,1,1,1,1,1,1,1,1,1,0],
             [1,1,1,1,1,1,1,1,1,1,1,1],
             [1,1,1,0,0,1,1,0,0,1,1,1],
             [1,1,1,1,1,1,1,1,1,1,1,1],
             [0,0,1,1,1,0,0,1,1,1,0,0],
             [0,1,1,0,0,1,1,0,0,1,1,0],
             [1,1,0,0,0,0,0,0,0,0,1,1]]
          : [[0,0,0,0,1,1,1,1,0,0,0,0],
             [0,1,1,1,1,1,1,1,1,1,1,0],
             [1,1,1,1,1,1,1,1,1,1,1,1],
             [1,1,1,0,0,1,1,0,0,1,1,1],
             [1,1,1,1,1,1,1,1,1,1,1,1],
             [0,0,0,1,1,0,0,1,1,0,0,0],
             [0,0,1,1,0,1,1,0,1,1,0,0],
             [0,0,1,1,0,0,0,0,1,1,0,0]];
        this.drawPattern(pattern, s);
      }

      ctx.restore();
    }

    drawPattern(pattern, pixelSize) {
      const offsetX = -(pattern[0].length * pixelSize) / 2;
      const offsetY = -(pattern.length * pixelSize) / 2;

      for (let row = 0; row < pattern.length; row++) {
        for (let col = 0; col < pattern[row].length; col++) {
          if (pattern[row][col] === 1) {
            ctx.fillRect(
              offsetX + col * pixelSize,
              offsetY + row * pixelSize,
              pixelSize,
              pixelSize
            );
          }
        }
      }
    }
  }

  // Create invaders
  const invaders = Array.from({ length: 8 }, () => new DashboardInvader());

  // Laser beam effect
  class LaserBeam {
    constructor() {
      this.reset();
    }

    reset() {
      this.x = Math.random() * canvas.width;
      this.y = canvas.height;
      this.speed = 3 + Math.random() * 2;
      this.height = 20 + Math.random() * 30;
      this.width = 2 + Math.random() * 2;
      this.color = ['#00FF00', '#FF00FF', '#00FFFF', '#FFFF00'][Math.floor(Math.random() * 4)];
    }

    draw() {
      this.y -= this.speed;
      if (this.y < -this.height) this.reset();

      ctx.save();
      ctx.shadowColor = this.color;
      ctx.shadowBlur = 10;
      ctx.fillStyle = this.color;
      ctx.fillRect(this.x, this.y, this.width, this.height);
      ctx.restore();
    }
  }

  const lasers = Array.from({ length: 5 }, () => new LaserBeam());

  // Animation loop
  function animate() {
    ctx.fillStyle = 'rgba(5, 0, 15, 0.15)';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    // Draw lasers
    lasers.forEach(laser => laser.draw());

    // Draw invaders
    invaders.forEach(invader => invader.draw());

    requestAnimationFrame(animate);
  }

  animate();
}

// === MOBILE DETECTION ===
function isMobileDevice() {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent)
    || window.innerWidth < 768;
}

// === BACKGROUND VIDEO HANDLER ===
function initBackgroundVideo() {
  console.log('[VIDEO INIT] Starting background video initialization...');
  const bgVideo = document.getElementById('bgVideo');

  if (!bgVideo) {
    console.error('[VIDEO ERROR] ❌ Background video element #bgVideo not found in DOM');
    return;
  }

  // Hide video on mobile devices
  if (isMobileDevice()) {
    console.log('[VIDEO] Mobile device detected - hiding video for performance');
    bgVideo.style.display = 'none';
    return;
  }

  console.log('[VIDEO FOUND] ✅ Video element found:', bgVideo);
  console.log('[VIDEO STATE] Current state:', {
    paused: bgVideo.paused,
    muted: bgVideo.muted,
    loop: bgVideo.loop,
    autoplay: bgVideo.autoplay,
    readyState: bgVideo.readyState,
    src: bgVideo.currentSrc || bgVideo.src
  });

  // Ensure video properties are set correctly
  bgVideo.muted = true;
  bgVideo.loop = true;
  bgVideo.playsInline = true;

  console.log('[VIDEO CONFIG] Video configured: muted=true, loop=true, playsInline=true');

  // Try to play the video
  console.log('[VIDEO PLAY] Attempting to play video...');
  const playPromise = bgVideo.play();

  if (playPromise !== undefined) {
    playPromise
      .then(() => {
        console.log('[VIDEO SUCCESS] ✅ Video is playing successfully!');
        console.log('[VIDEO STATE] Playing state:', {
          paused: bgVideo.paused,
          currentTime: bgVideo.currentTime,
          duration: bgVideo.duration
        });
      })
      .catch(err => {
        console.error('[VIDEO ERROR] ❌ Video autoplay failed:', err.name, err.message);
        console.log('[VIDEO RETRY] Setting up click handler for manual play...');

        // Try to play on first user interaction
        const playOnClick = () => {
          console.log('[VIDEO CLICK] User interaction detected, attempting to play video...');
          bgVideo.play()
            .then(() => {
              console.log('[VIDEO SUCCESS] ✅ Video started after user interaction!');
            })
            .catch(e => {
              console.error('[VIDEO ERROR] ❌ Video play failed even after user interaction:', e.name, e.message);
            });
        };

        document.addEventListener('click', playOnClick, { once: true });
        document.addEventListener('touchstart', playOnClick, { once: true });
      });
  }

  // Monitor video events
  bgVideo.addEventListener('loadeddata', () => {
    console.log('[VIDEO EVENT] Video data loaded, duration:', bgVideo.duration);
  });

  bgVideo.addEventListener('canplay', () => {
    console.log('[VIDEO EVENT] Video can start playing');
  });

  bgVideo.addEventListener('playing', () => {
    console.log('[VIDEO EVENT] Video is now playing');
  });

  bgVideo.addEventListener('pause', () => {
    console.log('[VIDEO EVENT] Video paused');
  });

  bgVideo.addEventListener('error', (e) => {
    console.error('[VIDEO ERROR] Video error event:', e);
    if (bgVideo.error) {
      console.error('[VIDEO ERROR] Error details:', {
        code: bgVideo.error.code,
        message: bgVideo.error.message
      });
    }
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  console.log('[APP INIT] 🚀 Application starting...');

  console.log('[APP INIT] Updating placeholder stats...');
  updatePlaceholderStats();

  console.log('[APP INIT] Loading global state...');
  await loadGlobalState(); // 🧠 load state first

  console.log('[APP INIT] Fetching SOL price...');
  await fetchSolPrice();

  console.log('[APP INIT] Loading galleries...');
  loadGallery();
  loadSoldGallery();

  console.log('[APP INIT] Updating progress...');
  updateProgress();

  // Initialize background video
  console.log('[APP INIT] Initializing background video...');
  initBackgroundVideo();

  // Initialize sound effects (disabled)
  console.log('[APP INIT] Initializing sound effects (disabled)...');
  addSoundEffects();

  // Initialize Space Invaders game in dashboard
  console.log('[APP INIT] Initializing Space Invaders game...');
  initDashboardSpaceInvaders();

  // Re-add sounds after gallery loads (disabled but keeping for compatibility)
  setTimeout(() => {
    console.log('[APP INIT] Re-adding sound effects after gallery load (disabled)...');
    addSoundEffects();
  }, 1000);

  console.log('[APP INIT] Setting up periodic updates...');
  setInterval(() => {
    console.log('[UPDATE] Fetching SOL price...');
    fetchSolPrice();
  }, 15000);

  setInterval(() => {
    console.log('[UPDATE] Updating progress...');
    updateProgress();
  }, 15000);

  console.log('[APP INIT] ✅ Application initialized successfully!');
});
