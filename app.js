// ==========================================
// OHAKO - Main Application Logic
// ==========================================

import { db } from "./firebase-config.js";
import { 
  collection, onSnapshot, addDoc, updateDoc, deleteDoc, doc, serverTimestamp, writeBatch 
} from "https://www.gstatic.com/firebasejs/10.8.0/firebase-firestore.js";

const songsCol = collection(db, "songs");

// グローバル状態
window.songs = [];
let activeFilters = {
  status: "all",
  pitchRange: "all",
  keyType: "all",
  era: "all",
  tag: "all"
};
let currentSearchQuery = "";
let currentSort = "createdAt_desc";
let currentAudio = document.getElementById("globalAudioPlayer");
let currentPlayingUrl = null;
let currentPlayingBtn = null;

// ==========================================
// 音域判定ヘルパー
// ==========================================
const PITCH_RANK = {
  "lowA": 10, "lowB": 12, "mid1C": 13, "mid1D": 15, "mid1E": 17, "mid1F": 18, "mid1G": 20,
  "mid2A": 22, "mid2B": 24, "mid2C": 25, "mid2D": 27, "mid2E": 29, 
  "mid2F": 30, "mid2F#": 31, "mid2G": 32, "mid2G#": 33, 
  "hiA": 34, "hiA#": 35, "hiB": 36, "hiC": 37, "hiC#": 38, "hiD": 39, "hiE": 41
};

function getPitchRank(pitch) {
  if (!pitch) return 0;
  return PITCH_RANK[pitch.trim()] || 0;
}

function matchPitchRange(maxPitch, rangeKey) {
  if (rangeKey === "all") return true;
  const rank = getPitchRank(maxPitch);
  if (rank === 0) return false;

  switch (rangeKey) {
    case "low":
      return rank <= 29;
    case "normal":
      return rank >= 30 && rank <= 32;
    case "high":
      return rank >= 33 && rank <= 34;
    case "ultra":
      return rank >= 35;
    default:
      return true;
  }
}

// ==========================================
// 初期化 & Firestore リアルタイム同期
// ==========================================
document.addEventListener("DOMContentLoaded", () => {
  setupNavigation();
  setupFilterSheet();
  setupSettingsAndAiPitch();
  setupModals();
  setupAudioPlayer();

  // Firestore購読
  onSnapshot(songsCol, (snapshot) => {
    window.songs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    renderMylist();
    updateUnregisteredPitchCount();
    if (!document.getElementById("tabContentAnalysis").classList.contains("hidden")) {
      renderAnalysis();
    }
  }, (err) => {
    console.error("Firestore同期エラー:", err);
  });
});

// ==========================================
// ナビゲーション切り替え
// ==========================================
function setupNavigation() {
  const tabs = [
    { btn: "navTabMylist", sec: "tabContentMylist" },
    { btn: "navTabRecommend", sec: "tabContentRecommend", onOpen: loadRecommend },
    { btn: "navTabChart", sec: "tabContentChart", onOpen: loadChart },
    { btn: "navTabAnalysis", sec: "tabContentAnalysis", onOpen: renderAnalysis }
  ];

  tabs.forEach(t => {
    const btnEl = document.getElementById(t.btn);
    btnEl.addEventListener("click", () => {
      tabs.forEach(o => {
        const b = document.getElementById(o.btn);
        const s = document.getElementById(o.sec);
        if (o.btn === t.btn) {
          b.className = "tab-btn active py-2.5 rounded-lg text-center transition flex items-center justify-center gap-1.5 text-white bg-indigo-600 shadow-sm";
          s.classList.remove("hidden");
          s.classList.add("block");
          if (o.onOpen) o.onOpen();
        } else {
          b.className = "tab-btn py-2.5 rounded-lg text-center transition flex items-center justify-center gap-1.5 text-gray-400 hover:text-gray-200";
          s.classList.add("hidden");
          s.classList.remove("block");
        }
      });
    });
  });

  document.getElementById("btnRefreshRecommend").addEventListener("click", () => {
    loadRecommend(true);
  });
}

// ==========================================
// 絞り込みボトムシート & チップ
// ==========================================
function setupFilterSheet() {
  const backdrop = document.getElementById("filterSheetBackdrop");
  const sheet = document.getElementById("filterSheet");
  const btnOpen = document.getElementById("btnOpenFilterSheet");
  const btnClose = document.getElementById("btnCloseFilterSheet");
  const btnApply = document.getElementById("btnApplyFilterSheet");
  const btnReset = document.getElementById("btnResetFilters");
  const searchInput = document.getElementById("searchInput");
  const sortSelect = document.getElementById("sortSelect");

  const openSheet = () => {
    backdrop.classList.remove("hidden");
    requestAnimationFrame(() => {
      backdrop.classList.remove("opacity-0");
      sheet.classList.remove("translate-y-full");
    });
    renderFilterTagOptions();
    syncFilterButtonsVisual();
  };

  const closeSheet = () => {
    backdrop.classList.add("opacity-0");
    sheet.classList.add("translate-y-full");
    setTimeout(() => backdrop.classList.add("hidden"), 300);
  };

  btnOpen.addEventListener("click", openSheet);
  btnClose.addEventListener("click", closeSheet);
  backdrop.addEventListener("click", (e) => {
    if (e.target === backdrop) closeSheet();
  });

  ["filterStatusGroup", "filterPitchGroup", "filterKeyGroup", "filterEraGroup"].forEach(groupId => {
    const container = document.getElementById(groupId);
    container.addEventListener("click", (e) => {
      const btn = e.target.closest(".filter-btn");
      if (!btn) return;
      const type = btn.getAttribute("data-filter");
      const val = btn.getAttribute("data-value");
      activeFilters[type] = val;
      syncFilterButtonsVisual();
    });
  });

  btnReset.addEventListener("click", () => {
    activeFilters = { status: "all", pitchRange: "all", keyType: "all", era: "all", tag: "all" };
    syncFilterButtonsVisual();
  });

  btnApply.addEventListener("click", () => {
    closeSheet();
    updateActiveFilterChips();
    renderMylist();
  });

  searchInput.addEventListener("input", (e) => {
    currentSearchQuery = e.target.value.toLowerCase().trim();
    renderMylist();
  });
  sortSelect.addEventListener("change", (e) => {
    currentSort = e.target.value;
    renderMylist();
  });
}

