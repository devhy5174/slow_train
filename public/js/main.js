/* =====================================================
   14. 진입점 (main.js)
   시작 화면(닉네임/입장 방식)에서 게임으로 넘어가는 부분입니다.
   ===================================================== */

let saved = null, settings = null; // 저장소에서 불러온 프로필 / 사운드 설정

// 입력 없이 탑승할 때 부여되는 기차 테마 랜덤 닉네임
const RANDOM_NAMES = [
  '창가손님', '졸린여행자', '도시락손님', '느린승객', '차창구경꾼',
  '첫차손님', '막차손님', '풍경수집가', '꾸벅꾸벅', '이어폰러버',
  '멍때리기장인', '느릿느릿', '종점까지', '기차애호가', '단거한봉지',
  '창밖멍', '낮잠여행자', '커피한잔', '도착역모름', '차창시인',
  '간식탐험가', '차창화가', '통로서성이', '짐칸구경꾼', '기적소리팬',
  '철로낭만파', '역이름암기왕', '선로지킴이', '기차도시락', '창문닦개',
  '승차권수집가', '철도여행가',
];

// 저장된 닉네임이 있으면 그걸로, 없으면 랜덤 닉네임을 입력칸에 미리 채움
const _randomNick = RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
$('nick').value = _randomNick;
Repo.loadProfile().then(p => { saved = p; if (p && p.nickname) $('nick').value = p.nickname; });
// 저장된 사운드 설정(음소거/볼륨) 불러오기
Repo.loadSettings().then(v => { settings = v; });

// 입장 폼 제출: 입장 방식 확인 → 화면 전환 → HUD 문구 → 사운드 설정 → 게임 시작
$('form').addEventListener('submit', e => {
  e.preventDefault();
  GameState.hasTicket = !(e.submitter && e.submitter.dataset.mode === 'free'); // 입장 방식: 승차권 구매 / 무임승차
  GameState.carId = 1; // 현재 단일 객차; 향후 Supabase 방 배정 결과로 교체
  const name = $('nick').value.trim() || RANDOM_NAMES[Math.floor(Math.random() * RANDOM_NAMES.length)];
  $('start').style.display = 'none';
  $('game').style.display = 'block';
  $('hn').textContent = name;
  $('hc').textContent = `실제 승객 1/32명 · ${GameState.hasTicket ? '🎫 승차권 있음' : '🎫 승차권 없음'}`;

  // 로딩 화면 표시 → 5초 후 페이드 아웃, 완료 시 승차권 팝업
  showLoadingScreen(() => { if (GameState.hasTicket) showMyTicket(); });

  Object.assign(RailSound, { muted: !!(settings && settings.muted), volume: settings && typeof settings.volume === 'number' ? settings.volume : 0.35 });
  build(saved); RailSound.start(); // 입장 버튼 클릭 직후 시작(브라우저 자동재생 정책)
  Multi.connect(name, GameState.carId); // Supabase Realtime 멀티플레이 연결
});
