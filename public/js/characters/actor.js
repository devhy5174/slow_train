/* =====================================================
   5. 캐릭터 / 행위자 (actor.js)
   플레이어·NPC·판매원·승무원이 같은 Actor 구조를 공유합니다.
   state = idle | sit | hide, path(이동 경로), pend(좌석 예약), pendNook(숨는 곳 예약), held(손에 든 간식)
   행동 로직(brain)은 npc.js에 분리 → 나중에 실제 접속자로 교체하기 쉬움

   좌석 점유는 GameState.occ(state.js)에서 관리합니다.
   actorSnapshot / applyActorSnapshot: Supabase 연결 시 상태 동기화에 사용합니다.
   ===================================================== */

// 캐릭터 3D 모델 생성(몸·머리·머리카락·눈·팔다리·이름표). o = {skin, hair, pants, cap, npc}
function makeChar(shirt, label, o) {
  const g = new THREE.Group();
  // 메쉬를 만들어 부모(기본: 캐릭터 그룹)에 붙이는 내부 헬퍼
  const add = (geo, c, x, y, z, p = g) => { const m = new THREE.Mesh(geo, mat(c)); m.position.set(x, y, z); m.castShadow = true; p.add(m); return m; };
  add(new THREE.BoxGeometry(0.36, 0.4, 0.24), shirt, 0, 0.64, 0);                                   // 몸통
  add(new THREE.SphereGeometry(0.27, 16, 12), o.skin, 0, 1.05, 0);                                  // 머리
  add(new THREE.SphereGeometry(0.285, 16, 12, 0, Math.PI * 2, 0, Math.PI * 0.55), o.hair, 0, 1.07, -0.02); // 머리카락
  if (o.cap) { add(new THREE.CylinderGeometry(0.3, 0.3, 0.1, 16), 0x1c3a6b, 0, 1.36, 0); add(new THREE.BoxGeometry(0.3, 0.03, 0.14), 0x111111, 0, 1.28, 0.28); } // 승무원 모자(o.cap)
  for (const x of [-0.09, 0.09]) add(new THREE.SphereGeometry(0.035, 8, 8), 0x222222, x, 1.04, 0.25); // 눈
  // 팔/다리: 관절 위치에 그룹을 두고 그 안에 박스를 매달아 회전 애니메이션이 자연스럽게 함
  const limb = (x, y, w, h, c) => { const p = new THREE.Group(); p.position.set(x, y, 0); add(new THREE.BoxGeometry(w, h, w), c, 0, -h / 2 + 0.04, 0, p); g.add(p); return p; };
  g.userData = { aL: limb(-0.24, 0.82, 0.11, 0.36, shirt), aR: limb(0.24, 0.82, 0.11, 0.36, shirt),
                 lL: limb(-0.09, 0.44, 0.14, 0.42, o.pants), lR: limb(0.09, 0.44, 0.14, 0.42, o.pants) };
  // 이름표: 텍스트 너비에 맞춘 최소 크기 캔버스, 둥근 모서리, 아이보리 글씨
  // NPC는 약간 밝은 남색, 플레이어는 짙은 남색으로 구분
  const _mc = document.createElement('canvas').getContext('2d');
  _mc.font = 'bold 20px sans-serif';
  const _nlw = Math.min(Math.ceil(_mc.measureText(label).width) + 26, 210), _nlh = 36;
  const cv = document.createElement('canvas'); cv.width = _nlw; cv.height = _nlh;
  const nc = cv.getContext('2d');
  nc.fillStyle = o.npc ? 'rgba(55,75,110,0.78)' : 'rgba(20,37,65,0.86)';
  nc.beginPath(); nc.roundRect(2, 2, _nlw - 4, _nlh - 4, 9); nc.fill();
  nc.fillStyle = '#f0e8d8'; nc.font = 'bold 20px sans-serif'; nc.textAlign = 'center'; nc.textBaseline = 'middle'; nc.fillText(label, _nlw / 2, _nlh / 2);
  const _spSy = 0.14, _spSx = (_nlw / 256) * 0.9; // 스프라이트 크기: 텍스트 길이 비례, 최대 약 0.74
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: new THREE.CanvasTexture(cv), transparent: true }));
  sp.scale.set(_spSx, _spSy, 1); sp.position.y = 1.6; sp.userData.baseScaleY = _spSy; g.add(sp); g.userData.label = sp;
  scene.add(g); return g;
}

