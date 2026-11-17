/* =====================================================
   승차권 발급 및 좌석 안내 (ticket.js)
   - 승차권 구매 시 지정석(1~24번) 자동 배정
   - 입장 직후 승차권 팝업 자동 표시
   - '🎫 승차권 확인' 버튼으로 재확인 가능
   - '📍 내 자리 찾기' 버튼으로 지정석 위에 5초간 빨간 3D 화살표 표시
   - 무임승차자는 발급 없음, 버튼 모두 숨김

   향후 Supabase 연결 시:
     - assignTicket → Repo.issueTicket(carId) 로 교체
     - GameState.ticket 은 서버 응답값으로 채움
   ===================================================== */

// 지정석 배정: 저장된 좌석 복구 우선, 실패 시 새 무작위 배정
// savedSeatId: 이전 세션에서 저장된 ticketSeatId (같은 닉네임 재접속 시 전달)
// spawnActors()에서 NPC 착석 전에 호출해야 NPC와 충돌하지 않음
function assignTicket(savedSeatId) {
  if (!GameState.hasTicket) return; // 무임승차면 발급하지 않음

  // 1순위: 저장된 지정석 복구 (새로고침·재접속 유예)
  if (savedSeatId) {
    const saved = SEATS.find(s => s.id === savedSeatId && s.seatType === 'reserved');
    if (saved && !GameState.occ[saved.id]) {
      GameState.ticket = { carId: GameState.carId, seatId: saved.id, displayNum: saved.displayNum };
      refreshSeatLabels();
      return;
    }
    // 저장된 좌석이 이미 점유됐으면 새 배정으로 넘어감
  }

  // 2순위: 빈 지정석 무작위 배정
  const available = SEATS.filter(s => s.seatType === 'reserved' && !GameState.occ[s.id]);
  if (!available.length) return; // 싱글플레이에서는 발생하지 않는 방어 코드
  const seat = pick(available);
  GameState.ticket = { carId: GameState.carId, seatId: seat.id, displayNum: seat.displayNum };
  refreshSeatLabels();
}

// 내 승차권 팝업 표시 — 검표 중이거나 무임승차면 무시
function showMyTicket() {
  if (!GameState.ticket) return;
  if (GameState.inspecting) return;
  const t = GameState.ticket;
  $('myTicketName').textContent = P.name;
  $('myTicketCar').textContent = `${t.carId}호차`;
  $('myTicketSeat').textContent = `${t.displayNum}번 지정석`;
  $('myTicketModal').hidden = false;
}

// ----- 내 자리 찾기 (3D 화살표) -----
// 화살표 상태 (중복 클릭 방지 · 메모리 해제용)
let _arrowCone = null, _arrowRaf = null, _arrowStart = 0;
const _ARROW_DURATION = 5000; // 표시 지속 시간(ms)
const _ARROW_BASE_Y   = 2.28; // 콘 중심 기본 Y (팁: ~2.14, 헤드레스트 1.64 위)

// 내 지정석 위에 빨간 콘(▼)을 5초간 둥둥 떠다니다가 페이드아웃
// - 기존 좌석 색상·소재 불변
// - 반복 클릭 시 타이머 초기화 (중첩 없음)
// - clearSeatArrow()로 외부에서도 강제 제거 가능 (객차 이동 등)
function highlightMySeat() {
  if (!GameState.ticket) return;
  const seat = SEATS.find(s => s.id === GameState.ticket.seatId);
  if (!seat) return;

  clearSeatArrow(); // 기존 화살표 제거 후 재시작

  // 아래를 가리키는 콘: ConeGeometry 기본값은 위쪽 → rotation.x = PI 로 뒤집음
  const geo  = new THREE.ConeGeometry(0.11, 0.28, 8);
  const amat = new THREE.MeshStandardMaterial({
    color: 0xe8553d, roughness: 0.5, metalness: 0, transparent: true, opacity: 1
  });
  _arrowCone = new THREE.Mesh(geo, amat);
  _arrowCone.rotation.x = Math.PI;
  _arrowCone.castShadow = false;
  _arrowCone.receiveShadow = false;
  _arrowCone.position.set(seat.x, _ARROW_BASE_Y, seat.z);
  scene.add(_arrowCone);
  _arrowStart = performance.now();

  (function tick() {
    if (!_arrowCone) return;
    const e = performance.now() - _arrowStart;
    if (e >= _ARROW_DURATION) { clearSeatArrow(); return; }

    // 위아래 둥둥: 1.1초 주기 sin 파 ±0.12
    _arrowCone.position.y = _ARROW_BASE_Y + Math.sin(e * Math.PI / 550) * 0.12;

    // 마지막 1초 페이드아웃
    amat.opacity = e < (_ARROW_DURATION - 1000) ? 1 : (_ARROW_DURATION - e) / 1000;

    _arrowRaf = requestAnimationFrame(tick);
  })();
}

// 화살표 제거 및 메모리 정리 (5초 종료 · 반복 클릭 · 객차 이동 등에서 호출)
function clearSeatArrow() {
  if (_arrowRaf) { cancelAnimationFrame(_arrowRaf); _arrowRaf = null; }
  if (_arrowCone) {
    scene.remove(_arrowCone);
    _arrowCone.geometry.dispose();
    _arrowCone.material.dispose();
    _arrowCone = null;
  }
}

// ----- 자리 반환 요청 -----

// 플레이어 지정석에 앉은 베타 NPC에게 자리 반환 요청
// - NPC: "앗 죄송합니다!" 말풍선 → 1.2초 후 일어나 통로로 이동
// - 향후 실제 이용자가 앉은 경우는 서버 측 권한 확인 후 처리 (현재 미구현)
// - 반환값: 요청 성공 여부 (NPC가 앉아 있던 경우 true)
function requestSeatYield() {
  if (!GameState.ticket) return false;
  const seatId = GameState.ticket.seatId;
  const occupantId = GameState.occ[seatId];
  if (!occupantId) return false; // 이미 비어 있음

  // 베타 NPC인지 확인 (실제 이용자 ID는 'npc' 로 시작하지 않음)
  const npc = NPCS.find(n => n.id === occupantId);
  if (!npc) return false;

  // 사과 말풍선 표시 → 짧은 지연 후 일어나 걷기
  speak(npc, '앗 죄송합니다!', 3.5);
  setTimeout(() => {
    if (npc.state === 'sit' && npc.seat && npc.seat.id === seatId) {
      standUp(npc);
      goFloor(npc, rnd(-XMAX, XMAX), rnd(-AISLE, AISLE));
      npc.timer = rnd(8, 15); // 한동안 통로를 걸어다닌 뒤 다시 착석 시도
    }
  }, 1200);

  return true;
}

// 버튼 이벤트 연결 — buildUI() 에서 호출
// 무임승차자는 두 버튼 모두 숨기고, 승차권 구매자는 모두 표시
function initTicketUI() {
  if (!GameState.hasTicket) {
    $('bTicket').hidden = true;
    $('bFindSeat').hidden = true;
    return;
  }
  $('bTicket').hidden = false;
  $('bFindSeat').hidden = false;
  $('bTicket').onclick = showMyTicket;
  $('myTicketClose').onclick = () => { $('myTicketModal').hidden = true; };
  $('bFindSeat').onclick = highlightMySeat;
}
