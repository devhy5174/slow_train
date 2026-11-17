/* =====================================================
   승차권 발급 및 좌석 안내 (ticket.js)
   - 승차권 구매 시 지정석(1~24번) 자동 배정
   - 입장 직후 승차권 팝업 자동 표시
   - '🎫 승차권 확인' 버튼으로 재확인 가능
   - '📍 내 자리 찾기' 버튼으로 지정석 3초 황금빛 강조
   - 무임승차자는 발급 없음, 버튼 모두 숨김

   향후 Supabase 연결 시:
     - assignTicket → Repo.issueTicket(carId) 로 교체
     - GameState.ticket 은 서버 응답값으로 채움
   ===================================================== */

// 지정석(seatType === 'reserved') 중 NPC와 플레이어 미착석 좌석을 무작위 배정
// spawnActors()에서 NPC 착석 전에 호출해야 NPC와 충돌하지 않음
function assignTicket() {
  if (!GameState.hasTicket) return; // 무임승차면 발급하지 않음
  const available = SEATS.filter(s => s.seatType === 'reserved' && !GameState.occ[s.id]);
  if (!available.length) return;   // 싱글플레이에서는 발생하지 않는 방어 코드
  const seat = pick(available);
  GameState.ticket = { carId: GameState.carId, seatId: seat.id, displayNum: seat.displayNum };
  refreshSeatLabels(); // 내 지정석 레이블 황금색으로 갱신
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

// ----- 내 자리 찾기 -----
// 하이라이트 상태 (중복 클릭 방지 · 메모리 해제용)
let _hlMesh = null, _hlRaf = null, _hlStart = 0;

// 내 지정석 위에 황금빛 오버레이를 3초간 펄스 표시
// - 기존 파란 좌석 메쉬는 변경하지 않음 (별도 플레인만 추가·제거)
// - 여러 번 눌러도 기존 효과를 취소 후 재시작하여 중첩 없음
function highlightMySeat() {
  if (!GameState.ticket) return;
  const seat = SEATS.find(s => s.id === GameState.ticket.seatId);
  if (!seat) return;

  // 기존 하이라이트가 실행 중이면 취소 후 새로 시작
  if (_hlRaf) { cancelAnimationFrame(_hlRaf); _hlRaf = null; }
  if (_hlMesh) { scene.remove(_hlMesh); _hlMesh.geometry.dispose(); _hlMesh.material.dispose(); _hlMesh = null; }

  // 좌석 방석 위에 얇은 황금빛 플레인 생성 (y=0.57: 방석 상단 0.52보다 약간 위)
  // 지정석은 모두 yaw=0이므로 수평 회전만 적용
  const geo = new THREE.PlaneGeometry(0.74, 0.89);
  const hmat = new THREE.MeshBasicMaterial({
    color: 0xf2b632, transparent: true, opacity: 0, depthWrite: false, side: THREE.DoubleSide
  });
  _hlMesh = new THREE.Mesh(geo, hmat);
  _hlMesh.rotation.x = -Math.PI / 2;
  _hlMesh.position.set(seat.x, 0.57, seat.z);
  scene.add(_hlMesh);
  _hlStart = performance.now();

  (function tick() {
    if (!_hlMesh) return;
    const e = performance.now() - _hlStart;
    if (e >= 3000) {
      // 3초 종료: 메쉬 제거 및 메모리 해제
      scene.remove(_hlMesh); _hlMesh.geometry.dispose(); _hlMesh.material.dispose();
      _hlMesh = null; _hlRaf = null;
      return;
    }
    // 페이드 인(처음 400ms) · 페이드 아웃(마지막 600ms) · 펄스(약 3회)
    const fadeIn  = Math.min(1, e / 400);
    const fadeOut = Math.max(0, 1 - Math.max(0, e - 2400) / 600);
    const pulse   = (Math.sin(e * Math.PI / 500) + 1) / 2; // 1초 주기 펄스
    hmat.opacity  = fadeIn * fadeOut * (0.35 + 0.45 * pulse);
    _hlRaf = requestAnimationFrame(tick);
  })();
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
