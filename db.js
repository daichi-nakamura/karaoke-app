// db.js
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.9.0/firebase-app.js";
import { 
  getFirestore, 
  collection, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc, 
  onSnapshot, 
  query, 
  orderBy 
} from "https://www.gstatic.com/firebasejs/10.9.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

function showStatus(msg, isError = false) {
  const banner = document.getElementById('statusBanner');
  if (!banner) return;
  banner.textContent = msg;
  banner.className = isError 
    ? "text-xs p-2.5 rounded-xl border bg-rose-950/80 border-rose-800 text-rose-300 block mb-3"
    : "text-xs p-2.5 rounded-xl border bg-slate-900 border-slate-800 text-slate-300 block mb-3";
}

try {
  if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "YOUR_API_KEY" || !firebaseConfig.projectId) {
    showStatus("⚠️ firebase-config.js にFirebase設定が未入力です。", true);
    const countEl = document.getElementById('songCount');
    if (countEl) countEl.textContent = "Firebase設定待ち";
  } else {
    const app = initializeApp(firebaseConfig);
    const db = getFirestore(app);
    window.db = db;
    window.firestoreOps = { collection, addDoc, updateDoc, deleteDoc, doc, onSnapshot, query, orderBy };
    
    const q = query(collection(db, "songs"), orderBy("createdAt", "desc"));
    onSnapshot(q, (snapshot) => {
      window.songs = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      const banner = document.getElementById('statusBanner');
      if (banner) banner.classList.add('hidden');

      if (typeof window.render === 'function') {
        window.render();
      }
      if (typeof window.renderSetlist === 'function') {
        window.renderSetlist();
      }

      // app.jsに通知
      window.dispatchEvent(new CustomEvent('firestoreDataLoaded'));
    }, (err) => {
      console.error("Firestore Error:", err);
      showStatus("⚠️ Firestore通信エラー: " + err.message, true);
      const countEl = document.getElementById('songCount');
      if (countEl) countEl.textContent = "通信エラー";
    });
  }
} catch (e) {
  console.error("Init Error:", e);
  showStatus("⚠️ 初期化エラー: " + e.message, true);
}
