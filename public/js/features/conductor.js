/* =====================================================
   9. 역무원 표 검사 (conductor.js)
   흐름: 등장 → 통로 이동 → 플레이어와 같은 라인에서 멈춰 검표 팝업
         → 좌석 상태별 반응 분기 → 계속 이동
   임의 규칙: 숨어 있는(hide) 플레이어는 검표하지 않음

   좌석 상태별 반응 (getPlayerSeatState 참고):
     own_seat   → 정상 통과 + 가끔 인사 대사
     other_seat → 지정석 번호 안내 + 자리 안내 선택 모달
     free_seat  → 정상 통과
     standing   → 지정석 번호 안내 + 자리 찾기 화살표 자동 표시
     free_rider → 기존 강제 퇴장 흐름 유지
   ===================================================== */

const INSPECT_GAP = 60; // 승무원이 다시 등장하는 간격(초)

// 검표 성공 후 가끔 사용하는 따뜻한 인사 대사 (쿨다운 적용)
const CONDUCTOR_GREETINGS = [
  '오늘은 창밖 풍경이 참 좋네요.',
  '느린 기차에서는 서두르지 않으셔도 됩니다.',
  '편안한 여행 되시길 바랍니다.',
];
let _lastGreetedAt = -Infinity; // 마지막 인사 시각 (ms) — 90초 쿨다운

// 승무원 생성(모자 쓴 파란 제복). 처음엔 숨겨 두고 conductorTick이 등장시킴(입장 약 25초 뒤)
function makeConductor() {
  C = mkActor('conductor', '승무원', { npc: true, label: '승무원', shirt: 0x1c3a6b, hair: 0x222222, skin: 0xf1c79e, pants: 0x1c1c2a, cap: true });
  C.g.visible = false; C.active = false; C.timer = 25; C.dir = -1; C.speed = 0.9; C.mode = 'walk'; C.pause = 0;
}

// 승무원 스케줄(매 프레임): 등장 → 이동 → 같은 라인에서 멈춰 검표 → 계속 이동 → 퇴장
function conductorTick(dt) {
  if (!C.active) {
    if ((C.timer -= dt) > 0) return;
    C.active = true; C.g.visible = true; C.g.position.set(-C.dir * 7.7, 0, 0); C.path = [{ x: C.dir * 7.7, z: 0 }];
    C.checked = false; C.mode = 'walk'; C.pause = 0; speak(C, '승차권 검사 시간입니다~', 4); return;
  }
  if (C.mode === 'popup') { animate(C, false, dt); return; }
  if (C.pause > 0) { C.pause -= dt; animate(C, false, dt); if (C.pause <= 0 && C.mode === 'ask') { C.mode = 'popup'; openTicket(); } return; }
  const m = stepPath(C, dt); animate(C, m, dt);
  if (!C.checked && !GameState.kick && P.state !== 'hide' && Math.abs(C.g.position.x - P.g.position.x) < 0.9) {
    C.checked = true; C.mode = 'ask'; C.pause = 1.5; GameState.inspecting = true; P.path = []; cancelRes(P);
    Object.keys(keys).forEach(k => keys[k] = false); speak(C, '표 검사하겠습니다.', 3); return;
  }
  if (!C.path.length) { C.active = false; C.g.visible = false; C.timer = INSPECT_GAP; C.dir *= -1; }
}

// ----- 좌석 상태 판별 -----

// 플레이어의 현재 좌석 상태를 반환
// own_seat: 본인 지정석 착석 / other_seat: 타인 지정석 임시 착석
// free_seat: 자유석 착석   / standing: 통로 대기  / free_rider: 무임승차
function getPlayerSeatState() {
  if (!GameState.hasTicket) return 'free_rider';
  if (P.state !== 'sit' || !P.seat) return 'standing';
  if (P.seat.seatType === 'free') return 'free_seat';
  if (GameState.ticket && P.seat.id === GameState.ticket.seatId) return 'own_seat';
  return 'other_seat'; // 타인 지정석에 임시 착석 중
}

// ----- 표 검사 팝업 -----

// 표 검사 팝업 열기: 가진 표 목록(무임승차면 비어 있음) + 현재 좌석 상태 힌트
function openTicket() {
  const list = $('tkList'); list.innerHTML = ''; $('tkShow').disabled = true;
  if (!GameState.hasTicket) {
    list.innerHTML = '<p>가지고 있는 표가 없어요.</p>';
  } else {
    const seatText = GameState.ticket ? ` · ${GameState.ticket.displayNum}번 지정석` : '';
    const label = `🎫 승차권 · 서울 → 부산 · ${GameState.carId}호차${seatText} (가상)`;
    const b = document.createElement('button'); b.className = 'tk'; b.textContent = label;
    b.onclick = () => { b.classList.toggle('on'); $('tkShow').disabled = !b.classList.contains('on'); };
    list.appendChild(b);
    // 타인 지정석 임시 착석 중이면 작은 힌트 표시
    if (getPlayerSeatState() === 'other_seat') {
      const hint = document.createElement('p');
      hint.style.cssText = 'font-size:12px;color:var(--sub);margin:6px 0 0;';
      hint.textContent = '(현재 다른 승객의 지정석에 착석 중)';
      list.appendChild(hint);
    }
  }
  $('tkModal').hidden = false;
}

