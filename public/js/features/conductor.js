/* =====================================================
   9. 승무원 표 검사 (conductor.js)
   흐름: 등장 → 통로 이동 → 플레이어와 같은 라인에서 멈춰 검표 팝업
         → [보여주기] 인사 후 계속 이동 / [표 없음] 5초 카운트다운 후 강제 퇴장
   임의 규칙: 숨어 있는(hide) 플레이어는 검표하지 않음
   ===================================================== */

const INSPECT_GAP = 60; // 승무원이 다시 등장하는 간격(초)
const TICKET = { label: '🎫 승차권 · 서울 → 부산 · 3호차 (가상)' }; // 가상 승차권(결제 없음)

// 승무원 생성(모자 쓴 파란 제복). 처음엔 숨겨 두고 conductorTick이 등장시킴(입장 약 25초 뒤)
function makeConductor() {
  C = mkActor('conductor', '승무원', { npc: true, label: '승무원', shirt: 0x1c3a6b, hair: 0x222222, skin: 0xf1c79e, pants: 0x1c1c2a, cap: true });
  C.g.visible = false; C.active = false; C.timer = 25; C.dir = -1; C.speed = 0.9; C.mode = 'walk'; C.pause = 0;
}

// 승무원 스케줄(매 프레임): 등장 → 통로 이동 → 같은 라인에서 멈춰 검표 → 인사하고 계속 이동 → 퇴장 → 일정 시간 뒤 반대편에서 재등장
function conductorTick(dt) {
  // 아직 등장 전: 대기 시간이 끝나면 한쪽 문에서 등장
  if (!C.active) {
    if ((C.timer -= dt) > 0) return;
    C.active = true; C.g.visible = true; C.g.position.set(-C.dir * 7.7, 0, 0); C.path = [{ x: C.dir * 7.7, z: 0 }];
    C.checked = false; C.mode = 'walk'; C.pause = 0; speak(C, '승차권 검사 시간입니다~', 4); return;
  }
  if (C.mode === 'popup') { animate(C, false, dt); return; } // 표 팝업 대기 중에는 멈춰 있음
  // 잠깐 멈춤(검표 직전/인사 중): 끝나면 검표 팝업 열기
  if (C.pause > 0) { C.pause -= dt; animate(C, false, dt); if (C.pause <= 0 && C.mode === 'ask') { C.mode = 'popup'; openTicket(); } return; }
  const m = stepPath(C, dt); animate(C, m, dt);
  // 플레이어와 같은 라인(x)에서 만나면 검표 시작(숨어 있거나 이미 퇴장 카운트 중이면 건너뜀)
  if (!C.checked && !GameState.kick && P.state !== 'hide' && Math.abs(C.g.position.x - P.g.position.x) < 0.9) {
    C.checked = true; C.mode = 'ask'; C.pause = 1.5; GameState.inspecting = true; P.path = []; cancelRes(P);
    Object.keys(keys).forEach(k => keys[k] = false); speak(C, '표 검사하겠습니다.', 3); return;
  }
  // 반대편 끝에 도착하면 퇴장하고 다음 등장까지 대기(방향 반전)
  if (!C.path.length) { C.active = false; C.g.visible = false; C.timer = INSPECT_GAP; C.dir *= -1; }
}

// 표 검사 팝업 열기: 가진 표 목록(무임승차면 비어 있음) + '표 없음' 버튼. 표를 선택해야 '보여주기'가 켜짐
function openTicket() {
  const list = $('tkList'); list.innerHTML = ''; $('tkShow').disabled = true;
  if (!GameState.hasTicket) list.innerHTML = '<p>가지고 있는 표가 없어요.</p>';
  else {
    const b = document.createElement('button'); b.className = 'tk'; b.textContent = TICKET.label;
    b.onclick = () => { b.classList.toggle('on'); $('tkShow').disabled = !b.classList.contains('on'); };
    list.appendChild(b);
  }
  $('tkModal').hidden = false;
}

// '보여주기': 표를 확인받고 승무원이 인사한 뒤 계속 지나감
function showTicket() { $('tkModal').hidden = true; GameState.inspecting = false; C.mode = 'walk'; C.pause = 1.5; speak(C, '확인 감사합니다. 좋은 여행 되세요!', 4); }

// '표 없음': 승무원 안내 말풍선 + 화면 중앙 5초 카운트다운 → 강제 퇴장
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
  GameState.ended = true; GameState.kick = null; $('kick').hidden = true;
  clearInterval(RailSound.timer); if (RailSound.master) RailSound.master.gain.value = 0; if (RailSound.audio) RailSound.audio.pause();
  $('endScr').hidden = false;
}
