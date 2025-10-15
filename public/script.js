

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

window.devUnlocked = false; // global flag to check if dev mode is unlocked


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

// === GLOBAL CONFETTI CHECKER ===
let globalConfettiShown = false;

async function checkGlobalConfetti() {
  try {
    const res = await fetch("/state.json?_=" + Date.now());
    const state = await res.json();

    if (state.confetti && !globalConfettiShown) {
      globalConfettiShown = true;
      console.log("🎉 Global confetti triggered!");
      launchConfetti();
      setTimeout(() => (globalConfettiShown = false), 15000); // reset flag after 15s
    }
  } catch (err) {
    console.error("Confetti check failed:", err);
  }
}

// Check every 5 seconds
setInterval(checkGlobalConfetti, 5000);


// === Treasury Placeholder Values ===
let nftCount = 0;

// === Fetch SOL Price ===
async function fetchSolPrice() {
  try {
    const res = await fetch(
      "https://api.coingecko.com/api/v3/simple/price?ids=solana&vs_currencies=usd"
    );
    const data = await res.json();
    const solPrice = data.solana.usd;
    solPriceEl.textContent = `$${solPrice.toFixed(2)}`;
  } catch (err) {
    console.error("SOL price fetch error:", err);
    solPriceEl.textContent = "Error";
  }
}

// === Update Placeholder Stats for empty state ===
function updatePlaceholderStats() {
  tokenPriceEl.textContent = "$0.0000";
  marketCapEl.textContent = "$0.00M";
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

    // ✅ Update UI elements
    document.getElementById("token-price").textContent = `$${priceUsd.toFixed(6)}`;
    document.getElementById("market-cap").textContent = `$${(liquidity / 1_000_000).toFixed(2)}M`;
    document.getElementById("change").textContent = `${change.toFixed(2)}%`;
    document.getElementById("holding").textContent = `${nftCount} Retardios`;

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
        const url =
          nft.magicEdenUrl ||
          `https://magiceden.io/item-details/${encodeURIComponent(nft.id)}`;
        window.open(url, "_blank");
      });

      grid.appendChild(card);
    });

    // === ✅ Update stats ===
    const currentCount = data.length;

    // Get the stored all-time count (defaults to 0)
    let allTimeCount = parseInt(localStorage.getItem("allTimeHeld") || "0");

    // If treasury currently holds more than we've ever seen, update record
    if (currentCount > allTimeCount) {
      allTimeCount = currentCount;
      localStorage.setItem("allTimeHeld", allTimeCount);
    }

    // Update UI
    document.getElementById("gallery-summary").textContent =
      `RetardioStrategy™ is currently holding ${currentCount} NFT${currentCount !== 1 ? "s" : ""}`;
    document.getElementById("holding").textContent =
      `${currentCount} Retardio${currentCount !== 1 ? "s" : ""}`;
    document.getElementById("nft-count").textContent = allTimeCount;

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

          card.remove();
          const remaining = document.querySelectorAll("#sold-grid .nft-card").length;
          document.getElementById("sold-summary").textContent =
            `RetardioStrategy™ has sold ${remaining} NFTs`;
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
  document.getElementById("np").addEventListener("click", () => {
    if (!devUnlocked) return alert("🚫 Developer mode required.");

    const fileInput = document.getElementById("next-nft-upload");
    fileInput.click();

    fileInput.onchange = async () => {
      const file = fileInput.files[0];
      if (!file) return;

      const name = prompt("Enter NFT Name:");
      const price = parseFloat(prompt("Enter Listing Price (SOL):"));
      const link = prompt("Enter NFT Listing URL (optional):");

      if (isNaN(price) || price <= 0) return alert("❌ Invalid price!");

      // ✅ define the FileReader here
      const reader = new FileReader();

      reader.onload = (e) => {
        const nextNFTContainer = document.getElementById("next-nft-preview");
        if (!nextNFTContainer) return alert("⚠️ next-nft-preview not found in DOM!");

        nextNFTContainer.innerHTML = `
          <div class="nft-card" onclick="window.open('${link}', '_blank')">
            <img src="${e.target.result}" alt="${name}" class="nft-img">
            <div class="nft-info">
              <p class="nft-name">${name}</p>
              <p class="nft-price">${price.toFixed(2)} SOL</p>
            </div>
          </div>
        `;

        if (typeof window.setNextPurchasePrice === "function") {
          window.setNextPurchasePrice(price);
        } else {
          window.nextPurchasePrice = price;
        }

        alert(`Next purchase goal set to ${price} SOL`);
      };

// ✅ Save the new next purchase goal to the global server state
if (window.devUnlocked) {
  fetch("/update-state", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      key: localStorage.getItem("devKey"),
      updates: {
        nextPurchase: {
          name,
          price,
          link,
          image: e.target.result
        }
      }
    })
  });
}


      // ✅ read the file after defining onload
      reader.readAsDataURL(file);
      fileInput.value = "";
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



document.addEventListener("DOMContentLoaded", async () => {
  updatePlaceholderStats();
  fetchSolPrice();
  setInterval(fetchSolPrice, 15000); // refresh SOL price every 15s

  // Load server-wide state
  await loadGlobalState();

  // Start progress tracker
  updateProgress();
  setInterval(updateProgress, 15000);

  // Load galleries
  loadGallery();
  loadSoldGallery();
});
