/* =====================================================
   12. 하단 버튼/패널/팝업 UI (ui.js)
   말풍선 문구 목록, 간식 메뉴 버튼, 팝업 버튼 이벤트를 연결합니다.
   ===================================================== */

// 플레이어가 고를 수 있는 미리 정해진 말풍선 문구 7개
const PHRASES = ['안녕하세요!', '여기 앉아도 될까요?', '풍경이 예쁘네요.', '간식 드실래요?', '좋은 여행 되세요!', '하하하!', '👋 ❤️ 😊'];

// 하단 버튼/패널 내용(말풍선 문구, 간식 메뉴) 만들고 이벤트 연결
function buildUI() {
  const ph = $('phr'), mn = $('menu');
  ph.innerHTML = '<h2>말풍선 선택</h2>'; mn.innerHTML = '<h2>간식 메뉴 (가상 구매)</h2>';
  // 말풍선 문구 버튼: 누르면 플레이어 머리 위에 표시
  PHRASES.forEach(t => {
    const b = document.createElement('button'); b.textContent = t;
    b.onclick = () => { speak(P, t, 4); Multi.broadcastSpeak(t, 4); ph.hidden = true; }; ph.appendChild(b);
  });
  // 간식 메뉴 버튼: 누르면 가상 구매 → 손에 듦
  MENU.forEach(([n, pr, em]) => {
    const b = document.createElement('button'); b.className = 'item';
    b.innerHTML = `<span>${em} ${n}</span><span>${pr.toLocaleString()}원</span>`;
    b.onclick = () => { mn.hidden = true; setHeld(P, n); toast(`${n}을(를) 샀어요! (가상 구매 · 결제 없음)`); }; mn.appendChild(b);
  });
  // 하단 바 버튼 연결
  $('bSay').onclick = () => panel('phr'); $('bShop').onclick = openShop; $('bDrop').onclick = dropHeld; $('bExit').onclick = () => exitNook(P);
  $('bInfo').onclick = () => { $('infoModal').hidden = false; };
  initModals(); initSoundUI(); initTicketUI();
}

// 표 검사/지정석 안내/숨는 곳/퇴장 팝업의 버튼 이벤트 연결
function initModals() {
  $('tkShow').onclick = processTicketCheck; $('tkNone').onclick = noTicket; // tkNone은 비상 대비용으로 유지
  $('sgYes').onclick = acceptSeatGuide; $('sgNo').onclick = declineSeatGuide;
  $('nkYes').onclick = () => { $('nkModal').hidden = true; if (pendingNook) enterNook(pendingNook); };
  $('nkNo').onclick = () => { $('nkModal').hidden = true; pendingNook = null; };
  $('endBtn').onclick = () => location.reload();
  $('infoClose').onclick = () => { $('infoModal').hidden = true; };
}
