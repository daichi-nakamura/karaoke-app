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

// 絞り込みボトムシート制御
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

// メインナビゲーション
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

// プレースホルダー関数群
window.loadRanking = async function() {
  const container = document.getElementById('rankingList');
  if(!container) return;
  container.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">ランキング読み込み中...</div>';
  try {
    const data = await fetchITunesApi("2025 2026 J-Pop", 30);
    rankingSongs = (data.results || []).map((item, idx) => ({
      rank: idx + 1,
      trackId: item.trackId,
      title: item.trackName,
      artist: item.artistName,
      artwork: item.artworkUrl100 || '',
      year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
      genre: item.primaryGenreName || 'J-Pop',
      previewUrl: item.previewUrl || ''
    }));
    renderRanking();
  } catch(e) {
    container.innerHTML = '<div class="text-center text-rose-400 py-12 text-sm">読込エラー</div>';
  }
};

function renderRanking() {
  const container = document.getElementById('rankingList');
  if (!container) return;
  container.innerHTML = rankingSongs.map(item => `
    <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
      <span class="font-mono font-bold text-sm text-indigo-400 w-5 text-center">${item.rank}</span>
      <div class="min-w-0 flex-1">
        <div class="font-bold text-sm text-white truncate">${escapeHtml(item.title)}</div>
        <div class="text-xs text-slate-400 truncate">${escapeHtml(item.artist)}</div>
      </div>
    </div>
  `).join('');
}

window.analyzeAndRecommend = async function() {
  const listEl = document.getElementById('recommendList');
  if(!listEl) return;
  listEl.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">おすすめ曲を探索中...</div>';
  try {
    const data = await fetchITunesApi("J-Pop", 20);
    recommendedSongs = (data.results || []).map(item => ({
      title: item.trackName,
      artist: item.artistName,
      year: item.releaseDate ? item.releaseDate.substring(0, 4) : '',
      genre: item.primaryGenreName || 'J-Pop',
      artwork: item.artworkUrl100 || '',
      previewUrl: item.previewUrl || '',
      reason: 'おすすめ名曲'
    }));
    renderRecommended();
  } catch(e) {
    listEl.innerHTML = '<div class="text-center text-rose-400 py-12 text-sm">探索エラー</div>';
  }
};

function renderRecommended() {
  const container = document.getElementById('recommendList');
  if (!container) return;
  container.innerHTML = recommendedSongs.map(item => `
    <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center gap-3">
      <div class="min-w-0 flex-1">
        <div class="font-bold text-sm text-white truncate">${escapeHtml(item.title)}</div>
        <div class="text-xs text-slate-400 truncate">${escapeHtml(item.artist)}</div>
      </div>
    </div>
  `).join('');
}

function renderAnalysis() {
  const allSongs = window.songs || [];
  const activeSongs = allSongs.filter(s => s.score && s.score !== 'これから');
  const countEl = document.getElementById('statActiveCount');
  if (countEl) countEl.textContent = `${activeSongs.length}曲`;
}

window.render = function() {
  const listContainer = document.getElementById('songList');
  const countEl = document.getElementById('songCount');
  const songs = window.songs || [];
  if (countEl) countEl.textContent = `登録曲: ${songs.length}曲`;
  if (!listContainer) return;

  if (songs.length === 0) {
    listContainer.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">曲がありません。「＋追加」から登録してください。</div>';
    return;
  }

  listContainer.innerHTML = songs.map(s => `
    <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center justify-between">
      <div>
        <div class="font-bold text-sm text-white">${escapeHtml(s.title)}</div>
        <div class="text-xs text-slate-400">${escapeHtml(s.artist || '歌手未設定')}</div>
      </div>
      <button onclick="recordSung('${s.id}')" class="bg-indigo-900/80 border border-indigo-700/80 text-indigo-200 px-2 py-1 rounded-lg font-bold text-xs">
        🎤 歌った
      </button>
    </div>
  `).join('');
};

