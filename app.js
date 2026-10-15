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
// 🐦 究極の「生体感」相棒・自律移動型マスコットシステム (完全版)
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
let mascotIdleTimer = null;
let isBubbleOpen = true;
let mascotTapCount = 0;
let isMascotSleeping = false;
let lastInteractionTime = Date.now();

function initLivingMascot() {
  const roomKeys = Object.keys(LIVING_MASCOT_ROOMS);
  mascotCurrentRoom = roomKeys[Math.floor(Math.random() * roomKeys.length)];
  pickRandomDialogueForCurrentRoom();
  setRandomMascotPosition();

  // 定期移動＆散歩 (45秒ごと)
  if (mascotMoveTimer) clearInterval(mascotMoveTimer);
  mascotMoveTimer = setInterval(() => {
    if (!isMascotSleeping) {
      strollOrMoveMascot();
    }
  }, 45000);

  // アイドル・居眠りチェック (10秒ごと)
  if (mascotIdleTimer) clearInterval(mascotIdleTimer);
  mascotIdleTimer = setInterval(() => {
    const idleDuration = Date.now() - lastInteractionTime;
    if (idleDuration > 30000 && !isMascotSleeping) {
      goToSleep();
    }
  }, 10000);

  updateLivingMascotUI();
  setupMascotDragAndDrop();
  setupMascotReactivityHooks();
}

function pickRandomDialogueForCurrentRoom() {
  const room = LIVING_MASCOT_ROOMS[mascotCurrentRoom];
  const list = room.dialogues;
  mascotCurrentDialogue = list[Math.floor(Math.random() * list.length)];
}

function strollOrMoveMascot() {
  const roomKeys = Object.keys(LIVING_MASCOT_ROOMS);
  if (Math.random() < 0.65) {
    const otherRooms = roomKeys.filter(k => k !== mascotCurrentRoom);
    mascotCurrentRoom = otherRooms[Math.floor(Math.random() * otherRooms.length)];
  }
  pickRandomDialogueForCurrentRoom();
  isBubbleOpen = Math.random() > 0.3;
  shiftMascotPositionSmoothly();
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

function shiftMascotPositionSmoothly() {
  const widget = document.getElementById('livingMascotWidget');
  if (!widget) return;
  const rect = widget.getBoundingClientRect();
  const dx = (Math.random() - 0.5) * 100;
  const dy = (Math.random() - 0.5) * 80;
  let newX = Math.max(15, Math.min(window.innerWidth - 160, rect.left + dx));
  let newY = Math.max(60, Math.min(window.innerHeight - 140, rect.top + dy));
  
  widget.style.transition = 'left 0.8s ease, top 0.8s ease';
  widget.style.left = newX + 'px';
  widget.style.top = newY + 'px';
  setTimeout(() => {
    widget.style.transition = 'transform 0.1s ease';
  }, 800);
}

function goToSleep() {
  isMascotSleeping = true;
  mascotCurrentDialogue = { state: 'sleep', text: "「スーー…すーー…（ZZZ）」", image: "assets/mascot_relaxed.jpg" };
  isBubbleOpen = true;
  updateLivingMascotUI();
}

function wakeUp() {
  if (!isMascotSleeping) return;
  isMascotSleeping = false;
  lastInteractionTime = Date.now();
  pickRandomDialogueForCurrentRoom();
  isBubbleOpen = true;
  updateLivingMascotUI();
  showMascotPopupNotification("はっ！起きたよ！");
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
    if (badge) badge.textContent = isMascotSleeping ? "就寝中" : roomInfo.name;

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
    lastInteractionTime = Date.now();
    if (isMascotSleeping) { wakeUp(); return; }

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

  // タップ＆連打リアクション
  handle.addEventListener('click', (e) => {
    if (isDragging) return;
    lastInteractionTime = Date.now();

    if (isMascotSleeping) {
      wakeUp();
      return;
    }

    mascotTapCount++;
    if (mascotTapCount >= 4) {
      mascotTapCount = 0;
      mascotCurrentDialogue = { state: 'angry', text: "「ちょっと！羽毛が乱れるでしょ！暇なら新曲登録しなよ！」", image: "assets/mascot_focused.jpg" };
    } else if (mascotTapCount === 3) {
      mascotCurrentDialogue = { state: 'happy', text: "「なでてくれてるの？…ありがとっ♪」", image: "assets/mascot_happy.jpg" };
    } else {
      const room = LIVING_MASCOT_ROOMS[mascotCurrentRoom];
      const list = room.dialogues;
      let idx = list.findIndex(d => d.text === mascotCurrentDialogue.text);
      idx = (idx + 1) % list.length;
      mascotCurrentDialogue = list[idx];
    }

    isBubbleOpen = true;
    updateLivingMascotUI();
    if (navigator.vibrate) navigator.vibrate(30);
  });
}

// アプリの検索やオーディオ再生イベントにリアルタイム連動するフック
function setupMascotReactivityHooks() {
  const searchInput = document.getElementById('searchInput');
  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      lastInteractionTime = Date.now();
      if (isMascotSleeping) wakeUp();
      const val = e.target.value.trim();
      if (val.length > 0 && Math.random() < 0.4) {
        showMascotPopupNotification(`「${val}」を探してるんだね？任せて！`);
      }
    });
  }
}

// 試聴オーディオ再生時のリアルタイム連動拡張
const origTogglePlayPreview = window.togglePlayPreview;
window.togglePlayPreview = async function(url, id, trackName, artistName, trackId) {
  lastInteractionTime = Date.now();
  if (isMascotSleeping) wakeUp();
  if (trackName) {
    showMascotPopupNotification(`♪ おっ、『${trackName}』の試聴だね！ノリノリで行こう！`);
  }
  if (typeof origTogglePlayPreview === 'function') {
    await origTogglePlayPreview(url, id, trackName, artistName, trackId);
  }
};

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

function showMascotPopupNotification(msg) {
  const bubble = document.getElementById('livingMascotBubble');
  const bubbleWrap = document.getElementById('mascotBubbleWrapper');
  if (bubble && bubbleWrap) {
    const orig = bubble.textContent;
    bubble.textContent = `「${msg}」`;
    bubbleWrap.classList.remove('hidden');
    isBubbleOpen = true;
    setTimeout(() => { bubble.textContent = orig; }, 3500);
  }
}

const origSwitchMainTab = window.switchMainTab;
window.switchMainTab = function(tab) {
  lastInteractionTime = Date.now();
  if (isMascotSleeping) wakeUp();
  if (typeof origSwitchMainTab === 'function') origSwitchMainTab(tab);
  setTimeout(updateLivingMascotUI, 50);
};

window.addEventListener('DOMContentLoaded', () => {
  setTimeout(initLivingMascot, 300);
});
