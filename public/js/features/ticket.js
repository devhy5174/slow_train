/* =====================================================
   승차권 발급 및 좌석 안내 (ticket.js)
   - 승차권 구매 시 지정석(1~24번) 자동 배정
   - 입장 직후 승차권 팝업 자동 표시
   - 하단 바 '🎫 승차권 확인' 버튼으로 재확인 가능
   - 무임승차자는 발급 없음, 버튼 숨김

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

// 버튼 이벤트 연결 — buildUI() 에서 호출
// 무임승차자는 버튼을 숨기고, 승차권 구매자는 버튼 표시
function initTicketUI() {
  if (!GameState.hasTicket) { $('bTicket').hidden = true; return; }
  $('bTicket').hidden = false;
  $('bTicket').onclick = showMyTicket;
  $('myTicketClose').onclick = () => { $('myTicketModal').hidden = true; };
}