window.openModal = function() {
  document.getElementById('modal')?.classList.remove('hidden');
  lockBodyScroll(true);
};
window.closeModal = function() {
  document.getElementById('modal')?.classList.add('hidden');
  lockBodyScroll(false);
};
window.openSettingsModal = function() {
  document.getElementById('settingsModal')?.classList.remove('hidden');
  lockBodyScroll(true);
};
window.closeSettingsModal = function() {
  document.getElementById('settingsModal')?.classList.add('hidden');
  lockBodyScroll(false);
};
window.openGuideModal = function() {
  document.getElementById('guideModal')?.classList.remove('hidden');
  lockBodyScroll(true);
};
window.closeGuideModal = function() {
  document.getElementById('guideModal')?.classList.add('hidden');
  lockBodyScroll(false);
};
window.toggleSetlistDrawer = function() {
  document.getElementById('setlistDrawer')?.classList.toggle('translate-y-full');
};


// ==========================================
// 🐦 アプリ内生活・自律移動型マスコットシステム (ドラッグ & 自由散歩版)
// ==========================================
const LIVING_MASCOT_ROOMS = {
  mylist: {
    name: "マイリスト",
    dialogues: [
      { state: 'normal', text: "「ここでどの曲歌うか選ぶのか…ふむ」", image: "assets/mascot_normal.jpg" },
      { state: 'happy', text: "「おっ、このセトリはなかなか通好みだな！」", image: "assets/mascot_happy.jpg" },
      { state: 'bored', text: "「また同じ曲ループしてないか～？」", image: "assets/mascot_bored.jpg" },
      { state: 'focused', text: "「キー設定の微調整が勝負の分かれ道だぞ」", image: "assets/mascot_focused.jpg" }
    ]
  },
  recommend: {
    name: "名曲発掘",
    dialogues: [
      { state: 'focused', text: "ライブラリの裏をかいて隠れた名曲を探すぞ…", image: "assets/mascot_focused.jpg" },
      { state: 'happy', text: "「このアーティスト、アレンジのセンス抜群だねぇ」", image: "assets/mascot_happy.jpg" },
      { state: 'confused', text: "「ん？この時代の曲調、ちょっと独特だな…」", image: "assets/mascot_confused.jpg" },
      { state: 'relaxed', text: "「たまにはこういうシブい選曲もシビれるね」", image: "assets/mascot_relaxed.jpg" }
    ]
  },
  ranking: {
    name: "流行曲",
    dialogues: [
      { state: 'playback', text: "「最近のヒットチャートは耳に残るフレーズが多いね」", image: "assets/mascot_playback.jpg" },
      { state: 'happy', text: "「みんなこの曲好きだな！トレンド最前線だね」", image: "assets/mascot_happy.jpg" },
      { state: 'bored', text: "「流行りに乗っかるのも悪くないけどさ…フフ」", image: "assets/mascot_bored.jpg" },
      { state: 'normal', text: "「流行曲のミックスボイス研究しとくか」", image: "assets/mascot_normal.jpg" }
    ]
  },
  analysis: {
    name: "マイ分析",
    dialogues: [
      { state: 'focused', text: "「ふむ…ボイスレンジのデータ、なかなか興味深い数値だ」", image: "assets/mascot_focused.jpg" },
      { state: 'error', text: "「おいおい、高音域のスタミナ切れに気をつけろよ！」", image: "assets/mascot_error.jpg" },
      { state: 'relaxed', text: "「データ分析もいいけど、リラックスして喉を休めな」", image: "assets/mascot_relaxed.jpg" },
      { state: 'happy', text: "「自己ベスト更新ペースじゃないか！絶好調だね」", image: "assets/mascot_happy.jpg" }
    ]
  }
};

let mascotCurrentRoom = 'mylist';
let mascotCurrentDialogue = LIVING_MASCOT_ROOMS.mylist.dialogues[0];
let mascotMoveTimer = null;
let isBubbleOpen = true;

function initLivingMascot() {
  const roomKeys = Object.keys(LIVING_MASCOT_ROOMS);
  mascotCurrentRoom = roomKeys[Math.floor(Math.random() * roomKeys.length)];
  pickRandomDialogueForCurrentRoom();

  setRandomMascotPosition();

  if (mascotMoveTimer) clearInterval(mascotMoveTimer);
  mascotMoveTimer = setInterval(() => {
    strollOrMoveMascot();
  }, 55000);

  updateLivingMascotUI();
  setupMascotDragAndDrop();
}

