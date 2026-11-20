/* =====================================================
보드판 포스트잇 (whiteboard.js)
   - Supabase DB 저장 (없으면 localStorage 폴백)
   보드판 클릭 → 보기 모드 (기본)
   - "메모 남기기" → 쓰기 모드
   ===================================================== */

const POSTIT_TEXTS = [
  "지나가다 들렸어요",
  "창밖 풍경이 예뻤어요",
  "또 타고 싶어요!",
  "느린 여행, 좋았어요",
  "기차 안이 아늑해요",
];

const POSTIT_EMOJIS = [
  "🌸",
  "☀️",
  "🌿",
  "⭐",
  "🍀",
  "🌙",
  "🎵",
  "❤️",
  "✨",
  "🌊",
];
const POSTIT_COLORS = ["#fffde7", "#fce4ec", "#e8f5e9", "#e3f2fd", "#f3e5f5"];
const POSTIT_FALLBACK_KEY = "slow_train_postits";
const POSTIT_MAX = 50;

// ── Supabase 클라이언트 ──
let _sb = null;
function _getSb() {
  if (_sb) return _sb;
  if (!window.SUPABASE_URL || !window.SUPABASE_KEY) return null;
  if (typeof supabase === "undefined") return null;
  _sb = supabase.createClient(window.SUPABASE_URL, window.SUPABASE_KEY);
  return _sb;
}

// ── 데이터 로드/저장 (Supabase 우선, localStorage 폴백) ──
async function _fetchPostits() {
  const sb = _getSb();
  if (sb) {
    const { data, error } = await sb
      .from("whiteboard_postits")
      .select("id, text, emoji, date, color")
      .order("created_at", { ascending: true })
      .limit(POSTIT_MAX);
    if (!error && data) return data;
    console.warn("[Whiteboard] Supabase 로드 실패, 로컬 사용:", error?.message);
  }
  try {
    return JSON.parse(localStorage.getItem(POSTIT_FALLBACK_KEY)) || [];
  } catch {
    return [];
  }
}

async function _insertPostit(post) {
  const sb = _getSb();
  if (sb) {
    const { error } = await sb.from("whiteboard_postits").insert({
      text: post.text,
      emoji: post.emoji,
      date: post.date,
      color: post.color,
    });
    if (error)
      console.warn(
        "[Whiteboard] Supabase 저장 실패, 로컬 사용:",
        error?.message,
      );
    else return _fetchPostits(); // 저장 성공 → 최신 목록 반환
  }
  // 로컬 폴백
  const posts = JSON.parse(localStorage.getItem(POSTIT_FALLBACK_KEY) || "[]");
  posts.push(post);
  if (posts.length > POSTIT_MAX) posts.shift();
  localStorage.setItem(POSTIT_FALLBACK_KEY, JSON.stringify(posts));
  return posts;
}

function _todayStr() {
  const d = new Date();
  return `${d.getFullYear()}.${String(d.getMonth() + 1).padStart(2, "0")}.${String(d.getDate()).padStart(2, "0")}`;
}

// ── 현재 선택 상태 ──
let _selText = null;
let _selEmoji = null;

// ── 팝업 열기 — 기본: 보기 모드 ──
function openWhiteboardModal() {
  _selText = null;
  _selEmoji = null;
  _renderViewMode();
  $("whiteboardModal").hidden = false;
}

function closeWhiteboardModal() {
  $("whiteboardModal").hidden = true;
}

// ── 보기 모드 ──
async function _renderViewMode() {
  const body = $("wbBody");
  body.innerHTML = '<div class="wb-loading">불러오는 중…</div>';

  const posts = await _fetchPostits();

  body.innerHTML = "";

  // 타이틀
  const titleRow = document.createElement("div");
  titleRow.className = "wb-title-row";
  titleRow.innerHTML = '<span class="wb-title">보드판</span>';
  body.appendChild(titleRow);

  // 목록
  const list = document.createElement("div");
  list.className = "wb-list";

  if (posts.length === 0) {
    list.innerHTML =
      '<div class="wb-empty">아직 메모가 없어요<br>첫 번째로 남겨보세요! 🌸</div>';
  } else {
    posts
      .slice()
      .reverse()
      .forEach((p) => {
        const item = document.createElement("div");
        item.className = "wb-list-item";
        const c = p.color || "#fffde7";
        item.style.borderLeftColor = c;
        item.style.background = c + "55";
        item.innerHTML = `
        <span class="wb-li-emoji">${p.emoji || "📝"}</span>
        <span class="wb-li-text">${p.text}</span>
        <span class="wb-li-date">${p.date}</span>
      `;
        list.appendChild(item);
      });
  }
  body.appendChild(list);

  // 버튼
  const row = document.createElement("div");
  row.className = "wb-btn-row";
  const writeBtn = document.createElement("button");
  writeBtn.className = "wb-btn-main";
  writeBtn.textContent = "메모 남기기";
  writeBtn.onclick = _renderWriteMode;
  row.appendChild(writeBtn);
  const closeBtn = document.createElement("button");
  closeBtn.className = "wb-btn-sub";
  closeBtn.textContent = "닫기";
  closeBtn.onclick = closeWhiteboardModal;
  row.appendChild(closeBtn);
  body.appendChild(row);
}

