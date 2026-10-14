// app.js
window.songs = [];
let rankingSongs = [];
let recommendedSongs = [];
let currentRawITunesResults = [];
let bulkCandidateSongs = [];
let artistDiscographySongs = [];
let setlist = JSON.parse(localStorage.getItem('karaoke_setlist')) || [];

let selectedTags = new Set();
let tagFilterMode = 'AND';
let selectedScore = 'all';
let selectedDecade = 'all';
let selectedAttr = 'all';
let selectedPitchRange = 'all';

let expandedCardIds = new Set();
let isAllExpanded = false;

let currentAudio = null;
let currentPlayingId = null;
let undoHistory = {};

// デモモードフラグ
let isDemoMode = localStorage.getItem('ohako_is_demo_mode') === 'true';

// 空気読みセッション用
let currentMoodFlow = [];
let activeMoodAttrs = new Set();

// 総括編集用
let summaryCandidateSongs = [];

// ユーザーが手動でソート・検索を変えた時以外の並び順固定用キャッシュ
window.isUserSorting = false;
let renderedSongOrderIds = [];

// アーティスト連想マップ
const ARTIST_RELATIONS = {
  'king gnu': ['Official髭男dism', 'Vaundy', '米津玄師', '藤井風'],
  '寺尾 聰': ['大滝詠一', '山下達郎', '稲垣潤一', '井上陽水'],
  'b\'z': ['WANDS', 'T-BOLAN', 'ZARD', 'L\'Arc~en~Ciel'],
  'ポルノグラフィティ': ['L\'Arc~en~Ciel', 'BUMP OF CHICKEN', 'FLOW', 'ロードオブメジャー'],
  'asian kung-fu generation': ['ELLEGARDEN', 'ストレイテナー', 'BUMP OF CHICKEN', 'RADWIMPS'],
  '椎名林檎': ['東京事変', '宇多田ヒカル', 'Cocco', '矢井田瞳'],
  'mr.children': ['スピッツ', 'コブクロ', 'ゆず', 'サザンオールスターズ']
};

// 主要アーティストのエイリアス拡充辞書
const ARTIST_ALIASES = {
  'king gnu': ['キングヌー', 'きんぐぬー', 'きんぐ', 'kinggnu'],
  'official髭男dism': ['ヒゲダン', 'ひげだん', 'ひげだんでぃずむ', '髭男', 'ひげ'],
  'b\'z': ['ビーズ', 'びーず', 'bz'],
  'vaundy': ['バウンディ', 'ばうんでぃ', 'ばうん'],
  'radwimps': ['ラッドウィンプス', 'らっど', 'ラッド', 'rad'],
  'bump of chicken': ['バンプオブチキン', 'バンプ', 'ばんぷ', 'bump'],
  'asian kung-fu generation': ['アジアンカンフージェネレーション', 'アジカン', 'あじかん'],
  'l\'arc~en~ciel': ['ラルクアンシエル', 'ラルク', 'らるく'],
  'mrs. green apple': ['ミセスグリーンアップル', 'ミセス', 'みせす', 'mrsgreenapple'],
  'wanima': ['ワニマ', 'わにま'],
  'yoasobi': ['ヨアソビ', 'よあそび'],
  'back number': ['バックナンバー', 'ばっくなんばー', 'バクナン'],
  'aiko': ['アイコ', 'あいこ'],
  'aimer': ['エメ', 'えめ'],
  'uverworld': ['ウーバーワールド', 'ウーバー', 'うーばー'],
  'sekai no owari': ['セカイノオワリ', 'セカオワ', 'せかおわ'],
  'one ok rock': ['ワンオクロック', 'ワンオク', 'わんおく', '10969'],
  'superfly': ['スーパーフライ', 'すーぱーふらい'],
  'man with a mission': ['マンウィズアミッション', 'マンウィズ', 'mwam'],
  'alexandros': ['アレキサンドロス', 'ドロス', 'あれき'],
  'ado': ['アド', 'あど'],
  'lisa': ['リサ', 'りさ'],
  'dish//': ['ディッシュ', 'でぃっしゅ', 'dish'],
  'sixtones': ['ストーンズ', 'すとーんず', 'すと'],
  'snow man': ['スノーマン', 'すのーまん', 'すの'],
  'da pump': ['ダパンプ', 'だぱんぷ'],
  'wacci': ['ワッチ', 'わっち'],
  't.m.revolution': ['ティーエムレボリューション', 'てぃーえむ', 'tmr', '西川貴教'],
  'creepy nuts': ['クリーピーナッツ', 'くりーぴーなっつ', 'くりーぴー']
};