function pickRandomDialogueForCurrentRoom() {
  const room = LIVING_MASCOT_ROOMS[mascotCurrentRoom];
  const list = room.dialogues;
  mascotCurrentDialogue = list[Math.floor(Math.random() * list.length)];
}

function strollOrMoveMascot() {
  const roomKeys = Object.keys(LIVING_MASCOT_ROOMS);
  if (Math.random() < 0.7) {
    const otherRooms = roomKeys.filter(k => k !== mascotCurrentRoom);
    mascotCurrentRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
  }
  pickRandomDialogueForCurrentRoom();
  isBubbleOpen = Math.random() > 0.35;
  shiftMascotPositionRandomly();
  updateLivingMascotUI();
}

function setRandomMascotPosition() {
  const widget = document.getElementById('livingMascotWidget');
  if (!widget) return;
  const maxX = window.innerWidth - 180;
  const maxY = window.innerHeight - 150;
  const rx = Math.max(20, Math.floor(Math.random() * maxX));
  const ry = Math.max(80, Math.floor(Math.random() * maxY));
  widget.style.left = rx + 'px';
  widget.style.top = ry + 'px';
  widget.style.bottom = 'auto';
  widget.style.right = 'auto';
}

function shiftMascotPositionRandomly() {
  const widget = document.getElementById('livingMascotWidget');
  if (!widget) return;
  const rect = widget.getBoundingClientRect();
  const dx = (Math.random() - 0.5) * 120;
  const dy = (Math.random() - 0.5) * 100;
  let newX = Math.max(15, Math.min(window.innerWidth - 160, rect.left + dx));
  let newY = Math.max(60, Math.min(window.innerHeight - 140, rect.top + dy));
  widget.style.left = newX + 'px';
  widget.style.top = newY + 'px';
}

function getCurrentActiveMainTab() {
  if (!document.getElementById('viewMyList').classList.contains('hidden')) return 'mylist';
  if (!document.getElementById('viewRecommend').classList.contains('hidden')) return 'recommend';
  if (!document.getElementById('viewRanking').classList.contains('hidden')) return 'ranking';
  if (!document.getElementById('viewAnalysis').classList.contains('hidden')) return 'analysis';
  return 'mylist';
}

function updateLivingMascotUI() {
  const widget = document.getElementById('livingMascotWidget');
  const bubble = document.getElementById('livingMascotBubble');
  const bubbleWrap = document.getElementById('mascotBubbleWrapper');
  const img = document.getElementById('livingMascotImage');
  const badge = document.getElementById('mascotRoomBadge');

  const activeTab = getCurrentActiveMainTab();
  const roomInfo = LIVING_MASCOT_ROOMS[mascotCurrentRoom];

  if (activeTab === mascotCurrentRoom) {
    if (widget) {
      widget.classList.remove('hidden');
      requestAnimationFrame(() => {
        widget.classList.remove('translate-y-2', 'opacity-0');
      });
    }
    if (bubble) bubble.textContent = mascotCurrentDialogue.text;
    if (img) img.src = mascotCurrentDialogue.image;
    if (badge) badge.textContent = roomInfo.name;

    if (bubbleWrap) {
      if (isBubbleOpen) {
        bubbleWrap.classList.remove('hidden', 'opacity-0');
      } else {
        bubbleWrap.classList.add('hidden');
      }
    }
  } else {
    if (widget) {
      widget.classList.add('translate-y-2', 'opacity-0');
      setTimeout(() => { widget.classList.add('hidden'); }, 300);
    }
  }
}

