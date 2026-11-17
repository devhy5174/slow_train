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

// ----- 황금색 점선 경로 안내 + 자동 이동 -----
// 상태 변수
let _guideDots = [], _guideArrowG = null, _guideRafG = null, _guideTimeoutG = null;

// 지정석까지 황금색 반짝 점선 경로를 그리고 플레이어를 자동 이동시킴
// acceptSeatGuide / showTicket(standing) / 내 자리 찾기 버튼에서 호출
function startSeatGuidance() {
  if (!GameState.ticket || !P) return;
  const seat = SEATS.find(s => s.id === GameState.ticket.seatId);
  if (!seat) return;

  clearSeatGuidance();
  clearSeatArrow(); // 기존 빨간 화살표 정리

  // 경로 시작점: 앉아 있으면 일어난 직후 z=0, 서 있으면 현재 위치
  const fromX = P.g.position.x;
  const fromZ = P.state === 'sit' ? 0 : P.g.position.z;

  // 경로 선분 위에 일정 간격으로 황금색 구 배치
  const STEP = 0.35, DOT_Y = 0.06;
  const addDots = (x1, z1, x2, z2) => {
    const len = Math.hypot(x2 - x1, z2 - z1);
    if (len < 0.05) return;
    const n = Math.max(2, Math.round(len / STEP));
    for (let i = 0; i <= n; i++) {
      const t = i / n;
      const mesh = new THREE.Mesh(
        new THREE.SphereGeometry(0.05, 8, 6),
        new THREE.MeshStandardMaterial({
          color: 0xf2b632, emissive: 0xf2b632, emissiveIntensity: 0.6,
          transparent: true, opacity: 0.9, roughness: 0.5, depthWrite: false
        })
      );
      mesh.position.set(x1 + (x2 - x1) * t, DOT_Y, z1 + (z2 - z1) * t);
      mesh.userData.phase = _guideDots.length * 0.5; // 파도 위상 오프셋
      scene.add(mesh);
      _guideDots.push(mesh);
    }
  };
  // 세그먼트 1: 현재 위치 → 목적 열 통로 중앙
  addDots(fromX, fromZ, seat.x, 0);
  // 세그먼트 2: 통로 중앙 → 좌석
  addDots(seat.x, 0, seat.x, seat.z);

  // 목적지 황금 화살표 (↓ 콘)
  const arrowGeo = new THREE.ConeGeometry(0.14, 0.34, 8);
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0xf2b632, emissive: 0xf2b632, emissiveIntensity: 0.5,
    transparent: true, opacity: 1, roughness: 0.3
  });
  _guideArrowG = new THREE.Mesh(arrowGeo, arrowMat);
  _guideArrowG.rotation.x = Math.PI; // 아래 방향으로 뒤집음
  _guideArrowG.position.set(seat.x, _ARROW_BASE_Y, seat.z);
  scene.add(_guideArrowG);

  _guideRafG = null;
  const startT = performance.now();
  (function animatePath() {
    if (!_guideDots.length && !_guideArrowG) return;
    const t = (performance.now() - startT) * 0.001; // 초 단위

    // 각 점: 파도처럼 순서대로 밝아짐 + 크기 맥동
    _guideDots.forEach(d => {
      const v = 0.5 + 0.5 * Math.sin(t * 3.0 - d.userData.phase);
      d.material.emissiveIntensity = 0.2 + v * 1.0;
      d.material.opacity = 0.35 + v * 0.65;
      const s = 0.6 + v * 0.6;
      d.scale.set(s, s, s);
    });

    // 화살표: 위아래 둥둥
    if (_guideArrowG) {
      _guideArrowG.position.y = _ARROW_BASE_Y + Math.sin(t * 2.0) * 0.12;
      _guideArrowG.material.emissiveIntensity = 0.3 + 0.3 * Math.sin(t * 2.5);
    }

    // 플레이어가 지정석에 착석하면 안내 종료
    if (P && P.state === 'sit' && P.seat && GameState.ticket && P.seat.id === GameState.ticket.seatId) {
      clearSeatGuidance();
      return;
    }
    _guideRafG = requestAnimationFrame(animatePath);
  })();

  // 자동 이동
  goSeat(P, seat);

  // 25초 후 자동 종료 (도달 못해도 정리)
  _guideTimeoutG = setTimeout(clearSeatGuidance, 25000);
}

// 경로 점선·화살표 제거 및 메모리 정리
function clearSeatGuidance() {
  if (_guideRafG) { cancelAnimationFrame(_guideRafG); _guideRafG = null; }
  if (_guideTimeoutG) { clearTimeout(_guideTimeoutG); _guideTimeoutG = null; }
  _guideDots.forEach(d => { scene.remove(d); d.geometry.dispose(); d.material.dispose(); });
  _guideDots = [];
  if (_guideArrowG) {
    scene.remove(_guideArrowG);
    _guideArrowG.geometry.dispose();
    _guideArrowG.material.dispose();
    _guideArrowG = null;
  }
}

// ----- 자리 반환 요청 -----

// 플레이어 지정석에 앉은 베타 NPC 또는 원격 플레이어에게 자리 반환 요청
// - NPC: "앗 죄송합니다!" 말풍선 → 1.2초 후 일어나 통로로 이동
// - 원격 플레이어: seat_yield Broadcast 전송 → 상대방이 사과 후 자동으로 일어남
// - 반환값: 요청 성공 여부
function requestSeatYield() {
  if (!GameState.ticket) return false;
  const seatId = GameState.ticket.seatId;
  const occupantId = GameState.occ[seatId];
  if (!occupantId) return false; // 이미 비어 있음

  // 베타 NPC인지 확인
  const npc = NPCS.find(n => n.id === occupantId);
  if (npc) {
    // 플레이어 말풍선 → 1초 뒤 NPC 사과 → 1.2초 뒤 일어나 걷기
    speak(P, '여기 제자린데요.', 2.5);
    setTimeout(() => { speak(npc, '앗 죄송합니다!', 3.5); }, 1000);
    setTimeout(() => {
      if (npc.state === 'sit' && npc.seat && npc.seat.id === seatId) {
        standUp(npc);
        goFloor(npc, rnd(-XMAX, XMAX), rnd(-AISLE, AISLE));
        npc.timer = rnd(8, 15);
      }
    }, 1200);
    return true;
  }

  // 원격 플레이어인 경우 (NPC도 아니고 나 자신도 아님)
  if (occupantId !== P.id) {
    speak(P, '여기 제자린데요.', 2.5);
    Multi.broadcastSpeak('여기 제자린데요.', 2.5); // 내 대사를 상대방 화면에도 표시
    Multi.requestYield(seatId);
    return true;
  }

  return false;
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
  $('bFindSeat').onclick = startSeatGuidance;
}