function syncFilterButtonsVisual() {
  document.querySelectorAll(".filter-btn").forEach(btn => {
    const type = btn.getAttribute("data-filter");
    const val = btn.getAttribute("data-value");
    if (activeFilters[type] === val) {
      btn.className = "filter-btn py-1.5 px-2 rounded-lg border border-indigo-500 bg-indigo-600/30 text-indigo-300 font-semibold text-center";
    } else {
      btn.className = "filter-btn py-1.5 px-2 rounded-lg border border-gray-700 bg-gray-800/80 text-gray-400 hover:text-gray-200 text-center";
    }
  });
}

function renderFilterTagOptions() {
  const container = document.getElementById("filterTagGroup");
  const allTags = new Set();
  window.songs.forEach(s => {
    if (Array.isArray(s.tags)) s.tags.forEach(t => allTags.add(t));
  });

  if (allTags.size === 0) {
    container.innerHTML = `<span class="text-gray-500 text-xs">登録されたタグはありません</span>`;
    return;
  }

  let html = `
    <button class="filter-btn py-1 px-2 rounded-lg border text-xs ${activeFilters.tag === 'all' ? 'border-indigo-500 bg-indigo-600/30 text-indigo-300' : 'border-gray-700 bg-gray-800/80 text-gray-400'}" data-filter="tag" data-value="all">すべて</button>
  `;
  allTags.forEach(tag => {
    const isSelected = activeFilters.tag === tag;
    html += `
      <button class="filter-btn py-1 px-2 rounded-lg border text-xs ${isSelected ? 'border-indigo-500 bg-indigo-600/30 text-indigo-300' : 'border-gray-700 bg-gray-800/80 text-gray-400'}" data-filter="tag" data-value="${escapeHtml(tag)}">${escapeHtml(tag)}</button>
    `;
  });
  container.innerHTML = html;

  container.querySelectorAll(".filter-btn").forEach(b => {
    b.addEventListener("click", () => {
      activeFilters.tag = b.getAttribute("data-value");
      syncFilterButtonsVisual();
      renderFilterTagOptions();
    });
  });
}