// ── 쓰기 모드 ──
function _renderWriteMode() {
  const body = $("wbBody");
  body.innerHTML = "";
  _selText = null;
  _selEmoji = null;

  // 헤더
  const header = document.createElement("div");
  header.className = "wb-write-header";
  header.innerHTML = `<span class="wb-title">✏️ 메모 남기기</span><span class="wb-date">${_todayStr()}</span>`;
  body.appendChild(header);

  // 문구 선택
  const tSec = document.createElement("div");
  tSec.className = "wb-section";
  tSec.innerHTML = '<div class="wb-label">문구 선택</div>';
  POSTIT_TEXTS.forEach((t) => {
    const b = document.createElement("button");
    b.className = "wb-text-btn";
    b.textContent = t;
    b.onclick = () => {
      _selText = t;
      body
        .querySelectorAll(".wb-text-btn")
        .forEach((el) => el.classList.remove("on"));
      b.classList.add("on");
      _updatePreview();
    };
    tSec.appendChild(b);
  });
  body.appendChild(tSec);

  // 이모티콘 선택
  const eSec = document.createElement("div");
  eSec.className = "wb-section";
  eSec.innerHTML = '<div class="wb-label">이모티콘</div>';
  const eRow = document.createElement("div");
  eRow.className = "wb-emoji-row";
  POSTIT_EMOJIS.forEach((em) => {
    const b = document.createElement("button");
    b.className = "wb-emoji-btn";
    b.textContent = em;
    b.onclick = () => {
      _selEmoji = em;
      body
        .querySelectorAll(".wb-emoji-btn")
        .forEach((el) => el.classList.remove("on"));
      b.classList.add("on");
      _updatePreview();
    };
    eRow.appendChild(b);
  });
  eSec.appendChild(eRow);
  body.appendChild(eSec);

  // 미리보기
  const preview = document.createElement("div");
  preview.id = "wbPreview";
  preview.className = "wb-preview";
  preview.innerHTML =
    '<span class="wb-preview-hint">문구를 선택하면 미리보기가 나타나요</span>';
  body.appendChild(preview);

  // 버튼
  const row = document.createElement("div");
  row.className = "wb-btn-row";
  const submitBtn = document.createElement("button");
  submitBtn.id = "wbSubmit";
  submitBtn.className = "wb-btn-main";
  submitBtn.textContent = "📌 붙이기";
  submitBtn.disabled = true;
  submitBtn.onclick = _submitPostit;
  row.appendChild(submitBtn);
  const cancelBtn = document.createElement("button");
  cancelBtn.className = "wb-btn-sub";
  cancelBtn.textContent = "취소";
  cancelBtn.onclick = _renderViewMode;
  row.appendChild(cancelBtn);
  body.appendChild(row);
}

function _updatePreview() {
  const p = document.getElementById("wbPreview");
  if (!p) return;
  const sb = document.getElementById("wbSubmit");
  if (!_selText) {
    p.innerHTML =
      '<span class="wb-preview-hint">문구를 선택하면 미리보기가 나타나요</span>';
    if (sb) sb.disabled = true;
    return;
  }
  // 현재 로컬 개수 기준으로 색상 결정 (비동기 없이 간단하게)
  const localCount = (() => {
    try {
      return (JSON.parse(localStorage.getItem(POSTIT_FALLBACK_KEY)) || [])
        .length;
    } catch {
      return 0;
    }
  })();
  const color = POSTIT_COLORS[localCount % POSTIT_COLORS.length];
  p.innerHTML = `
    <div class="wb-postit-preview" style="background:${color}">
      <div class="wb-pi-emoji">${_selEmoji || ""}</div>
      <div class="wb-pi-text">${_selText}</div>
      <div class="wb-pi-date">${_todayStr()}</div>
    </div>
  `;
  if (sb) sb.disabled = false;
}

async function _submitPostit() {
  if (!_selText) return;
  const sb = document.getElementById("wbSubmit");
  if (sb) {
    sb.disabled = true;
    sb.textContent = "저장 중…";
  }

  const localCount = (() => {
    try {
      return (JSON.parse(localStorage.getItem(POSTIT_FALLBACK_KEY)) || [])
        .length;
    } catch {
      return 0;
    }
  })();

  const newPost = {
    text: _selText,
    emoji: _selEmoji || "",
    date: _todayStr(),
    color: POSTIT_COLORS[localCount % POSTIT_COLORS.length],
  };

  const updated = await _insertPostit(newPost);
  updateWhiteboardTex(updated);
  toast("메모가 보드에 붙었어요! 📌");
  closeWhiteboardModal();
}

// ── 게임 시작 초기화 ──
async function initWhiteboard() {
  const posts = await _fetchPostits();
  if (posts.length > 0) updateWhiteboardTex(posts);
}