// '보여주기': 좌석 상태별 반응 분기 후 승무원 계속 이동
function showTicket() {
  $('tkModal').hidden = true;
  GameState.inspecting = false;
  C.mode = 'walk'; C.pause = 1.5;

  const state = getPlayerSeatState();

  if (state === 'own_seat') {
    // 정상 통과 + 가끔 따뜻한 인사 대사
    speak(C, '확인했습니다. 편안한 여행 되세요!', 4);
    _maybeGreet();

  } else if (state === 'other_seat') {
    // 지정석 안내: 승무원이 약 4초 머물다 자연스럽게 이동 (강제 아님)
    // 1.6초 뒤 선택 모달 표시 → 승무원은 잠시 기다렸다 간다는 뉘앙스
    C.pause = 4;
    const n = GameState.ticket ? GameState.ticket.displayNum : '?';
    speak(C, `지정석은 ${n}번입니다. 안내해 드릴까요?`, 5);
    setTimeout(() => {
      if (!GameState.ended && P.state === 'sit') {
        $('seatGuideNum').textContent = `${n}번`;
        $('seatGuideModal').hidden = false;
      }
    }, 1600);

  } else if (state === 'free_seat') {
    // 자유석은 그냥 통과
    speak(C, '확인했습니다. 좋은 여행 되세요!', 4);

  } else if (state === 'standing') {
    // 통로 대기: 지정석 번호 안내 + 화살표 자동 표시
    if (GameState.ticket) {
      speak(C, `${GameState.ticket.displayNum}번 지정석으로 안내해 드릴게요.`, 4);
      setTimeout(() => { if (!GameState.ended) highlightMySeat(); }, 1500);
    } else {
      speak(C, '확인했습니다. 좋은 여행 되세요!', 4);
    }

  } else {
    speak(C, '확인했습니다. 좋은 여행 되세요!', 4);
  }
}

// 가끔(45% 확률, 90초 쿨다운) 짧은 인사 대사 추가 (own_seat 정상 통과 시)
function _maybeGreet() {
  const now = performance.now();
  if (now - _lastGreetedAt < 90000) return;
  if (Math.random() > 0.45) return;
  _lastGreetedAt = now;
  setTimeout(() => { if (!GameState.ended) speak(C, pick(CONDUCTOR_GREETINGS), 4); }, 2800);
}

// ----- 지정석 안내 모달 처리 -----

// '자리 안내받기': 내 자리 찾기 화살표 표시 + 안내 토스트
function acceptSeatGuide() {
  $('seatGuideModal').hidden = true;
  highlightMySeat(); // ticket.js — 지정석 위 5초 화살표
  if (GameState.ticket) toast(`${GameState.ticket.displayNum}번 지정석으로 안내해 드릴게요.`);
}

// '괜찮습니다': 모달 닫기만
function declineSeatGuide() {
  $('seatGuideModal').hidden = true;
}

// ----- 무임승차 처리 -----

// '표 없음': 승무원 안내 말풍선 + 5초 카운트다운 → 강제 퇴장
function noTicket() {
  $('tkModal').hidden = true; speak(C, '승차권이 없으시군요. 5초 후 하차 조치됩니다.', 5);
  C.mode = 'walk'; C.pause = 8; GameState.kick = { t: 5 }; $('kickN').textContent = '5'; $('kick').hidden = false;
}

// 매 프레임: 강제 퇴장 카운트다운 표시, 0이 되면 접속 종료
function kickTick(dt) {
  if (!GameState.kick) return;
  GameState.kick.t -= dt; $('kickN').textContent = Math.max(1, Math.ceil(GameState.kick.t));
  if (GameState.kick.t <= 0) endGame();
}

// 접속 종료: 렌더/소리를 멈추고 종료 화면 표시(버튼으로 처음 화면 복귀)
function endGame() {
  GameState.ticket = null;
  clearSeatArrow();
  saveNow();
  GameState.ended = true; GameState.kick = null; $('kick').hidden = true;
  clearInterval(RailSound.timer); if (RailSound.master) RailSound.master.gain.value = 0; if (RailSound.audio) RailSound.audio.pause();
  $('endScr').hidden = false;
}
