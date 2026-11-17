/* =====================================================
   10. 숨는 곳 — 의자 등받이 사이 틈 (nook.js)
   중앙 4인석 오른쪽 의자 뒤와 일반석 등받이 사이의 빈 공간 2곳(양쪽 1곳씩).
   눈에 안 보이는 터치 영역만 만들어 '발견하는 재미'를 줍니다.
   임의 규칙: 숨어 있으면 승무원이 검표하지 않음 (유지 여부는 기획 확인 필요)
   ===================================================== */

// 숨는 곳 데이터(좌/우 1곳씩)와 터치 영역 목록
const NOOKS = [-1, 1].map(sg => ({ id: 'nook' + (sg < 0 ? 'L' : 'R'), x: 2.45, z: sg * 1.6, side: sg }));
const nookHits = [];
let pendingNook = null; // '들어가 볼까?' 팝업에서 선택 대기 중인 숨는 곳

// 숨는 곳 터치 영역(보이지 않는 박스) 2개를 장면에 추가
function makeNooks() {
  NOOKS.forEach(n => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(1.0, 0.9, 1.7), new THREE.MeshBasicMaterial({ transparent: true, opacity: 0, depthWrite: false }));
    m.position.set(n.x, 0.45, n.z); m.userData = n; scene.add(m); nookHits.push(m);
  });
}

// 숨는 곳을 터치하면 '들어가 볼까?' 팝업을 띄움(표 검사 중에는 무시)
function askNook(n) { if (GameState.inspecting) return; pendingNook = n; $('nkModal').hidden = false; }

// '들어가기': 통로로 걸어가 틈 안으로 들어가 웅크림
function enterNook(n) { leaveSpot(P); cancelRes(P); P.pendNook = n; P.path = [{ x: n.x, z: 0 }, { x: n.x, z: n.side * 1.6 }]; }

// 틈에 도착하면 웅크려 앉은 상태(hide)로 전환
function hideIn(a, n) { a.pendNook = null; a.state = 'hide'; a.nook = n; a.path = []; a.g.position.set(n.x, 0, n.z); face(a, 0, -n.side); animate(a, false, 0); }

// '나가기': 틈에서 나와 통로 가장자리에 섬
function exitNook(a) { if (a.state !== 'hide') return; const n = a.nook; a.nook = null; a.state = 'idle'; a.g.position.set(n.x, 0, n.side * AISLE); animate(a, false, 0); }

// 앉아 있거나 숨어 있다면 그 자리에서 빠져나옴(이동 명령 전에 공통 사용)
function leaveSpot(a) { if (a.state === 'sit') standUp(a); else if (a.state === 'hide') exitNook(a); }
