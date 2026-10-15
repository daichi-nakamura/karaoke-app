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

let isDemoMode = localStorage.getItem('ohako_is_demo_mode') === 'true';

let currentMoodFlow = [];
let activeMoodAttrs = new Set();
let summaryCandidateSongs = [];

window.isUserSorting = false;
let renderedSongOrderIds = [];

const ARTIST_RELATIONS = {
  'king gnu': ['Official髭男dism', 'Vaundy', '米津玄師', '藤井風'],
  '寺尾 聰': ['大滝詠一', '山下達郎', '稲垣潤一', '井上陽水'],
  'b\'z': ['WANDS', 'T-BOLAN', 'ZARD', 'L\'Arc~en~Ciel'],
  'ポルノグラフィティ': ['L\'Arc~en~Ciel', 'BUMP OF CHICKEN', 'FLOW', 'ロードオブメジャー'],
  'asian kung-fu generation': ['ELLEGARDEN', 'ストレイテナー', 'BUMP OF CHICKEN', 'RADWIMPS'],
  '椎名林檎': ['東京事変', '宇多田ヒカル', 'Cocco', '矢井田瞳'],
  'mr.children': ['スピッツ', 'コブクロ', 'ゆず', 'サザンオールスターズ']
};

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
  return (str || '').replace(/[&<>\"']/g, m => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[m]);
}

function lockBodyScroll(lock) {
  if (lock) {
    document.body.classList.add('overflow-hidden');
  } else {
    document.body.classList.remove('overflow-hidden');
  }
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
    }
  ];
  localStorage.setItem('ohako_demo_songs', JSON.stringify(window.songs));
}

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
};

window.render = function() {
  const listContainer = document.getElementById('songList');
  const countEl = document.getElementById('songCount');
  const songs = window.songs || [];
  if (countEl) countEl.textContent = `登録曲: ${songs.length}曲`;
  if (!listContainer) return;
  if (songs.length === 0) {
    listContainer.innerHTML = '<div class="text-center text-slate-500 py-12 text-sm">曲がありません。</div>';
    return;
  }
  listContainer.innerHTML = songs.map(s => `
    <div class="bg-slate-900/90 border border-slate-800 p-3 rounded-2xl flex items-center justify-between">
      <div>
        <div class="font-bold text-sm text-white">${escapeHtml(s.title)}</div>
        <div class="text-xs text-slate-400">${escapeHtml(s.artist || '歌手未設定')}</div>
      </div>
    </div>
  `).join('');
};

window.addEventListener('DOMContentLoaded', () => {
  loadLocalDemoSongs();
  render();
});