// 定番「英字曲名」エイリアス辞書
const TITLE_ALIASES = {
  'pretender': ['プリテンダー', 'ぷりてんだー'],
  'subtitle': ['サブタイトル', 'さぶたいとる'],
  'idol': ['アイドル', 'あいどる'],
  'marigold': ['マリーゴールド', 'まりーごーるど'],
  'dry flower': ['ドライフラワー', 'どらいふらわー'],
  'rpg': ['アールピージー', 'あーるぴーじー'],
  'hanabi': ['ハナビ', 'はなび', '花火'],
  'betelgeuse': ['ベテルギウス', 'べてるぎうす'],
  'kaiju no hanauta': ['かいじゅうのはなうた', '怪獣の花唄']
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

// 音域判定ヘルパー
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

function getPitchNameFromRank(rank) {
  if (!rank) return "";
  return Object.keys(PITCH_RANK).find(k => PITCH_RANK[k] === rank) || "";
}

function matchPitchRange(maxPitch, rangeKey) {
  if (rangeKey === "all") return true;
  const rank = getPitchRank(maxPitch);
  if (rank === 0) return false;
  switch (rangeKey) {
    case "low": return rank <= 29;
    case "normal": return rank >= 30 && rank <= 32;
    case "high": return rank >= 33 && rank <= 34;
    case "ultra": return rank >= 35;
    default: return true;
  }
}

function hiraToKata(str) {
  return (str || '').replace(/[\u3041-\u3096]/g, m => String.fromCharCode(m.charCodeAt(0) + 0x60));
}

function kataToHira(str) {
  return (str || '').replace(/[\u30a1-\u30f6]/g, m => String.fromCharCode(m.charCodeAt(0) - 0x60));
}

function normalizeSearchTerm(str) {
  if (!str) return '';
  return str.normalize('NFKC').replace(/[,，、/／]+/g, ' ').replace(/\s+/g, ' ').trim();
}

function fetchITunesApi(term, limit = 50) {
  const normalized = normalizeSearchTerm(term);
  const cleanTerm = encodeURIComponent(normalized);
  const apiUrl = `https://itunes.apple.com/search?term=${cleanTerm}&country=jp&entity=song&limit=${limit}`;

  return new Promise((resolve, reject) => {
    fetch(apiUrl)
      .then(res => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then(data => resolve(data))
      .catch(() => {
        const cbName = 'itunes_cb_' + Date.now() + '_' + Math.floor(Math.random() * 10000);
        const script = document.createElement('script');
        script.src = `${apiUrl}&callback=${cbName}`;

        let isHandled = false;
        const timer = setTimeout(() => {
          if (!isHandled) {
            isHandled = true;
            cleanup();
            reject(new Error("通信がタイムアウトしました。"));
          }
        }, 10000);

        function cleanup() {
          clearTimeout(timer);
          try { delete window[cbName]; } catch (e) { window[cbName] = undefined; }
          if (script.parentNode) script.parentNode.removeChild(script);
        }

        window[cbName] = (data) => {
          if (!isHandled) {
            isHandled = true;
            cleanup();
            resolve(data);
          }
        };

        script.onerror = () => {
          if (!isHandled) {
            isHandled = true;
            cleanup();
            reject(new Error("iTunesサーバーに接続できませんでした。"));
          }
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

function getDecadeTag(yearStr) {
  const yr = parseInt(yearStr, 10);
  if (!yr) return null;
  if (yr >= 2020) return '2020年代';
  if (yr >= 2010) return '2010年代';
  if (yr >= 2000) return '2000年代';
  if (yr >= 1990) return '1990年代';
  if (yr >= 1980) return '1980年代';
  return '1970年代以前';
}

function escapeHtml(str) {
  return (str || '').replace(/[&<>"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function lockBodyScroll(lock) {
  if (lock) {
    document.body.classList.add('overflow-hidden');
  } else {
    const hasOpenModal = !document.getElementById('modal').classList.contains('hidden') ||
                         !document.getElementById('settingsModal').classList.contains('hidden') ||
                         !document.getElementById('guideModal').classList.contains('hidden') ||
                         !document.getElementById('artistModal').classList.contains('hidden') ||
                         !document.getElementById('moodModal').classList.contains('hidden') ||
                         !document.getElementById('summaryModal').classList.contains('hidden') ||
                         !document.getElementById('summaryAddPickerModal').classList.contains('hidden') ||
                         !document.getElementById('cardShareModal').classList.contains('hidden') ||
                         !document.getElementById('cardViewModal').classList.contains('hidden') ||
                         !document.getElementById('cardWelcomeModal').classList.contains('hidden') ||
                         !document.getElementById('filterSheetBackdrop').classList.contains('hidden');
    if (!hasOpenModal) {
      document.body.classList.remove('overflow-hidden');
    }
  }
}

// ==========================================
// デモモード（ローカル保存）用ハンドラ
// ==========================================
function saveLocalDemoSongs() {
  localStorage.setItem('ohako_demo_songs', JSON.stringify(window.songs));
}

function loadLocalDemoSongs() {
  const saved = localStorage.getItem('ohako_demo_songs');
  if (saved) {
    try {
      window.songs = JSON.parse(saved);
      return;
    } catch (e) {}
  }
  // パターンB: J-Pop定番の初期プリセット
  window.songs = [
    {
      id: "demo_1",
      title: "怪獣の花唄",
      artist: "Vaundy",
      year: "2020",
      genre: "J-Pop",
      maxPitch: "hiA",
      minPitch: "mid1C",
      artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/bf/a4/0f/bfa40f42-498c-03d5-e2a2-3f191a27e7eb/source/100x100bb.jpg",
      previewUrl: "",
      duration: "3:45",
      durationMs: 225000,
      key: "0",
      score: "得意",
      scoreVal: 93.4,
      duetType: "solo",
      tags: ["2020年代", "盛り上がる", "ロック"],
      memo: "サビのブレスをしっかり。後半キー上がりに注意。",
      singCount: 5,
      lastSungAt: Date.now() - 3600000,
      createdAt: Date.now() - 86400000
    },
    {
      id: "demo_2",
      title: "Lemon",
      artist: "米津玄師",
      year: "2018",
      genre: "J-Pop",
      maxPitch: "mid2G#",
      minPitch: "lowG#",
      artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music125/v4/4a/01/2d/4a012d90-8e10-9173-9ea8-c51cae82b79e/source/100x100bb.jpg",
      previewUrl: "",
      duration: "4:15",
      durationMs: 255000,
      key: "0",
      score: "歌える",
      scoreVal: 89.2,
      duetType: "solo",
      tags: ["2010年代", "バラード", "ドラマ主題歌"],
      memo: "出だし低音を響かせる。感情を込めて。",
      singCount: 3,
      lastSungAt: Date.now() - 7200000,
      createdAt: Date.now() - 86400000
    },
    {
      id: "demo_3",
      title: "マリーゴールド",
      artist: "あいみょん",
      year: "2018",
      genre: "J-Pop",
      maxPitch: "hiB",
      minPitch: "mid1F#",
      artwork: "https://is1-ssl.mzstatic.com/image/thumb/Music115/v4/05/cf/dc/05cfdc4b-231a-6419-f9c3-1dc083161c16/source/100x100bb.jpg",
      previewUrl: "",
      duration: "5:06",
      durationMs: 306000,
      key: "-2",
      score: "得意",
      scoreVal: 91.8,
      duetType: "solo",
      tags: ["2010年代", "定番", "エモい"],
      memo: "-2で喉に負担なく気持ちよく歌える。",
      singCount: 4,
      lastSungAt: Date.now() - 10800000,
      createdAt: Date.now() - 86400000
    }
  ];
  saveLocalDemoSongs();
}

// ==========================================
// 絞り込みボトムシート制御
// ==========================================
window.openFilterSheet = function() {
  const backdrop = document.getElementById('filterSheetBackdrop');
  const sheet = document.getElementById('filterSheet');
  backdrop.classList.remove('hidden');
  requestAnimationFrame(() => {
    backdrop.classList.remove('opacity-0');
    sheet.classList.remove('translate-y-full');
  });
  lockBodyScroll(true);
};

window.closeFilterSheet = function() {
  const backdrop = document.getElementById('filterSheetBackdrop');
  const sheet = document.getElementById('filterSheet');
  backdrop.classList.add('opacity-0');
  sheet.classList.add('translate-y-full');
  setTimeout(() => {
    backdrop.classList.add('hidden');
    lockBodyScroll(false);
  }, 300);
};

document.getElementById('filterSheetBackdrop')?.addEventListener('click', (e) => {
  if (e.target.id === 'filterSheetBackdrop') closeFilterSheet();
});

window.resetAllFiltersInSheet = function() {
  selectedDecade = 'all';
  selectedScore = 'all';
  selectedAttr = 'all';
  selectedPitchRange = 'all';
  selectedTags.clear();
  window.isUserSorting = true;
  syncFilterControlsVisual();
  render();
};

function syncFilterControlsVisual() {
  document.querySelectorAll('#sheetDecadeTabs .decade-tab').forEach(b => {
    b.className = b.dataset.val === selectedDecade 
      ? 'decade-tab px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap shrink-0' 
      : 'decade-tab px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });
  document.querySelectorAll('#sheetScoreTabs .score-tab').forEach(b => {
    b.className = b.dataset.val === selectedScore 
      ? 'score-tab px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap shrink-0' 
      : 'score-tab px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });
  document.querySelectorAll('#sheetAttrTabs .attr-tab').forEach(b => {
    b.className = b.dataset.val === selectedAttr 
      ? 'attr-tab px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap shrink-0' 
      : 'attr-tab px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });
  document.querySelectorAll('#sheetPitchTabs .pitch-tab').forEach(b => {
    b.className = b.dataset.val === selectedPitchRange 
      ? 'pitch-tab px-2.5 py-1 rounded-lg bg-indigo-600 text-white font-medium whitespace-nowrap shrink-0' 
      : 'pitch-tab px-2.5 py-1 rounded-lg bg-slate-950 text-slate-400 border border-slate-800 whitespace-nowrap shrink-0';
  });

  renderFilterChips();
}

function renderFilterChips() {
  const container = document.getElementById('activeFilterChipsContainer');
  const badge = document.getElementById('activeFilterBadge');
  if (!container) return;

  const chips = [];
  if (selectedDecade !== 'all') chips.push({ type: 'decade', label: `${selectedDecade.replace('s', '年代')}` });
  if (selectedScore !== 'all') chips.push({ type: 'score', label: `習熟度: ${selectedScore}` });
  if (selectedAttr !== 'all') {
    const map = { original: '原曲キー', adjusted: 'キー調整あり', duet: 'デュエット' };
    chips.push({ type: 'attr', label: map[selectedAttr] || selectedAttr });
  }
  if (selectedPitchRange !== 'all') {
    const map = { low: '低め', normal: '標準', high: '高め', ultra: '超高音' };
    chips.push({ type: 'pitch', label: `音域: ${map[selectedPitchRange]}` });
  }
  selectedTags.forEach(t => chips.push({ type: 'tag', val: t, label: `#${t}` }));

  if (badge) {
    if (chips.length > 0) {
      badge.textContent = chips.length;
      badge.classList.remove('hidden');
    } else {
      badge.classList.add('hidden');
    }
  }

  if (chips.length === 0) {
    container.innerHTML = '<span class="text-[11px] text-slate-500">全件表示中</span>';
    return;
  }

  let html = chips.map(c => `
    <span class="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-indigo-950/80 border border-indigo-700/60 text-indigo-200 text-[11px]">
      ${escapeHtml(c.label)}
      <button onclick="removeFilterChip('${c.type}', '${escapeHtml(c.val || '')}')" class="hover:text-white text-[10px]">✕</button>
    </span>
  `).join('');

  html += `<button onclick="resetAllFiltersInSheet()" class="text-[11px] text-slate-400 hover:text-rose-400 underline ml-1">すべてクリア</button>`;
  container.innerHTML = html;
}

window.removeFilterChip = function(type, val) {
  if (type === 'decade') selectedDecade = 'all';
  if (type === 'score') selectedScore = 'all';
  if (type === 'attr') selectedAttr = 'all';
  if (type === 'pitch') selectedPitchRange = 'all';
  if (type === 'tag') selectedTags.delete(val);
  window.isUserSorting = true;
  syncFilterControlsVisual();
  render();
};

window.setPitchFilter = function(val) {
  selectedPitchRange = val;
  window.isUserSorting = true;
  syncFilterControlsVisual();
  render();
};

// ==========================================
// モーダル・一括登録ロジック
// ==========================================
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
  const loop = { 'これから': '練習中', '練習中': '歌える', '歌える': '得意', '得意': 'これから' };
  const current = bulkCandidateSongs[idx].score || 'これから';
  bulkCandidateSongs[idx].score = loop[current] || 'これから';
  renderBulkPreview();
};

window.bulkSetAllScore = function(score) {
  if (score === 'keep') return;
  bulkCandidateSongs.forEach(s => { s.score = score; });
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
        const decTag = getDecadeTag(year);
        if (decTag) tags.push(decTag);

        const isAlreadyAdded = existingSet.has(`${item.trackName.toLowerCase()}_${item.artistName.toLowerCase()}`);

        bulkCandidateSongs.push({
          id: `bulk_${i}`,
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
          score: 'これから',
          duetType: isDuet ? 'duet' : 'solo',
          tags: tags,
          isAlreadyAdded: isAlreadyAdded,
          isEditing: false,
          searchKeyword: `${item.trackName} ${item.artistName}`,
          reSearchResults: []
        });
      } else {
        bulkCandidateSongs.push({
          id: `bulk_${i}`,
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
          score: 'これから',
          duetType: 'solo',
          tags: [],
          isAlreadyAdded: false,
          notFound: true,
          isEditing: false,
          searchKeyword: cleanedTerm,
          reSearchResults: []
        });
      }
    } catch (err) {
      console.error(err);
    }
    await new Promise(r => setTimeout(r, 120));
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

  container.innerHTML = bulkCandidateSongs.map((s, idx) => {
    const playId = s.id || `bulk_${idx}`;
    const isPlaying = currentPlayingId === playId;

    const scoreClass = {
      '得意': 'bg-emerald-950 text-emerald-300 border-emerald-800',
      '歌える': 'bg-sky-950 text-sky-300 border-sky-800',
      '練習中': 'bg-amber-950 text-amber-300 border-amber-800',
      'これから': 'bg-purple-950 text-purple-300 border-purple-800'
    }[s.score] || 'bg-slate-800 text-slate-300 border-slate-700';

    return `
      <div class="p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs space-y-1.5 shadow-sm transition ${s.isAlreadyAdded ? 'opacity-60 bg-slate-950/40 border-dashed' : ''}">
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
          <div onclick="togglePlayPreview('${s.previewUrl || ''}', '${playId}', '${escapeHtml(s.title)}', '${escapeHtml(s.artist)}')" class="relative w-11 h-11 rounded-xl overflow-hidden shrink-0 cursor-pointer shadow border border-slate-800 bg-slate-800">
            ${s.artwork ? `<img src="${s.artwork}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">🎵</div>`}
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center transition ${isPlaying ? 'opacity-100 bg-rose-950/70' : 'opacity-0 hover:opacity-100'}">
              <span class="text-xs text-white">${isPlaying ? '⏹' : '▶'}</span>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="font-bold text-white truncate flex items-center gap-1.5">
              <span>${escapeHtml(s.title)}</span>
              ${s.key !== '0' ? `<span class="text-[9px] bg-slate-800 text-indigo-300 border border-slate-700 px-1 rounded font-mono">${s.key}</span>` : ''}
              <button type="button" onclick="cycleCandidateScore(${idx})" title="タップで習熟度を変更" class="text-[9px] px-1.5 py-0.2 rounded cursor-pointer transition active:scale-95 border ${scoreClass}">
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
      </div>
    `;
  }).join('');
}

window.toggleEditBulkCandidate = function(idx) {
  bulkCandidateSongs[idx].isEditing = !bulkCandidateSongs[idx].isEditing;
  renderBulkPreview();
};

window.removeBulkCandidate = function(idx) {
  bulkCandidateSongs.splice(idx, 1);
  renderBulkPreview();
};

window.saveBulkSongs = async function() {
  const toSave = bulkCandidateSongs.filter(s => !s.isAlreadyAdded);
  if (toSave.length === 0) return alert("登録対象の曲がありません。");

  const btnSave = document.getElementById('btnBulkSave');
  const progressEl = document.getElementById('bulkProgress');

  btnSave.disabled = true;
  btnSave.classList.add('opacity-50');
  progressEl.classList.remove('hidden');

  let count = 0;
  const now = Date.now();

  try {
    for (let i = 0; i < toSave.length; i++) {
      const s = toSave[i];
      progressEl.textContent = `⏳ 保存中 (${i + 1}/${toSave.length}): ${s.title}`;

      const songObj = {
        id: isDemoMode ? `demo_${now}_${i}` : undefined,
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
        score: s.score || 'これから',
        tags: s.tags || [],
        memo: '',
        singCount: 0,
        lastSungAt: null,
        createdAt: now + i
      };

      if (isDemoMode) {
        window.songs.unshift(songObj);
      } else if (window.firestoreOps) {
        const { collection, addDoc } = window.firestoreOps;
        await addDoc(collection(window.db, "songs"), songObj);
      }
      count++;
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 20));
    }

    if (isDemoMode) saveLocalDemoSongs();
    alert(`🎉 ${count}曲を一括登録しました！`);
    window.isUserSorting = true;
    closeModal();
    render();
  } catch (err) {
    alert(`保存中にエラーが発生しました: ${err.message}`);
  } finally {
    btnSave.disabled = false;
    btnSave.classList.remove('opacity-50');
    progressEl.classList.add('hidden');
  }
};

// ==========================================
// 設定 & AI音域連携 & ガイドモーダル
// ==========================================
window.openSettingsModal = function() {
  document.getElementById('migrateProgressText').classList.add('hidden');
  updateUnregisteredPitchCount();
  const savedKey = localStorage.getItem('ohako_gemini_api_key') || '';
  const keyInput = document.getElementById('geminiApiKeyInput');
  if (keyInput) keyInput.value = savedKey;

  document.getElementById('settingsModal').classList.remove('hidden');
  lockBodyScroll(true);
};
window.closeSettingsModal = function() {
  document.getElementById('settingsModal').classList.add('hidden');
  lockBodyScroll(false);
};

window.openGuideModal = function() {
  document.getElementById('guideModal').classList.remove('hidden');
  lockBodyScroll(true);
};
window.closeGuideModal = function() {
  document.getElementById('guideModal').classList.add('hidden');
  lockBodyScroll(false);
};

window.saveGeminiApiKey = function() {
  const val = document.getElementById('geminiApiKeyInput')?.value.trim() || '';
  localStorage.setItem('ohako_gemini_api_key', val);
  alert("Gemini APIキーを保存しました。");
};

function updateUnregisteredPitchCount() {
  const count = (window.songs || []).filter(s => !s.maxPitch || !s.minPitch).length;
  const badge = document.getElementById('unregisteredPitchCountBadge');
  if (badge) badge.textContent = `未登録: ${count}曲`;
}

window.copyAiPitchPrompt = function() {
  const unregs = (window.songs || []).filter(s => !s.maxPitch || !s.minPitch);
  if (unregs.length === 0) return alert("すべての曲に音域データが登録されています！");

  const listText = unregs.map(s => `- id: ${s.id} / 曲名: ${s.title} / 歌手: ${s.artist || '不明'}`).join("\n");
  const prompt = `以下の曲リストについて、カラオケにおける「地声最高音」と「最低音」を調査し、下記のJSON配列形式のみで出力してください。Markdownコードブロック(\`\`\`json)等の注釈は不要です。\n音階は「hiA」「mid2G」「mid1D」等のカラオケ表記を使用してください。不明な場合は空文字にしてください。\n\n[フォーマット例]\n[\n  {"id": "xxx", "maxPitch": "hiA", "minPitch": "mid1C"}\n]\n\n[対象曲リスト]\n${listText}`;

  navigator.clipboard.writeText(prompt).then(() => {
    alert(`音域未設定の ${unregs.length} 曲分のプロンプトをクリップボードにコピーしました！\nAIに実行させ、結果JSONを下欄に貼り付けてください。`);
  });
};

window.applyAiPitchJson = async function() {
  const input = document.getElementById('aiPitchJsonInput');
  const btn = document.getElementById('btnApplyAiPitch');
  let raw = input ? input.value.trim() : '';
  if (!raw) return alert("AIの回答JSONを貼り付けてください。");

  raw = raw.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/```$/i, "").trim();

  let list = [];
  try {
    list = JSON.parse(raw);
    if (!Array.isArray(list)) throw new Error("JSON配列形式ではありません");
  } catch (err) {
    return alert("JSONの解析に失敗しました。正しいフォーマットか確認してください。");
  }

  btn.disabled = true;
  btn.classList.add('opacity-50');
  const originalText = btn.textContent;
  let count = 0;

  try {
    for (let i = 0; i < list.length; i++) {
      const item = list[i];
      btn.textContent = `⏳ 反映中 (${i + 1}/${list.length}件)...`;
      if (item.id && (item.maxPitch || item.minPitch)) {
        if (isDemoMode) {
          const s = window.songs.find(x => x.id === item.id);
          if (s) {
            if (item.maxPitch) s.maxPitch = item.maxPitch;
            if (item.minPitch) s.minPitch = item.minPitch;
            count++;
          }
        } else if (window.firestoreOps) {
          const { doc, updateDoc } = window.firestoreOps;
          const patch = {};
          if (item.maxPitch) patch.maxPitch = item.maxPitch;
          if (item.minPitch) patch.minPitch = item.minPitch;
          await updateDoc(doc(window.db, "songs", item.id), patch);
          count++;
        }
      }
      if (i % 5 === 0) await new Promise(r => setTimeout(r, 20));
    }

    if (isDemoMode) saveLocalDemoSongs();
    alert(`🎉 ${count}件の音域データを反映しました！`);
    input.value = '';
    closeSettingsModal();
    render();
  } catch (err) {
    alert(`反映中にエラーが発生しました: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.classList.remove('opacity-50');
    btn.textContent = originalText;
  }
};

window.startDataMigration = async function() {
  if (!window.songs || window.songs.length === 0) return alert("曲データが存在しません。");
  const progressEl = document.getElementById('migrateProgressText');
  const btnEl = document.getElementById('btnMigrate');
  const targets = window.songs.filter(s => !s.artwork || !s.previewUrl || !s.durationMs || !s.year);
  
  if (targets.length === 0) return alert("✨ すべての曲データはすでに最新情報で補完されています！");
  if (!confirm(`全${window.songs.length}曲中、未補完の曲が【${targets.length}曲】見つかりました。\niTunesから情報を自動取得して更新しますか？`)) return;

  btnEl.disabled = true;
  btnEl.classList.add('opacity-50');
  progressEl.classList.remove('hidden');

  let updatedCount = 0;

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
          if (isDemoMode) {
            Object.assign(s, patch);
          } else if (window.firestoreOps) {
            const { doc, updateDoc } = window.firestoreOps;
            await updateDoc(doc(window.db, "songs", s.id), patch);
          }
          updatedCount++;
        }
      }
    } catch (err) {
      console.error(err);
    }
    await new Promise(r => setTimeout(r, 200));
  }

  if (isDemoMode) saveLocalDemoSongs();
  btnEl.disabled = false;
  btnEl.classList.remove('opacity-50');
  progressEl.textContent = `🎉 完了！ ${updatedCount}曲のデータを最新に更新しました。`;
  alert(`補完が完了しました！\n更新された曲数: ${updatedCount}件`);
  render();
};

window.exportBackupJSON = async function() {
  if (!window.songs || window.songs.length === 0) return alert("曲データがありません。");
  
  const fileName = `karaoke_backup_${new Date().toISOString().split('T')[0]}.json`;
  const jsonStr = JSON.stringify(window.songs, null, 2);
  const blob = new Blob([jsonStr], { type: 'application/json' });

  // iOS Safari / PWA 向け Web Share API
  if (navigator.canShare && navigator.canShare({ files: [new File([blob], fileName, { type: 'application/json' })] })) {
    try {
      const file = new File([blob], fileName, { type: 'application/json' });
      await navigator.share({
        files: [file],
        title: 'OHAKO バックアップ'
      });
      return;
    } catch (e) {
      if (e.name === 'AbortError') return;
    }
  }

  // PC / Android Blob URL ダウンロード
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  setTimeout(() => {
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }, 100);
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

      if (isDemoMode) {
        window.songs = imported;
        saveLocalDemoSongs();
      } else if (window.firestoreOps) {
        const { collection, addDoc } = window.firestoreOps;
        let count = 0;
        for (const s of imported) {
          const { id, ...dataToSave } = s;
          await addDoc(collection(window.db, "songs"), { ...dataToSave, createdAt: dataToSave.createdAt || Date.now() });
          count++;
        }
      }
      alert(`🎉 復元が完了しました！`);
      window.isUserSorting = true;
      closeSettingsModal();
      render();
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

  if (isDemoMode) {
    window.songs.forEach(s => { s.singCount = 0; s.lastSungAt = null; });
    saveLocalDemoSongs();
  } else if (window.firestoreOps) {
    const { doc, updateDoc } = window.firestoreOps;
    for (const s of window.songs) {
      if (s.singCount || s.lastSungAt) {
        await updateDoc(doc(window.db, "songs", s.id), { singCount: 0, lastSungAt: null });
      }
    }
  }
  alert("全曲の歌唱カウンターをゼロにリセットしました。");
  closeSettingsModal();
  render();
};

// ==========================================
// メインナビゲーション
// ==========================================
window.switchMainTab = function(tab) {
  const tabs = [
    { id: 'mylist', btn: document.getElementById('navTabMyList'), view: document.getElementById('viewMyList') },
    { id: 'recommend', btn: document.getElementById('navTabRecommend'), view: document.getElementById('viewRecommend') },
    { id: 'ranking', btn: document.getElementById('navTabRanking'), view: document.getElementById('viewRanking') },
    { id: 'analysis', btn: document.getElementById('navTabAnalysis'), view: document.getElementById('viewAnalysis') }
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
  else if (tab === 'analysis') renderAnalysis();
};

// ==========================================
// プレビュー再生
// ==========================================
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
      const q = trackId ? `[https://itunes.apple.com/lookup?id=$](https://itunes.apple.com/lookup?id=$){trackId}&country=jp` : `${trackName} ${artistName}`;
      const data = trackId 
        ? await fetch(`[https://itunes.apple.com/lookup?id=$](https://itunes.apple.com/lookup?id=$){trackId}&country=jp`).then(r => r.json())
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
  if (!document.getElementById('artistModal').classList.contains('hidden')) {
    renderArtistDiscography();
  }
  if (!document.getElementById('modalPanelBulk').classList.contains('hidden')) {
    renderBulkPreview();
  }
}

// ==========================================
// 流行曲 (404/CORS排除: iTunes Search Top Hits一本化)
// ==========================================
window.loadRanking = async function() {
  const container = document.getElementById('rankingList');
  container.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">最新の人気曲を取得中...</div>';

  try {
    const data = await fetchITunesApi("2025 2026 J-Pop ヒット", 50);
    const results = data.results || [];
    if (results.length === 0) throw new Error("ヒット曲リストが空でした");

    const seen = new Set();
    rankingSongs = [];

    results.forEach(item => {
      const key = `${(item.trackName || '').toLowerCase()}_${(item.artistName || '').toLowerCase()}`;
      if (seen.has(key)) return;
      seen.add(key);

      rankingSongs.push({
        rank: rankingSongs.length + 1,
        trackId: item.trackId,
        title: item.trackName,
        artist: item.artistName,
        artwork: item.artworkUrl100 || '',
        year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
        genre: item.primaryGenreName || 'J-Pop',
        previewUrl: item.previewUrl || ''
      });
    });

    renderRanking();
  } catch (err) {
    container.innerHTML = `
      <div class="bg-rose-950/40 border border-rose-900/60 p-4 rounded-xl text-center space-y-1">
        <div class="text-xs font-bold text-rose-300">⚠️ ランキングの取得に失敗しました</div>
        <div class="text-[10px] text-rose-400 font-mono">${escapeHtml(err.message)}</div>
      </div>
    `;
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
          <div class="text-xs text-slate-400 truncate hover:text-indigo-300 cursor-pointer" onclick="openArtistDiscography('${escapeHtml(item.artist)}')">${escapeHtml(item.artist)}</div>
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

// ==========================================
// 名曲発掘
// ==========================================
window.analyzeAndRecommend = async function() {
  const insightEl = document.getElementById('recommendInsight');
  const listEl = document.getElementById('recommendList');

  if (!window.songs || window.songs.length === 0) {
    insightEl.innerHTML = 'マイリストに曲が登録されていません。';
    listEl.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">マイリストが空です</div>';
    return;
  }

  insightEl.innerHTML = 'マイリストの歌手・年代プロファイルを動的解析中...';
  listEl.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">昔の名曲・数珠つなぎ候補を発掘中...</div>';

  const artistCounts = {};
  const decadeCounts = { '1970s': 0, '1980s': 0, '1990s': 0, '2000s': 0, '2010s': 0, '2020s': 0 };

  window.songs.forEach(s => {
    if (s.artist) {
      const main = s.artist.split(/[,&×/feat.]+/i)[0].trim();
      if (main) artistCounts[main] = (artistCounts[main] || 0) + 1;
    }
    const yr = parseInt(s.year, 10);
    if (yr) {
      if (yr < 1980) decadeCounts['1970s']++;
      else if (yr < 1990) decadeCounts['1980s']++;
      else if (yr < 2000) decadeCounts['1990s']++;
      else if (yr < 2010) decadeCounts['2000s']++;
      else if (yr < 2020) decadeCounts['2010s']++;
      else decadeCounts['2020s']++;
    }
  });

  const sortedArtists = Object.keys(artistCounts).sort((a, b) => artistCounts[b] - artistCounts[a]);
  if (sortedArtists.length === 0) return;

  const topPool = sortedArtists.slice(0, 5);
  const pickedArtists = [...topPool].sort(() => 0.5 - Math.random()).slice(0, 2);
  const hiddenPool = sortedArtists.slice(5);
  const pickedHidden = hiddenPool.length > 0 ? hiddenPool[Math.floor(Math.random() * hiddenPool.length)] : null;

  const activeDecades = Object.keys(decadeCounts).filter(k => decadeCounts[k] > 0);
  const pickedDecadeKey = activeDecades.length > 0 ? activeDecades[Math.floor(Math.random() * activeDecades.length)] : '2010s';
  const decadeLabel = { '1970s': '1970年代以前', '1980s': '1980年代', '1990s': '1990年代', '2000s': '2000年代', '2010s': '2010年代', '2020s': '2020年代' }[pickedDecadeKey];

  let relatedArtists = [];
  pickedArtists.forEach(a => {
    const l = a.toLowerCase();
    Object.keys(ARTIST_RELATIONS).forEach(k => {
      if (l.includes(k) || k.includes(l)) relatedArtists.push(...ARTIST_RELATIONS[k]);
    });
  });
  relatedArtists = Array.from(new Set(relatedArtists)).sort(() => 0.5 - Math.random()).slice(0, 3);

  insightEl.innerHTML = `
    <div class="font-bold text-indigo-300">💡 カラオケプロファイル</div>
    <div>注目歌手: <strong class="text-white">${pickedArtists.join(', ')}</strong> ${pickedHidden ? `<span class="text-indigo-400 text-[10px]">(隠れ枠: ${pickedHidden})</span>` : ''}</div>
    ${relatedArtists.length ? `<div>数珠つなぎ連想: <strong class="text-emerald-300">${relatedArtists.join(', ')}</strong></div>` : ''}
    <div>注目年代: <strong class="text-white">${decadeLabel}</strong></div>
  `;

  const fetchedCandidates = [];
  const myTitles = new Set((window.songs || []).map(s => (s.title || '').toLowerCase().replace(/\s+/g, '')));

  const searchPool = [...pickedArtists];
  if (pickedHidden) searchPool.push(pickedHidden);

  for (const artist of searchPool) {
    try {
      const data = await fetchITunesApi(artist, 20);
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
            reason: `🎤 「${artist}」の未登録曲`
          });
        }
      });
    } catch (e) {}
  }

  for (const rArtist of relatedArtists.slice(0, 2)) {
    try {
      const data = await fetchITunesApi(rArtist, 10);
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
          <div class="text-xs text-slate-400 truncate hover:text-indigo-300 cursor-pointer" onclick="openArtistDiscography('${escapeHtml(item.artist)}')">${escapeHtml(item.artist)}</div>
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
  document.getElementById('formScore').value = 'これから';

  const tags = [];
  const decTag = getDecadeTag(data.year);
  if (decTag) tags.push(decTag);
  document.getElementById('formTags').value = tags.join(', ');
};

// ディスコグラフィ機能
window.openArtistDiscography = async function(artistName) {
  if (!artistName) return;
  const modal = document.getElementById('artistModal');
  const nameEl = document.getElementById('artistModalName');
  const countEl = document.getElementById('artistModalCount');
  const listEl = document.getElementById('artistSongsList');

  nameEl.textContent = artistName;
  countEl.textContent = 'iTunesから全楽曲を取得中...';
  listEl.innerHTML = '<div class="text-center text-slate-500 py-10 text-xs">ディスコグラフィを取得中...</div>';
  modal.classList.remove('hidden');
  lockBodyScroll(true);

  try {
    const data = await fetchITunesApi(artistName, 50);
    const results = data.results || [];

    const seen = new Set();
    artistDiscographySongs = [];

    results.forEach(item => {
      const titleClean = (item.trackName || '').toLowerCase().trim();
      if (!titleClean || seen.has(titleClean)) return;
      seen.add(titleClean);

      const year = item.releaseDate ? item.releaseDate.substring(0, 4) : '';
      const mins = Math.floor((item.trackTimeMillis || 0) / 60000);
      const secs = Math.floor(((item.trackTimeMillis || 0) % 60000) / 1000).toString().padStart(2, '0');
      const isDuet = checkIsDuet(item.trackName, item.artistName);

      artistDiscographySongs.push({
        trackId: item.trackId,
        title: item.trackName,
        artist: item.artistName,
        year: year,
        genre: item.primaryGenreName || 'J-Pop',
        artwork: item.artworkUrl100 || '',
        previewUrl: item.previewUrl || '',
        duration: item.trackTimeMillis ? `${mins}:${secs}` : '',
        durationMs: item.trackTimeMillis || 0,
        isDuet: isDuet
      });
    });

    renderArtistDiscography();
  } catch (err) {
    listEl.innerHTML = `<div class="text-center text-rose-400 py-10 text-xs">取得エラー: ${err.message}</div>`;
  }
};

window.renderArtistDiscography = function() {
  const listEl = document.getElementById('artistSongsList');
  const countEl = document.getElementById('artistModalCount');
  const sortMode = document.getElementById('artistSortSelect').value;

  if (artistDiscographySongs.length === 0) {
    countEl.textContent = '0件';
    listEl.innerHTML = '<div class="text-center text-slate-500 py-10 text-xs">楽曲が見つかりませんでした</div>';
    return;
  }

  let list = [...artistDiscographySongs];
  if (sortMode === 'yearDesc') list.sort((a, b) => (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0));
  else if (sortMode === 'yearAsc') list.sort((a, b) => (parseInt(a.year, 10) || 0) - (parseInt(b.year, 10) || 0));
  else if (sortMode === 'title') list.sort((a, b) => (a.title || '').localeCompare(b.title || '', 'ja'));

  countEl.textContent = `全 ${list.length} 曲`;

  const existingTitles = new Set((window.songs || []).map(s => `${(s.title || '').toLowerCase()}_${(s.artist || '').toLowerCase()}`));

  listEl.innerHTML = list.map(item => {
    const playId = `art_${item.trackId}`;
    const isPlaying = currentPlayingId === playId;
    const isAdded = existingTitles.has(`${(item.title || '').toLowerCase()}_${(item.artist || '').toLowerCase()}`);
    const encoded = encodeURIComponent(JSON.stringify(item));

    return `
      <div class="flex items-center gap-2.5 p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs">
        <div onclick="togglePlayPreview('${item.previewUrl}', '${playId}', '${escapeHtml(item.title)}', '${escapeHtml(item.artist)}', '${item.trackId}')" class="relative w-10 h-10 rounded-lg overflow-hidden shrink-0 cursor-pointer bg-slate-800 border border-slate-800">
          ${item.artwork ? `<img src="${item.artwork}" class="w-full h-full object-cover">` : '<div class="w-full h-full flex items-center justify-center text-slate-500 text-xs">🎵</div>'}
          <div class="absolute inset-0 bg-black/40 flex items-center justify-center transition ${isPlaying ? 'opacity-100 bg-rose-950/70' : 'opacity-0 hover:opacity-100'}">
            <span class="text-[10px] text-white">${isPlaying ? '⏹' : '▶'}</span>
          </div>
        </div>

        <div class="min-w-0 flex-1">
          <div class="font-bold text-white truncate flex items-center gap-1">
            <span>${escapeHtml(item.title)}</span>
            ${item.isDuet ? '<span class="text-[8px] bg-purple-950 text-purple-300 px-1 rounded whitespace-nowrap">デュエット</span>' : ''}
          </div>
          <div class="text-[10px] text-slate-400 truncate mt-0.5">${item.year ? item.year + '年 • ' : ''}${escapeHtml(item.genre)}</div>
        </div>

        <div class="shrink-0">
          <button onclick="addFromDiscography('${encoded}')" class="text-[10px] px-2 py-1 rounded-lg font-bold border transition whitespace-nowrap ${
            isAdded ? 'bg-slate-800 border-slate-700 text-slate-400' : 'bg-indigo-600 hover:bg-indigo-500 text-white border-indigo-500'
          }">
            ${isAdded ? '登録済' : '＋ 追加'}
          </button>
        </div>
      </div>
    `;
  }).join('');
};

window.addFromDiscography = function(encoded) {
  const item = JSON.parse(decodeURIComponent(encoded));
  closeArtistModal();
  openModal();
  document.getElementById('formTitle').value = item.title;
  document.getElementById('formArtist').value = item.artist;
  document.getElementById('formYear').value = item.year;
  document.getElementById('formGenre').value = item.genre;
  document.getElementById('formArtwork').value = item.artwork;
  document.getElementById('formPreviewUrl').value = item.previewUrl;
  document.getElementById('formDuration').value = item.duration;
  document.getElementById('formDurationMs').value = item.durationMs;
  document.getElementById('formDuetType').value = item.isDuet ? 'duet' : 'solo';
  document.getElementById('formScore').value = 'これから';

  const tags = [];
  const decTag = getDecadeTag(item.year);
  if (decTag) tags.push(decTag);
  document.getElementById('formTags').value = tags.join(', ');
};

window.closeArtistModal = function() {
  document.getElementById('artistModal').classList.add('hidden');
  lockBodyScroll(false);
};

window.searchITunes = async function() {
  const term = document.getElementById('apiSearchInput').value.trim();
  const resultBox = document.getElementById('apiSearchResults');
  const sortRow = document.getElementById('apiSortRow');
  if (!term) return;

  resultBox.classList.remove('hidden');
  sortRow.classList.add('hidden');
  resultBox.innerHTML = '<div class="text-[11px] text-slate-500 py-1">検索中...</div>';

  try {
    const data = await fetchITunesApi(term, 50);

    if (!data.results || data.results.length === 0) {
      return resultBox.innerHTML = '<div class="text-[11px] text-slate-500 py-1">曲が見つかりませんでした</div>';
    }

    currentRawITunesResults = data.results.map(item => {
      const year = item.releaseDate ? item.releaseDate.substring(0, 4) : '';
      const mins = Math.floor((item.trackTimeMillis || 0) / 60000);
      const secs = Math.floor(((item.trackTimeMillis || 0) % 60000) / 1000).toString().padStart(2, '0');
      const isDuet = checkIsDuet(item.trackName, item.artistName);

      const tags = [];
      const decTag = getDecadeTag(year);
      if (decTag) tags.push(decTag);

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

// ==========================================
// ピックアップ機能（厳密ID判定 & 即座同期）
// ==========================================
window.toggleSetlistDrawer = function() {
  document.getElementById('setlistDrawer').classList.toggle('translate-y-full');
};

window.addToSetlist = function(id) {
  const sId = String(id);
  if (!setlist.some(x => String(x) === sId)) {
    setlist.push(sId);
    saveSetlist();
  }
  document.getElementById('setlistDrawer').classList.remove('translate-y-full');
  render();
};

window.removeFromSetlist = function(id) {
  const sId = String(id);
  setlist = setlist.filter(x => String(x) !== sId);
  saveSetlist();
  render();
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
  if (confirm('ピックアップリストをすべてクリアしますか？')) {
    setlist = [];
    saveSetlist();
    render();
  }
};

window.copySetlistToClipboard = async function() {
  if (!setlist || setlist.length === 0) return alert("ピックアップが空です。");

  let totalMs = 0;
  const lines = ["⭐ 本日のカラオケ ピックアップ", "------------------------"];

  setlist.forEach((songId, idx) => {
    const s = (window.songs || []).find(x => String(x.id) === String(songId));
    if (!s) return;
    totalMs += (s.durationMs || 240000);
    const keyStr = s.key === '0' ? '原曲' : `キー${s.key}`;
    const timeStr = s.duration ? ` [${s.duration}]` : '';
    lines.push(`${idx + 1}. ${s.title} / ${s.artist || '未設定'} (${keyStr})${timeStr}`);
  });

  const totalMins = Math.floor(totalMs / 60000);
  const totalSecs = Math.floor((totalMs % 60000) / 1000).toString().padStart(2, '0');
  lines.push("------------------------");
  lines.push(`計 ${setlist.length}曲（合計 約${totalMins}分${totalSecs}秒）`);
  lines.push("#OHAKO");

  const text = lines.join("\n");
  const btn = document.getElementById('btnCopySetlist');

  try {
    if (navigator.clipboard && window.isSecureContext) {
      await navigator.clipboard.writeText(text);
    } else {
      const ta = document.createElement("textarea");
      ta.value = text;
      ta.style.position = "fixed";
      ta.style.opacity = "0";
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (btn) {
      const orig = btn.innerHTML;
      btn.innerHTML = "✅ コピー済";
      setTimeout(() => { btn.innerHTML = orig; }, 1800);
    }
  } catch (e) {
    alert("クリップボードへのコピーに失敗しました。");
  }
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
      const s = (window.songs || []).find(x => String(x.id) === String(id));
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
    container.innerHTML = '<div class="text-center text-slate-500 py-6 text-xs">ピックアップに曲がありません</div>';
    return;
  }

  container.innerHTML = setlist.map((songId, idx) => {
    const s = (window.songs || []).find(x => String(x.id) === String(songId));
    if (!s) return '';
    return `
      <div class="flex items-center justify-between gap-2 p-2 bg-slate-950/80 border border-slate-800 rounded-xl text-xs">
        <div class="flex items-center gap-2 min-w-0">
          <span class="font-mono font-bold text-indigo-400 w-4 text-center shrink-0">${idx + 1}</span>
          <div class="min-w-0">
            <div class="font-bold text-white truncate">${escapeHtml(s.title)}</div>
            <div class="text-[10px] text-slate-400 truncate">${escapeHtml(s.artist)} • ${s.key === '0' ? '原曲' : 'キー ' + s.key}</div>
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
  if (!icon) return;
  icon.textContent = isAllExpanded ? '📕' : '📖';
}

// 検索マッチング判定
function matchSearchQuery(song, rawQuery) {
  if (!rawQuery) return true;
  const qLower = rawQuery.toLowerCase().trim();
  const qKata = hiraToKata(qLower);
  const qHira = kataToHira(qLower);

  const targets = [
    (song.title || '').toLowerCase(),
    (song.artist || '').toLowerCase(),
    (song.memo || '').toLowerCase(),
    (song.genre || '').toLowerCase(),
    (song.year ? song.year.toString() : ''),
    ...(song.tags || []).map(t => t.toLowerCase())
  ];

  if (targets.some(t => t.includes(qLower))) return true;

  const targetConcat = targets.join(' ');
  const targetKata = hiraToKata(targetConcat);
  const targetHira = kataToHira(targetConcat);

  if (targetKata.includes(qKata) || targetHira.includes(qHira)) return true;

  const artistLower = (song.artist || '').toLowerCase();
  for (const [canonical, aliases] of Object.entries(ARTIST_ALIASES)) {
    if (artistLower.includes(canonical)) {
      if (aliases.some(alias => alias.includes(qKata) || alias.includes(qHira) || qLower.includes(alias))) {
        return true;
      }
    }
  }

  const titleLower = (song.title || '').toLowerCase();
  for (const [canonical, aliases] of Object.entries(TITLE_ALIASES)) {
    if (titleLower.includes(canonical)) {
      if (aliases.some(alias => alias.includes(qKata) || alias.includes(qHira) || qLower.includes(alias))) {
        return true;
      }
    }
  }

  return false;
}

function getCurrentFilteredSongs() {
  const queryStr = (document.getElementById('searchInput')?.value || '').trim();
  return (window.songs || []).filter(s => {
    const matchesQuery = matchSearchQuery(s, queryStr);
    
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
    else if (selectedDecade === '1990s') matchesDecade = yr >= 1990 && yr <= 1999;
    else if (selectedDecade === '1980s') matchesDecade = yr >= 1980 && yr <= 1989;
    else if (selectedDecade === '1970s') matchesDecade = yr < 1980;

    let matchesAttr = true;
    if (selectedAttr === 'original') matchesAttr = (s.key === '0' || s.key === '原曲' || !s.key);
    else if (selectedAttr === 'adjusted') matchesAttr = (s.key !== '0' && s.key !== '原曲' && s.key);
    else if (selectedAttr === 'duet') matchesAttr = s.duetType === 'duet';

    const matchesPitch = matchPitchRange(s.maxPitch, selectedPitchRange);

    return matchesQuery && matchesTag && matchesScore && matchesDecade && matchesAttr && matchesPitch;
  });
}

// ==========================================
// マイリスト描画
// ==========================================
window.render = function() {
  const sortSelect = document.getElementById('sortSelect');
  const sortMode = sortSelect ? sortSelect.value : 'lastSung';
  let filtered = getCurrentFilteredSongs();

  if (!window.isUserSorting && renderedSongOrderIds.length > 0) {
    const orderMap = new Map();
    renderedSongOrderIds.forEach((id, idx) => orderMap.set(id, idx));
    filtered.sort((a, b) => {
      const idxA = orderMap.has(a.id) ? orderMap.get(a.id) : 999999;
      const idxB = orderMap.has(b.id) ? orderMap.get(b.id) : 999999;
      return idxA - idxB;
    });
  } else {
    filtered.sort((a, b) => {
      if (sortMode === 'lastSung') return (b.lastSungAt || 0) - (a.lastSungAt || 0);
      if (sortMode === 'singCount') return (b.singCount || 0) - (a.singCount || 0);
      if (sortMode === 'scoreVal') return (parseFloat(b.scoreVal) || 0) - (parseFloat(a.scoreVal) || 0);
      if (sortMode === 'releaseYear') return (parseInt(b.year, 10) || 0) - (parseInt(a.year, 10) || 0);
      if (sortMode === 'title') return (a.title || '').localeCompare(b.title || '', 'ja');
      return (b.createdAt || 0) - (a.createdAt || 0);
    });
    renderedSongOrderIds = filtered.map(s => s.id);
    window.isUserSorting = false;
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
            isSelected ? 'bg-indigo-600 text-white font-bold shadow-sm' : 'bg-slate-900 text-slate-400 border border-slate-800 hover:text-white'
          }">
            <span>#${escapeHtml(tag)}</span>
            ${isSelected ? '<span class="text-[9px]">✓</span>' : ''}
          </button>
        `;
      });
    }
  }

  renderFilterChips();

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
    const lyricsSearchUrl = `[https://www.google.com/search?q=$](https://www.google.com/search?q=$){encodeURIComponent(s.title + ' ' + (s.artist || '') + ' 歌詞')}`;
    const hasUndo = undoHistory[s.id] !== undefined;
    const inSetlist = setlist.some(x => String(x) === String(s.id));
    const isExpanded = expandedCardIds.has(s.id);
    const pUrl = s.previewUrl || '';

    const scoreClass = {
      '得意': 'bg-emerald-950 text-emerald-400 border-emerald-800/80',
      '歌える': 'bg-sky-950 text-sky-400 border-sky-800/80',
      '練習中': 'bg-amber-950 text-amber-400 border-amber-800/80',
      'これから': 'bg-purple-950 text-purple-400 border-purple-800/80'
    }[s.score] || 'bg-slate-800 text-slate-400 border-slate-700';

    return `
      <div class="rounded-2xl shadow-sm transition overflow-hidden border ${
        inSetlist 
          ? 'bg-slate-900 border-indigo-500/80 shadow-indigo-500/10 shadow-lg' 
          : 'bg-slate-900/90 border-slate-800'
      }">
        <div class="p-3 flex items-center gap-2.5">
          <div onclick="togglePlayPreview('${pUrl}', '${s.id}', '${escapeHtml(s.title)}', '${escapeHtml(s.artist)}')" class="relative w-12 h-12 rounded-xl overflow-hidden shrink-0 cursor-pointer shadow border border-slate-800 bg-slate-800">
            ${s.artwork ? `<img src="${s.artwork}" class="w-full h-full object-cover">` : `<div class="w-full h-full flex items-center justify-center text-lg text-slate-600">🎵</div>`}
            <div class="absolute inset-0 bg-black/40 flex items-center justify-center transition ${isPlaying ? 'opacity-100 bg-rose-950/70' : 'opacity-0 hover:opacity-100'}">
              <span class="text-xs text-white">${isPlaying ? '⏹' : '▶'}</span>
            </div>
          </div>

          <div class="min-w-0 flex-1">
            <div class="flex items-center gap-1.5 cursor-pointer" onclick="toggleExpandCard('${s.id}')">
              <div class="font-bold text-sm text-white truncate">${escapeHtml(s.title)}</div>
              <span class="text-[10px] px-1.5 py-0.2 rounded font-mono font-bold whitespace-nowrap shrink-0 ${
                s.key === '0' ? 'bg-slate-800 text-slate-300 border border-slate-700' :
                (s.key || '').startsWith('+') ? 'bg-rose-950 text-rose-300 border border-rose-800' :
                'bg-blue-950 text-blue-300 border border-blue-800'
              }">${s.key === '0' ? '原曲' : 'キー ' + s.key}</span>
            </div>

            <div class="text-xs text-slate-400 truncate mt-0.5">
              ${s.artist ? `<span onclick="openArtistDiscography('${escapeHtml(s.artist)}')" class="hover:text-indigo-300 cursor-pointer underline decoration-slate-700 underline-offset-2">${escapeHtml(s.artist)}</span>` : '歌手未設定'}
            </div>

            <div class="flex items-center gap-1 flex-wrap mt-1 text-[9px]">
              <span class="px-1 py-0.2 rounded font-medium whitespace-nowrap border ${scoreClass}">${s.score || 'これから'}</span>
              ${s.scoreVal ? `<span class="bg-amber-950/80 text-amber-300 px-1 py-0.2 rounded border border-amber-700/80 font-mono font-bold">🎯 ${s.scoreVal}点</span>` : ''}
              ${s.singCount ? `<span class="bg-indigo-950/70 text-indigo-300 px-1 py-0.2 rounded border border-indigo-800/70 font-mono">🔥 ${s.singCount}回</span>` : ''}
              ${s.duetType === 'duet' ? '<span class="bg-purple-950 text-purple-300 border border-purple-800">👥 デュエット</span>' : ''}
            </div>
          </div>

          <div class="flex flex-col items-end gap-1.5 shrink-0">
            <div class="flex items-center gap-1">
              ${hasUndo ? `
                <button onclick="undoSung('${s.id}')" title="歌唱記録を取り消す" class="text-amber-300 bg-amber-950/90 hover:bg-amber-900 border border-amber-700 px-1.5 py-1 rounded-lg font-bold text-[10px] whitespace-nowrap shadow-sm animate-pulse">
                  ↩ 取消
                </button>
              ` : ''}
              <button onclick="recordSung('${s.id}')" title="歌った！" class="text-indigo-200 bg-indigo-900/80 hover:bg-indigo-800 border border-indigo-700/80 px-2 py-1 rounded-lg font-bold text-[10px] whitespace-nowrap">
                🎤 歌った
              </button>
              <button onclick="openEditModal('${s.id}')" title="編集" class="text-slate-400 hover:text-indigo-300 bg-slate-800 hover:bg-slate-700 border border-slate-700 p-1 rounded-lg text-xs">
                ✏️
              </button>
            </div>
            <div class="flex items-center gap-1">
              <button onclick="${inSetlist ? `removeFromSetlist('${s.id}')` : `addToSetlist('${s.id}')`}" class="text-[10px] px-2 py-0.5 rounded-md font-bold border transition whitespace-nowrap ${
                inSetlist 
                  ? 'bg-indigo-600 border-indigo-500 text-white shadow-sm' 
                  : 'bg-slate-800 border-slate-700 text-slate-300 hover:text-white'
              }">
                ${inSetlist ? '✓ ピックアップ' : '＋ ピックアップ'}
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

            <div class="flex items-center justify-end pt-1 gap-1 text-[11px] overflow-x-auto no-scrollbar">
              <button onclick="togglePlayPreview('${pUrl}', '${s.id}', '${escapeHtml(s.title)}', '${escapeHtml(s.artist)}')" class="px-2 py-1 rounded-lg font-medium border flex items-center gap-1 whitespace-nowrap ${isPlaying ? 'bg-rose-900 border-rose-700 text-rose-200' : 'bg-slate-800 border-slate-700 text-slate-300'}">
                ${isPlaying ? '⏹ 停止' : '▶ 試聴'}
              </button>
              <a href="${lyricsSearchUrl}" target="_blank" rel="noopener" class="text-slate-400 hover:text-sky-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1 whitespace-nowrap">
                📄 歌詞
              </a>
              <a href="[https://www.youtube.com/results?search_query=$](https://www.youtube.com/results?search_query=$){encodeURIComponent((s.artist ? s.artist + ' ' : '') + s.title)}" target="_blank" rel="noopener" class="text-slate-400 hover:text-red-400 bg-slate-800 px-2 py-1 rounded-lg border border-slate-700 flex items-center gap-1 whitespace-nowrap">
                ▶️ YT
              </a>
              <button onclick="deleteSong('${s.id}')" class="text-slate-500 hover:text-rose-400 bg-slate-800 border border-slate-700 p-1 rounded-lg text-xs" title="削除">🗑️</button>
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
  window.isUserSorting = true;
  render();
};
window.clearSelectedTags = function() { selectedTags.clear(); window.isUserSorting = true; render(); };
window.setTagFilterMode = function(mode) {
  tagFilterMode = mode;
  document.getElementById('tagModeAnd').className = mode === 'AND' ? "px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white" : "px-1.5 py-0.5 rounded text-[9px] text-slate-400 hover:text-white";
  document.getElementById('tagModeOr').className = mode === 'OR' ? "px-1.5 py-0.5 rounded text-[9px] font-bold bg-indigo-600 text-white" : "px-1.5 py-0.5 rounded text-[9px] text-slate-400 hover:text-white";
  window.isUserSorting = true;
  render();
};

window.setScoreFilter = function(score) {
  selectedScore = score;
  window.isUserSorting = true;
  syncFilterControlsVisual();
  render();
};
window.setDecadeFilter = function(decade) {
  selectedDecade = decade;
  window.isUserSorting = true;
  syncFilterControlsVisual();
  render();
};
window.setAttrFilter = function(attr) {
  selectedAttr = attr;
  window.isUserSorting = true;
  syncFilterControlsVisual();
  render();
};

// ==========================================
// マイ分析ダッシュボード
// ==========================================
function renderAnalysis() {
  const allSongs = window.songs || [];
  const activeSongs = allSongs.filter(s => s.score && s.score !== 'これから');
  
  document.getElementById('statActiveCount').textContent = `${activeSongs.length}曲`;

  const scored = activeSongs.filter(s => typeof s.scoreVal === 'number' && s.scoreVal > 0);
  const avg = scored.length > 0 ? (scored.reduce((acc, s) => acc + s.scoreVal, 0) / scored.length).toFixed(1) : '--';
  document.getElementById('statAvgScore').textContent = avg !== '--' ? `${avg}点` : '--';

  const over90 = scored.filter(s => s.scoreVal >= 90).length;
  document.getElementById('statOver90Count').textContent = `${over90}曲`;

  const totalSing = activeSongs.reduce((acc, s) => acc + (s.singCount || 0), 0);
  document.getElementById('statTotalSingCount').textContent = `${totalSing}回`;

  // 1. ボイスレンジ判定
  const voiceRangeEl = document.getElementById('analysisVoiceRange');
  const validPitches = activeSongs.map(s => ({
    score: s.score,
    rank: getPitchRank(s.maxPitch),
    pitch: s.maxPitch
  })).filter(x => x.rank > 0);

  if (validPitches.length > 0) {
    const mastered = validPitches.filter(x => x.score === '得意');
    const safeMaxRank = mastered.length > 0 ? Math.max(...mastered.map(x => x.rank)) : 0;
    const allMaxRank = Math.max(...validPitches.map(x => x.rank));
    const borderRank = safeMaxRank > 0 ? safeMaxRank + 1 : allMaxRank;

    voiceRangeEl.innerHTML = `
      <div class="grid grid-cols-2 gap-2 bg-slate-950 p-2.5 rounded-xl border border-slate-800">
        <div>
          <div class="text-[10px] text-slate-400">🛡️ 鉄板最高音（安全圏）</div>
          <div class="text-sm font-extrabold text-emerald-400 mt-0.5">${safeMaxRank > 0 ? getPitchNameFromRank(safeMaxRank) : 'データ収集中'}</div>
          <div class="text-[9px] text-slate-500 mt-0.5">得意曲で安定して出せる上限</div>
        </div>
        <div>
          <div class="text-[10px] text-slate-400">⚠️ 限界ボーダーライン</div>
          <div class="text-sm font-extrabold text-rose-400 mt-0.5">${getPitchNameFromRank(borderRank)}</div>
          <div class="text-[9px] text-slate-500 mt-0.5">これ以上はキー調整推奨</div>
        </div>
      </div>
    `;
  } else {
    voiceRangeEl.innerHTML = '<span class="text-slate-500">音域データがまだありません（⚙️管理設定からAI一括取得が可能です）</span>';
  }

  // 2. 年代別実戦力
  const decadeStrengthEl = document.getElementById('analysisDecadeStrength');
  const decades = [
    { key: '2020s', label: '2020年代（若手・最新）', min: 2020, max: 2099 },
    { key: '2010s', label: '2010年代（定着ヒット）', min: 2010, max: 2019 },
    { key: '2000s', label: '2000年代（同世代鉄板）', min: 2000, max: 2009 },
    { key: '1990s', label: '1990年代（黄金J-POP）', min: 1990, max: 1999 },
    { key: '1980s', label: '1980年代以前（懐メロ・先輩）', min: 0, max: 1989 }
  ];

  decadeStrengthEl.innerHTML = decades.map(dec => {
    const songsInDec = activeSongs.filter(s => {
      const yr = parseInt(s.year, 10);
      return yr && yr >= dec.min && yr <= dec.max;
    });

    if (songsInDec.length === 0) {
      return `
        <div class="space-y-1 opacity-50">
          <div class="flex justify-between text-[11px] text-slate-400">
            <span>${dec.label}</span>
            <span class="font-mono text-[10px]">0曲</span>
          </div>
          <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
            <div class="bg-indigo-600 h-full w-0"></div>
          </div>
        </div>
      `;
    }

    const weights = { '得意': 1.0, '歌える': 0.7, '練習中': 0.3 };
    const powerSum = songsInDec.reduce((acc, s) => acc + (weights[s.score] || 0.5), 0);
    const maxPossible = Math.max(songsInDec.length, 3);
    const battleScorePercent = Math.min(Math.round((powerSum / maxPossible) * 100), 100);

    const barColor = battleScorePercent >= 75 ? 'bg-gradient-to-r from-emerald-500 to-teal-400' :
                     battleScorePercent >= 45 ? 'bg-gradient-to-r from-indigo-500 to-violet-400' :
                     'bg-gradient-to-r from-amber-500 to-orange-400';

    return `
      <div class="space-y-1">
        <div class="flex justify-between text-[11px]">
          <span class="text-slate-300 font-medium">${dec.label}</span>
          <span class="font-mono text-indigo-300 font-bold">${battleScorePercent}% <span class="text-[10px] text-slate-500 font-normal">(${songsInDec.length}曲)</span></span>
        </div>
        <div class="w-full bg-slate-950 h-2 rounded-full overflow-hidden border border-slate-800">
          <div class="${barColor} h-full transition-all duration-500 rounded-full" style="width: ${battleScorePercent}%"></div>
        </div>
      </div>
    `;
  }).join('');

  // 3. キー調整相関
  const keyContainer = document.getElementById('analysisKeyScores');
  const effectBadge = document.getElementById('analysisKeyEffectBadge');
  
  const origSongs = scored.filter(s => s.key === '0' || !s.key);
  const adjSongs = scored.filter(s => s.key !== '0' && s.key);

  const origAvg = origSongs.length > 0 ? (origSongs.reduce((acc, s) => acc + s.scoreVal, 0) / origSongs.length) : null;
  const adjAvg = adjSongs.length > 0 ? (adjSongs.reduce((acc, s) => acc + s.scoreVal, 0) / adjSongs.length) : null;

  if (origAvg !== null && adjAvg !== null) {
    const diff = (adjAvg - origAvg).toFixed(1);
    const sign = diff >= 0 ? `+${diff}` : `${diff}`;
    effectBadge.textContent = `キー調整で平均 ${sign}点`;
    effectBadge.className = diff >= 0 ? "text-[10px] text-emerald-400 font-mono font-bold" : "text-[10px] text-rose-400 font-mono font-bold";
  } else {
    effectBadge.textContent = '';
  }

  const keyMap = {};
  scored.forEach(s => {
    const k = (s.key === '0' || !s.key) ? '原曲' : s.key;
    if (!keyMap[k]) keyMap[k] = { sum: 0, count: 0 };
    keyMap[k].sum += s.scoreVal;
    keyMap[k].count++;
  });

  const keyKeys = Object.keys(keyMap);
  if (keyKeys.length === 0) {
    keyContainer.innerHTML = '<span class="text-slate-500">採点スコアデータがありません</span>';
  } else {
    keyContainer.innerHTML = keyKeys.map(k => {
      const item = keyMap[k];
      const mean = (item.sum / item.count).toFixed(1);
      return `
        <div class="flex items-center justify-between py-1 border-b border-slate-800/80">
          <span class="text-slate-300 font-mono">キー [ ${escapeHtml(k)} ]</span>
          <span class="font-bold text-indigo-300 font-mono">${mean}点 <span class="text-[10px] text-slate-500 font-normal">(${item.count}曲)</span></span>
        </div>
      `;
    }).join('');
  }

  // 4. アーティスト偏愛度
  const artistAffinityEl = document.getElementById('analysisArtistAffinity');
  const artistMap = {};
  activeSongs.forEach(s => {
    const a = s.artist || '未設定';
    if (!artistMap[a]) artistMap[a] = { count: 0, scores: [] };
    artistMap[a].count++;
    if (typeof s.scoreVal === 'number' && s.scoreVal > 0) {
      artistMap[a].scores.push(s.scoreVal);
    }
  });

  const topRegisteredArtists = Object.keys(artistMap)
    .sort((a, b) => artistMap[b].count - artistMap[a].count)
    .slice(0, 3);

  const topScoreArtists = Object.keys(artistMap)
    .filter(a => artistMap[a].scores.length >= 2)
    .map(a => ({
      name: a,
      avg: (artistMap[a].scores.reduce((sum, v) => sum + v, 0) / artistMap[a].scores.length).toFixed(1)
    }))
    .sort((a, b) => b.avg - a.avg)
    .slice(0, 3);

  artistAffinityEl.innerHTML = `
    <div class="grid grid-cols-2 gap-2">
      <div class="bg-slate-950 p-2 rounded-xl border border-slate-800">
        <div class="text-[10px] text-slate-400 mb-1">最多登録 Top3</div>
        <div class="space-y-1">
          ${topRegisteredArtists.map((a, i) => `
            <div class="text-[11px] truncate flex justify-between">
              <span class="text-slate-200 truncate">${i + 1}.${escapeHtml(a)}</span>
              <span class="text-indigo-400 font-mono shrink-0 font-bold">${artistMap[a].count}曲</span>
            </div>
          `).join('') || '<span class="text-slate-500 text-[10px]">なし</span>'}
        </div>
      </div>
      <div class="bg-slate-950 p-2 rounded-xl border border-slate-800">
        <div class="text-[10px] text-slate-400 mb-1">相性最高 Top3 (2曲以上)</div>
        <div class="space-y-1">
          ${topScoreArtists.map((a, i) => `
            <div class="text-[11px] truncate flex justify-between">
              <span class="text-slate-200 truncate">${i + 1}.${escapeHtml(a.name)}</span>
              <span class="text-emerald-400 font-mono shrink-0 font-bold">${a.avg}点</span>
            </div>
          `).join('') || '<span class="text-slate-500 text-[10px]">2曲以上の歌手なし</span>'}
        </div>
      </div>
    </div>
  `;

  // 5. マンネリ度
  const monotonyEl = document.getElementById('analysisMonotony');
  const threeMonthsAgo = Date.now() - 90 * 24 * 60 * 60 * 1000;
  const dormant = activeSongs.filter(s => {
    if (s.score !== '得意') return false;
    if (!s.lastSungAt) return true;
    return s.lastSungAt < threeMonthsAgo;
  }).slice(0, 3);

  const totalSingsAll = activeSongs.reduce((sum, s) => sum + (s.singCount || 0), 0);
  const sortedBySings = [...activeSongs].sort((a, b) => (b.singCount || 0) - (a.singCount || 0));
  const top5SingSum = sortedBySings.slice(0, 5).reduce((sum, s) => sum + (s.singCount || 0), 0);
  const concentrationRate = totalSingsAll > 0 ? Math.round((top5SingSum / totalSingsAll) * 100) : 0;

  const monotonyLevel = concentrationRate >= 60 ? { label: '固定化（高）⚠️', color: 'text-amber-400' } :
                        concentrationRate >= 35 ? { label: '標準的 👍', color: 'text-indigo-300' } :
                        { label: '多品種・冒険型 ✨', color: 'text-emerald-400' };

  monotonyEl.innerHTML = `
    <div class="bg-slate-950 p-2.5 rounded-xl border border-slate-800 space-y-2">
      <div class="flex items-center justify-between">
        <span class="text-[10px] text-slate-400">上位5曲集中率:</span>
        <span class="font-bold text-xs ${monotonyLevel.color}">${concentrationRate}%（${monotonyLevel.label}）</span>
      </div>
      <div>
        <div class="text-[10px] text-slate-400 mb-1">ご無沙汰な十八番（3ヶ月以上未歌唱）:</div>
        <div class="space-y-1">
          ${dormant.map(s => `
            <div class="flex items-center justify-between py-0.5 text-[11px]">
              <span class="truncate text-slate-300">${escapeHtml(s.title)}</span>
              <span class="text-[9px] bg-amber-950 text-amber-400 border border-amber-800/70 px-1 rounded shrink-0">要復習</span>
            </div>
          `).join('') || '<div class="text-[10px] text-slate-500">直近しっかり歌われています！</div>'}
        </div>
      </div>
    </div>
  `;

  // 最多歌唱Top 5
  const mostSung = [...activeSongs].sort((a, b) => (b.singCount || 0) - (a.singCount || 0)).slice(0, 5);
  const mostSungEl = document.getElementById('analysisMostSung');
  mostSungEl.innerHTML = mostSung.map((s, idx) => `
    <div class="flex items-center justify-between py-1 border-b border-slate-800/60 last:border-0">
      <span class="truncate text-slate-200">${idx + 1}. ${escapeHtml(s.title)}</span>
      <span class="text-[11px] font-bold text-indigo-300 font-mono shrink-0">${s.singCount || 0}回</span>
    </div>
  `).join('');
}

// 歌唱記録
window.recordSung = async function(id) {
  const target = (window.songs || []).find(s => s.id === id);
  if (!target) return;

  undoHistory[id] = { lastSungAt: target.lastSungAt || null, singCount: target.singCount || 0 };
  target.lastSungAt = Date.now();
  target.singCount = (target.singCount || 0) + 1;
  render();

  if (isDemoMode) {
    saveLocalDemoSongs();
  } else if (window.firestoreOps) {
    const { doc, updateDoc } = window.firestoreOps;
    await updateDoc(doc(window.db, "songs", id), { 
      lastSungAt: target.lastSungAt,
      singCount: target.singCount
    });
  }

  setTimeout(() => {
    if (undoHistory[id] !== undefined) {
      delete undoHistory[id];
      render();
    }
  }, 10000);
};

window.undoSung = async function(id) {
  if (undoHistory[id] === undefined) return;
  const prev = undoHistory[id];
  delete undoHistory[id];

  const target = (window.songs || []).find(s => s.id === id);
  if (target) {
    target.lastSungAt = prev.lastSungAt;
    target.singCount = prev.singCount;
  }
  render();

  if (isDemoMode) {
    saveLocalDemoSongs();
  } else if (window.firestoreOps) {
    const { doc, updateDoc } = window.firestoreOps;
    await updateDoc(doc(window.db, "songs", id), { 
      lastSungAt: prev.lastSungAt,
      singCount: prev.singCount
    });
  }
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
  document.getElementById('formScore').value = 'これから';
  
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
  lockBodyScroll(true);
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
  document.getElementById('formScore').value = s.score || 'これから';
  document.getElementById('formTags').value = (s.tags || []).join(', ');
  document.getElementById('formMemo').value = s.memo || '';
  
  const resetRow = document.getElementById('resetSungRow');
  if (s.lastSungAt || s.singCount) resetRow.classList.remove('hidden');
  else resetRow.classList.add('hidden');

  document.getElementById('modal').classList.remove('hidden');
  lockBodyScroll(true);
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
  lockBodyScroll(false);
};

window.handleSave = async function(e) {
  e.preventDefault();
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

  if (isDemoMode) {
    if (editId) {
      const idx = window.songs.findIndex(s => s.id === editId);
      if (idx !== -1) window.songs[idx] = { ...window.songs[idx], ...songData };
    } else {
      window.songs.unshift({
        id: `demo_${Date.now()}`,
        ...songData,
        createdAt: Date.now(),
        singCount: 0,
        lastSungAt: null
      });
    }
    saveLocalDemoSongs();
  } else if (window.firestoreOps) {
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
  }

  window.isUserSorting = true;
  closeModal();
  render();
};

window.deleteSong = async function(id) {
  if (confirm('この曲を削除しますか？')) {
    removeFromSetlist(id);
    if (isDemoMode) {
      window.songs = window.songs.filter(s => s.id !== id);
      saveLocalDemoSongs();
      render();
    } else if (window.firestoreOps) {
      const { doc, deleteDoc } = window.firestoreOps;
      await deleteDoc(doc(window.db, "songs", id));
    }
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

// ==========================================
// 💡 空気読み選曲機能（404解消・モデル順次リトライ連鎖）
// ==========================================
window.openMoodSuggestModal = function() {
  currentMoodFlow = [];
  activeMoodAttrs.clear();
  syncMoodAttrVisual();
  renderMoodFlowChain();
  document.getElementById('moodSuggestResult').classList.add('hidden');
  document.getElementById('moodSuggestResult').innerHTML = '';
  document.getElementById('moodModal').classList.remove('hidden');
  lockBodyScroll(true);
};

window.closeMoodSuggestModal = function() {
  document.getElementById('moodModal').classList.add('hidden');
  lockBodyScroll(false);
};

window.toggleMoodAttr = function(attrKey) {
  if (activeMoodAttrs.has(attrKey)) activeMoodAttrs.delete(attrKey);
  else activeMoodAttrs.add(attrKey);
  syncMoodAttrVisual();
};

function syncMoodAttrVisual() {
  const map = {
    'ani': document.getElementById('moodAttr_ani'),
    'vocaloid': document.getElementById('moodAttr_vocaloid'),
    'nostalgia': document.getElementById('moodAttr_nostalgia'),
    'trend': document.getElementById('moodAttr_trend')
  };
  for (const [k, el] of Object.entries(map)) {
    if (!el) continue;
    if (activeMoodAttrs.has(k)) {
      el.className = "py-1.5 px-2 rounded-lg bg-indigo-600 text-white font-bold border border-indigo-500 text-left flex items-center gap-1 shadow-sm transition";
    } else {
      el.className = "py-1.5 px-2 rounded-lg bg-slate-950 border border-slate-800 text-slate-300 text-left flex items-center gap-1 transition";
    }
  }
}

window.pushMoodStep = function(tensionLabel) {
  const attrLabels = [];
  if (activeMoodAttrs.has('ani')) attrLabels.push('🎬 アニソン');
  if (activeMoodAttrs.has('vocaloid')) attrLabels.push('🤖 ボカロ');
  if (activeMoodAttrs.has('nostalgia')) attrLabels.push('📻 懐メロ');
  if (activeMoodAttrs.has('trend')) attrLabels.push('👶 最新曲');

  const stepItem = {
    attrs: [...attrLabels],
    tension: tensionLabel,
    display: (attrLabels.length ? attrLabels.join('') + ' ' : '') + tensionLabel
  };
  currentMoodFlow.push(stepItem);
  renderMoodFlowChain();
};

function renderMoodFlowChain() {
  const container = document.getElementById('moodFlowChain');
  if (!container) return;
  if (currentMoodFlow.length === 0) {
    container.innerHTML = '<span class="text-slate-500 text-[11px]">下のボタンを押して流れを入力...</span>';
    return;
  }
  container.innerHTML = currentMoodFlow.map((s, idx) => `
    <span class="inline-flex items-center gap-1 bg-slate-900 border border-slate-700 text-slate-200 px-2 py-0.5 rounded-lg text-[10px] font-mono">
      <span class="text-indigo-400 font-bold">${idx + 1}.</span>
      <span>${escapeHtml(s.display)}</span>
    </span>
  `).join('<span class="text-slate-600 text-[10px]">➜</span>');
}

window.runMoodSuggest = async function() {
  if (currentMoodFlow.length === 0) return alert("直前の空気を1曲以上タップしてください。");
  const resultBox = document.getElementById('moodSuggestResult');
  const btn = document.getElementById('btnRunMoodSuggest');

  btn.disabled = true;
  btn.classList.add('opacity-50');
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = '<div class="text-center text-indigo-300 text-xs py-4">💡 部屋の空気を読み解き、持ち曲から最適な一手を考案中...</div>';

  const myPlayable = (window.songs || []).filter(s => s.score === '得意' || s.score === '歌える');
  const pool = myPlayable.length >= 3 ? myPlayable : (window.songs || []);

  const flowSummary = currentMoodFlow.map((s, i) => `${i + 1}曲前: ${s.display}`).join('\n');
  const songListText = pool.slice(0, 50).map(s => {
    return `- id:${s.id} / ${s.title} (${s.artist || '歌手不明'}) / 年代:${s.year || '不明'} / ジャンル:${s.genre || ''} / タグ:${(s.tags||[]).join(',')} / 習熟度:${s.score} / 最高音:${s.maxPitch || '未設定'}`;
  }).join('\n');

  const apiKey = localStorage.getItem('ohako_gemini_api_key') || '';
  let apiErrorMessage = null;

  if (apiKey) {
    const prompt = `あなたはカラオケの超一流専属マネージャー・AI相棒です。
以下のカラオケルームの【直近の曲の流れ・空気感】を分析し、ユーザーの【持ち曲リスト】の中から今歌うべきベストな3候補を決定してください。

【直近の流れ】
${flowSummary}

【持ち曲候補リスト】
${songListText}

【選曲要件】
1. 指定された空気（バラード、盛り上がり、アニソン、懐メロなど）を最優先で尊重してください。
2. 「王道追随枠（今の空気に完璧に寄り添う）」「空気転換枠（良い塩梅で雰囲気を変える）」「スパイス枠（意表を突く隠し球）」の3枠を選んでください。
3. コメントは毎回定型文ではなく、その曲の歌詞の魅力、高音の聴かせどころ、ルームの反応予想などを交えてウィットに富んだ相棒口調で書いてください。

以下のJSON配列形式のみで出力してください。Markdown装飾や余計な文は不要です。
[
  { "id": "曲のid", "category": "王道追随枠", "comment": "相棒コメント（70〜100字程度）" },
  { "id": "曲のid", "category": "空気転換枠", "comment": "相棒コメント（70〜100字程度）" },
  { "id": "曲のid", "category": "スパイス枠", "comment": "相棒コメント（70〜100字程度）" }
]`;

    const modelsSequence = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
    let success = false;

    for (const modelName of modelsSequence) {
      try {
        const res = await fetch(`[https://generativelanguage.googleapis.com/v1beta/models/$](https://generativelanguage.googleapis.com/v1beta/models/$){modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const data = await res.json();
        const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        const cleanJson = rawText.replace(/^```json\s*/i, '').replace(/^```\s*/i, '').replace(/```$/i, '').trim();
        const suggestions = JSON.parse(cleanJson);

        if (!Array.isArray(suggestions) || suggestions.length === 0) {
          throw new Error("配列形式の解析に失敗");
        }

        renderMoodResults(suggestions, null);
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        success = true;
        break;
      } catch (e) {
        apiErrorMessage = `${modelName}: ${e.message}`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (success) return;
  } else {
    apiErrorMessage = "Gemini APIキー未設定（⚙️管理設定で登録すると本格AI提案が有効になります）";
  }

  // フォールバック（インテリジェント・ルールベース）
  const isBallad = currentMoodFlow.some(s => s.tension.includes('バラード'));
  const isHighTension = currentMoodFlow.some(s => s.tension.includes('盛り上がり'));
  const isAni = currentMoodFlow.some(s => s.attrs.some(a => a.includes('アニソン')));
  const isNostalgia = currentMoodFlow.some(s => s.attrs.some(a => a.includes('懐メロ')));

  let matchCandidates = pool.filter(s => {
    const text = `${s.title} ${s.artist} ${s.genre} ${(s.tags||[]).join(' ')} ${s.memo}`.toLowerCase();
    if (isBallad && (text.includes('バラード') || text.includes('バラ') || text.includes('しっとり'))) return true;
    if (isHighTension && (text.includes('盛り上') || text.includes('アッパー') || text.includes('ロック'))) return true;
    if (isAni && (text.includes('アニメ') || text.includes('アニソン') || text.includes('主題歌'))) return true;
    if (isNostalgia && (text.includes('90年代') || text.includes('2000年代') || (parseInt(s.year, 10) < 2010))) return true;
    return false;
  });

  if (matchCandidates.length < 3) matchCandidates = [...pool];

  const shuffled = [...matchCandidates].sort(() => 0.5 - Math.random());
  const picked = shuffled.slice(0, 3);
  const categories = ["王道追随枠", "空気転換枠", "スパイス枠"];

  const commentsPool = {
    ballad: [
      "会場がしっとり温まった今こそ響く美メロバラード。サビの情感を込めて歌い上げましょう！",
      "あえてキーを下げずに原曲の切なさをそのまま届ける一手。全員の耳を奪えます。",
      "バラードの流れを壊さず、少し大人の雰囲気に引き込む絶妙なアクセント曲。"
    ],
    upbeat: [
      "直前のボルテージを最高潮へ引き継ぐ鉄板アンセム！手拍子を巻き込んでいきましょう。",
      "熱気あふれるフロアにさらに火をつけるハイテンションナンバー。思い切り喉を解放！",
      "勢いそのままに変化球！『その曲きたか！』とフロアを沸かせる一撃です。"
    ],
    general: [
      "直前の流れを自然に継承しつつ、自分の十八番の安定感をしっかり見せつける王道選曲。",
      "ここでガラッとテンポを変えて耳目を集める。緩急をつける相棒おすすめの一手。",
      "意表を突きつつ全員が口ずさめる絶妙なポジション。カラオケ巧者ならではの選曲です。"
    ]
  };

  const cPool = isBallad ? commentsPool.ballad : isHighTension ? commentsPool.upbeat : commentsPool.general;

  const localSuggestions = picked.map((s, idx) => ({
    id: s.id,
    category: categories[idx] || "おすすめ枠",
    comment: cPool[idx % cPool.length]
  }));

  renderMoodResults(localSuggestions, apiErrorMessage);
  btn.disabled = false;
  btn.classList.remove('opacity-50');
};

function renderMoodResults(suggestions, errorMessage) {
  const resultBox = document.getElementById('moodSuggestResult');
  let errHtml = '';
  if (errorMessage) {
    errHtml = `
      <div class="bg-amber-950/70 border border-amber-800/80 p-2 rounded-xl text-[10px] text-amber-200 flex items-center justify-between">
        <span>⚠️ ${escapeHtml(errorMessage)}</span>
        <span class="text-[9px] bg-amber-900 px-1 py-0.2 rounded font-bold">ローカル選曲</span>
      </div>
    `;
  }

  resultBox.innerHTML = errHtml + suggestions.map(item => {
    const s = (window.songs || []).find(x => x.id === item.id) || { title: 'おすすめ曲', artist: '' };
    return `
      <div class="p-2.5 bg-slate-950 border border-slate-800 rounded-xl space-y-1">
        <div class="flex items-center justify-between text-[10px]">
          <span class="bg-indigo-950 text-indigo-300 border border-indigo-800 px-1.5 py-0.2 rounded font-bold">${escapeHtml(item.category)}</span>
          <span class="text-slate-500 font-mono">${s.key === '0' ? '原曲キー' : s.key || ''}</span>
        </div>
        <div class="font-bold text-sm text-white truncate">${escapeHtml(s.title)} <span class="text-xs font-normal text-slate-400">/ ${escapeHtml(s.artist || '')}</span></div>
        <p class="text-xs text-indigo-200 leading-relaxed bg-slate-900/60 p-2 rounded-lg border border-slate-800/80">
          🗣️ 「${escapeHtml(item.comment)}」
        </p>
        <div class="flex justify-end gap-1.5 pt-1">
          <button onclick="addToSetlist('${s.id}'); closeMoodSuggestModal();" class="text-[10px] bg-slate-800 hover:bg-slate-700 text-indigo-300 px-2 py-1 rounded-md border border-slate-700">
            ＋ ピックアップに追加
          </button>
        </div>
      </div>
    `;
  }).join('');
}

// ==========================================
// 🤖 勝手にカラオケ総括・評論（UX改善版）
// ==========================================
window.openSummaryModal = function() {
  const todayStr = new Date().toISOString().split('T')[0];
  const dateInput = document.getElementById('summaryTargetDate');
  if (dateInput) dateInput.value = todayStr;

  loadSummarySongsForDate();
  document.getElementById('summaryResultArea').classList.add('hidden');
  document.getElementById('summaryResultArea').innerHTML = '';
  document.getElementById('summaryModal').classList.remove('hidden');
  lockBodyScroll(true);
};

window.closeSummaryModal = function() {
  document.getElementById('summaryModal').classList.add('hidden');
  lockBodyScroll(false);
};

window.loadSummarySongsForDate = function() {
  const dateStr = document.getElementById('summaryTargetDate')?.value;
  if (!dateStr) return;

  const targetStart = new Date(`${dateStr}T06:00:00`).getTime();
  const nextDay = new Date(targetStart + 24 * 60 * 60 * 1000);
  const targetEnd = nextDay.getTime();

  summaryCandidateSongs = (window.songs || []).filter(s => {
    if (!s.lastSungAt) return false;
    return s.lastSungAt >= targetStart && s.lastSungAt < targetEnd;
  }).sort((a, b) => (a.lastSungAt || 0) - (b.lastSungAt || 0));

  renderSummaryCandidateList();
};

function renderSummaryCandidateList() {
  const countEl = document.getElementById('summarySongCount');
  const container = document.getElementById('summarySongList');
  if (!container) return;

  countEl.textContent = `${summaryCandidateSongs.length}曲 歌唱`;

  if (summaryCandidateSongs.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 py-8 text-xs">この日歌われた曲の履歴がありません</div>';
    return;
  }

  container.innerHTML = summaryCandidateSongs.map((s, idx) => `
    <div data-idx="${idx}" class="summary-drag-card flex items-center justify-between p-2.5 bg-slate-950 border border-slate-800 rounded-xl text-xs gap-2 select-none transition-all duration-150">
      <div class="flex items-center gap-2 shrink-0">
        <button onclick="removeSummarySong(${idx})" class="text-slate-500 hover:text-rose-400 p-1 text-sm rounded bg-slate-900 border border-slate-800" title="リストから除外">✕</button>
        <span class="card-rank font-mono text-indigo-400 font-bold w-4 text-center shrink-0">${idx + 1}</span>
      </div>
      <div class="min-w-0 flex-1 px-1">
        <div class="font-bold text-white truncate text-xs">${escapeHtml(s.title)}</div>
        <div class="text-[10px] text-slate-400 truncate">${escapeHtml(s.artist || '')} • ${s.key === '0' ? '原曲' : 'キー ' + s.key} • 最高 ${escapeHtml(s.maxPitch || '--')}</div>
      </div>
      <div class="shrink-0 pl-1">
        <span data-handle="true" class="cursor-grab active:cursor-grabbing text-slate-400 hover:text-indigo-300 font-mono text-xl px-2.5 py-1.5 rounded-lg bg-slate-900 border border-slate-800 touch-none flex items-center justify-center">☰</span>
      </div>
    </div>
  `).join('');

  attachSummaryTouchDragListeners();
}

// DOM再構築を行わず浮遊スタイルを維持したスムーズ並び替え
function attachSummaryTouchDragListeners() {
  const container = document.getElementById('summarySongList');
  if (!container) return;

  const cards = container.querySelectorAll('.summary-drag-card');
  let draggedCard = null;
  let draggedIdx = null;

  function updateCardIndices() {
    const currentCards = container.querySelectorAll('.summary-drag-card');
    currentCards.forEach((c, i) => {
      c.dataset.idx = i;
      const rankEl = c.querySelector('.card-rank');
      if (rankEl) rankEl.textContent = i + 1;
    });
  }

  cards.forEach(card => {
    const handle = card.querySelector('[data-handle="true"]');
    if (!handle) return;

    handle.addEventListener('touchstart', () => {
      draggedCard = card;
      draggedIdx = parseInt(card.dataset.idx, 10);
      
      card.style.transform = 'scale(1.04) translateY(-3px)';
      card.style.boxShadow = '0 15px 25px -5px rgba(99, 102, 241, 0.4)';
      card.style.borderColor = '#818cf8';
      card.style.zIndex = '50';
      card.style.position = 'relative';

      if (navigator.vibrate) navigator.vibrate(20);
    }, { passive: true });

    handle.addEventListener('touchmove', (e) => {
      if (!draggedCard) return;
      const touch = e.touches[0];
      const targetEl = document.elementFromPoint(touch.clientX, touch.clientY);
      const targetCard = targetEl ? targetEl.closest('.summary-drag-card') : null;

      if (targetCard && targetCard !== draggedCard && container.contains(targetCard)) {
        const targetIdx = parseInt(targetCard.dataset.idx, 10);
        if (!isNaN(targetIdx) && targetIdx !== draggedIdx) {
          // 配列入れ替え
          const item = summaryCandidateSongs.splice(draggedIdx, 1)[0];
          summaryCandidateSongs.splice(targetIdx, 0, item);

          // DOMの順序を直接変更（再描画せず浮上スタイルを維持）
          if (targetIdx > draggedIdx) {
            container.insertBefore(draggedCard, targetCard.nextSibling);
          } else {
            container.insertBefore(draggedCard, targetCard);
          }

          draggedIdx = targetIdx;
          updateCardIndices();
          if (navigator.vibrate) navigator.vibrate(15);
        }
      }
    }, { passive: true });

    const handleEnd = () => {
      if (draggedCard) {
        draggedCard.style.transform = '';
        draggedCard.style.boxShadow = '';
        draggedCard.style.borderColor = '';
        draggedCard.style.zIndex = '';
        draggedCard.style.position = '';
        draggedCard = null;
        draggedIdx = null;
      }
    };

    handle.addEventListener('touchend', handleEnd);
    handle.addEventListener('touchcancel', handleEnd);

    // PC マウス操作
    handle.addEventListener('mousedown', () => {
      card.setAttribute('draggable', 'true');
    });

    card.addEventListener('dragstart', (e) => {
      draggedIdx = parseInt(card.dataset.idx, 10);
      draggedCard = card;
      card.style.transform = 'scale(1.04) translateY(-3px)';
      card.style.boxShadow = '0 15px 25px -5px rgba(99, 102, 241, 0.4)';
      card.style.borderColor = '#818cf8';
      card.style.zIndex = '50';
      e.dataTransfer.effectAllowed = 'move';
    });

    card.addEventListener('dragover', (e) => {
      e.preventDefault();
      const currentHoverIdx = parseInt(card.dataset.idx, 10);
      if (draggedIdx !== null && draggedIdx !== currentHoverIdx) {
        const item = summaryCandidateSongs.splice(draggedIdx, 1)[0];
        summaryCandidateSongs.splice(currentHoverIdx, 0, item);

        if (currentHoverIdx > draggedIdx) {
          container.insertBefore(draggedCard, card.nextSibling);
        } else {
          container.insertBefore(draggedCard, card);
        }

        draggedIdx = currentHoverIdx;
        updateCardIndices();
        if (navigator.vibrate) navigator.vibrate(15);
      }
    });

    card.addEventListener('dragend', () => {
      card.style.transform = '';
      card.style.boxShadow = '';
      card.style.borderColor = '';
      card.style.zIndex = '';
      card.removeAttribute('draggable');
      draggedCard = null;
      draggedIdx = null;
    });
  });
}

window.removeSummarySong = function(idx) {
  summaryCandidateSongs.splice(idx, 1);
  renderSummaryCandidateList();
};

window.openAddSummarySongPicker = function() {
  document.getElementById('summaryAddSearchInput').value = '';
  renderSummaryAddPickerList();
  document.getElementById('summaryAddPickerModal').classList.remove('hidden');
};

window.closeAddSummarySongPicker = function() {
  document.getElementById('summaryAddPickerModal').classList.add('hidden');
};

window.renderSummaryAddPickerList = function() {
  const q = (document.getElementById('summaryAddSearchInput')?.value || '').trim();
  const container = document.getElementById('summaryAddPickerList');
  const pool = (window.songs || []).filter(s => matchSearchQuery(s, q));

  if (pool.length === 0) {
    container.innerHTML = '<div class="text-center text-slate-500 py-6 text-xs">一致する曲がありません</div>';
    return;
  }

  container.innerHTML = pool.slice(0, 30).map(s => `
    <div class="flex items-center justify-between p-2 bg-slate-950 border border-slate-800 rounded-xl text-xs gap-2">
      <div class="min-w-0">
        <div class="font-bold text-white truncate">${escapeHtml(s.title)}</div>
        <div class="text-[10px] text-slate-400 truncate">${escapeHtml(s.artist || '歌手未設定')} • ${s.key === '0' ? '原曲' : 'キー ' + s.key}</div>
      </div>
      <button onclick="addSongToSummary('${s.id}')" class="bg-indigo-600 hover:bg-indigo-500 text-white px-2.5 py-1 rounded-lg text-xs font-bold whitespace-nowrap">
        ＋ 追加
      </button>
    </div>
  `).join('');
};

window.addSongToSummary = function(id) {
  const s = (window.songs || []).find(x => x.id === id);
  if (!s) return;
  summaryCandidateSongs.push(s);
  renderSummaryCandidateList();
  closeAddSummarySongPicker();
};

function calculateSummaryStats(songs) {
  if (songs.length === 0) return null;

  let highestPitch = { pitch: '--', song: '--', rank: 0 };
  let oasisPitch = { pitch: '--', song: '--', rank: 999 };

  songs.forEach(s => {
    const rank = getPitchRank(s.maxPitch);
    if (rank > 0) {
      if (rank > highestPitch.rank) highestPitch = { pitch: s.maxPitch, song: s.title, rank };
      if (rank < oasisPitch.rank) oasisPitch = { pitch: s.maxPitch, song: s.title, rank };
    }
  });

  const masteredCount = songs.filter(s => s.score === '得意').length;
  const playableCount = songs.filter(s => s.score === '歌える').length;
  const ohakoDegree = Math.round(((masteredCount * 1.0 + playableCount * 0.7) / Math.max(songs.length, 1)) * 100);
  const adjCount = songs.filter(s => s.key && s.key !== '0' && s.key !== '原曲').length;

  return {
    highest: highestPitch.rank > 0 ? `${highestPitch.pitch}（${highestPitch.song}）` : '未登録',
    oasis: oasisPitch.rank < 999 ? `${oasisPitch.pitch}（${oasisPitch.song}）` : '未登録',
    ohakoDegree: `${ohakoDegree}%`,
    adjRatio: `${adjCount}/${songs.length}曲`
  };
}

window.generateAiSummary = async function() {
  if (summaryCandidateSongs.length === 0) return alert("総括対象の曲がありません。");

  const btn = document.getElementById('btnGenerateSummary');
  const resultBox = document.getElementById('summaryResultArea');
  btn.disabled = true;
  btn.classList.add('opacity-50');
  resultBox.classList.remove('hidden');
  resultBox.innerHTML = '<div class="text-center text-indigo-300 text-xs py-4">✨ AI相棒が実戦スタッツを精査し、愛ある辛口講評を執筆中...</div>';

  const stats = calculateSummaryStats(summaryCandidateSongs);
  const songRows = summaryCandidateSongs.map((s, i) => `${i + 1}. ${s.title} (${s.artist || '歌手不明'}) [キー:${s.key || '0'}, 最高音:${s.maxPitch || '未設定'}, 習熟度:${s.score || '不明'}]`).join('\n');
  const apiKey = localStorage.getItem('ohako_gemini_api_key') || '';

  const statsHeaderHtml = `
    <div class="bg-indigo-950/60 border border-indigo-800/80 p-2.5 rounded-xl space-y-1 mb-2">
      <div class="text-[10px] font-bold text-indigo-300">📊 実戦スタッツまとめ</div>
      <div class="grid grid-cols-2 gap-1.5 text-[11px]">
        <div>🔥 最高到達点: <strong class="text-amber-300">${escapeHtml(stats.highest)}</strong></div>
        <div>🌿 喉のオアシス: <strong class="text-emerald-300">${escapeHtml(stats.oasis)}</strong></div>
        <div>👑 本日の十八番度: <strong class="text-white">${stats.ohakoDegree}</strong></div>
        <div>🎯 キー調整活用: <strong class="text-indigo-300">${stats.adjRatio}</strong></div>
      </div>
    </div>
  `;

  let apiErrorMessage = null;

  if (apiKey) {
    const prompt = `あなたはカラオケの超一流専属マネージャー・AI相棒です。
本日のカラオケ歌唱リストおよび実戦スタッツを徹底分析し、ユーザーの予想を超えるウィット・深み・切れ味のある総括レポートを作成してください。

【本日の実戦スタッツ】
- 最高到達点: ${stats.highest}
- 喉のオアシス曲: ${stats.oasis}
- 十八番度: ${stats.ohakoDegree}
- キー調整: ${stats.adjRatio}

【本日の歌唱リスト（歌った順）】
${songRows}

【講評執筆の要件】
1. 単なる曲の羅列や褒め言葉に終始せず、曲順のストーリー性、喉の酷使ペース配分、キー調整のファインプレー（または原曲無茶）、選曲の情緒（アッパーとバラードの乱高下など）をプロのマネージャー視点で鋭く愛をもって突っ込んでください。
2. ボリュームは読み応えのある600〜800字程度。
3. 以下のフォーマットを必ず使用してください（「セトリ」という用語は絶対に使わないでください）。

■ 本日の歌唱ドラマ二つ名（称号）
（パンチのある尖った称号）

■ 相棒からの辛口＆情熱レビュー
（曲順ドラマ、喉のマネジメント、世代感などを鋭くユーモラスに講評）

■ 本日のベストパフォーマンス賞 & 渇入れ（次回への課題）`;

    const modelsSequence = ["gemini-3.5-flash", "gemini-3.5-flash-lite", "gemini-3.1-flash-lite"];
    let success = false;

    for (const modelName of modelsSequence) {
      try {
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${apiKey}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ contents: [{ parts: [{ text: prompt }] }] })
        });

        if (!res.ok) throw new Error(`HTTP ${res.status}: ${res.statusText}`);

        const data = await res.json();
        const text = data.candidates?.[0]?.content?.parts?.[0]?.text || '';
        if (!text) throw new Error("AIから回答テキストが取得できませんでした");

        resultBox.innerHTML = statsHeaderHtml + `<div class="whitespace-pre-wrap leading-relaxed text-indigo-100 text-xs">${escapeHtml(text)}</div>`;
        btn.disabled = false;
        btn.classList.remove('opacity-50');
        success = true;
        break;
      } catch (e) {
        apiErrorMessage = `${modelName}: ${e.message}`;
        await new Promise(r => setTimeout(r, 1000));
      }
    }

    if (success) return;
  } else {
    apiErrorMessage = "Gemini APIキー未設定（⚙️管理設定で登録すると本格AI総括が有効になります）";
  }

  // フォールバック（スタッツ連動・状況分岐レビュー）
  const titles = summaryCandidateSongs.map(s => s.title);
  const errBanner = apiErrorMessage ? `
    <div class="bg-amber-950/70 border border-amber-800/80 p-2 rounded-xl text-[10px] text-amber-200 mb-2 flex items-center justify-between">
      <span>⚠️ ${escapeHtml(apiErrorMessage)}</span>
      <span class="text-[9px] bg-amber-900 px-1 py-0.2 rounded font-bold">ローカル講評</span>
    </div>
  ` : '';

  resultBox.innerHTML = errBanner + statsHeaderHtml + `
    <div class="space-y-2 text-xs text-indigo-100 leading-relaxed">
      <div class="font-bold text-amber-400 text-sm">🏆 称号: 『喉酷使！意地と情熱のハイピッチ・ショウダウン』</div>
      <p>
        全${summaryCandidateSongs.length}曲の熱唱、本当にお疲れ様でした！初手「${escapeHtml(titles[0] || '')}」で会場の空気を一気に掴んだ滑り出しは完璧でしたが、中盤以降の曲順構成はまさにスリリング。最高到達点【${escapeHtml(stats.highest)}】への果敢なアタックは圧巻だった反面、喉のスタミナ配分を完全に度外視したパッション選曲に相棒としては冷や汗の連続でした。
      </p>
      <p>
        十八番度は【${stats.ohakoDegree}】と高水準をマーク。オアシス曲【${escapeHtml(stats.oasis)}】を挟む冷静さがあったからこそ、最後まで歌声を保てたファインプレーと言えます。
      </p>
      <div class="bg-slate-900 p-2 rounded-lg border border-slate-800 text-[11px] text-slate-300">
        📢 <strong>相棒からの渇入れ:</strong> 次回は前半にキー調整曲を1曲差し込み、後半の爆発力を温存するスマートな構成を期待しています！
      </div>
    </div>
  `;
  btn.disabled = false;
  btn.classList.remove('opacity-50');
};

// ==========================================
// 📇 私の十八番名刺（シェア & ゲスト遮断ウェルカム画面）
// ==========================================
let currentCardScope = 'mastered';
let cachedSharedCardList = [];

window.openCardShareModal = function() {
  closeSettingsModal();
  selectCardScope('mastered');
  document.getElementById('cardShareModal').classList.remove('hidden');
  lockBodyScroll(true);
};

window.closeCardShareModal = function() {
  document.getElementById('cardShareModal').classList.add('hidden');
  lockBodyScroll(false);
};

window.selectCardScope = function(scope) {
  currentCardScope = scope;
  ['mastered', 'main', 'all', 'pickup'].forEach(k => {
    const el = document.getElementById(`cardScope_${k}`);
    if (!el) return;
    if (k === scope) {
      el.className = "py-2 px-2.5 rounded-xl bg-indigo-600 text-white font-bold border border-indigo-500 text-left transition shadow";
    } else {
      el.className = "py-2 px-2.5 rounded-xl bg-slate-950 text-slate-300 border border-slate-800 text-left transition";
    }
  });

  generateCardShareLink();
};

function generateCardShareLink() {
  let targetSongs = [];
  if (currentCardScope === 'mastered') {
    targetSongs = (window.songs || []).filter(s => s.score === '得意');
  } else if (currentCardScope === 'main') {
    targetSongs = (window.songs || []).filter(s => s.score === '得意' || s.score === '歌える');
  } else if (currentCardScope === 'all') {
    targetSongs = window.songs || [];
  } else if (currentCardScope === 'pickup') {
    targetSongs = setlist.map(id => (window.songs || []).find(s => String(s.id) === String(id))).filter(Boolean);
  }

  document.getElementById('cardShareCountBadge').textContent = `${targetSongs.length}曲`;

  const miniData = targetSongs.map(s => [
    s.title || '',
    s.artist || '',
    s.key || '0',
    s.score || 'これから',
    s.previewUrl || ''
  ]);

  const jsonStr = JSON.stringify(miniData);
  const base64Data = btoa(encodeURIComponent(jsonStr));
  const url = `${window.location.origin}${window.location.pathname}#card=${base64Data}`;

  const input = document.getElementById('cardShareUrlInput');
  if (input) input.value = url;
}

window.copyCardShareUrl = function() {
  const input = document.getElementById('cardShareUrlInput');
  if (!input || !input.value) return;
  navigator.clipboard.writeText(input.value).then(() => {
    const btn = document.getElementById('btnCopyCardUrl');
    const orig = btn.textContent;
    btn.textContent = "✅ 完了";
    setTimeout(() => { btn.textContent = orig; }, 1500);
  });
};

function checkAndOpenSharedCard() {
  const hash = window.location.hash;
  if (!hash.startsWith('#card=')) return;

  try {
    const base64 = hash.replace('#card=', '');
    const jsonStr = decodeURIComponent(atob(base64));
    const list = JSON.parse(jsonStr);

    if (Array.isArray(list)) {
      cachedSharedCardList = list;
      renderCardViewScreen(list);
    }
  } catch (e) {
    console.error("名刺データの解析に失敗しました:", e);
  }
}

function renderCardViewScreen(list) {
  const header = document.getElementById('appMainHeader');
  if (header) header.classList.add('hidden');
  const mylist = document.getElementById('viewMyList');
  if (mylist) mylist.classList.add('hidden');

  const modal = document.getElementById('cardViewModal');
  const container = document.getElementById('cardViewList');
  const subEl = document.getElementById('cardViewSubtitle');

  subEl.textContent = `全 ${list.length} 曲のレパートリー（閲覧専用）`;
  container.innerHTML = list.map((item, idx) => {
    const [title, artist, key, score, previewUrl] = item;
    const playId = `card_view_${idx}`;
    const isPlaying = currentPlayingId === playId;

    return `
      <div class="flex items-center justify-between p-3 bg-slate-900 border border-slate-800 rounded-xl text-xs gap-2">
        <div class="min-w-0 flex-1">
          <div class="font-bold text-white text-sm truncate">${escapeHtml(title)}</div>
          <div class="text-xs text-slate-400 truncate mt-0.5">${escapeHtml(artist || '歌手未設定')}</div>
          <div class="flex items-center gap-1.5 mt-1 text-[10px]">
            <span class="bg-slate-950 border border-slate-800 px-1.5 py-0.2 rounded font-mono text-indigo-300">${key === '0' ? '原曲' : 'キー ' + key}</span>
            <span class="bg-indigo-950/80 border border-indigo-800 text-indigo-300 px-1.5 py-0.2 rounded">${escapeHtml(score)}</span>
          </div>
        </div>
        ${previewUrl ? `
          <button onclick="togglePlayPreview('${previewUrl}', '${playId}', '${escapeHtml(title)}', '${escapeHtml(artist)}')" class="shrink-0 bg-slate-800 hover:bg-slate-700 text-indigo-300 border border-slate-700 px-2.5 py-1.5 rounded-lg text-xs font-bold">
            ${isPlaying ? '⏹ 停止' : '▶ 試聴'}
          </button>
        ` : ''}
      </div>
    `;
  }).join('');

  modal.classList.remove('hidden');
  lockBodyScroll(true);
}

window.closeCardView = function() {
  document.getElementById('cardViewModal').classList.add('hidden');
  document.getElementById('cardWelcomeModal').classList.remove('hidden');
  lockBodyScroll(true);
};

window.reopenSharedCard = function() {
  document.getElementById('cardWelcomeModal').classList.add('hidden');
  if (cachedSharedCardList && cachedSharedCardList.length > 0) {
    renderCardViewScreen(cachedSharedCardList);
  }
};

// ゲストが「自分もOHAKOをはじめる」を押した際のデモモード起動
window.startMyOwnOhako = function() {
  isDemoMode = true;
  localStorage.setItem('ohako_is_demo_mode', 'true');

  document.getElementById('cardWelcomeModal').classList.add('hidden');
  document.getElementById('cardViewModal').classList.add('hidden');
  
  const header = document.getElementById('appMainHeader');
  if (header) header.classList.remove('hidden');
  const mylist = document.getElementById('viewMyList');
  if (mylist) mylist.classList.remove('hidden');

  const demoBanner = document.getElementById('demoModeBanner');
  if (demoBanner) demoBanner.classList.remove('hidden');

  window.location.hash = '';
  lockBodyScroll(false);

  loadLocalDemoSongs();
  render();
};

// URLハッシュ変化検知
window.addEventListener('hashchange', checkAndOpenSharedCard);

window.addEventListener('DOMContentLoaded', () => {
  if (isDemoMode) {
    const demoBanner = document.getElementById('demoModeBanner');
    if (demoBanner) demoBanner.classList.remove('hidden');
    loadLocalDemoSongs();
    render();
  }
  checkAndOpenSharedCard();
});

render();