function updateActiveFilterChips() {
  const container = document.getElementById("activeChipsContainer");
  const badge = document.getElementById("activeFilterBadge");
  const chips = [];

  if (activeFilters.status !== "all") chips.push({ key: "status", label: `状態: ${activeFilters.status}` });
  if (activeFilters.pitchRange !== "all") {
    const map = { low: "低め", normal: "標準", high: "高め", ultra: "超高音" };
    chips.push({ key: "pitchRange", label: `音域: ${map[activeFilters.pitchRange]}` });
  }
  if (activeFilters.keyType !== "all") {
    const map = { original: "原曲キー", adjusted: "キー調整あり", duet: "デュエット" };
    chips.push({ key: "keyType", label: `キー: ${map[activeFilters.keyType]}` });
  }
  if (activeFilters.era !== "all") chips.push({ key: "era", label: `${activeFilters.era}年代` });
  if (activeFilters.tag !== "all") chips.push({ key: "tag", label: `🏷️ ${activeFilters.tag}` });

  if (chips.length > 0) {
    badge.textContent = chips.length;
    badge.classList.remove("hidden");
  } else {
    badge.classList.add("hidden");
  }

  if (chips.length === 0) {
    container.innerHTML = `<span class="text-gray-500 text-[11px]">全件表示中</span>`;
    return;
  }

  let html = chips.map(c => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-[11px]">
      ${escapeHtml(c.label)}
      <button class="remove-chip-btn hover:text-white" data-key="${c.key}"><i class="fa-solid fa-xmark text-[10px]"></i></button>
    </span>
  `).join("");
  html += `<button id="btnClearAllChips" class="text-[11px] text-gray-400 hover:text-rose-400 underline ml-1">すべてクリア</button>`;
  container.innerHTML = html;

  container.querySelectorAll(".remove-chip-btn").forEach(btn => {
    btn.addEventListener("click", () => {
      activeFilters[btn.getAttribute("data-key")] = "all";
      updateActiveFilterChips();
      renderMylist();
    });
  });

  const clearBtn = document.getElementById("btnClearAllChips");
  if (clearBtn) {
    clearBtn.addEventListener("click", () => {
      activeFilters = { status: "all", pitchRange: "all", keyType: "all", era: "all", tag: "all" };
      updateActiveFilterChips();
      renderMylist();
    });
  }
}

// ==========================================
// マイリスト描画
// ==========================================
function renderMylist() {
  const container = document.getElementById("mylistContainer");
  const summaryEl = document.getElementById("mylistCountSummary");

  let filtered = window.songs.filter(s => {
    if (currentSearchQuery) {
      const matchTitle = (s.title || "").toLowerCase().includes(currentSearchQuery);
      const matchArtist = (s.artist || "").toLowerCase().includes(currentSearchQuery);
      const matchTag = (s.tags || []).some(t => t.toLowerCase().includes(currentSearchQuery));
      if (!matchTitle && !matchArtist && !matchTag) return false;
    }
    if (activeFilters.status !== "all" && s.status !== activeFilters.status) return false;
    if (!matchPitchRange(s.maxPitch, activeFilters.pitchRange)) return false;
    if (activeFilters.keyType !== "all") {
      const k = (s.key || "").trim();
      if (activeFilters.keyType === "original" && (k !== "0" && k !== "原曲" && k !== "")) return false;
      if (activeFilters.keyType === "adjusted" && (k === "0" || k === "原曲" || k === "")) return false;
      if (activeFilters.keyType === "duet" && !(s.tags || []).includes("デュエット")) return false;
    }
    if (activeFilters.era !== "all") {
      const yr = parseInt(s.releaseYear, 10);
      if (!yr) return false;
      if (activeFilters.era === "2020" && yr < 2020) return false;
      if (activeFilters.era === "2010" && (yr < 2010 || yr >= 2020)) return false;
      if (activeFilters.era === "2000" && (yr < 2000 || yr >= 2010)) return false;
      if (activeFilters.era === "1990" && (yr < 1990 || yr >= 2000)) return false;
      if (activeFilters.era === "1980" && yr >= 1990) return false;
    }
    if (activeFilters.tag !== "all" && !(s.tags || []).includes(activeFilters.tag)) return false;

    return true;
  });

  filtered.sort((a, b) => {
    if (currentSort === "createdAt_desc") return (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0);
    if (currentSort === "createdAt_asc") return (a.createdAt?.seconds || 0) - (b.createdAt?.seconds || 0);
    if (currentSort === "score_desc") return (b.score || 0) - (a.score || 0);
    if (currentSort === "singCount_desc") return (b.singCount || 0) - (a.singCount || 0);
    if (currentSort === "lastSungAt_desc") return (b.lastSungAt?.seconds || 0) - (a.lastSungAt?.seconds || 0);
    if (currentSort === "title_asc") return (a.title || "").localeCompare(b.title || "", "ja");
    return 0;
  });

  summaryEl.textContent = `表示中: ${filtered.length}曲 / 全${window.songs.length}曲`;

  if (filtered.length === 0) {
    container.innerHTML = `
      <div class="bg-dark-800/60 border border-gray-800 rounded-xl p-8 text-center text-gray-500 text-xs">
        条件に一致する曲がありません
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(s => {
    const statusBg = {
      "得意": "bg-emerald-950/80 text-emerald-300 border-emerald-800/60",
      "歌える": "bg-blue-950/80 text-blue-300 border-blue-800/60",
      "練習中": "bg-amber-950/80 text-amber-300 border-amber-800/60",
      "これから": "bg-purple-950/80 text-purple-300 border-purple-800/60"
    }[s.status] || "bg-gray-800 text-gray-400 border-gray-700";

    const cover = s.coverUrl || "https://placehold.co/100x100/1e293b/94a3b8?text=♪";
    const preview = s.previewUrl || "";

    return `
      <div class="song-card bg-dark-800 border border-gray-800 rounded-xl p-3 shadow-sm hover:border-gray-700 transition" data-id="${s.id}">
        <div class="flex items-center gap-3">
          <!-- ジャケット: タップで30秒試聴再生 -->
          <div class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden cursor-pointer group bg-dark-900 border border-gray-700/60 song-cover-play" data-preview="${escapeHtml(preview)}">
            <img src="${cover}" alt="cover" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fa-solid fa-play text-white text-xs play-icon"></i>
            </div>
          </div>

          <!-- 詳細開閉領域 -->
          <div class="flex-1 min-w-0 cursor-pointer card-header-area">
            <div class="flex items-center gap-1.5 mb-0.5">
              <span class="px-1.5 py-0.5 rounded text-[10px] font-bold border ${statusBg}">
                ${escapeHtml(s.status || "これから")}
              </span>
              <h4 class="font-bold text-xs text-white truncate">${escapeHtml(s.title)}</h4>
            </div>
            <div class="text-[11px] text-gray-400 truncate">${escapeHtml(s.artist)}</div>
          </div>

          <div class="flex items-center gap-2 flex-shrink-0">
            ${s.score ? `<span class="text-xs font-bold text-emerald-400">${s.score}点</span>` : ""}
            <button class="toggle-detail-btn w-6 h-6 rounded flex items-center justify-center text-gray-500 hover:text-white transition">
              <i class="fa-solid fa-chevron-down text-xs chevron-icon"></i>
            </button>
          </div>
        </div>

        <div class="detail-drawer hidden mt-3 pt-3 border-t border-gray-700/60 text-xs text-gray-300 space-y-2">
          <div class="grid grid-cols-2 gap-2 text-[11px]">
            <div><span class="text-gray-500">キー:</span> <span class="font-medium text-gray-200">${escapeHtml(s.key || "原曲")}</span></div>
            <div><span class="text-gray-500">年代:</span> <span class="font-medium text-gray-200">${s.releaseYear ? s.releaseYear + "年" : "未設定"}</span></div>
            <div><span class="text-gray-500">最高音:</span> <span class="font-medium text-amber-400">${escapeHtml(s.maxPitch || "--")}</span></div>
            <div><span class="text-gray-500">最低音:</span> <span class="font-medium text-cyan-400">${escapeHtml(s.minPitch || "--")}</span></div>
            <div><span class="text-gray-500">歌唱回数:</span> <span class="font-medium text-gray-200">${s.singCount || 0}回</span></div>
            <div><span class="text-gray-500">最終歌唱:</span> <span class="font-medium text-gray-200">${formatTimestamp(s.lastSungAt)}</span></div>
          </div>

          ${s.tags && s.tags.length > 0 ? `
            <div class="flex flex-wrap gap-1">
              ${s.tags.map(t => `<span class="px-1.5 py-0.5 rounded bg-gray-700 text-gray-300 text-[10px]">#${escapeHtml(t)}</span>`).join("")}
            </div>
          ` : ""}

          ${s.memo ? `<div class="bg-dark-900/60 p-2 rounded text-[11px] text-gray-300 border border-gray-800">${escapeHtml(s.memo)}</div>` : ""}

          <div class="flex items-center justify-between pt-1">
            <button class="btn-sing-count px-2.5 py-1 rounded bg-indigo-950/60 hover:bg-indigo-900 border border-indigo-800/60 text-indigo-300 text-[11px] font-semibold transition" data-id="${s.id}">
              🎤 歌った！(+1)
            </button>
            <button class="btn-edit-song px-2.5 py-1 rounded bg-gray-700 hover:bg-gray-600 text-gray-200 text-[11px] transition" data-id="${s.id}">
              <i class="fa-solid fa-pen-to-square"></i> 編集
            </button>
          </div>
        </div>
      </div>
    `;
  }).join("");

  container.querySelectorAll(".song-card").forEach(card => {
    const header = card.querySelector(".card-header-area");
    const toggleBtn = card.querySelector(".toggle-detail-btn");
    const drawer = card.querySelector(".detail-drawer");
    const chevron = card.querySelector(".chevron-icon");

    const toggle = () => {
      const isHidden = drawer.classList.contains("hidden");
      drawer.classList.toggle("hidden", !isHidden);
      chevron.classList.toggle("fa-chevron-down", !isHidden);
      chevron.classList.toggle("fa-chevron-up", isHidden);
    };

    header.addEventListener("click", toggle);
    toggleBtn.addEventListener("click", toggle);
  });

  container.querySelectorAll(".btn-sing-count").forEach(btn => {
    btn.addEventListener("click", async () => {
      const id = btn.getAttribute("data-id");
      const target = window.songs.find(x => x.id === id);
      if (!target) return;
      await updateDoc(doc(db, "songs", id), {
        singCount: (target.singCount || 0) + 1,
        lastSungAt: serverTimestamp()
      });
    });
  });

  container.querySelectorAll(".btn-edit-song").forEach(btn => {
    btn.addEventListener("click", () => {
      openEditModal(btn.getAttribute("data-id"));
    });
  });
}

// ==========================================
// 再生制御 (ジャケットタップで30秒試聴)
// ==========================================
function setupAudioPlayer() {
  document.addEventListener("click", (e) => {
    const playBox = e.target.closest(".song-cover-play");
    if (!playBox) return;

    const url = playBox.getAttribute("data-preview");
    if (!url) {
      alert("この曲の試聴音源はありません");
      return;
    }

    const icon = playBox.querySelector(".play-icon");

    if (currentPlayingUrl === url) {
      currentAudio.pause();
      currentPlayingUrl = null;
      if (icon) {
        icon.classList.remove("fa-stop");
        icon.classList.add("fa-play");
      }
      return;
    }

    if (currentPlayingBtn) {
      currentPlayingBtn.classList.remove("fa-stop");
      currentPlayingBtn.classList.add("fa-play");
    }

    currentAudio.src = url;
    currentAudio.play();
    currentPlayingUrl = url;
    currentPlayingBtn = icon;
    if (icon) {
      icon.classList.remove("fa-play");
      icon.classList.add("fa-stop");
    }

    currentAudio.onended = () => {
      if (icon) {
        icon.classList.remove("fa-stop");
        icon.classList.add("fa-play");
      }
      currentPlayingUrl = null;
    };
  });
}

// ==========================================
// 名曲発掘
// ==========================================
async function loadRecommend(forceRefresh = false) {
  const profileCard = document.getElementById("karaokeProfileContent");
  const listContainer = document.getElementById("recommendListContainer");

  if (window.songs.length === 0) {
    profileCard.innerHTML = `<span class="text-gray-400">マイリストに曲が登録されていません</span>`;
    listContainer.innerHTML = `<div class="bg-dark-800 p-6 rounded-xl text-center text-xs text-gray-500">マイリストに曲を登録すると、あなたの歌唱傾向に合わせた発掘曲が表示されます。</div>`;
    return;
  }

  const artistCounts = {};
  const eraCounts = {};
  window.songs.forEach(s => {
    if (s.artist) artistCounts[s.artist] = (artistCounts[s.artist] || 0) + 1;
    if (s.releaseYear) {
      const era = Math.floor(s.releaseYear / 10) * 10;
      eraCounts[era] = (eraCounts[era] || 0) + 1;
    }
  });

  const sortedArtists = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]);
  const sortedEras = Object.keys(eraCounts).sort((a, b) => eraCounts[b] - eraCounts[a]);

  const topPool = sortedArtists.slice(0, 5);
  const pickedArtist = topPool[Math.floor(Math.random() * topPool.length)] || sortedArtists[0];
  const randomPool = sortedArtists.slice(5);
  const pickedHiddenArtist = randomPool.length > 0 ? randomPool[Math.floor(Math.random() * randomPool.length)] : null;
  const pickedEra = sortedEras[Math.floor(Math.random() * Math.min(2, sortedEras.length))] || "2010";

  profileCard.innerHTML = `
    <div class="flex flex-wrap items-center gap-x-4 gap-y-1">
      <div><span class="text-gray-400">注目フォーカス:</span> <strong class="text-indigo-200">${escapeHtml(pickedArtist)}</strong></div>${pickedHiddenArtist ? `<div><span class="text-gray-400">隠れお気に入り枠:</span> <strong class="text-indigo-200">${escapeHtml(pickedHiddenArtist)}</strong></div>` : ""}
      <div><span class="text-gray-400">注目年代:</span> <strong class="text-indigo-200">${pickedEra}年代</strong></div>
    </div>
  `;

  listContainer.innerHTML = `<div class="p-6 text-center text-xs text-indigo-400 animate-pulse"><i class="fa-solid fa-spinner fa-spin"></i> iTunesから連想楽曲を発掘中...</div>`;

  try {
    const term = encodeURIComponent(`${pickedArtist}${pickedEra}`);
    const res = await fetch(`https://itunes.apple.com/search?term=${term}&country=jp&entity=song&limit=25`);
    const data = await res.json();
    
    const existingTitles = new Set(window.songs.map(s => (s.title || "").toLowerCase()));
    let candidates = (data.results || []).filter(item => !existingTitles.has(item.trackName.toLowerCase()));
    candidates = candidates.sort(() => 0.5 - Math.random()).slice(0, 8);

    if (candidates.length === 0) {
      listContainer.innerHTML = `<div class="bg-dark-800 p-6 rounded-xl text-center text-xs text-gray-500">新しいレコメンド曲が見つかりませんでした。「再発掘」を押してください。</div>`;
      return;
    }

    listContainer.innerHTML = candidates.map(c => `
      <div class="bg-dark-800 border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
        <div class="flex items-center gap-3 min-w-0">
          <div class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden group bg-dark-900 border border-gray-700/60 song-cover-play" data-preview="${c.previewUrl || ''}">
            <img src="${c.artworkUrl100 || ''}" alt="cover" class="w-full h-full object-cover">
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
              <i class="fa-solid fa-play text-white text-xs play-icon"></i>
            </div>
          </div>
          <div class="min-w-0">
            <h4 class="font-bold text-xs text-white truncate">${escapeHtml(c.trackName)}</h4>
            <div class="text-[11px] text-gray-400 truncate">${escapeHtml(c.artistName)}</div>
            <div class="text-[10px] text-indigo-400 mt-0.5">${c.releaseDate ? c.releaseDate.substring(0, 4) + '年' : ''}</div>
          </div>
        </div>
        <button class="btn-quick-add px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex-shrink-0 shadow transition"
          data-title="${escapeHtml(c.trackName)}" 
          data-artist="${escapeHtml(c.artistName)}"
          data-cover="${escapeHtml(c.artworkUrl100 || '')}"
          data-preview="${escapeHtml(c.previewUrl || '')}"
          data-year="${c.releaseDate ? c.releaseDate.substring(0, 4) : ''}">
          <i class="fa-solid fa-plus"></i> 追加
        </button>
      </div>
    `).join("");

    listContainer.querySelectorAll(".btn-quick-add").forEach(btn => {
      btn.addEventListener("click", async () => {
        const title = btn.getAttribute("data-title");
        const artist = btn.getAttribute("data-artist");
        const coverUrl = btn.getAttribute("data-cover");
        const previewUrl = btn.getAttribute("data-preview");
        const year = parseInt(btn.getAttribute("data-year"), 10) || null;

        await addDoc(songsCol, {
          title, artist, coverUrl, previewUrl,
          releaseYear: year,
          status: "これから",
          key: "原曲",
          score: null,
          maxPitch: "",
          minPitch: "",
          tags: [],
          singCount: 0,
          createdAt: serverTimestamp()
        });

        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> 登録済`;
        btn.className = "px-3 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-xs font-semibold";
      });
    });

  } catch (err) {
    console.error("発掘エラー:", err);
    listContainer.innerHTML = `<div class="bg-dark-800 p-6 rounded-xl text-center text-xs text-rose-400">取得に失敗しました</div>`;
  }
}

// ==========================================
// 流行チャート
// ==========================================
async function loadChart() {
  const container = document.getElementById("chartListContainer");
  if (container.children.length > 0) return;

  container.innerHTML = `<div class="p-6 text-center text-xs text-indigo-400 animate-pulse"><i class="fa-solid fa-spinner fa-spin"></i> チャートを取得中...</div>`;

  try {
    const res = await fetch("https://itunes.apple.com/jp/rss/topsongs/limit=30/json");
    const data = await res.json();
    const entries = data.feed?.entry || [];

    container.innerHTML = entries.map((entry, idx) => {
      const title = entry["im:name"]?.label || "";
      const artist = entry["im:artist"]?.label || "";
      const cover = entry["im:image"]?.[2]?.label || "";
      const preview = entry["link"]?.[1]?.attributes?.href || "";

      return `
        <div class="bg-dark-800 border border-gray-800 rounded-xl p-3 flex items-center justify-between gap-3 shadow-sm">
          <div class="flex items-center gap-3 min-w-0">
            <span class="text-sm font-black w-5 text-center ${idx < 3 ? 'text-amber-400' : 'text-gray-500'}">${idx + 1}</span>
            <div class="relative w-12 h-12 flex-shrink-0 rounded-lg overflow-hidden group bg-dark-900 border border-gray-700/60 song-cover-play" data-preview="${preview}">
              <img src="${cover}" alt="cover" class="w-full h-full object-cover">
              <div class="absolute inset-0 bg-black/40 flex items-center justify-center opacity-0 group-hover:opacity-100 transition">
                <i class="fa-solid fa-play text-white text-xs play-icon"></i>
              </div>
            </div>
            <div class="min-w-0">
              <h4 class="font-bold text-xs text-white truncate">${escapeHtml(title)}</h4>
              <div class="text-[11px] text-gray-400 truncate">${escapeHtml(artist)}</div>
            </div>
          </div>
          <button class="btn-chart-add px-3 py-1.5 rounded-lg bg-indigo-600 hover:bg-indigo-500 text-xs font-semibold text-white flex-shrink-0 transition"
            data-title="${escapeHtml(title)}"
            data-artist="${escapeHtml(artist)}"
            data-cover="${escapeHtml(cover)}"
            data-preview="${escapeHtml(preview)}">
            <i class="fa-solid fa-plus"></i> 追加
          </button>
        </div>
      `;
    }).join("");

    container.querySelectorAll(".btn-chart-add").forEach(btn => {
      btn.addEventListener("click", async () => {
        await addDoc(songsCol, {
          title: btn.getAttribute("data-title"),
          artist: btn.getAttribute("data-artist"),
          coverUrl: btn.getAttribute("data-cover"),
          previewUrl: btn.getAttribute("data-preview"),
          status: "これから",
          key: "原曲",
          score: null,
          maxPitch: "",
          minPitch: "",
          tags: ["流行"],
          singCount: 0,
          createdAt: serverTimestamp()
        });
        btn.disabled = true;
        btn.innerHTML = `<i class="fa-solid fa-check"></i> 追加済`;
        btn.className = "px-3 py-1.5 rounded-lg bg-emerald-900/60 border border-emerald-700 text-emerald-300 text-xs font-semibold";
      });
    });

  } catch (err) {
    console.error("チャート取得失敗:", err);
    container.innerHTML = `<div class="bg-dark-800 p-6 rounded-xl text-center text-xs text-rose-400">チャートの取得に失敗しました</div>`;
  }
}

// ==========================================
// マイ分析
// ==========================================
function renderAnalysis() {
  const activeSongs = window.songs.filter(s => s.status && s.status !== "これから");

  document.getElementById("statActiveCount").textContent = activeSongs.length;
  
  const scored = activeSongs.filter(s => typeof s.score === "number" && s.score > 0);
  const avg = scored.length > 0 ? (scored.reduce((acc, s) => acc + s.score, 0) / scored.length).toFixed(1) : "--";
  document.getElementById("statAvgScore").textContent = avg !== "--" ? `${avg}点` : "--";

  const over90 = scored.filter(s => s.score >= 90).length;
  document.getElementById("statOver90Count").textContent = `${over90}曲`;

  const totalSing = activeSongs.reduce((acc, s) => acc + (s.singCount || 0), 0);
  document.getElementById("statTotalSingCount").textContent = `${totalSing}回`;

  // ボイスレンジ
  const pitchRanks = activeSongs.map(s => getPitchRank(s.maxPitch)).filter(r => r > 0);
  const voiceRangeEl = document.getElementById("voiceRangeContainer");
  if (pitchRanks.length > 0) {
    const minR = Math.min(...pitchRanks);
    const maxR = Math.max(...pitchRanks);
    const findKey = (r) => Object.keys(PITCH_RANK).find(k => PITCH_RANK[k] === r) || "";
    voiceRangeEl.innerHTML = `
      <div class="flex items-center justify-between text-xs mb-1">
        <span>あなたの主力最高音レンジ:</span>
        <strong class="text-amber-400 font-bold">${findKey(minR)} 〜 ${findKey(maxR)}</strong>
      </div>
      <p class="text-[11px] text-gray-400 leading-relaxed">
        ※「得意」「歌える」に設定された曲から最高音の適正帯を算出しています。
      </p>
    `;
  } else {
    voiceRangeEl.innerHTML = `<span class="text-gray-500 text-xs">音域データがまだ登録されていません（⚙️設定からAI一括取得が可能です）</span>`;
  }

  // キー別平均スコア
  const keyMap = {};
  scored.forEach(s => {
    const k = (s.key || "原曲").trim();
    if (!keyMap[k]) keyMap[k] = { sum: 0, count: 0 };
    keyMap[k].sum += s.score;
    keyMap[k].count++;
  });

  const keyContainer = document.getElementById("keyScoreContainer");
  const keyKeys = Object.keys(keyMap);
  if (keyKeys.length === 0) {
    keyContainer.innerHTML = `<span class="text-gray-500 text-xs">スコア登録データがありません</span>`;
  } else {
    keyContainer.innerHTML = keyKeys.map(k => {
      const item = keyMap[k];
      const mean = (item.sum / item.count).toFixed(1);
      return `
        <div class="flex items-center justify-between py-1 border-b border-gray-800">
          <span class="text-gray-300">キー [ ${escapeHtml(k)} ]</span>
          <span class="font-bold text-indigo-300">${mean}点 <span class="text-[10px] text-gray-500">(${item.count}曲)</span></span>
        </div>
      `;
    }).join("");
  }

  // ご無沙汰十八番
  const threeMonthsAgo = Date.now() / 1000 - 90 * 24 * 60 * 60;
  const dormantSongs = window.songs.filter(s => {
    if (s.status !== "得意") return false;
    if (!s.lastSungAt?.seconds) return true;
    return s.lastSungAt.seconds < threeMonthsAgo;
  }).slice(0, 5);

  const dormantEl = document.getElementById("dormantSongsList");
  if (dormantSongs.length === 0) {
    dormantEl.innerHTML = `<span class="text-gray-500 text-xs">直近しっかり歌われています！</span>`;
  } else {
    dormantEl.innerHTML = dormantSongs.map(s => `
      <div class="flex items-center justify-between py-0.5">
        <span class="truncate text-gray-200">${escapeHtml(s.title)}</span>
        <span class="text-[10px] text-amber-500 flex-shrink-0">ご無沙汰</span>
      </div>
    `).join("");
  }

  // 最多歌唱Top 5
  const mostSung = [...activeSongs].sort((a, b) => (b.singCount || 0) - (a.singCount || 0)).slice(0, 5);
  const mostSungEl = document.getElementById("mostSungList");
  mostSungEl.innerHTML = mostSung.map((s, idx) => `
    <div class="flex items-center justify-between py-0.5">
      <span class="truncate text-gray-200">${idx + 1}.${escapeHtml(s.title)}</span>
      <span class="text-[11px] font-bold text-indigo-300 flex-shrink-0">${s.singCount || 0}回</span>
    </div>
  `).join("");
}

// ==========================================
// 設定 & AI音域連携
// ==========================================
function setupSettingsAndAiPitch() {
  const modal = document.getElementById("settingsModal");
  const btnOpen = document.getElementById("btnOpenSettingsModal");
  const btnClose = document.getElementById("btnCloseSettingsModal");
  const btnCopy = document.getElementById("btnCopyPitchPrompt");
  const btnApply = document.getElementById("btnApplyAiPitchJson");
  const jsonInput = document.getElementById("aiPitchJsonInput");

  btnOpen.addEventListener("click", () => {
    updateUnregisteredPitchCount();
    modal.classList.remove("hidden");
  });
  btnClose.addEventListener("click", () => modal.classList.add("hidden"));

  btnCopy.addEventListener("click", () => {
    const unregs = window.songs.filter(s => !s.maxPitch || !s.minPitch);
    if (unregs.length === 0) {
      alert("すべての曲に音域データが登録されています！");
      return;
    }

    const listText = unregs.map(s => `- id: ${s.id} / 曲名: ${s.title} / 歌手: ${s.artist}`).join("\n");
    const prompt = `以下の曲リストについて、カラオケにおける「地声最高音」と「最低音」を調査し、下記のJSON配列形式のみで出力してください。Markdownコードブロック(\`\`\`json)などの余計な注釈テキストは一切出力しないでください。\n\n音階は「hiA」「mid2G」「mid1D」などの日本標準カラオケ音域表記を使用してください。不明な場合は空文字にしてください。\n\n[フォーマット例]\n[\n  {"id": "xxx", "maxPitch": "hiA", "minPitch": "mid1C"}\n]\n\n[対象曲リスト]\n${listText}`;

    navigator.clipboard.writeText(prompt).then(() => {
      alert(`音域未設定の ${unregs.length} 曲分のプロンプトをクリップボードにコピーしました！\nAIに貼り付けて実行し、返ってきたJSONを下の入力欄にペーストしてください。`);
    });
  });

  btnApply.addEventListener("click", async () => {
    let raw = jsonInput.value.trim();
    if (!raw) {
      alert("AIの回答JSONを貼り付けてください");
      return;
    }

    raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

    try {
      const data = JSON.parse(raw);
      if (!Array.isArray(data)) throw new Error("JSON配列形式ではありません");

      const batch = writeBatch(db);
      let count = 0;

      data.forEach(item => {
        if (item.id && (item.maxPitch || item.minPitch)) {
          const ref = doc(db, "songs", item.id);
          const updateData = {};
          if (item.maxPitch) updateData.maxPitch = item.maxPitch;
          if (item.minPitch) updateData.minPitch = item.minPitch;
          batch.update(ref, updateData);
          count++;
        }
      });

      await batch.commit();
      alert(`${count}件の音域データを反映しました！`);
      jsonInput.value = "";
      modal.classList.add("hidden");
    } catch (err) {
      console.error(err);
      alert("JSONの解析に失敗しました。正しいJSON配列形式になっているか確認してください。");
    }
  });
}

function updateUnregisteredPitchCount() {
  const count = window.songs.filter(s => !s.maxPitch || !s.minPitch).length;
  const badge = document.getElementById("unregisteredPitchCountBadge");
  if (badge) badge.textContent = `未登録: ${count}曲`;
}

// ==========================================
// 曲の追加・編集モーダル（単曲 / 一括登録統合）
// ==========================================
function setupModals() {
  const songModal = document.getElementById("songModal");
  const btnOpenAdd = document.getElementById("btnOpenAddModal");
  const btnCloseSong = document.getElementById("btnCloseSongModal");
  const form = document.getElementById("songForm");
  const bulkSection = document.getElementById("bulkAddSection");
  const tabsContainer = document.getElementById("addModalTypeTabs");
  const tabModeSingle = document.getElementById("tabModeSingle");
  const tabModeBulk = document.getElementById("tabModeBulk");
  const btnDelete = document.getElementById("btnDeleteSong");

  // モーダル内 タブ切り替え（単曲 vs 一括）
  const setModalMode = (mode) => {
    if (mode === "single") {
      tabModeSingle.className = "py-1.5 rounded-lg bg-indigo-600 text-white text-center transition";
      tabModeBulk.className = "py-1.5 rounded-lg text-gray-400 hover:text-white text-center transition";
      form.classList.remove("hidden");
      bulkSection.classList.add("hidden");
    } else {
      tabModeBulk.className = "py-1.5 rounded-lg bg-indigo-600 text-white text-center transition";
      tabModeSingle.className = "py-1.5 rounded-lg text-gray-400 hover:text-white text-center transition";
      form.classList.add("hidden");
      bulkSection.classList.remove("hidden");
    }
  };

  tabModeSingle.addEventListener("click", () => setModalMode("single"));
  tabModeBulk.addEventListener("click", () => setModalMode("bulk"));

  btnOpenAdd.addEventListener("click", () => {
    document.getElementById("songModalTitle").textContent = "曲の追加";
    tabsContainer.classList.remove("hidden"); // 追加時はタブを表示
    form.reset();
    document.getElementById("modalSongId").value = "";
    document.getElementById("modalStatus").value = "これから";
    btnDelete.classList.add("hidden");
    setModalMode("single");
    songModal.classList.remove("hidden");
  });

  btnCloseSong.addEventListener("click", () => songModal.classList.add("hidden"));

  // 単曲保存
  form.addEventListener("submit", async (e) => {
    e.preventDefault();
    const id = document.getElementById("modalSongId").value;
    const title = document.getElementById("modalTitle").value.trim();
    const artist = document.getElementById("modalArtist").value.trim();
    const status = document.getElementById("modalStatus").value;
    const key = document.getElementById("modalKey").value.trim();
    const maxPitch = document.getElementById("modalMaxPitch").value.trim();
    const minPitch = document.getElementById("modalMinPitch").value.trim();
    const scoreVal = parseFloat(document.getElementById("modalScore").value);
    const score = isNaN(scoreVal) ? null : scoreVal;
    const yearVal = parseInt(document.getElementById("modalReleaseYear").value, 10);
    const releaseYear = isNaN(yearVal) ? null : yearVal;
    const memo = document.getElementById("modalMemo").value.trim();
    const coverUrl = document.getElementById("modalCoverUrl").value;
    const previewUrl = document.getElementById("modalPreviewUrl").value;
    const tags = document.getElementById("modalTags").value.split(",").map(t => t.trim()).filter(Boolean);

    const payload = {
      title, artist, status, key, maxPitch, minPitch, score, releaseYear, memo, tags,
      coverUrl: coverUrl || null,
      previewUrl: previewUrl || null
    };

    if (id) {
      await updateDoc(doc(db, "songs", id), payload);
    } else {
      payload.singCount = 0;
      payload.createdAt = serverTimestamp();
      await addDoc(songsCol, payload);
    }

    songModal.classList.add("hidden");
  });

  btnDelete.addEventListener("click", async () => {
    const id = document.getElementById("modalSongId").value;
    if (confirm("本当にこの曲を削除しますか？")) {
      await deleteDoc(doc(db, "songs", id));
      songModal.classList.add("hidden");
    }
  });

  // 一括登録実行
  const btnExecBulk = document.getElementById("btnExecuteBulk");
  const bulkTextarea = document.getElementById("bulkInputArea");
  const bulkStatusSel = document.getElementById("bulkDefaultStatus");

  btnExecBulk.addEventListener("click", async () => {
    const lines = bulkTextarea.value.split("\n").map(l => l.trim()).filter(Boolean);
    if (lines.length === 0) return;

    btnExecBulk.disabled = true;
    btnExecBulk.textContent = "処理中...";

    for (const line of lines) {
      try {
        const res = await fetch(`[https://itunes.apple.com/search?term=$](https://itunes.apple.com/search?term=$){encodeURIComponent(line)}&country=jp&entity=song&limit=1`);
        const data = await res.json();
        const r = data.results?.[0];

        await addDoc(songsCol, {
          title: r ? r.trackName : line,
          artist: r ? r.artistName : "不明",
          coverUrl: r ? r.artworkUrl100 : null,
          previewUrl: r ? r.previewUrl : null,
          releaseYear: r?.releaseDate ? parseInt(r.releaseDate.substring(0, 4), 10) : null,
          status: bulkStatusSel.value,
          key: "原曲",
          score: null,
          maxPitch: "",
          minPitch: "",
          tags: [],
          singCount: 0,
          createdAt: serverTimestamp()
        });
      } catch (e) {
        console.error("一括追加エラー:", line, e);
      }
    }

    bulkTextarea.value = "";
    btnExecBulk.disabled = false;
    btnExecBulk.textContent = "iTunesで取得して一括登録";
    songModal.classList.add("hidden");
  });

  // iTunesインライン検索
  const itunesQuery = document.getElementById("itunesSearchQuery");
  const itunesBtn = document.getElementById("btnItunesSearch");
  const itunesResults = document.getElementById("itunesSearchResults");

  itunesBtn.addEventListener("click", async () => {
    const q = itunesQuery.value.trim();
    if (!q) return;
    itunesResults.innerHTML = `<div class="p-2 text-center text-gray-500">検索中...</div>`;
    itunesResults.classList.remove("hidden");

    try {
      const res = await fetch(`[https://itunes.apple.com/search?term=$](https://itunes.apple.com/search?term=$){encodeURIComponent(q)}&country=jp&entity=song&limit=5`);
      const data = await res.json();
      if (!data.results || data.results.length === 0) {
        itunesResults.innerHTML = `<div class="p-2 text-center text-gray-500">曲が見つかりませんでした</div>`;
        return;
      }
      itunesResults.innerHTML = data.results.map(r => `
        <div class="itunes-pick-item flex items-center gap-2 p-1.5 bg-dark-800 hover:bg-gray-700 rounded cursor-pointer border border-gray-700"
          data-title="${escapeHtml(r.trackName)}"
          data-artist="${escapeHtml(r.artistName)}"
          data-cover="${escapeHtml(r.artworkUrl100 || '')}"
          data-preview="${escapeHtml(r.previewUrl || '')}"
          data-year="${r.releaseDate ? r.releaseDate.substring(0, 4) : ''}">
          <img src="${r.artworkUrl100}" class="w-8 h-8 rounded object-cover">
          <div class="min-w-0 flex-1">
            <div class="font-bold text-white truncate">${escapeHtml(r.trackName)}</div>
            <div class="text-gray-400 truncate">${escapeHtml(r.artistName)}</div>
          </div>
        </div>
      `).join("");

      itunesResults.querySelectorAll(".itunes-pick-item").forEach(item => {
        item.addEventListener("click", () => {
          document.getElementById("modalTitle").value = item.getAttribute("data-title");
          document.getElementById("modalArtist").value = item.getAttribute("data-artist");
          document.getElementById("modalCoverUrl").value = item.getAttribute("data-cover");
          document.getElementById("modalPreviewUrl").value = item.getAttribute("data-preview");
          document.getElementById("modalReleaseYear").value = item.getAttribute("data-year");
          itunesResults.classList.add("hidden");
        });
      });
    } catch (err) {
      itunesResults.innerHTML = `<div class="p-2 text-center text-rose-400">検索エラー</div>`;
    }
  });
}

function openEditModal(id) {
  const s = window.songs.find(x => x.id === id);
  if (!s) return;
  document.getElementById("songModalTitle").textContent = "曲の編集";
  document.getElementById("addModalTypeTabs").classList.add("hidden"); // 編集時はタブ非表示
  document.getElementById("songForm").classList.remove("hidden");
  document.getElementById("bulkAddSection").classList.add("hidden");

  document.getElementById("modalSongId").value = s.id;
  document.getElementById("modalTitle").value = s.title || "";
  document.getElementById("modalArtist").value = s.artist || "";
  document.getElementById("modalStatus").value = s.status || "これから";
  document.getElementById("modalKey").value = s.key || "";
  document.getElementById("modalMaxPitch").value = s.maxPitch || "";
  document.getElementById("modalMinPitch").value = s.minPitch || "";
  document.getElementById("modalScore").value = s.score !== null && s.score !== undefined ? s.score : "";
  document.getElementById("modalReleaseYear").value = s.releaseYear || "";
  document.getElementById("modalMemo").value = s.memo || "";
  document.getElementById("modalCoverUrl").value = s.coverUrl || "";
  document.getElementById("modalPreviewUrl").value = s.previewUrl || "";
  document.getElementById("modalTags").value = (s.tags || []).join(", ");
  document.getElementById("btnDeleteSong").classList.remove("hidden");
  document.getElementById("songModal").classList.remove("hidden");
}

// ユーティリティ
function escapeHtml(str) {
  if (!str) return "";
  return String(str).replace(/[&<>"']/g, m => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  })[m]);
}

function formatTimestamp(ts) {
  if (!ts?.seconds) return "未歌唱";
  const d = new Date(ts.seconds * 1000);
  return `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
}
