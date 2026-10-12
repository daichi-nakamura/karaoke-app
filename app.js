// app.js
window.songs = [];
let rankingSongs = [];
let recommendedSongs = [];
let currentRawITunesResults = [];
let bulkCandidateSongs = [];
let setlist = JSON.parse(localStorage.getItem('karaoke_setlist')) || [];

let selectedGenre = null;
let selectedTags = new Set();
let tagFilterMode = 'AND';
let selectedScore = 'all';
let selectedDecade = 'all';
let selectedAttr = 'all';

let expandedCardIds = new Set();
let isAllExpanded = false;

let currentAudio = null;
let currentPlayingId = null;
let undoHistory = {};

const ARTIST_RELATIONS = {
  'king gnu': ['Official髭男dism', 'Vaundy', '米津玄師', '藤井風'],
  '寺尾 聰': ['大滝詠一', '山下達郎', '稲垣潤一', '井上陽水'],
  'b\'z': ['WANDS', 'T-BOLAN', 'ZARD', 'L\'Arc~en~Ciel'],
  'ポルノグラフィティ': ['L\'Arc~en~Ciel', 'BUMP OF CHICKEN', 'FLOW', 'ロードオブメジャー'],
  'asian kung-fu generation': ['ELLEGARDEN', 'ストレイテナー', 'BUMP OF CHICKEN', 'RADWIMPS'],
  '椎名林檎': ['東京事変', '宇多田ヒカル', 'Cocco', '矢井田瞳'],
  'mr.children': ['スピッツ', 'コブクロ', 'ゆず', 'サザンオールスターズ']
};

const TIE_UP_PRESETS = [
  { title: 'メリッサ', artist: 'ポルノグラフィティ', year: '2003', tieUp: '📺 アニメ『鋼の錬金術師』OP' },
  { title: '遥か彼方', artist: 'ASIAN KUNG-FU GENERATION', year: '2003', tieUp: '📺 アニメ『NARUTO』OP' },
  { title: 'GO!!!', artist: 'FLOW', year: '2004', tieUp: '📺 アニメ『NARUTO』OP' },
  { title: 'INVOKE', artist: 'T.M.Revolution', year: '2002', tieUp: '📺 アニメ『ガンダムSEED』OP' },
  { title: '残酷な天使のテーゼ', artist: '高橋洋子', year: '1995', tieUp: '📺 アニメ『エヴァンゲリオン』主題歌' },
  { title: 'Everything', artist: 'MISIA', year: '2000', tieUp: '🎬 ドラマ『やまとなでしこ』主題歌' },
  { title: 'First Love', artist: '宇多田ヒカル', year: '1999', tieUp: '🎬 ドラマ『魔女の条件』主題歌' },
  { title: 'ラブ・ストーリーは突然に', artist: '小田和正', year: '1991', tieUp: '🎬 ドラマ『東京ラブストーリー』主題歌' },
  { title: 'ミュージック・アワー', artist: 'ポルノグラフィティ', year: '2000', tieUp: '🥤 ポカリスエットCMソング' }
];

