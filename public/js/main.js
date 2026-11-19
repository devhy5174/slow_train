/* =====================================================
   14. 진입점 (main.js)
   시작 화면(닉네임/입장 방식)에서 게임으로 넘어가는 부분입니다.
   ===================================================== */

let saved = null, settings = null; // 저장소에서 불러온 프로필 / 사운드 설정

// 저장된 닉네임이 있으면 입력칸에 미리 채움
Repo.loadProfile().then(p => { saved = p; if (p && p.nickname) $('nick').value = p.nickname; });
// 저장된 사운드 설정(음소거/볼륨) 불러오기
Repo.loadSettings().then(v => { settings = v; });

// 입장 폼 제출: 입장 방식 확인 → 화면 전환 → HUD 문구 → 사운드 설정 → 게임 시작
$('form').addEventListener('submit', e => {
  e.preventDefault();
  GameState.hasTicket = !(e.submitter && e.submitter.dataset.mode === 'free'); // 입장 방식: 승차권 구매 / 무임승차
  GameState.carId = 1; // 현재 단일 객차; 향후 Supabase 방 배정 결과로 교체
  const name = $('nick').value.trim() || '승객';
  $('start').style.display = 'none';
  $('game').style.display = 'block';
  $('hn').textContent = name;
  $('hc').textContent = `승객 ${1 + NPC_DEFS.length}명 (베타 승객 ${NPC_DEFS.length}명 포함) · ${GameState.hasTicket ? '🎫 승차권 있음' : '🎫 승차권 없음(무임승차)'}`;
  Object.assign(RailSound, { muted: !!(settings && settings.muted), volume: settings && typeof settings.volume === 'number' ? settings.volume : 0.35 });
  build(saved); RailSound.start(); // 입장 버튼 클릭 직후 시작(브라우저 자동재생 정책)
  // Multi.connect(name, GameState.carId); // Supabase Realtime 멀티플레이 연결 (임시 비활성화)
  if (GameState.hasTicket) showMyTicket(); // 승차권 구매자에게 지정석 안내 팝업
});