// 행위자(Actor) 상태 객체 생성 — 플레이어와 NPC가 같은 구조를 사용
function mkActor(id, name, o) {
  const label = o.label || (o.npc ? `베타 ${name}` : name); // NPC는 이름표에 '베타'를 붙여 실제 이용자와 구분
  return { id, name, npc: !!o.npc, g: makeChar(o.shirt, label, o), state: 'idle', path: [], pend: null, seat: null, res: null,
           t: 0, speed: o.npc ? 1.1 : 2.2, timer: rnd(2, 6), say: rnd(3, 9), bub: null, bubT: 0 };
}

// 걷기/앉기/숨기에 맞춰 팔다리 포즈 갱신(간식을 들고 있으면 오른팔 고정)
function animate(a, moving, dt) {
  const u = a.g.userData, sit = a.state === 'sit', hide = a.state === 'hide';
  // 숨기: 몸을 낮춰 웅크린 자세(이름표는 납작해지지 않게 보정)
  const sy = hide ? 0.62 : 1; a.g.scale.y = sy; u.label.scale.y = (u.label.userData.baseScaleY || 0.3) / sy; u.label.position.y = 1.6 / sy;
  if (moving) a.t += dt * 9;
  const sw = moving ? Math.sin(a.t) * 0.7 : 0; // 걸을 때 팔다리 흔들림 각도
  u.lL.rotation.x = sit ? -1.45 : sw; u.lR.rotation.x = sit ? -1.45 : -sw;
  u.aL.rotation.x = sit ? -0.6 : -sw * 0.8; u.aR.rotation.x = sit ? -0.6 : sw * 0.8;
  if (a.held) u.aR.rotation.x = sit ? -0.9 : -1.0; // 간식을 들고 있으면 오른팔을 앞으로 고정
  if (hide) { u.aL.rotation.x = u.aR.rotation.x = -1.3; u.lL.rotation.x = u.lR.rotation.x = -1.2; } // 웅크려 무릎을 감싼 자세
}

// 행위자가 (dx,dz) 방향을 바라보게 회전
const face = (a, dx, dz) => { a.g.rotation.y = Math.atan2(dx, dz); };

// 행위자를 좌석에 앉힘: 점유 등록, 좌석 방향·높이 맞춤 (플레이어면 저장)
function sitDown(a, s) {
  a.seat = s; a.res = null; a.pend = null; a.path = []; a.state = 'sit'; GameState.occ[s.id] = a.id;
  const dx = Math.cos(s.yaw), dz = -Math.sin(s.yaw);
  a.g.position.set(s.x - dx * 0.08, 0.15, s.z - dz * 0.08); face(a, dx, dz); animate(a, false, 0);
  if (a.npc) a.timer = rnd(8, 22); else saveNow();
}

// 앉은 상태에서 일어나 통로 가장자리로 나옴(점유 해제)
function standUp(a) {
  if (a.state !== 'sit') return;
  const s = a.seat; if (GameState.occ[s.id] === a.id) delete GameState.occ[s.id];
  a.seat = null; a.state = 'idle'; a.g.position.set(s.x, 0, Math.sign(s.z) * AISLE); animate(a, false, 0);
  if (a.npc) a.timer = rnd(1, 3); else saveNow();
}

// 좌석 예약 취소(이동 중 목적지를 바꿀 때)
function cancelRes(a) { if (a.res) { if (GameState.occ[a.res.id] === a.id) delete GameState.occ[a.res.id]; a.res = null; } a.pend = null; a.pendNook = null; }