// iTunes API 呼び出し（fetch失敗時は動的スクリプトタグによるJSONPで確実に取得）
function fetchITunesApi(term, limit = 1) {
  const cleanTerm = encodeURIComponent(term.trim());
  const apiUrl = `https://itunes.apple.com/search?term=${cleanTerm}&country=jp&entity=song&limit=${limit}`;

  return new Promise((resolve, reject) => {
    fetch(apiUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => resolve(data))
      .catch(() => {
        const cbName = 'itunes_jsonp_' + Date.now() + '_' + Math.floor(Math.random() * 1000);
        const script = document.createElement('script');
        script.src = `${apiUrl}&callback=${cbName}`;

        const timer = setTimeout(() => {
          cleanup();
          reject(new Error("通信がタイムアウトしました。"));
        }, 10000);

        function cleanup() {
          clearTimeout(timer);
          delete window[cbName];
          if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[cbName] = (data) => {
          cleanup();
          resolve(data);
        };

        script.onerror = () => {
          cleanup();
          reject(new Error("iTunesサーバーに接続できませんでした。"));
        };

        document.head.appendChild(script);
      });
  });
}

function saveSetlist() {
  localStorage.setItem('karaoke_setlist', JSON.stringify(setlist));
  renderSetlist();
}

function checkIsDuet(title, artist) {
  const target = `${title || ''} ${artist || ''}`.toLowerCase();
  const duetPatterns = ['feat.', 'feat ', 'featuring', 'with ', 'with\u3000', 'duet', 'デュエット', '合唱', ' & ', '＆', ' × ', '×', ' / '];
  return duetPatterns.some(pattern => target.includes(pattern));
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

window.switchModalTab = function(mode) {
  const tabSingle = document.getElementById('modalTabSingle');
  const tabBulk = document.getElementById('modalTabBulk');
  const panelSingle = document.getElementById('modalPanelSingle');
  const panelBulk = document.getElementById('modalPanelBulk');

  if (mode === 'single') {
    tabSingle.className = "px-2 py-1 rounded-md font-bold bg-indigo-600 text-white";
    tabBulk.className = "px-2 py-1 rounded-md font-bold text-slate-400 hover:text-white";
    panelSingle.classList.remove('hidden');
    panelBulk.classList.add('hidden');
  } else {
    tabBulk.className = "px-2 py-1 rounded-md font-bold bg-indigo-600 text-white";
    tabSingle.className = "px-2 py-1 rounded-md font-bold text-slate-400 hover:text-white";
    panelBulk.classList.remove('hidden');
    panelSingle.classList.add('hidden');
  }
};

window.cycleCandidateScore = function(idx) {
  if (!bulkCandidateSongs[idx]) return;
  const loop = { '練習中': '歌える', '歌える': '得意', '得意': '練習中' };
  const current = bulkCandidateSongs[idx].score || '練習中';
  bulkCandidateSongs[idx].score = loop[current] || '練習中';
  renderBulkPreview();
};

window.processBulkSearch = async function() {
  const rawText = document.getElementById('bulkTextInput').value.trim();
  if (!rawText) return alert("曲名を入力または貼り付けてください。");

  const rawLines = rawText.split('\n').map(l => l.trim()).filter(Boolean);
  if (rawLines.length === 0) return alert("有効な曲名が見つかりませんでした。");

  const progressEl = document.getElementById('bulkProgress');
  const previewArea = document.getElementById('bulkPreviewArea');
  const btnSearch = document.getElementById('btnBulkSearch');

  btnSearch.disabled = true;
  btnSearch.classList.add('opacity-50');
  progressEl.classList.remove('hidden');
  previewArea.classList.add('hidden');
  bulkCandidateSongs = [];

  const existingSet = new Set((window.songs || []).map(s => `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`));

  for (let i = 0; i < rawLines.length; i++) {
    const rawLine = rawLines[i];
    const cleanedTerm = rawLine.replace(/^[\d\.\-\*・\s]+/, '').trim() || rawLine;
    progressEl.textContent = `⏳ iTunesで検索中 (${i + 1}/${rawLines.length}): ${cleanedTerm}`;

    try {
      const data = await fetchITunesApi(cleanedTerm, 1);

      if (data.results && data.results.length > 0) {
        const item = data.results[0];
        const year = item.releaseDate ? item.releaseDate.substring(0, 4) : '';
        const mins = Math.floor((item.trackTimeMillis || 0) / 60000);
        const secs = Math.floor(((item.trackTimeMillis || 0) % 60000) / 1000).toString().padStart(2, '0');
        const isDuet = checkIsDuet(item.trackName, item.artistName);

        const tags = [];
        const yr = parseInt(year, 10);
        if (yr >= 2020) tags.push('2020年代');
        else if (yr >= 2010) tags.push('2010年代');
        else if (yr >= 2000) tags.push('2000年代');
        else if (yr < 2000) tags.push('90年代以前');

        const isAlreadyAdded = existingSet.has(`${item.trackName.toLowerCase()}_${item.artistName.toLowerCase()}`);

        bulkCandidateSongs.push({
          originalQuery: rawLine,
          title: item.trackName,
          artist: item.artistName,
          year: year,
          genre: item.primaryGenreName || 'J-Pop',
          artwork: item.artworkUrl100 || '',
          previewUrl: item.previewUrl || '',
          duration: item.trackTimeMillis ? `${mins}:${secs}` : '',
          durationMs: item.trackTimeMillis || 0,
          key: '0',
          score: '練習中',
          duetType: isDuet ? 'duet' : 'solo',
          tags: tags,
          isAlreadyAdded: isAlreadyAdded,
          isEditing: false,
          reSearchResults: []
        });
      } else {
        bulkCandidateSongs.push({
          originalQuery: rawLine,
          title: cleanedTerm,
          artist: '',
          year: '',
          genre: 'J-Pop',
          artwork: '',
          previewUrl: '',
          duration: '',
          durationMs: 0,
          key: '0',
          score: '練習中',
          duetType: 'solo',
          tags: [],
          isAlreadyAdded: false,
          notFound: true,
          isEditing: false,
          reSearchResults: []
        });
      }
    } catch (err) {
      console.error(err);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  btnSearch.disabled = false;
  btnSearch.classList.remove('opacity-50');
  progressEl.classList.add('hidden');
  previewArea.classList.remove('hidden');
  renderBulkPreview();
};

function renderBulkPreview() {
  const container = document.getElementById('bulkPreviewList');
  const countEl = document.getElementById('bulkFoundCount');
  const btnSave = document.getElementById('btnBulkSave');

  const validCount = bulkCandidateSongs.filter(s => !s.isAlreadyAdded).length;
  countEl.textContent = `候補: ${bulkCandidateSongs.length}件 (保存対象: ${validCount}件)`;
  btnSave.textContent = `${validCount}曲を一括登録する`;
  btnSave.disabled = validCount === 0;

  container.innerHTML = bulkCandidateSongs.map((s, idx) => `
    <div class="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5 shadow-sm">
      <div class="flex items-center justify-between text-[10px] text-slate-400 border-b border-slate-900 pb-1">
        <span class="truncate flex items-center gap-1">
          <span class="text-indigo-400 font-semibold">🔍 入力:</span>
          <span class="text-slate-300 font-mono bg-slate-900 px-1.5 py-0.2 rounded border border-slate-800">「${escapeHtml(s.originalQuery)}」</span>
        </span>
        <div class="flex items-center gap-1 shrink-0">
          <button type="button" onclick="toggleEditBulkCandidate(${idx})" class="text-indigo-400 hover:text-indigo-300 px-1 text-xs font-semibold">
            ${s.isEditing ? '完了' : '✏️ 修正'}
          </button>
          <button type="button" onclick="removeBulkCandidate(${idx})" class="text-slate-500 hover:text-rose-400 px-1 text-xs">✕ 除外</button>
        </div>
      </div>

      <div class="flex items-center gap-2.5">
        ${s.artwork ? `<img src="${s.artwork}" class="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-800 border border-slate-800">` : `<div class="w-10 h-10 rounded-lg bg-slate-800 flex items-center justify-center shrink-0 text-slate-500 text-xs border border-slate-800">🎵</div>`}
        <div class="min-w-0 flex-1">
          <div class="font-bold text-white truncate flex items-center gap-1.5">
            <span>${escapeHtml(s.title)}</span>
            ${s.key !== '0' ? `<span class="text-[9px] bg-slate-800 text-indigo-300 border border-slate-700 px-1 rounded font-mono">${s.key}</span>` : ''}
            <button type="button" onclick="cycleCandidateScore(${idx})" title="タップで完成度を変更" class="text-[9px] px-1.5 py-0.2 rounded cursor-pointer transition active:scale-95 ${s.score === '得意' ? 'bg-emerald-950 text-emerald-300 border border-emerald-800 hover:bg-emerald-900' : s.score === '歌える' ? 'bg-sky-950 text-sky-300 border border-sky-800 hover:bg-sky-900' : 'bg-amber-950 text-amber-300 border border-amber-800 hover:bg-amber-900'}">
              ${s.score} 🔄
            </button>
            ${s.duetType === 'duet' ? '<span class="text-[9px] bg-purple-950 text-purple-300 border border-purple-800 px-1 rounded whitespace-nowrap">デュエット</span>' : ''}
            ${s.isAlreadyAdded ? '<span class="text-[9px] bg-slate-800 text-slate-400 border border-slate-700 px-1 rounded whitespace-nowrap">登録済</span>' : ''}
            ${s.notFound ? '<span class="text-[9px] bg-amber-950 text-amber-400 border border-amber-800 px-1 rounded whitespace-nowrap">情報なし</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-400 truncate mt-0.5">
            ${escapeHtml(s.artist) || '歌手未設定'} ${s.year ? '• ' + s.year + '年' : ''} ${s.genre ? '• ' + escapeHtml(s.genre) : ''}
          </div>
        </div>
      </div>

      ${s.isEditing ? `
        <div class="bg-slate-900/90 p-2.5 rounded-lg border border-slate-800 space-y-2 mt-1.5">
          <div class="grid grid-cols-2 gap-1.5">
            <div>
              <label class="block text-[9px] text-slate-400 mb-0.5">曲名</label>
              <input type="text" id="editTitle_${idx}" value="${escapeHtml(s.title)}" onchange="updateBulkCandidateField(${idx}, 'title', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white">
            </div>
            <div>
              <label class="block text-[9px] text-slate-400 mb-0.5">歌手名</label>
              <input type="text" id="editArtist_${idx}" value="${escapeHtml(s.artist)}" onchange="updateBulkCandidateField(${idx}, 'artist', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white">
            </div>
          </div>
          <div class="grid grid-cols-4 gap-1.5">
            <div>
              <label class="block text-[9px] text-slate-400 mb-0.5">キー</label>
              <select onchange="updateBulkCandidateField(${idx}, 'key', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[11px] text-white">
                ${['-6','-5','-4','-3','-2','-1','0','+1','+2','+3','+4','+5','+6'].map(k => `<option value="${k}" ${s.key === k ? 'selected' : ''}>${k === '0' ? '原曲' : k}</option>`).join('')}
              </select>
            </div>
            <div>
              <label class="block text-[9px] text-emerald-400 mb-0.5">完成度</label>
              <select onchange="updateBulkCandidateField(${idx}, 'score', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[11px] text-white">
                <option value="得意" ${s.score === '得意' ? 'selected' : ''}>得意</option>
                <option value="歌える" ${s.score === '歌える' ? 'selected' : ''}>歌える</option>
                <option value="練習中" ${s.score === '練習中' ? 'selected' : ''}>練習中</option>
              </select>
            </div>
            <div>
              <label class="block text-[9px] text-slate-400 mb-0.5">タイプ</label>
              <select onchange="updateBulkCandidateField(${idx}, 'duetType', this.value)" class="w-full bg-slate-950 border border-slate-700 rounded px-1 py-1 text-[11px] text-white">
                <option value="solo" ${s.duetType === 'solo' ? 'selected' : ''}>ソロ</option>
                <option value="duet" ${s.duetType === 'duet' ? 'selected' : ''}>デュエット</option>
              </select>
            </div>
            <div>
              <label class="block text-[9px] text-slate-400 mb-0.5">年</label>
              <input type="text" id="editYear_${idx}" value="${escapeHtml(s.year || '')}" onchange="updateBulkCandidateField(${idx}, 'year', this.value)" placeholder="2020" class="w-full bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[11px] text-white">
            </div>
          </div>

          <div class="pt-1.5 border-t border-slate-800">
            <div class="text-[9px] text-indigo-400 font-semibold mb-1">🔍 iTunesから再検索して選択差し替え</div>
            <div class="flex gap-1">
              <input type="text" id="reSearchInput_${idx}" onkeydown="if(event.key==='Enter'){event.preventDefault(); reSearchSingleBulkCandidate(${idx});}" placeholder="歌手名や曲名を入力..." value="${escapeHtml((s.title || '') + ' ' + (s.artist || ''))}" class="flex-1 bg-slate-950 border border-slate-700 rounded px-1.5 py-1 text-[10px] text-white focus:outline-none focus:border-indigo-500">
              <button type="button" onclick="reSearchSingleBulkCandidate(${idx})" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2 py-1 rounded text-[10px] font-semibold whitespace-nowrap">再検索</button>
            </div>

            <!-- 単曲検索と同じ選択リストを展開 -->
            <div id="reSearchResults_${idx}" class="mt-1.5 max-h-44 overflow-y-auto no-scrollbar space-y-1 ${s.reSearchResults && s.reSearchResults.length > 0 ? '' : 'hidden'}">
              ${(s.reSearchResults || []).map(item => {
                const raw = encodeURIComponent(JSON.stringify(item));
                return `
                  <div onclick="applyITunesSongToCandidate(${idx}, '${raw}')" class="flex items-center gap-2 p-1.5 bg-slate-950 hover:bg-indigo-950/40 border border-slate-800 hover:border-indigo-600/60 rounded-lg cursor-pointer transition">
                    ${item.artwork ? `<img src="${item.artwork}" class="w-8 h-8 rounded object-cover shrink-0 bg-slate-800">` : `<div class="w-8 h-8 rounded bg-slate-800 flex items-center justify-center text-[10px] text-slate-500 shrink-0">🎵</div>`}
                    <div class="min-w-0 flex-1 text-[10px]">
                      <div class="font-bold text-white truncate flex items-center gap-1">
                        <span>${escapeHtml(item.title)}</span>
                        ${item.isDuet ? '<span class="text-[8px] bg-purple-950 text-purple-300 px-1 rounded">デュエット</span>' : ''}
                      </div>
                      <div class="text-slate-400 truncate text-[9px]">${escapeHtml(item.artist)} • ${item.year || '年不明'} • ${escapeHtml(item.genre)}</div>
                    </div>
                    <span class="text-[9px] text-indigo-400 border border-indigo-700/60 bg-indigo-950/60 px-1.5 py-0.5 rounded font-bold shrink-0">選択</span>
                  </div>
                `;
              }).join('')}
            </div>
          </div>
        </div>
      ` : ''}
    </div>
  `).join('');
}

window.toggleEditBulkCandidate = function(idx) {
  bulkCandidateSongs[idx].isEditing = !bulkCandidateSongs[idx].isEditing;
  if (!bulkCandidateSongs[idx].isEditing) {
    bulkCandidateSongs[idx].reSearchResults = [];
  }
  renderBulkPreview();
};

window.updateBulkCandidateField = function(idx, field, val) {
  if (!bulkCandidateSongs[idx]) return;
  bulkCandidateSongs[idx][field] = val;
  if (field === 'title' || field === 'artist') {
    const existingSet = new Set((window.songs || []).map(s => `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`));
    bulkCandidateSongs[idx].isAlreadyAdded = existingSet.has(`${bulkCandidateSongs[idx].title.toLowerCase()}_${bulkCandidateSongs[idx].artist.toLowerCase()}`);
    bulkCandidateSongs[idx].notFound = false;
  }
};

// 一括登録用の単曲検索と同じ候補取得
window.reSearchSingleBulkCandidate = async function(idx) {
  const inputEl = document.getElementById(`reSearchInput_${idx}`);
  const term = inputEl ? inputEl.value.trim() : '';
  if (!term) return alert("検索キーワードを入力してください。");

  const resultsBox = document.getElementById(`reSearchResults_${idx}`);
  if (resultsBox) {
    resultsBox.classList.remove('hidden');
    resultsBox.innerHTML = '<div class="text-[10px] text-slate-400 py-1.5 text-center">iTunesで候補を検索中...</div>';
  }

  try {
    const data = await fetchITunesApi(term, 25);
    if (!data.results || data.results.length === 0) {
      if (resultsBox) resultsBox.innerHTML = '<div class="text-[10px] text-slate-500 py-1.5 text-center">曲が見つかりませんでした</div>';
      return;
    }

    bulkCandidateSongs[idx].reSearchResults = data.results.map(item => {
      const year = item.releaseDate ? item.releaseDate.substring(0, 4) : '';
      const mins = Math.floor((item.trackTimeMillis || 0) / 60000);
      const secs = Math.floor(((item.trackTimeMillis || 0) % 60000) / 1000).toString().padStart(2, '0');
      const isDuet = checkIsDuet(item.trackName, item.artistName);

      return {
        title: item.trackName,
        artist: item.artistName,
        year: year,
        genre: item.primaryGenreName || 'J-Pop',
        artwork: item.artworkUrl100 || '',
        previewUrl: item.previewUrl || '',
        duration: item.trackTimeMillis ? `${mins}:${secs}` : '',
        durationMs: item.trackTimeMillis || 0,
        isDuet: isDuet
      };
    });

    renderBulkPreview();
  } catch (e) {
    if (resultsBox) resultsBox.innerHTML = `<div class="text-[10px] text-rose-400 py-1.5 text-center">検索エラー: ${e.message}</div>`;
  }
};

// 候補一覧から曲をタップして反映（編集画面は開いたまま維持）
window.applyITunesSongToCandidate = function(idx, encoded) {
  const item = JSON.parse(decodeURIComponent(encoded));
  if (!bulkCandidateSongs[idx]) return;

  const existingSet = new Set((window.songs || []).map(s => `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`));
  const isAlreadyAdded = existingSet.has(`${item.title.toLowerCase()}_${item.artist.toLowerCase()}`);

  bulkCandidateSongs[idx].title = item.title;
  bulkCandidateSongs[idx].artist = item.artist;
  bulkCandidateSongs[idx].year = item.year;
  bulkCandidateSongs[idx].genre = item.genre;
  bulkCandidateSongs[idx].artwork = item.artwork;
  bulkCandidateSongs[idx].previewUrl = item.previewUrl;
  bulkCandidateSongs[idx].duration = item.duration;
  bulkCandidateSongs[idx].durationMs = item.durationMs;
  bulkCandidateSongs[idx].duetType = item.isDuet ? 'duet' : 'solo';
  bulkCandidateSongs[idx].isAlreadyAdded = isAlreadyAdded;
  bulkCandidateSongs[idx].notFound = false;
  bulkCandidateSongs[idx].reSearchResults = []; // リストを閉じる
  // isEditingはtrueのまま維持してユーザーが確認・微調整できるようにする

  renderBulkPreview();
};

window.removeBulkCandidate = function(idx) {
  bulkCandidateSongs.splice(idx, 1);
  renderBulkPreview();
};

window.saveBulkSongs = async function() {
  if (!window.firestoreOps) return alert("データベースに接続されていません。");
  const toSave = bulkCandidateSongs.filter(s => !s.isAlreadyAdded);
  if (toSave.length === 0) return alert("登録対象の曲がありません。");

  const { collection, addDoc } = window.firestoreOps;
  let count = 0;
  for (const s of toSave) {
    await addDoc(collection(window.db, "songs"), {
      title: s.title,
      artist: s.artist,
      year: s.year,
      genre: s.genre,
      maxPitch: '',
      minPitch: '',
      artwork: s.artwork,
      previewUrl: s.previewUrl,
      duration: s.duration,
      durationMs: s.durationMs,
      scoreVal: null,
      duetType: s.duetType || 'solo',
      key: s.key || '0',
      score: s.score || '練習中',
      tags: s.tags || [],
      memo: '',
      singCount: 0,
      lastSungAt: null,
      createdAt: Date.now() + count
    });
    count++;
  }
  alert(`🎉 ${count}曲を一括登録しました！`);
  closeModal();
};

window.openSettingsModal = function() {
  document.getElementById('migrateProgressText').classList.add('hidden');
  document.getElementById('settingsModal').classList.remove('hidden');
};
window.closeSettingsModal = function() {
  document.getElementById('settingsModal').classList.add('hidden');
};

window.startDataMigration = async function() {
  if (!window.firestoreOps || !window.songs || window.songs.length === 0) return alert("曲データが存在しません。");
  const progressEl = document.getElementById('migrateProgressText');
  const btnEl = document.getElementById('btnMigrate');
  const targets = window.songs.filter(s => !s.artwork || !s.previewUrl || !s.durationMs || !s.year);
  
  if (targets.length === 0) return alert("✨ すべての曲データはすでに最新情報で補完されています！");
  if (!confirm(`全${window.songs.length}曲中、未補完の曲が【${targets.length}曲】見つかりました。\niTunesから情報を自動取得してFirestoreを更新しますか？`)) return;

  btnEl.disabled = true;
  btnEl.classList.add('opacity-50');
  progressEl.classList.remove('hidden');

  let updatedCount = 0;
  const { doc, updateDoc } = window.firestoreOps;

  for (let i = 0; i < targets.length; i++) {
    const s = targets[i];
    progressEl.textContent = `⏳ 補完処理中 (${i + 1}/${targets.length}): ${s.title}`;
    try {
      const data = await fetchITunesApi((s.title + ' ' + (s.artist || '')).trim(), 1);
      if (data.results && data.results.length > 0) {
        const hit = data.results[0];
        const patch = {};
        if (!s.artwork && hit.artworkUrl100) patch.artwork = hit.artworkUrl100;
        if (!s.previewUrl && hit.previewUrl) patch.previewUrl = hit.previewUrl;
        if (!s.duration && hit.trackTimeMillis) {
          const mins = Math.floor(hit.trackTimeMillis / 60000);
          const secs = Math.floor((hit.trackTimeMillis % 60000) / 1000).toString().padStart(2, '0');
          patch.duration = `${mins}:${secs}`;
          patch.durationMs = hit.trackTimeMillis;
        }
        if (!s.year && hit.releaseDate) patch.year = hit.releaseDate.substring(0, 4);
        if (!s.genre && hit.primaryGenreName) patch.genre = hit.primaryGenreName;
        if (!s.duetType) patch.duetType = checkIsDuet(hit.trackName, hit.artistName) ? 'duet' : 'solo';

        if (Object.keys(patch).length > 0) {
          await updateDoc(doc(window.db, "songs", s.id), patch);
          updatedCount++;
        }
      }
    } catch (err) {
      console.error(err);
    }
    await new Promise(r => setTimeout(r, 250));
  }

  btnEl.disabled = false;
  btnEl.classList.remove('opacity-50');
  progressEl.textContent = `🎉 完了！ ${updatedCount}曲のデータを最新に更新しました。`;
  alert(`補完が完了しました！\n更新された曲数: ${updatedCount}件`);
};

window.exportBackupJSON = function() {
  if (!window.songs || window.songs.length === 0) return alert("曲データがありません。");
  const dataStr = "data:text/json;charset=utf-8," + encodeURIComponent(JSON.stringify(window.songs, null, 2));
  const a = document.createElement('a');
  a.setAttribute("href", dataStr);
  a.setAttribute("download", `karaoke_backup_${new Date().toISOString().split('T')[0]}.json`);
  document.body.appendChild(a);
  a.click();
  a.remove();
};

window.importBackupJSON = function(e) {
  const file = e.target.files[0];
  if (!file) return;
  const reader = new FileReader();
  reader.onload = async function(evt) {
    try {
      const imported = JSON.parse(evt.target.result);
      if (!Array.isArray(imported)) throw new Error("不正なデータ形式です。");
      if (!confirm(`バックアップファイルから ${imported.length} 曲を読み込みました。\n復元しますか？`)) return;

      const { collection, addDoc } = window.firestoreOps;
      let count = 0;
      for (const s of imported) {
        const { id, ...dataToSave } = s;
        await addDoc(collection(window.db, "songs"), { ...dataToSave, createdAt: dataToSave.createdAt || Date.now() });
        count++;
      }
      alert(`🎉 ${count} 曲の復元が完了しました！`);
      closeSettingsModal();
    } catch (err) {
      alert("読み込み失敗: " + err.message);
    }
  };
  reader.readAsText(file);
  e.target.value = '';
};

window.resetAllSingHistory = async function() {
  if (!confirm("⚠️ 全曲の歌唱回数と歌唱履歴をリセットしますか？")) return;
  if (!confirm("本当に元に戻せませんがよろしいですか？")) return;

  const { doc, updateDoc } = window.firestoreOps;
  for (const s of window.songs) {
    if (s.singCount || s.lastSungAt) {
      await updateDoc(doc(window.db, "songs", s.id), { singCount: 0, lastSungAt: null });
    }
  }
  alert("全曲の歌唱カウンターをゼロにリセットしました。");
  closeSettingsModal();
};

window.switchMainTab = function(tab) {
  const tabs = [
    { id: 'mylist', btn: document.getElementById('navTabMyList'), view: document.getElementById('viewMyList') },
    { id: 'recommend', btn: document.getElementById('navTabRecommend'), view: document.getElementById('viewRecommend') },
    { id: 'ranking', btn: document.getElementById('navTabRanking'), view: document.getElementById('viewRanking') }
  ];
  tabs.forEach(t => {
    if (!t.btn || !t.view) return;
    if (t.id === tab) {
      t.btn.className = "py-1.5 rounded-lg font-bold transition bg-indigo-600 text-white shadow text-center truncate";
      t.view.classList.remove('hidden');
    } else {
      t.btn.className = "py-1.5 rounded-lg font-bold transition text-slate-400 hover:text-white text-center truncate";
      t.view.classList.add('hidden');
    }
  });

  if (tab === 'ranking' && rankingSongs.length === 0) loadRanking();
  else if (tab === 'recommend' && recommendedSongs.length === 0) analyzeAndRecommend();
};

window.togglePlayPreview = async function(url, id, trackName = '', artistName = '', trackId = '') {
  if (currentPlayingId === id && currentAudio) {
    currentAudio.pause();
    currentAudio = null;
    currentPlayingId = null;
    renderAllViews();
    return;
  }
  if (currentAudio) {
    currentAudio.pause();
    currentAudio = null;
  }

  let playableUrl = url;
  if (!playableUrl && (trackId || (trackName && artistName))) {
    try {
      const q = trackId ? `https://itunes.apple.com/lookup?id=${trackId}&country=jp` : `${trackName} ${artistName}`;
      const data = trackId 
        ? await fetch(`https://itunes.apple.com/lookup?id=${trackId}&country=jp`).then(r => r.json())
        : await fetchITunesApi(q, 1);
      if (data.results && data.results.length > 0 && data.results[0].previewUrl) {
        playableUrl = data.results[0].previewUrl;
      }
    } catch (e) { console.error(e); }
  }

  if (!playableUrl) return alert("⚠️ 試聴音源が見つかりませんでした");

  currentAudio = new Audio(playableUrl);
  currentPlayingId = id;
  currentAudio.play().catch(() => { currentPlayingId = null; renderAllViews(); });
  currentAudio.onended = () => { currentPlayingId = null; renderAllViews(); };
  renderAllViews();
};

function renderAllViews() {
  render();
  renderRanking();
  renderRecommended();
}

window.loadRanking = async function() {
  const container = document.getElementById('rankingList');
  container.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">ランキングを取得中...</div>';
  try {
    const res = await fetch('https://itunes.apple.com/jp/rss/topsongs/limit=50/json');
    const data = await res.json();
    rankingSongs = (data.feed.entry || []).map((entry, idx) => {
      let previewUrl = '';
      if (entry.link) {
        const links = Array.isArray(entry.link) ? entry.link : [entry.link];
        const pLink = links.find(l => l.attributes && (l.attributes.title === 'Preview' || (l.attributes.href && l.attributes.href.includes('.m4a'))));
        if (pLink) previewUrl = pLink.attributes.href;
      }
      return {
        rank: idx + 1,
        trackId: entry.id?.attributes?.['im:id'] || '',
        title: entry['im:name'] ? entry['im:name'].label : '',
        artist: entry['im:artist'] ? entry['im:artist'].label : '',
        artwork: entry['im:image'] && entry['im:image'].length > 2 ? entry['im:image'][2].label : '',
        year: entry['im:releaseDate'] ? entry['im:releaseDate'].label.substring(0, 4) : '',
        genre: entry.category?.attributes?.label || 'J-Pop',
        previewUrl
      };
    });
    renderRanking();
  } catch (e) {
    container.innerHTML = '<div class="text-center text-rose-400 py-12 text-sm">ランキングの取得に失敗しました</div>';
  }
};

function renderRanking() {
  const container = document.getElementById('rankingList');
  if (rankingSongs.length === 0) return container.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">曲がありません</div>';

  container.innerHTML = rankingSongs.map(item => {
    const playId = `ranking_${item.rank}`;
    const isPlaying = currentPlayingId === playId;
    const alreadyInList = (window.songs || []).some(s => s.title.toLowerCase() === item.title.toLowerCase() && s.artist.toLowerCase() === item.artist.toLowerCase());
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
        <span class="font-mono font-bold text-sm text-indigo-400 w-5 text-center shrink-0">${item.rank}</span>
        <div onclick="togglePlayPreview('${item.previewUrl || ''}', '${playId}', '${escapeHtml(item.title)}', '${escapeHtml(item.artist)}', '${item.trackId || ''}')" class="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 cursor-pointer shadow border border-slate-800 bg-slate-800">
          <img src="${item.artwork || ''}" class="w-full h-full object-cover">
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center transition ${isPlaying ? 'opacity-100 bg-rose-950/70' : 'opacity-0 hover:opacity-100'}">
            <span class="text-xs text-white">${isPlaying ? '⏹' : '▶'}</span>
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-sm text-white truncate">${escapeHtml(item.title)}</div>
          <div class="text-xs text-slate-400 truncate">${escapeHtml(item.artist)}</div>
          <div class="text-[10px] text-slate-500 mt-0.5">${item.year}年 • ${escapeHtml(item.genre)}</div>
        </div>
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <button onclick="addFromRanking('${encoded}')" class="text-xs px-2.5 py-1 rounded-lg font-bold border transition whitespace-nowrap ${alreadyInList ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'}">
            ${alreadyInList ? '登録済' : '＋ 追加'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.analyzeAndRecommend = async function() {
  const insightEl = document.getElementById('recommendInsight');
  const listEl = document.getElementById('recommendList');

  if (!window.songs || window.songs.length === 0) {
    insightEl.innerHTML = 'マイリストに曲が登録されていません。';
    listEl.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">マイリストが空です</div>';
    return;
  }

  insightEl.innerHTML = 'マイリストの歌手・年代プロファイルを解析中...';
  listEl.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">昔の名曲・数珠つなぎ候補を発掘中...</div>';

  const artistCounts = {};
  const decadeCounts = { '90s': 0, '2000s': 0, '2010s': 0, '2020s': 0 };

  window.songs.forEach(s => {
    if (s.artist) {
      const main = s.artist.split(/[,&×/feat.]+/i)[0].trim();
      if (main) artistCounts[main] = (artistCounts[main] || 0) + 1;
    }
    const yr = parseInt(s.year, 10);
    if (yr) {
      if (yr < 2000) decadeCounts['90s']++;
      else if (yr < 2010) decadeCounts['2000s']++;
      else if (yr < 2020) decadeCounts['2010s']++;
      else decadeCounts['2020s']++;
    }
  });

  const topArtists = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]).slice(0, 3);
  const topDecade = Object.keys(decadeCounts).reduce((a, b) => decadeCounts[a] > decadeCounts[b] ? a : b);
  const decadeLabel = { '90s': '90年代以前', '2000s': '2000年代', '2010s': '2010年代', '2020s': '2020年代' }[topDecade];

  let relatedArtists = [];
  topArtists.forEach(a => {
    const l = a.toLowerCase();
    Object.keys(ARTIST_RELATIONS).forEach(k => {
      if (l.includes(k) || k.includes(l)) relatedArtists.push(...ARTIST_RELATIONS[k]);
    });
  });
  relatedArtists = Array.from(new Set(relatedArtists)).slice(0, 3);

  insightEl.innerHTML = `
    <div class="font-bold text-indigo-300">💡 カラオケプロファイル</div>
    <div>よく歌う歌手: <strong class="text-white">${topArtists.join(', ') || '未設定'}</strong></div>
    ${relatedArtists.length ? `<div>数珠つなぎ連想: <strong class="text-emerald-300">${relatedArtists.join(', ')}</strong></div>` : ''}
    <div>中心年代: <strong class="text-white">${decadeLabel}</strong></div>
  `;

  const fetchedCandidates = [];
  const myTitles = new Set(window.songs.map(s => (s.title || '').toLowerCase().replace(/\s+/g, '')));

  for (const artist of topArtists.slice(0, 2)) {
    try {
      const data = await fetchITunesApi(artist, 10);
      (data.results || []).forEach(item => {
        if (!myTitles.has((item.trackName || '').toLowerCase().replace(/\s+/g, ''))) {
          fetchedCandidates.push({
            title: item.trackName,
            artist: item.artistName,
            year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
            genre: item.primaryGenreName || 'J-Pop',
            artwork: item.artworkUrl100 || '',
            previewUrl: item.previewUrl || '',
            durationMs: item.trackTimeMillis || 0,
            reason: `🎤 「${artist}」の未登録人気曲`
          });
        }
      });
    } catch (e) {}
  }

  for (const rArtist of relatedArtists.slice(0, 2)) {
    try {
      const data = await fetchITunesApi(rArtist, 5);
      (data.results || []).forEach(item => {
        if (!myTitles.has((item.trackName || '').toLowerCase().replace(/\s+/g, ''))) {
          fetchedCandidates.push({
            title: item.trackName,
            artist: item.artistName,
            year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
            genre: item.primaryGenreName || 'J-Pop',
            artwork: item.artworkUrl100 || '',
            previewUrl: item.previewUrl || '',
            durationMs: item.trackTimeMillis || 0,
            reason: `🔗 同系統「${rArtist}」の代表曲`
          });
        }
      });
    } catch (e) {}
  }

  for (const t of TIE_UP_PRESETS) {
    if (!myTitles.has(t.title.toLowerCase().replace(/\s+/g, ''))) {
      fetchedCandidates.push({ ...t, genre: 'J-Pop', artwork: '', previewUrl: '', reason: t.tieUp });
    }
  }

  const uniqueMap = new Map();
  fetchedCandidates.forEach(c => {
    const k = `${c.title}_${c.artist}`.toLowerCase();
    if (!uniqueMap.has(k)) uniqueMap.set(k, c);
  });

  recommendedSongs = Array.from(uniqueMap.values()).sort(() => 0.5 - Math.random()).slice(0, 20);
  renderRecommended();
};

function renderRecommended() {
  const container = document.getElementById('recommendList');
  if (recommendedSongs.length === 0) return container.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">発掘できる新曲が見つかりませんでした</div>';

  container.innerHTML = recommendedSongs.map((item, idx) => {
    const playId = `rec_${idx}`;
    const isPlaying = currentPlayingId === playId;
    const alreadyInList = (window.songs || []).some(s => s.title.toLowerCase() === item.title.toLowerCase() && s.artist.toLowerCase() === item.artist.toLowerCase());
    const encoded = encodeURIComponent(JSON.stringify(item));
    return `
      <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
        <div onclick="togglePlayPreview('${item.previewUrl || ''}', '${playId}', '${escapeHtml(item.title)}', '${escapeHtml(item.artist)}')" class="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 cursor-pointer shadow border border-slate-800 bg-slate-800">
          ${item.artwork ? `<img src="${item.artwork}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-lg text-slate-600">🎵</div>'}
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center transition ${isPlaying ? 'opacity-100 bg-rose-950/70' : 'opacity-0 hover:opacity-100'}">
            <span class="text-xs text-white">${isPlaying ? '⏹' : '▶'}</span>
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="font-bold text-sm text-white truncate">${escapeHtml(item.title)}</div>
          <div class="text-xs text-slate-400 truncate">${escapeHtml(item.artist)}</div>
          <div class="text-[10px] text-indigo-300 mt-0.5 truncate">${escapeHtml(item.reason || '')} ${item.year ? '• ' + item.year + '年' : ''}</div>
        </div>
        <div class="flex flex-col items-end gap-1.5 shrink-0">
          <button onclick="addFromRanking('${encoded}')" class="text-xs px-2.5 py-1 rounded-lg font-bold border transition whitespace-nowrap ${alreadyInList ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'}">
            ${alreadyInList ? '登録済' : '＋ 追加'}
          </button>
        </div>
      </div>
    `;
  }).join('');
}

window.addFromRanking = function(encoded) {
  const data = JSON.parse(decodeURIComponent(encoded));
  openModal();
  document.getElementById('formTitle').value = data.title;
  document.getElementById('formArtist').value = data.artist;
  document.getElementById('formYear').value = data.year;
  document.getElementById('formGenre').value = data.genre;
  document.getElementById('formArtwork').value = data.artwork || '';
  document.getElementById('formPreviewUrl').value = data.previewUrl || '';
  document.getElementById('formDuetType').value = checkIsDuet(data.title, data.artist) ? 'duet' : 'solo';

  const yr = parseInt(data.year, 10);
  const tags = [];
  if (yr >= 2020) tags.push('2020年代');
  else if (yr >= 2010) tags.push('2010年代');
  else if (yr >= 2000) tags.push('2000年代');
  else if (yr < 2000) tags.push('90年代以前');
  tags.push('名曲発掘');
  document.getElementById('formTags').value = tags.join(', ');
};

window.searchITunes = async function() {
  const term = document.getElementById('apiSearchInput').value.trim();
  const resultBox = document.getElementById('apiSearchResults');
  const sortRow = document.getElementById('apiSortRow');
  if (!term) return;

  resultBox.classList.remove('hidden');
  sortRow.classList.add('hidden');
  resultBox.innerHTML = '<div class="text-[11px] text-slate-500 py-1">50件取得中...</div>';

  try {
    const data = await fetchITunesApi(term, 50);
    if (!data.results || data.results.length === 0) return resultBox.innerHTML = '<div class="text-[11px] text-slate-500 py-1">曲が見つかりませんでした</div>';

    currentRawITunesResults = data.results.map(item => {
      const year = item.releaseDate ? item.releaseDate.substring(0, 4) : '';
      const mins = Math.floor((item.trackTimeMillis || 0) / 60000);
      const secs = Math.floor(((item.trackTimeMillis || 0) % 60000) / 1000).toString().padStart(2, '0');
      const isDuet = checkIsDuet(item.trackName, item.artistName);

      const tags = [];
      const yr = parseInt(year, 10);
      if (yr >= 2020) tags.push('2020年代');
      else if (yr >= 2010) tags.push('2010年代');
      else if (yr >= 2000) tags.push('2000年代');
      else if (yr < 2000) tags.push('90年代以前');

      if (item.trackTimeMillis && item.trackTimeMillis < 190000) tags.push('短め');
      else if (item.trackTimeMillis && item.trackTimeMillis > 300000) tags.push('長尺');

      return {
        title: item.trackName,
        artist: item.artistName,
        year: year,
        genre: item.primaryGenreName || 'J-Pop',
        artwork: item.artworkUrl100 || '',
        previewUrl: item.previewUrl || '',
        duration: item.trackTimeMillis ? `${mins}:${secs}` : '',
        durationMs: item.trackTimeMillis || 0,
        isDuet: isDuet,
        tags: tags
      };
    });

    sortRow.classList.remove('hidden');
    renderITunesResults();
  } catch (e) {
    resultBox.innerHTML = `<div class="text-[11px] text-rose-400 py-1">検索に失敗しました: ${e.message}</div>`;
  }
};

window.renderITunesResults = function() {
  const resultBox = document.getElementById('apiSearchResults');
  const sortMode = document.getElementById('apiSortSelect').value;
  const countEl = document.getElementById('apiResultCount');
  
  let list = [...currentRawITunesResults];
  if (sortMode === 'title') list.sort((a, b) => a.title.localeCompare(b.title, 'ja'));
  else if (sortMode === 'yearDesc') list.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
  else if (sortMode === 'yearAsc') list.sort((a, b) => (parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));

  countEl.textContent = `${list.length}件の曲`;

  resultBox.innerHTML = list.map(item => {
    const rawItem = encodeURIComponent(JSON.stringify(item));
    return `
      <div onclick="selectITunesSong('${rawItem}')" class="flex items-center gap-2.5 p-2 hover:bg-slate-900 rounded-xl cursor-pointer border border-slate-800 transition">
        <img src="${item.artwork || ''}" class="w-10 h-10 rounded-lg object-cover shrink-0 bg-slate-800 shadow">
        <div class="min-w-0 flex-1">
          <div class="text-xs font-bold text-white truncate flex items-center gap-1.5">
            <span>${escapeHtml(item.title)}</span>
            ${item.isDuet ? '<span class="text-[9px] bg-purple-950 text-purple-300 border border-purple-800 px-1 rounded whitespace-nowrap">👥 デュエット</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-500 truncate">${escapeHtml(item.artist)} • ${item.year || '年不明'} • ${escapeHtml(item.genre)}</div>
          <div class="text-[9px] text-indigo-400 mt-0.5 truncate">自動タグ: #${item.tags.join(' #')}</div>
        </div>
      </div>
    `;
  }).join('');
};

window.selectITunesSong = function(encoded) {
  const data = JSON.parse(decodeURIComponent(encoded));
  document.getElementById('formTitle').value = data.title;
  document.getElementById('formArtist').value = data.artist;
  document.getElementById('formYear').value = data.year;
  document.getElementById('formGenre').value = data.genre;
  document.getElementById('formArtwork').value = data.artwork;
  document.getElementById('formPreviewUrl').value = data.previewUrl;
  document.getElementById('formDuration').value = data.duration;
  document.getElementById('formDurationMs').value = data.durationMs || 0;
  document.getElementById('formDuetType').value = data.isDuet ? 'duet' : 'solo';
  document.getElementById('formTags').value = (data.tags || []).join(', ');
  document.getElementById('apiSearchResults').classList.add('hidden');
  document.getElementById('apiSortRow').classList.add('hidden');
};

window.toggleSetlistDrawer = function() {
  document.getElementById('setlistDrawer').classList.toggle('translate-y-full');
};
window.addToSetlist = function(id) {
  if (!setlist.includes(id)) { setlist.push(id); saveSetlist(); }
  document.getElementById('setlistDrawer').classList.remove('translate-y-full');
};
window.removeFromSetlist = function(id) {
  setlist = setlist.filter(x => x !== id);
  saveSetlist();
};
window.moveSetlistItem = function(idx, direction) {
  const targetIdx = idx + direction;
  if (targetIdx < 0 || targetIdx >= setlist.length) return;
  const temp = setlist[idx];
  setlist[idx] = setlist[targetIdx];
  setlist[targetIdx] = temp;
  saveSetlist();
};
window.clearSetlist = function() {
  if (confirm('セットリストをすべてクリアしますか？')) { setlist = []; saveSetlist(); }
};

window.renderSetlist = function() {
  const countEl = document.getElementById('setlistBadge');
  const summaryEl = document.getElementById('setlistSummary');
  const container = document.getElementById('setlistItems');

  if (setlist.length > 0) {
    countEl.textContent = setlist.length;
    countEl.classList.remove('hidden');

    let totalMs = 0;
    setlist.forEach(id => {
      const s = (window.songs || []).find(x => x.id === id);
      if (s) totalMs += (s.durationMs || 240000);
    });
    const totalMins = Math.floor(totalMs / 60000);
    const totalSecs = Math.floor((totalMs % 60000) / 1000).toString().padStart(2, '0');
    summaryEl.textContent = `${setlist.length}曲 • 合計 約${totalMins}分${totalSecs}秒`;
  } else {
    countEl.classList.add('hidden');
    summaryEl.textContent = '0曲 • 合計 0分00秒';
  }

  if (setlist.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 py-6 text-xs">セットリストに曲がありません</div>';
    return;
  }

  container.innerHTML = setlist.map((songId, idx) => {
    const s = (window.songs || []).find(x => x.id === songId);
    if (!s) return '';
    return `
      <div class="flex items-center justify-between gap-2 p-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono font-bold text-indigo-400 w-4 text-center shrink-0">${idx + 1}</span>
          <div class="min-w-0">
            <div class="font-bold text-white truncate">${escapeHtml(s.title)}</div>
            <div class="text-[10px] text-slate-400 truncate">${escapeHtml(s.artist)} • ${s.key === '0' ? '原曲' : 'キー ' + s.key} ${s.duration ? '(' + s.duration + ')' : ''}</div>
          </div>
        </div>
        <div class="flex items-center gap-1 shrink-0">
          <button onclick="moveSetlistItem(${idx}, -1)" ${idx === 0 ? 'disabled class="opacity-30 p-1"' : 'class="text-slate-400 hover:text-white p-1"'}>▲</button>
          <button onclick="moveSetlistItem(${idx}, 1)" ${idx === setlist.length - 1 ? 'disabled class="opacity-30 p-1"' : 'class="text-slate-400 hover:text-white p-1"'}>▼</button>
          <button onclick="recordSung('${s.id}'); removeFromSetlist('${s.id}')" class="bg-indigo-900/60 hover:bg-indigo-900 border border-indigo-700/60 text-indigo-200 px-2 py-0.5 rounded text-[10px] ml-1 whitespace-nowrap">
            歌った!
          </button>
          <button onclick="removeFromSetlist('${s.id}')" class="text-slate-500 hover:text-rose-400 p-1">✕</button>
        </div>
      </div>
    `;
  }).join('');
};

window.toggleExpandCard = function(id) {
  if (expandedCardIds.has(id)) expandedCardIds.delete(id);
  else expandedCardIds.add(id);
  updateToggleAllExpandButtonState();
  render();
};

window.toggleAllExpand = function() {
  const currentList = getCurrentFilteredSongs();
  if (isAllExpanded) {
    expandedCardIds.clear();
    isAllExpanded = false;
  } else {
    currentList.forEach(s => expandedCardIds.add(s.id));
    isAllExpanded = true;
  }
  updateToggleAllExpandButtonState();
  render();
};

function updateToggleAllExpandButtonState() {
  const icon = document.getElementById('toggleAllExpandIcon');
  const text = document.getElementById('toggleAllExpandText');
  if (!icon || !text) return;
  if (isAllExpanded) {
    icon.textContent = '📕';
    text.textContent = '全折畳';
  } else {
    icon.textContent = '📖';
    text.textContent = '全展開';
  }
}

function getCurrentFilteredSongs() {
  const queryStr = (document.getElementById('searchInput')?.value || '').toLowerCase();
  return (window.songs || []).filter(s => {
    const matchesQuery = (s.title || '').toLowerCase().includes(queryStr) || 
                         (s.artist || '').toLowerCase().includes(queryStr) ||
                         (s.memo || '').toLowerCase().includes(queryStr) ||
                         (s.genre || '').toLowerCase().includes(queryStr) ||
                         (s.maxPitch || '').toLowerCase().includes(queryStr) ||
                         (s.minPitch || '').toLowerCase().includes(queryStr) ||
                         (s.year ? s.year.toString().includes(queryStr) : false) ||
                         (s.tags && s.tags.some(t => t.toLowerCase().includes(queryStr)));
    
    const matchesGenre = selectedGenre ? s.genre === selectedGenre : true;
    
    let matchesTag = true;
    if (selectedTags.size > 0) {
      const songTags = s.tags || [];
      matchesTag = tagFilterMode === 'AND'
        ? Array.from(selectedTags).every(t => songTags.includes(t))
        : Array.from(selectedTags).some(t => songTags.includes(t));
    }

    const matchesScore = selectedScore === 'all' ? true : s.score === selectedScore;
    
    let matchesDecade = true;
    const yr = parseInt(s.year, 10);
    if (selectedDecade === '2020s') matchesDecade = yr >= 2020;
    else if (selectedDecade === '2010s') matchesDecade = yr >= 2010 && yr <= 2019;
    else if (selectedDecade === '2000s') matchesDecade = yr >= 2000 && yr <= 2009;
    else if (selectedDecade === '90s') matchesDecade = yr < 2000;

    let matchesAttr = true;
    if (selectedAttr === 'original') matchesAttr = s.key === '0';
    else if (selectedAttr === 'plus') matchesAttr = (s.key || '').startsWith('+');
    else if (selectedAttr === 'minus') matchesAttr = (s.key || '').startsWith('-');
    else if (selectedAttr === 'duet') matchesAttr = s.duetType === 'duet';

    return matchesQuery && matchesGenre && matchesTag && matchesScore && matchesDecade && matchesAttr;
  });
}

window.render = function() {
  const sortSelect = document.getElementById('sortSelect');
  const sortMode = sortSelect ? sortSelect.value : 'lastSung';
  let filtered = getCurrentFilteredSongs();

  filtered.sort((a, b) => {
    if (sortMode === 'lastSung') return (b.lastSungAt || 0) - (a.lastSungAt || 0);
    if (sortMode === 'singCount') return (b.singCount || 0) - (a.singCount || 0);
    if (sortMode === 'scoreVal') return (parseFloat(b.scoreVal) || 0) - (parseFloat(a.scoreVal) || 0);
    if (sortMode === 'releaseYear') return (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
    if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '', 'ja');
    return (b.createdAt || 0) - (a.createdAt || 0);
  });

  const allGenres = Array.from(new Set((window.songs || []).map(s => s.genre).filter(Boolean)));
  const genreContainer = document.getElementById('genreFilterList');
  if (genreContainer) {
    genreContainer.innerHTML = '';
    if (allGenres.length > 0) {
      genreContainer.innerHTML += `<button onclick="setFilterGenre(null)" class="px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 transition ${selectedGenre === null ? 'bg-indigo-600 text-white font-medium' : 'bg-slate-900 text-slate-400 border border-slate-800'}">全ジャンル</button>`;
      allGenres.forEach(g => {
        genreContainer.innerHTML += `<button onclick="setFilterGenre('${g}')" class="px-2.5 py-0.5 rounded-full whitespace-nowrap shrink-0 transition ${selectedGenre === g ? 'bg-indigo-600 text-white font-medium' : 'bg-slate-900 text-slate-400 border border-slate-800'}">${escapeHtml(g)}</button>`;
      });
    }
  }

  const allTags = Array.from(new Set((window.songs || []).flatMap(s => s.tags || [])));
  const tagContainer = document.getElementById('tagFilterList');
  const tagBadge = document.getElementById('selectedTagBadge');
  
  if (tagBadge) {
    if (selectedTags.size > 0) {
      tagBadge.textContent = selectedTags.size;
      tagBadge.classList.remove('hidden');
    } else {
      tagBadge.classList.add('hidden');
    }
  }

  if (tagContainer) {
    tagContainer.innerHTML = '';
    if (allTags.length > 0) {
      allTags.forEach(tag => {
        const isSelected = selectedTags.has(tag);
        tagContainer.innerHTML += `
          <button onclick="toggleTagFilter('${escapeHtml(tag)}')" class="px-2 py-0.5 rounded-full whitespace-nowrap shrink-0 transition text-[11px] flex items-center gap-1 ${
            isSelected ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-950 text-slate-400 border border-slate-800 hover:text-white'
          }">
            <span>#${escapeHtml(tag)}</span>
            ${isSelected ? '<span class="text-[9px]">✓</span>' : ''}
          </button>
        `;
      });
    }
  }

  const songCountEl = document.getElementById('songCount');
  if (songCountEl) {
    songCountEl.textContent = `登録曲: ${filtered.length}曲 / 全${(window.songs || []).length}曲`;
  }

  const listContainer = document.getElementById('songList');
  if (!listContainer) return;

  if (filtered.length === 0) {
    listContainer.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">該当する曲がありません</div>';
    return;
  }

  listContainer.innerHTML = filtered.map(s => {
    const isPlaying = currentPlayingId === s.id;
    const lyricsSearchUrl = `https://www.google.com/search?q=${encodeURIComponent(s.title + ' ' + (s.artist || '') + ' 歌詞')}`;
    const hasUndo = undoHistory[s.id] !== undefined;
    const inSetlist = setlist.includes(s.id);
    const isExpanded = expandedCardIds.has(s.id);
    const pUrl = s.previewUrl || '';

    return `
      <div class="bg-slate-900/90 border border-slate-800 rounded-2xl shadow-sm transition overflow-hidden">
        <div class="p-3 flex items-center gap-2.5">
          ${s.artwork ? `
            <img src="${s.artwork}" onclick="toggleExpandCard('${s.id}')" class="w-12 h-12 rounded-xl object-cover shrink-0 bg-slate-800 shadow border border-slate-800/80 cursor-pointer">
          ` : `
            <div onclick="toggleExpandCard('${s.id}')" class="w-12 h-12 rounded-xl bg-slate-800 border border-slate-800/80 flex items-center justify-center shrink-0 text-lg text-slate-600 cursor-pointer">🎵</div>
          `}

          <div class="min-w-0 flex-1 cursor-pointer" onclick="toggleExpandCard('${s.id}')">
            <div class="flex items-center gap-1.5">
              <div class="font-bold text-sm text-white truncate">${escapeHtml(s.title)}</div>
              <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold whitespace-nowrap shrink-0 ${
                s.key === '0' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                (s.key || '').startsWith('+') ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                'bg-blue-950 text-blue-300 border border-blue-800'
              }">${s.key === '0' ? '原曲' : 'キー ' + s.key}</span>
            </div>

            <div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(s.artist) || '歌手未設定'}</div>

            <div class="flex items-center gap-1 flex-wrap mt-1 text-[9px]">
              <span class="px-1 py-0.2 rounded font-medium whitespace-nowrap ${
                s.score === '得意' ? 'bg-emerald-950 text-emerald-400 border border-emerald-800/80' :
                s.score === '歌える' ? 'bg-sky-950 text-sky-400 border border-sky-800/80' :
                'bg-amber-950 text-amber-400 border border-amber-800/80'
              }">${s.score}</span>
              ${s.scoreVal ? `<span class="bg-amber-950/80 text-amber-300 px-1 py-0.2 rounded border border-amber-700/80 font-mono font-bold">🎯 ${s.scoreVal}点</span>` : ''}
              ${s.singCount ? `<span class="bg-indigo-950/70 text-indigo-300 px-1 py-0.2 rounded border border-indigo-800/70 font-mono">🔥 ${s.singCount}回</span>` : ''}
              ${s.duetType === 'duet' ? '<span class="bg-purple-950 text-purple-300 border border-purple-800">👥 デュエット</span>' : ''}
            </div>
          </div>

          <div class="flex flex-col items-end gap-1.5 shrink-0">
            <div class="flex items-center gap-1">
              <button onclick="recordSung('${s.id}')" title="歌った！" class="text-indigo-200 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-700/80 px-2 py-1 rounded-lg font-bold text-[10px] whitespace-nowrap">
                🎤 歌った
              </button>
              <button onclick="openEditModal('${s.id}')" title="編集" class="text-slate-400 hover:text-indigo-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 p-1 rounded-lg text-xs">
                ✏️
              </button>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="${inSetlist ? `removeFromSetlist('${s.id}')` : `addToSetlist('${s.id}')`}" class="text-[10px] px-2 py-0.5 rounded-md font-medium border transition whitespace-nowrap ${inSetlist ? 'bg-indigo-950 border-indigo-600 text-indigo-300' : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'}">
                ${inSetlist ? '✓ セトリ' : '＋ セトリ'}
              </button>
              <button onclick="toggleExpandCard('${s.id}')" class="text-slate-500 hover:text-slate-300 text-xs px-1 py-0.5">
                <span>${isExpanded ? '▲' : '▼'}</span>
              </button>
            </div>
          </div>
        </div>

        ${isExpanded ? `
          <div class="px-3.5 pb-3.5 pt-1 border-t border-slate-800/60 bg-slate-950/50 space-y-2.5">
            <div class="flex items-center gap-1.5 flex-wrap text-[10px] text-slate-400">
              ${s.year ? `<span class="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono">${s.year}年</span>` : ''}
              ${s.genre ? `<span class="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800">${escapeHtml(s.genre)}</span>` : ''}
              ${s.maxPitch ? `<span class="bg-amber-950/60 text-amber-300 px-1.5 py-0.5 rounded border border-amber-800/60 font-mono">最高: ${escapeHtml(s.maxPitch)}</span>` : ''}
              ${s.minPitch ? `<span class="bg-sky-950/60 text-sky-300 px-1.5 py-0.5 rounded border border-sky-800/60 font-mono">最低: ${escapeHtml(s.minPitch)}</span>` : ''}
              ${s.duration ? `<span class="bg-slate-900 px-1.5 py-0.5 rounded border border-slate-800 font-mono">⏱️ ${s.duration}</span>` : ''}
            </div>

            ${s.memo ? `<div class="text-xs text-slate-300 bg-slate-900/80 p-2.5 rounded-xl border border-slate-800/80 leading-relaxed">${escapeHtml(s.memo)}</div>` : ''}

            ${s.tags && s.tags.length ? `
              <div class="flex flex-wrap gap-1">
                ${s.tags.map(t => `<span class="text-[10px] bg-slate-900 text-slate-400 px-2 py-0.5 rounded-md border border-slate-800">#${escapeHtml(t)}</span>`).join('')}
              </div>
            ` : ''}

            <div class="flex items-center justify-between pt-1 gap-1 text-[11px] overflow-x-auto no-scrollbar">
              <div class="flex items-center gap-1.5 shrink-0">
                ${hasUndo ? `
                  <button onclick="undoSung('${s.id}')" class="text-amber-400 hover:text-amber-300 bg-amber-950/60 border border-amber-800/80 px-1.5 py-1 rounded-lg font-medium text-[10px] whitespace-nowrap">
                    ↩ 歌唱取消
                  </button>
                ` : ''}
              </div>

              <div class="flex items-center gap-1 shrink-0">
                <button onclick="togglePlayPreview('${pUrl}', '${s.id}', '${escapeHtml(s.title)}', '${escapeHtml(s.artist)}')" class="px-2 py-1 rounded-lg font-medium border flex items-center gap-1 whitespace-nowrap ${isPlaying ? 'bg-rose-900 border-rose-700 text-rose-200' : 'bg-slate-800 border-slate-700 text-slate-300'}">
                  ${isPlaying ? '⏹ 停止' : '▶ 試聴'}
                </button>
                <a href="${lyricsSearchUrl}" target="_blank" rel="noopener" class="text-slate-400 hover:text-sky-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1 whitespace-nowrap">
                  📄 歌詞
                </a>
                <a href="https://www.youtube.com/results?search_query=${encodeURIComponent((s.artist ? s.artist + ' ' : '') + s.title)}" target="_blank" rel="noopener" class="text-slate-400 hover:text-red-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1 whitespace-nowrap">
                  ▶️ YT
                </a>
                <button onclick="deleteSong('${s.id}')" class="text-slate-500 hover:text-rose-400 bg-slate-800 border border-slate-700 p-1 rounded-lg text-xs" title="削除">🗑️</button>
              </div>
            </div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
};

window.toggleTagFilter = function(tag) {
  if (selectedTags.has(tag)) selectedTags.delete(tag);
  else selectedTags.add(tag);
  render();
};
window.clearSelectedTags = function() { selectedTags.clear(); render(); };
window.setTagFilterMode = function(mode) {
  tagFilterMode = mode;
  document.getElementById('tagModeAnd').className = mode === 'AND' ? "px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white" : "px-1.5 py-0.5 rounded text-[9px] text-slate-400 hover:text-white";
  document.getElementById('tagModeOr').className = mode === 'OR' ? "px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white" : "px-1.5 py-0.5 rounded text-[9px] text-slate-400 hover:text-white";
  render();
};
window.setScoreFilter = function(score) {
  selectedScore = score;
  document.querySelectorAll('.score-tab').forEach(b => {
    b.className = b.dataset.val === score 
      ? 'score-tab px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap shrink-0' 
      : 'score-tab px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });
  render();
};
window.setDecadeFilter = function(decade) {
  selectedDecade = decade;
  document.querySelectorAll('.decade-tab').forEach(b => {
    b.className = b.dataset.val === decade 
      ? 'decade-tab px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap shrink-0' 
      : 'decade-tab px-2.5 py-1 rounded-lg bg-slate-900 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });
  render();
};
window.setAttrFilter = function(attr) {
  selectedAttr = attr;
  document.querySelectorAll('.attr-tab').forEach(b => {
    b.className = b.dataset.val === attr 
      ? 'attr-tab px-2 py-0.5 rounded-md bg-slate-800 text-white font-medium whitespace-nowrap shrink-0' 
      : 'attr-tab px-2 py-0.5 rounded-md bg-slate-900 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });
  render();
};
window.setFilterGenre = function(g) { selectedGenre = g; render(); };

window.recordSung = async function(id) {
  if (!window.firestoreOps) return;
  const target = (window.songs || []).find(s => s.id === id);
  if (!target) return;

  undoHistory[id] = { lastSungAt: target.lastSungAt || null, singCount: target.singCount || 0 };
  render();

  const { doc, updateDoc } = window.firestoreOps;
  await updateDoc(doc(window.db, "songs", id), { 
    lastSungAt: Date.now(),
    singCount: (target.singCount || 0) + 1
  });

  setTimeout(() => {
    if (undoHistory[id] !== undefined) {
      delete undoHistory[id];
      render();
    }
  }, 10000);
};

window.undoSung = async function(id) {
  if (!window.firestoreOps || undoHistory[id] === undefined) return;
  const prev = undoHistory[id];
  delete undoHistory[id];
  render();

  const { doc, updateDoc } = window.firestoreOps;
  await updateDoc(doc(window.db, "songs", id), { 
    lastSungAt: prev.lastSungAt,
    singCount: prev.singCount
  });
};

function resetModalInputs() {
  ['editSongId','formTitle','formArtist','formYear','formGenre','formMaxPitch','formMinPitch','formArtwork','formPreviewUrl','formDuration','formLastSungAt','formScoreVal','formTags','formMemo','apiSearchInput','bulkTextInput'].forEach(id => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  document.getElementById('formDurationMs').value = '0';
  document.getElementById('formSingCount').value = '0';
  document.getElementById('formDuetType').value = 'solo';
  document.getElementById('formKey').value = '0';
  document.getElementById('formScore').value = '練習中';
  
  document.getElementById('apiSearchResults').innerHTML = '';
  document.getElementById('apiSearchResults').classList.add('hidden');
  document.getElementById('apiSortRow').classList.add('hidden');
  document.getElementById('apiSortSelect').value = 'default';
  currentRawITunesResults = [];

  document.getElementById('bulkProgress').classList.add('hidden');
  document.getElementById('bulkPreviewArea').classList.add('hidden');
  document.getElementById('bulkPreviewList').innerHTML = '';
  bulkCandidateSongs = [];
}

window.openModal = function() {
  resetModalInputs();
  document.getElementById('modalTitle').textContent = '🎵 曲を登録';
  document.getElementById('modalTabContainer').classList.remove('hidden');
  document.getElementById('resetSungRow').classList.add('hidden');
  switchModalTab('single');
  document.getElementById('modal').classList.remove('hidden');
};

window.openEditModal = function(id) {
  const s = window.songs.find(x => x.id === id);
  if (!s) return;
  resetModalInputs();
  
  document.getElementById('editSongId').value = s.id;
  document.getElementById('modalTitle').textContent = '✏️ 曲を編集';
  document.getElementById('modalTabContainer').classList.add('hidden');
  switchModalTab('single');

  document.getElementById('formTitle').value = s.title || '';
  document.getElementById('formArtist').value = s.artist || '';
  document.getElementById('formYear').value = s.year || '';
  document.getElementById('formGenre').value = s.genre || '';
  document.getElementById('formMaxPitch').value = s.maxPitch || '';
  document.getElementById('formMinPitch').value = s.minPitch || '';
  document.getElementById('formArtwork').value = s.artwork || '';
  document.getElementById('formPreviewUrl').value = s.previewUrl || '';
  document.getElementById('formDuration').value = s.duration || '';
  document.getElementById('formDurationMs').value = s.durationMs || 0;
  document.getElementById('formLastSungAt').value = s.lastSungAt || '';
  document.getElementById('formSingCount').value = s.singCount || 0;
  document.getElementById('formScoreVal').value = s.scoreVal || '';
  document.getElementById('formDuetType').value = s.duetType || 'solo';
  document.getElementById('formKey').value = s.key || '0';
  document.getElementById('formScore').value = s.score || '練習中';
  document.getElementById('formTags').value = (s.tags || []).join(', ');
  document.getElementById('formMemo').value = s.memo || '';
  
  const resetRow = document.getElementById('resetSungRow');
  if (s.lastSungAt || s.singCount) resetRow.classList.remove('hidden');
  else resetRow.classList.add('hidden');

  document.getElementById('modal').classList.remove('hidden');
};

window.clearSungHistory = function() {
  if (confirm('歌唱履歴と回数をクリアしますか？')) {
    document.getElementById('formLastSungAt').value = '';
    document.getElementById('formSingCount').value = '0';
    document.getElementById('resetSungRow').classList.add('hidden');
  }
};

window.closeModal = function() {
  document.getElementById('modal').classList.add('hidden');
};

window.handleSave = async function(e) {
  e.preventDefault();
  if (!window.firestoreOps) return alert("データベースに接続されていません。");

  const editId = document.getElementById('editSongId').value;
  const tags = document.getElementById('formTags').value
    .split(/[\s,、]+/)
    .map(t => t.trim().replace(/^#/, ''))
    .filter(Boolean);

  const songData = {
    title: document.getElementById('formTitle').value,
    artist: document.getElementById('formArtist').value,
    year: document.getElementById('formYear').value,
    genre: document.getElementById('formGenre').value.trim(),
    maxPitch: document.getElementById('formMaxPitch').value.trim(),
    minPitch: document.getElementById('formMinPitch').value.trim(),
    artwork: document.getElementById('formArtwork').value,
    previewUrl: document.getElementById('formPreviewUrl').value,
    duration: document.getElementById('formDuration').value,
    durationMs: parseInt(document.getElementById('formDurationMs').value, 10) || 0,
    scoreVal: document.getElementById('formScoreVal').value ? parseFloat(document.getElementById('formScoreVal').value) : null,
    duetType: document.getElementById('formDuetType').value,
    key: document.getElementById('formKey').value,
    score: document.getElementById('formScore').value,
    tags: tags,
    memo: document.getElementById('formMemo').value,
    singCount: parseInt(document.getElementById('formSingCount').value, 10) || 0,
    lastSungAt: document.getElementById('formLastSungAt').value ? Number(document.getElementById('formLastSungAt').value) : null
  };

  const { collection, addDoc, doc, updateDoc } = window.firestoreOps;
  if (editId) {
    await updateDoc(doc(window.db, "songs", editId), songData);
  } else {
    await addDoc(collection(window.db, "songs"), {
      ...songData,
      createdAt: Date.now(),
      singCount: 0,
      lastSungAt: null
    });
  }
  closeModal();
};

window.deleteSong = async function(id) {
  if (confirm('この曲を削除しますか？')) {
    if (!window.firestoreOps) return;
    removeFromSetlist(id);
    const { doc, deleteDoc } = window.firestoreOps;
    await deleteDoc(doc(window.db, "songs", id));
  }
};

window.pickRandom = function() {
  let pool = getCurrentFilteredSongs();
  if (pool.length === 0) pool = window.songs;
  if (!pool || pool.length === 0) return;

  const pick = pool[Math.floor(Math.random() * pool.length)];
  document.getElementById('randomTitle').textContent = pick.title;
  document.getElementById('randomArtist').textContent = pick.artist || '歌手未設定';
  document.getElementById('randomMeta').textContent = `${pick.year ? pick.year + '年 • ' : ''}${pick.genre || ''}${pick.maxPitch ? ' • 最高 ' + pick.maxPitch : ''}`;
  document.getElementById('randomKey').textContent = 'キー: ' + (pick.key === '0' ? '原曲キー' : pick.key);
  document.getElementById('randomBanner').classList.remove('hidden');
};

window.closeRandom = function() {
  document.getElementById('randomBanner').classList.add('hidden');
};

render();
