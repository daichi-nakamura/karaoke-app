// ==========================================
// Global State & Data Models
// ==========================================
let songs = [];
let filteredSongs = [];
let currentSongId = null;
let currentSort = 'title-asc';
let activeTagFilter = 'ALL';
// Mascot State
let mascotState = {
  mood: 'happy', // happy, energetic, sleeping, curious, singing
  energy: 80,
  lastInteraction: Date.now()
};
// Gemini API Configuration
const GEMINI_MODELS = [
  'gemini-2.5-flash',
  'gemini-2.0-flash',
  'gemini-1.5-flash'
];
// ==========================================
// Initialization & Event Listeners
// ==========================================
document.addEventListener('DOMContentLoaded', () => {
  loadSongsFromStorage();
  setupEventListeners();
  initMascot();
  handleHashChange();
  renderApp();
});
window.addEventListener('hashchange', handleHashChange);
function setupEventListeners() {
  // Search & Filter
  document.getElementById('searchInput')?.addEventListener('input', handleSearch);
  document.getElementById('sortSelect')?.addEventListener('change', (e) => {
    currentSort = e.target.value;
    applyFiltersAndSort();
  });
  // Modals
  document.getElementById('addSongBtn')?.addEventListener('click', () => openSongModal());
  document.getElementById('closeModalBtn')?.addEventListener('click', closeSongModal);
  document.getElementById('songForm')?.addEventListener('submit', handleSongSubmit);
 
  // AI Feature Handlers
  document.getElementById('aiSummaryBtn')?.addEventListener('click', generateAiSummary);
  document.getElementById('aiMoodSuggestBtn')?.addEventListener('click', generateAiMoodSuggest);
  // Mascot Click
  document.getElementById('livingMascot')?.addEventListener('click', handleMascotInteraction);
}
// ==========================================
// URL Hash & Intro Card Handling
// ==========================================
function handleHashChange() {
  const hash = window.location.hash;
  const replayBtn = document.getElementById('replayIntroBtn');
  if (hash === '#intro') {
    if (replayBtn) replayBtn.style.display = 'none';
    openCardWelcomeModal();
  } else {
    if (replayBtn) replayBtn.style.display = 'inline-block';
  }
}
function openCardWelcomeModal() {
  const modal = document.getElementById('cardWelcomeModal');
  if (modal) {
    modal.classList.add('is-active');
    triggerMascotReaction('curious');
  }
}
function closeCardWelcomeModal() {
  const modal = document.getElementById('cardWelcomeModal');
  if (modal) modal.classList.remove('is-active');
}
function copyDirectIntroUrl() {
  const cleanUrl = window.location.origin + window.location.pathname;
  const introUrl = `${cleanUrl}#intro`;
 
  navigator.clipboard.writeText(introUrl).then(() => {
    showToast('Direct Intro URL copied to clipboard!');
  }).catch(err => {
    console.error('Failed to copy URL: ', err);
    showToast('Failed to copy URL');
  });
}
// ==========================================
// QR Code Generator Functions
// ==========================================
function showShareQRCode(url, title = 'Share QR Code') {
  const qrModal = document.getElementById('qrCodeModal');
  const qrContainer = document.getElementById('qrcode');
  const qrTitle = document.getElementById('qrCodeTitle');
  if (!qrModal || !qrContainer) return;
|---|
  qrContainer.innerHTML = '';
  if (qrTitle) qrTitle.textContent = title;
  // Generate QR Code using QRCode library
  new QRCode(qrContainer, {
    text: url,
    width: 200,
    height: 200,
    colorDark: "#1a1a2e",
    colorLight: "#ffffff",
    correctLevel: QRCode.CorrectLevel.H
  });
  qrModal.classList.add('is-active');
}
function closeShareQRCode() {
  const qrModal = document.getElementById('qrCodeModal');
  if (qrModal) qrModal.classList.remove('is-active');
}
function handleCardShareQR() {
  const cleanUrl = window.location.origin + window.location.pathname + '#intro';
  showShareQRCode(cleanUrl, 'Karaoke Repertoire Profile');
}
// ==========================================
// Song Data & Core Parsing (Fix 1 Applied)
// ==========================================
function parseMainArtist(artistString) {
  if (!artistString) return 'Unknown Artist';
  // FIX 1: Enhanced regex prevents splitting words like 'ON' (e.g. "BAND ON THE RUN")
  return artistString.split(/\s*(?:[,&×/]|feat\.?|featuring|with)\s*/i)[0].trim();
}
function loadSongsFromStorage() {
  const stored = localStorage.getItem('karaoke_repertoire_songs');
  if (stored) {
    try {
      songs = JSON.parse(stored);
    } catch (e) {
      console.error('Failed to parse local storage data:', e);
      songs = getDefaultSongs();
    }
  } else {
    songs = getDefaultSongs();
    saveSongsToStorage();
  }
  filteredSongs = [...songs];
}
function saveSongsToStorage() {
  localStorage.setItem('karaoke_repertoire_songs', JSON.stringify(songs));
}
// ==========================================
// Filtering & Sorting Logic
// ==========================================
function handleSearch(e) {
  const query = e.target.value.toLowerCase().trim();
  applyFiltersAndSort(query);
}
function filterByTag(tag) {
  activeTagFilter = tag;
  applyFiltersAndSort();
}
function applyFiltersAndSort(query = document.getElementById('searchInput')?.value.toLowerCase().trim() || '') {
  filteredSongs = songs.filter(song => {
    const mainArtist = parseMainArtist(song.artist);
    const matchesSearch = song.title.toLowerCase().includes(query) ||
                          song.artist.toLowerCase().includes(query) ||
                          mainArtist.toLowerCase().includes(query) ||
                          (song.tags && song.tags.some(t => t.toLowerCase().includes(query)));
   
    const matchesTag = activeTagFilter === 'ALL' || (song.tags && song.tags.includes(activeTagFilter));
    return matchesSearch && matchesTag;
  });
  // Sort Logic
  filteredSongs.sort((a, b) => {
    if (currentSort === 'title-asc') return a.title.localeCompare(b.title);
    if (currentSort === 'title-desc') return b.title.localeCompare(a.title);
    if (currentSort === 'artist-asc') return parseMainArtist(a.artist).localeCompare(parseMainArtist(b.artist));
    if (currentSort === 'key-asc') return (a.keyAdjustment || 0) - (b.keyAdjustment || 0);
    if (currentSort === 'score-desc') return (b.highScore || 0) - (a.highScore || 0);
    return 0;
  });
  renderSongList();
}
// ==========================================
// UI Rendering
// ==========================================
function renderApp() {
  renderSongList();
  renderTagCloud();
  updateMascotDisplay();
}
function renderSongList() {
  const listContainer = document.getElementById('songList');
  if (!listContainer) return;
  if (filteredSongs.length === 0) {
    listContainer.innerHTML = `<div class="empty-state"><p>No songs found matching criteria.</p></div>`;
    return;
  }
  listContainer.innerHTML = filteredSongs.map(song => {
    const mainArtist = parseMainArtist(song.artist);
    const keyDisplay = song.keyAdjustment > 0 ? `+${song.keyAdjustment}` : `${song.keyAdjustment || 0}`;
   
    return `
      <div class="song-card" data-id="${song.id}">
        <div class="song-card-header">
          <h3 class="song-title">${escapeHtml(song.title)}</h3>
          <span class="key-badge">Key: ${keyDisplay}</span>
        </div>
        <div class="song-artist-info">
          <span class="main-artist">${escapeHtml(mainArtist)}</span>
          ${song.artist !== mainArtist ? `<span class="full-artist">(${escapeHtml(song.artist)})</span>` : ''}
        </div>
        <div class="song-meta">
          <span class="score">Best: ${song.highScore ? song.highScore + ' pts' : 'N/A'}</span>
          <div class="song-tags">
            ${(song.tags || []).map(t => `<span class="tag">${escapeHtml(t)}</span>`).join('')}
          </div>
        </div>
        <div class="song-actions">
          <button onclick="editSong('${song.id}')" class="btn-sm">Edit</button>
          <button onclick="deleteSong('${song.id}')" class="btn-sm btn-danger">Delete</button>
          <button onclick="showShareQRCode('${window.location.origin}?song=${song.id}', '${escapeHtml(song.title)}')" class="btn-sm">QR</button>
        </div>
      </div>
    `;
  }).join('');
}
function renderTagCloud() {
  const tagContainer = document.getElementById('tagCloud');
  if (!tagContainer) return;
  const allTags = new Set(['ALL']);
  songs.forEach(s => (s.tags || []).forEach(t => allTags.add(t)));
  tagContainer.innerHTML = Array.from(allTags).map(tag => `
    <button class="tag-chip ${activeTagFilter === tag ? 'active' : ''}" onclick="filterByTag('${tag}')">
      ${escapeHtml(tag)}
    </button>
  `).join('');
}
// ==========================================
// Gemini API Integration (Fix 2 Applied)
// ==========================================
async function fetchGeminiApi(prompt, apiKey) {
  let lastError = null;
  for (const model of GEMINI_MODELS) {
    const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`;
    try {
      const response = await fetch(endpoint, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }]
        })
      });
      if (response.ok) {
        const data = await response.json();
        return data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response content.';
      } else {
        lastError = `HTTP ${response.status}: ${await response.text()}`;
      }
    } catch (err) {
      lastError = err.message;
    }
  }
  throw new Error(`Gemini API failed across all models. Last error: ${lastError}`);
}
async function generateAiSummary() {
  const apiKey = document.getElementById('geminiApiKey')?.value || localStorage.getItem('gemini_api_key');
  if (!apiKey) {
    showToast('Please enter a valid Gemini API Key');
    return;
  }
  const prompt = `Analyze this karaoke song repertoire and provide a brief summary of musical taste, vocal range tendencies, and top genre recommendations:\n${JSON.stringify(songs)}`;
 
  try {
    showLoadingSpinner(true);
    const summary = await fetchGeminiApi(prompt, apiKey);
    document.getElementById('aiResultOutput').innerText = summary;
    triggerMascotReaction('energetic');
  } catch (err) {
    showToast(`Error: ${err.message}`);
  } finally {
    showLoadingSpinner(false);
  }
}
// FIX 2: Aligned API call structure, endpoint URL, and fallback model sequence with generateAiSummary
async function generateAiMoodSuggest() {
  const apiKey = document.getElementById('geminiApiKey')?.value || localStorage.getItem('gemini_api_key');
  const moodInput = document.getElementById('moodInput')?.value || 'energetic';
  if (!apiKey) {
    showToast('Please enter a valid Gemini API Key');
    return;
  }
  const prompt = `Based on the following repertoire, suggest 3 ideal songs for a "${moodInput}" mood or vibe. Repertoire: ${JSON.stringify(songs)}`;
  try {
    showLoadingSpinner(true);
    const suggestion = await fetchGeminiApi(prompt, apiKey);
    document.getElementById('aiResultOutput').innerText = suggestion;
    triggerMascotReaction('singing');
  } catch (err) {
    showToast(`Mood Suggestion Error: ${err.message}`);
  } finally {
    showLoadingSpinner(false);
  }
}
// ==========================================
// Living Mascot System
// ==========================================
function initMascot() {
  setInterval(() => {
    const idleTime = Date.now() - mascotState.lastInteraction;
    if (idleTime > 30000 && mascotState.mood !== 'sleeping') {
      mascotState.mood = 'sleeping';
      updateMascotDisplay();
    }
  }, 10000);
}
function handleMascotInteraction() {
  mascotState.lastInteraction = Date.now();
  const moods = ['happy', 'energetic', 'singing', 'curious'];
  mascotState.mood = moods[Math.floor(Math.random() * moods.length)];
  updateMascotDisplay();
}
function triggerMascotReaction(mood) {
  mascotState.mood = mood;
  mascotState.lastInteraction = Date.now();
  updateMascotDisplay();
}
function updateMascotDisplay() {
  const mascotEl = document.getElementById('livingMascot');
  if (!mascotEl) return;
  const moodIcons = {
    happy: '🎤 (╹◡╹)',
    energetic: '🔥 (٩◕‿◕｡6)',
    sleeping: '💤 (zzz)',
    curious: '❓ (•˓˳•)',
    singing: '🎶 (＞ヮ＜)'
  };
  mascotEl.setAttribute('data-mood', mascotState.mood);
  mascotEl.innerText = moodIcons[mascotState.mood] || moodIcons.happy;
}
// ==========================================
// CRUD Operations & Helper Functions
// ==========================================
function openSongModal(songId = null) {
  currentSongId = songId;
  const modal = document.getElementById('songModal');
  const form = document.getElementById('songForm');
  if (songId) {
    const song = songs.find(s => s.id === songId);
    if (song) {
      document.getElementById('modalTitle').textContent = 'Edit Song';
      form.title.value = song.title;
      form.artist.value = song.artist;
      form.keyAdjustment.value = song.keyAdjustment || 0;
      form.highScore.value = song.highScore || '';
      form.tags.value = (song.tags || []).join(', ');
    }
  } else {
    document.getElementById('modalTitle').textContent = 'Add New Song';
    form.reset();
  }
  modal.classList.add('is-active');
}
function closeSongModal() {
  document.getElementById('songModal')?.classList.remove('is-active');
  currentSongId = null;
}
function handleSongSubmit(e) {
  e.preventDefault();
  const form = e.target;
 
  const title = form.title.value.trim();
  const artist = form.artist.value.trim();
  const keyAdjustment = parseInt(form.keyAdjustment.value, 10) || 0;
  const highScore = parseFloat(form.highScore.value) || null;
  const tags = form.tags.value.split(',').map(t => t.trim()).filter(Boolean);
  if (!title || !artist) return;
  if (currentSongId) {
    const idx = songs.findIndex(s => s.id === currentSongId);
    if (idx !== -1) {
      songs[idx] = { ...songs[idx], title, artist, keyAdjustment, highScore, tags };
    }
  } else {
    const newSong = {
      id: 'song_' + Date.now(),
      title,
      artist,
      keyAdjustment,
      highScore,
      tags
    };
    songs.push(newSong);
  }
  saveSongsToStorage();
  applyFiltersAndSort();
  renderTagCloud();
  closeSongModal();
  triggerMascotReaction('happy');
}
function editSong(id) {
  openSongModal(id);
}
function deleteSong(id) {
  if (confirm('Are you sure you want to delete this song?')) {
    songs = songs.filter(s => s.id !== id);
    saveSongsToStorage();
    applyFiltersAndSort();
    renderTagCloud();
  }
}
function getDefaultSongs() {
  return [
    { id: '1', title: 'Pretender', artist: 'Official HIGE DANdism', keyAdjustment: -2, highScore: 92.5, tags: ['J-Pop', 'High Pitch'] },
    { id: '2', title: 'Cruel Angel\'s Thesis', artist: 'Yoko Takahashi feat. Vocal', keyAdjustment: 0, highScore: 95.0, tags: ['Anime', 'Classic'] },
    { id: '3', title: 'Band on the Run', artist: 'Paul McCartney & Wings', keyAdjustment: 0, highScore: 88.0, tags: ['Rock', 'English'] }
  ];
}
function showToast(msg) {
  const toast = document.getElementById('toast');
  if (toast) {
    toast.textContent = msg;
    toast.classList.add('show');
    setTimeout(() => toast.classList.remove('show'), 3000);
  }
}
function showLoadingSpinner(show) {
  const spinner = document.getElementById('loadingSpinner');
  if (spinner) spinner.style.display = show ? 'block' : 'none';
}
function escapeHtml(str) {
  return str.replace(/[&<>"']/g, m => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  })[m]);
}