function setupMascotDragAndDrop() {
  const widget = document.getElementById('livingMascotWidget');
  if (!widget) return;

  let isDragging = false;
  let startX = 0, startY = 0;
  let initialX = 0, initialY = 0;

  function dragStart(e) {
    if (e.target.closest('button')) return;
    isDragging = true;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    startX = clientX;
    startY = clientY;
    const rect = widget.getBoundingClientRect();
    initialX = rect.left;
    initialY = rect.top;
    widget.style.bottom = 'auto';
    widget.style.right = 'auto';
    e.preventDefault();
  }

  function dragMove(e) {
    if (!isDragging) return;
    const clientX = e.touches ? e.touches[0].clientX : e.clientX;
    const clientY = e.touches ? e.touches[0].clientY : e.clientY;
    const dx = clientX - startX;
    const dy = clientY - startY;

    let newX = initialX + dx;
    let newY = initialY + dy;

    newX = Math.max(10, Math.min(window.innerWidth - widget.offsetWidth - 10, newX));
    newY = Math.max(50, Math.min(window.innerHeight - widget.offsetHeight - 10, newY));

    widget.style.left = newX + 'px';
    widget.style.top = newY + 'px';
  }

  function dragEnd() {
    if (!isDragging) return;
    isDragging = false;
  }

  const handle = document.getElementById('livingMascotHandle');
  if (handle) {
    handle.addEventListener('mousedown', dragStart);
    handle.addEventListener('touchstart', dragStart, { passive: false });
  }
  window.addEventListener('mousemove', dragMove);
  window.addEventListener('touchmove', dragMove, { passive: false });
  window.addEventListener('mouseup', dragEnd);
  window.addEventListener('touchend', dragEnd);

  handle.addEventListener('click', (e) => {
    if (isDragging) return;
    const room = LIVING_MASCOT_ROOMS[mascotCurrentRoom];
    const list = room.dialogues;
    let idx = list.findIndex(d => d.text === mascotCurrentDialogue.text);
    idx = (idx + 1) % list.length;
    mascotCurrentDialogue = list[idx];
    isBubbleOpen = true;
    updateLivingMascotUI();
    if (navigator.vibrate) navigator.vibrate(25);
  });
}

function toggleMascotSpeech(e) {
  if (e) e.stopPropagation();
  isBubbleOpen = !isBubbleOpen;
  const bubbleWrap = document.getElementById('mascotBubbleWrapper');
  if (bubbleWrap) {
    if (isBubbleOpen) {
      bubbleWrap.classList.remove('hidden');
    } else {
      bubbleWrap.classList.add('hidden');
    }
  }
}

function showMascotStatusModal() {
  const modal = document.getElementById('mascotStatusModal');
  const detail = document.getElementById('mascotModalDetailText');
  const roomInfo = LIVING_MASCOT_ROOMS[mascotCurrentRoom];
  if (detail) {
    detail.textContent = `現在、アプリ内の「${roomInfo.name}」の部屋で生活しています。\n(ドラッグして好きな場所に動かせます)`;
  }
  if (modal) modal.classList.remove('hidden');
  lockBodyScroll(true);
}

function closeMascotStatusModal() {
  const modal = document.getElementById('mascotStatusModal');
  if (modal) modal.classList.add('hidden');
  lockBodyScroll(false);
}

window.summonMascotToCurrentTab = function() {
  const activeTab = getCurrentActiveMainTab();
  mascotCurrentRoom = activeTab;
  pickRandomDialogueForCurrentRoom();
  isBubbleOpen = true;
  closeMascotStatusModal();
  updateLivingMascotUI();
  showMascotPopupNotification("ここにきたよ！");
};

function showMascotPopupNotification(msg) {
  const bubble = document.getElementById('livingMascotBubble');
  const bubbleWrap = document.getElementById('mascotBubbleWrapper');
  if (bubble && bubbleWrap) {
    const orig = bubble.textContent;
    bubble.textContent = `「${msg}」`;
    bubbleWrap.classList.remove('hidden');
    isBubbleOpen = true;
    setTimeout(() => { bubble.textContent = orig; }, 3000);
  }
}

const origSwitchMainTab = window.switchMainTab;
window.switchMainTab = function(tab) {
  if (typeof origSwitchMainTab === 'function') origSwitchMainTab(tab);
  setTimeout(updateLivingMascotUI, 50);
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initLivingMascot, 200);
});