// 좌석으로 이동 명령: 예약 후 통로를 지나 착석. 이미 점유된 좌석이면 거부(false)
function goSeat(a, s) {
  if (GameState.occ[s.id] && GameState.occ[s.id] !== a.id) return false; // 같은 좌석에 둘이 앉지 못함
  cancelRes(a);
  if (a.state === 'hide') exitNook(a);
  if (a.state === 'sit') { const x = a.g.position.x; standUp(a); a.g.position.set(x, 0, 0); }
  GameState.occ[s.id] = a.id; a.res = s; a.pend = s; a.path = [{ x: s.x, z: 0 }, { x: s.x, z: s.z }]; return true;
}

// 통로 위 지점으로 이동 명령(통로 밖으로는 못 나가게 제한)
function goFloor(a, x, z) {
  leaveSpot(a);
  cancelRes(a); a.path = [{ x: Math.max(-XMAX, Math.min(XMAX, x)), z: Math.max(-AISLE, Math.min(AISLE, z)) }];
}

// 경로를 따라 한 프레임만큼 이동. 반환값: 이동 중인지 여부. 도착 시 착석/숨기 처리
function stepPath(a, dt) {
  if (!a.path.length) return false;
  const pos = a.g.position, t = a.path[0], dx = t.x - pos.x, dz = t.z - pos.z, dist = Math.hypot(dx, dz), st = a.speed * dt;
  if (dist <= st) { pos.x = t.x; pos.z = t.z; a.path.shift(); if (!a.path.length && a.pend) sitDown(a, a.pend); else if (!a.path.length && a.pendNook) hideIn(a, a.pendNook); return false; }
  pos.x += dx / dist * st; pos.z += dz / dist * st; face(a, dx, dz); return true;
}

// ----- 상태 직렬화 (Supabase 동기화 준비) -----

// 행위자의 현재 상태를 네트워크로 전송 가능한 순수 객체로 추출합니다.
// Supabase 연결 시: actorSnapshot(P) → channel.send(snapshot)
function actorSnapshot(a) {
  return {
    id: a.id,
    name: a.name,
    carId: GameState.carId,
    x: a.g.position.x,
    z: a.g.position.z,
    ry: a.g.rotation.y,          // 바라보는 방향 (Y축 회전)
    state: a.state,               // 'idle' | 'sit' | 'hide'
    seatId: a.seat ? a.seat.id : null,
    nookId: a.nook ? a.nook.id : null,
  };
}

// 서버에서 받은 스냅샷을 행위자에 적용합니다.
// 원격 이용자 행위자는 npc: true로 생성해야 saveNow()가 호출되지 않습니다.
// (sitDown 내부: a.npc === true 이면 저장 생략)
// Supabase 연결 시: channel.on(snap => applyActorSnapshot(remoteActor, snap))
function applyActorSnapshot(a, snap) {
  // 위치·방향 갱신
  a.g.position.x = snap.x;
  a.g.position.z = snap.z;
  a.g.rotation.y = snap.ry ?? a.g.rotation.y;

  // 착석 상태 반영
  if (snap.state === 'sit' && snap.seatId) {
    if (a.state !== 'sit') {
      const s = SEATS.find(q => q.id === snap.seatId);
      if (s) sitDown(a, s);
    }
  } else if (snap.state === 'hide' && snap.nookId) {
    // 숨기 상태 반영 (NOOKS, hideIn은 nook.js에서 선언 — 호출 시점에 존재)
    if (a.state !== 'hide') {
      const n = NOOKS.find(q => q.id === snap.nookId);
      if (n) hideIn(a, n);
    }
  } else {
    // 이동 중 / 서 있는 상태
    if (a.state === 'sit') standUp(a);
    else if (a.state === 'hide') exitNook(a);
  }
}
